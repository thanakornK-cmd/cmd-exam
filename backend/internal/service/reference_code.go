package service

import (
	"fmt"
	"math/rand"
	"time"
)

const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

func GenerateReferenceCode(now time.Time) string {
	suffix := make([]byte, 5)
	for i := range suffix {
		suffix[i] = charset[rand.Intn(len(charset))]
	}
	return fmt.Sprintf("REG-%s-%s", now.Format("20060102"), string(suffix))
}
