const BASE = '/api';

async function fetchJSON(url, opts = {}) {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // Stats
  getGlobalStats: () => fetchJSON('/stats/global'),
  getTimeline: (days = 90) => fetchJSON(`/stats/timeline?days=${days}`),
  getTopSources: (limit = 20) => fetchJSON(`/stats/sources?limit=${limit}`),
  getDispositions: () => fetchJSON('/stats/dispositions'),
  getUnauthorized: () => fetchJSON('/stats/unauthorized'),
  getServices: () => fetchJSON('/stats/services'),

  // Reports
  getReports: () => fetchJSON('/reports'),
  getReport: (id) => fetchJSON(`/reports/${id}`),
  importReport: (filepath, filename) => fetchJSON('/reports/import', {
    method: 'POST',
    body: JSON.stringify({ filepath, filename }),
  }),
  scanFolder: (folder) => fetchJSON('/reports/scan-folder', {
    method: 'POST',
    body: JSON.stringify({ folder }),
  }),

  // Domains
  getDomains: () => fetchJSON('/domains'),
  getDomain: (id) => fetchJSON(`/domains/${id}`),
  addDomain: (domain) => fetchJSON('/domains', {
    method: 'POST',
    body: JSON.stringify({ domain }),
  }),
  deleteDomain: (id) => fetchJSON(`/domains/${id}`, { method: 'DELETE' }),

  // Alerts
  getAlerts: (all = false) => fetchJSON(`/alerts?all=${all}`),
  generateAlerts: () => fetchJSON('/alerts/generate'),
  acknowledgeAlert: (id) => fetchJSON(`/alerts/${id}/acknowledge`, { method: 'POST' }),

  // Config
  getConfig: () => fetchJSON('/config'),
  saveConfig: (config) => fetchJSON('/config', {
    method: 'POST',
    body: JSON.stringify(config),
  }),
};
