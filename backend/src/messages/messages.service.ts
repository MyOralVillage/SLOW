import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserStatus } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string, box: "inbox" | "sent") {
    if (box === "inbox") {
      const rows = await this.prisma.message.findMany({
        where: { to_user_id: userId },
        orderBy: { created_at: "desc" },
        take: 100,
        include: {
          fromUser: { select: { id: true, name: true, email: true } },
        },
      });
      return {
        rows: rows.map((m) => ({
          id: m.id,
          body: m.body,
          created_at: m.created_at,
          read_at: m.read_at,
          from: m.fromUser,
          toUserId: m.to_user_id,
        })),
      };
    }
    const rows = await this.prisma.message.findMany({
      where: { from_user_id: userId },
      orderBy: { created_at: "desc" },
      take: 100,
      include: {
        toUser: { select: { id: true, name: true, email: true } },
      },
    });
    return {
      rows: rows.map((m) => ({
        id: m.id,
        body: m.body,
        created_at: m.created_at,
        read_at: m.read_at,
        to: m.toUser,
        fromUserId: m.from_user_id,
      })),
    };
  }

  async send(fromUserId: string, toUserId: string, body: string) {
    const text = String(body || "").trim();
    if (!text) throw new BadRequestException("Message cannot be empty.");
    if (fromUserId === toUserId) throw new BadRequestException("Cannot message yourself.");

    const to = await this.prisma.user.findUnique({ where: { id: toUserId }, select: { id: true, status: true } });
    if (!to) throw new NotFoundException("Recipient not found.");
    if (to.status === UserStatus.disabled) throw new BadRequestException("Cannot message this user.");

    const row = await this.prisma.message.create({
      data: {
        from_user_id: fromUserId,
        to_user_id: toUserId,
        body: text,
      },
      include: {
        toUser: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      id: row.id,
      body: row.body,
      created_at: row.created_at,
      to: row.toUser,
    };
  }

  async sendByEmail(fromUserId: string, toEmail: string, body: string) {
    const email = String(toEmail || "")
      .trim()
      .toLowerCase();
    if (!email) throw new BadRequestException("Recipient email is required.");
    const to = await this.prisma.user.findUnique({ where: { email }, select: { id: true, status: true } });
    if (!to) throw new NotFoundException("No user with that email.");
    if (to.status === UserStatus.disabled) throw new BadRequestException("Cannot message this user.");
    return await this.send(fromUserId, to.id, body);
  }

  async markRead(messageId: string, userId: string) {
    const m = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!m || m.to_user_id !== userId) throw new ForbiddenException("Cannot update this message.");
    if (m.read_at) return { ok: true };
    await this.prisma.message.update({
      where: { id: messageId },
      data: { read_at: new Date() },
    });
    return { ok: true };
  }
}
