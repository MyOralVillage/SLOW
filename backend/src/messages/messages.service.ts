import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserStatus } from "@prisma/client";

import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { serializePublicUser } from "../users/user-view.util";

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private messageImagePayload(message: {
    id: string;
    conversation_id?: string;
    image_mime_type?: string | null;
    image_original_filename?: string | null;
    image_size_bytes?: bigint | number | null;
    image_bytes?: Uint8Array | null;
  }) {
    if (!message?.image_bytes || !message.image_mime_type) return null;
    return {
      mime_type: message.image_mime_type,
      original_filename: message.image_original_filename || "image",
      size_bytes: typeof message.image_size_bytes === "bigint" ? Number(message.image_size_bytes) : Number(message.image_size_bytes || 0),
      url: `/api/messages/conversations/${message.conversation_id}/messages/${message.id}/image`,
    };
  }

  private async requireConversationMembership(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversation_id_user_id: {
          conversation_id: conversationId,
          user_id: userId,
        },
      },
    });
    if (!participant) {
      throw new ForbiddenException("You do not have access to this conversation.");
    }
    return participant;
  }

  private async requireActiveRecipient(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!user) throw new NotFoundException("Recipient not found.");
    if (user.status === UserStatus.disabled) throw new BadRequestException("Cannot message this user.");
    return user;
  }

  async listRecipients(currentUserId: string, query: string) {
    const q = String(query || "").trim().toLowerCase();
    const shouldFilter = q.length >= 2;
    const rows = await this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        status: { not: UserStatus.disabled },
        ...(shouldFilter
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { country: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        country: true,
        role: true,
        status: true,
        avatar_name: true,
        avatar_storage_key: true,
      },
      take: shouldFilter ? 25 : 0,
    });
    return { rows: rows.map((row) => serializePublicUser(row)) };
  }

  async listConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { user_id: userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                country: true,
                role: true,
                status: true,
                avatar_name: true,
                avatar_storage_key: true,
              },
            },
          },
        },
        messages: {
          orderBy: { created_at: "desc" },
          take: 1,
          include: {
            sender: { select: { id: true, name: true } },
            resource: { select: { id: true, title: true, type: true, country: true, category: true } },
          },
        },
      },
      orderBy: { updated_at: "desc" },
      take: 100,
    });

    const unreadByConversation = new Map<string, number>();
    await Promise.all(
      conversations.map(async (c) => {
        const mine = c.participants.find((p) => p.user_id === userId);
        const unread = await this.prisma.conversationMessage.count({
          where: {
            conversation_id: c.id,
            sender_id: { not: userId },
            read_at: null,
            created_at: mine?.last_read_at ? { gt: mine.last_read_at } : undefined,
          },
        });
        unreadByConversation.set(c.id, unread);
      }),
    );

    return {
      rows: conversations.map((c) => {
        const counterpart = c.participants.find((p) => p.user_id !== userId)?.user || null;
        const last = c.messages[0] || null;
        return {
          id: c.id,
          created_at: c.created_at,
          updated_at: c.updated_at,
          counterpart: counterpart ? serializePublicUser(counterpart) : null,
          participants: c.participants.map((p) => serializePublicUser(p.user)),
          last_message: last
            ? {
                id: last.id,
                body: last.body,
                created_at: last.created_at,
                sender: last.sender,
                resource: last.resource || null,
                image: this.messageImagePayload({ ...last, conversation_id: c.id, image_bytes: (last as any).image_bytes, image_mime_type: (last as any).image_mime_type, image_original_filename: (last as any).image_original_filename, image_size_bytes: (last as any).image_size_bytes }),
              }
            : null,
          unread_count: unreadByConversation.get(c.id) || 0,
        };
      }),
    };
  }

  async getConversation(conversationId: string, userId: string) {
    await this.requireConversationMembership(conversationId, userId);

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                country: true,
                role: true,
                status: true,
                avatar_name: true,
                avatar_storage_key: true,
              },
            },
          },
        },
        messages: {
          orderBy: { created_at: "asc" },
          take: 200,
          include: {
            sender: {
              select: { id: true, name: true, email: true },
            },
            resource: { select: { id: true, title: true, type: true, country: true, category: true } },
          },
        },
      },
    });
    if (!conversation) throw new NotFoundException("Conversation not found.");

    await this.prisma.conversationMessage.updateMany({
      where: {
        conversation_id: conversationId,
        sender_id: { not: userId },
        read_at: null,
      },
      data: { read_at: new Date() },
    });
    await this.prisma.conversationParticipant.update({
      where: {
        conversation_id_user_id: {
          conversation_id: conversationId,
          user_id: userId,
        },
      },
      data: { last_read_at: new Date() },
    });
    await this.notifications.markMessageNotificationsRead(userId, conversationId);

    return {
      conversation: {
        id: conversation.id,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        participants: conversation.participants.map((p) => serializePublicUser(p.user)),
      },
      messages: conversation.messages.map((m) => ({
        id: m.id,
        body: m.body,
        created_at: m.created_at,
        read_at: m.read_at,
        sender: serializePublicUser(m.sender),
        resource: m.resource || null,
        image: this.messageImagePayload(m as any),
      })),
    };
  }

  async createConversation(currentUserId: string, participantUserId: string, body?: string, resourceId?: string, image?: Express.Multer.File) {
    const toUserId = String(participantUserId || "").trim();
    if (!toUserId) throw new BadRequestException("Choose a user to message.");
    if (currentUserId === toUserId) throw new BadRequestException("Cannot message yourself.");
    await this.requireActiveRecipient(toUserId);

    const resource = resourceId
      ? await this.prisma.resource.findUnique({ where: { id: resourceId }, select: { id: true } })
      : null;
    if (resourceId && !resource) throw new NotFoundException("Resource not found.");

    const existing = await this.prisma.conversation.findFirst({
      where: {
        participants: {
          every: {
            user_id: { in: [currentUserId, toUserId] },
          },
        },
        AND: [
          { participants: { some: { user_id: currentUserId } } },
          { participants: { some: { user_id: toUserId } } },
        ],
      },
      select: { id: true },
    });
    if (existing) {
      if (String(body || "").trim() || resourceId || image?.buffer?.length) {
        await this.sendMessage(existing.id, currentUserId, String(body), resourceId, image);
      }
      return await this.getConversation(existing.id, currentUserId);
    }

    const created = await this.prisma.conversation.create({
      data: {
        participants: {
          create: [{ user_id: currentUserId }, { user_id: toUserId }],
        },
      },
      select: { id: true },
    });
    if (String(body || "").trim() || resourceId || image?.buffer?.length) {
      await this.sendMessage(created.id, currentUserId, String(body), resourceId, image);
    }
    return await this.getConversation(created.id, currentUserId);
  }

  async sendMessage(conversationId: string, senderId: string, body: string, resourceId?: string, image?: Express.Multer.File) {
    const text = String(body || "").trim();
    const hasImage = Boolean(image?.buffer?.length);
    if (!text && !resourceId && !hasImage) throw new BadRequestException("Message cannot be empty.");
    await this.requireConversationMembership(conversationId, senderId);

    const resource = resourceId
      ? await this.prisma.resource.findUnique({ where: { id: resourceId }, select: { id: true } })
      : null;
    if (resourceId && !resource) throw new NotFoundException("Resource not found.");
    if (hasImage) {
      const mime = String(image?.mimetype || "").toLowerCase();
      const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
      if (!allowed.has(mime)) throw new BadRequestException("Only JPG, PNG, WebP, or GIF images can be sent.");
      if (Number(image?.size || 0) > 5 * 1024 * 1024) throw new BadRequestException("Images must be 5MB or smaller.");
    }

    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversation_id: conversationId },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    const row = await this.prisma.conversationMessage.create({
      data: {
        conversation_id: conversationId,
        sender_id: senderId,
        body: text,
        resource_id: resourceId || null,
        image_mime_type: hasImage ? String(image!.mimetype || "").toLowerCase() : null,
        image_original_filename: hasImage ? image!.originalname || "image" : null,
        image_size_bytes: hasImage ? BigInt(Number(image!.size || image!.buffer.length || 0)) : null,
        image_bytes: hasImage ? new Uint8Array(image!.buffer) : null,
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        resource: { select: { id: true, title: true, type: true, country: true, category: true } },
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updated_at: new Date() },
    });
    await Promise.all(
      participants
        .filter((participant) => participant.user_id !== senderId)
        .map((participant) =>
          this.notifications.createMessageNotification(participant.user_id, {
            senderId: row.sender.id,
            senderName: row.sender.name || "Someone",
            conversationId,
            messageId: row.id,
            body: row.body,
            resourceId: row.resource?.id || null,
          }),
        ),
    );

    return {
      id: row.id,
      body: row.body,
      created_at: row.created_at,
      sender: row.sender,
      resource: row.resource || null,
      image: this.messageImagePayload(row as any),
    };
  }

  async openMessageImage(conversationId: string, messageId: string, userId: string) {
    await this.requireConversationMembership(conversationId, userId);
    const row = await this.prisma.conversationMessage.findFirst({
      where: {
        id: messageId,
        conversation_id: conversationId,
      },
      select: {
        image_mime_type: true,
        image_original_filename: true,
        image_bytes: true,
      },
    });
    if (!row?.image_bytes || !row.image_mime_type) {
      throw new NotFoundException("Image not found.");
    }
    return {
      mimeType: row.image_mime_type,
      filename: row.image_original_filename || "image",
      buffer: Buffer.from(row.image_bytes),
    };
  }
}
