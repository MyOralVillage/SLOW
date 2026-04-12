import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const expected = (process.env.API_KEY || "").trim();
    if (!expected) {
      throw new UnauthorizedException("Server API_KEY is not configured.");
    }
    const provided = String(req.headers["x-api-key"] || "").trim();
    if (!provided || provided !== expected) {
      throw new UnauthorizedException("Missing or invalid API key.");
    }
    return true;
  }
}

