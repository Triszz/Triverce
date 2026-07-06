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

    return {
      data: rows.map((row) => ProductEntity.fromDatabase(row)),
      total,
    };
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
        for (const [attrName, attrValue] of Object.entries(variantDto.attributes)) {
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

    try {
      const row = await this.prisma.product.update({ where: { id }, data: updateData });
      const variants = await this.loadVariantsWithAttributes(id);
      return ProductEntity.fromDatabase(row, variants);
    } catch {
      return null;
    }
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

      const attributes: VariantAttribute[] = [];
      for (const [attrName, attrValue] of Object.entries(dto.attributes)) {
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

    try {
      const row = await this.prisma.productVariant.update({
        where: { id: variantId },
        data: updateData,
      });

      // Load attributes after update
      const attrRows = await this.prisma.variantAttributeValue.findMany({
        where: { variantId },
        include: { attribute: true },
      });

      const attributes: VariantAttribute[] = attrRows.map((r) => ({
        attributeId: r.attributeId,
        attributeName: r.attribute.name,
        value: r.value,
      }));

      return ProductVariantEntity.fromDatabase(row, attributes);
    } catch {
      return null;
    }
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
   * Loads variants + their attributes + computed `available` stock for a product.
   *
   * The `available = quantity - reserved` expression is computed via raw SQL
   * since Prisma's generated types can't subtract two columns natively.
   */
  private async loadVariantsWithAttributes(
    productId: string,
  ): Promise<ProductVariantEntity[]> {
    const variantRows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        productId: string;
        sku: string;
        price: import("@prisma/client").Prisma.Decimal;
        imageUrl: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        available: number | null;
      }>
    >`
      SELECT
        pv.id,
        pv.product_id AS "productId",
        pv.sku,
        pv.price,
        pv.image_url AS "imageUrl",
        pv.is_active AS "isActive",
        pv.created_at AS "createdAt",
        pv.updated_at AS "updatedAt",
        (inv.quantity - inv.reserved) AS available
      FROM product_variants pv
      LEFT JOIN inventory inv ON inv.variant_id = pv.id
      WHERE pv.product_id = ${productId}::uuid
        AND pv.is_active = true
      ORDER BY pv.created_at ASC
    `;

    if (variantRows.length === 0) return [];

    const variantIds = variantRows.map((v) => v.id);

    const attrRows = await this.prisma.variantAttributeValue.findMany({
      where: { variantId: { in: variantIds } },
      include: { attribute: true },
    });

    const attrsByVariantId = new Map<string, VariantAttribute[]>();
    for (const attr of attrRows) {
      const list = attrsByVariantId.get(attr.variantId) ?? [];
      list.push({
        attributeId: attr.attributeId,
        attributeName: attr.attribute.name,
        value: attr.value,
      });
      attrsByVariantId.set(attr.variantId, list);
    }

    return variantRows.map((row) =>
      ProductVariantEntity.fromDatabase(
        // Cast through `unknown` because the raw-SQL row is structurally
        // identical to Prisma's ProductVariant but TS can't infer that.
        row as unknown as import("./product-variant.entity").ProductVariantRowWithStock,
        attrsByVariantId.get(row.id) ?? [],
      ),
    );
  }
}
