/**
 * prisma/seed.ts — Supabase seeding script for the Ecommerce-Project.
 *
 * Goals:
 *   • Idempotent — safely runnable any number of times.
 *   • Realistic — produces data the frontend (Step 6+) can render against.
 *   • Stripe-clean — wipes in FK-dependent order so no constraint errors.
 *   • Preserves real data — webhook_events are NOT cleared.
 *
 * What it creates:
 *   • 3 users (admin, customer, seller) — password "password123" hashed with bcryptjs.
 *   • 3 categories  — Electronics, Clothing, Accessories.
 *   • 6 products    — distributed across categories, each with 1–3 variants.
 *   • product_attributes "Color" + "Size" + "Storage" with corresponding
 *     variant_attribute_values per variant.
 *   • Inventory rows for every variant.
 *
 * Run with: `npm run db:seed` (which executes `tsx prisma/seed.ts`)
 */

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Build a Prisma client using the same driver-adapter setup as the runtime
// so the seed can talk to the Supabase pooler (port 6543, pgbouncer-aware).
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? "",
  }),
  log: ["warn", "error"],
});

const PASSWORD_PLAINTEXT = "password123";

/* ──────────────────────────────────────────────────────────────────────────
 * Wipe — strictly FK-dependent order
 * ──────────────────────────────────────────────────────────────────────── */

async function clearAll(): Promise<void> {
  // OrderItem has Restrict on variant; CartItem / OrderStatusLog cascade via
  // parent records, but truncate in the right order to be defensive.
  await prisma.orderItem.deleteMany({});
  await prisma.orderStatusLog.deleteMany({});
  // Disconnect payments from orders before deleting orders (orders FK is Restrict-on-User,
  // payment is SetNull on order, but explicit delete avoids surprises).
  await prisma.order.updateMany({ data: { paymentId: null } });
  await prisma.order.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.cartItem.deleteMany({});
  await prisma.cart.deleteMany({});
  await prisma.inventory.deleteMany({});
  await prisma.variantAttributeValue.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});
  // Categories have a self-referencing Restrict parent link — wipe children first.
  await prisma.category.deleteMany({});
  await prisma.productAttribute.deleteMany({});
  await prisma.user.deleteMany({});
}

/* ──────────────────────────────────────────────────────────────────────────
 * Seed helpers
 * ──────────────────────────────────────────────────────────────────────── */

async function hashPassword(plain: string): Promise<string> {
  // 10 rounds is the codebase default; sufficient for seed/dev data.
  return bcrypt.hash(plain, 10);
}

async function createUsers() {
  const passwordHash = await hashPassword(PASSWORD_PLAINTEXT);
  return Promise.all([
    prisma.user.create({
      data: {
        email: "admin@triverce.com",
        passwordHash,
        fullName: "Triverce Admin",
        role: UserRole.admin,
      },
    }),
    prisma.user.create({
      data: {
        email: "customer@triverce.com",
        passwordHash,
        fullName: "Triverce Customer",
        role: UserRole.customer,
      },
    }),
    prisma.user.create({
      data: {
        email: "seller@triverce.com",
        passwordHash,
        fullName: "Triverce Seller",
        role: UserRole.seller,
      },
    }),
  ]);
}

async function createAttributes() {
  return Promise.all([
    prisma.productAttribute.create({ data: { name: "Color" } }),
    prisma.productAttribute.create({ data: { name: "Size" } }),
    prisma.productAttribute.create({ data: { name: "Storage" } }),
  ]);
}

async function createCategories() {
  const cats = await Promise.all([
    prisma.category.create({
      data: {
        name: "Electronics",
        slug: "electronics",
        description: "Phones, laptops, audio gear and other modern gadgets.",
        sortOrder: 1,
      },
    }),
    prisma.category.create({
      data: {
        name: "Clothing",
        slug: "clothing",
        description: "Everyday apparel, activewear and seasonal essentials.",
        sortOrder: 2,
      },
    }),
    prisma.category.create({
      data: {
        name: "Accessories",
        slug: "accessories",
        description: "Bags, watches and finishing touches for any look.",
        sortOrder: 3,
      },
    }),
  ]);
  return Object.fromEntries(cats.map((c) => [c.slug, c]));
}

