import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { User, UserRole, UserStatus } from "@prisma/client";
import * as crypto from "crypto";
import * as fs from "fs";

import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { DiskStorage } from "../storage/disk.storage";
import { effectivePermissions, normalizePermissionGrants } from "./permissions";
import { avatarUrlForUser } from "../users/user-view.util";

const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || "14");
const DEFAULT_WEB_APP_URL = "http://127.0.0.1:8080";

function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

function inferNameFromEmail(email: string) {
  return email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) || "New Member";
}

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, originalHash] = stored.split(":");
  const computedHash = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHash, "hex");
  if (original.length !== computedHash.length) return false;
  return crypto.timingSafeEqual(original, computedHash);
}

function adminEmailsFromEnv() {
  return new Set(
    String(process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((value) => normalizeEmail(value))
      .filter(Boolean),
  );
}

function ownerEmailsFromEnv() {
  return new Set(
    String(process.env.OWNER_EMAILS || "")
      .split(",")
      .map((value) => normalizeEmail(value))
      .filter(Boolean),
  );
}

function isAllowedAvatarFilename(name: string) {
  const lower = String(name || "").toLowerCase();
  return /\.(jpe?g|png|webp)$/.test(lower);
}

function isAllowedAvatarMime(mime: string) {
  const m = String(mime || "").toLowerCase();
  return m === "image/jpeg" || m === "image/png" || m === "image/webp";
}

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);
  private warnedAboutDefaultWebAppUrl = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly disk: DiskStorage,
  ) {}

  private webAppBaseUrl() {
    const base = String(process.env.FRONTEND_URL || process.env.WEB_APP_URL || DEFAULT_WEB_APP_URL).replace(/\/$/, "");
    if (!this.warnedAboutDefaultWebAppUrl && /127\.0\.0\.1|localhost/.test(base)) {
      this.warnedAboutDefaultWebAppUrl = true;
      this.log.warn(`FRONTEND_URL/WEB_APP_URL is using the local fallback (${base}). Password reset and verification links will not work for real users until this is set to your public frontend URL.`);
    }
    return base;
  }

  private emailErrorMessage(kind: "verification" | "password reset", error: unknown) {
    if (error instanceof ServiceUnavailableException) {
      return "Email service is not configured.";
    }
    return kind === "verification"
      ? "Could not send verification email."
      : "Could not send password reset email.";
  }

  private normalizeEmailError(kind: "verification" | "password reset", error: unknown) {
    const message = this.emailErrorMessage(kind, error);
    if (error instanceof ServiceUnavailableException) {
      return new ServiceUnavailableException(message);
    }
    return new BadGatewayException(message);
  }

  private serializeUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      country: user.country || "",
      why_interested: user.why_interested || "",
      avatar_name: user.avatar_name || "",
      has_avatar: Boolean(user.avatar_storage_key),
      avatar_url: avatarUrlForUser(user.id, Boolean(user.avatar_storage_key)),
      email_verified: user.email_verified,
      whatsapp_phone: user.whatsapp_phone || "",
      biodata: user.biodata || "",
      social_handles: user.social_handles || "",
      permission_grants: normalizePermissionGrants(user.permission_grants),
      permissions: effectivePermissions(user.role, user.permission_grants),
      created_at: user.created_at,
    };
  }

  private async createSession(user: User) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.session.create({
      data: {
        token,
        expires_at: expiresAt,
        user_id: user.id,
      },
    });

    return {
      token,
      expires_at: expiresAt,
      user: this.serializeUser(user),
    };
  }

  async signUp(input: {
    name?: string;
    email?: string;
    password?: string;
    country?: string;
    whyInterested?: string;
  }) {
    const email = normalizeEmail(input.email || "");
    const password = String(input.password || "");
    if (!email || !email.includes("@")) {
      throw new UnauthorizedException("Enter a valid email address.");
    }
    if (password.length < 6) {
      throw new UnauthorizedException("Password must be at least 6 characters.");
    }

    const ownerEmails = ownerEmailsFromEnv();
    const adminEmails = adminEmailsFromEnv();
    const envRole = ownerEmails.has(email) ? UserRole.owner : adminEmails.has(email) ? UserRole.admin : null;
    const trimmedName = String(input.name || "").trim();

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ForbiddenException("An account with this email already exists. Please sign in.");
    }

    const isTrusted = envRole === UserRole.owner || envRole === UserRole.admin;
    const verifyToken = isTrusted
      ? null
      : crypto.randomBytes(32).toString("hex");
    const verifyExpires = isTrusted ? null : new Date(Date.now() + 48 * 60 * 60 * 1000);

    const user = await this.prisma.user.create({
      data: {
        name: trimmedName || inferNameFromEmail(email),
        email,
        password_hash: hashPassword(password),
        role: envRole || UserRole.member,
        status: UserStatus.active,
        country: String(input.country || "").trim() || null,
        why_interested: String(input.whyInterested || "").trim() || null,
        permission_grants: [],
        email_verified: isTrusted,
        email_verification_token: verifyToken,
        email_verification_expires: verifyExpires,
      },
    });

    let emailNotice: { ok: boolean; message: string; previewUrl?: string } | null = null;
    if (verifyToken) {
      const base = this.webAppBaseUrl();
      const link = `${base}/?email_verify=${encodeURIComponent(verifyToken)}`;
      try {
        const result = await this.mail.sendVerificationEmail(email, link);
        if (result.previewUrl) {
          emailNotice = {
            ok: true,
            message: "Verification email preview generated. Open the preview link from the response or server logs.",
            previewUrl: result.previewUrl,
          };
        }
      } catch (e) {
        this.log.error("Verification email not sent (check Resend/SMTP or logs for link)", e);
        emailNotice = {
          ok: false,
          message: this.emailErrorMessage("verification", e),
        };
      }
    }

    const session = await this.createSession(user);
    return emailNotice ? { ...session, email_notice: emailNotice } : session;
  }

  async login(emailInput: string, passwordInput: string) {
    const email = normalizeEmail(emailInput);
    const password = String(passwordInput || "");
    if (!email || !email.includes("@")) {
      throw new UnauthorizedException("Enter a valid email address.");
    }
    if (!password) {
      throw new UnauthorizedException("Enter your password.");
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new UnauthorizedException("Email or password is not correct.");
    }
    if (user.status === UserStatus.disabled) {
      throw new ForbiddenException("This account is disabled.");
    }

    return await this.createSession(user);
  }

  async signIn(name: string | undefined, emailInput: string) {
    const email = normalizeEmail(emailInput);
    if (!email || !email.includes("@")) {
      throw new UnauthorizedException("Enter a valid email address.");
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new UnauthorizedException("Account not found. Please sign up.");
    }

    if (!user.password_hash) {
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name: String(name || "").trim() || user.name,
        },
      });
      return await this.createSession(updated);
    }

    throw new UnauthorizedException("Please use the login form with your password.");
  }

  async updateProfile(
    userId: string,
    input: {
      name?: string;
      country?: string;
      whyInterested?: string;
      avatarName?: string;
      whatsappPhone?: string;
      biodata?: string;
      socialHandles?: string;
    },
  ) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: String(input.name || "").trim() || undefined,
        country: String(input.country || "").trim() || null,
        why_interested: String(input.whyInterested || "").trim() || null,
        avatar_name: String(input.avatarName || "").trim() || null,
        whatsapp_phone: String(input.whatsappPhone || "").trim() || null,
        biodata: String(input.biodata || "").trim() || null,
        social_handles: String(input.socialHandles || "").trim() || null,
      },
    });
    return this.serializeUser(user);
  }

  async getUserForToken(token: string | undefined) {
    const normalized = String(token || "").trim();
    if (!normalized) return null;

    const session = await this.prisma.session.findUnique({
      where: { token: normalized },
      include: { user: true },
    });
    if (!session) return null;

    if (session.expires_at.getTime() <= Date.now()) {
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }

    if (session.user.status === UserStatus.disabled) {
      throw new ForbiddenException("This account is disabled.");
    }

    return {
      sessionId: session.id,
      user: this.serializeUser(session.user),
    };
  }

  async requireUser(token: string | undefined) {
    const auth = await this.getUserForToken(token);
    if (!auth) throw new UnauthorizedException("Please sign in.");
    return auth;
  }

  async requireAdmin(token: string | undefined) {
    const auth = await this.requireUser(token);
    if (!auth.user.permissions.includes("manage_users")) {
      throw new ForbiddenException("Admin access required.");
    }
    return auth;
  }

  async signOut(token: string | undefined) {
    const normalized = String(token || "").trim();
    if (!normalized) return { ok: true };
    await this.prisma.session.deleteMany({ where: { token: normalized } });
    return { ok: true };
  }

  /**
   * Always returns the same shape so email existence is not leaked.
   */
  async requestPasswordReset(emailInput: string) {
    const email = normalizeEmail(emailInput);
    const generic = { ok: true, message: "If an account exists for that email, you will receive a reset link." };
    if (!email || !email.includes("@")) {
      return generic;
    }
    this.mail.assertTransportAvailable();

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status === UserStatus.disabled) {
      return generic;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password_reset_token: resetToken,
        password_reset_expires: resetExpires,
      },
    });
    const base = this.webAppBaseUrl();
    const link = `${base}/?reset_password=${encodeURIComponent(resetToken)}`;
    try {
      const result = await this.mail.sendPasswordResetEmail(user.email, link);
      if (result.previewUrl) {
        return {
          ok: true,
          message: "Password reset email preview generated. Open the preview link from the response or server logs.",
          previewUrl: result.previewUrl,
        };
      }
    } catch (e) {
      this.log.error("Password reset email not sent", e);
      throw this.normalizeEmailError("password reset", e);
    }
    return generic;
  }

  async resetPasswordWithToken(token: string, newPassword: string) {
    const t = String(token || "").trim();
    const password = String(newPassword || "");
    if (!t) {
      throw new BadRequestException("Reset link is not valid. Request a new one.");
    }
    if (password.length < 6) {
      throw new BadRequestException("Password must be at least 6 characters.");
    }

    const user = await this.prisma.user.findFirst({
      where: { password_reset_token: t },
    });
    if (!user) {
      throw new NotFoundException("This reset link is not valid. Request a new password reset from sign in.");
    }
    if (user.password_reset_expires && user.password_reset_expires.getTime() < Date.now()) {
      throw new BadRequestException("This link has expired. Request a new password reset.");
    }
    if (user.status === UserStatus.disabled) {
      throw new ForbiddenException("This account is disabled.");
    }

    const password_hash = hashPassword(password);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash,
        password_reset_token: null,
        password_reset_expires: null,
      },
    });
    await this.prisma.session.deleteMany({ where: { user_id: user.id } });
    return { ok: true, message: "Your password was updated. Sign in with your new password." };
  }

  async verifyEmail(token: string) {
    const t = String(token || "").trim();
    if (!t) throw new BadRequestException("Verification token is required.");

    const user = await this.prisma.user.findFirst({
      where: { email_verification_token: t },
    });
    if (!user) {
      throw new NotFoundException("This verification link is not valid. Request a new one from your profile.");
    }
    if (user.email_verification_expires && user.email_verification_expires.getTime() < Date.now()) {
      throw new BadRequestException("This verification link has expired. Request a new one from your profile.");
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email_verified: true,
        email_verification_token: null,
        email_verification_expires: null,
      },
    });
    return { user: this.serializeUser(updated) };
  }

  async requestVerificationEmail(userId: string) {
    this.mail.assertTransportAvailable();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found.");
    if (user.email_verified) throw new BadRequestException("Your email is already verified.");

    const verifyToken = crypto.randomBytes(32).toString("hex");
    const verifyExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: userId },
      data: { email_verification_token: verifyToken, email_verification_expires: verifyExpires },
    });
    const base = this.webAppBaseUrl();
    const link = `${base}/?email_verify=${encodeURIComponent(verifyToken)}`;
    try {
      const result = await this.mail.sendVerificationEmail(user.email, link);
      if (result.previewUrl) {
        return {
          ok: true,
          message: "Verification email preview generated. Open the preview link from the response or server logs.",
          previewUrl: result.previewUrl,
        };
      }
    } catch (e) {
      this.log.error("Verification resend failed", e);
      throw this.normalizeEmailError("verification", e);
    }
    return { ok: true, message: "Verification email sent." };
  }

  async saveAvatar(userId: string, file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Choose an image file.");
    }
    const maxBytes = 5 * 1024 * 1024;
    if (typeof file.size === "number" && file.size > maxBytes) {
      throw new BadRequestException("Profile photos must be 5MB or smaller.");
    }
    if (!isAllowedAvatarMime(file.mimetype) || !isAllowedAvatarFilename(file.originalname || "")) {
      throw new BadRequestException("Profile photo must be a JPG, PNG, or WebP image.");
    }
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatar_storage_key: true },
    });
    if (existing?.avatar_storage_key) {
      const old = this.disk.resolveLocalPath({ storageKey: existing.avatar_storage_key, filePath: null });
      if (old) await fs.promises.unlink(old.abs).catch(() => undefined);
    }
    const stored = await this.disk.writeUserAvatar(userId, file.originalname || "avatar.png", file.buffer);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar_storage_key: stored.storageKey, avatar_name: file.originalname || null },
    });
    return { user: this.serializeUser(user) };
  }

  async removeAvatar(userId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatar_storage_key: true },
    });
    if (existing?.avatar_storage_key) {
      const old = this.disk.resolveLocalPath({ storageKey: existing.avatar_storage_key, filePath: null });
      if (old) await fs.promises.unlink(old.abs).catch(() => undefined);
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar_storage_key: null, avatar_name: null },
    });
    return { user: this.serializeUser(user) };
  }

  async openAvatarReadStream(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatar_storage_key: true, avatar_name: true },
    });
    if (!u?.avatar_storage_key) {
      throw new NotFoundException("No avatar for this user.");
    }
    const resolved = this.disk.resolveLocalPath({ storageKey: u.avatar_storage_key, filePath: null });
    if (!resolved) {
      throw new NotFoundException("Avatar file is missing. Please upload again.");
    }
    return {
      stream: fs.createReadStream(resolved.abs),
      filename: u.avatar_name || "avatar",
    };
  }
}
