import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { Request } from "express";

import { AuthService } from "../auth.service";
import { ALLOW_WITHOUT_LICENCE_KEY, LICENCE_REQUIRED_CODE } from "../licence";

function bearerToken(req: Request) {
  const header = String(req.headers.authorization || "");
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request & { authUser?: unknown; authSessionId?: string }>();
    const auth = await this.auth.requireUser(bearerToken(req));
    req.authUser = auth.user;
    req.authSessionId = auth.sessionId;

    // Users who have not accepted the current licence terms (e.g. accounts created
    // before the licence was introduced, or after a terms version bump) may still
    // browse, but cannot post, edit or update their profile until they accept.
    if (!auth.user.licence_accepted && !READ_ONLY_METHODS.has(req.method.toUpperCase())) {
      const allowed = this.reflector.getAllAndOverride<boolean | undefined>(ALLOW_WITHOUT_LICENCE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowed) {
        throw new ForbiddenException({
          statusCode: 403,
          error: "Forbidden",
          code: LICENCE_REQUIRED_CODE,
          message: "Please accept the SLOW licence (CC BY-SA 4.0) before posting or editing.",
        });
      }
    }
    return true;
  }
}
