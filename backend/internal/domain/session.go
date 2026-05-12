package domain

import "time"

type Session struct {
	ID        string    `json:"id"`
	ActorType string    `json:"actor_type"`
	ActorID   string    `json:"actor_id"`
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
	RevokedAt time.Time `json:"revoked_at,omitempty"`
}
