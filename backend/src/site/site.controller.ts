import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";

import { PermissionGuard, RequirePermission } from "../auth/guards/permission.guard";
import { SessionAuthGuard } from "../auth/guards/session-auth.guard";
import { UpdateTaxonomyDto } from "./dto/update-taxonomy.dto";
import { SiteService } from "./site.service";

@Controller("site")
export class SiteController {
  constructor(private readonly site: SiteService) {}

  /** Public: drives home tiles, search filters, signup country list, and upload labels. */
  @Get("taxonomy")
  async getTaxonomy() {
    return await this.site.getTaxonomy();
  }

  @Put("taxonomy")
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermission("manage_categories")
  async updateTaxonomy(@Body() body: UpdateTaxonomyDto) {
    return await this.site.updateTaxonomy(body);
  }
}
