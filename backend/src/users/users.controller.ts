import { Body, Controller, Get, Param, Patch, Req, UseGuards } from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";

import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import { PermissionGuard, RequirePermission } from "../auth/guards/permission.guard";
import { UsersService } from "./users.service";

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
  constructor(private readonly users: UsersService) {}

  @Get()
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("manage_users")
  async listUsers() {
    return { rows: await this.users.listUsers() };
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
