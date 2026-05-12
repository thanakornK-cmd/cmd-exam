package http

import (
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/thanakornK-cmd/cmd-exam/backend/internal/auth"
	"github.com/thanakornK-cmd/cmd-exam/backend/internal/config"
	"github.com/thanakornK-cmd/cmd-exam/backend/internal/domain"
	"github.com/thanakornK-cmd/cmd-exam/backend/internal/pdf"
	"github.com/thanakornK-cmd/cmd-exam/backend/internal/storage"
	"github.com/thanakornK-cmd/cmd-exam/backend/internal/store"
)

type Server struct {
	cfg     config.Config
	store   *store.Store
	storage *storage.Filesystem
}

type contextKey string

const registrationIDKey contextKey = "registrationID"
const adminIDKey contextKey = "adminID"

func NewServer(cfg config.Config, st *store.Store) *Server {
	return &Server{cfg: cfg, store: st, storage: storage.New(cfg.UploadRoot)}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(cors)
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	r.Route("/api/v1", func(r chi.Router) {
		r.Post("/registrations", s.createRegistration)
		r.Post("/applicant-sessions", s.applicantLogin)
		r.Post("/applicant-sessions/logout", s.applicantLogout)
		r.Group(func(r chi.Router) {
			r.Use(s.requireApplicant)
			r.Get("/me/registration", s.getMe)
			r.Patch("/me/registration", s.patchMe)
			r.Post("/me/documents", s.addDocuments)
			r.Post("/me/documents/{documentID}/replace", s.replaceDocument)
			r.Get("/me/documents/{documentID}/download", s.downloadMyDocument)
		})
		r.Post("/admin-sessions", s.adminLogin)
		r.Post("/admin-sessions/logout", s.adminLogout)
		r.Group(func(r chi.Router) {
			r.Use(s.requireAdmin)
			r.Get("/admin/registrations", s.adminList)
			r.Get("/admin/registrations/{registrationID}", s.adminGet)
			r.Get("/admin/registrations/{registrationID}/documents/{documentID}/download", s.adminDownloadDocument)
			r.Get("/admin/registrations/{registrationID}/name-tag.pdf", s.adminNameTag)
			r.Post("/admin/registrations/{registrationID}/status", s.adminStatus)
		})
	})
	return r
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type createRegistrationRequest struct {
	FullName              string `json:"full_name"`
	Email                 string `json:"email"`
	Phone                 string `json:"phone"`
	Organization          string `json:"organization"`
	JobTitle              string `json:"job_title"`
	DietaryRestrictions   string `json:"dietary_restrictions"`
	EmergencyContactName  string `json:"emergency_contact_name"`
	EmergencyContactPhone string `json:"emergency_contact_phone"`
	Notes                 string `json:"notes"`
	Password              string `json:"password"`
}

func (s *Server) createRegistration(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	req := createRegistrationRequest{
		FullName:              r.FormValue("full_name"),
		Email:                 r.FormValue("email"),
		Phone:                 r.FormValue("phone"),
		Organization:          r.FormValue("organization"),
		JobTitle:              r.FormValue("job_title"),
		DietaryRestrictions:   r.FormValue("dietary_restrictions"),
		EmergencyContactName:  r.FormValue("emergency_contact_name"),
		EmergencyContactPhone: r.FormValue("emergency_contact_phone"),
		Notes:                 r.FormValue("notes"),
		Password:              r.FormValue("password"),
	}
	if req.FullName == "" || req.Email == "" || req.Phone == "" || len(req.Password) < 8 {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"error": "validation_failed",
			"errors": []map[string]string{
				{"field": "full_name", "message": "full_name, email, phone and password(8+) are required"},
			},
		})
		return
	}
	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	reg := store.NewRegistration(passwordHash, domain.Registration{
		FullName:              req.FullName,
		Email:                 req.Email,
		Phone:                 req.Phone,
		Organization:          req.Organization,
		JobTitle:              req.JobTitle,
		DietaryRestrictions:   req.DietaryRestrictions,
		EmergencyContactName:  req.EmergencyContactName,
		EmergencyContactPhone: req.EmergencyContactPhone,
		Notes:                 req.Notes,
	})
	created, err := s.store.CreateRegistration(reg)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	for _, fileHeader := range r.MultipartForm.File["documents[]"] {
		if err := s.saveDocument(created.ID, fileHeader, ""); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
	}
	_ = s.store.CreateAudit("applicant", created.ID, created.ID, "registration.created", map[string]interface{}{"reference_code": created.ReferenceCode})
	writeJSON(w, http.StatusCreated, map[string]any{
		"registration_id": created.ID,
		"reference_code":  created.ReferenceCode,
		"submitted_at":    created.CreatedAt,
	})
}

