import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";

import type { Request } from "express";

import { AuthService } from "../auth.service";

function bearerToken(req: Request) {
  const header = String(req.headers.authorization || "");
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request & { authUser?: unknown; authSessionId?: string }>();
    const auth = await this.auth.requireUser(bearerToken(req));
    req.authUser = auth.user;
    req.authSessionId = auth.sessionId;
    return true;
  }
}
