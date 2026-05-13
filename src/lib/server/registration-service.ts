import { randomUUID } from "node:crypto";

import { hashPassword, verifyPassword, createToken } from "./auth.ts";
import { getUploadLimits } from "./config.ts";
import { ensureDatabaseReady, getSql } from "./database.ts";
import { AppError } from "./errors.ts";
import { createNameTagPdf } from "./pdf.ts";
import { generateReferenceCode } from "./reference-code.ts";
import { readStoredFile, storeUploadedFile } from "./storage.ts";
import type {
  AdminRecord,
  AuditLogRecord,
  PublicDocument,
  PublicRegistration,
  RegistrationRecord,
  SessionRecord,
  StoredDocument
} from "./types.ts";

type RegistrationInput = Partial<
  Pick<
    PublicRegistration,
    | "full_name"
    | "email"
    | "phone"
  >
> & {
  password?: string;
};

type RegistrationRow = Omit<RegistrationRecord, "documents">;
type AdminRow = AdminRecord;
type SessionRow = SessionRecord;
type DocumentRow = Omit<StoredDocument, "content_bytes"> & {
  content: Buffer;
};

function nowIso() {
  return new Date().toISOString();
}

function toIsoString(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function publicDocument(document: StoredDocument): PublicDocument {
  const { content_bytes: _content, storage_key: _storageKey, storage_kind: _storageKind, ...rest } = document;
  return rest;
}

function publicRegistration(registration: RegistrationRecord): PublicRegistration {
  const { password_hash: _passwordHash, ...rest } = registration;
  return {
    ...rest,
    documents: registration.documents.map(publicDocument)
  };
}

function mapRegistrationRow(row: RegistrationRow, documents: StoredDocument[] = []): RegistrationRecord {
  return {
    ...row,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
    documents
  };
}

function mapAdminRow(row: AdminRow): AdminRecord {
  return {
    ...row,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at)
  };
}

function mapDocumentRow(row: DocumentRow): StoredDocument {
  return {
    id: row.id,
    registration_id: row.registration_id,
    document_type: row.document_type,
    original_filename: row.original_filename,
    stored_filename: row.stored_filename,
    storage_path: row.storage_path,
    mime_type: row.mime_type,
    file_size_bytes: row.file_size_bytes,
    replaced_document_id: row.replaced_document_id || undefined,
    created_at: toIsoString(row.created_at),
    storage_kind: "database",
    storage_key: row.storage_key,
    content_bytes: Buffer.isBuffer(row.content) ? row.content : Buffer.from(row.content)
  };
}

function createAudit(
  actorType: AuditLogRecord["actor_type"],
  actorID: string,
  registrationID: string,
  action: string,
  details: Record<string, unknown> = {}
): AuditLogRecord {
  return {
    id: randomUUID(),
    actor_type: actorType,
    actor_id: actorID,
    registration_id: registrationID,
    action,
    details,
    created_at: nowIso()
  };
}

function extractText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function collectUploadFiles(formData: FormData, fieldNames: string | string[]) {
  const names = Array.isArray(fieldNames) ? fieldNames : [fieldNames];
  const files = names.flatMap((fieldName) =>
    formData.getAll(fieldName).filter((value): value is File => value instanceof File && value.size > 0)
  );

  const { maxUploadFiles } = getUploadLimits();
  if (files.length > maxUploadFiles) {
    throw new AppError(400, `at most ${maxUploadFiles} documents can be uploaded at once`);
  }

  return files;
}

async function createDocumentRecord(
  registrationID: string,
  file: File,
  replacedDocumentID = ""
): Promise<StoredDocument> {
  const stored = await storeUploadedFile(registrationID, file);
  return {
    id: randomUUID(),
    registration_id: registrationID,
    document_type: "supporting_document",
    original_filename: file.name,
    stored_filename: stored.stored_filename,
    storage_path: stored.storage_path,
    mime_type: stored.mime_type,
    file_size_bytes: stored.file_size_bytes,
    replaced_document_id: replacedDocumentID || undefined,
    created_at: nowIso(),
    storage_kind: stored.storage_kind,
    storage_key: stored.storage_key,
    content_bytes: stored.content_bytes
  };
}

