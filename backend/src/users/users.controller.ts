import { Body, Controller, Get, Param, Patch, Query, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";
import type { Response } from "express";

import { AuthService } from "../auth/auth.service";
import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import { PermissionGuard, RequirePermission } from "../auth/guards/permission.guard";
import { UsersService } from "./users.service";
import { inferMimeFromFilename } from "../resources/mime.util";

type UpdateUserBody = {
  role?: UserRole;
  status?: UserStatus;
  permission_grants?: string[];
};

type RequestAuthUser = {
  id: string;
  role: UserRole;
  permissions?: string[];
};

@Controller("users")
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("manage_users")
  async listUsers() {
    return { rows: await this.users.listUsers() };
  }

  @Get("search")
  @UseGuards(SessionAuthGuard)
  async searchUsers(
    @Req() req: { authUser?: RequestAuthUser },
    @Query("q") q?: string,
  ) {
    if (!req.authUser?.id) throw new UnauthorizedException("Please sign in.");
    return await this.users.searchProfiles(req.authUser.id, String(q || ""));
  }

  @Get(":id/avatar")
  async getUserAvatar(@Param("id") id: string, @Res() res: Response) {
    const { stream, filename } = await this.auth.openAvatarReadStream(id);
    const mime = inferMimeFromFilename(filename) || "image/jpeg";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "public, max-age=600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");
    stream.pipe(res);
  }

  @Get(":id")
  @UseGuards(SessionAuthGuard)
  async getUserProfile(
    @Req() req: { authUser?: RequestAuthUser },
    @Param("id") id: string,
  ) {
    if (!req.authUser?.id) throw new UnauthorizedException("Please sign in.");
    return await this.users.getPublicProfile(id, req.authUser);
  }

  @Patch(":id")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("manage_permissions")
  async updateUser(
    @Req() req: { authUser?: RequestAuthUser },
    @Param("id") id: string,
    @Body() body: UpdateUserBody,
  ) {
    return await this.users.updateUserPermissions(id, body, req.authUser);
  }

  @Patch(":id/role")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("manage_permissions")
  async updateUserRole(
    @Req() req: { authUser?: RequestAuthUser },
    @Param("id") id: string,
    @Body() body: { role?: UserRole },
  ) {
    return await this.users.updateUserPermissions(id, { role: body.role }, req.authUser);
  }
}
