import { Kysely } from "kysely";
import {
  DatabaseSchema,
  ProductRow,
  ProductVariantRow,
} from "../../infrastructure/database/db.schema";
import { ProductEntity } from "./product.entity";
import {
  ProductVariantEntity,
  VariantAttribute,
} from "./product-variant.entity";
import {
  CreateProductDto,
  ProductQuery,
  AddVariantDto,
  UpdateVariantDto,
} from "./product.dto";

export class ProductRepository {
  constructor(private db: Kysely<DatabaseSchema>) {}

  // Find products
  async findAll(
    query: ProductQuery,
  ): Promise<{ data: ProductEntity[]; total: number }> {
    let baseQuery = this.db.selectFrom("products");

    if (query.categoryId) {
      baseQuery = baseQuery.where(
        "category_id",
        "=",
        query.categoryId,
      ) as typeof baseQuery;
    }

    if (query.isActive !== undefined) {
      baseQuery = baseQuery.where(
        "is_active",
        "=",
        query.isActive,
      ) as typeof baseQuery;
    }

    if (query.search) {
      baseQuery = baseQuery.where(
        "name",
        "ilike",
        `%${query.search}`,
      ) as typeof baseQuery;
    }

    if (query.minPrice !== undefined) {
      baseQuery = baseQuery.where(
        "base_price",
        ">=",
        query.minPrice,
      ) as typeof baseQuery;
    }

    if (query.maxPrice !== undefined) {
      baseQuery = baseQuery.where(
        "base_price",
        "<=",
        query.maxPrice,
      ) as typeof baseQuery;
    }

    // Total count
    const { count } = await baseQuery
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .executeTakeFirstOrThrow();

    // Sort
    const sortMap = {
      price_asc: ["base_price", "asc"],
      price_desc: ["base_price", "desc"],
      name_asc: ["name", "asc"],
      name_desc: ["name", "desc"],
      created_desc: ["created_at", "desc"],
    } as const;

    const [sortCol, sortDir] = sortMap[query.sortBy];

    const rows = (await baseQuery
      .selectAll()
      .orderBy(sortCol, sortDir)
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)
      .execute()) as ProductRow[];

