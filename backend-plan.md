# Event Registration Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Go REST API for registration submission, applicant self-service, admin management, file storage, and name tag PDF generation backed by Postgres and local filesystem storage.

**Architecture:** The backend is a standalone Go service with a layered structure: HTTP handlers for transport, services for business rules, repositories for Postgres access, storage for filesystem uploads, and dedicated auth/PDF modules. Sessions are opaque tokens stored in Postgres, files are stored on a persistent disk, and the API surface is consumed only by the Next.js BFF.

**Tech Stack:** Go 1.22+, `chi`, `pgx`, `sqlc`, `golang-migrate`, `go-playground/validator`, `bcrypt`, `gofpdf`, Postgres, local filesystem storage, `httptest`

---

## Repository Structure

```text
event-register-backend/
  cmd/api/main.go
  internal/config/config.go
  internal/db/postgres.go
  internal/db/tx.go
  internal/domain/registration.go
  internal/domain/document.go
  internal/domain/admin.go
  internal/domain/session.go
  internal/domain/audit.go
  internal/repository/registration_repository.go
  internal/repository/document_repository.go
  internal/repository/admin_repository.go
  internal/repository/session_repository.go
  internal/repository/audit_repository.go
  internal/service/registration_service.go
  internal/service/applicant_auth_service.go
  internal/service/admin_auth_service.go
  internal/service/document_service.go
  internal/service/admin_registration_service.go
  internal/service/name_tag_service.go
  internal/http/router.go
  internal/http/handlers/registration_handler.go
  internal/http/handlers/applicant_auth_handler.go
  internal/http/handlers/applicant_registration_handler.go
  internal/http/handlers/admin_auth_handler.go
  internal/http/handlers/admin_registration_handler.go
  internal/http/middleware/request_id.go
  internal/http/middleware/logging.go
  internal/http/middleware/recovery.go
  internal/http/middleware/applicant_auth.go
  internal/http/middleware/admin_auth.go
  internal/auth/password.go
  internal/auth/token.go
  internal/storage/filesystem.go
  internal/pdf/name_tag.go
  internal/audit/logger.go
  migrations/000001_init.up.sql
  migrations/000001_init.down.sql
  sql/registrations.sql
  sql/documents.sql
  sql/admins.sql
  sql/sessions.sql
  sql/audit_logs.sql
  sqlc.yaml
  tests/integration/registration_flow_test.go
  tests/integration/admin_flow_test.go
  tests/unit/reference_code_test.go
  tests/unit/password_test.go
  tests/unit/name_tag_test.go
  .env.example
  Makefile
  README.md
```

## Environment Variables

```env
APP_ENV=development
PORT=8080
DATABASE_URL=postgres://postgres:postgres@localhost:5432/event_register?sslmode=disable
UPLOAD_ROOT=/var/lib/event-register/uploads
APPLICANT_SESSION_TTL_HOURS=24
ADMIN_SESSION_TTL_HOURS=12
BCRYPT_COST=12
PDF_ORGANIZER_NAME=CMD AI Adoption Exam 2026
PDF_EVENT_NAME=CMD AI Adoption Exam 2026
PDF_EVENT_DATE=2026-05-12
ALLOWED_ORIGINS=http://localhost:3000
```

## API Summary

Base path: `/api/v1`

- `POST /registrations`
- `POST /applicant-sessions`
- `POST /applicant-sessions/logout`
- `GET /me/registration`
- `PATCH /me/registration`
- `POST /me/documents`
- `POST /me/documents/{documentId}/replace`
- `GET /me/documents/{documentId}/download`
- `POST /admin-sessions`
- `POST /admin-sessions/logout`
- `GET /admin/registrations`
- `GET /admin/registrations/{registrationId}`
- `GET /admin/registrations/{registrationId}/documents/{documentId}/download`
- `GET /admin/registrations/{registrationId}/name-tag.pdf`
- `POST /admin/registrations/{registrationId}/status`

## Data Model

### `registrations`

