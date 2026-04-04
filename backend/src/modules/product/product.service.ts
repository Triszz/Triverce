import { ProductEntity } from "./product.entity";
import { ProductRepository } from "./product.repository";
import { ProductVariantEntity } from "./product-variant.entity";
import {
  CreateProductDto,
  UpdateProductDto,
  AddVariantDto,
  UpdateVariantDto,
  ProductQuery,
} from "./product.dto";
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
} from "../../core/errors/AppError";

export class ProductService {
  constructor(private productRepository: ProductRepository) {}

  // Get products (filter)
  async getAll(
    query: ProductQuery,
  ): Promise<{ data: ProductEntity[]; total: number }> {
    return this.productRepository.findAll(query);
  }

  // Get product by id
  async getById(id: string): Promise<ProductEntity> {
    const product = await this.productRepository.findById(id);
    if (!product) throw new NotFoundError(`Product with id "${id}" not found`);
    return product;
  }

  // Get product by slug
  async getBySlug(slug: string): Promise<ProductEntity> {
    const product = await this.productRepository.findBySlug(slug);
    if (!product)
      throw new NotFoundError(`Product with slug "${slug}" not found`);
    return product;
  }

  // Create product
  async create(
    dto: CreateProductDto,
    sellerId: string,
  ): Promise<ProductEntity> {
    // Check duplicate slug
    const slugTaken = await this.productRepository.slugExists(dto.slug);
    if (slugTaken) throw new ConflictError(`Slug "${dto.slug}" already exists`);

    // Check duplicate SKU in variants list
    const skus = dto.variants.map((v) => v.sku);
    const uniqueSkus = new Set(skus);
    if (uniqueSkus.size !== skus.length)
      throw new BadRequestError(`Duplicate SKU found in variants list`);

    // Check duplicate SKU in entire DB
    for (const sku of skus) {
      const exists = await this.productRepository.skuExists(sku);
      if (exists) throw new ConflictError(`SKU "${sku}" already exists`);
    }

    return this.productRepository.create(dto, sellerId);
  }

  // Update product
  async update(
    id: string,
    dto: UpdateProductDto,
    user: { userId: string; role: string },
  ): Promise<ProductEntity> {
    const product = await this.productRepository.findById(id);
    if (!product) throw new NotFoundError(`Product with id "${id}" not found`);

    this.verifyOwnership(product, user);

    if (dto.slug) {
      const slugTaken = await this.productRepository.slugExists(dto.slug, id);
      if (slugTaken)
        throw new ConflictError(`Slug "${dto.slug}" already exists`);
    }

    const updated = await this.productRepository.update(id, {
      categoryId: dto.categoryId,
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      basePrice: dto.basePrice,
      isActive: dto.isActive,
    });

    return updated!;
  }

  // Delete product
  async delete(
    id: string,
    user: { userId: string; role: string },
  ): Promise<void> {
    const existing = await this.productRepository.findById(id);
    if (!existing) throw new NotFoundError(`Product with id "${id}" not found`);

    this.verifyOwnership(existing, user);

    await this.productRepository.delete(id);
  }

  // Add variant
  async addVariant(
    productId: string,
    dto: AddVariantDto,
    user: { userId: string; role: string },
  ): Promise<ProductVariantEntity> {
    const product = await this.productRepository.findById(productId);
    if (!product)
      throw new NotFoundError(`Product with id "${productId}" not found`);

    this.verifyOwnership(product, user);

    const skuExists = await this.productRepository.skuExists(dto.sku);
    if (skuExists) throw new ConflictError(`SKU "${dto.sku}" already exists`);

    return this.productRepository.addVariant(productId, dto);
  }

  // Update variant
  async updateVariant(
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
    user: { userId: string; role: string },
  ): Promise<ProductVariantEntity> {
    const product = await this.productRepository.findById(productId);
    if (!product)
      throw new NotFoundError(`Product with id "${productId}" not found`);

    this.verifyOwnership(product, user);

    // Check variant belongs to product
    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) {
      throw new NotFoundError(
        `Variant with id "${variantId}" not found in product with id "${productId}"`,
      );
    }

    if (dto.sku) {
      const skuExists = await this.productRepository.skuExists(
        dto.sku,
        variantId,
      );
      if (skuExists) throw new ConflictError(`SKU "${dto.sku}" already exists`);
    }

    const updated = await this.productRepository.updateVariant(variantId, dto);
    return updated!;
  }

  // Delete variant
  async deleteVariant(
    productId: string,
    variantId: string,
    user: { userId: string; role: string },
  ): Promise<void> {
    const product = await this.productRepository.findById(productId);
    if (!product)
      throw new NotFoundError(`Product with id "${productId}" not found`);

    this.verifyOwnership(product, user);

    // Not allow to delete the last variant
    const variantCount = await this.productRepository.countVariants(productId);
    if (variantCount <= 1) {
      throw new BadRequestError(
        "Cannot delete the last variant. A product must have at least one variant.",
      );
    }

    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) {
      throw new NotFoundError(
        `Variant "${variantId}" not found in product "${productId}"`,
      );
    }

    await this.productRepository.deleteVariant(variantId);
  }

  // Helpers
  private verifyOwnership(
    product: ProductEntity,
    user: { userId: string; role: string },
  ) {
    if (user.role === "admin") return;

    if (product.sellerId !== user.userId) {
      throw new ForbiddenError(
        "You do not have permission to modify this product",
      );
    }
  }
}
