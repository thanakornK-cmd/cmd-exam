# Event Registration System Design

## Overview

This project will be implemented as two coordinated repositories:

- a Go backend API responsible for business logic, persistence, file storage, authentication, and PDF generation
- a Next.js frontend responsible for user/admin interfaces and a BFF layer that proxies browser requests to the backend API

The system supports the complete journey defined in `README.md`:

- attendee submits a registration with files and a password
- system returns a reference code
- attendee logs back in with reference code and password
- attendee edits fields, replaces documents, and uploads new documents
- admin logs in
- admin reviews all registrations
- admin opens a registration detail page
- admin downloads a name tag PDF

## Goals

- Deliver a simple, credible architecture optimized for fast implementation and demo reliability
- Keep backend and frontend responsibilities clearly separated
- Use deployment choices that minimize infrastructure complexity
- Define concrete API contracts, data model, repo structure, and test scope

## Constraints And Assumptions

- Two repositories, not a monorepo
- Backend language: Go
- Frontend framework: Next.js
- Frontend includes a BFF layer using Next.js route handlers
- Database: Postgres
- File storage: local filesystem on the backend host
- Admin authentication uses an `admins` table in Postgres
- Deployment target:
  - frontend on Vercel
  - backend on Render with persistent disk
  - Postgres on Render

## Architecture

### Backend

The backend is a REST API implemented in Go. It owns:

- request validation and business rules
- Postgres schema and queries
- password hashing
- applicant and admin session creation/validation
- reference code generation
- uploaded file persistence on local disk
- document metadata persistence in Postgres
- audit logging
- name tag PDF generation

Recommended backend stack:

- Go 1.22+
- `chi` for routing
- `pgx` and `sqlc` for Postgres access
- `go-playground/validator` for input validation
- `bcrypt` for password hashing
- opaque session tokens stored in Postgres
- `gofpdf` or equivalent library for PDF generation

### Frontend

The frontend is a Next.js application that owns:

- public registration flow
- applicant self-service flow
- admin UI
- BFF route handlers
- session cookies for applicant and admin flows
- form validation and display logic
- UX-level error mapping

The browser should talk only to the Next.js application. The frontend BFF proxies requests to the Go backend and keeps backend session details away from browser code.

### Data Flow

1. User submits registration form to the Next.js BFF
2. BFF forwards multipart request to Go backend
3. Backend validates fields, writes registration row, stores files, creates document metadata, hashes password, generates reference code
4. Backend returns reference code and summary
5. User logs in later with reference code and password through the BFF
6. BFF stores applicant session in secure HTTP-only cookies
7. User views and edits their registration through BFF-proxied endpoints
8. Admin logs in through the BFF and receives an admin session cookie
9. Admin pages consume BFF endpoints that proxy list/detail/download actions to the backend

## Deployment

### Frontend

- Platform: Vercel
- Hosts the Next.js app and BFF route handlers
- Uses environment variables for backend base URL and frontend session secrets

### Backend

- Platform: Render web service
- Requires persistent disk mounted for uploaded files
- Uses environment variables for database connection, storage path, session secrets, and admin bootstrapping

### Database

- Platform: Render Postgres
- Stores registrations, admins, sessions, documents metadata, and audit logs

### Why This Deployment

This setup is the easiest deployable version that still supports the required file-edit and PDF flows:

- Vercel is the easiest option for Next.js
- Go API on Render can keep a persistent filesystem volume
- managed Postgres on the same backend platform keeps configuration simpler

## Data Model

### `registrations`

Stores one registration per attendee.

Suggested fields:

- `id`
- `reference_code`
- `full_name`
- `email`
- `phone`
- `organization`
- `job_title`
- `dietary_restrictions`
- `emergency_contact_name`
- `emergency_contact_phone`
- `notes`
- `password_hash`
- `status`
- `created_at`
- `updated_at`

### `registration_documents`

Stores metadata for uploaded files.

Suggested fields:

- `id`
- `registration_id`
- `document_type`
- `original_filename`
- `stored_filename`
- `storage_path`
- `mime_type`
- `file_size_bytes`
- `replaced_document_id`
- `created_at`

### `admins`

Stores admin identities.

Suggested fields:

- `id`
- `username`
- `email`
- `display_name`
- `password_hash`
- `is_active`
- `last_login_at`
- `created_at`
- `updated_at`

