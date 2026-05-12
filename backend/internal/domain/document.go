package domain

import "time"

type Document struct {
	ID                 string    `json:"id"`
	RegistrationID     string    `json:"registration_id"`
	DocumentType       string    `json:"document_type"`
	OriginalFilename   string    `json:"original_filename"`
	StoredFilename     string    `json:"stored_filename"`
	StoragePath        string    `json:"storage_path"`
	MIMEType           string    `json:"mime_type"`
	FileSizeBytes      int64     `json:"file_size_bytes"`
	ReplacedDocumentID string    `json:"replaced_document_id,omitempty"`
	CreatedAt          time.Time `json:"created_at"`
}
