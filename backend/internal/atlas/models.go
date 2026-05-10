package atlas

import "time"

type Building struct {
	ID              int64     `json:"id"`
	Code            string    `json:"code"`
	Name            string    `json:"name"`
	Description     string    `json:"description"`
	Latitude        float64   `json:"latitude"`
	Longitude       float64   `json:"longitude"`
	Floors          int       `json:"floors"`
	SupportedIndoor bool      `json:"supportedIndoor"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type Facility struct {
	ID           int64     `json:"id"`
	BuildingID   int64     `json:"buildingId"`
	BuildingCode string    `json:"buildingCode"`
	Floor        string    `json:"floor"`
	Name         string    `json:"name"`
	Type         string    `json:"type"`
	Description  string    `json:"description"`
	CrowdLevel   string    `json:"crowdLevel"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type ScheduleItem struct {
	ID         int64     `json:"id"`
	Title      string    `json:"title"`
	ModuleCode string    `json:"moduleCode"`
	Location   string    `json:"location"`
	StartAt    time.Time `json:"startAt"`
	EndAt      time.Time `json:"endAt"`
	Notes      string    `json:"notes"`
	CreatedAt  time.Time `json:"createdAt"`
}

type Recommendation struct {
	Kind        string  `json:"kind"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Location    string  `json:"location"`
	DistanceM   float64 `json:"distanceM"`
	Priority    int     `json:"priority"`
}

type SyncStatus struct {
	ID           int64     `json:"id"`
	Source       string    `json:"source"`
	Status       string    `json:"status"`
	RecordsSeen  int       `json:"recordsSeen"`
	ErrorMessage string    `json:"errorMessage,omitempty"`
	StartedAt    time.Time `json:"startedAt"`
	FinishedAt   time.Time `json:"finishedAt"`
}
