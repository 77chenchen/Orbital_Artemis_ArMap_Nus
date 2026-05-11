package atlas

import (
	"log"
	"golang.org/x/crypto/bcrypt"
)

func hash(p string) string {
	hashed, err := bcrypt.GenerateFromPassword(
		[]byte(p),
		bcrypt.DefaultCost,
	)
	if err != nil {
		log.Fatal(err)
	}
	return string(hashed)
}

func validatePassword(hash string, p string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(p))
	if err != nil {
		return false
	}
	return true
}