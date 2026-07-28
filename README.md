<div align="center">

# Triverce

### A modern, scalable multi-vendor e-commerce marketplace built for independent sellers and premium buyer experiences.

[![Status](https://img.shields.io/badge/Status-Active%20Development-2ea44f?style=for-the-badge)](#roadmap--future-enhancements)
[![License](https://img.shields.io/badge/License-Private-blueviolet?style=for-the-badge)](#license)

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=20232a)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)

[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-5.20-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Awilix](https://img.shields.io/badge/Awilix-10-DI%2FIoC-blue?style=flat-square)](https://github.com/jeffijoe/awilix)

</div>

---

## 📖 Overview

**Triverce** is a premium multi-vendor marketplace platform that empowers independent sellers to launch their own storefronts while giving buyers a curated, fast, and trustworthy shopping experience. The platform is engineered with a **separation-of-concerns architecture**: a dedicated buyer storefront, a seller dashboard, and a robust REST API backend backed by PostgreSQL.

The codebase reflects a production-grade mindset — strict **TypeScript** everywhere, dependency injection on the server, repository-based persistence, schema-level validation, and a UI built with composable, accessible primitives.

---

## ✨ Key Features

### 🏪 Multi-vendor Architecture
- **Dedicated seller storefronts** — each product links to a seller's public profile (`/store/:sellerId`) with store name, product catalog, and trust signal.
- **Seller-scoped product filtering** — list queries support `sellerId` filters, ensuring each seller sees only their own inventory in the dashboard.
- **Category hierarchy** — products belong to a `Category` (with optional parent/child relationships), enabling nested navigation and a breadcrumb-driven discovery flow.

### 🎛️ Advanced State Management
- **Synchronized variant selector + image gallery** — selecting a color/size variant instantly swaps the hero image, refreshes the stock badge, and updates the price; thumbnail clicks can also re-select a variant.
- **Optimistic UI with commit debouncing** — the quantity stepper keeps a local draft so the UI is instant, while the upstream API only fires after a 400ms debounce or a single click.
- **TanStack Query** for server cache, with query key conventions that mirror the URL (`['product', 'by-slug', slug]`).
- **Zustand stores** for client-only state (auth, UI drawers, cart).

### 🛒 Seamless Checkout Flow
- **Dynamic address book** — users can pick a saved address or enter a new one; address cards are radio-style cards with full Vietnamese localization.
- **VN mobile validation** — Zod schemas enforce Vietnamese phone number validity (`/^(0|\+84)(3|5|7|8|9)\d{8}$/`).
- **Order summary synchronization** — the summary panel recomputes subtotal, shipping, and total reactively as the cart mutates.
- **Auth-guarded cart flow** — unauthenticated users are intercepted *before* the add-to-cart call fails, preventing misleading success toasts.

### 🎨 Optimized UI/UX
- **Dynamic breadcrumbs** — `Home / Shop / Category / Product` with click-through filtering via `?category=...` query params.
- **Graceful image fallbacks** — `pickHeroImage()` walks `images[] → imageUrl → null` so legacy data renders without breaking.
- **Loading skeletons** — `Skeleton`, `SkeletonText` primitives prevent layout shift during fetch.
- **Responsive Tailwind layouts** — mobile-first grids, drawer-based cart/filter panels on small screens.
- **Sonner toasts** for non-blocking user feedback (auth errors, stock warnings, cart success).
- **Accessible primitives** — focus-visible rings, ARIA roles, `aria-busy`, `aria-hidden` on decorative icons.
- **VN-localized payment methods** — MoMo, VNPay, and COD support embedded in the checkout flow.

---

## 🏗️ Technical Architecture

The backend follows a **layered, dependency-injected architecture** — every layer is testable in isolation, and modules can be swapped without rewriting calling code.

### Design Patterns

| Pattern | Purpose | Where it lives |
|---|---|---|
| **Dependency Injection (Awilix)** | Single IoC container resolves & injects every service, repository, and controller at boot. New modules just register themselves. | `backend/src/server.ts`, `backend/src/container.ts` |
| **Repository Pattern** | Every persistence call goes through a `*.repository.ts` class. Controllers and services never touch Prisma directly. | `backend/src/modules/*/[name].repository.ts` |
| **Service Layer** | Each module has a service that holds business logic and orchestrates 1+ repositories. | `backend/src/modules/*/[name].service.ts` |
| **DTO / Schema Validation (Zod)** | Request payloads are validated at the boundary with `z.object(...)` schemas; the parsed result is the contract. | `backend/src/modules/*/[name].dto.ts` |
| **Entity Pattern** | Domain objects wrap DB rows with helper methods (`getMinPrice`, `toPublicDetail`, ...). | `backend/src/modules/*/[name].entity.ts` |
| **JWT + bcrypt auth** | Stateless auth with hashed passwords; auth middleware protects private routes. | `backend/src/modules/auth/` |

### Backend Modules (14)

```
backend/src/modules/
├── auth/           # login, register, JWT issuance
├── user/           # user profile endpoints
├── seller/         # seller profiles, store pages
├── product/        # product CRUD, slug, variants, images
├── category/       # category tree and listings
├── address/        # address book (CRUD + default)
├── cart/           # add/update/remove items
├── order/          # checkout → order → seller order splits
├── inventory/      # stock and reservations
├── review/         # buyer reviews
├── upload/         # file/image uploads
├── wishlist/       # saved products
└── (…)
```

### Why these patterns matter

- **Testability** — repositories can be mocked behind interfaces, so unit tests never hit a real database.
- **Refactorability** — migrating from Prisma to another ORM touches one file per module, not the whole codebase.
- **Consistency** — every module looks the same: `controller → service → repository → entity`. New developers ramp up in hours, not days.

---

## 🗄️ Database Schema

PostgreSQL via Prisma. The schema covers all marketplace concerns: identity, catalog, commerce, and fulfillment.

| Model | Purpose | Key fields |
|---|---|---|
| `User` | Authenticated buyer / seller account | `email`, `passwordHash`, `fullName`, `phone`, `role` |
| `Seller` | Publicly-listed seller profile | `userId`, `storeName`, `slug`, `description`, `isVerified` |
| `Category` | Hierarchical taxonomy | `name`, `slug`, `parentId`, `description`, `sortOrder` |
| `Product` | Top-level catalog entry | `sellerId`, `categoryId`, `name`, `slug`, `basePrice`, `images[]`, `isActive` |
| `ProductVariant` | SKU-level entry (size, color, etc.) | `productId`, `sku`, `price`, `imageUrl`, `isActive` |
| `VariantAttributeValue` | Generic key/value variant attrs | `variantId`, `attributeId`, `value` |
| `ProductAttribute` | Attribute definitions (e.g. "Size") | `name` |
| `Inventory` | Per-variant stock tracking | `variantId`, `quantity`, `reserved` |
| `Address` | User shipping address book | `userId`, `recipient`, `phone`, `line1`, `city`, `isDefault` |
| `Cart` | Persistent cart per user | `userId`, `updatedAt` |
| `CartItem` | Lines in the cart | `cartId`, `variantId`, `quantity` |
| `Order` | Order header | `userId`, `addressId`, `total`, `status`, `paymentMethod` |
| `OrderItem` | One line per variant | `orderId`, `variantId`, `quantity`, `price`, `sellerId` |
| `Payment` | Payment record | `orderId`, `method`, `status`, `transactionId` |
| `Review` | Buyer reviews on products | `userId`, `productId`, `rating`, `comment` |
| `WishlistItem` | Saved products | `userId`, `productId` |
| `ImageUpload` | Upload registry | `userId`, `url`, `purpose` |

> **Soft deletes** — Products stamp `deletedAt` and slug-suffix-renames on delete so the URL can be reused safely.

---

## ⚙️ Getting Started

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 18+ (LTS recommended) |
| PostgreSQL | 14+ |
| npm | 9+ |

### 1. Clone the repository

```bash
git clone https://github.com/your-username/triverce.git
cd triverce
```

### 2. Database setup

Create a PostgreSQL database for the project:

```sql
CREATE DATABASE triverce;
CREATE USER triverce_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE triverce TO triverce_user;
```

### 3. Backend setup

```bash
cd backend
npm install
cp .env.example .env       # then edit DATABASE_URL, JWT_SECRET, etc.
npx prisma generate
npx prisma db push         # create tables
# (optional) seed dev data if a seed script exists
npm run dev                # starts on http://localhost:3000
```

Example `.env`:

```env
DATABASE_URL="postgresql://triverce_user:your_password@localhost:5432/triverce"
JWT_SECRET="change-me-in-production"
JWT_EXPIRES_IN="7d"
PORT=3000
UPLOAD_DIR="./uploads"
```

### 4. Buyer storefront (frontend-buyer)

```bash
cd frontend-buyer
npm install
cp .env.example .env       # set VITE_API_URL=http://localhost:3000/api
npm run dev                # starts on http://localhost:5173
```

### 5. Seller dashboard (frontend-seller)

```bash
cd frontend-seller
npm install
cp .env.example .env       # set VITE_API_URL=http://localhost:3000/api
npm run dev                # starts on http://localhost:5174
```

### 6. Verify the install

Open `http://localhost:5173` and you should see the Triverce homepage. The seller dashboard is at `http://localhost:5174`. The API is at `http://localhost:3000/api`.

---

## 🧰 Tech Stack

### Frontend

| Tool | Why it's used |
|---|---|
| **React 18** | Concurrent rendering, automatic batching, `Suspense` for loading states |
| **TypeScript** | Strict mode across the board — no `any` in production code |
| **Vite** | Sub-second HMR, ESM-native, fastest dev experience |
| **Tailwind CSS** | Utility-first, no naming-convention arguments, design-token friendly |
| **React Router 6** | Data router, nested routes, URL-as-state |
| **TanStack Query** | Server cache, background refetch, query invalidation |
| **Zustand** | Tiny client-only state stores (auth, UI drawers) |
| **React Hook Form + Zod** | Performant forms with runtime validation |
| **Sonner** | Accessible, non-blocking toast notifications |
| **Lucide React** | Tree-shakeable icon set |
| **class-variance-authority** | Type-safe variant API for Button, Badge, Card, etc. |

### Backend

| Tool | Why it's used |
|---|---|
| **Node.js + Express** | Battle-tested, minimal, easy to extend |
| **Awilix** | Dependency injection container — IoC everywhere |
| **Prisma ORM** | Type-safe DB access, declarative migrations, generated types |
| **PostgreSQL** | Strong relational integrity, full-text search, JSON columns |
| **Zod** | Runtime validation at the API boundary |
| **bcrypt** | Password hashing |
| **jsonwebtoken** | Stateless auth via JWT |
| **Multer + custom storage** | File uploads with disk persistence |

---

## 🗂️ Project Structure

```
triverce/
├── backend/                  # Node.js + Express API
│   ├── src/
│   │   ├── server.ts         # Express bootstrap + Awilix container wiring
│   │   ├── container.ts      # DI registrations
│   │   ├── modules/          # Feature modules (auth, product, order, …)
│   │   │   └── [feature]/
│   │   │       ├── [feature].controller.ts
│   │   │       ├── [feature].service.ts
│   │   │       ├── [feature].repository.ts
│   │   │       ├── [feature].entity.ts
│   │   │       └── [feature].dto.ts
│   │   └── shared/           # cross-cutting helpers (errors, middleware)
│   ├── prisma/
│   │   └── schema.prisma
│   └── uploads/              # user-uploaded files
│
├── frontend-buyer/           # B2C storefront (React + Vite)
│   └── src/
│       ├── pages/            # Route-level pages
│       ├── features/         # Feature-driven modules (catalog, cart, checkout, …)
│       │   └── [feature]/
│       │       ├── components/
│       │       ├── hooks/
│       │       └── services/
│       ├── components/       # Shared UI (layout, ui/*, order/*)
│       ├── services/         # API clients (productService, authService, …)
│       ├── stores/           # Zustand state stores
│       └── types/            # Shared TS types
│
└── frontend-seller/          # Seller dashboard (React + Vite)
    └── src/
        └── (… mirrors the buyer app structure)
```

---

## 🚀 Roadmap / Future Enhancements

- [ ] **Payment gateway integration** — wire MoMo / VNPay / Stripe end-to-end with webhook reconciliation.
- [ ] **Admin dashboard** — moderation queue, seller verification, platform-wide analytics.
- [ ] **Advanced analytics** — seller-facing dashboard (conversion rate, GMV, best-sellers).
- [ ] **Docker containerization** — multi-stage `Dockerfile` + `docker-compose.yml` for one-command bootstrap.
- [ ] **Real-time order tracking** — WebSocket-based status push (Pending → Confirmed → Shipped → Delivered).
- [ ] **Search infrastructure** — Postgres full-text search → Meilisearch / Elasticsearch for typo-tolerant catalog search.
- [ ] **Email + SMS notifications** — order confirmations, low-stock alerts, password resets.
- [ ] **CI/CD pipeline** — GitHub Actions: lint → type-check → test → deploy.
- [ ] **Internationalization (i18n)** — Vietnamese (default) + English with `react-intl`.
- [ ] **Test suite** — Vitest for unit tests, Playwright for E2E.

---

## 📝 License

This project is private and under development. All rights reserved.

---

<div align="center">

Built with care by the Triverce engineering team.

</div>
