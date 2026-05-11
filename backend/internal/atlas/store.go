package atlas

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"time"
	"database/sql"
	_ "modernc.org/sqlite"
)

var ErrNotFound = errors.New("not found")

type Store struct {
	path string
	db 	 *sql.DB // for easier reference to db
}

func OpenStore(path string) (*Store, error) {
	if _, err := exec.LookPath("sqlite3"); err != nil {
		return nil, errors.New("sqlite3 CLI is required for the demo backend")
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err 
	}
	return &Store{path: path, db: db}, nil
}

func (s *Store) Close() error {
	return nil
}

func (s *Store) Migrate(ctx context.Context) error {
	return s.execSQL(ctx, `
		PRAGMA foreign_keys = ON;
		CREATE TABLE IF NOT EXISTS buildings (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			code TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL,
			description TEXT NOT NULL,
			latitude REAL NOT NULL,
			longitude REAL NOT NULL,
			floors INTEGER NOT NULL,
			supported_indoor INTEGER NOT NULL DEFAULT 0,
			updated_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS facilities (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
			floor TEXT NOT NULL,
			name TEXT NOT NULL,
			type TEXT NOT NULL,
			description TEXT NOT NULL,
			crowd_level TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS schedule_items (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			module_code TEXT NOT NULL,
			location TEXT NOT NULL,
			start_at TEXT NOT NULL,
			end_at TEXT NOT NULL,
			notes TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS api_syncs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			source TEXT NOT NULL,
			status TEXT NOT NULL,
			records_seen INTEGER NOT NULL DEFAULT 0,
			error_message TEXT NOT NULL DEFAULT '',
			started_at TEXT NOT NULL,
			finished_at TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS credentials (
			email TEXT NOT NULL,
			password TEXT NOT NULL
		);
	`)
}

