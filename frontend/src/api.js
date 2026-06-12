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

const demoAssistantReply = {
  success: false,
  reply:
    'Assistant fallback:\n1. Review your next scheduled item.\n2. Pick one priority that fits the available time.\n3. Leave a travel buffer before moving across campus.\n4. Add the suggested focus block if it fits.',
  scheduleItems: [
    {
      title: 'Focus block',
      moduleCode: 'TASK',
      location: 'CLB',
      startAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      endAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      notes: 'Demo fallback schedule suggestion',
    },
  ],
  provider: 'demo',
  model: 'local-fallback',
  error: 'Demo mode uses a local fallback response',
};

const demoBusStops = [
  { code: 'COM2', name: 'COM 2', latitude: 1.29486, longitude: 103.77388, source: 'demo' },
  { code: 'CLB', name: 'Central Library', latitude: 1.29661, longitude: 103.77234, source: 'demo' },
  { code: 'YIH', name: 'Yusof Ishak House', latitude: 1.29854, longitude: 103.77406, source: 'demo' },
  { code: 'UTOWN', name: 'University Town', latitude: 1.30483, longitude: 103.77382, source: 'demo' },
  { code: 'KR-MRT', name: 'Kent Ridge MRT', latitude: 1.29234, longitude: 103.78499, source: 'demo' },
  { code: 'PGP', name: "Prince George's Park", latitude: 1.29094, longitude: 103.78022, source: 'demo' },
];

const demoBusRoutes = [
  { code: 'A1', name: 'A1', color: '#E04F5F', description: 'Kent Ridge MRT, Central Library, UTown loop' },
  { code: 'A2', name: 'A2', color: '#2F80ED', description: 'Reverse campus loop' },
  { code: 'D1', name: 'D1', color: '#27AE60', description: 'COM and UTown connector' },
  { code: 'D2', name: 'D2', color: '#F2C94C', description: 'PGP and campus connector' },
];

const demoRouteStops = {
  A1: ['KR-MRT', 'CLB', 'YIH', 'UTOWN'],
  A2: ['UTOWN', 'YIH', 'CLB', 'KR-MRT'],
  D1: ['COM2', 'CLB', 'UTOWN'],
  D2: ['PGP', 'COM2', 'YIH'],
};

const demoBusArrivals = {
  COM2: [
    { routeCode: 'D1', arrivalTime: '2', nextArrivalTime: '8', arrivalMinutes: [2, 8], crowdLevel: 'medium', vehiclePlate: 'PC1234A' },
    { routeCode: 'A1', arrivalTime: '5', nextArrivalTime: '12', arrivalMinutes: [5, 12], crowdLevel: 'low', vehiclePlate: 'PC2345B' },
  ],
  CLB: [
    { routeCode: 'A1', arrivalTime: '3', nextArrivalTime: '10', arrivalMinutes: [3, 10], crowdLevel: 'low', vehiclePlate: 'PC3456C' },
    { routeCode: 'A2', arrivalTime: '6', nextArrivalTime: '14', arrivalMinutes: [6, 14], crowdLevel: 'medium', vehiclePlate: 'PC4567D' },
  ],
  UTOWN: [
    { routeCode: 'D1', arrivalTime: '4', nextArrivalTime: '11', arrivalMinutes: [4, 11], crowdLevel: 'high', vehiclePlate: 'PC5678E' },
    { routeCode: 'A2', arrivalTime: '7', nextArrivalTime: '15', arrivalMinutes: [7, 15], crowdLevel: 'medium', vehiclePlate: 'PC6789F' },
  ],
};

const demoActiveBuses = {
  A1: [
    { plate: 'PC2345B', latitude: 1.2962, longitude: 103.7731, crowdLevel: 'low', occupancy: 0.32 },
    { plate: 'PC3456C', latitude: 1.2928, longitude: 103.7832, crowdLevel: 'medium', occupancy: 0.58 },
  ],
  D1: [
    { plate: 'PC1234A', latitude: 1.2969, longitude: 103.774, crowdLevel: 'medium', occupancy: 0.52 },
    { plate: 'PC5678E', latitude: 1.3035, longitude: 103.7738, crowdLevel: 'high', occupancy: 0.81 },
  ],
};

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
  if (token === "demo-mode" && !path.startsWith('/bus/') && path !== '/agent/daily-assistant') {
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
  if (path === '/bus/stops') return Promise.resolve(demoBusStops);
  if (path === '/bus/routes') return Promise.resolve(demoBusRoutes);
  if (path.startsWith('/bus/pickup-points')) {
    const url = new URL(`https://demo.local${path}`);
    const route = url.searchParams.get('route') || 'D1';
    const routeStops = demoRouteStops[route] || demoRouteStops.D1;
    return Promise.resolve(
      routeStops.map((code, index) => {
        const stop = demoBusStops.find((item) => item.code === code) || demoBusStops[0];
        return {
          routeCode: route,
          seq: index + 1,
          stopCode: stop.code,
          longName: stop.name,
          shortName: stop.code,
          pickupName: stop.name,
          latitude: stop.latitude,
          longitude: stop.longitude,
          source: 'demo',
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  }
  if (path.startsWith('/bus/arrivals')) {
    const url = new URL(`https://demo.local${path}`);
    const stop = url.searchParams.get('stop');
    return Promise.resolve({
      stopCode: stop,
      stopName: demoBusStops.find((item) => item.code === stop)?.name || stop,
      routes: demoBusArrivals[stop] || [{ routeCode: 'A1', arrivalMinutes: [5, 13], crowdLevel: 'low' }],
      source: 'demo',
      updatedAt: new Date().toISOString(),
    });
  }
  if (path.startsWith('/bus/active')) {
    const url = new URL(`https://demo.local${path}`);
    const route = url.searchParams.get('route');
    return Promise.resolve({
      routeCode: route,
      vehicles: demoActiveBuses[route] || [],
      source: 'demo',
      updatedAt: new Date().toISOString(),
    });
  }
  if (path === '/bus/alerts') return Promise.resolve([]);
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
  if (path === '/agent/daily-assistant' && options.method === 'POST') {
    return Promise.resolve(demoAssistantReply);
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
  busStops: () => request('/bus/stops'),
  busRoutes: () => request('/bus/routes'),
  busPickupPoints: (route) => request(`/bus/pickup-points?route=${encodeURIComponent(route)}`),
  busArrivals: (stop) => request(`/bus/arrivals?stop=${encodeURIComponent(stop)}`),
  activeBus: (route) => request(`/bus/active?route=${encodeURIComponent(route)}`),
  busAlerts: () => request('/bus/alerts'),
  syncStatus: () => request('/sync/status'),
  runSync: () => request('/sync/run', { method: 'POST' }),
  dailyAssistant: (payload) =>
    request('/agent/daily-assistant', { method: 'POST', body: JSON.stringify(payload) }),
};
