const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Health ──────────────────────────────────────────────────────────────────
export const getHealth = () => request('/health');

// ── Candidates ──────────────────────────────────────────────────────────────
export const getCandidates  = (params = {}) => request('/candidates/?' + new URLSearchParams(params)).then(d => d.candidates ?? d);
export const getCandidate   = (id) => request(`/candidates/${id}`);

// ── Jobs ─────────────────────────────────────────────────────────────────────
export const getJobs        = (params = {}) => request('/jobs/?' + new URLSearchParams(params)).then(d => d.jobs ?? d);
export const getJob         = (id) => request(`/jobs/${id}`);
export const syncPipedrive  = () => request('/jobs/sync-from-pipedrive', { method: 'POST' });

// ── Matches ──────────────────────────────────────────────────────────────────
export const getMatches     = (params = {}) => request('/matches/?' + new URLSearchParams(params)).then(d => d.matches ?? d);
export const updateMatch    = (id, data) => request(`/matches/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

// ── Email scan ───────────────────────────────────────────────────────────────
export const triggerEmailScan   = () => request('/email/scan',          { method: 'POST' });
export const startEmailScan     = () => request('/email/scan-start',    { method: 'POST' });
export const stopEmailScan      = () => request('/email/scan-stop',     { method: 'POST' });
export const getEmailLogs       = (params = {}) => request('/email/scan-logs?' + new URLSearchParams(params));
export const getEmailStatus     = () => request('/email/scan-status');
export const getSchedulerStatus = () => request('/email/scheduler-status');
export const resetEmailScan     = () => request('/email/scan-reset',    { method: 'DELETE' });

// ── Agents ───────────────────────────────────────────────────────────────────
export const getAgentTasks  = (params = {}) => request('/agents/tasks?' + new URLSearchParams(params));
export const getAgentLogs   = (params = {}) => request('/agents/logs?' + new URLSearchParams(params));

// ── System logs ───────────────────────────────────────────────────────────────
export const getSystemLogs  = (params = {}) => request('/logs?' + new URLSearchParams(params));

// ── Synonyms ──────────────────────────────────────────────────────────────────
export const getSynonyms    = () => request('/synonyms/');
export const createSynonym  = (data) => request('/synonyms/', { method: 'POST', body: JSON.stringify(data) });
export const deleteSynonym  = (id) => request(`/synonyms/${id}`, { method: 'DELETE' });

// ── Feedback ──────────────────────────────────────────────────────────────────
export const submitFeedback = (data) => request('/feedback/', { method: 'POST', body: JSON.stringify(data) });
