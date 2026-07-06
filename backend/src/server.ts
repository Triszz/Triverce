import app from "./app";
import dotenv from "dotenv";
import { container } from "./config/container";
import { prisma } from "./config/prisma";

dotenv.config();

const PORT = process.env.PORT || 3000;

const logger = container.resolve("logger");

app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
});

// Smoke-test the database connection at startup using the Prisma singleton.
// We intentionally run an inexpensive aggregate; replace with a real warmup
// query if your pooler benefits from one.
prisma.user
  .count()
  .then((count) =>
    logger.info(`Database connected successfully! (users: ${count})`),
  )
  .catch((err: Error) =>
    logger.error(`Database connection failed: ${err.message}`),
  );