### `admin_sessions`

Stores admin sessions using opaque tokens.

Suggested fields:

- `id`
- `admin_id`
- `token_hash`
- `expires_at`
- `created_at`
- `revoked_at`

### `applicant_sessions`

Stores applicant self-service sessions.

Suggested fields:

- `id`
- `registration_id`
- `token_hash`
- `expires_at`
- `created_at`
- `revoked_at`

### `audit_logs`

Stores meaningful system actions.

Suggested fields:

- `id`
- `actor_type`
- `actor_id`
- `registration_id`
- `action`
- `details_json`
- `created_at`

### Data Handling Rules

- `reference_code` must be unique and human-readable
- passwords are stored only as bcrypt hashes
- replacing a document creates a new metadata row linked to the old document
- stored filenames must be generated by the backend, not derived directly from user input
- file metadata in Postgres is the source of truth for download and replacement flows

## API Specification

Base path: `/api/v1`

### Public Registration

#### `POST /registrations`

Creates a registration and uploads supporting documents.

Request:

- content type: `multipart/form-data`
- text fields:
  - `full_name`
  - `email`
  - `phone`
  - `organization`
  - `job_title`
  - `dietary_restrictions`
  - `emergency_contact_name`
  - `emergency_contact_phone`
  - `notes`
  - `password`
- file fields:
  - `documents[]`

Success response:

- `201 Created`
- body:
  - `registration_id`
  - `reference_code`
  - `submitted_at`

Validation rules:

- required: `full_name`, `email`, `phone`, `password`
- password length minimum should be explicit in implementation plan, recommended `8`
- allow multiple document uploads

### Applicant Authentication

#### `POST /applicant-sessions`

Authenticates applicant using reference code and password.

Request JSON:

```json
{
  "reference_code": "REG-20260512-8X4KQ",
  "password": "secret123"
}
```

Success response:

- `200 OK`
- session token returned for BFF-managed cookie flow

Failure responses:

- `401 Unauthorized` for invalid credentials
- `404 Not Found` if registration does not exist, if the product chooses to distinguish that case

#### `POST /applicant-sessions/logout`

Invalidates the current applicant session.

### Applicant Self-Service

#### `GET /me/registration`

Returns the authenticated applicant's current registration and documents.

#### `PATCH /me/registration`

Updates editable registration fields.

Editable fields:

- `full_name`
- `email`
- `phone`
- `organization`
- `job_title`
- `dietary_restrictions`
- `emergency_contact_name`
- `emergency_contact_phone`
- `notes`

#### `POST /me/documents`

Adds one or more new documents for the authenticated applicant.

#### `POST /me/documents/{documentId}/replace`

Replaces a specific existing document with a new upload and preserves history.

#### `GET /me/documents/{documentId}/download`

Downloads a document owned by the authenticated applicant.

### Admin Authentication

#### `POST /admin-sessions`

Authenticates an admin using username or email plus password.

#### `POST /admin-sessions/logout`

Invalidates the current admin session.

### Admin Registration Management

#### `GET /admin/registrations`

Returns paginated registrations for admin review.

Recommended query params:

- `page`
- `page_size`
- `search`
- `status`

Response should include:

- registration summary rows
- total count
- pagination info

#### `GET /admin/registrations/{registrationId}`

Returns complete registration detail:

- attendee fields
- uploaded documents
- timestamps
- audit summary

#### `GET /admin/registrations/{registrationId}/documents/{documentId}/download`

Downloads any document belonging to the selected registration.

#### `GET /admin/registrations/{registrationId}/name-tag.pdf`

Generates and downloads the attendee name tag PDF.

#### `POST /admin/registrations/{registrationId}/status`

Optional lightweight review state update.

Request JSON:

```json
{
  "status": "reviewed"
}
```

## Frontend Routes And User Journey

### Public / Applicant Pages

- `/register`
  - registration form
  - password setup
  - multi-file upload
- `/register/success`
  - confirmation page
  - displays reference code and return instructions
- `/lookup`
  - applicant login with reference code and password
- `/submission`
  - view current registration and document list
- `/submission/edit`
  - edit registration fields
  - add new documents
  - replace existing documents

### Admin Pages

- `/admin/login`
  - admin authentication
- `/admin/registrations`
  - registration list page with search and pagination
