package atlas

import "time"

type Config struct {
	Port              string
	DBPath            string
	AllowedOrigin     string
	StaticDir         string
	JWTSecret         string
	GoogleClientID    string
	NUSModsAcadYear   string
	NUSBusAuthBase    string
	NUSBusAPIBase     string
	NUSBusXHTDAPI     string
	NUSBusXAPPAPI     string
	NUSBusDeviceID    string
	NUSBusVersion     string
	LLMProvider       string
	LLMAPIKey         string
	LLMBaseURL        string
	LLMModel          string
	SyncInterval      time.Duration
	HTTPClientTimeout time.Duration
}
