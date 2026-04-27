// Centralized API client — swap VITE_API_URL via .env for prod
const BASE = import.meta.env.VITE_API_URL || ''

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  })
  if (!res.ok) throw new Error(await extractError(res))
  return res.json()
}

async function extractError(res) {
  const text = await res.text()
  try {
    const j = JSON.parse(text)
    if (j && j.error) return j.error
  } catch {
    // fall through
  }
  return text.startsWith('<') ? `${res.status} ${res.statusText}` : text || `${res.status} ${res.statusText}`
}

export const api = {
  // datasets
  listDatasets: () => request('/api/datasets'),
  getDataset: (id) => request(`/api/datasets/${id}`),
  getRows: (id, page = 1, pageSize = 100) =>
    request(`/api/datasets/${id}/rows?page=${page}&page_size=${pageSize}`),
  uploadDataset: async (file, name) => {
    const fd = new FormData()
    fd.append('file', file)
    if (name) fd.append('name', name)
    const r = await fetch(`${BASE}/api/datasets/upload`, { method: 'POST', body: fd })
    if (!r.ok) throw new Error(await extractError(r))
    return r.json()
  },
  updateVariable: (dsId, varName, body) =>
    request(`/api/datasets/${dsId}/variables/${varName}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

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