async function createSession(actorType: SessionRecord["actor_type"], actorID: string) {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + (actorType === "admin" ? 12 : 24) * 60 * 60 * 1000);
  const session: SessionRecord = {
    id: randomUUID(),
    actor_type: actorType,
    actor_id: actorID,
    token: createToken(),
    created_at: createdAt.toISOString(),
    expires_at: expiresAt.toISOString()
  };
  return session;
}

async function database() {
  await ensureDatabaseReady();
  return getSql();
}

async function getDocumentsForRegistration(registrationID: string) {
  const sql = await database();
  const rows = await sql<DocumentRow[]>`
    SELECT
      id,
      registration_id,
      document_type,
      original_filename,
      stored_filename,
      storage_path,
      storage_key,
      mime_type,
      file_size_bytes,
      replaced_document_id,
      created_at,
      storage_key,
      content
    FROM registration_documents
    WHERE registration_id = ${registrationID}
    ORDER BY created_at ASC
  `;

  return rows.map(mapDocumentRow);
}

async function getRegistrationRecordByID(registrationID: string) {
  const sql = await database();
  const rows = await sql<RegistrationRow[]>`
    SELECT
      id,
      reference_code,
      full_name,
      email,
      phone,
      organization,
      job_title,
      dietary_restrictions,
      emergency_contact_name,
      emergency_contact_phone,
      notes,
      status,
      created_at,
      updated_at,
      password_hash
    FROM registrations
    WHERE id = ${registrationID}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) {
    return null;
  }

  return mapRegistrationRow(row, await getDocumentsForRegistration(registrationID));
}

async function getDocumentForDownload(registrationID: string, documentID: string) {
  const sql = await database();
  const rows = await sql<DocumentRow[]>`
    SELECT
      id,
      registration_id,
      document_type,
      original_filename,
      stored_filename,
      storage_path,
      mime_type,
      file_size_bytes,
      replaced_document_id,
      created_at,
      storage_key,
      content
    FROM registration_documents
    WHERE id = ${documentID} AND registration_id = ${registrationID}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) {
    throw new AppError(404, "document not found");
  }

  const document = mapDocumentRow(row);
  return {
    buffer: readStoredFile(document),
    filename: document.original_filename,
    mimeType: document.mime_type
  };
}

async function sessionForActor(token: string, actorType: SessionRecord["actor_type"]) {
  if (!token) {
    throw new AppError(401, "unauthorized");
  }

  const sql = await database();
  const rows = await sql<SessionRow[]>`
    SELECT id, actor_type, actor_id, token, created_at, expires_at
    FROM sessions
    WHERE token = ${token} AND actor_type = ${actorType}
    LIMIT 1
  `;

  const session = rows[0];
  if (!session) {
    throw new AppError(401, "unauthorized");
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await sql`DELETE FROM sessions WHERE token = ${token}`;
    throw new AppError(401, "session expired");
  }

  return {
    ...session,
    created_at: toIsoString(session.created_at),
    expires_at: toIsoString(session.expires_at)
  };
}

