import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export class AuthController {
  constructor(private authService: AuthService) {}

  // Register
  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.authService.register(req.body);
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  };

  // Login
  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { accessToken, refreshToken, user } = await this.authService.login(
        req.body,
      );
      res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);
      res.status(200).json({ success: true, data: { accessToken, user } });
    } catch (error) {
      next(error);
    }
  };

  // Refresh token
  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        return res
          .status(401)
          .json({ success: false, message: "No refresh token found" });
      }
      const { accessToken } = this.authService.refreshAccessToken(refreshToken);
      res.status(200).json({ success: true, data: { accessToken } });
    } catch (error) {
      next(error);
    }
  };

  // Logout
  logout = (_req: Request, res: Response) => {
    res.clearCookie("refreshToken", COOKIE_OPTIONS);
    res
      .status(200)
      .json({ success: true, message: "Logged out successfully!" });
  };
}
