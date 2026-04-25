import { Body, Controller, Delete, Get, Param, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import { CommunityService } from "./community.service";

type Authed = { authUser?: { id: string; role: UserRole; permissions?: string[] } };

@Controller("community")
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get("posts")
  async listPosts() {
    return await this.community.listPosts();
  }

  @Post("posts")
  @UseGuards(SessionAuthGuard)
  async createPost(@Req() req: Authed, @Body() body: { body?: string; resourceId?: string }) {
    if (!req.authUser?.id) throw new UnauthorizedException("Please sign in.");
    return await this.community.createPost(req.authUser, body);
  }

  @Delete("posts/:id")
  @UseGuards(SessionAuthGuard)
  async deletePost(@Req() req: Authed, @Param("id") id: string) {
    if (!req.authUser?.id) throw new UnauthorizedException("Please sign in.");
    return await this.community.deletePost(id, req.authUser);
  }

  @Get("forum/threads")
  async listThreads() {
    return await this.community.listThreads();
  }

  @Get("forum/threads/:id")
  async getThread(@Param("id") id: string) {
    return await this.community.getThread(id);
  }

  @Post("forum/threads")
  @UseGuards(SessionAuthGuard)
  async createThread(@Req() req: Authed, @Body() body: { title?: string; body?: string }) {
    if (!req.authUser?.id) throw new UnauthorizedException("Please sign in.");
    return await this.community.createThread(req.authUser, body);
  }

  @Post("forum/threads/:id/replies")
  @UseGuards(SessionAuthGuard)
  async replyThread(@Req() req: Authed, @Param("id") id: string, @Body() body: { body?: string }) {
    if (!req.authUser?.id) throw new UnauthorizedException("Please sign in.");
    return await this.community.replyToThread(id, req.authUser, body);
  }

  @Delete("forum/threads/:id")
  @UseGuards(SessionAuthGuard)
  async deleteThread(@Req() req: Authed, @Param("id") id: string) {
    if (!req.authUser?.id) throw new UnauthorizedException("Please sign in.");
    return await this.community.deleteThread(id, req.authUser);
  }
}