    // List page
    return {
      data: rows.map((row) => ProductEntity.fromDatabase(row)),
      total: Number(count),
    };
  }
  private async loadVariantsWithAttributes(
    productId: string,
  ): Promise<ProductVariantEntity[]> {
    // Query 1: Select variants
    const variantRows = (await this.db
      .selectFrom("product_variants")
      .selectAll()
      .where("product_id", "=", productId)
      .orderBy("created_at", "asc")
      .execute()) as ProductVariantRow[];

    if (variantRows.length === 0) return [];

    const variantIds = variantRows.map((v) => v.id);

    // Query 2: Select all attributes of variants
    const attrRows = await this.db
      .selectFrom("variant_attribute_values")
      .innerJoin(
        "product_attributes",
        "product_attributes.id",
        "variant_attribute_values.attribute_id",
      )
      .select([
        "variant_attribute_values.variant_id",
        "variant_attribute_values.attribute_id",
        "variant_attribute_values.value",
        "product_attributes.name as attribute_name",
      ])
      .where("variant_attribute_values.variant_id", "in", variantIds)
      .execute();

    // Group rows based on variant_id because JOIN create some rows for 1 variant
    const attrsByVariantId = new Map<string, VariantAttribute[]>();
    for (const attr of attrRows) {
      if (!attrsByVariantId.has(attr.variant_id)) {
        attrsByVariantId.set(attr.variant_id, []);
      }
      attrsByVariantId.get(attr.variant_id)!.push({
        attributeId: attr.attribute_id,
        attributeName: attr.attribute_name,
        value: attr.value,
      });
    }

    // Map to ProductVariantEntity
    return variantRows.map((row) =>
      ProductVariantEntity.fromDatabase(
        row,
        attrsByVariantId.get(row.id) ?? [],
      ),
    );
  }

  // Find product by id
  async findById(id: string): Promise<ProductEntity | null> {
    const row = (await this.db
      .selectFrom("products")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()) as ProductRow | undefined;

    if (!row) return null;

    const variants = await this.loadVariantsWithAttributes(id);
    return ProductEntity.fromDatabase(row, variants);
  }

  // Find by slug
  async findBySlug(slug: string): Promise<ProductEntity | null> {
    const row = await this.db
      .selectFrom("products")
      .selectAll()
      .where("slug", "=", slug)
      .executeTakeFirst();

    if (!row) return null;

    const variants = await this.loadVariantsWithAttributes(row.id);
    return ProductEntity.fromDatabase(row, variants);
  }

  // Create product
  async create(dto: CreateProductDto): Promise<ProductEntity> {
    return await this.db.transaction().execute(async (trx) => {
      // 1. Insert product
      const productRow = (await trx
        .insertInto("products")
        .values({
          category_id: dto.categoryId ?? null,
          name: dto.name,
          slug: dto.slug,
          description: dto.description ?? null,
          base_price: dto.basePrice,
          is_active: dto.isActive,
        })
        .returningAll()
        .executeTakeFirstOrThrow()) as ProductRow;

      // 2. Insert each variant
      const variantEntities: ProductVariantEntity[] = [];

      for (const variantDto of dto.variants) {
        // 2a. Insert variant
        const variantRow = (await trx
          .insertInto("product_variants")
          .values({
            product_id: productRow.id,
            sku: variantDto.sku,
            price: variantDto.price,
            image_url: variantDto.imageUrl ?? null,
            is_active: variantDto.isActive,
          })
          .returningAll()
          .executeTakeFirstOrThrow()) as ProductVariantRow;

        // 2b. Insert inventory record for variant
        await trx
          .insertInto("inventory")
          .values({
            variant_id: variantRow.id,
            quantity: 0,
            reserved: 0,
          })
          .execute();

        // 2c. Insert attribute values
        const attributes: VariantAttribute[] = [];

        for (const [attrName, attrValue] of Object.entries(
          variantDto.attributes,
        )) {
          // Find attribute_id from name - Example: "color" -> uuid
          const attrRow = await trx
            .selectFrom("product_attributes")
            .select(["id", "name"])
            .where("name", "=", attrName.toLowerCase())
            .executeTakeFirst();

          // If attribute does not exist, it will be automatically created
          const attributeId =
            attrRow?.id ??
            (
              await trx
                .insertInto("product_attributes")
                .values({ name: attrName.toLowerCase() })
                .returning("id")
                .executeTakeFirstOrThrow()
            ).id;

          await trx
            .insertInto("variant_attribute_values")
            .values({
              variant_id: variantRow.id,
              attribute_id: attributeId,
              value: attrValue,
            })
            .execute();

          attributes.push({
            attributeId,
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

  // Update product
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
    const updateData: Record<string, unknown> = { updated_at: new Date() };

    if (data.categoryId !== undefined) updateData.category_id = data.categoryId;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.basePrice !== undefined) updateData.base_price = data.basePrice;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const row = (await this.db
      .updateTable("products")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()) as ProductRow | undefined;

    if (!row) return null;

    const variants = await this.loadVariantsWithAttributes(id);
    return ProductEntity.fromDatabase(row, variants);
  }

  // Delete product
  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom("products")
      .where("id", "=", id)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }

  // Add variant
  async addVariant(
    productId: string,
    dto: AddVariantDto,
  ): Promise<ProductVariantEntity> {
    return await this.db.transaction().execute(async (trx) => {
      const variantRow = (await trx
        .insertInto("product_variants")
        .values({
          product_id: productId,
          sku: dto.sku,
          price: dto.price,
          image_url: dto.imageUrl ?? null,
          is_active: dto.isActive,
        })
        .returningAll()
        .executeTakeFirstOrThrow()) as ProductVariantRow;

      await trx
        .insertInto("inventory")
        .values({
          variant_id: variantRow.id,
          quantity: 0,
          reserved: 0,
        })
        .execute();

      const attributes: VariantAttribute[] = [];
      for (const [attrName, attrValue] of Object.entries(dto.attributes)) {
        const attrRow = await trx
          .selectFrom("product_attributes")
          .select(["id", "name"])
          .where("name", "=", attrName.toLowerCase())
          .executeTakeFirst();

        const attributeId =
          attrRow?.id ??
          (
            await trx
              .insertInto("product_attributes")
              .values({ name: attrName.toLowerCase() })
              .returning("id")
              .executeTakeFirstOrThrow()
          ).id;

        await trx
          .insertInto("variant_attribute_values")
          .values({
            variant_id: variantRow.id,
            attribute_id: attributeId,
            value: attrValue,
          })
          .execute();

        attributes.push({
          attributeId,
          attributeName: attrName,
          value: attrValue,
        });
      }

      return ProductVariantEntity.fromDatabase(variantRow, attributes);
    });
  }

  // Update variant
  async updateVariant(
    variantId: string,
    dto: UpdateVariantDto,
  ): Promise<ProductVariantEntity | null> {
    const updateData: Record<string, unknown> = { updated_at: new Date() };

    if (dto.sku !== undefined) updateData.sku = dto.sku;
    if (dto.price !== undefined) updateData.price = dto.price;
    if (dto.imageUrl !== undefined) updateData.image_url = dto.imageUrl;
    if (dto.isActive !== undefined) updateData.is_active = dto.isActive;

    const row = (await this.db
      .updateTable("product_variants")
      .set(updateData)
      .where("id", "=", variantId)
      .returningAll()
      .executeTakeFirst()) as ProductVariantRow | undefined;

    if (!row) return null;

    // Load attributes after update
    const attrRow = await this.db
      .selectFrom("variant_attribute_values as vav")
      .innerJoin("product_attributes as pa", "pa.id", "vav.attribute_id")
      .select(["vav.attribute_id", "pa.name as attribute_name", "vav.value"])
      .where("vav.variant_id", "=", variantId)
      .execute();

    const attributes: VariantAttribute[] = attrRow.map((r) => ({
      attributeId: r.attribute_id,
      attributeName: r.attribute_name,
      value: r.value,
    }));

    return ProductVariantEntity.fromDatabase(row, attributes);
  }

  // Delete variant
  async deleteVariant(variantId: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom("product_variants")
      .where("id", "=", variantId)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }

  // Helpers
  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    let query = this.db
      .selectFrom("products")
      .select("id")
      .where("slug", "=", slug);

    if (excludeId) query = query.where("id", "!=", excludeId) as typeof query;

    const row = await query.executeTakeFirst();

    return !!row;
  }

  async skuExists(sku: string, excludeVariantId?: string): Promise<boolean> {
    let query = this.db
      .selectFrom("product_variants")
      .select("id")
      .where("sku", "=", sku);

    if (excludeVariantId)
      query = query.where("id", "!=", excludeVariantId) as typeof query;

    const row = await query.executeTakeFirst();

    return !!row;
  }

  async countVariants(productId: string): Promise<number> {
    const { count } = await this.db
      .selectFrom("product_variants")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("product_id", "=", productId)
      .executeTakeFirstOrThrow();

    return Number(count);
  }
}