function applyRegistrationPatch(registration: RegistrationRecord, input: RegistrationInput) {
  if (input.full_name) {
    registration.full_name = input.full_name;
  }
  if (input.email) {
    registration.email = input.email;
  }
  if (input.phone) {
    registration.phone = input.phone;
  }
  registration.updated_at = nowIso();
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export async function createRegistration(formData: FormData) {
  const input = {
    full_name: extractText(formData, "full_name"),
    email: extractText(formData, "email"),
    phone: extractText(formData, "phone"),
    password: extractText(formData, "password")
  };

  if (!input.full_name || !input.email || !input.phone || input.password.length < 8) {
    throw new AppError(400, "full_name, email, phone and password(8+) are required");
  }

  const createdAt = nowIso();
  const registrationID = randomUUID();
  const passwordHash = await hashPassword(input.password);
  const documents = await Promise.all(
    collectUploadFiles(formData, ["documents[]", "documents"]).map((file) =>
      createDocumentRecord(registrationID, file)
    )
  );
  const sql = await database();

  let referenceCode = "";

  await sql.begin(async (tx) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      referenceCode = generateReferenceCode(new Date());

      try {
        await tx`
          INSERT INTO registrations (
            id,
            reference_code,
            full_name,
            email,
            phone,
            organization,
            job_title,
            dietary_restrictions,
            emergency_contact_name,
            emergency_contact_phone,
            notes,
            status,
            password_hash,
            created_at,
            updated_at
          ) VALUES (
            ${registrationID},
            ${referenceCode},
            ${input.full_name},
            ${input.email},
            ${input.phone},
            ${""},
            ${""},
            ${""},
            ${""},
            ${""},
            ${""},
            ${"submitted"},
            ${passwordHash},
            ${createdAt},
            ${createdAt}
          )
        `;
        break;
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }

        if (attempt === 9) {
          throw new AppError(500, "failed to allocate a unique reference code");
        }
      }
    }

    for (const document of documents) {
      await tx`
        INSERT INTO registration_documents (
          id,
          registration_id,
          document_type,
          original_filename,
          stored_filename,
          storage_path,
          storage_key,
          mime_type,
          file_size_bytes,
          replaced_document_id,
          content,
          created_at
        ) VALUES (
          ${document.id},
          ${document.registration_id},
          ${document.document_type},
          ${document.original_filename},
          ${document.stored_filename},
          ${document.storage_path},
          ${document.storage_key},
          ${document.mime_type},
          ${document.file_size_bytes},
          ${document.replaced_document_id ?? null},
          ${document.content_bytes},
          ${document.created_at}
        )
      `;
    }

    const audit = createAudit("applicant", registrationID, registrationID, "registration.created", {
      reference_code: referenceCode
    });
    await tx`
      INSERT INTO audit_logs (id, actor_type, actor_id, registration_id, action, details, created_at)
      VALUES (
        ${audit.id},
        ${audit.actor_type},
        ${audit.actor_id},
        ${audit.registration_id},
        ${audit.action},
        ${JSON.stringify(audit.details)},
        ${audit.created_at}
      )
    `;
  });

  return {
    registration_id: registrationID,
    reference_code: referenceCode,
    submitted_at: createdAt
  };
}

export async function loginApplicant(referenceCode: string, password: string) {
  const sql = await database();
  const rows = await sql<RegistrationRow[]>`
    SELECT
      id,
      reference_code,
      full_name,
      email,
      phone,
      organization,
      job_title,
      dietary_restrictions,
      emergency_contact_name,
      emergency_contact_phone,
      notes,
      status,
      created_at,
      updated_at,
      password_hash
    FROM registrations
    WHERE reference_code = ${referenceCode}
    LIMIT 1
  `;

  const registration = rows[0];
  if (!registration) {
    throw new AppError(401, "invalid credentials");
  }

  await verifyPassword(password, registration.password_hash);
  const session = await createSession("applicant", registration.id);

  await sql`
    INSERT INTO sessions (id, actor_type, actor_id, token, created_at, expires_at)
    VALUES (
      ${session.id},
      ${session.actor_type},
      ${session.actor_id},
      ${session.token},
      ${session.created_at},
      ${session.expires_at}
    )
  `;

  return { token: session.token, registration_id: registration.id };
}

export async function logoutApplicant(token: string) {
  const sql = await database();
  await sql`DELETE FROM sessions WHERE token = ${token}`;
}

