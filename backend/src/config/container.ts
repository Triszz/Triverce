import { createContainer, asClass, asValue, InjectionMode } from "awilix";
import { ILogger } from "../core/interfaces/ILogger";
import { ConsoleLogger } from "../infrastructure/logger/ConsoleLogger";
import { db } from "../infrastructure/database/db.client";
import { UserRepository } from "../modules/user/user.repository";
import { Kysely } from "kysely";
import { DatabaseSchema } from "../infrastructure/database/db.schema";

// Định nghĩa interface cho container
export interface ICradle {
  logger: ILogger;
  db: Kysely<DatabaseSchema>;
  userRepository: UserRepository;
}

const container = createContainer<ICradle>({
  injectionMode: InjectionMode.CLASSIC,
});

container.register({
  logger: asClass(ConsoleLogger).singleton(),
  db: asValue(db),
  userRepository: asClass(UserRepository).singleton(),
});

export { container };
