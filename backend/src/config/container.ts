import { createContainer, asClass, asValue, InjectionMode } from "awilix";
import { ILogger } from "../core/interfaces/ILogger";
import { ConsoleLogger } from "../infrastructure/logger/ConsoleLogger";
import { db } from "../infrastructure/database/db.client";
import { UserRepository } from "../modules/user/user.repository";
import { Kysely } from "kysely";
import { DatabaseSchema } from "../infrastructure/database/db.schema";
import { AuthService } from "../modules/auth/auth.service";
import { AuthController } from "../modules/auth/auth.controller";
import { CategoryRepository } from "../modules/category/category.repository";
import { CategoryService } from "../modules/category/category.service";
import { CategoryController } from "../modules/category/category.controller";
import { ProductRepository } from "../modules/product/product.repository";
import { ProductService } from "../modules/product/product.service";
import { ProductController } from "../modules/product/product.controller";

// Định nghĩa interface cho container
export interface ICradle {
  logger: ILogger;
  db: Kysely<DatabaseSchema>;
  userRepository: UserRepository;
  authService: AuthService;
  authController: AuthController;
  categoryRepository: CategoryRepository;
  categoryService: CategoryService;
  categoryController: CategoryController;
  productRepository: ProductRepository;
  productService: ProductService;
  productController: ProductController;
}

const container = createContainer<ICradle>({
  injectionMode: InjectionMode.CLASSIC,
});

container.register({
  logger: asClass(ConsoleLogger).singleton(),
  db: asValue(db),
  // User
  userRepository: asClass(UserRepository).scoped(),
  //Auth
  authService: asClass(AuthService).scoped(),
  authController: asClass(AuthController).scoped(),
  // Category
  categoryRepository: asClass(CategoryRepository).scoped(),
  categoryService: asClass(CategoryService).scoped(),
  categoryController: asClass(CategoryController).scoped(),
  // Product
  productRepository: asClass(ProductRepository).scoped(),
  productService: asClass(ProductService).scoped(),
  productController: asClass(ProductController).scoped(),
});

export { container };