/* Unsplash photo IDs chosen for premium product-card rendering.
 * The query string crops the image to 800×800 and trims weight.
 */
const IMG = (id: string) =>
  `https://images.unsplash.com/${id}?w=800&h=800&fit=crop&auto=format&q=70`;

interface VariantSpec {
  sku: string;
  price: number;
  imageUrl: string;
  stock: number;
  attributes: Array<{ name: "Color" | "Size" | "Storage"; value: string }>;
}

interface ProductSpec {
  slug: string;
  name: string;
  description: string;
  basePrice: number;
  categorySlug: keyof Awaited<ReturnType<typeof createCategories>>;
  variants: VariantSpec[];
}

const PRODUCTS: ProductSpec[] = [
  {
    slug: "sonic-pro-wireless-headphones",
    name: "Sonic Pro Wireless Headphones",
    description:
      "Active-noise-cancelling over-ear headphones with 40-hour battery life, hi-res audio support and ultra-plush memory-foam earcups.",
    basePrice: 4_290_000,
    categorySlug: "electronics",
    variants: [
      {
        sku: "SONIC-PRO-BLK",
        price: 4_290_000,
        imageUrl: IMG("photo-1505740420928-5e560c06d30e"),
        stock: 35,
        attributes: [{ name: "Color", value: "Matte Black" }],
      },
      {
        sku: "SONIC-PRO-WHT",
        price: 4_290_000,
        imageUrl: IMG("photo-1583394838336-acd977736f90"),
        stock: 20,
        attributes: [{ name: "Color", value: "Pearl White" }],
      },
      {
        sku: "SONIC-PRO-NVY",
        price: 4_490_000,
        imageUrl: IMG("photo-1546435770-a3e426bf472b"),
        stock: 12,
        attributes: [{ name: "Color", value: "Midnight Navy" }],
      },
    ],
  },
  {
    slug: "smartwatch-series-x",
    name: "SmartWatch Series X",
    description:
      "A flagship smartwatch with always-on AMOLED, GPS, ECG, blood-oxygen tracking and 7-day battery life in a titanium chassis.",
    basePrice: 12_990_000,
    categorySlug: "electronics",
    variants: [
      {
        sku: "SW-X-41-BLK",
        price: 12_990_000,
        imageUrl: IMG("photo-1523275335684-37898b6baf30"),
        stock: 18,
        attributes: [
          { name: "Color", value: "Graphite" },
          { name: "Size", value: "41mm" },
        ],
      },
      {
        sku: "SW-X-45-BLK",
        price: 13_490_000,
        imageUrl: IMG("photo-1546868871-7041f6a1d2ed"),
        stock: 15,
        attributes: [
          { name: "Color", value: "Graphite" },
          { name: "Size", value: "45mm" },
        ],
      },
      {
        sku: "SW-X-45-SLV",
        price: 14_990_000,
        imageUrl: IMG("photo-1551816230-ef5deaed4a26"),
        stock: 8,
        attributes: [
          { name: "Color", value: "Silver Titanium" },
          { name: "Size", value: "45mm" },
        ],
      },
    ],
  },
  {
    slug: "ultrabook-14-pro",
    name: "Ultrabook 14 Pro",
    description:
      "Featherlight 14-inch ultrabook with 2.8K OLED, M-series silicon, 32 GB unified memory and all-day battery in a 1.1 kg chassis.",
    basePrice: 28_990_000,
    categorySlug: "electronics",
    variants: [
      {
        sku: "UB14-512",
        price: 28_990_000,
        imageUrl: IMG("photo-1496181133206-80ce9b88a853"),
        stock: 10,
        attributes: [{ name: "Storage", value: "512GB" }],
      },
      {
        sku: "UB14-1TB",
        price: 34_990_000,
        imageUrl: IMG("photo-1517336714731-489689fd1ca8"),
        stock: 6,
        attributes: [{ name: "Storage", value: "1TB" }],
      },
    ],
  },
  {
    slug: "essential-tee-crew-neck",
    name: "Essential Crew-Neck Tee",
    description:
      "Heavyweight 240 gsm pima-cotton tee with a tailored crew neckline, pre-shrunk for a true-to-size fit that softens with every wash.",
    basePrice: 490_000,
    categorySlug: "clothing",
    variants: [
      {
        sku: "TEE-CREW-BLK-S",
        price: 490_000,
        imageUrl: IMG("photo-1521572163474-6864f9cf17ab"),
        stock: 80,
        attributes: [
          { name: "Color", value: "Black" },
          { name: "Size", value: "S" },
        ],
      },
      {
        sku: "TEE-CREW-BLK-M",
        price: 490_000,
        imageUrl: IMG("photo-1583743814966-8936f5b7be1a"),
        stock: 120,
        attributes: [
          { name: "Color", value: "Black" },
          { name: "Size", value: "M" },
        ],
      },
      {
        sku: "TEE-CREW-WHT-L",
        price: 490_000,
        imageUrl: IMG("photo-1620799140408-edc6dcb6d633"),
        stock: 60,
        attributes: [
          { name: "Color", value: "White" },
          { name: "Size", value: "L" },
        ],
      },
    ],
  },
  {
    slug: "field-jacket-canvas",
    name: "Field Canvas Jacket",
    description:
      "Waxed-canvas field jacket with quilted lining, four utility pockets and a corduroy collar — built for cold mornings and crisp evenings.",
    basePrice: 2_190_000,
    categorySlug: "clothing",
    variants: [
      {
        sku: "JCKT-FIELD-OLV",
        price: 2_190_000,
        imageUrl: IMG("photo-1551028719-00167b16eac5"),
        stock: 25,
        attributes: [
          { name: "Color", value: "Olive" },
          { name: "Size", value: "M" },
        ],
      },
      {
        sku: "JCKT-FIELD-TAN",
        price: 2_190_000,
        imageUrl: IMG("photo-1591047139829-d91aecb6caea"),
        stock: 18,
        attributes: [
          { name: "Color", value: "Sand" },
          { name: "Size", value: "M" },
        ],
      },
    ],
  },
  {
    slug: "heritage-leather-tote",
    name: "Heritage Leather Tote",
    description:
      "Hand-stitched full-grain leather tote with brass hardware, suede-lined interior and a magnetic closure — built to age with character.",
    basePrice: 3_490_000,
    categorySlug: "accessories",
    variants: [
      {
        sku: "TOTE-TAN",
        price: 3_490_000,
        imageUrl: IMG("photo-1591561954557-26941169b49e"),
        stock: 14,
        attributes: [{ name: "Color", value: "Cognac" }],
      },
      {
        sku: "TOTE-BLK",
        price: 3_490_000,
        imageUrl: IMG("photo-1548036328-c9fa89d128fa"),
        stock: 9,
        attributes: [{ name: "Color", value: "Onyx" }],
      },
    ],
  },
];

