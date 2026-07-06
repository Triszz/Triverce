import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Singleton Prisma Client (Prisma 7+).
 *
 * Why a singleton?
 * - Each PrismaClient opens its own connection pool. Multiple instances
 *   per Node process would leak connections and exhaust Supabase's pooler.
 * - In dev with `tsx watch`, modules get re-evaluated on every save.
 *   We cache on `globalThis` so the HMR re-evaluation reuses the same
 *   client instead of spawning a new pool each time.
 *
 * Prisma 7 architecture note:
 * - Plain `new PrismaClient()` is no longer valid. You must either pass an
 *   `adapter` (driver adapter, e.g. pg / neon / planetscale) or an
 *   `accelerateUrl`. We're using the official pg adapter so we can keep
 *   Supabase pooler (PgBouncer) connections working.
 */

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function buildClient(): PrismaClient {
  // App runtime uses the pooled (PgBouncer-compatible) URL — port 6543,
  // and includes ?pgbouncer=true so the driver disables prepared statements
  // and session features that the transaction-mode pooler can't serve.
  const url =
    process.env.DATABASE_URL ??
    process.env.DIRECT_URL ??
    "";

  const adapter = new PrismaPg({ connectionString: url });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });
}

export const prisma: PrismaClient =
  globalThis.__prisma ?? buildClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

// Graceful shutdown — release pool back to Supabase on Ctrl+C / SIGTERM.
const shutdown = async (signal: string) => {
  console.log(`[prisma] Received ${signal}, disconnecting…`);
  await prisma.$disconnect();
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
