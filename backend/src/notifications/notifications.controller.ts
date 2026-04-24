import { Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";

import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import { NotificationsService } from "./notifications.service";

type Authed = { authUser?: { id: string } };

@Controller("notifications")
@UseGuards(SessionAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(@Req() req: Authed, @Query("limit") limit?: string) {
    return await this.notifications.listForUser(req.authUser!.id, Number(limit || "50"));
  }

  @Get("unread-count")
  async unreadCount(@Req() req: Authed) {
    return await this.notifications.unreadCount(req.authUser!.id);
  }

  @Post(":id/read")
  async markRead(@Req() req: Authed, @Param("id") id: string) {
    return await this.notifications.markRead(req.authUser!.id, id);
  }

  @Post("read-all")
  async markAllRead(@Req() req: Authed) {
    return await this.notifications.markAllRead(req.authUser!.id);
  }
}
