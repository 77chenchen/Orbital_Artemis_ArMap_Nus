package atlas

import (
	"context"
	"errors"
)

func (s *Store) registerIntoDB(ctx context.Context, cred Credentials) error {
	// check if credentials are not empty first
	if cred.Email == "" || cred.Password == "" {
		return errors.New("invalid credentials")
	}
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO credentials (email, password) VALUES (?, ?)`,
		cred.Email, hash(cred.Password),
	)
	return err
}