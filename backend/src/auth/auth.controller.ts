import { Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";

import type { Request } from "express";

import { SessionAuthGuard } from "./guards/session-auth.guard";
import { AuthService } from "./auth.service";

type SignInBody = {
  name?: string;
  email?: string;
  password?: string;
  country?: string;
  whyInterested?: string;
  why_interested?: string;
};

type UpdateProfileBody = {
  name?: string;
  country?: string;
  whyInterested?: string;
  why_interested?: string;
  avatarName?: string;
  avatar_name?: string;
  whatsappPhone?: string;
  whatsapp_phone?: string;
  biodata?: string;
  socialHandles?: string;
  social_handles?: string;
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
    if (body?.password) {
      return await this.auth.login(String(body?.email || ""), String(body?.password || ""));
    }
    return await this.auth.signIn(body?.name, String(body?.email || ""));
  }

  @Post("sign-up")
  async signUp(@Body() body: SignInBody) {
    return await this.auth.signUp({
      name: body?.name,
      email: String(body?.email || ""),
      password: String(body?.password || ""),
      country: body?.country,
      whyInterested: body?.whyInterested || body?.why_interested,
    });
  }

  @Post("login")
  async login(@Body() body: SignInBody) {
    return await this.auth.login(String(body?.email || ""), String(body?.password || ""));
  }

  @Post("signup")
  async signup(@Body() body: SignInBody) {
    return await this.auth.signUp({
      name: body?.name,
      email: String(body?.email || ""),
      password: String(body?.password || ""),
      country: body?.country,
      whyInterested: body?.whyInterested || body?.why_interested,
    });
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

  @Get("me")
  @UseGuards(SessionAuthGuard)
  async me(@Req() req: Request & { authUser?: unknown }) {
    if (!req.authUser) throw new UnauthorizedException("Please sign in.");
    return { user: req.authUser };
  }

  @Post("profile")
  @UseGuards(SessionAuthGuard)
  async updateProfile(@Req() req: Request & { authUser?: { id: string } }, @Body() body: UpdateProfileBody) {
    if (!req.authUser?.id) throw new UnauthorizedException("Please sign in.");
    return {
      user: await this.auth.updateProfile(req.authUser.id, {
        name: body?.name,
        country: body?.country,
        whyInterested: body?.whyInterested || body?.why_interested,
        avatarName: body?.avatarName || body?.avatar_name,
        whatsappPhone: body?.whatsappPhone || body?.whatsapp_phone,
        biodata: body?.biodata,
        socialHandles: body?.socialHandles || body?.social_handles,
      }),
    };
  }
}
