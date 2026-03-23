import app from "./app";
import dotenv from "dotenv";
import { db } from "./infrastructure/database/db.client";
import { container } from "./config/container";

dotenv.config();

const PORT = process.env.PORT || 3000;

const logger = container.resolve("logger");

app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
});

db.selectFrom("users")
  .select("id")
  .limit(1)
  .execute()
  .then(() => console.log("Database connected successfully!"))
  .catch((err) => console.error("Database connection failed:", err.message));
