const BASE = '/api';

async function fetchJSON(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  const res = await fetch(BASE + url, { headers, credentials: 'include', ...opts });
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new Error('Session expirée');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  login: (username, password) => fetchJSON('/auth/login', {
    method: 'POST', body: JSON.stringify({ username, password }),
  }),
  logout: () => fetchJSON('/auth/logout', { method: 'POST' }),
  getMe: () => fetchJSON('/auth/me'),
  changePassword: (oldPassword, newPassword) => fetchJSON('/auth/change-password', {
    method: 'POST', body: JSON.stringify({ oldPassword, newPassword }),
  }),
  getUsers: () => fetchJSON('/auth/users'),
  createUser: (username, password, role) => fetchJSON('/auth/users', {
    method: 'POST', body: JSON.stringify({ username, password, role }),
  }),
  updateUser: (id, data) => fetchJSON(`/auth/users/${id}`, {
    method: 'PUT', body: JSON.stringify(data),
  }),
  deleteUser: (id) => fetchJSON(`/auth/users/${id}`, { method: 'DELETE' }),

  getGlobalStats: () => fetchJSON('/stats/global'),
  getTimeline: (days = 90) => fetchJSON(`/stats/timeline?days=${days}`),
  getTopSources: (limit = 20) => fetchJSON(`/stats/sources?limit=${limit}`),
  getDispositions: () => fetchJSON('/stats/dispositions'),
  getUnauthorized: () => fetchJSON('/stats/unauthorized'),
  getEmailDetails: () => fetchJSON('/stats/email-details'),
  getRecommendations: (status = 'active') => fetchJSON(`/stats/recommendations?status=${status}`),
  updateRecommendationStatus: (id, status) => fetchJSON(`/stats/recommendations/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  refreshRecommendations: () => fetchJSON('/stats/recommendations/refresh', { method: 'POST' }),
  getMonthlyComparison: () => fetchJSON('/stats/monthly'),
  getNewSenders: () => fetchJSON('/stats/new-senders'),
  getOverview: () => fetchJSON('/stats/overview'),
  lookupIP: (ip) => fetchJSON(`/stats/ip-lookup?ip=${encodeURIComponent(ip)}`),

  getDeliverabilityByDomain: ({ domain = '', category = 'perfect', page = 1, pageSize = 10, search = '' } = {}) => {
    const params = new URLSearchParams({ domain, category, page, pageSize, search });
    return fetchJSON(`/stats/deliverability/domain?${params.toString()}`);
  },
  getDeliverabilitySources: ({ domain = '', subdomain = '', from = '', to = '' } = {}) => {
    const params = new URLSearchParams({ domain, subdomain, from, to });
    return fetchJSON(`/stats/deliverability/sources?${params.toString()}`);
  },
  getDeliverabilitySourceRecords: ({ source, domain = '', subdomain = '', from = '', to = '', page = 1, pageSize = 20 }) => {
    const params = new URLSearchParams({ source, domain, subdomain, from, to, page, pageSize });
    return fetchJSON(`/stats/deliverability/sources/records?${params.toString()}`);
  },
  checkRBL: (ip) => fetchJSON(`/stats/rbl-check?ip=${encodeURIComponent(ip)}`),
  checkRBLBulk: (ips) => fetchJSON('/stats/rbl-check', { method: 'POST', body: JSON.stringify({ ips }) }),

  getReports: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.domain) params.set('domain', filters.domain);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    const qs = params.toString();
    return fetchJSON(`/reports${qs ? '?' + qs : ''}`);
  },
  getReport: (id) => fetchJSON(`/reports/${id}`),
  importReport: (filepath, filename) => fetchJSON('/reports/import', {
    method: 'POST', body: JSON.stringify({ filepath, filename }),
  }),
  scanFolder: (folder) => fetchJSON('/reports/scan-folder', {
    method: 'POST', body: JSON.stringify({ folder }),
  }),

  getDomains: () => fetchJSON('/domains'),
  getDomain: (id) => fetchJSON(`/domains/${id}`),
  addDomain: (domain) => fetchJSON('/domains', {
    method: 'POST', body: JSON.stringify({ domain }),
  }),
  deleteDomain: (id) => fetchJSON(`/domains/${id}`, { method: 'DELETE' }),

  getAlerts: (all = false) => fetchJSON(`/alerts?all=${all}`),
  generateAlerts: () => fetchJSON('/alerts/generate'),
  acknowledgeAlert: (id) => fetchJSON(`/alerts/${id}/acknowledge`, { method: 'POST' }),

  getConfig: () => fetchJSON('/config'),
  saveConfig: (config) => fetchJSON('/config', {
    method: 'POST', body: JSON.stringify(config),
  }),
  testImap: () => fetchJSON('/config/test-imap', { method: 'POST' }),
  fetchNow: () => fetchJSON('/config/fetch-now', { method: 'POST' }),
  getImportLog: (limit = 50) => fetchJSON(`/config/import-log?limit=${limit}`),
};
