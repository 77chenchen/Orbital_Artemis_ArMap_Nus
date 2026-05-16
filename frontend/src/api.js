export const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8080/api');

const demoBuildings = [
  {
    id: 1,
    code: 'COM1',
    name: 'Computing 1',
    description: 'School of Computing teaching rooms and labs.',
    latitude: 1.2948,
    longitude: 103.7739,
    floors: 6,
    supportedIndoor: true,
  },
  {
    id: 2,
    code: 'CLB',
    name: 'Central Library',
    description: 'Library, study spaces, and central campus facilities.',
    latitude: 1.2966,
    longitude: 103.7723,
    floors: 5,
    supportedIndoor: true,
  },
  {
    id: 3,
    code: 'UTOWN',
    name: 'University Town',
    description: 'Residential colleges, seminar rooms, food, and open study areas.',
    latitude: 1.305,
    longitude: 103.7739,
    floors: 4,
    supportedIndoor: false,
  },
];

const demoFacilities = [
  {
    id: 1,
    buildingId: 1,
    buildingCode: 'COM1',
    floor: '2',
    name: 'COM1-0201 Study Area',
    type: 'study_space',
    description: 'Quiet tables near the programming labs.',
    crowdLevel: 'medium',
  },
  {
    id: 2,
    buildingId: 1,
    buildingCode: 'COM1',
    floor: '1',
    name: 'Lift Lobby',
    type: 'lift',
    description: 'Main lift access for teaching rooms.',
    crowdLevel: 'low',
  },
  {
    id: 3,
    buildingId: 2,
    buildingCode: 'CLB',
    floor: '4',
    name: 'Reading Room',
    type: 'study_space',
    description: 'Large quiet study area with power access.',
    crowdLevel: 'high',
  },
  {
    id: 4,
    buildingId: 2,
    buildingCode: 'CLB',
    floor: '1',
    name: 'Printing Corner',
    type: 'printing',
    description: 'Printer and scanner station near the entrance.',
    crowdLevel: 'medium',
  },
];

const demoRecommendations = [
  {
    kind: 'route',
    title: 'Leave for COM1',
    description: 'Indoor route detected. You still have time for the lift handoff.',
    location: 'COM1',
    distanceM: 180,
    priority: 1,
  },
  {
    kind: 'focus',
    title: 'Focus session ready',
    description: 'A 25 minute block opens after your first lecture.',
    location: 'CLB',
    distanceM: 240,
    priority: 2,
  },
];

let demoSchedule = [
  {
    id: 1,
    title: 'Project meeting',
    moduleCode: 'CP2106',
    location: 'COM1',
    startAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    endAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    notes: 'Discuss Atlas demo scope',
  },
];

let demoSyncStatus = {
  id: 1,
  source: 'nusmods',
  status: 'demo_ready',
  recordsSeen: 42,
  errorMessage: '',
  finishedAt: new Date().toISOString(),
};

async function request(path, options = {}) {
  const token = localStorage.getItem("token");
  if (token === "demo-mode") {
    return demoRequest(path, options);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed with ${response.status}`);
  }

  return data;
}

function demoRequest(path, options = {}) {
  if (path === '/health') return Promise.resolve({ status: 'ok', mode: 'demo' });
  if (path === '/buildings') return Promise.resolve(demoBuildings);
  if (path.startsWith('/facilities')) {
    const url = new URL(`https://demo.local${path}`);
    const building = url.searchParams.get('building');
    const type = url.searchParams.get('type');
    return Promise.resolve(
      demoFacilities.filter(
        (facility) =>
          (!building || facility.buildingCode === building) &&
          (!type || facility.type === type),
      ),
    );
  }
  if (path === '/schedule' && options.method === 'POST') {
    const body = JSON.parse(options.body || '{}');
    const item = { ...body, id: Date.now() };
    demoSchedule = [...demoSchedule, item];
    return Promise.resolve(item);
  }
  if (path === '/schedule') return Promise.resolve(demoSchedule);
  if (path.startsWith('/schedule/') && options.method === 'DELETE') {
    const id = Number(path.split('/').pop());
    demoSchedule = demoSchedule.filter((item) => item.id !== id);
    return Promise.resolve(null);
  }
  if (path.startsWith('/recommendations')) return Promise.resolve(demoRecommendations);
  if (path === '/sync/status') return Promise.resolve(demoSyncStatus);
  if (path === '/sync/run' && options.method === 'POST') {
    demoSyncStatus = {
      ...demoSyncStatus,
      status: 'demo_synced',
      recordsSeen: demoSyncStatus.recordsSeen + 6,
      finishedAt: new Date().toISOString(),
    };
    return Promise.resolve(demoSyncStatus);
  }
  return Promise.reject(new Error('Unsupported demo request'));
}
export const api = {
  health: () => request('/health'),
  buildings: () => request('/buildings'),
  facilities: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.building) params.set('building', filters.building);
    if (filters.type) params.set('type', filters.type);
    const suffix = params.toString() ? `?${params}` : '';
    return request(`/facilities${suffix}`);
  },
  schedule: () => request('/schedule'),
  createSchedule: (item) => request('/schedule', { method: 'POST', body: JSON.stringify(item) }),
  deleteSchedule: (id) => request(`/schedule/${id}`, { method: 'DELETE' }),
  recommendations: () => request('/recommendations?lat=1.2966&lng=103.7764'),
  syncStatus: () => request('/sync/status'),
  runSync: () => request('/sync/run', { method: 'POST' }),
};
