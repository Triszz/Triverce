import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { errorHandler } from "./core/middleware/error.middleware";
import { container } from "./config/container";
import { createAuthRouter } from "./modules/auth/auth.route";
import { createCategoryRouter } from "./modules/category/category.route";
import { createProductRouter } from "./modules/product/product.route";

const app: Application = express();

// Middlewares
app.use(helmet());
app.use(express.json());
app.use(cors());
app.use(cookieParser());

// Resolve controllers
const authController = container.resolve("authController");
const categoryController = container.resolve("categoryController");
const productController = container.resolve("productController");

// Routes
app.use("/api/auth", createAuthRouter(authController));
app.use("/api/categories", createCategoryRouter(categoryController));
app.use("/api/products", createProductRouter(productController));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "App is running!" });
});

app.use(errorHandler);

export default app;
