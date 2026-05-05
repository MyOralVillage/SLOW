import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { CategoryGroup } from "@prisma/client";
import { randomBytes } from "crypto";

import { PrismaService } from "../prisma/prisma.service";
import { DEFAULT_SITE_TAXONOMY } from "../site/default-taxonomy";
import type { CreateCategoryDto } from "./dto/create-category.dto";
import type { UpdateCategoryDto } from "./dto/update-category.dto";

function slugifyBase(name: string): string {
  const s = String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (s || "category").slice(0, 80);
}

function makeUniqueSlug(name: string): string {
  return `${slugifyBase(name)}-${randomBytes(4).toString("hex")}`;
}

function dedupeTrimmed(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const s = String(raw).trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

@Injectable()
export class CategoriesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureSeededFromDefaults();
  }

  /** Seed from defaults when the Category table is empty (first deploy or new env). */
  async ensureSeededFromDefaults() {
    const n = await this.prisma.category.count();
    if (n > 0) return;
    await this.replaceAllFromArrays(
      [...DEFAULT_SITE_TAXONOMY.mainCategories],
      [...DEFAULT_SITE_TAXONOMY.crossCuttingCategories],
      null,
    );
  }

  async list() {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ group_type: "asc" }, { name: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      group_type: r.group_type === CategoryGroup.main ? "main" : "cross_cutting",
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }

  async getNamesForTaxonomy(): Promise<{ mainCategories: string[]; crossCuttingCategories: string[] }> {
    const rows = await this.prisma.category.findMany({
      select: { name: true, group_type: true },
      orderBy: { name: "asc" },
    });
    const mainCategories = rows.filter((r) => r.group_type === CategoryGroup.main).map((r) => r.name);
    const crossCuttingCategories = rows
      .filter((r) => r.group_type === CategoryGroup.cross_cutting)
      .map((r) => r.name);
    return { mainCategories, crossCuttingCategories };
  }

  /**
   * Full replace (admin bulk taxonomy save). Deletes all categories and recreates from name lists.
   */
  async replaceAllFromArrays(main: string[], cross: string[], createdBy: string | null) {
    const mains = dedupeTrimmed(main);
    const crosses = dedupeTrimmed(cross);
    if (!mains.length || !crosses.length) {
      throw new BadRequestException("Main and cross-cutting category lists must each have at least one value.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.category.deleteMany({});
      await tx.category.createMany({
        data: [
          ...mains.map((name) => ({
            name,
            slug: makeUniqueSlug(name),
            group_type: CategoryGroup.main,
            created_by: createdBy,
          })),
          ...crosses.map((name) => ({
            name,
            slug: makeUniqueSlug(name),
            group_type: CategoryGroup.cross_cutting,
            created_by: createdBy,
          })),
        ],
      });
    });
  }

  async create(dto: CreateCategoryDto, userId: string) {
    const name = String(dto.name || "").trim();
    if (!name) throw new BadRequestException("Name is required.");
    const group =
      dto.group_type === "cross_cutting" ? CategoryGroup.cross_cutting : CategoryGroup.main;

    const existing = await this.prisma.category.findFirst({
      where: { group_type: group, name },
    });
    if (existing) {
      throw new BadRequestException("A category with this name already exists in that group.");
    }

    return await this.prisma.category.create({
      data: {
        name,
        slug: makeUniqueSlug(name),
        group_type: group,
        created_by: userId,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const row = await this.prisma.category.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Category not found.");

    const newName = dto.name !== undefined ? String(dto.name).trim() : row.name;
    if (!newName) throw new BadRequestException("Name is required.");

    if (newName === row.name) {
      return row;
    }

    const dup = await this.prisma.category.findFirst({
      where: {
        group_type: row.group_type,
        name: newName,
        NOT: { id },
      },
    });
    if (dup) throw new BadRequestException("A category with this name already exists in that group.");

    await this.prisma.$transaction(async (tx) => {
      if (row.group_type === CategoryGroup.main) {
        await tx.resource.updateMany({
          where: { category: row.name },
          data: { category: newName },
        });
      } else {
        await tx.resource.updateMany({
          where: { cross_cutting_category: row.name },
          data: { cross_cutting_category: newName },
        });
      }
      await tx.category.update({
        where: { id },
        data: { name: newName, slug: makeUniqueSlug(newName) },
      });
    });

    return (await this.prisma.category.findUnique({ where: { id } }))!;
  }

  async remove(id: string) {
    const row = await this.prisma.category.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Category not found.");

    if (row.group_type === CategoryGroup.main) {
      const n = await this.prisma.resource.count({ where: { category: row.name } });
      if (n > 0) {
        throw new BadRequestException(
          `Cannot delete: ${n} resource(s) are tagged with “${row.name}”. Remove or reassign them first.`,
        );
      }
    } else {
      const n = await this.prisma.resource.count({ where: { cross_cutting_category: row.name } });
      if (n > 0) {
        throw new BadRequestException(
          `Cannot delete: ${n} resource(s) use cross-cutting “${row.name}”. Remove or reassign them first.`,
        );
      }
    }

    await this.prisma.category.delete({ where: { id } });
  }
}
