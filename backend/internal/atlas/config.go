package atlas

import "time"

type Config struct {
	Port              string
	DBPath            string
	AllowedOrigin     string
	StaticDir         string
	JWTSecret         string
	NUSModsAcadYear   string
	SyncInterval      time.Duration
	HTTPClientTimeout time.Duration
}
