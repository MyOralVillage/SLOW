import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
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
import type { Request, Response } from "express";

import { ApiKeyGuard } from "../auth/api-key.guard";
import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import { CreateResourceDto } from "./dto/create-resource.dto";
import { SearchResourcesDto } from "./dto/search-resources.dto";
import { ResourcesService } from "./resources.service";

type AuthenticatedRequest = Request & {
  authUser?: {
    id: string;
    role: string;
  };
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

  @Post()
  @UseGuards(ApiKeyGuard)
  async create(@Body() dto: CreateResourceDto) {
    return await this.svc.create(dto, null);
  }

  @Post("upload")
  @UseGuards(SessionAuthGuard)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 25 * 1024 * 1024 } }))
  async createWithFile(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!req.authUser) throw new UnauthorizedException("Please sign in.");
    if (req.authUser.role === "guest") {
      throw new ForbiddenException("Guest accounts cannot upload resources.");
    }
    const dto: CreateResourceDto = {
      title: String(body?.title || ""),
      description: String(body?.description || ""),
      country: String(body?.country || ""),
      category: String(body?.category || ""),
      type: String(body?.type || ""),
      keywords: splitKeywords(body?.keywords),
      originalFilename: file?.originalname || undefined,
    };
    return await this.svc.createWithFile(dto, file, req.authUser.id);
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

  @Get(":id/file")
  async file(@Param("id") id: string, @Query("download") download: string | undefined, @Res() res: Response) {
    const { row, stat, stream } = await this.svc.openFileStream(id);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Type", row.mime_type || "application/octet-stream");
    const filename = row.original_filename || row.title || "download";
    const disposition = download === "1" ? "attachment" : "inline";
    res.setHeader("Content-Disposition", `${disposition}; filename="${encodeURIComponent(filename)}"`);
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