- `id uuid primary key`
- `reference_code text unique not null`
- `full_name text not null`
- `email text not null`
- `phone text not null`
- `organization text not null default ''`
- `job_title text not null default ''`
- `dietary_restrictions text not null default ''`
- `emergency_contact_name text not null default ''`
- `emergency_contact_phone text not null default ''`
- `notes text not null default ''`
- `password_hash text not null`
- `status text not null default 'submitted'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `registration_documents`

- `id uuid primary key`
- `registration_id uuid not null references registrations(id)`
- `document_type text not null default 'supporting_document'`
- `original_filename text not null`
- `stored_filename text not null`
- `storage_path text not null`
- `mime_type text not null`
- `file_size_bytes bigint not null`
- `replaced_document_id uuid null references registration_documents(id)`
- `created_at timestamptz not null default now()`

### `admins`

- `id uuid primary key`
- `username text unique not null`
- `email text unique not null`
- `display_name text not null`
- `password_hash text not null`
- `is_active boolean not null default true`
- `last_login_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `admin_sessions`

- `id uuid primary key`
- `admin_id uuid not null references admins(id)`
- `token_hash text not null`
- `expires_at timestamptz not null`
- `created_at timestamptz not null default now()`
- `revoked_at timestamptz null`

### `applicant_sessions`

- `id uuid primary key`
- `registration_id uuid not null references registrations(id)`
- `token_hash text not null`
- `expires_at timestamptz not null`
- `created_at timestamptz not null default now()`
- `revoked_at timestamptz null`

### `audit_logs`

- `id uuid primary key`
- `actor_type text not null`
- `actor_id uuid null`
- `registration_id uuid null references registrations(id)`
- `action text not null`
- `details_json jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

## Implementation Tasks

### Task 1: Bootstrap the service skeleton and local tooling

**Files:**
- Create: `cmd/api/main.go`
- Create: `internal/config/config.go`
- Create: `internal/http/router.go`
- Create: `internal/http/middleware/request_id.go`
- Create: `internal/http/middleware/logging.go`
- Create: `internal/http/middleware/recovery.go`
- Create: `.env.example`
- Create: `Makefile`
- Modify: `README.md`

- [ ] **Step 1: Initialize the module and dependency set**

```bash
go mod init github.com/your-org/event-register-backend
go get github.com/go-chi/chi/v5 github.com/go-chi/chi/v5/middleware github.com/jackc/pgx/v5 github.com/go-playground/validator/v10 github.com/google/uuid golang.org/x/crypto/bcrypt
```

- [ ] **Step 2: Write the config loader**

```go
type Config struct {
    Port                     string
    DatabaseURL              string
    UploadRoot               string
    ApplicantSessionTTLHours int
    AdminSessionTTLHours     int
    BcryptCost               int
}
```

- [ ] **Step 3: Build the base router with health check**

```go
func NewRouter() http.Handler {
    r := chi.NewRouter()
    r.Use(requestid.Middleware)
    r.Use(logging.Middleware)
    r.Use(recovery.Middleware)
    r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        _, _ = w.Write([]byte("ok"))
    })
    return r
}
```

- [ ] **Step 4: Add local dev commands**

```makefile
run:
	go run ./cmd/api

test:
	go test ./...

migrate-up:
	migrate -path migrations -database "$(DATABASE_URL)" up
```

- [ ] **Step 5: Run the service locally**

Run: `go run ./cmd/api`
Expected: process starts and `curl localhost:8080/healthz` returns `ok`

- [ ] **Step 6: Commit**

```bash
git add cmd/api internal/config internal/http .env.example Makefile README.md go.mod go.sum
git commit -m "chore: bootstrap backend service skeleton"
```

### Task 2: Create schema migrations and sqlc query definitions

**Files:**
- Create: `migrations/000001_init.up.sql`
- Create: `migrations/000001_init.down.sql`
- Create: `sql/registrations.sql`
- Create: `sql/documents.sql`
- Create: `sql/admins.sql`
- Create: `sql/sessions.sql`
- Create: `sql/audit_logs.sql`
- Create: `sqlc.yaml`
- Create: `internal/domain/registration.go`
- Create: `internal/domain/document.go`
- Create: `internal/domain/admin.go`
- Create: `internal/domain/session.go`
- Create: `internal/domain/audit.go`

- [ ] **Step 1: Write the initial migration**

```sql
create extension if not exists "pgcrypto";

