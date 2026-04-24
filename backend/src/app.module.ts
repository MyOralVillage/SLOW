import { Module } from "@nestjs/common";

import { AuthModule } from "./auth/auth.module";
import { MessagesModule } from "./messages/messages.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ResourcesModule } from "./resources/resources.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [PrismaModule, AuthModule, ResourcesModule, UsersModule, MessagesModule, NotificationsModule],
})
export class AppModule {}