func (s *Store) Seed(ctx context.Context) error {
	var rows []struct {
		Count int `json:"count"`
	}
	if err := s.queryJSON(ctx, `SELECT COUNT(*) AS count FROM buildings;`, &rows); err != nil {
		return err
	}
	if len(rows) > 0 && rows[0].Count > 0 {
		return s.ensureFutureSchedule(ctx)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	start := time.Now().UTC().Truncate(time.Hour).Add(2 * time.Hour)
	sql := fmt.Sprintf(`
		BEGIN;
		INSERT INTO buildings (code, name, description, latitude, longitude, floors, supported_indoor, updated_at) VALUES
			('COM1', 'Computing 1', 'School of Computing teaching rooms and labs.', 1.2948, 103.7739, 6, 1, %s),
			('CLB', 'Central Library', 'Library, study spaces, and central campus facilities.', 1.2966, 103.7723, 5, 1, %s),
			('UTOWN', 'University Town', 'Residential colleges, seminar rooms, food, and open study areas.', 1.3050, 103.7739, 4, 0, %s);
		INSERT INTO facilities (building_id, floor, name, type, description, crowd_level, updated_at)
			SELECT id, '2', 'COM1-0201 Study Area', 'study_space', 'Quiet tables near the programming labs.', 'medium', %s FROM buildings WHERE code = 'COM1';
		INSERT INTO facilities (building_id, floor, name, type, description, crowd_level, updated_at)
			SELECT id, '1', 'Lift Lobby', 'lift', 'Main lift access for teaching rooms.', 'low', %s FROM buildings WHERE code = 'COM1';
		INSERT INTO facilities (building_id, floor, name, type, description, crowd_level, updated_at)
			SELECT id, '3', 'Restrooms near Seminar Rooms', 'restroom', 'Closest restrooms for seminar clusters.', 'low', %s FROM buildings WHERE code = 'COM1';
		INSERT INTO facilities (building_id, floor, name, type, description, crowd_level, updated_at)
			SELECT id, '4', 'Reading Room', 'study_space', 'Large quiet study area with power access.', 'high', %s FROM buildings WHERE code = 'CLB';
		INSERT INTO facilities (building_id, floor, name, type, description, crowd_level, updated_at)
			SELECT id, '1', 'Printing Corner', 'printing', 'Printer and scanner station near the entrance.', 'medium', %s FROM buildings WHERE code = 'CLB';
		INSERT INTO facilities (building_id, floor, name, type, description, crowd_level, updated_at)
			SELECT id, '1', 'Open Plaza Tables', 'study_space', 'Casual outdoor study and meeting tables.', 'low', %s FROM buildings WHERE code = 'UTOWN';
		INSERT INTO schedule_items (title, module_code, location, start_at, end_at, notes, created_at)
			VALUES ('Project meeting', 'CP2106', 'COM1', %s, %s, 'Discuss Atlas demo scope', %s);
		INSERT INTO credentials (email, password)
			VALUES ('test1@gmail.com', %s);
		COMMIT;
	`, sqlQuote(now), sqlQuote(now), sqlQuote(now), sqlQuote(now), sqlQuote(now), sqlQuote(now), sqlQuote(now), sqlQuote(now), sqlQuote(now), sqlQuote(start.Format(time.RFC3339)), sqlQuote(start.Add(time.Hour).Format(time.RFC3339)), sqlQuote(now), 
	sqlQuote(hash("cp2106")),
)
	if err := s.execSQL(ctx, sql); err != nil {
		return err
	}
	return s.ensureFutureSchedule(ctx)
}

func (s *Store) ensureFutureSchedule(ctx context.Context) error {
	now := time.Now().UTC()
	var rows []struct {
		Count int `json:"count"`
	}
	if err := s.queryJSON(ctx, fmt.Sprintf(`SELECT COUNT(*) AS count FROM schedule_items WHERE start_at > %s;`, sqlQuote(now.Format(time.RFC3339))), &rows); err != nil {
		return err
	}
	if len(rows) > 0 && rows[0].Count > 0 {
		return nil
	}
	start := now.Truncate(time.Hour).Add(2 * time.Hour)
	return s.execSQL(ctx, fmt.Sprintf(`INSERT INTO schedule_items
		(title, module_code, location, start_at, end_at, notes, created_at)
		VALUES ('Project meeting', 'CP2106', 'COM1', %s, %s, 'Discuss Atlas demo scope', %s);`,
		sqlQuote(start.Format(time.RFC3339)), sqlQuote(start.Add(time.Hour).Format(time.RFC3339)), sqlQuote(now.Format(time.RFC3339))))
}

func (s *Store) ListBuildings(ctx context.Context) ([]Building, error) {
	var rows []struct {
		ID              int64   `json:"id"`
		Code            string  `json:"code"`
		Name            string  `json:"name"`
		Description     string  `json:"description"`
		Latitude        float64 `json:"latitude"`
		Longitude       float64 `json:"longitude"`
		Floors          int     `json:"floors"`
		SupportedIndoor int     `json:"supported_indoor"`
		UpdatedAt       string  `json:"updated_at"`
	}
	if err := s.queryJSON(ctx, `SELECT id, code, name, description, latitude, longitude, floors, supported_indoor, updated_at FROM buildings ORDER BY name;`, &rows); err != nil {
		return nil, err
	}
	buildings := make([]Building, 0, len(rows))
	for _, row := range rows {
		updatedAt, err := time.Parse(time.RFC3339, row.UpdatedAt)
		if err != nil {
			return nil, err
		}
		buildings = append(buildings, Building{
			ID: row.ID, Code: row.Code, Name: row.Name, Description: row.Description,
			Latitude: row.Latitude, Longitude: row.Longitude, Floors: row.Floors,
			SupportedIndoor: row.SupportedIndoor == 1, UpdatedAt: updatedAt,
		})
	}
	return buildings, nil
}

func (s *Store) ListFacilities(ctx context.Context, buildingCode, facilityType string) ([]Facility, error) {
	query := `SELECT f.id, f.building_id, b.code AS building_code, f.floor, f.name, f.type, f.description, f.crowd_level, f.updated_at
		FROM facilities f
		JOIN buildings b ON b.id = f.building_id`
	var clauses []string
	if buildingCode != "" {
		clauses = append(clauses, "b.code = "+sqlQuote(strings.ToUpper(buildingCode)))
	}
	if facilityType != "" {
		clauses = append(clauses, "f.type = "+sqlQuote(facilityType))
	}
	if len(clauses) > 0 {
		query += " WHERE " + strings.Join(clauses, " AND ")
	}
	query += " ORDER BY b.code, f.floor, f.name;"

	var rows []struct {
		ID           int64  `json:"id"`
		BuildingID   int64  `json:"building_id"`
		BuildingCode string `json:"building_code"`
		Floor        string `json:"floor"`
		Name         string `json:"name"`
		Type         string `json:"type"`
		Description  string `json:"description"`
		CrowdLevel   string `json:"crowd_level"`
		UpdatedAt    string `json:"updated_at"`
	}
	if err := s.queryJSON(ctx, query, &rows); err != nil {
		return nil, err
	}
	facilities := make([]Facility, 0, len(rows))
	for _, row := range rows {
		updatedAt, err := time.Parse(time.RFC3339, row.UpdatedAt)
		if err != nil {
			return nil, err
		}
		facilities = append(facilities, Facility{
			ID: row.ID, BuildingID: row.BuildingID, BuildingCode: row.BuildingCode,
			Floor: row.Floor, Name: row.Name, Type: row.Type, Description: row.Description,
			CrowdLevel: row.CrowdLevel, UpdatedAt: updatedAt,
		})
	}
	return facilities, nil
}

func (s *Store) ListSchedule(ctx context.Context) ([]ScheduleItem, error) {
	var rows []scheduleRow
	if err := s.queryJSON(ctx, `SELECT id, title, module_code, location, start_at, end_at, notes, created_at FROM schedule_items ORDER BY start_at;`, &rows); err != nil {
		return nil, err
	}
	return scheduleRows(rows)
}

func (s *Store) CreateScheduleItem(ctx context.Context, item ScheduleItem) (ScheduleItem, error) {
	if err := validateScheduleItem(item); err != nil {
		return ScheduleItem{}, err
	}
	now := time.Now().UTC()
	query := fmt.Sprintf(`INSERT INTO schedule_items
		(title, module_code, location, start_at, end_at, notes, created_at)
		VALUES (%s, %s, %s, %s, %s, %s, %s)
		RETURNING id;`,
		sqlQuote(item.Title),
		sqlQuote(strings.ToUpper(item.ModuleCode)),
		sqlQuote(strings.ToUpper(item.Location)),
		sqlQuote(item.StartAt.UTC().Format(time.RFC3339)),
		sqlQuote(item.EndAt.UTC().Format(time.RFC3339)),
		sqlQuote(item.Notes),
		sqlQuote(now.Format(time.RFC3339)),
	)
	var rows []struct {
		ID int64 `json:"id"`
	}
	if err := s.queryJSON(ctx, query, &rows); err != nil {
		return ScheduleItem{}, err
	}
	if len(rows) == 0 {
		return ScheduleItem{}, errors.New("schedule insert did not return an id")
	}
	item.ID = rows[0].ID
	item.ModuleCode = strings.ToUpper(item.ModuleCode)
	item.Location = strings.ToUpper(item.Location)
	item.CreatedAt = now
	return item, nil
}

func (s *Store) DeleteScheduleItem(ctx context.Context, id int64) error {
	var rows []struct {
		Changed int `json:"changed"`
	}
	if err := s.queryJSON(ctx, fmt.Sprintf(`DELETE FROM schedule_items WHERE id = %d; SELECT changes() AS changed;`, id), &rows); err != nil {
		return err
	}
	if len(rows) == 0 || rows[0].Changed == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) LatestSyncStatus(ctx context.Context) (SyncStatus, error) {
	var rows []struct {
		ID           int64  `json:"id"`
		Source       string `json:"source"`
		Status       string `json:"status"`
		RecordsSeen  int    `json:"records_seen"`
		ErrorMessage string `json:"error_message"`
		StartedAt    string `json:"started_at"`
		FinishedAt   string `json:"finished_at"`
	}
	if err := s.queryJSON(ctx, `SELECT id, source, status, records_seen, error_message, started_at, finished_at
		FROM api_syncs ORDER BY finished_at DESC, id DESC LIMIT 1;`, &rows); err != nil {
		return SyncStatus{}, err
	}
	if len(rows) == 0 {
		return SyncStatus{}, ErrNotFound
	}
	startedAt, err := time.Parse(time.RFC3339, rows[0].StartedAt)
	if err != nil {
		return SyncStatus{}, err
	}
	finishedAt, err := time.Parse(time.RFC3339, rows[0].FinishedAt)
	if err != nil {
		return SyncStatus{}, err
	}
	return SyncStatus{
		ID: rows[0].ID, Source: rows[0].Source, Status: rows[0].Status,
		RecordsSeen: rows[0].RecordsSeen, ErrorMessage: rows[0].ErrorMessage,
		StartedAt: startedAt, FinishedAt: finishedAt,
	}, nil
}

func (s *Store) RecordSync(ctx context.Context, status SyncStatus) error {
	return s.execSQL(ctx, fmt.Sprintf(`INSERT INTO api_syncs
		(source, status, records_seen, error_message, started_at, finished_at)
		VALUES (%s, %s, %d, %s, %s, %s);`,
		sqlQuote(status.Source), sqlQuote(status.Status), status.RecordsSeen, sqlQuote(status.ErrorMessage),
		sqlQuote(status.StartedAt.UTC().Format(time.RFC3339)), sqlQuote(status.FinishedAt.UTC().Format(time.RFC3339))))
}

func (s *Store) Recommendations(ctx context.Context, lat, lng float64, now time.Time) ([]Recommendation, error) {
	buildings, err := s.ListBuildings(ctx)
	if err != nil {
		return nil, err
	}
	facilities, err := s.ListFacilities(ctx, "", "study_space")
	if err != nil {
		return nil, err
	}
	schedule, err := s.ListSchedule(ctx)
	if err != nil {
		return nil, err
	}

	buildingByCode := map[string]Building{}
	for _, b := range buildings {
		buildingByCode[b.Code] = b
	}

	recs := []Recommendation{}
	for _, item := range schedule {
		if item.StartAt.After(now) {
			b := buildingByCode[strings.ToUpper(item.Location)]
			recs = append(recs, Recommendation{
				Kind:        "next_class",
				Title:       "Next stop: " + item.Title,
				Description: fmt.Sprintf("%s starts at %s. Leave a buffer for indoor navigation.", item.ModuleCode, item.StartAt.Local().Format("15:04")),
				Location:    item.Location,
				DistanceM:   haversine(lat, lng, b.Latitude, b.Longitude),
				Priority:    1,
			})
			break
		}
	}

	for _, facility := range facilities {
		if facility.CrowdLevel == "high" {
			continue
		}
		b := buildingByCode[facility.BuildingCode]
		recs = append(recs, Recommendation{
			Kind:        "facility",
			Title:       facility.Name,
			Description: fmt.Sprintf("%s crowd level. Floor %s in %s.", facility.CrowdLevel, facility.Floor, facility.BuildingCode),
			Location:    facility.BuildingCode,
			DistanceM:   haversine(lat, lng, b.Latitude, b.Longitude),
			Priority:    2,
		})
		if len(recs) >= 4 {
			break
		}
	}
	return recs, nil
}

type scheduleRow struct {
	ID         int64  `json:"id"`
	Title      string `json:"title"`
	ModuleCode string `json:"module_code"`
	Location   string `json:"location"`
	StartAt    string `json:"start_at"`
	EndAt      string `json:"end_at"`
	Notes      string `json:"notes"`
	CreatedAt  string `json:"created_at"`
}

func scheduleRows(rows []scheduleRow) ([]ScheduleItem, error) {
	items := make([]ScheduleItem, 0, len(rows))
	for _, row := range rows {
		startAt, err := time.Parse(time.RFC3339, row.StartAt)
		if err != nil {
			return nil, err
		}
		endAt, err := time.Parse(time.RFC3339, row.EndAt)
		if err != nil {
			return nil, err
		}
		createdAt, err := time.Parse(time.RFC3339, row.CreatedAt)
		if err != nil {
			return nil, err
		}
		items = append(items, ScheduleItem{
			ID: row.ID, Title: row.Title, ModuleCode: row.ModuleCode, Location: row.Location,
			StartAt: startAt, EndAt: endAt, Notes: row.Notes, CreatedAt: createdAt,
		})
	}
	return items, nil
}

func validateScheduleItem(item ScheduleItem) error {
	if strings.TrimSpace(item.Title) == "" {
		return errors.New("title is required")
	}
	if strings.TrimSpace(item.ModuleCode) == "" {
		return errors.New("moduleCode is required")
	}
	if strings.TrimSpace(item.Location) == "" {
		return errors.New("location is required")
	}
	if item.StartAt.IsZero() || item.EndAt.IsZero() {
		return errors.New("startAt and endAt are required")
	}
	if !item.EndAt.After(item.StartAt) {
		return errors.New("endAt must be after startAt")
	}
	return nil
}

func (s *Store) execSQL(ctx context.Context, sql string) error {
	cmd := exec.CommandContext(ctx, "sqlite3", s.path, sql)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("sqlite exec: %w: %s", err, strings.TrimSpace(string(output)))
	}
	return nil
}

func (s *Store) queryJSON(ctx context.Context, sql string, dest any) error {
	cmd := exec.CommandContext(ctx, "sqlite3", "-json", s.path, sql)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("sqlite query: %w: %s", err, strings.TrimSpace(string(output)))
	}
	if len(strings.TrimSpace(string(output))) == 0 {
		output = []byte("[]")
	}
	return json.Unmarshal(output, dest)
}

func sqlQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "''") + "'"
}
