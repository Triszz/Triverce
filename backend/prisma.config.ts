/// <reference types="node" />
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma CLI (migrate, db push, etc.) — needs a direct, non-pooled connection.
    url: process.env.DIRECT_URL ?? "",
  },
});
