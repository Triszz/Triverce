import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import { errorHandler } from "./core/middleware/error.middleware";
import { container } from "./config/container";
import { createAuthRouter } from "./modules/auth/auth.route";
import { createCategoryRouter } from "./modules/category/category.route";
import { createProductRouter } from "./modules/product/product.route";
import { createUploadRouter } from "./modules/upload/upload.route";
import { createInventoryRouter } from "./modules/inventory/inventory.route";
import { createCartRouter } from "./modules/cart/cart.route";
import { createOrderRouter } from "./modules/order/order.route";
import { createPaymentRouter } from "./modules/payment/payment.route";
import { createWebhookRouter } from "./modules/webhook/webhook.route";
import { createDashboardRouter } from "./modules/dashboard/dashboard.route";
import { createSellerRouter } from "./modules/seller/seller.route";
import { createNotificationRouter } from "./modules/notification/notification.route";

const app: Application = express();

// Middlewares
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// jsonParser only consumes requests whose Content-Type is application/json.
// This is the standard pattern: express.json() itself already guards on
// Content-Type, so multipart/form-data upload requests pass through untouched
// and multer (running later in the route handler chain) can read the stream.
app.use(express.json());

/**
 * CORS — supports multiple local frontends (buyer + seller dev servers).
 *
 * Resolves `FRONTEND_ORIGIN` from the environment, splitting on commas
 * so we can pass either a single origin or a list:
 *   FRONTEND_ORIGIN="http://localhost:5173,http://localhost:5174"
 * Falls back to the two Vite dev ports used by frontend-buyer and
 * frontend-seller.
 */
const FRONTEND_ORIGIN = (
  process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173,http://localhost:5174'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
    exposedHeaders: ['Authorization'],
  }),
);
app.use(cookieParser());

const webhookController = container.resolve("webhookController");
app.use("/api/webhooks", createWebhookRouter(webhookController));

// Resolve controllers
const authController = container.resolve("authController");
const categoryController = container.resolve("categoryController");
const productController = container.resolve("productController");
const uploadController = container.resolve("uploadController");
const inventoryController = container.resolve("inventoryController");
const cartController = container.resolve("cartController");
const orderController = container.resolve("orderController");
const paymentController = container.resolve("paymentController");
const dashboardController = container.resolve("dashboardController");
const sellerController = container.resolve("sellerController");
const notificationController = container.resolve("notificationController");

// Initialize uploads/ directory when server starts
const uploadService = container.resolve("uploadService");
uploadService.init();

// Routes
app.use("/api/auth", createAuthRouter(authController));
app.use("/api/categories", createCategoryRouter(categoryController));
app.use("/api/products", createProductRouter(productController));
app.use("/api/upload", createUploadRouter(uploadController));
app.use("/api/inventory", createInventoryRouter(inventoryController));
app.use("/api/cart", createCartRouter(cartController));
app.use("/api/orders", createOrderRouter(orderController));
app.use("/api/payments", createPaymentRouter(paymentController));
app.use("/api/seller/dashboard", createDashboardRouter(dashboardController));
app.use("/api/seller", createSellerRouter(sellerController));
app.use("/api/notifications", createNotificationRouter(notificationController));

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "OK", message: "App is running!" });
});

app.use(errorHandler);

export default app;
