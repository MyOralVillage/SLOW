import { BadRequestException, Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { DEFAULT_SITE_TAXONOMY, type SiteTaxonomy } from "./default-taxonomy";
import type { UpdateTaxonomyDto } from "./dto/update-taxonomy.dto";

const TAXONOMY_KEYS = [
  "countries",
  "mainCategories",
  "crossCuttingCategories",
  "productDetails",
  "institutions",
  "types",
] as const;

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
export class SiteService {
  constructor(private readonly prisma: PrismaService) {}

  async getTaxonomy(): Promise<SiteTaxonomy> {
    const row = await this.prisma.siteConfig.findUnique({ where: { id: "default" } });
    const stored = row?.taxonomy_json;
    if (!stored || typeof stored !== "object") {
      return this.mergeWithDefaults({});
    }
    return this.mergeWithDefaults(stored as Record<string, unknown>);
  }

  async updateTaxonomy(dto: UpdateTaxonomyDto): Promise<SiteTaxonomy> {
    const normalized: SiteTaxonomy = {
      countries: dedupeTrimmed(dto.countries),
      mainCategories: dedupeTrimmed(dto.mainCategories),
      crossCuttingCategories: dedupeTrimmed(dto.crossCuttingCategories),
      productDetails: dedupeTrimmed(dto.productDetails),
      institutions: dedupeTrimmed(dto.institutions),
      types: dedupeTrimmed(dto.types),
    };

    for (const key of TAXONOMY_KEYS) {
      if (!normalized[key].length) {
        throw new BadRequestException(`Field "${key}" must contain at least one non-empty value.`);
      }
    }

    await this.prisma.siteConfig.upsert({
      where: { id: "default" },
      create: { id: "default", taxonomy_json: normalized },
      update: { taxonomy_json: normalized },
    });

    return normalized;
  }

  private mergeWithDefaults(stored: Record<string, unknown>): SiteTaxonomy {
    const out: SiteTaxonomy = {
      countries: [...DEFAULT_SITE_TAXONOMY.countries],
      mainCategories: [...DEFAULT_SITE_TAXONOMY.mainCategories],
      crossCuttingCategories: [...DEFAULT_SITE_TAXONOMY.crossCuttingCategories],
      productDetails: [...DEFAULT_SITE_TAXONOMY.productDetails],
      institutions: [...DEFAULT_SITE_TAXONOMY.institutions],
      types: [...DEFAULT_SITE_TAXONOMY.types],
    };

    for (const key of TAXONOMY_KEYS) {
      const v = stored[key];
      if (Array.isArray(v) && v.length) {
        const cleaned = dedupeTrimmed(v.map((x) => String(x)));
        if (cleaned.length) out[key] = cleaned;
      }
    }

    return out;
  }
}
