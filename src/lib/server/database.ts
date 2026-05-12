import { randomUUID } from "node:crypto";

import postgres from "postgres";

import { hashPassword } from "./auth.ts";
import { getAdminSeed, getPostgresUrl } from "./config.ts";

let client: ReturnType<typeof postgres> | null = null;

let schemaReady: Promise<void> | null = null;

async function ensureSchema() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS registrations (
      id UUID PRIMARY KEY,
      reference_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      organization TEXT NOT NULL DEFAULT '',
      job_title TEXT NOT NULL DEFAULT '',
      dietary_restrictions TEXT NOT NULL DEFAULT '',
      emergency_contact_name TEXT NOT NULL DEFAULT '',
      emergency_contact_phone TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS registration_documents (
      id UUID PRIMARY KEY,
      registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      stored_filename TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      replaced_document_id UUID REFERENCES registration_documents(id),
      content BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS admins (
      id UUID PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY,
      actor_type TEXT NOT NULL,
      actor_id UUID NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY,
      actor_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      registration_id UUID,
      action TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON registrations (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_registration_documents_registration_id ON registration_documents (registration_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token)`;
}

async function ensureAdminSeed() {
  const sql = getSql();
  const seed = getAdminSeed();
  const [{ count }] = await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM admins`;
  const adminCount = Number.parseInt(count, 10);

  if (!seed) {
    if (adminCount === 0) {
      throw new Error("No admin seed configured and no admin records exist");
    }
    return;
  }

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(seed.password);

  await sql`
    INSERT INTO admins (id, username, email, display_name, password_hash, is_active, created_at, updated_at)
    VALUES (${randomUUID()}, ${seed.username}, ${seed.email}, ${seed.displayName}, ${passwordHash}, TRUE, ${now}, ${now})
    ON CONFLICT (username)
    DO UPDATE SET
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      password_hash = EXCLUDED.password_hash,
      is_active = TRUE,
      updated_at = EXCLUDED.updated_at
  `;
}

export async function ensureDatabaseReady() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await ensureSchema();
      await ensureAdminSeed();
    })();
  }

  return schemaReady;
}

export function getSql() {
  if (!client) {
    client = postgres(getPostgresUrl(), {
      max: 1,
      prepare: false
    });
  }

  return client;
}
