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
import { ProductRepository } from "../modules/product/product.repository";

// Định nghĩa interface cho container
export interface ICradle {
  logger: ILogger;
  db: Kysely<DatabaseSchema>;
  userRepository: UserRepository;
  authService: AuthService;
  authController: AuthController;
  categoryRepository: CategoryRepository;
  productRepository: ProductRepository;
}

const container = createContainer<ICradle>({
  injectionMode: InjectionMode.CLASSIC,
});

container.register({
  logger: asClass(ConsoleLogger).singleton(),
  db: asValue(db),
  userRepository: asClass(UserRepository).scoped(),
  authService: asClass(AuthService).scoped(),
  authController: asClass(AuthController).scoped(),
  categoryRepository: asClass(CategoryRepository).scoped(),
  productRepository: asClass(ProductRepository).scoped(),
});

export { container };
