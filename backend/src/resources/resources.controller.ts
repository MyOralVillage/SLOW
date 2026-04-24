import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Put,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Request, Response } from "express";

const uploadMemory = {
  storage: memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
};

import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import { PermissionGuard, RequirePermission } from "../auth/guards/permission.guard";
import { CreateResourceDto } from "./dto/create-resource.dto";
import { SearchResourcesDto } from "./dto/search-resources.dto";
import { ResourcesService } from "./resources.service";

type AuthenticatedRequest = Request & {
  authUser?: {
    id: string;
    role: string;
    permissions?: string[];
  };
};

type CommentBody = {
  body?: string;
};

function splitKeywords(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "")
    .split(/[,\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

@Controller("resources")
export class ResourcesController {
  constructor(private readonly svc: ResourcesService) {}

  private createDtoFromBody(body: Record<string, unknown>, file?: Express.Multer.File): CreateResourceDto {
    return {
      title: String(body?.title || ""),
      description: String(body?.description || ""),
      country: String(body?.country || ""),
      category: String(body?.category || ""),
      productDetail: String(body?.productDetail || body?.product_detail || ""),
      crossCuttingCategory: String(body?.crossCuttingCategory || body?.cross_cutting_category || ""),
      institution: String(body?.institution || ""),
      type: String(body?.type || ""),
      keywords: splitKeywords(body?.keywords),
      originalFilename: file?.originalname || undefined,
      externalUrl: body?.externalUrl ? String(body.externalUrl) : undefined,
    };
  }

  @Post()
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("upload_resources")
  @UseInterceptors(FileInterceptor("file", uploadMemory))
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!req.authUser) throw new UnauthorizedException("Please sign in.");
    const dto = this.createDtoFromBody(body, file);
    if (file?.buffer) {
      return await this.svc.createWithFile(dto, file, req.authUser.id);
    }
    return await this.svc.create(dto, req.authUser.id);
  }

  @Post("upload")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("upload_resources")
  @UseInterceptors(FileInterceptor("file", uploadMemory))
  async createWithFile(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!req.authUser) throw new UnauthorizedException("Please sign in.");
    const dto = this.createDtoFromBody(body, file);
    return await this.svc.createWithFile(dto, file, req.authUser.id);
  }

  @Put(":id")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("upload_resources")
  @UseInterceptors(FileInterceptor("file", uploadMemory))
  async update(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!req.authUser) throw new UnauthorizedException("Please sign in.");
    const dto = this.createDtoFromBody(body, file);
    return await this.svc.update(id, dto, { userId: req.authUser.id, permissions: req.authUser.permissions }, file);
  }

  @Delete(":id")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("upload_resources")
  async remove(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    if (!req.authUser) throw new UnauthorizedException("Please sign in.");
    return await this.svc.remove(id, { userId: req.authUser.id, permissions: req.authUser.permissions });
  }

  @Get()
  async list(@Query("limit") limitStr?: string, @Query("offset") offsetStr?: string) {
    const limit = Math.max(1, Math.min(100, Number(limitStr || "24")));
    const offset = Math.max(0, Number(offsetStr || "0"));
    return await this.svc.list(limit, offset);
  }

  @Get("search")
  async search(@Query() q: SearchResourcesDto) {
    return await this.svc.search(q);
  }

  @Get(":id")
  async getById(@Param("id") id: string) {
    return await this.svc.getById(id);
  }

  @Get(":id/comments")
  async listComments(@Param("id") id: string) {
    return { rows: await this.svc.listComments(id) };
  }

  @Post(":id/comments")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("comment_resources")
  async addComment(@Param("id") id: string, @Req() req: AuthenticatedRequest, @Body() body: CommentBody) {
    if (!req.authUser) throw new UnauthorizedException("Please sign in.");
    return await this.svc.addComment(id, req.authUser.id, String(body?.body || ""));
  }

  @Get(":id/file")
  async file(@Param("id") id: string, @Query("download") download: string | undefined, @Res() res: Response) {
    const result = await this.svc.openFileStream(id);
    const row = (result as any).row;
    const filename = row.original_filename || row.title || "download";
    const safeFilename = String(filename).replace(/["\\\r\n]/g, "_");
    const disposition = download === "1" ? "attachment" : "inline";

    if ("externalUrl" in result && result.externalUrl) {
      const upstream = await fetch(result.externalUrl as string);
      if (!upstream.ok) {
        throw new ForbiddenException("This file is currently unavailable. Please re-upload it.");
      }
      const contentType = upstream.headers.get("content-type") || row.mime_type || "application/octet-stream";
      const contentLength = upstream.headers.get("content-length");
      res.setHeader("Content-Type", contentType);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader(
        "Content-Disposition",
        `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      );
      if (contentLength) res.setHeader("Content-Length", contentLength);
      const arrayBuffer = await upstream.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    }

    res.setHeader("Content-Type", row.mime_type || "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );

    if ("buffer" in (result as any) && (result as any).buffer) {
      const buffer = (result as any).buffer as Buffer;
      res.setHeader("Content-Length", buffer.length);
      return res.send(buffer);
    }

    const { stat, stream } = result as { stat: any; stream: any };
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Accept-Ranges", "bytes");
    stream.pipe(res);
    stream.on("close", () => {
      try {
        stream.destroy();
      } catch {
        /* ignore */
      }
    });
  }
}
