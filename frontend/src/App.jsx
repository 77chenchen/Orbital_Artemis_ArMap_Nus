import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const facilityTypes = [
  { value: '', label: 'All' },
  { value: 'study_space', label: 'Study' },
  { value: 'restroom', label: 'Restroom' },
  { value: 'lift', label: 'Lift' },
  { value: 'printing', label: 'Printing' },
];

const emptyForm = {
  title: '',
  moduleCode: '',
  location: 'COM1',
  startAt: '',
  endAt: '',
  notes: '',
};

export default function App() {
  const [health, setHealth] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [filters, setFilters] = useState({ building: '', type: '' });
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const buildingByCode = useMemo(
    () => Object.fromEntries(buildings.map((building) => [building.code, building])),
    [buildings],
  );

  async function loadAll() {
    setError('');
    try {
      const [healthData, buildingData, scheduleData, recData, syncData] = await Promise.all([
        api.health(),
        api.buildings(),
        api.schedule(),
        api.recommendations(),
        api.syncStatus(),
      ]);
      setHealth(healthData);
      setBuildings(buildingData);
      setSchedule(scheduleData);
      setRecommendations(recData);
      setSyncStatus(syncData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadFacilities(nextFilters = filters) {
    try {
      setFacilities(await api.facilities(nextFilters));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadFacilities(filters);
  }, [filters.building, filters.type]);

  async function submitSchedule(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      await api.createSchedule({
        ...form,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
      });
      setForm(emptyForm);
      setNotice('Schedule item saved.');
      const [scheduleData, recData] = await Promise.all([api.schedule(), api.recommendations()]);
      setSchedule(scheduleData);
      setRecommendations(recData);
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteSchedule(id) {
    setError('');
    try {
      await api.deleteSchedule(id);
      const [scheduleData, recData] = await Promise.all([api.schedule(), api.recommendations()]);
      setSchedule(scheduleData);
      setRecommendations(recData);
    } catch (err) {
      setError(err.message);
    }
  }

  async function runSync() {
    setError('');
    setNotice('');
    try {
      const status = await api.runSync();
      setSyncStatus(status);
      setNotice(`NUSMods sync ${status.status}; records seen: ${status.recordsSeen}.`);
    } catch (err) {
      setError(err.message);
      const status = await api.syncStatus().catch(() => null);
      if (status) setSyncStatus(status);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Orbital Artemis Demo</p>
          <h1>Atlas campus assistant</h1>
        </div>
        <div className={`api-pill ${health ? 'is-online' : ''}`}>
          <span className="status-dot" />
          {health ? 'API online' : loading ? 'Checking API' : 'API offline'}
        </div>
      </header>

      {(notice || error) && (
        <section className={`notice ${error ? 'is-error' : ''}`}>
          {error || notice}
        </section>
      )}

      <section className="dashboard-grid">
        <section className="panel map-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Navigation data</p>
              <h2>Supported campus points</h2>
            </div>
          </div>
          <div className="campus-map" aria-label="Demo campus map">
            {buildings.map((building, index) => (
              <button
                className="map-pin"
                key={building.code}
                style={{ '--x': `${22 + index * 28}%`, '--y': `${62 - index * 16}%` }}
                onClick={() => setFilters((current) => ({ ...current, building: building.code }))}
                title={building.name}
              >
                {building.code}
              </button>
            ))}
            <span className="route-line route-one" />
            <span className="route-line route-two" />
          </div>
          <div className="building-list">
            {buildings.map((building) => (
              <article className="building-row" key={building.code}>
                <div>
                  <strong>{building.code}</strong>
                  <span>{building.name}</span>
                </div>
                <small>{building.supportedIndoor ? 'Indoor ready' : 'Outdoor only'}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Daily agent</p>
              <h2>Recommendations</h2>
            </div>
            <button className="secondary-button" onClick={loadAll}>Refresh</button>
          </div>
          <div className="recommendation-list">
            {recommendations.map((rec) => (
              <article className="recommendation" key={`${rec.kind}-${rec.title}`}>
                <div>
                  <strong>{rec.title}</strong>
                  <p>{rec.description}</p>
                </div>
                <span>{Math.round(rec.distanceM)} m</span>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="work-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Facility discovery</p>
              <h2>Indoor support</h2>
            </div>
          </div>
          <div className="filters">
            <select
              value={filters.building}
              onChange={(event) => setFilters((current) => ({ ...current, building: event.target.value }))}
            >
              <option value="">All buildings</option>
              {buildings.map((building) => (
                <option value={building.code} key={building.code}>{building.code}</option>
              ))}
            </select>
            <div className="segmented">
              {facilityTypes.map((type) => (
                <button
                  key={type.value}
                  className={filters.type === type.value ? 'is-selected' : ''}
                  onClick={() => setFilters((current) => ({ ...current, type: type.value }))}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          <div className="facility-list">
            {facilities.map((facility) => (
              <article className="facility-card" key={facility.id}>
                <div>
                  <strong>{facility.name}</strong>
                  <p>{facility.description}</p>
                </div>
                <div className="facility-meta">
                  <span>{facility.buildingCode} L{facility.floor}</span>
                  <span>{facility.crowdLevel}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Schedule API</p>
              <h2>Student day plan</h2>
            </div>
          </div>
          <form className="schedule-form" onSubmit={submitSchedule}>
            <input
              required
              placeholder="Title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
            <input
              required
              placeholder="Module code"
              value={form.moduleCode}
              onChange={(event) => setForm({ ...form, moduleCode: event.target.value })}
            />
            <select
              value={form.location}
              onChange={(event) => setForm({ ...form, location: event.target.value })}
            >
              {buildings.map((building) => (
                <option value={building.code} key={building.code}>{building.code}</option>
              ))}
            </select>
            <input
              required
              type="datetime-local"
              value={form.startAt}
              onChange={(event) => setForm({ ...form, startAt: event.target.value })}
            />
            <input
              required
              type="datetime-local"
              value={form.endAt}
              onChange={(event) => setForm({ ...form, endAt: event.target.value })}
            />
            <textarea
              placeholder="Notes"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
            <button className="primary-button" type="submit">Save schedule</button>
          </form>
          <div className="schedule-list">
            {schedule.map((item) => (
              <article className="schedule-item" key={item.id}>
                <div>
                  <strong>{item.moduleCode} · {item.title}</strong>
                  <p>{buildingByCode[item.location]?.name || item.location}</p>
                  <small>{formatTime(item.startAt)} to {formatTime(item.endAt)}</small>
                </div>
                <button className="icon-button" onClick={() => deleteSchedule(item.id)} title="Delete schedule item">×</button>
              </article>
            ))}
          </div>
        </section>

        <section className="panel sync-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">External API connection</p>
              <h2>NUSMods sync</h2>
            </div>
            <button className="secondary-button" onClick={runSync}>Run now</button>
          </div>
          <dl className="sync-status">
            <div>
              <dt>Status</dt>
              <dd>{syncStatus?.status || 'never_run'}</dd>
            </div>
            <div>
              <dt>Records seen</dt>
              <dd>{syncStatus?.recordsSeen ?? 0}</dd>
            </div>
            <div>
              <dt>Last finished</dt>
              <dd>{syncStatus?.finishedAt ? formatTime(syncStatus.finishedAt) : 'Not yet'}</dd>
            </div>
          </dl>
          {syncStatus?.errorMessage && <p className="sync-error">{syncStatus.errorMessage}</p>}
        </section>
      </section>
    </main>
  );
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