/* ──────────────────────────────────────────────────────────────────────────
 * Main
 * ──────────────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  console.log("🌱 Seeding Triverce database…");

  console.log("  • Wiping existing data");
  await clearAll();

  console.log("  • Creating users");
  const [, , seller] = await createUsers();

  console.log("  • Creating attributes");
  const [attrColor, attrSize, attrStorage] = await createAttributes();
  const attrByName = {
    Color: attrColor,
    Size: attrSize,
    Storage: attrStorage,
  } as const;

  console.log("  • Creating categories");
  const categories = await createCategories();

  console.log(`  • Creating ${PRODUCTS.length} products with variants + inventory`);
  for (const spec of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        slug: spec.slug,
        name: spec.name,
        description: spec.description,
        basePrice: spec.basePrice,
        categoryId: categories[spec.categorySlug].id,
        sellerId: seller.id,
      },
    });

    for (const v of spec.variants) {
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: v.sku,
          price: v.price,
          imageUrl: v.imageUrl,
        },
      });

      // Inventory (1:1 with product_variants).
      await prisma.inventory.create({
        data: { variantId: variant.id, quantity: v.stock, reserved: 0 },
      });

      // Attribute values — composite PK by (variantId, attributeId).
      await prisma.variantAttributeValue.createMany({
        data: v.attributes.map((a) => ({
          variantId: variant.id,
          attributeId: attrByName[a.name].id,
          value: a.value,
        })),
      });
    }
  }

  console.log("✅ Seed complete.");
  console.log("   Login with:");
  console.log("     admin@triverce.com / password123   (role: admin)");
  console.log("     customer@triverce.com / password123 (role: customer)");
  console.log("     seller@triverce.com / password123   (role: seller)");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
