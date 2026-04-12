import "reflect-metadata";
import "dotenv/config";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ["log", "warn", "error"] });

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const corsOrigin = process.env.CORS_ORIGIN || "http://127.0.0.1:8080";
  app.enableCors({
    origin:
      corsOrigin === "*"
        ? true
        : corsOrigin
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean),
    credentials: false,
  });

  const port = Number(process.env.PORT || "3001");
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`OIM backend listening on http://127.0.0.1:${port}/api`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

