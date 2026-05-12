package store

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/thanakornK-cmd/cmd-exam/backend/internal/auth"
	"github.com/thanakornK-cmd/cmd-exam/backend/internal/config"
	"github.com/thanakornK-cmd/cmd-exam/backend/internal/domain"
	"github.com/thanakornK-cmd/cmd-exam/backend/internal/service"
)

var ErrNotFound = errors.New("not found")
var ErrInvalidCredentials = errors.New("invalid credentials")
var ErrForbidden = errors.New("forbidden")

type State struct {
	Registrations map[string]domain.Registration `json:"registrations"`
	Admins        map[string]domain.Admin        `json:"admins"`
	Sessions      map[string]domain.Session      `json:"sessions"`
	AuditLogs     []domain.AuditLog              `json:"audit_logs"`
}

type Store struct {
	mu        sync.RWMutex
	cfg       config.Config
	statePath string
	state     State
}

func New(cfg config.Config) (*Store, error) {
	if err := os.MkdirAll(cfg.DataRoot, 0o755); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(cfg.UploadRoot, 0o755); err != nil {
		return nil, err
	}
	st := &Store{
		cfg:       cfg,
		statePath: filepath.Join(cfg.DataRoot, "state.json"),
		state: State{
			Registrations: map[string]domain.Registration{},
			Admins:        map[string]domain.Admin{},
			Sessions:      map[string]domain.Session{},
			AuditLogs:     []domain.AuditLog{},
		},
	}
	if err := st.load(); err != nil {
		return nil, err
	}
	if err := st.seedAdmin(); err != nil {
		return nil, err
	}
	return st, nil
}

func (s *Store) load() error {
	data, err := os.ReadFile(s.statePath)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	return json.Unmarshal(data, &s.state)
}

func (s *Store) saveLocked() error {
	data, err := json.MarshalIndent(s.state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.statePath, data, 0o644)
}

func (s *Store) seedAdmin() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, admin := range s.state.Admins {
		if admin.Username == s.cfg.AdminUsername || admin.Email == s.cfg.AdminEmail {
			return nil
		}
	}
	hash, err := auth.HashPassword(s.cfg.AdminPassword)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	admin := domain.Admin{
		ID:           uuid.NewString(),
		Username:     s.cfg.AdminUsername,
		Email:        s.cfg.AdminEmail,
		DisplayName:  s.cfg.AdminDisplayName,
		PasswordHash: hash,
		IsActive:     true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	s.state.Admins[admin.ID] = admin
	return s.saveLocked()
}

func (s *Store) CreateRegistration(reg domain.Registration) (domain.Registration, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.state.Registrations[reg.ID] = reg
	if err := s.saveLocked(); err != nil {
		return domain.Registration{}, err
	}
	return reg, nil
}

func (s *Store) UpdateRegistration(reg domain.Registration) (domain.Registration, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.state.Registrations[reg.ID]; !ok {
		return domain.Registration{}, ErrNotFound
	}
	s.state.Registrations[reg.ID] = reg
	if err := s.saveLocked(); err != nil {
		return domain.Registration{}, err
	}
	return reg, nil
}

func (s *Store) RegistrationByReferenceCode(referenceCode string) (domain.Registration, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, reg := range s.state.Registrations {
		if reg.ReferenceCode == referenceCode {
			return reg, nil
		}
	}
	return domain.Registration{}, ErrNotFound
}

func (s *Store) RegistrationByID(id string) (domain.Registration, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	reg, ok := s.state.Registrations[id]
	if !ok {
		return domain.Registration{}, ErrNotFound
	}
	return reg, nil
}

func (s *Store) ListRegistrations(search string) []domain.Registration {
	s.mu.RLock()
	defer s.mu.RUnlock()
	items := make([]domain.Registration, 0, len(s.state.Registrations))
	for _, reg := range s.state.Registrations {
		if search != "" {
			needle := strings.ToLower(search)
			if !strings.Contains(strings.ToLower(reg.FullName), needle) &&
				!strings.Contains(strings.ToLower(reg.Email), needle) &&
				!strings.Contains(strings.ToLower(reg.ReferenceCode), needle) {
				continue
			}
		}
		items = append(items, reg)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].CreatedAt.After(items[j].CreatedAt)
	})
	return items
}

func (s *Store) AddDocument(registrationID string, doc domain.Document) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	reg, ok := s.state.Registrations[registrationID]
	if !ok {
		return ErrNotFound
	}
	reg.Documents = append(reg.Documents, doc)
	reg.UpdatedAt = time.Now().UTC()
	s.state.Registrations[registrationID] = reg
	return s.saveLocked()
}

