import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

import { PrismaService } from "../prisma/prisma.service";
import { DiskStorage } from "../storage/disk.storage";
import { CreateResourceDto } from "./dto/create-resource.dto";
import { SearchResourcesDto } from "./dto/search-resources.dto";

function normalizeKeywords(list: string[] | undefined) {
  if (!list) return [];
  return Array.from(new Set(list.map((value) => String(value || "").trim()).filter(Boolean))).slice(0, 20);
}

function assertValidCreateDto(dto: CreateResourceDto) {
  if (!dto.title?.trim()) throw new BadRequestException("Title is required.");
  if (!dto.description?.trim()) throw new BadRequestException("Description is required.");
  if (!dto.country?.trim()) throw new BadRequestException("Country is required.");
  if (!dto.category?.trim()) throw new BadRequestException("Category is required.");
  if (!dto.type?.trim()) throw new BadRequestException("Type is required.");
}

function resourceCreateData(dto: CreateResourceDto, uploadedByUserId?: string | null, originalFilename?: string | null) {
  return {
    title: dto.title.trim(),
    description: dto.description.trim(),
    country: dto.country.trim(),
    category: dto.category.trim(),
    product_detail: dto.productDetail?.trim() || null,
    cross_cutting_category: dto.crossCuttingCategory?.trim() || null,
    institution: dto.institution?.trim() || null,
    type: dto.type.trim(),
    keywords: normalizeKeywords(dto.keywords),
    original_filename: originalFilename || dto.originalFilename?.trim() || null,
    uploaded_by: uploadedByUserId || null,
    external_url: dto.externalUrl?.trim() || null,
    mime_type: dto.externalUrl ? "image/png" : null,
  };
}

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly disk: DiskStorage,
  ) {}

  private toResourceResponse(row: any) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      country: row.country,
      category: row.category,
      productDetail: row.product_detail || "",
      crossCutting: row.cross_cutting_category || "",
      institution: row.institution || "",
      type: row.type,
      keywords: row.keywords || [],
      created_at: row.created_at,
      uploaded_by: row.uploadedBy
        ? {
            id: row.uploadedBy.id,
            name: row.uploadedBy.name,
            email: row.uploadedBy.email,
            role: row.uploadedBy.role,
          }
        : null,
      file: row.file_path || row.external_url
        ? {
            url: row.external_url || `/api/resources/${row.id}/file`,
            thumbnailUrl: row.external_url
              ? row.external_url
              : row.mime_type && row.mime_type.startsWith("image/")
                ? `/api/resources/${row.id}/file`
                : null,
            mimeType: row.mime_type,
            originalFilename: row.original_filename,
            sizeBytes: row.size_bytes ? row.size_bytes.toString() : null,
          }
        : null,
    };
  }

  private resourceInclude() {
    return {
      uploadedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    } as const;
  }

  private async requireEditableResource(resourceId: string, userId: string, permissions: string[] = []) {
    const row = await this.prisma.resource.findUnique({
      where: { id: resourceId },
      select: {
        id: true,
        uploaded_by: true,
      },
    });
    if (!row) throw new NotFoundException("Resource not found.");
    if (row.uploaded_by === userId || permissions.includes("edit_resources")) {
      return row;
    }
    throw new ForbiddenException("You do not have permission to change this resource.");
  }

  async create(dto: CreateResourceDto, uploadedByUserId?: string | null) {
    assertValidCreateDto(dto);
    const row = await this.prisma.resource.create({
      data: resourceCreateData(dto, uploadedByUserId),
      include: this.resourceInclude(),
    });
    return this.toResourceResponse(row);
  }

  async update(
    id: string,
    dto: CreateResourceDto,
    auth: { userId: string; permissions?: string[] },
    file?: Express.Multer.File,
  ) {
    assertValidCreateDto(dto);
    await this.requireEditableResource(id, auth.userId, auth.permissions);

    const data: any = resourceCreateData(dto, auth.userId, file?.originalname || null);
    delete data.uploaded_by;

    if (file?.buffer) {
      const stored = await this.disk.writeResourceFile(id, file.originalname, file.buffer);
      data.file_storage = "disk";
      data.storage_key = stored.storageKey;
      data.file_path = stored.absolutePath;
      data.mime_type = file.mimetype || null;
      data.size_bytes = BigInt(stored.sizeBytes);
      data.original_filename = file.originalname || null;
      data.sha256 = stored.sha256;
    }

    const row = await this.prisma.resource.update({
      where: { id },
      data,
      include: this.resourceInclude(),
    });
    return this.toResourceResponse(row);
  }

  async remove(id: string, auth: { userId: string; permissions?: string[] }) {
    const existing = await this.prisma.resource.findUnique({
      where: { id },
      select: {
        id: true,
        file_path: true,
        uploaded_by: true,
      },
    });
    if (!existing) throw new NotFoundException("Resource not found.");
    if (existing.uploaded_by !== auth.userId && !auth.permissions?.includes("edit_resources")) {
      throw new ForbiddenException("You do not have permission to remove this resource.");
    }

    await this.prisma.resource.delete({ where: { id } });
    if (existing.file_path) {
      await fs.promises.unlink(existing.file_path).catch(() => undefined);
    }
    return { ok: true };
  }

  async createWithFile(dto: CreateResourceDto, file: Express.Multer.File, uploadedByUserId?: string | null) {
    assertValidCreateDto(dto);
    if (!file?.buffer) {
      throw new BadRequestException("Choose a file to upload.");
    }

    const created = await this.prisma.resource.create({
      data: resourceCreateData(dto, uploadedByUserId, file?.originalname || null),
    });

    const stored = await this.disk.writeResourceFile(created.id, file.originalname, file.buffer);
    const row = await this.prisma.resource.update({
      where: { id: created.id },
      data: {
        file_storage: "disk",
        storage_key: stored.storageKey,
        file_path: stored.absolutePath,
        mime_type: file.mimetype || null,
        size_bytes: BigInt(stored.sizeBytes),
        original_filename: file.originalname || null,
        sha256: stored.sha256,
      },
      include: this.resourceInclude(),
    });

    return this.toResourceResponse(row);
  }

  async list(limit = 24, offset = 0) {
    const [rows, total] = await Promise.all([
      this.prisma.resource.findMany({
        include: this.resourceInclude(),
        orderBy: { created_at: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.resource.count(),
    ]);
    return { total, rows: rows.map((row) => this.toResourceResponse(row)) };
  }

  async getById(id: string) {
    const row = await this.prisma.resource.findUnique({
      where: { id },
      include: this.resourceInclude(),
    });
    if (!row) throw new NotFoundException("Resource not found.");
    return this.toResourceResponse(row);
  }

  async search(q: SearchResourcesDto) {
    const where: any = {};
    if (q.country) where.country = q.country;
    if (q.category) where.category = q.category;
    if (q.type) where.type = q.type;
    if (q.productDetail) where.product_detail = q.productDetail;
    if (q.crossCuttingCategory) where.cross_cutting_category = q.crossCuttingCategory;
    if (q.institution) where.institution = q.institution;

    const queryParts: any[] = [];
    const textQuery = (q.query || "").trim();
    if (textQuery) {
      queryParts.push(
          { title: { contains: textQuery, mode: "insensitive" } },
          { description: { contains: textQuery, mode: "insensitive" } },
          { institution: { contains: textQuery, mode: "insensitive" } },
          { keywords: { has: textQuery } },
        );
    }

    const kw = (q.keywords || "").trim();
    if (kw) {
      const bits = kw
        .split(/[,\s]+/)
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 10);
      for (const bit of bits) {
        queryParts.push(
          { title: { contains: bit, mode: "insensitive" } },
          { description: { contains: bit, mode: "insensitive" } },
          { institution: { contains: bit, mode: "insensitive" } },
          { keywords: { has: bit } },
        );
      }
    }

    if (queryParts.length) where.OR = queryParts;

    const [rows, total] = await Promise.all([
      this.prisma.resource.findMany({
        where,
        include: this.resourceInclude(),
        orderBy: { created_at: "desc" },
        take: q.limit ?? 24,
        skip: q.offset ?? 0,
      }),
      this.prisma.resource.count({ where }),
    ]);

    return { total, rows: rows.map((row) => this.toResourceResponse(row)) };
  }

  async openFileStream(id: string) {
    const row = await this.prisma.resource.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Resource not found.");

    if (row.external_url) {
      return { row, externalUrl: row.external_url };
    }

    const filePath = row.file_path || null;
    if (!filePath) throw new NotFoundException("No file for this resource.");
    const abs = path.resolve(filePath);
    if (!fs.existsSync(abs)) throw new NotFoundException("File missing on disk.");
    const stat = await fs.promises.stat(abs);
    return { row, abs, stat, stream: fs.createReadStream(abs) };
  }

  async listComments(resourceId: string) {
    await this.getById(resourceId);
    const rows = await this.prisma.comment.findMany({
      where: { resource_id: resourceId },
      orderBy: { created_at: "asc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      body: row.body,
      created_at: row.created_at,
      user: row.user,
    }));
  }

  async addComment(resourceId: string, userId: string, body: string) {
    const message = String(body || "").trim();
    if (!message) {
      throw new BadRequestException("Comment cannot be empty.");
    }
    await this.getById(resourceId);
    const row = await this.prisma.comment.create({
      data: {
        resource_id: resourceId,
        user_id: userId,
        body: message,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });
    return {
      id: row.id,
      body: row.body,
      created_at: row.created_at,
      user: row.user,
    };
  }
}
