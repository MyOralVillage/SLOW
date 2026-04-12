import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";
import * as crypto from "crypto";

import { PrismaService } from "../prisma/prisma.service";

const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || "14");

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
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
      created_at: user.created_at,
    };
  }

  async signIn(name: string | undefined, emailInput: string) {
    const email = normalizeEmail(emailInput);
    if (!email || !email.includes("@")) {
      throw new UnauthorizedException("Enter a valid email address.");
    }

    const adminEmails = adminEmailsFromEnv();
    const desiredRole = adminEmails.has(email) ? UserRole.admin : UserRole.member;
    const trimmedName = String(name || "").trim();

    const user = await this.prisma.user.upsert({
      where: { email },
      update: {
        name: trimmedName || undefined,
        role: desiredRole,
        status: UserStatus.active,
      },
      create: {
        name: trimmedName || inferNameFromEmail(email),
        email,
        role: desiredRole,
        status: UserStatus.active,
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
    if (auth.user.role !== UserRole.admin) {
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
