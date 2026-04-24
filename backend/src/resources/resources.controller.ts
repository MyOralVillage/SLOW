import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
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
import { inferMimeFromFilename } from "./mime.util";
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

function extensionFromMime(mime: string | null | undefined) {
  const value = String(mime || "").toLowerCase();
  if (value === "image/png") return ".png";
  if (value === "image/jpeg") return ".jpg";
  if (value === "image/webp") return ".webp";
  if (value === "image/gif") return ".gif";
  if (value === "image/svg+xml") return ".svg";
  if (value === "image/x-icon") return ".ico";
  if (value === "application/pdf") return ".pdf";
  return "";
}

function ensureFilenameExtension(filename: string, mime: string | null | undefined) {
  const safe = String(filename || "download").trim() || "download";
  if (/\.[a-z0-9]{2,8}$/i.test(safe)) return safe;
  const ext = extensionFromMime(mime);
  return ext ? `${safe}${ext}` : safe;
}

function normalizeExternalFileUrl(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    if (url.hostname === "github.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length >= 5 && parts[2] === "blob") {
        const owner = parts[0];
        const repo = parts[1];
        const branch = parts[3];
        const filePath = parts.slice(4).join("/");
        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
      }
    }
    return url.toString();
  } catch {
    return raw;
  }
}

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

  private async sendResourceFile(id: string, asDownload: boolean, res: Response) {
    const result = await this.svc.openFileStream(id);
    const row = (result as any).row;
    const inferredMime = inferMimeFromFilename(row.original_filename || row.external_url || "");
    const resolvedMime = row.mime_type || inferredMime || "application/octet-stream";
    const disposition = asDownload ? "attachment" : "inline";

    if ("externalUrl" in result && result.externalUrl) {
      const normalizedUrl = normalizeExternalFileUrl(result.externalUrl as string);
      const upstream = await fetch(normalizedUrl);
      if (!upstream.ok) {
        throw new NotFoundException("This file is currently unavailable. Please re-upload it.");
      }

      const contentType = upstream.headers.get("content-type") || resolvedMime;
      if (contentType.toLowerCase().includes("text/html")) {
        throw new NotFoundException("Stored file link is not a direct downloadable file. Please re-upload it.");
      }

      const upstreamName = (() => {
        try {
          return decodeURIComponent(new URL(normalizedUrl).pathname.split("/").pop() || "");
        } catch {
          return "";
        }
      })();
      const filename = ensureFilenameExtension(
        row.original_filename || upstreamName || row.title || "download",
        contentType,
      );
      const safeFilename = String(filename).replace(/["\\\r\n]/g, "_");
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

    const filename = ensureFilenameExtension(row.original_filename || row.title || "download", resolvedMime);
    const safeFilename = String(filename).replace(/["\\\r\n]/g, "_");

    res.setHeader("Content-Type", resolvedMime);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );

    if ("buffer" in (result as any) && (result as any).buffer) {
      const buffer = Buffer.from((result as any).buffer as Uint8Array);
      res.setHeader("Content-Length", buffer.length);
      return res.send(buffer);
    }

    const { stat, stream } = result as { stat: { size: number }; stream: NodeJS.ReadableStream & { destroy?: () => void } };
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Accept-Ranges", "bytes");
    stream.pipe(res);
    stream.on("close", () => {
      try {
        stream.destroy?.();
      } catch {
        /* ignore */
      }
    });
  }

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
    return this.sendResourceFile(id, download === "1", res);
  }

  @Get(":id/download")
  async download(@Param("id") id: string, @Res() res: Response) {
    return this.sendResourceFile(id, true, res);
  }
}
