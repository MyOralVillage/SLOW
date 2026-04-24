import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private toNotificationRow(row: any) {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      data: row.data_json || null,
      is_read: row.is_read === true,
      read_at: row.read_at,
      created_at: row.created_at,
    };
  }

  async listForUser(userId: string, limit = 50) {
    const rows = await this.prisma.notification.findMany({
      where: { user_id: userId },
      orderBy: [{ is_read: "asc" }, { created_at: "desc" }],
      take: Math.max(1, Math.min(100, Number(limit || 50))),
    });
    return { rows: rows.map((row) => this.toNotificationRow(row)) };
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { user_id: userId, is_read: false },
    });
    return { count };
  }

  async markRead(userId: string, notificationId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, user_id: userId },
    });
    if (!existing) throw new NotFoundException("Notification not found.");
    const row = existing.is_read
      ? existing
      : await this.prisma.notification.update({
          where: { id: notificationId },
          data: { is_read: true, read_at: new Date() },
        });
    return {
      ok: true,
      notification: this.toNotificationRow(row),
      unread_count: await this.prisma.notification.count({
        where: { user_id: userId, is_read: false },
      }),
    };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });
    return { ok: true, unread_count: 0 };
  }

  async createMessageNotification(recipientUserId: string, input: {
    senderId: string;
    senderName: string;
    conversationId: string;
    messageId: string;
    body: string;
    resourceId?: string | null;
  }) {
    const preview = String(input.body || "").trim() || "Sent you a message.";
    return await this.prisma.notification.create({
      data: {
        user_id: recipientUserId,
        type: "message",
        title: `New message from ${input.senderName}`,
        body: preview,
        data_json: {
          senderId: input.senderId,
          senderName: input.senderName,
          conversationId: input.conversationId,
          messageId: input.messageId,
          resourceId: input.resourceId || null,
        },
      },
    });
  }

  async markMessageNotificationsRead(userId: string, conversationId: string) {
    if (!userId || !conversationId) return;
    await this.prisma.notification.updateMany({
      where: {
        user_id: userId,
        type: "message",
        is_read: false,
        data_json: {
          path: ["conversationId"],
          equals: conversationId,
        },
      },
      data: {
        is_read: true,
        read_at: new Date(),
      },
    });
  }
}
