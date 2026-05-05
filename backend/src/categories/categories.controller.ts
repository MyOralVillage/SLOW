import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";

import { PermissionGuard, RequirePermission } from "../auth/guards/permission.guard";
import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /** Public: same names as site taxonomy (for admin UI; harmless to expose). */
  @Get()
  async list() {
    const rows = await this.categories.list();
    return { rows };
  }

  @Post()
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("manage_categories")
  async create(@Req() req: Request & { authUser?: { id: string } }, @Body() body: CreateCategoryDto) {
    const userId = req.authUser?.id;
    if (!userId) throw new UnauthorizedException();
    const row = await this.categories.create(body, userId);
    return { category: row };
  }

  @Put(":id")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("manage_categories")
  async update(@Param("id") id: string, @Body() body: UpdateCategoryDto) {
    const row = await this.categories.update(id, body);
    return { category: row };
  }

  @Delete(":id")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("manage_categories")
  async remove(@Param("id") id: string) {
    await this.categories.remove(id);
    return { ok: true };
  }
}