func (s *Store) ReplaceDocument(registrationID, documentID string, replacement domain.Document) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	reg, ok := s.state.Registrations[registrationID]
	if !ok {
		return ErrNotFound
	}
	found := false
	for _, existing := range reg.Documents {
		if existing.ID == documentID {
			replacement.ReplacedDocumentID = existing.ID
			found = true
			break
		}
	}
	if !found {
		return ErrNotFound
	}
	reg.Documents = append(reg.Documents, replacement)
	reg.UpdatedAt = time.Now().UTC()
	s.state.Registrations[registrationID] = reg
	return s.saveLocked()
}

func (s *Store) DocumentByID(registrationID, documentID string) (domain.Document, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	reg, ok := s.state.Registrations[registrationID]
	if !ok {
		return domain.Document{}, ErrNotFound
	}
	for _, doc := range reg.Documents {
		if doc.ID == documentID {
			return doc, nil
		}
	}
	return domain.Document{}, ErrNotFound
}

func (s *Store) CreateSession(actorType, actorID string, ttl time.Duration) (domain.Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	token, err := auth.NewToken()
	if err != nil {
		return domain.Session{}, err
	}
	now := time.Now().UTC()
	session := domain.Session{
		ID:        uuid.NewString(),
		ActorType: actorType,
		ActorID:   actorID,
		Token:     token,
		ExpiresAt: now.Add(ttl),
		CreatedAt: now,
	}
	s.state.Sessions[token] = session
	if err := s.saveLocked(); err != nil {
		return domain.Session{}, err
	}
	return session, nil
}

func (s *Store) SessionByToken(token, actorType string) (domain.Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	session, ok := s.state.Sessions[token]
	if !ok || session.ActorType != actorType {
		return domain.Session{}, ErrInvalidCredentials
	}
	if time.Now().UTC().After(session.ExpiresAt) {
		return domain.Session{}, ErrInvalidCredentials
	}
	return session, nil
}

func (s *Store) RevokeSession(token string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.state.Sessions[token]
	if !ok {
		return nil
	}
	session.RevokedAt = time.Now().UTC()
	delete(s.state.Sessions, token)
	return s.saveLocked()
}

func (s *Store) AuthenticateApplicant(referenceCode, password string) (domain.Registration, domain.Session, error) {
	reg, err := s.RegistrationByReferenceCode(referenceCode)
	if err != nil {
		return domain.Registration{}, domain.Session{}, ErrInvalidCredentials
	}
	if err := auth.ComparePassword(reg.PasswordHash, password); err != nil {
		return domain.Registration{}, domain.Session{}, ErrInvalidCredentials
	}
	session, err := s.CreateSession("applicant", reg.ID, 24*time.Hour)
	if err != nil {
		return domain.Registration{}, domain.Session{}, err
	}
	return reg, session, nil
}

func (s *Store) AuthenticateAdmin(identifier, password string) (domain.Admin, domain.Session, error) {
	var matched domain.Admin
	s.mu.RLock()
	for _, admin := range s.state.Admins {
		if (admin.Username == identifier || admin.Email == identifier) && admin.IsActive {
			if err := auth.ComparePassword(admin.PasswordHash, password); err != nil {
				s.mu.RUnlock()
				return domain.Admin{}, domain.Session{}, ErrInvalidCredentials
			}
			matched = admin
			break
		}
	}
	s.mu.RUnlock()
	if matched.ID == "" {
		return domain.Admin{}, domain.Session{}, ErrInvalidCredentials
	}
	session, err := s.CreateSession("admin", matched.ID, 12*time.Hour)
	return matched, session, err
}

func (s *Store) CreateAudit(actorType, actorID, registrationID, action string, details map[string]interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.state.AuditLogs = append(s.state.AuditLogs, domain.AuditLog{
		ID:             uuid.NewString(),
		ActorType:      actorType,
		ActorID:        actorID,
		RegistrationID: registrationID,
		Action:         action,
		Details:        details,
		CreatedAt:      time.Now().UTC(),
	})
	return s.saveLocked()
}

func NewRegistration(passwordHash string, input domain.Registration) domain.Registration {
	now := time.Now().UTC()
	input.ID = uuid.NewString()
	input.ReferenceCode = service.GenerateReferenceCode(now)
	input.PasswordHash = passwordHash
	input.Status = "submitted"
	input.CreatedAt = now
	input.UpdatedAt = now
	return input
}
