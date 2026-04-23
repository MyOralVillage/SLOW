import { Module } from "@nestjs/common";

import { MailService } from "../mail/mail.service";
import { DiskStorage } from "../storage/disk.storage";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionAuthGuard } from "./guards/session-auth.guard";
import { AdminGuard } from "./guards/admin.guard";
import { PermissionGuard } from "./guards/permission.guard";
import { ApiKeyGuard } from "./api-key.guard";

@Module({
  controllers: [AuthController],
  providers: [AuthService, MailService, DiskStorage, SessionAuthGuard, AdminGuard, PermissionGuard, ApiKeyGuard],
  exports: [AuthService, MailService, SessionAuthGuard, AdminGuard, PermissionGuard, ApiKeyGuard, DiskStorage],
})
export class AuthModule {}
