package storage

import (
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

type StoredFile struct {
	StoredFilename string
	StoragePath    string
	SizeBytes      int64
}

type Filesystem struct {
	root string
}

func New(root string) *Filesystem {
	return &Filesystem{root: root}
}

func (f *Filesystem) Save(registrationID, filename string, src io.Reader) (StoredFile, error) {
	dir := filepath.Join(f.root, registrationID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return StoredFile{}, err
	}
	ext := filepath.Ext(filename)
	storedFilename := uuid.NewString() + strings.ToLower(ext)
	fullPath := filepath.Join(dir, storedFilename)
	file, err := os.Create(fullPath)
	if err != nil {
		return StoredFile{}, err
	}
	defer file.Close()
	n, err := io.Copy(file, src)
	if err != nil {
		return StoredFile{}, err
	}
	return StoredFile{
		StoredFilename: storedFilename,
		StoragePath:    fullPath,
		SizeBytes:      n,
	}, nil
}

func (f *Filesystem) Open(path string) (*os.File, error) {
	return os.Open(path)
}
