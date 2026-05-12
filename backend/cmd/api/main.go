package main

import (
	"log"
	"net/http"

	"github.com/thanakornK-cmd/cmd-exam/backend/internal/config"
	httpapi "github.com/thanakornK-cmd/cmd-exam/backend/internal/http"
	"github.com/thanakornK-cmd/cmd-exam/backend/internal/store"
)

func main() {
	cfg := config.Load()
	st, err := store.New(cfg)
	if err != nil {
		log.Fatalf("init store: %v", err)
	}

	handler := httpapi.NewServer(cfg, st).Router()
	log.Printf("backend listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, handler); err != nil {
		log.Fatal(err)
	}
}
