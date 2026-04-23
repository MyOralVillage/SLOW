/** Guess MIME when browser multer omits or misreports it. */
export function inferMimeFromFilename(name: string): string | null {
  const lower = String(name || "").toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".ico")) return "image/x-icon";
  return null;
}

export function resolveMime(multerMime: string | null | undefined, originalName: string | undefined): string | null {
  const m = String(multerMime || "").trim();
  if (m && m !== "application/octet-stream") return m;
  return inferMimeFromFilename(originalName || "");
}

export function isImageMime(mime: string | null | undefined, originalFilename?: string | null): boolean {
  if (mime && mime.startsWith("image/")) return true;
  const i = inferMimeFromFilename(originalFilename || "");
  return Boolean(i && i.startsWith("image/"));
}