export async function getApplicantRegistration(token: string) {
  const session = await sessionForActor(token, "applicant");
  const registration = await getRegistrationRecordByID(session.actor_id);
  if (!registration) {
    throw new AppError(404, "registration not found");
  }
  return publicRegistration(registration);
}

export async function updateApplicantRegistration(token: string, input: RegistrationInput) {
  const session = await sessionForActor(token, "applicant");
  const registration = await getRegistrationRecordByID(session.actor_id);
  if (!registration) {
    throw new AppError(404, "registration not found");
  }

  applyRegistrationPatch(registration, input);
  const sql = await database();

  await sql.begin(async (tx) => {
    await tx`
      UPDATE registrations
      SET
        full_name = ${registration.full_name},
        email = ${registration.email},
        phone = ${registration.phone},
        organization = ${registration.organization},
        job_title = ${registration.job_title},
        dietary_restrictions = ${registration.dietary_restrictions},
        emergency_contact_name = ${registration.emergency_contact_name},
        emergency_contact_phone = ${registration.emergency_contact_phone},
        notes = ${registration.notes},
        updated_at = ${registration.updated_at}
      WHERE id = ${registration.id}
    `;

    const audit = createAudit("applicant", session.actor_id, session.actor_id, "registration.updated");
    await tx`
      INSERT INTO audit_logs (id, actor_type, actor_id, registration_id, action, details, created_at)
      VALUES (
        ${audit.id},
        ${audit.actor_type},
        ${audit.actor_id},
        ${audit.registration_id},
        ${audit.action},
        ${JSON.stringify(audit.details)},
        ${audit.created_at}
      )
    `;
  });

  return publicRegistration(registration);
}

export async function addApplicantDocuments(token: string, formData: FormData) {
  const session = await sessionForActor(token, "applicant");
  const files = collectUploadFiles(formData, ["documents[]", "documents"]);
  if (files.length === 0) {
    throw new AppError(400, "documents field is required");
  }

  const registration = await getRegistrationRecordByID(session.actor_id);
  if (!registration) {
    throw new AppError(404, "registration not found");
  }

  const nextDocuments = await Promise.all(files.map((file) => createDocumentRecord(session.actor_id, file)));
  const updatedAt = nowIso();
  const sql = await database();

  await sql.begin(async (tx) => {
    for (const document of nextDocuments) {
      await tx`
        INSERT INTO registration_documents (
          id,
          registration_id,
          document_type,
          original_filename,
          stored_filename,
          storage_path,
          storage_key,
          mime_type,
          file_size_bytes,
          replaced_document_id,
          content,
          created_at
        ) VALUES (
          ${document.id},
          ${document.registration_id},
          ${document.document_type},
          ${document.original_filename},
          ${document.stored_filename},
          ${document.storage_path},
          ${document.storage_key},
          ${document.mime_type},
          ${document.file_size_bytes},
          ${document.replaced_document_id ?? null},
          ${document.content_bytes},
          ${document.created_at}
        )
      `;
    }

    await tx`UPDATE registrations SET updated_at = ${updatedAt} WHERE id = ${session.actor_id}`;

    const audit = createAudit("applicant", session.actor_id, session.actor_id, "documents.added", {
      count: nextDocuments.length
    });
    await tx`
      INSERT INTO audit_logs (id, actor_type, actor_id, registration_id, action, details, created_at)
      VALUES (
        ${audit.id},
        ${audit.actor_type},
        ${audit.actor_id},
        ${audit.registration_id},
        ${audit.action},
        ${JSON.stringify(audit.details)},
        ${audit.created_at}
      )
    `;
  });
}

