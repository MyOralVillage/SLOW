import { Body, Controller, Get, Param, Patch, Req, UseGuards } from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";

import { AdminGuard } from "../auth/guards/admin.guard";
import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
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
  @UseGuards(SessionAuthGuard, AdminGuard)
  async listUsers() {
    return { rows: await this.users.listUsers() };
  }

  @Patch(":id")
  @UseGuards(SessionAuthGuard, AdminGuard)
  async updateUser(
    @Req() req: { authUser?: RequestAuthUser },
    @Param("id") id: string,
    @Body() body: UpdateUserBody,
  ) {
    return await this.users.updateUserPermissions(id, body, req.authUser);
  }
}
