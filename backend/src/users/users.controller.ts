import { Controller, Get, UseGuards } from "@nestjs/common";

import { AdminGuard } from "../auth/guards/admin.guard";
import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @UseGuards(SessionAuthGuard, AdminGuard)
  async listUsers() {
    return { rows: await this.users.listUsers() };
  }
}
