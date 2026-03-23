import { createContainer, asClass, asValue, InjectionMode } from "awilix";
import { ILogger } from "../core/interfaces/ILogger";
import { ConsoleLogger } from "../infrastructure/logger/ConsoleLogger";
import { db } from "../infrastructure/database/db.client";

// Định nghĩa interface cho container
export interface ICradle {
  logger: ILogger;
}

const container = createContainer<ICradle>({
  injectionMode: InjectionMode.CLASSIC,
});

container.register({
  logger: asClass(ConsoleLogger).singleton(),
  db: asValue(db),
});

export { container };
