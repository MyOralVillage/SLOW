import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

import type { Request } from "express";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request & { authUser?: { permissions?: string[] } }>();
    if (!req.authUser?.permissions?.includes("manage_users")) {
      throw new ForbiddenException("Admin access required.");
    }
    return true;
  }
}
