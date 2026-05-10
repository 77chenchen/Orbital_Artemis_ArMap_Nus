package atlas

import (
	"context"
	"log"
	"time"
)

type Scheduler struct {
	store    *Store
	client   *NUSModsClient
	interval time.Duration
}

func NewScheduler(store *Store, client *NUSModsClient, interval time.Duration) *Scheduler {
	return &Scheduler{store: store, client: client, interval: interval}
}

func (s *Scheduler) Start(ctx context.Context) {
	go func() {
		RunNUSModsSync(ctx, s.store, s.client)

		ticker := time.NewTicker(s.interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				RunNUSModsSync(ctx, s.store, s.client)
			}
		}
	}()
}

func RunNUSModsSync(ctx context.Context, store *Store, client *NUSModsClient) SyncStatus {
	started := time.Now().UTC()
	status := SyncStatus{
		Source:    "nusmods_module_list",
		Status:    "running",
		StartedAt: started,
	}
	modules, err := client.FetchModuleList(ctx)
	status.FinishedAt = time.Now().UTC()
	status.RecordsSeen = len(modules)
	if err != nil {
		status.Status = "failed"
		status.ErrorMessage = err.Error()
	} else {
		status.Status = "success"
	}
	if recordErr := store.RecordSync(context.Background(), status); recordErr != nil {
		log.Printf("record sync status: %v", recordErr)
	}
	return status
}
