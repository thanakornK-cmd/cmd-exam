package domain

import "time"

type AuditLog struct {
	ID             string                 `json:"id"`
	ActorType      string                 `json:"actor_type"`
	ActorID        string                 `json:"actor_id,omitempty"`
	RegistrationID string                 `json:"registration_id,omitempty"`
	Action         string                 `json:"action"`
	Details        map[string]interface{} `json:"details"`
	CreatedAt      time.Time              `json:"created_at"`
}
