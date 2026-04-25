import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import {
  canCreateCommunityPost,
  canCreateForumThread,
  canDeleteAnyCommunityPost,
  canReplyForumThread,
} from "../auth/permissions";
import { PrismaService } from "../prisma/prisma.service";
import { serializePublicUser } from "../users/user-view.util";

type ActingUser = {
  id: string;
  role: UserRole;
  permissions?: string[];
};

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  private mapResource(resource: any) {
    if (!resource) return null;
    return {
      id: resource.id,
      title: resource.title,
      category: resource.category,
      country: resource.country,
      type: resource.type,
      description: resource.description || "",
      file: resource.storage_key || resource.file_path || resource.external_url || (resource.file_bytes && resource.file_bytes.length)
        ? {
            url: `/api/resources/${resource.id}/file`,
            thumbnailUrl:
              (String(resource.mime_type || "").startsWith("image/") ||
                /\.(png|jpe?g|gif|webp|svg|ico)$/i.test(String(resource.original_filename || "")))
                ? `/api/resources/${resource.id}/file`
                : null,
          }
        : null,
    };
  }

  async listPosts() {
    const rows = await this.prisma.communityPost.findMany({
      orderBy: { created_at: "desc" },
      take: 100,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            country: true,
            why_interested: true,
            biodata: true,
            social_handles: true,
            avatar_name: true,
            avatar_storage_key: true,
            created_at: true,
          },
        },
        resource: {
          select: {
            id: true,
            title: true,
            category: true,
            country: true,
            type: true,
            description: true,
            mime_type: true,
            original_filename: true,
            storage_key: true,
            file_path: true,
            external_url: true,
            file_bytes: true,
          },
        },
      },
    });
    return {
      rows: rows.map((row) => ({
        id: row.id,
        body: row.body,
        created_at: row.created_at,
        updated_at: row.updated_at,
        user: serializePublicUser(row.user),
        resource: this.mapResource(row.resource),
      })),
    };
  }

  async createPost(auth: ActingUser, input: { body?: string; resourceId?: string }) {
    if (!canCreateCommunityPost(auth.role, auth.permissions)) {
      throw new ForbiddenException("Your role cannot create community posts.");
    }
    const body = String(input.body || "").trim();
    if (!body) throw new BadRequestException("Write something to post.");
    const resourceId = String(input.resourceId || "").trim() || null;
    if (resourceId) {
      const resource = await this.prisma.resource.findUnique({ where: { id: resourceId }, select: { id: true } });
      if (!resource) throw new NotFoundException("Linked resource not found.");
    }
    await this.prisma.communityPost.create({
      data: {
        body,
        user_id: auth.id,
        resource_id: resourceId,
      },
    });
    return await this.listPosts();
  }

  async deletePost(id: string, auth: ActingUser) {
    const existing = await this.prisma.communityPost.findUnique({
      where: { id },
      select: { id: true, user_id: true },
    });
    if (!existing) throw new NotFoundException("Post not found.");
    if (existing.user_id !== auth.id && !canDeleteAnyCommunityPost(auth.role, auth.permissions)) {
      throw new ForbiddenException("You do not have permission to delete this post.");
    }
    await this.prisma.communityPost.delete({ where: { id } });
    return { ok: true };
  }

  async listThreads() {
    const rows = await this.prisma.forumThread.findMany({
      orderBy: { updated_at: "desc" },
      take: 100,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            country: true,
            why_interested: true,
            biodata: true,
            social_handles: true,
            avatar_name: true,
            avatar_storage_key: true,
            created_at: true,
          },
        },
        replies: {
          orderBy: { created_at: "asc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
                country: true,
                why_interested: true,
                biodata: true,
                social_handles: true,
                avatar_name: true,
                avatar_storage_key: true,
                created_at: true,
              },
            },
          },
        },
      },
    });
    return {
      rows: rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        created_at: row.created_at,
        updated_at: row.updated_at,
        user: serializePublicUser(row.user),
        replies: row.replies.map((reply) => ({
          id: reply.id,
          body: reply.body,
          created_at: reply.created_at,
          user: serializePublicUser(reply.user),
        })),
        reply_count: row.replies.length,
      })),
    };
  }

  async getThread(id: string) {
    const rows = await this.listThreads();
    const thread = rows.rows.find((row) => row.id === id);
    if (!thread) throw new NotFoundException("Thread not found.");
    return { thread };
  }

  async createThread(auth: ActingUser, input: { title?: string; body?: string }) {
    if (!canCreateForumThread(auth.role, auth.permissions)) {
      throw new ForbiddenException("Your role cannot create forum discussions.");
    }
    const title = String(input.title || "").trim();
    const body = String(input.body || "").trim();
    if (!title) throw new BadRequestException("Thread title is required.");
    if (!body) throw new BadRequestException("Thread body is required.");
    await this.prisma.forumThread.create({
      data: {
        title,
        body,
        user_id: auth.id,
      },
    });
    return await this.listThreads();
  }

  async replyToThread(id: string, auth: ActingUser, input: { body?: string }) {
    if (!canReplyForumThread(auth.role, auth.permissions)) {
      throw new ForbiddenException("Your role cannot reply in forum discussions.");
    }
    const body = String(input.body || "").trim();
    if (!body) throw new BadRequestException("Reply cannot be empty.");
    const existing = await this.prisma.forumThread.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException("Thread not found.");
    await this.prisma.forumReply.create({
      data: {
        thread_id: id,
        user_id: auth.id,
        body,
      },
    });
    return await this.getThread(id);
  }

  async deleteThread(id: string, auth: ActingUser) {
    const existing = await this.prisma.forumThread.findUnique({
      where: { id },
      select: { id: true, user_id: true },
    });
    if (!existing) throw new NotFoundException("Thread not found.");
    const isAdminDelete = auth.role === UserRole.owner || auth.role === UserRole.admin;
    if (existing.user_id !== auth.id && !isAdminDelete) {
      throw new ForbiddenException("You do not have permission to delete this thread.");
    }
    await this.prisma.forumThread.delete({ where: { id } });
    return { ok: true };
  }
}
