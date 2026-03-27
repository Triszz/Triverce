import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { errorHandler } from "./core/middleware/error.middleware";
import { container } from "./config/container";
import { createAuthRoute } from "./modules/auth/auth.route";

const app: Application = express();

// Middlewares
app.use(helmet());
app.use(express.json());
app.use(cors());
app.use(cookieParser());

const authController = container.resolve("authController");

app.use("/api/auth", createAuthRoute(authController));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "App is running!" });
});

app.use(errorHandler);

export default app;
