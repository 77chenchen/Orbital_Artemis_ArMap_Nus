package atlas

import (
	"context"
	"database/sql"
	"strings"
)

func (s *Store) searchUserDB(ctx context.Context, cred Credentials) (bool, error) {

	var hash string
	err := s.db.QueryRowContext(ctx, `
		SELECT password FROM credentials WHERE email = ?
	`, cred.Email).Scan(&hash)
	if err != nil {
		return false, err
	}

	// compare password
	return validatePassword(hash, cred.Password), nil

}

func (s *Store) userExists(ctx context.Context, cred Credentials) (bool, error) {
	var exists bool
	err := s.db.QueryRowContext(ctx,
		`SELECT EXISTS(SELECT 1 FROM credentials WHERE email = ?)`,
		cred.Email,
	).Scan(&exists)

	if err != nil {
		return false, err
	}

	return exists, nil
}

func (s *Store) securityQuestionForEmail(ctx context.Context, email string) (string, error) {
	var question string
	err := s.db.QueryRowContext(ctx, `
		SELECT security_question FROM credentials WHERE email = ?
	`, strings.TrimSpace(email)).Scan(&question)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", ErrNotFound
		}
		return "", err
	}
	if strings.TrimSpace(question) == "" {
		return "", ErrNotFound
	}
	return question, nil
}

func (s *Store) resetPasswordWithSecurityAnswer(ctx context.Context, cred Credentials) (bool, error) {
	var answerHash string
	err := s.db.QueryRowContext(ctx, `
		SELECT security_answer FROM credentials WHERE email = ?
	`, strings.TrimSpace(cred.Email)).Scan(&answerHash)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, ErrNotFound
		}
		return false, err
	}
	if answerHash == "" || !validatePassword(answerHash, normalizeSecurityAnswer(cred.SecurityAnswer)) {
		return false, nil
	}
	_, err = s.db.ExecContext(ctx, `
		UPDATE credentials SET password = ? WHERE email = ?
	`, hash(cred.Password), strings.TrimSpace(cred.Email))
	if err != nil {
		return false, err
	}
	return true, nil
}

func normalizeSecurityAnswer(answer string) string {
	return strings.ToLower(strings.TrimSpace(answer))
}
