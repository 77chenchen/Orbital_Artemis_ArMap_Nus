package atlas

import (
	"context"
	"errors"
	"strings"
)

func (s *Store) registerIntoDB(ctx context.Context, cred Credentials) error {
	// check if credentials are not empty first
	if strings.TrimSpace(cred.Email) == "" || cred.Password == "" {
		return errors.New("invalid credentials")
	}
	question := strings.TrimSpace(cred.SecurityQuestion)
	answer := normalizeSecurityAnswer(cred.SecurityAnswer)
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO credentials (email, password, security_question, security_answer) VALUES (?, ?, ?, ?)`,
		strings.TrimSpace(cred.Email), hash(cred.Password), question, hash(answer),
	)
	return err
}
