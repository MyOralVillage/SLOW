import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

import type { Request } from "express";

/**
 * Category mutations: only `owner` or `admin` roles (matches product spec).
 * Session must be attached first (SessionAuthGuard).
 */
@Injectable()
export class OwnerOrAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { authUser?: { role?: string } }>();
    const role = String(req.authUser?.role ?? "")
      .trim()
      .toLowerCase();
    if (role === "owner" || role === "admin") return true;
    throw new ForbiddenException("Only owners and admins can change categories.");
  }
}
