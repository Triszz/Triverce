import express, { Application } from "express";
import cors from "cors";
import { errorHandler } from "./core/middleware/error.middleware";
const app: Application = express();

// Middlewares
app.use(express.json());
app.use(cors());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "App is running!" });
});

app.use(errorHandler);

export default app;