export async function replaceApplicantDocument(token: string, documentID: string, file: File) {
  const session = await sessionForActor(token, "applicant");
  const existing = await getDocumentForDownload(session.actor_id, documentID);
  if (!existing) {
    throw new AppError(404, "document not found");
  }

  const replacement = await createDocumentRecord(session.actor_id, file, documentID);
  const updatedAt = nowIso();
  const sql = await database();

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO registration_documents (
        id,
        registration_id,
        document_type,
        original_filename,
        stored_filename,
        storage_path,
        storage_key,
        mime_type,
        file_size_bytes,
        replaced_document_id,
        content,
        created_at
      ) VALUES (
        ${replacement.id},
        ${replacement.registration_id},
        ${replacement.document_type},
        ${replacement.original_filename},
        ${replacement.stored_filename},
        ${replacement.storage_path},
        ${replacement.storage_key},
        ${replacement.mime_type},
        ${replacement.file_size_bytes},
        ${replacement.replaced_document_id ?? null},
        ${replacement.content_bytes},
        ${replacement.created_at}
      )
    `;

    await tx`UPDATE registrations SET updated_at = ${updatedAt} WHERE id = ${session.actor_id}`;

    const audit = createAudit("applicant", session.actor_id, session.actor_id, "document.replaced", {
      document_id: documentID
    });
    await tx`
      INSERT INTO audit_logs (id, actor_type, actor_id, registration_id, action, details, created_at)
      VALUES (
        ${audit.id},
        ${audit.actor_type},
        ${audit.actor_id},
        ${audit.registration_id},
        ${audit.action},
        ${JSON.stringify(audit.details)},
        ${audit.created_at}
      )
    `;
  });
}

export async function downloadApplicantDocument(token: string, documentID: string) {
  const session = await sessionForActor(token, "applicant");
  return getDocumentForDownload(session.actor_id, documentID);
}

export async function adminLogin(identifier: string, password: string) {
  const sql = await database();
  const rows = await sql<AdminRow[]>`
    SELECT id, username, email, display_name, password_hash, is_active, created_at, updated_at
    FROM admins
    WHERE is_active = TRUE AND (username = ${identifier} OR email = ${identifier})
    LIMIT 1
  `;

  const adminRow = rows[0];
  if (!adminRow) {
    throw new AppError(401, "invalid credentials");
  }

  const admin = mapAdminRow(adminRow);
  await verifyPassword(password, admin.password_hash);
  const session = await createSession("admin", admin.id);

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO sessions (id, actor_type, actor_id, token, created_at, expires_at)
      VALUES (
        ${session.id},
        ${session.actor_type},
        ${session.actor_id},
        ${session.token},
        ${session.created_at},
        ${session.expires_at}
      )
    `;

    const audit = createAudit("admin", admin.id, admin.id, "admin.login");
    await tx`
      INSERT INTO audit_logs (id, actor_type, actor_id, registration_id, action, details, created_at)
      VALUES (
        ${audit.id},
        ${audit.actor_type},
        ${audit.actor_id},
        ${null},
        ${audit.action},
        ${JSON.stringify(audit.details)},
        ${audit.created_at}
      )
    `;
  });

  return { token: session.token, admin_id: admin.id, display_name: admin.display_name };
}

export async function logoutAdmin(token: string) {
  const sql = await database();
  await sql`DELETE FROM sessions WHERE token = ${token}`;
}

async function requireAdmin(token: string): Promise<AdminRecord> {
  const session = await sessionForActor(token, "admin");
  const sql = await database();
  const rows = await sql<AdminRow[]>`
    SELECT id, username, email, display_name, password_hash, is_active, created_at, updated_at
    FROM admins
    WHERE id = ${session.actor_id} AND is_active = TRUE
    LIMIT 1
  `;

  const adminRow = rows[0];
  if (!adminRow) {
    throw new AppError(401, "unauthorized");
  }

  return mapAdminRow(adminRow);
}

