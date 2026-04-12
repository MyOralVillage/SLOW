import { Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";

import type { Request } from "express";

import { SessionAuthGuard } from "./guards/session-auth.guard";
import { AuthService } from "./auth.service";

type SignInBody = {
  name?: string;
  email?: string;
};

function bearerToken(req: Request) {
  const header = String(req.headers.authorization || "");
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("sign-in")
  async signIn(@Body() body: SignInBody) {
    return await this.auth.signIn(body?.name, String(body?.email || ""));
  }

  @Post("sign-out")
  async signOut(@Req() req: Request) {
    return await this.auth.signOut(bearerToken(req));
  }

  @Get("session")
  @UseGuards(SessionAuthGuard)
  async session(@Req() req: Request & { authUser?: unknown }) {
    if (!req.authUser) throw new UnauthorizedException("Please sign in.");
    return { user: req.authUser };
  }
}
