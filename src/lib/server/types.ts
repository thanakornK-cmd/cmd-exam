export type PublicDocument = {
  id: string;
  registration_id: string;
  document_type: string;
  original_filename: string;
  stored_filename: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  replaced_document_id?: string;
  created_at: string;
};

export type StoredDocument = PublicDocument & {
  storage_kind: "database";
  storage_key: string;
  content_bytes: Buffer;
};

type RegistrationFields = {
  id: string;
  reference_code: string;
  full_name: string;
  email: string;
  phone: string;
  organization: string;
  job_title: string;
  dietary_restrictions: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  notes: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type PublicRegistration = RegistrationFields & {
  documents: PublicDocument[];
};

export type RegistrationRecord = RegistrationFields & {
  password_hash: string;
  documents: StoredDocument[];
};

export type AdminRecord = {
  id: string;
  username: string;
  email: string;
  display_name: string;
  password_hash: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SessionRecord = {
  id: string;
  actor_type: "applicant" | "admin";
  actor_id: string;
  token: string;
  expires_at: string;
  created_at: string;
};

export type AuditLogRecord = {
  id: string;
  actor_type: "applicant" | "admin";
  actor_id: string;
  registration_id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
};
