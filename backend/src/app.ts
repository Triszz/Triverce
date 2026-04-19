import express, { Application } from "express";
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

const app: Application = express();

// Middlewares
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(express.json());
app.use(cors());
app.use(cookieParser());

// Resolve controllers
const authController = container.resolve("authController");
const categoryController = container.resolve("categoryController");
const productController = container.resolve("productController");
const uploadController = container.resolve("uploadController");
const inventoryController = container.resolve("inventoryController");
const cartController = container.resolve("cartController");
const orderController = container.resolve("orderController");

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

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "App is running!" });
});

app.use(errorHandler);

export default app;
