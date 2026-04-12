import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

import type { Request } from "express";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request & { authUser?: { role?: string } }>();
    if (req.authUser?.role !== "admin") {
      throw new ForbiddenException("Admin access required.");
    }
    return true;
  }
}
