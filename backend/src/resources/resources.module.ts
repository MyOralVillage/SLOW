import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DiskStorage } from "../storage/disk.storage";
import { ResourcesController } from "./resources.controller";
import { ResourcesService } from "./resources.service";

@Module({
  imports: [AuthModule],
  controllers: [ResourcesController],
  providers: [ResourcesService, DiskStorage],
  exports: [ResourcesService],
})
export class ResourcesModule {}
