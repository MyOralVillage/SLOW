import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionAuthGuard } from "./guards/session-auth.guard";
import { AdminGuard } from "./guards/admin.guard";
import { PermissionGuard } from "./guards/permission.guard";
import { ApiKeyGuard } from "./api-key.guard";

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard, AdminGuard, PermissionGuard, ApiKeyGuard],
  exports: [AuthService, SessionAuthGuard, AdminGuard, PermissionGuard, ApiKeyGuard],
})
export class AuthModule {}