func (s *Server) applicantLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ReferenceCode string `json:"reference_code"`
		Password      string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	reg, session, err := s.store.AuthenticateApplicant(req.ReferenceCode, req.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": session.Token, "registration_id": reg.ID})
}

func (s *Server) applicantLogout(w http.ResponseWriter, r *http.Request) {
	_ = s.store.RevokeSession(bearerToken(r))
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) getMe(w http.ResponseWriter, r *http.Request) {
	regID := r.Context().Value(registrationIDKey).(string)
	reg, err := s.store.RegistrationByID(regID)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, http.StatusOK, reg)
}

func (s *Server) patchMe(w http.ResponseWriter, r *http.Request) {
	regID := r.Context().Value(registrationIDKey).(string)
	reg, err := s.store.RegistrationByID(regID)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	var req createRegistrationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	reg.FullName = coalesce(req.FullName, reg.FullName)
	reg.Email = coalesce(req.Email, reg.Email)
	reg.Phone = coalesce(req.Phone, reg.Phone)
	reg.Organization = req.Organization
	reg.JobTitle = req.JobTitle
	reg.DietaryRestrictions = req.DietaryRestrictions
	reg.EmergencyContactName = req.EmergencyContactName
	reg.EmergencyContactPhone = req.EmergencyContactPhone
	reg.Notes = req.Notes
	reg.UpdatedAt = time.Now().UTC()
	updated, err := s.store.UpdateRegistration(reg)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	_ = s.store.CreateAudit("applicant", regID, regID, "registration.updated", map[string]interface{}{})
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) addDocuments(w http.ResponseWriter, r *http.Request) {
	regID := r.Context().Value(registrationIDKey).(string)
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	for _, fileHeader := range r.MultipartForm.File["documents[]"] {
		if err := s.saveDocument(regID, fileHeader, ""); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
	}
	_ = s.store.CreateAudit("applicant", regID, regID, "documents.added", map[string]interface{}{})
	writeJSON(w, http.StatusCreated, map[string]bool{"ok": true})
}

func (s *Server) replaceDocument(w http.ResponseWriter, r *http.Request) {
	regID := r.Context().Value(registrationIDKey).(string)
	documentID := chi.URLParam(r, "documentID")
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	files := r.MultipartForm.File["document"]
	if len(files) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "document field is required"})
		return
	}
	if err := s.saveDocument(regID, files[0], documentID); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	_ = s.store.CreateAudit("applicant", regID, regID, "document.replaced", map[string]interface{}{"document_id": documentID})
	writeJSON(w, http.StatusCreated, map[string]bool{"ok": true})
}

func (s *Server) downloadMyDocument(w http.ResponseWriter, r *http.Request) {
	regID := r.Context().Value(registrationIDKey).(string)
	documentID := chi.URLParam(r, "documentID")
	s.downloadDocument(w, r, regID, documentID)
}

func (s *Server) adminLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Identifier string `json:"identifier"`
		Password   string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	admin, session, err := s.store.AuthenticateAdmin(req.Identifier, req.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err)
		return
	}
	_ = s.store.CreateAudit("admin", admin.ID, "", "admin.login", map[string]interface{}{})
	writeJSON(w, http.StatusOK, map[string]any{"token": session.Token, "admin_id": admin.ID, "display_name": admin.DisplayName})
}

