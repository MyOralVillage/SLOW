import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
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
    type: dto.type.trim(),
    keywords: normalizeKeywords(dto.keywords),
    original_filename: originalFilename || dto.originalFilename?.trim() || null,
    uploaded_by: uploadedByUserId || null,
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
      file: row.file_path
        ? {
            url: `/api/resources/${row.id}/file`,
            thumbnailUrl: row.mime_type && row.mime_type.startsWith("image/") ? `/api/resources/${row.id}/file` : null,
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

  async create(dto: CreateResourceDto, uploadedByUserId?: string | null) {
    assertValidCreateDto(dto);
    const row = await this.prisma.resource.create({
      data: resourceCreateData(dto, uploadedByUserId),
      include: this.resourceInclude(),
    });
    return this.toResourceResponse(row);
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

    const queryParts: any[] = [];
    const textQuery = (q.query || "").trim();
    if (textQuery) {
      queryParts.push(
        { title: { contains: textQuery, mode: "insensitive" } },
        { description: { contains: textQuery, mode: "insensitive" } },
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
    const filePath = row.file_path || null;
    if (!filePath) throw new NotFoundException("No file for this resource.");
    const abs = path.resolve(filePath);
    if (!fs.existsSync(abs)) throw new NotFoundException("File missing on disk.");
    const stat = await fs.promises.stat(abs);
    return { row, abs, stat, stream: fs.createReadStream(abs) };
  }
}
