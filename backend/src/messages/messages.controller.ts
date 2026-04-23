import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";

import { PermissionGuard, RequirePermission } from "../auth/guards/permission.guard";
import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import { MessagesService } from "./messages.service";

type Authed = { authUser?: { id: string; permissions?: string[] } };

@Controller("messages")
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get("users")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("message_users")
  async listRecipients(@Req() req: Authed, @Query("q") q?: string) {
    return await this.messages.listRecipients(req.authUser!.id, String(q || ""));
  }

  @Get("conversations")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("message_users")
  async listConversations(@Req() req: Authed) {
    return await this.messages.listConversations(req.authUser!.id);
  }

  @Get("conversations/:id")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("message_users")
  async getConversation(@Req() req: Authed, @Param("id") id: string) {
    return await this.messages.getConversation(id, req.authUser!.id);
  }

  @Post("conversations")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("message_users")
  async createConversation(
    @Req() req: Authed,
    @Body() body: { participantUserId?: string; body?: string; message?: string; resourceId?: string },
  ) {
    const participantUserId = String(body?.participantUserId || "");
    const text = String(body?.body || body?.message || "");
    const resourceId = String(body?.resourceId || "").trim() || undefined;
    return await this.messages.createConversation(req.authUser!.id, participantUserId, text, resourceId);
  }

  @Post("conversations/:id/messages")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("message_users")
  async sendMessage(
    @Req() req: Authed,
    @Param("id") id: string,
    @Body() body: { body?: string; message?: string; resourceId?: string },
  ) {
    const text = String(body?.body || body?.message || "");
    const resourceId = String(body?.resourceId || "").trim() || undefined;
    return await this.messages.sendMessage(id, req.authUser!.id, text, resourceId);
  }
}
