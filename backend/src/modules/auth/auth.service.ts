import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserRepository } from "../user/user.repository";
import {
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "../../core/errors/AppError";
import {
  RegisterDto,
  LoginDto,
  UpdateProfileDto,
  ChangePasswordDto,
} from "./auth.dto";

export interface JwtPayload {
  userId: string;
  role: string;
}

export class AuthService {
  constructor(private userRepository: UserRepository) {}

  // Sign Access Token
  private signAccessToken(payload: JwtPayload): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error(
        "FATAL ERROR: JWT_SECRET is missing in environment variables.",
      );
    }
    return jwt.sign(payload, secret, {
      expiresIn: (process.env.JWT_EXPIRES_IN ||
        "15m") as jwt.SignOptions["expiresIn"],
    });
  }

  // Sign Refresh Token
  private signRefreshToken(payload: JwtPayload): string {
    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;
    if (!refreshTokenSecret) {
      throw new Error(
        "FATAL ERROR: REFRESH_TOKEN_SECRET is missing in environment variables.",
      );
    }
    return jwt.sign(payload, refreshTokenSecret, {
      expiresIn: (process.env.REFRESH_TOKEN_EXPIRES_IN ||
        "7d") as jwt.SignOptions["expiresIn"],
    });
  }

  // Register
  async register(dto: RegisterDto) {
    const exists = await this.userRepository.emailExists(dto.email);
    if (exists) {
      throw new ConflictError("Email is already exists");
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);
    const user = await this.userRepository.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role,
    });
    return user.toPublic();
  }

  // Login
  async login(dto: LoginDto) {
    const user = await this.userRepository.findByEmail(dto.email);

    // Always compare password to prevent timing attack
    const dummyHash =
      "$2a$10$CwTycUXWue0Thq9StjUM0umVK9gBtt4HkX8.6B1rA0.f8yY0Kj4vC";
    const isValid = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? dummyHash,
    );

    if (!user || !isValid) {
      throw new UnauthorizedError("Incorrect email or password");
    }

    if (!user.isActive) {
      throw new ForbiddenError("Your account has been deactivated");
    }

    const payload: JwtPayload = { userId: user.id, role: user.role };

    return {
      accessToken: this.signAccessToken(payload),
      refreshToken: this.signRefreshToken(payload),
      user: user.toPublic(),
    };
  }

  // Refresh Access Token
  refreshAccessToken(refreshToken: string) {
    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;
    if (!refreshTokenSecret) {
      throw new Error(
        "FATAL ERROR: REFRESH_TOKEN_SECRET is missing in environment variables.",
      );
    }
    try {
      const decoded = jwt.verify(
        refreshToken,
        refreshTokenSecret,
      ) as JwtPayload;
      return {
        accessToken: this.signAccessToken({
          userId: decoded.userId,
          role: decoded.role,
        }),
      };
    } catch (error) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }
  }

  // ── Account self-management ─────────────────────────────────────────────
  // These power the buyer Account page. Both methods require an already
  // authenticated user (the controller sits behind `authenticate`); the
  // service itself trusts the `userId` it receives.

  /**
   * Update the user's own profile. Email / role are intentionally NOT
   * editable here — changing them is a different workflow (email
   * verification, role promotion) that we don't ship yet.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }
    const updated = await this.userRepository.update(userId, {
      fullName: dto.fullName,
    });
    if (!updated) {
      throw new NotFoundError("User not found");
    }
    return updated.toPublic();
  }

  /**
   * Change the user's password.
   *
   * Verifies the old password against the stored hash, then hashes the
   * new one with the same salt cost as registration. We never return the
   * user object here — password changes don't need to surface any new
   * data, and avoiding the round-trip keeps the endpoint snappy.
   *
   * Throws:
   *   • NotFoundError    — the userId no longer exists
   *   • UnauthorizedError — the old password doesn't match
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const isOldPasswordValid = await bcrypt.compare(
      dto.oldPassword,
      user.passwordHash,
    );
    if (!isOldPasswordValid) {
      throw new UnauthorizedError("Current password is incorrect");
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.newPassword, salt);

    const updated = await this.userRepository.update(userId, {
      passwordHash,
    });
    if (!updated) {
      throw new NotFoundError("User not found");
    }
  }
}
