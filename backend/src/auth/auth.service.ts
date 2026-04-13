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
  permission_grants: string[];
  created_at: Date;
};

function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

function inferNameFromEmail(email: string) {
  return email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) || "New Member";
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
      permission_grants: normalizePermissionGrants(user.permission_grants),
      permissions: effectivePermissions(user.role, user.permission_grants),
      created_at: user.created_at,
    };
  }

  async signIn(name: string | undefined, emailInput: string) {
    const email = normalizeEmail(emailInput);
    if (!email || !email.includes("@")) {
      throw new UnauthorizedException("Enter a valid email address.");
    }

    const ownerEmails = ownerEmailsFromEnv();
    const adminEmails = adminEmailsFromEnv();
    const envRole = ownerEmails.has(email) ? UserRole.owner : adminEmails.has(email) ? UserRole.admin : null;
    const trimmedName = String(name || "").trim();

    const user = await this.prisma.user.upsert({
      where: { email },
      update: {
        name: trimmedName || undefined,
        role: envRole || undefined,
        status: UserStatus.active,
      },
      create: {
        name: trimmedName || inferNameFromEmail(email),
        email,
        role: envRole || UserRole.member,
        status: UserStatus.active,
        permission_grants: [],
      },
    });

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

  async signUp(name: string | undefined, emailInput: string) {
    const email = normalizeEmail(emailInput);
    if (!email || !email.includes("@")) {
      throw new UnauthorizedException("Enter a valid email address.");
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ForbiddenException("An account with this email already exists. Please sign in.");
    }

    return await this.signIn(name, email);
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