create table registrations (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  full_name text not null,
  email text not null,
  phone text not null,
  organization text not null default '',
  job_title text not null default '',
  dietary_restrictions text not null default '',
  emergency_contact_name text not null default '',
  emergency_contact_phone text not null default '',
  notes text not null default '',
  password_hash text not null,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- [ ] **Step 2: Add remaining tables and indexes**

```sql
create table registration_documents (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations(id) on delete cascade,
  document_type text not null default 'supporting_document',
  original_filename text not null,
  stored_filename text not null,
  storage_path text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  replaced_document_id uuid references registration_documents(id),
  created_at timestamptz not null default now()
);

create index registration_documents_registration_id_idx on registration_documents(registration_id);
create index registrations_reference_code_idx on registrations(reference_code);
```

- [ ] **Step 3: Define sqlc queries for CRUD and sessions**

```sql
-- name: CreateRegistration :one
insert into registrations (
  reference_code, full_name, email, phone, organization, job_title,
  dietary_restrictions, emergency_contact_name, emergency_contact_phone,
  notes, password_hash, status
) values (
  $1, $2, $3, $4, $5, $6,
  $7, $8, $9,
  $10, $11, $12
)
returning *;
```

- [ ] **Step 4: Generate db code**

Run: `sqlc generate`
Expected: generated query package appears under the configured output directory without errors

- [ ] **Step 5: Apply the migration**

Run: `migrate -path migrations -database "$DATABASE_URL" up`
Expected: all tables exist in Postgres

- [ ] **Step 6: Commit**

```bash
git add migrations sql sqlc.yaml internal/domain
git commit -m "feat: add backend schema and query definitions"
```

### Task 3: Implement auth helpers and reference code generation with unit tests

**Files:**
- Create: `internal/auth/password.go`
- Create: `internal/auth/token.go`
- Create: `internal/service/reference_code.go`
- Create: `tests/unit/reference_code_test.go`
- Create: `tests/unit/password_test.go`

- [ ] **Step 1: Write the failing tests**

```go
func TestGenerateReferenceCodeFormat(t *testing.T) {
    code := service.GenerateReferenceCode(time.Date(2026, 5, 12, 0, 0, 0, 0, time.UTC))
    matched, _ := regexp.MatchString(`^REG-20260512-[A-Z0-9]{5}$`, code)
    if !matched {
        t.Fatalf("unexpected code format: %s", code)
    }
}
```

```go
func TestHashAndComparePassword(t *testing.T) {
    hash, err := auth.HashPassword("secret123", 12)
    if err != nil {
        t.Fatal(err)
    }
    if err := auth.ComparePassword(hash, "secret123"); err != nil {
        t.Fatalf("expected password to match: %v", err)
    }
}
```

- [ ] **Step 2: Run unit tests to verify failure**

Run: `go test ./tests/unit/...`
Expected: FAIL due to missing implementations

- [ ] **Step 3: Implement minimal auth helpers**

```go
func HashPassword(password string, cost int) (string, error) {
    bytes, err := bcrypt.GenerateFromPassword([]byte(password), cost)
    if err != nil {
        return "", err
    }
    return string(bytes), nil
}
```

```go
func GenerateReferenceCode(now time.Time) string {
    const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    suffix := make([]byte, 5)
    for i := range suffix {
        suffix[i] = charset[rand.Intn(len(charset))]
    }
    return fmt.Sprintf("REG-%s-%s", now.Format("20060102"), string(suffix))
}
```

- [ ] **Step 4: Re-run unit tests**

Run: `go test ./tests/unit/...`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/auth internal/service/reference_code.go tests/unit
git commit -m "feat: add auth helpers and reference code generation"
```

### Task 4: Build filesystem storage and document metadata flows

**Files:**
- Create: `internal/storage/filesystem.go`
- Create: `internal/repository/document_repository.go`
- Create: `internal/service/document_service.go`
- Modify: `sql/documents.sql`

- [ ] **Step 1: Define the storage interface and filesystem adapter**

```go
type Storage interface {
    Save(ctx context.Context, registrationID uuid.UUID, filename string, src io.Reader) (StoredFile, error)
    Open(path string) (*os.File, error)
}
```

```go
type StoredFile struct {
    StoredFilename string
    StoragePath    string
    SizeBytes      int64
}
```

- [ ] **Step 2: Implement deterministic storage layout**

```go
dir := filepath.Join(root, registrationID.String())
storedName := fmt.Sprintf("%s%s", uuid.NewString(), filepath.Ext(filename))
fullPath := filepath.Join(dir, storedName)
```

- [ ] **Step 3: Add document insert and lookup queries**

```sql
-- name: CreateRegistrationDocument :one
insert into registration_documents (
  registration_id, document_type, original_filename, stored_filename,
  storage_path, mime_type, file_size_bytes, replaced_document_id
) values ($1, $2, $3, $4, $5, $6, $7, $8)
returning *;
```

- [ ] **Step 4: Add replace-document service behavior**

```go
func (s *DocumentService) ReplaceDocument(ctx context.Context, registrationID, documentID uuid.UUID, file UploadedFile) error {
    existing, err := s.documents.GetByID(ctx, documentID)
    if err != nil {
        return err
    }
    if existing.RegistrationID != registrationID {
        return ErrForbiddenDocumentAccess
    }
    stored, err := s.storage.Save(ctx, registrationID, file.Filename, file.Reader)
    if err != nil {
        return err
    }
    _, err = s.documents.Create(ctx, repository.CreateRegistrationDocumentParams{
        RegistrationID:     registrationID,
        OriginalFilename:   file.Filename,
        StoredFilename:     stored.StoredFilename,
        StoragePath:        stored.StoragePath,
        MimeType:           file.MimeType,
        FileSizeBytes:      stored.SizeBytes,
        ReplacedDocumentID: pgtype.UUID{Bytes: existing.ID, Valid: true},
    })
    return err
}
```

- [ ] **Step 5: Commit**

```bash
git add internal/storage internal/repository/document_repository.go internal/service/document_service.go sql/documents.sql
git commit -m "feat: add filesystem storage and document services"
```

### Task 5: Implement registration creation endpoint with multipart upload

**Files:**
- Create: `internal/repository/registration_repository.go`
- Create: `internal/service/registration_service.go`
- Create: `internal/http/handlers/registration_handler.go`
- Create: `tests/integration/registration_flow_test.go`
- Modify: `internal/http/router.go`

- [ ] **Step 1: Write the failing integration test**

```go
func TestCreateRegistration(t *testing.T) {
    body := &bytes.Buffer{}
    writer := multipart.NewWriter(body)
    _ = writer.WriteField("full_name", "Ada Lovelace")
    _ = writer.WriteField("email", "ada@example.com")
    _ = writer.WriteField("phone", "0812345678")
    _ = writer.WriteField("password", "secret123")
    part, _ := writer.CreateFormFile("documents[]", "resume.pdf")
    _, _ = part.Write([]byte("fake pdf content"))
    _ = writer.Close()
}
```

- [ ] **Step 2: Run the test to verify failure**

Run: `go test ./tests/integration -run TestCreateRegistration -v`
Expected: FAIL because route or handler does not exist

- [ ] **Step 3: Implement handler request parsing and validation**

```go
type CreateRegistrationRequest struct {
    FullName              string `validate:"required"`
    Email                 string `validate:"required,email"`
    Phone                 string `validate:"required"`
    Organization          string
    JobTitle              string
    DietaryRestrictions   string
    EmergencyContactName  string
    EmergencyContactPhone string
    Notes                 string
    Password              string `validate:"required,min=8"`
}
```

- [ ] **Step 4: Implement transactional create flow**

```go
func (s *RegistrationService) Create(ctx context.Context, req CreateRegistrationInput, files []UploadedFile) (*domain.Registration, error) {
    passwordHash, err := auth.HashPassword(req.Password, s.bcryptCost)
    if err != nil {
        return nil, err
    }
    referenceCode := GenerateReferenceCode(s.now())
    reg, err := s.registrations.Create(ctx, repository.CreateRegistrationParams{
        ReferenceCode: referenceCode,
        FullName:      req.FullName,
        Email:         req.Email,
        Phone:         req.Phone,
        PasswordHash:  passwordHash,
        Status:        "submitted",
    })
    if err != nil {
        return nil, err
    }
    for _, file := range files {
        if err := s.documents.Add(ctx, reg.ID, file); err != nil {
            return nil, err
        }
    }
    return &reg, nil
}
```

- [ ] **Step 5: Re-run the integration test**

Run: `go test ./tests/integration -run TestCreateRegistration -v`
Expected: PASS with `201 Created`

- [ ] **Step 6: Commit**

```bash
git add internal/repository/registration_repository.go internal/service/registration_service.go internal/http/handlers/registration_handler.go internal/http/router.go tests/integration/registration_flow_test.go
git commit -m "feat: add registration submission endpoint"
```

### Task 6: Implement applicant login, session storage, and self-service endpoints

**Files:**
- Create: `internal/repository/session_repository.go`
- Create: `internal/service/applicant_auth_service.go`
- Create: `internal/http/handlers/applicant_auth_handler.go`
- Create: `internal/http/handlers/applicant_registration_handler.go`
- Create: `internal/http/middleware/applicant_auth.go`
- Modify: `tests/integration/registration_flow_test.go`

- [ ] **Step 1: Extend the integration test to log back in**

```go
func TestApplicantLoginAndFetchOwnRegistration(t *testing.T) {
    // create registration first
    // post /api/v1/applicant-sessions
    // call /api/v1/me/registration with session token
}
```

- [ ] **Step 2: Run the targeted test**

Run: `go test ./tests/integration -run TestApplicantLoginAndFetchOwnRegistration -v`
Expected: FAIL because login or auth middleware is missing

- [ ] **Step 3: Implement applicant session creation**

```go
func (s *ApplicantAuthService) Login(ctx context.Context, referenceCode, password string) (string, error) {
    reg, err := s.registrations.GetByReferenceCode(ctx, referenceCode)
    if err != nil {
        return "", ErrInvalidCredentials
    }
    if err := auth.ComparePassword(reg.PasswordHash, password); err != nil {
        return "", ErrInvalidCredentials
    }
    token, tokenHash := auth.NewOpaqueToken()
    err = s.sessions.CreateApplicantSession(ctx, reg.ID, tokenHash, s.now().Add(s.ttl))
    if err != nil {
        return "", err
    }
    return token, nil
}
```

- [ ] **Step 4: Implement `GET /me/registration` and `PATCH /me/registration`**

```go
func (h *ApplicantRegistrationHandler) GetMe(w http.ResponseWriter, r *http.Request) {
    registrationID := middleware.ApplicantRegistrationID(r.Context())
    response, err := h.service.GetOwnRegistration(r.Context(), registrationID)
    writeJSON(w, response, err)
}
```

- [ ] **Step 5: Re-run applicant flow tests**

Run: `go test ./tests/integration -run TestApplicant -v`
Expected: PASS for login and own-registration endpoints

- [ ] **Step 6: Commit**

```bash
git add internal/repository/session_repository.go internal/service/applicant_auth_service.go internal/http/handlers/applicant_auth_handler.go internal/http/handlers/applicant_registration_handler.go internal/http/middleware/applicant_auth.go tests/integration/registration_flow_test.go
git commit -m "feat: add applicant auth and self-service endpoints"
```

### Task 7: Implement add-document, replace-document, and download endpoints for applicants

**Files:**
- Modify: `internal/http/handlers/applicant_registration_handler.go`
- Modify: `internal/service/document_service.go`
- Modify: `internal/http/router.go`
- Modify: `tests/integration/registration_flow_test.go`

- [ ] **Step 1: Extend the failing test for add and replace flows**

```go
func TestApplicantCanAddAndReplaceDocuments(t *testing.T) {
    // authenticate applicant
    // post /api/v1/me/documents
    // post /api/v1/me/documents/{id}/replace
    // get /api/v1/me/documents/{id}/download
}
```

- [ ] **Step 2: Run the targeted test**

Run: `go test ./tests/integration -run TestApplicantCanAddAndReplaceDocuments -v`
Expected: FAIL because endpoints are incomplete

- [ ] **Step 3: Implement upload and replacement handlers**

```go
r.Post("/me/documents", applicantRegistrationHandler.AddDocuments)
r.Post("/me/documents/{documentID}/replace", applicantRegistrationHandler.ReplaceDocument)
r.Get("/me/documents/{documentID}/download", applicantRegistrationHandler.DownloadDocument)
```

- [ ] **Step 4: Enforce ownership checks before file access**

```go
if doc.RegistrationID != registrationID {
    return ErrForbiddenDocumentAccess
}
```

- [ ] **Step 5: Re-run the document flow tests**

Run: `go test ./tests/integration -run TestApplicantCanAddAndReplaceDocuments -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add internal/http/handlers/applicant_registration_handler.go internal/service/document_service.go internal/http/router.go tests/integration/registration_flow_test.go
git commit -m "feat: add applicant document management endpoints"
```

### Task 8: Implement admin auth, registration list/detail, and status update

**Files:**
- Create: `internal/repository/admin_repository.go`
- Create: `internal/service/admin_auth_service.go`
- Create: `internal/service/admin_registration_service.go`
- Create: `internal/http/handlers/admin_auth_handler.go`
- Create: `internal/http/handlers/admin_registration_handler.go`
- Create: `internal/http/middleware/admin_auth.go`
- Create: `tests/integration/admin_flow_test.go`

- [ ] **Step 1: Write the failing admin integration test**

```go
func TestAdminLoginAndListRegistrations(t *testing.T) {
    // seed admin
    // post /api/v1/admin-sessions
    // get /api/v1/admin/registrations
    // get /api/v1/admin/registrations/{id}
}
```

- [ ] **Step 2: Run the targeted test**

Run: `go test ./tests/integration -run TestAdminLoginAndListRegistrations -v`
Expected: FAIL because admin auth and routes do not exist

- [ ] **Step 3: Implement admin session creation and middleware**

```go
func (s *AdminAuthService) Login(ctx context.Context, identifier, password string) (string, error) {
    admin, err := s.admins.GetByIdentifier(ctx, identifier)
    if err != nil || !admin.IsActive {
        return "", ErrInvalidCredentials
    }
    if err := auth.ComparePassword(admin.PasswordHash, password); err != nil {
        return "", ErrInvalidCredentials
    }
    token, tokenHash := auth.NewOpaqueToken()
    err = s.sessions.CreateAdminSession(ctx, admin.ID, tokenHash, s.now().Add(s.ttl))
    if err != nil {
        return "", err
    }
    return token, nil
}
```

- [ ] **Step 4: Implement admin list/detail/status handlers**

```go
r.Route("/admin", func(r chi.Router) {
    r.Use(adminauth.Middleware(sessionRepo))
    r.Get("/registrations", adminRegistrationHandler.List)
    r.Get("/registrations/{registrationID}", adminRegistrationHandler.GetByID)
    r.Post("/registrations/{registrationID}/status", adminRegistrationHandler.UpdateStatus)
})
```

- [ ] **Step 5: Re-run admin tests**

Run: `go test ./tests/integration -run TestAdmin -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add internal/repository/admin_repository.go internal/service/admin_auth_service.go internal/service/admin_registration_service.go internal/http/handlers/admin_auth_handler.go internal/http/handlers/admin_registration_handler.go internal/http/middleware/admin_auth.go tests/integration/admin_flow_test.go
git commit -m "feat: add admin auth and registration management endpoints"
```

### Task 9: Implement name tag PDF generation and admin download endpoints

**Files:**
- Create: `internal/pdf/name_tag.go`
- Create: `internal/service/name_tag_service.go`
- Create: `tests/unit/name_tag_test.go`
- Modify: `internal/http/handlers/admin_registration_handler.go`
- Modify: `tests/integration/admin_flow_test.go`

- [ ] **Step 1: Write the failing PDF unit test**

```go
func TestGenerateNameTagPDF(t *testing.T) {
    pdfBytes, err := pdf.GenerateNameTag(pdf.Input{
        FullName: "Ada Lovelace",
        Organization: "Analytical Engine Club",
        ReferenceCode: "REG-20260512-8X4KQ",
    })
    if err != nil {
        t.Fatal(err)
    }
    if len(pdfBytes) == 0 {
        t.Fatal("expected non-empty pdf")
    }
}
```

- [ ] **Step 2: Run the PDF test**

Run: `go test ./tests/unit -run TestGenerateNameTagPDF -v`
Expected: FAIL due to missing generator

- [ ] **Step 3: Implement PDF generator**

```go
func GenerateNameTag(input Input) ([]byte, error) {
    doc := gofpdf.New("P", "mm", "A6", "")
    doc.AddPage()
    doc.SetFont("Arial", "B", 24)
    doc.Cell(0, 20, input.FullName)
    doc.Ln(12)
    doc.SetFont("Arial", "", 14)
    doc.Cell(0, 10, input.Organization)
    doc.Ln(10)
    doc.Cell(0, 10, input.ReferenceCode)
    var buf bytes.Buffer
    err := doc.Output(&buf)
    return buf.Bytes(), err
}
```

- [ ] **Step 4: Wire PDF and document-download admin endpoints**

```go
r.Get("/admin/registrations/{registrationID}/documents/{documentID}/download", adminRegistrationHandler.DownloadDocument)
r.Get("/admin/registrations/{registrationID}/name-tag.pdf", adminRegistrationHandler.DownloadNameTag)
```

- [ ] **Step 5: Re-run admin and PDF tests**

Run: `go test ./tests/unit/... ./tests/integration/...`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add internal/pdf internal/service/name_tag_service.go internal/http/handlers/admin_registration_handler.go tests/unit/name_tag_test.go tests/integration/admin_flow_test.go
git commit -m "feat: add name tag pdf generation"
```

### Task 10: Add audit logging, seed admin tooling, and deployment documentation

**Files:**
- Create: `internal/repository/audit_repository.go`
- Create: `internal/audit/logger.go`
- Modify: `internal/service/registration_service.go`
- Modify: `internal/service/document_service.go`
- Modify: `internal/service/admin_auth_service.go`
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `Makefile`

- [ ] **Step 1: Add audit write helper**

```go
type AuditLogger interface {
    Log(ctx context.Context, actorType string, actorID *uuid.UUID, registrationID *uuid.UUID, action string, details any) error
}
```

- [ ] **Step 2: Log key business actions**

```go
_ = s.audit.Log(ctx, "applicant", &reg.ID, &reg.ID, "registration.created", map[string]any{
    "reference_code": reg.ReferenceCode,
})
```

- [ ] **Step 3: Add admin seeding command to README**

```bash
go run ./cmd/api seed-admin \
  --username admin \
  --email admin@example.com \
  --display-name "Exam Admin" \
  --password "admin12345"
```

- [ ] **Step 4: Document Render deployment**

```text
1. Create Render Postgres
2. Create Render web service from the backend repo
3. Attach persistent disk at /var/lib/event-register
4. Set DATABASE_URL and UPLOAD_ROOT=/var/lib/event-register/uploads
5. Run migrations before first smoke test
```

- [ ] **Step 5: Run the full backend test suite**

Run: `go test ./...`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add internal/repository/audit_repository.go internal/audit internal/service README.md .env.example Makefile
git commit -m "chore: add audit logging and deployment docs"
```

## Backend Test Checklist

- [ ] `go test ./tests/unit/...`
- [ ] `go test ./tests/integration/...`
- [ ] `go test ./...`
- [ ] `curl localhost:8080/healthz`
- [ ] submit a multipart registration manually with `curl` or Postman
- [ ] verify files appear under the configured upload root
- [ ] verify applicant login and update flow manually
- [ ] verify admin list/detail/pdf flow manually

## Backend Deployment Checklist

- [ ] Create managed Postgres on Render
- [ ] Create backend web service on Render
- [ ] Mount persistent disk
- [ ] Set `UPLOAD_ROOT` to the mounted persistent path
- [ ] Set all environment variables from `.env.example`
- [ ] Run migrations on the target database
- [ ] Seed the first admin account
- [ ] Smoke-test registration, applicant edit, admin list, and PDF download
