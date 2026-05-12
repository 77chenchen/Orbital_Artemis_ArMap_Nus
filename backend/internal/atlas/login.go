package atlas

import (
	"context"
);


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