import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

export type StoredFile = {
  storageKey: string;
  absolutePath: string;
  sha256: string;
  sizeBytes: number;
};

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180) || "upload";
}

@Injectable()
export class DiskStorage {
  baseDir() {
    return path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "..", "uploads"));
  }

  async ensureDir(dir: string) {
    await fs.promises.mkdir(dir, { recursive: true });
  }

  async writeResourceFile(resourceId: string, originalFilename: string, buf: Buffer): Promise<StoredFile> {
    const dir = path.join(this.baseDir(), "resources", resourceId);
    await this.ensureDir(dir);

    const safe = sanitizeFilename(originalFilename || "upload");
    const storageKey = path.join("resources", resourceId, `${Date.now()}_${safe}`);
    const absolutePath = path.join(this.baseDir(), storageKey);

    const sha = crypto.createHash("sha256").update(buf).digest("hex");
    await fs.promises.writeFile(absolutePath, buf);
    const stat = await fs.promises.stat(absolutePath);

    return {
      storageKey,
      absolutePath,
      sha256: sha,
      sizeBytes: stat.size,
    };
  }
}

