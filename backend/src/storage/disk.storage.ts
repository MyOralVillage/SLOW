import { Injectable, Logger } from "@nestjs/common";
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
  private readonly log = new Logger(DiskStorage.name);
  private warnedAboutStorage = false;

  baseDir() {
    const configured = String(process.env.UPLOAD_DIR || "").trim();
    const base = configured
      ? path.resolve(configured)
      : path.resolve(__dirname, "..", "..", "uploads");
    if (!this.warnedAboutStorage) {
      this.warnedAboutStorage = true;
      this.log.warn(
        `Using local disk storage at ${base}. In production, mount a persistent volume or use object storage to keep files across restarts/deploys.`,
      );
    }
    return base;
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

  /** Resolve a stored file using relative storage_key, or fall back to legacy absolute file_path. */
  resolveLocalPath(args: { storageKey?: string | null; filePath?: string | null }): { abs: string; from: "storage_key" | "legacy_path" } | null {
    if (args.storageKey) {
      const rel = path.normalize(String(args.storageKey).replace(/^\//, "")).replace(/^(\.\.(\/|\\|$))+/, "");
      const abs = path.join(this.baseDir(), rel);
      if (fs.existsSync(abs) && !fs.statSync(abs).isDirectory()) {
        return { abs, from: "storage_key" };
      }
    }
    if (args.filePath) {
      const p = String(args.filePath);
      const tryAbs = path.isAbsolute(p) ? p : path.join(this.baseDir(), p);
      if (fs.existsSync(tryAbs) && !fs.statSync(tryAbs).isDirectory()) {
        return { abs: tryAbs, from: "legacy_path" };
      }
    }
    return null;
  }

  async writeUserAvatar(userId: string, originalFilename: string, buf: Buffer): Promise<StoredFile> {
    const dir = path.join(this.baseDir(), "avatars", userId);
    await this.ensureDir(dir);
    const safe = sanitizeFilename(originalFilename || "avatar");
    const storageKey = path.join("avatars", userId, `avatar_${Date.now()}_${safe}`);
    const absolutePath = path.join(this.baseDir(), storageKey);
    await fs.promises.writeFile(absolutePath, buf);
    const stat = await fs.promises.stat(absolutePath);
    return { storageKey, absolutePath, sha256: "", sizeBytes: stat.size };
  }
}

