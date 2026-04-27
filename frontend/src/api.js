// Centralized API client — swap VITE_API_URL via .env for prod
const BASE = import.meta.env.VITE_API_URL || ''

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || `${res.status} ${res.statusText}`)
  }
  return res.json()
}

export const api = {
  // datasets
  listDatasets: () => request('/api/datasets'),
  getDataset: (id) => request(`/api/datasets/${id}`),
  getRows: (id, page = 1, pageSize = 100) =>
    request(`/api/datasets/${id}/rows?page=${page}&page_size=${pageSize}`),
  uploadDataset: async (file, name, description) => {
    const fd = new FormData()
    fd.append('file', file)
    if (name) fd.append('name', name)
    if (description) fd.append('description', description)
    const r = await fetch(`${BASE}/api/datasets/upload`, { method: 'POST', body: fd })
    const ct = r.headers.get('content-type') || ''
    if (!r.ok) {
      if (ct.includes('application/json')) {
        const j = await r.json().catch(() => null)
        throw new Error(j?.error || `Upload failed (${r.status})`)
      }
      throw new Error(`Upload failed (${r.status})`)
    }
    if (!ct.includes('application/json')) {
      throw new Error(
        'Upload returned a non-JSON response. The frontend may be pointing at the wrong API URL — check VITE_API_URL.',
      )
    }
    return r.json()
  },
  updateVariable: (dsId, varName, body) =>
    request(`/api/datasets/${dsId}/variables/${varName}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  columnStats: (dsId, colName) =>
    request(`/api/datasets/${dsId}/columns/${encodeURIComponent(colName)}/stats`),
  columnValues: (dsId, colName, page = 1, pageSize = 200) =>
    request(
      `/api/datasets/${dsId}/columns/${encodeURIComponent(colName)}/values?page=${page}&page_size=${pageSize}`,
    ),

  // cleaning
  cleanSuggestions: (id) => request(`/api/datasets/${id}/clean/suggestions`),
  cleanApply: (id, body) =>
    request(`/api/datasets/${id}/clean/apply`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // describe
  describe: (id, body) =>
    request(`/api/datasets/${id}/describe`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // tests
  runTest: (id, body) =>
    request(`/api/datasets/${id}/test`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // advanced
  cluster: (id, body) =>
    request(`/api/datasets/${id}/advanced/cluster`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  pca: (id, body) =>
    request(`/api/datasets/${id}/advanced/pca`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // models
  trainModel: (id, body) =>
    request(`/api/datasets/${id}/models/train`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listModels: (id) => request(`/api/datasets/${id}/models`),
  getModel: (mid) => request(`/api/models/${mid}`),
  predict: (mid, inputs) =>
    request(`/api/models/${mid}/predict`, {
      method: 'POST',
      body: JSON.stringify({ inputs }),
    }),

  // ai
  aiSuggest: (id, prompt) =>
    request(`/api/datasets/${id}/ai/suggest`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),

  // report
  buildReport: (id, sections) =>
    request(`/api/datasets/${id}/report`, {
      method: 'POST',
      body: JSON.stringify({ sections }),
    }),
}
