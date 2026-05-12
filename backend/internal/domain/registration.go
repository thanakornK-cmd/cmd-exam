package domain

import "time"

type Registration struct {
	ID                    string     `json:"id"`
	ReferenceCode         string     `json:"reference_code"`
	FullName              string     `json:"full_name"`
	Email                 string     `json:"email"`
	Phone                 string     `json:"phone"`
	Organization          string     `json:"organization"`
	JobTitle              string     `json:"job_title"`
	DietaryRestrictions   string     `json:"dietary_restrictions"`
	EmergencyContactName  string     `json:"emergency_contact_name"`
	EmergencyContactPhone string     `json:"emergency_contact_phone"`
	Notes                 string     `json:"notes"`
	PasswordHash          string     `json:"-"`
	Status                string     `json:"status"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
	Documents             []Document `json:"documents,omitempty"`
}
