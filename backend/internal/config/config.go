package config

import "os"

type Config struct {
	Port                 string
	AppURL               string
	DatabaseURL          string
	UploadRoot           string
	DataRoot             string
	ApplicantSessionName string
	AdminSessionName     string
	AdminUsername        string
	AdminEmail           string
	AdminPassword        string
	AdminDisplayName     string
}

func Load() Config {
	return Config{
		Port:                 getenv("PORT", "8080"),
		AppURL:               getenv("APP_URL", "http://localhost:8080"),
		DatabaseURL:          getenv("DATABASE_URL", ""),
		UploadRoot:           getenv("UPLOAD_ROOT", "./data/uploads"),
		DataRoot:             getenv("DATA_ROOT", "./data"),
		ApplicantSessionName: getenv("APPLICANT_SESSION_NAME", "applicant_session"),
		AdminSessionName:     getenv("ADMIN_SESSION_NAME", "admin_session"),
		AdminUsername:        getenv("ADMIN_USERNAME", "admin"),
		AdminEmail:           getenv("ADMIN_EMAIL", "admin@example.com"),
		AdminPassword:        getenv("ADMIN_PASSWORD", "admin12345"),
		AdminDisplayName:     getenv("ADMIN_DISPLAY_NAME", "Exam Admin"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
