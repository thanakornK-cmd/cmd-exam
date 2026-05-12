import { randomUUID } from "node:crypto";

import { AppError } from "./errors.ts";
import { getUploadLimits } from "./config.ts";
import type { StoredDocument } from "./types.ts";

export type StoredUpload = Pick<
  StoredDocument,
  | "stored_filename"
  | "storage_path"
  | "storage_kind"
  | "storage_key"
  | "mime_type"
  | "file_size_bytes"
  | "content_bytes"
>;

export async function storeUploadedFile(
  registrationID: string,
  file: File
): Promise<StoredUpload> {
  const { maxUploadBytes } = getUploadLimits();
  if (file.size > maxUploadBytes) {
    throw new AppError(400, `file ${file.name} exceeds the ${Math.floor(maxUploadBytes / (1024 * 1024))}MB upload limit`);
  }

  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const storageKey = `${registrationID}/${randomUUID()}${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  return {
    stored_filename: storageKey.split("/").pop() ?? storageKey,
    storage_path: storageKey,
    storage_kind: "database",
    storage_key: storageKey,
    mime_type: file.type || "application/octet-stream",
    file_size_bytes: buffer.byteLength,
    content_bytes: buffer
  };
}

export function readStoredFile(document: Pick<StoredDocument, "content_bytes">) {
  return document.content_bytes;
}
