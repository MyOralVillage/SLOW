import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";

import { PermissionGuard, RequirePermission } from "../auth/guards/permission.guard";
import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import { MessagesService } from "./messages.service";

type Authed = { authUser?: { id: string; permissions?: string[] } };

@Controller("messages")
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("message_users")
  async list(
    @Req() req: Authed,
    @Query("box") box: string | undefined,
  ) {
    const b = String(box || "inbox") === "sent" ? "sent" : "inbox";
    return await this.messages.listForUser(req.authUser!.id, b);
  }

  @Post()
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("message_users")
  async send(
    @Req() req: Authed,
    @Body() body: { toUserId?: string; toEmail?: string; body?: string; message?: string },
  ) {
    const text = String(body?.body || body?.message || "");
    if (body?.toEmail) {
      return await this.messages.sendByEmail(req.authUser!.id, String(body.toEmail), text);
    }
    const toId = String(body?.toUserId || "");
    return await this.messages.send(req.authUser!.id, toId, text);
  }

  @Patch(":id/read")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("message_users")
  async read(@Req() req: Authed, @Param("id") id: string) {
    return await this.messages.markRead(id, req.authUser!.id);
  }
}
