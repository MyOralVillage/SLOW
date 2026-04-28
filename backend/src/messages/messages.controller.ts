import { Body, Controller, Get, Param, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Response } from "express";

import { PermissionGuard, RequirePermission } from "../auth/guards/permission.guard";
import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import { MessagesService } from "./messages.service";

type Authed = { authUser?: { id: string; permissions?: string[] } };

const imageUpload = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
};

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

  @Get("conversations/:conversationId/messages/:messageId/image")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("message_users")
  async getMessageImage(
    @Req() req: Authed,
    @Param("conversationId") conversationId: string,
    @Param("messageId") messageId: string,
    @Res() res: Response,
  ) {
    const image = await this.messages.openMessageImage(conversationId, messageId, req.authUser!.id);
    res.setHeader("Content-Type", image.mimeType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(image.filename)}"`);
    res.send(image.buffer);
  }

  @Get(":conversationId")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("message_users")
  async getConversationAlias(@Req() req: Authed, @Param("conversationId") conversationId: string) {
    return await this.messages.getConversation(conversationId, req.authUser!.id);
  }

  @Post("conversations")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("message_users")
  @UseInterceptors(FileInterceptor("image", imageUpload))
  async createConversation(
    @Req() req: Authed,
    @Body() body: { participantUserId?: string; body?: string; message?: string; resourceId?: string },
    @UploadedFile() image?: Express.Multer.File,
  ) {
    const participantUserId = String(body?.participantUserId || "");
    const text = String(body?.body || body?.message || "");
    const resourceId = String(body?.resourceId || "").trim() || undefined;
    return await this.messages.createConversation(req.authUser!.id, participantUserId, text, resourceId, image);
  }

  @Post("conversations/:id/messages")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("message_users")
  @UseInterceptors(FileInterceptor("image", imageUpload))
  async sendMessage(
    @Req() req: Authed,
    @Param("id") id: string,
    @Body() body: { body?: string; message?: string; resourceId?: string },
    @UploadedFile() image?: Express.Multer.File,
  ) {
    const text = String(body?.body || body?.message || "");
    const resourceId = String(body?.resourceId || "").trim() || undefined;
    return await this.messages.sendMessage(id, req.authUser!.id, text, resourceId, image);
  }

  @Post("send")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("message_users")
  async sendMessageAlias(
    @Req() req: Authed,
    @Body() body: { conversationId?: string; body?: string; message?: string; resourceId?: string },
  ) {
    const conversationId = String(body?.conversationId || "");
    const text = String(body?.body || body?.message || "");
    const resourceId = String(body?.resourceId || "").trim() || undefined;
    return await this.messages.sendMessage(conversationId, req.authUser!.id, text, resourceId);
  }

  @Post("share-resource")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("message_users")
  async shareResource(
    @Req() req: Authed,
    @Body() body: { recipientId?: string; resourceId?: string; message?: string; body?: string },
  ) {
    const recipientId = String(body?.recipientId || "");
    const resourceId = String(body?.resourceId || "");
    const text = String(body?.message || body?.body || "Shared a resource");
    return await this.messages.createConversation(req.authUser!.id, recipientId, text, resourceId);
  }
}
