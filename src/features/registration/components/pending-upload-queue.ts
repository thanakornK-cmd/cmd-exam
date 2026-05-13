export type PendingUpload = {
  id: string;
  file: File;
};

function defaultPendingUploadID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function appendPendingUploads(
  existing: PendingUpload[],
  incoming: File[],
  createID: () => string = defaultPendingUploadID
) {
  return existing.concat(incoming.map((file) => ({ id: createID(), file })));
}

export function removePendingUpload(existing: PendingUpload[], pendingUploadID: string) {
  return existing.filter((item) => item.id !== pendingUploadID);
}