func (s *Server) adminLogout(w http.ResponseWriter, r *http.Request) {
	_ = s.store.RevokeSession(bearerToken(r))
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) adminList(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if pageSize < 1 {
		pageSize = 20
	}
	search := r.URL.Query().Get("search")
	items := s.store.ListRegistrations(search)
	start := (page - 1) * pageSize
	if start > len(items) {
		start = len(items)
	}
	end := start + pageSize
	if end > len(items) {
		end = len(items)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"items":      items[start:end],
		"page":       page,
		"page_size":  pageSize,
		"total":      len(items),
		"totalPages": (len(items) + pageSize - 1) / pageSize,
	})
}

func (s *Server) adminGet(w http.ResponseWriter, r *http.Request) {
	regID := chi.URLParam(r, "registrationID")
	reg, err := s.store.RegistrationByID(regID)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, http.StatusOK, reg)
}

func (s *Server) adminDownloadDocument(w http.ResponseWriter, r *http.Request) {
	s.downloadDocument(w, r, chi.URLParam(r, "registrationID"), chi.URLParam(r, "documentID"))
}

func (s *Server) adminNameTag(w http.ResponseWriter, r *http.Request) {
	reg, err := s.store.RegistrationByID(chi.URLParam(r, "registrationID"))
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	content, err := pdf.GenerateNameTag(pdf.Input{
		FullName:      reg.FullName,
		Organization:  reg.Organization,
		ReferenceCode: reg.ReferenceCode,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"name-tag-%s.pdf\"", reg.ReferenceCode))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(content)
}

func (s *Server) adminStatus(w http.ResponseWriter, r *http.Request) {
	reg, err := s.store.RegistrationByID(chi.URLParam(r, "registrationID"))
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if req.Status == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "status is required"})
		return
	}
	reg.Status = req.Status
	reg.UpdatedAt = time.Now().UTC()
	updated, err := s.store.UpdateRegistration(reg)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) requireApplicant(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, err := s.store.SessionByToken(bearerToken(r), "applicant")
		if err != nil {
			writeError(w, http.StatusUnauthorized, err)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), registrationIDKey, session.ActorID)))
	})
}

func (s *Server) requireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, err := s.store.SessionByToken(bearerToken(r), "admin")
		if err != nil {
			writeError(w, http.StatusUnauthorized, err)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), adminIDKey, session.ActorID)))
	})
}

func bearerToken(r *http.Request) string {
	header := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if len(header) > len(prefix) && header[:len(prefix)] == prefix {
		return header[len(prefix):]
	}
	return ""
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func coalesce(value, fallback string) string {
	if value != "" {
		return value
	}
	return fallback
}

func (s *Server) saveDocument(registrationID string, fileHeader *multipart.FileHeader, replacedDocumentID string) error {
	file, err := fileHeader.Open()
	if err != nil {
		return err
	}
	defer file.Close()
	stored, err := s.storage.Save(registrationID, fileHeader.Filename, file)
	if err != nil {
		return err
	}
	doc := domain.Document{
		ID:                 uuid.NewString(),
		RegistrationID:     registrationID,
		DocumentType:       "supporting_document",
		OriginalFilename:   fileHeader.Filename,
		StoredFilename:     stored.StoredFilename,
		StoragePath:        stored.StoragePath,
		MIMEType:           fileHeader.Header.Get("Content-Type"),
		FileSizeBytes:      stored.SizeBytes,
		ReplacedDocumentID: replacedDocumentID,
		CreatedAt:          time.Now().UTC(),
	}
	if replacedDocumentID != "" {
		return s.store.ReplaceDocument(registrationID, replacedDocumentID, doc)
	}
	return s.store.AddDocument(registrationID, doc)
}

func (s *Server) downloadDocument(w http.ResponseWriter, r *http.Request, registrationID, documentID string) {
	doc, err := s.store.DocumentByID(registrationID, documentID)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	file, err := s.storage.Open(doc.StoragePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	defer file.Close()
	w.Header().Set("Content-Type", doc.MIMEType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", doc.OriginalFilename))
	http.ServeContent(w, r, doc.OriginalFilename, doc.CreatedAt, file)
}
