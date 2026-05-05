import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CategoriesModule } from "../categories/categories.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SiteController } from "./site.controller";
import { SiteService } from "./site.service";

@Module({
  imports: [PrismaModule, AuthModule, CategoriesModule],
  controllers: [SiteController],
  providers: [SiteService],
  exports: [SiteService],
})
export class SiteModule {}
