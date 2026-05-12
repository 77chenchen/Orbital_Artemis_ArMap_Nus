export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

async function request(path, options = {}) {
  const token = localStorage.getItem("token");

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
