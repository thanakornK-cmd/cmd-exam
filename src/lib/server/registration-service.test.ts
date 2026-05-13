import test from "node:test";
import assert from "node:assert/strict";

import { getAdminSeed, getPostgresSslMode, getUploadLimits } from "./config.ts";
import { generateReferenceCode } from "./reference-code.ts";
import { AppError } from "./errors.ts";
import { createNameTagPdf } from "./pdf.ts";
import { storeUploadedFile } from "./storage.ts";

test("reference codes keep the expected shape and avoid collisions in sample generation", () => {
  const seen = new Set<string>();

  for (let index = 0; index < 500; index += 1) {
    const code = generateReferenceCode(new Date("2026-05-13T00:00:00.000Z"));
    assert.match(code, /^REG-\d{8}-[A-Z0-9]{5}$/);
    assert.equal(seen.has(code), false);
    seen.add(code);
  }
});

test("production mode does not seed insecure default admin credentials", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousUsername = process.env.ADMIN_USERNAME;
  const previousPassword = process.env.ADMIN_PASSWORD;
  const previousEmail = process.env.ADMIN_EMAIL;

  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_EMAIL;
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";

  try {
    assert.equal(getAdminSeed(), null);
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = previousNodeEnv;
    process.env.ADMIN_USERNAME = previousUsername;
    process.env.ADMIN_PASSWORD = previousPassword;
    process.env.ADMIN_EMAIL = previousEmail;
  }
});

test("upload storage enforces configured file size limits", async () => {
  const previousMaxUploadBytes = process.env.MAX_UPLOAD_BYTES;
  process.env.MAX_UPLOAD_BYTES = "4";

  try {
    assert.equal(getUploadLimits().maxUploadBytes, 4);

    const file = new File(["12345"], "oversize.txt", { type: "text/plain" });
    await assert.rejects(() => storeUploadedFile("registration-1", file), (error: unknown) => {
      assert.equal(error instanceof AppError, true);
      assert.equal((error as AppError).status, 400);
      return true;
    });
  } finally {
    process.env.MAX_UPLOAD_BYTES = previousMaxUploadBytes;
  }
});

test("hosted postgres defaults to SSL while localhost stays non-SSL", () => {
  const previousUrl = process.env.POSTGRES_URL;
  const previousSslMode = process.env.POSTGRES_SSL_MODE;

  try {
    delete process.env.POSTGRES_SSL_MODE;
    process.env.POSTGRES_URL = "postgresql://user:pass@dpg-example.oregon-postgres.render.com/app";
    assert.equal(getPostgresSslMode(), "require");

    process.env.POSTGRES_URL = "postgresql://postgres:postgres@localhost:5432/event_register";
    assert.equal(getPostgresSslMode(), "disable");

    process.env.POSTGRES_SSL_MODE = "require";
    assert.equal(getPostgresSslMode(), "require");
  } finally {
    process.env.POSTGRES_URL = previousUrl;
    process.env.POSTGRES_SSL_MODE = previousSslMode;
  }
});

test("name tag pdf no longer renders legacy organization text", () => {
  const pdf = createNameTagPdf({
    fullName: "Ada Lovelace",
    referenceCode: "REG-20260513-ABCDE",
    organization: "Legacy Org"
  } as never);

  const content = pdf.toString("utf8");
  assert.match(content, /Ada Lovelace/);
  assert.match(content, /REG-20260513-ABCDE/);
  assert.equal(content.includes("Legacy Org"), false);
});

test("pending upload queue appends additional files and removes by id", async () => {
  const { appendPendingUploads, removePendingUpload } = await import(
    "../../features/registration/components/pending-upload-queue.ts"
  );

  const first = new File(["first"], "first.pdf", { type: "application/pdf" });
  const second = new File(["second"], "second.pdf", { type: "application/pdf" });

  const queued = appendPendingUploads([], [first], () => "doc-1");
  const appended = appendPendingUploads(queued, [second], () => "doc-2");

  assert.deepEqual(
    appended.map((item) => item.file.name),
    ["first.pdf", "second.pdf"]
  );

  const remaining = removePendingUpload(appended, "doc-1");
  assert.deepEqual(
    remaining.map((item) => item.file.name),
    ["second.pdf"]
  );
});
