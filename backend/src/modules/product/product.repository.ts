import { PrismaClient, Prisma } from "@prisma/client";
import { ProductEntity } from "./product.entity";
import {
  ProductVariantEntity,
  type VariantAttribute,
} from "./product-variant.entity";
import type {
  CreateProductDto,
  ProductQuery,
  AddVariantDto,
  UpdateVariantDto,
} from "./product.dto";

/**
 * ProductRepository — Prisma-backed.
 *
 * Keeps the same public API as the Kysely version.
 * Uses Prisma interactive transactions (prisma.$transaction(async tx => ...))
 * for the multi-insert flows that the Kysely version wrapped in
 * `db.transaction().execute(...)`.
 */
export class ProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(
    query: ProductQuery,
  ): Promise<{ data: ProductEntity[]; total: number }> {
    const where: Prisma.ProductWhereInput = { deletedAt: null };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.sellerId) where.sellerId = query.sellerId;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.name = { contains: query.search, mode: "insensitive" };
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.basePrice = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      };
    }

    const sortMap: Record<ProductQuery["sortBy"], Prisma.ProductOrderByWithRelationInput> = {
      price_asc: { basePrice: "asc" },
      price_desc: { basePrice: "desc" },
      name_asc: { name: "asc" },
      name_desc: { name: "desc" },
      created_desc: { createdAt: "desc" },
    };
    const orderBy = sortMap[query.sortBy] ?? sortMap.created_desc;

    const [total, rows] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    // For each product, attach the cheapest active variant so ProductCard
    // can render a hero image. Single bulk query (no N+1).
    const productIds = rows.map((r) => r.id);
    const variantByProduct = await this.loadCheapestVariantImage(productIds);

    return {
      data: rows.map((row) => {
        const variant = variantByProduct.get(row.id);
        // Pass the cheapest variant down to fromDatabase so the entity's
        // getMinPrice/getMaxPrice/toPublicSummary have the data they need.
        return ProductEntity.fromDatabase(
          row,
          variant ? [variant] : [],
        );
      }),
      total,
    };
  }

  /**
   * Bulk-load the cheapest active variant per product so listing endpoints
   * can surface a hero image and accurate price bounds without N+1 queries.
   * Uses `DISTINCT ON` (Postgres) to grab the lowest-priced variant per
   * product_id in a single round trip.
   */
  private async loadCheapestVariantImage(
    productIds: string[],
  ): Promise<Map<string, ProductVariantEntity>> {
    const result = new Map<string, ProductVariantEntity>();
    if (productIds.length === 0) return result;

    interface RawVariant {
      productId: string;
      variantId: string;
      sku: string;
      price: Prisma.Decimal;
      imageUrl: string | null;
      isActive: boolean;
      createdAt: Date;
      /** Joined inventory fields — null when a variant has no inventory row yet. */
      quantity: number | null;
      reserved: number | null;
    }

    const rows = await this.prisma.$queryRaw<RawVariant[]>`
      SELECT DISTINCT ON (pv.product_id)
        pv.product_id      AS "productId",
        pv.id              AS "variantId",
        pv.sku,
        pv.price,
        pv.image_url      AS "imageUrl",
        pv.is_active       AS "isActive",
        pv.created_at      AS "createdAt",
        inv.quantity,
        inv.reserved
      FROM product_variants pv
      LEFT JOIN inventory inv ON inv.variant_id = pv.id
      WHERE pv.product_id = ANY(${productIds}::uuid[])
        AND pv.is_active = true
      ORDER BY pv.product_id, pv.price ASC, pv.created_at ASC
    `;

    for (const row of rows) {
      const variantRow = {
        id: row.variantId,
        productId: row.productId,
        sku: row.sku,
        price: row.price,
        imageUrl: row.imageUrl,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.createdAt,
        // Compute `available` so the entity's `stockStatus` getter returns
        // 'out_of_stock' / 'low_stock' instead of always falling back to
        // 'in_stock' when inventory data is absent from this listing query.
        available:
          row.quantity != null
            ? Math.max(0, row.quantity - (row.reserved ?? 0))
            : undefined,
      };
      result.set(
        row.productId,
        ProductVariantEntity.fromDatabase(
          variantRow as unknown as import("./product-variant.entity").ProductVariantRowWithStock,
        ),
      );
    }
    return result;
  }

  async findById(id: string): Promise<ProductEntity | null> {
    const row = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) return null;

    const variants = await this.loadVariantsWithAttributes(id);
    return ProductEntity.fromDatabase(row, variants);
  }

  async findBySlug(slug: string): Promise<ProductEntity | null> {
    const row = await this.prisma.product.findFirst({
      where: { slug, deletedAt: null },
    });
    if (!row) return null;

    const variants = await this.loadVariantsWithAttributes(row.id);
    return ProductEntity.fromDatabase(row, variants);
  }

  async create(dto: CreateProductDto, sellerId: string): Promise<ProductEntity> {
    return this.prisma.$transaction(async (tx) => {
      const productRow = await tx.product.create({
        data: {
          sellerId,
          categoryId: dto.categoryId ?? null,
          name: dto.name,
          slug: dto.slug,
          description: dto.description ?? null,
          basePrice: dto.basePrice,
          isActive: dto.isActive,
        },
      });

      const variantEntities: ProductVariantEntity[] = [];

      for (const variantDto of dto.variants) {
        const variantRow = await tx.productVariant.create({
          data: {
            productId: productRow.id,
            sku: variantDto.sku,
            price: variantDto.price,
            imageUrl: variantDto.imageUrl ?? null,
            isActive: variantDto.isActive,
          },
        });

        await tx.inventory.create({
          data: {
            variantId: variantRow.id,
            quantity: 0,
            reserved: 0,
          },
        });

        const attributes: VariantAttribute[] = [];
        // Guard against undefined attributes (schema uses .optional()).
        const entries = Object.entries(variantDto.attributes ?? {});
        for (const [attrName, attrValue] of entries) {
          const normalized = attrName.toLowerCase();

          // upsert: create attribute if it doesn't exist
          const attr = await tx.productAttribute.upsert({
            where: { name: normalized },
            update: {},
            create: { name: normalized },
          });

          await tx.variantAttributeValue.create({
            data: {
              variantId: variantRow.id,
              attributeId: attr.id,
              value: attrValue,
            },
          });

          attributes.push({
            attributeId: attr.id,
            attributeName: attrName,
            value: attrValue,
          });
        }

        variantEntities.push(
          ProductVariantEntity.fromDatabase(variantRow, attributes),
        );
      }

      return ProductEntity.fromDatabase(productRow, variantEntities);
    });
  }

  async update(
    id: string,
    data: Partial<{
      categoryId: string | null;
      name: string;
      slug: string;
      description: string | null;
      basePrice: number;
      isActive: boolean;
      images: string[];
    }>,
  ): Promise<ProductEntity | null> {
    const updateData: Prisma.ProductUpdateInput = {};
    if (data.categoryId !== undefined) {
      updateData.category =
        data.categoryId === null
          ? { disconnect: true }
          : { connect: { id: data.categoryId } };
    }
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.basePrice !== undefined) updateData.basePrice = data.basePrice;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.images !== undefined) updateData.images = { set: data.images };

    try {
      const row = await this.prisma.product.update({ where: { id }, data: updateData });
      const variants = await this.loadVariantsWithAttributes(id);
      return ProductEntity.fromDatabase(row, variants);
    } catch {
      return null;
    }
  }

  /**
   * Append newly uploaded image URLs to a product's `images` array.
   *
   * Why this is a dedicated method: the upload route processes N files
   * in parallel. We need to merge those URLs onto whatever was already
   * in the array (first upload on a blank product → append N; second
   * upload after some edits → append more) without an explicit PATCH
   * from the dashboard.
   *
   * Uses a Postgres `array_cat` so the operation is atomic and safe
   * against concurrent appends from a second upload tab.
   */
  async appendProductImages(
    productId: string,
    urls: string[],
  ): Promise<string[] | null> {
    if (urls.length === 0) return null;
    // Same strict-overwrite rationale as `setProductImages`: let raw
    // query errors bubble so the service can return a real failure
    // instead of a misleading "null".
    const rows = await this.prisma.$queryRaw<{ images: string[] }[]>`
      UPDATE products
      SET images = images || ${urls}::text[],
          updated_at = NOW()
      WHERE id = ${productId}::uuid
        AND deleted_at IS NULL
      RETURNING images
    `;
    return rows[0]?.images ?? null;
  }

  /**
   * Replace a product's entire `images` array (used by the reorder /
   * remove flow from the edit page). Validation is enforced upstream.
   *
   * Strict overwrite contract: the returned `string[]` is exactly what
   * was persisted. We deliberately let raw-query errors propagate so
   * the service can fail loudly — a silent `return null` here turned a
   * cast / type mismatch into a 500-only error that the dashboard
   * couldn't see, and a swallowed exception looked like a "successful
   * no-op" in the response (the controller would then respond 200 with
   * an empty array, masking the real failure).
   *
   * Returning `null` is reserved for "row didn't match the WHERE
   * clause" (e.g. soft-deleted or wrong id) — the service translates
   * that into a 404.
   */
  async setProductImages(
    productId: string,
    urls: string[],
  ): Promise<string[] | null> {
    return this.prisma.$transaction(async (tx) => {
      // Direction A — Gallery → Variant:
      // Before writing the new gallery, diff against the old one so we can
      // null out any variant.imageUrl that used a URL the seller just
      // removed from the gallery. This keeps the two in sync without a
      // separate sync endpoint.
      const oldProduct = await tx.product.findUnique({
        where: { id: productId },
        select: { images: true },
      });
      const oldImages: string[] = Array.isArray(oldProduct?.images)
        ? (oldProduct.images as string[])
        : [];

      const newSet = new Set(urls);
      const removedUrls = oldImages.filter((u) => !newSet.has(u));

      if (removedUrls.length > 0) {
        // Null out any variant whose imageUrl is among the removed URLs.
        // An empty array matches nothing — safe even when no URLs are removed.
        await tx.productVariant.updateMany({
          where: {
            productId,
            imageUrl: { in: removedUrls },
          },
          data: { imageUrl: null },
        });
      }

      // Write the new gallery.
      await tx.product.update({
        where: { id: productId },
        data: { images: urls },
      });

      const updated = await tx.product.findUnique({
        where: { id: productId },
        select: { images: true },
      });
      return Array.isArray(updated?.images)
        ? (updated.images as string[])
        : [];
    });
  }

  async delete(id: string): Promise<boolean> {
    try {
      // Soft-delete: stamp deletedAt + flip isActive, and rewrite slug to a
      // unique value (slug || '-' || EXTRACT(EPOCH FROM NOW())) so the
      // original slug can be reused for a new product.
      await this.prisma.$executeRaw`
        UPDATE products
        SET deleted_at = NOW(),
            is_active = false,
            slug = slug || '-' || EXTRACT(EPOCH FROM NOW())::text
        WHERE id = ${id}::uuid
          AND deleted_at IS NULL
      `;
      return true;
    } catch {
      return false;
    }
  }

  async addVariant(
    productId: string,
    dto: AddVariantDto,
  ): Promise<ProductVariantEntity> {
    return this.prisma.$transaction(async (tx) => {
      const variantRow = await tx.productVariant.create({
        data: {
          productId,
          sku: dto.sku,
          price: dto.price,
          imageUrl: dto.imageUrl ?? null,
          isActive: dto.isActive,
        },
      });

      await tx.inventory.create({
        data: {
          variantId: variantRow.id,
          quantity: 0,
          reserved: 0,
        },
      });

      // Sync the variant's image into the parent product's gallery so it
      // appears in the Basic Info gallery tab without any frontend changes.
      if (dto.imageUrl) {
        const parent = await tx.product.findUnique({
          where: { id: productId },
          select: { images: true },
        });
        const images: string[] = Array.isArray(parent?.images)
          ? (parent.images as string[])
          : [];
        if (!images.includes(dto.imageUrl)) {
          await tx.product.update({
            where: { id: productId },
            data: { images: [...images, dto.imageUrl] },
          });
        }
      }

      const attributes: VariantAttribute[] = [];
      // Guard against undefined attributes (schema uses .optional()).
      const entries = Object.entries(dto.attributes ?? {});
      for (const [attrName, attrValue] of entries) {
        const normalized = attrName.toLowerCase();

        const attr = await tx.productAttribute.upsert({
          where: { name: normalized },
          update: {},
          create: { name: normalized },
        });

        await tx.variantAttributeValue.create({
          data: {
            variantId: variantRow.id,
            attributeId: attr.id,
            value: attrValue,
          },
        });

        attributes.push({
          attributeId: attr.id,
          attributeName: attrName,
          value: attrValue,
        });
      }

      return ProductVariantEntity.fromDatabase(variantRow, attributes);
    });
  }

  async updateVariant(
    variantId: string,
    dto: UpdateVariantDto,
  ): Promise<ProductVariantEntity | null> {
    const updateData: Prisma.ProductVariantUpdateInput = {};
    if (dto.sku !== undefined) updateData.sku = dto.sku;
    if (dto.price !== undefined) updateData.price = dto.price;
    if (dto.imageUrl !== undefined) updateData.imageUrl = dto.imageUrl;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    // Whole-attribute replacement strategy. Only fire when:
    //   1. dto.attributes is explicitly provided (not undefined)
    //   2. It's a non-null object
    //   3. It actually has at least one key (guards against empty {}
    //      that might slip through via schema misconfiguration).
    // Without (3), even a default-filled {} would trigger deleteMany
    // and wipe the variant's attribute rows on every partial update.
    const hasAttributes =
      dto.attributes != null &&
      typeof dto.attributes === "object" &&
      Object.keys(dto.attributes as object).length > 0;

    return this.prisma.$transaction(async (tx) => {
      // Read the old imageUrl BEFORE writing — needed for Direction B.
      const oldVariant = await tx.productVariant.findUnique({
        where: { id: variantId },
        select: { imageUrl: true, productId: true },
      });
      if (!oldVariant) return null;

      const row = await tx.productVariant.update({
        where: { id: variantId },
        data: updateData,
      });

      const newImageUrl = dto.imageUrl;
      const oldImageUrl = oldVariant.imageUrl;

      // Direction B — Variant → Gallery:
      // Single-pass compute: read current gallery, determine removals and
      // additions, then persist with ONE update to avoid stale-snapshot bugs
      // (two separate updates would each read the pre-mutation state).
      const isNewImage = dto.imageUrl !== undefined;
      if (isNewImage || oldImageUrl) {
        const parent = await tx.product.findUnique({
          where: { id: row.productId },
          select: { images: true },
        });
        const currentImages: string[] = Array.isArray(parent?.images)
          ? (parent.images as string[])
          : [];

        let finalImages = [...currentImages];
        let changed = false;

        // Remove old image if this variant is switching away from it.
        if (oldImageUrl && isNewImage) {
          // Only remove if no OTHER variant on this product still uses it.
          const inUseCount = await tx.productVariant.count({
            where: {
              productId: row.productId,
              imageUrl: oldImageUrl,
              id: { not: variantId },
            },
          });
          if (inUseCount === 0 && finalImages.includes(oldImageUrl)) {
            finalImages = finalImages.filter((u) => u !== oldImageUrl);
            changed = true;
          }
        }

        // Append new image if not already present.
        if (dto.imageUrl && !finalImages.includes(dto.imageUrl)) {
          finalImages.push(dto.imageUrl);
          changed = true;
        }

        // Persist exactly one update when the gallery actually changed.
        if (changed) {
          await tx.product.update({
            where: { id: row.productId },
            data: { images: finalImages },
          });
        }
      }

      if (hasAttributes) {
        // Wipe existing rows first so the composite PK
        // (variantId, attributeId) doesn't collide with the new set.
        await tx.variantAttributeValue.deleteMany({
          where: { variantId },
        });

        for (const [attrName, attrValue] of Object.entries(
          dto.attributes as Record<string, string>,
        )) {
          const normalized = attrName.toLowerCase();
          // Empty attribute keys are skipped — Zod already enforces
          // non-empty keys, but defensive guardrail if the frontend
          // ever ships a stray entry.
          if (!normalized) continue;

          const attr = await tx.productAttribute.upsert({
            where: { name: normalized },
            update: {},
            create: { name: normalized },
          });

          await tx.variantAttributeValue.create({
            data: {
              variantId: row.id,
              attributeId: attr.id,
              value: attrValue,
            },
          });
        }
      }

      // Re-read the freshly-synced attributes so the returned entity
      // matches what's in the database (single source of truth).
      const attrRows = await tx.variantAttributeValue.findMany({
        where: { variantId: row.id },
        include: { attribute: true },
      });

      const attributes: VariantAttribute[] = attrRows.map((r) => ({
        attributeId: r.attributeId,
        attributeName: r.attribute.name,
        value: r.value,
      }));

      return ProductVariantEntity.fromDatabase(row, attributes);
    });
  }

  async deleteVariant(variantId: string): Promise<boolean> {
    try {
      await this.prisma.productVariant.delete({ where: { id: variantId } });
      return true;
    } catch {
      return false;
    }
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const found = await this.prisma.product.findFirst({
      where: {
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
        deletedAt: null,
      },
      select: { id: true },
    });
    return !!found;
  }

  async skuExists(sku: string, excludeVariantId?: string): Promise<boolean> {
    const found = await this.prisma.productVariant.findFirst({
      where: {
        sku,
        ...(excludeVariantId ? { NOT: { id: excludeVariantId } } : {}),
      },
      select: { id: true },
    });
    return !!found;
  }

  async countVariants(productId: string): Promise<number> {
    return this.prisma.productVariant.count({ where: { productId } });
  }

  // Find seller_id from variant_id (Helper for Inventory/Cart)
  async getSellerIdByVariantId(variantId: string): Promise<string | null> {
    const row = await this.prisma.productVariant.findFirst({
      where: { id: variantId, product: { deletedAt: null } },
      select: { product: { select: { sellerId: true } } },
    });
    return row?.product.sellerId ?? null;
  }

  /**
   * Loads ALL variants (active and inactive) for a product, along with their
   * attribute join rows and computed `available` stock.
   *
   * Previously used a raw SQL query with `WHERE is_active = true`, which
   * caused deactivated variants to silently disappear from findById —
   * breaking the product detail page and any UI that needs to render all
   * variants regardless of their active state.
   *
   * This version uses Prisma's include to fetch every variant row with its
   * attribute values and inventory in one query, avoiding the N+1 problem.
   */
  private async loadVariantsWithAttributes(
    productId: string,
  ): Promise<ProductVariantEntity[]> {
    const variantRows = await this.prisma.productVariant.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
      include: {
        // Include attribute join rows + attribute lookup in one query.
        attributeValues: {
          include: { attribute: true },
        },
        // Include inventory for the `available` computed column.
        inventory: true,
      },
    });

    return variantRows.map((row) => {
      const attributes: VariantAttribute[] = row.attributeValues.map((av) => ({
        attributeId: av.attributeId,
        attributeName: av.attribute.name,
        value: av.value,
      }));

      // `available` is `quantity - reserved`, floored at 0. We must
      // compute it here (not in the entity) because the entity receives a
      // plain row with no knowledge of the joined inventory.
      const inventory = row.inventory;
      const available =
        inventory != null
          ? Math.max(0, inventory.quantity - inventory.reserved)
          : undefined;

      return ProductVariantEntity.fromDatabase(
        {
          ...row,
          available,
        } as import("./product-variant.entity").ProductVariantRowWithStock,
        attributes,
      );
    });
  }
}
