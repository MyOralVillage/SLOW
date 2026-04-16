import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { Request } from "express";
import type { PermissionName } from "../permissions";

export const REQUIRED_PERMISSION_KEY = "required_permission";

export const RequirePermission = (permission: PermissionName) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permission);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<PermissionName | undefined>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const req = context.switchToHttp().getRequest<Request & { authUser?: { permissions?: string[] } }>();
    if (!req.authUser?.permissions?.includes(required)) {
      throw new ForbiddenException(`Missing permission: ${required}`);
    }
    return true;
  }
}