export async function listAdminRegistrations({
  token,
  search = "",
  page = 1,
  pageSize = 20
}: {
  token: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  await requireAdmin(token);
  const needle = search.trim();
  const currentPage = page > 0 ? page : 1;
  const safePageSize = pageSize > 0 ? pageSize : 20;
  const offset = (currentPage - 1) * safePageSize;
  const sql = await database();

  const queryNeedle = needle ? `%${needle}%` : null;
  const itemsRows = queryNeedle
    ? await sql<RegistrationRow[]>`
        SELECT
          id,
          reference_code,
          full_name,
          email,
          phone,
          organization,
          job_title,
          dietary_restrictions,
          emergency_contact_name,
          emergency_contact_phone,
          notes,
          status,
          created_at,
          updated_at,
          password_hash
        FROM registrations
        WHERE full_name ILIKE ${queryNeedle}
           OR email ILIKE ${queryNeedle}
           OR reference_code ILIKE ${queryNeedle}
        ORDER BY created_at DESC
        LIMIT ${safePageSize}
        OFFSET ${offset}
      `
    : await sql<RegistrationRow[]>`
        SELECT
          id,
          reference_code,
          full_name,
          email,
          phone,
          organization,
          job_title,
          dietary_restrictions,
          emergency_contact_name,
          emergency_contact_phone,
          notes,
          status,
          created_at,
          updated_at,
          password_hash
        FROM registrations
        ORDER BY created_at DESC
        LIMIT ${safePageSize}
        OFFSET ${offset}
      `;

  const totalRows = queryNeedle
    ? await sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count
        FROM registrations
        WHERE full_name ILIKE ${queryNeedle}
           OR email ILIKE ${queryNeedle}
           OR reference_code ILIKE ${queryNeedle}
      `
    : await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM registrations`;

  const items = itemsRows.map((row) => publicRegistration(mapRegistrationRow(row, [])));
  const total = Number.parseInt(totalRows[0]?.count ?? "0", 10);

  return {
    items,
    page: currentPage,
    page_size: safePageSize,
    total,
    totalPages: Math.ceil(total / safePageSize) || 1
  };
}

export async function getAdminRegistration(token: string, registrationID: string) {
  await requireAdmin(token);
  const registration = await getRegistrationRecordByID(registrationID);
  if (!registration) {
    throw new AppError(404, "registration not found");
  }
  return publicRegistration(registration);
}

export async function downloadAdminDocument(token: string, registrationID: string, documentID: string) {
  await requireAdmin(token);
  return getDocumentForDownload(registrationID, documentID);
}

export async function downloadNameTag(token: string, registrationID: string) {
  await requireAdmin(token);
  const registration = await getRegistrationRecordByID(registrationID);
  if (!registration) {
    throw new AppError(404, "registration not found");
  }

  return {
    buffer: createNameTagPdf({
      fullName: registration.full_name,
      organization: registration.organization,
      referenceCode: registration.reference_code
    }),
    filename: `name-tag-${registration.reference_code}.pdf`
  };
}

export async function updateRegistrationStatus(token: string, registrationID: string, status: string) {
  const admin = await requireAdmin(token);
  if (!status.trim()) {
    throw new AppError(400, "status is required");
  }

  const registration = await getRegistrationRecordByID(registrationID);
  if (!registration) {
    throw new AppError(404, "registration not found");
  }

  registration.status = status.trim();
  registration.updated_at = nowIso();
  const sql = await database();

  await sql.begin(async (tx) => {
    await tx`
      UPDATE registrations
      SET status = ${registration.status}, updated_at = ${registration.updated_at}
      WHERE id = ${registration.id}
    `;

    const audit = createAudit("admin", admin.id, registration.id, "registration.status_updated", {
      status: registration.status
    });
    await tx`
      INSERT INTO audit_logs (id, actor_type, actor_id, registration_id, action, details, created_at)
      VALUES (
        ${audit.id},
        ${audit.actor_type},
        ${audit.actor_id},
        ${audit.registration_id},
        ${audit.action},
        ${JSON.stringify(audit.details)},
        ${audit.created_at}
      )
    `;
  });

  return publicRegistration(registration);
}
