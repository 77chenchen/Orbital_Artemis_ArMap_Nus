package atlas

type Credentials struct {
	Email            string `json:"email"`
	Password         string `json:"password"`
	SecurityQuestion string `json:"securityQuestion"`
	SecurityAnswer   string `json:"securityAnswer"`
}