- `/admin/registrations/[id]`
  - registration detail page
  - download document actions
  - download name tag PDF action

## Repository Structure

### Backend Repository

Suggested repo name: `event-register-backend`

```text
cmd/api/
internal/config/
internal/db/
internal/domain/
internal/repository/
internal/service/
internal/http/handlers/
internal/http/middleware/
internal/auth/
internal/storage/
internal/pdf/
internal/audit/
migrations/
sql/
tests/
docs/
```

Responsibilities:

- `cmd/api`: application startup and dependency wiring
- `internal/config`: environment parsing and validation
- `internal/db`: connection pool and transaction helpers
- `internal/domain`: domain structs and enums
- `internal/repository`: SQL-backed data access
- `internal/service`: business workflows
- `internal/http/handlers`: HTTP endpoint handlers
- `internal/http/middleware`: auth, logging, recovery, request ID
- `internal/auth`: hashing and token/session helpers
- `internal/storage`: local filesystem storage adapter
- `internal/pdf`: name tag rendering
- `internal/audit`: audit event creation
- `migrations`: schema migrations
- `sql`: sqlc query definitions
- `tests`: integration and endpoint tests

### Frontend Repository

Suggested repo name: `event-register-frontend`

```text
src/app/
src/app/(public)/register/
src/app/(public)/lookup/
src/app/(public)/submission/
src/app/admin/login/
src/app/admin/registrations/
src/app/admin/registrations/[id]/
src/app/api/
src/components/
src/features/registration/
src/features/admin/
src/features/auth/
src/lib/api/
src/lib/validation/
src/lib/session/
src/types/
public/
tests/
```

Responsibilities:

- `src/app/*`: route segments and page shells
- `src/app/api/*`: BFF route handlers that proxy to Go
- `src/components`: shared UI components
- `src/features/registration`: public/applicant screens and hooks
- `src/features/admin`: admin list/detail features
- `src/features/auth`: applicant/admin auth UI and helpers
- `src/lib/api`: backend API clients used by the BFF
- `src/lib/validation`: request and form schemas
- `src/lib/session`: cookie/session management
- `src/types`: DTOs and frontend domain types
- `tests`: unit/component/e2e tests

## Error Handling

### Backend

- invalid input returns structured validation errors
- unauthorized access returns `401`
- missing resource returns `404`
- forbidden cross-registration document access returns `403`
- failed file write should roll back metadata persistence where appropriate
- failed metadata write after file write should trigger cleanup of orphaned file when possible

### Frontend

- BFF normalizes backend error payloads into field-level and page-level messages
- session expiry redirects user/admin to the correct login page
- upload failures should preserve typed form data
- download failures should surface a clear retryable error

## Testing Strategy

### Backend

- unit tests for:
  - reference code generation
  - password hashing and verification
  - session creation and validation
  - PDF input/output sanity
- repository tests against Postgres for:
  - registration persistence
  - document replacement flows
  - admin authentication queries
  - pagination and search
- API integration tests for:
  - registration submission
  - applicant login
  - applicant edit flow
  - document upload and replacement
  - admin login
  - admin list/detail
  - name tag PDF generation endpoint

### Frontend

- unit tests for:
  - form validation
  - cookie/session helpers
  - API error mapping
- component tests for:
  - registration form
  - lookup form
  - admin login form
- e2e tests for the full judging flow:
  - submit registration with files
  - capture reference code
  - log back in with reference code and password
  - edit fields
  - add or replace documents
  - admin login
  - open registration detail
  - download name tag PDF

## Scope Boundaries

To keep implementation focused, the first version should not include:

- email notifications
- password reset flow
- multiple admin roles
- direct browser-to-object-storage uploads
- multi-event event management
- rich review workflow beyond a simple status field

## Success Criteria

The implementation satisfies the README if a reviewer can:

1. open the deployed frontend URL
2. submit a registration with files
3. receive a reference code
4. return using the reference code and password
5. edit fields and documents successfully
6. log in as an admin
7. browse registrations
8. open registration detail
9. download a name tag PDF

## Plan Outputs Required Next

Two implementation plans should be written next:

- `backend-plan.md`
- `frontend-plan.md`

Each plan should include:

- architecture summary
- project structure
- detailed API and data responsibilities
- implementation phases
- task checklist
- test checklist
- deployment checklist
