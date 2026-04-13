import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";
import * as crypto from "crypto";

import { PrismaService } from "../prisma/prisma.service";
import { effectivePermissions, normalizePermissionGrants } from "./permissions";

const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || "14");

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  country?: string | null;
  why_interested?: string | null;
  avatar_name?: string | null;
  whatsapp_phone?: string | null;
  biodata?: string | null;
  social_handles?: string | null;
  permission_grants: string[];
  created_at: Date;
};

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

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private serializeUser(user: AuthUser) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      country: user.country || "",
      why_interested: user.why_interested || "",
      avatar_name: user.avatar_name || "",
      whatsapp_phone: user.whatsapp_phone || "",
      biodata: user.biodata || "",
      social_handles: user.social_handles || "",
      permission_grants: normalizePermissionGrants(user.permission_grants),
      permissions: effectivePermissions(user.role, user.permission_grants),
      created_at: user.created_at,
    };
  }

  private async createSession(user: AuthUser) {
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
      },
    });

    return await this.createSession(user);
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
}
