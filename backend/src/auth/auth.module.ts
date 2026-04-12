import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionAuthGuard } from "./guards/session-auth.guard";
import { AdminGuard } from "./guards/admin.guard";
import { ApiKeyGuard } from "./api-key.guard";

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard, AdminGuard, ApiKeyGuard],
  exports: [AuthService, SessionAuthGuard, AdminGuard, ApiKeyGuard],
})
export class AuthModule {}
