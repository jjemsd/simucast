import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import DataGridModal from './DataGridModal'

export default function DataPage({ dataset, setDataset }) {
  const [datasets, setDatasets] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState([])
  const fileRef = useRef(null)

  useEffect(() => {
    api.listDatasets().then(setDatasets).catch(console.error)
  }, [])

  const handleUpload = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setUploading(true)
    try {
      const result = await api.uploadDataset(f)
      const full = await api.getDataset(result.id)
      setDataset(full)
      const list = await api.listDatasets()
      setDatasets(list)
    } catch (err) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const selectDataset = async (id) => {
    const full = await api.getDataset(id)
    setDataset(full)
  }

  const handleVarUpdate = async (varName, body) => {
    if (!dataset) return
    const r = await api.updateVariable(dataset.id, varName, body)
    setDataset({ ...dataset, variables: r.variables })
  }

  const askAi = async () => {
    if (!dataset || !aiPrompt.trim()) return
    const r = await api.aiSuggest(dataset.id, aiPrompt)
    setAiSuggestions(r.suggestions || [])
  }

  return (
    <>
      <h1 className="ax-page-title">Data</h1>
      <p className="ax-page-sub">Upload a CSV or Excel file to begin. All analyses pull from your active dataset.</p>

      {/* Upload */}
      <div className="ax-card" style={{ marginBottom: 16 }}>
        <div className="ax-row">
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>Upload dataset</p>
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
              Accepts .csv, .xlsx, .xls · max 50 MB
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleUpload}
              style={{ display: 'none' }}
            />
            <button
              className="ax-btn prim"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? 'Uploading…' : 'Upload file'}
            </button>
          </div>
        </div>
      </div>

      {/* Active dataset */}
      {dataset ? (
        <>
          <div className="ax-card" style={{ marginBottom: 16 }}>
            <div className="ax-row" style={{ marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{dataset.name}</p>
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                  {dataset.row_count?.toLocaleString()} rows · {dataset.col_count} variables
                </p>
              </div>
              <button className="ax-btn prim" onClick={() => setShowModal(true)}>
                View data grid
              </button>
            </div>
          </div>

          {/* AI prompt */}
          <div className="ax-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path
                  d="M7 1L8.3 5.1L12.5 6L8.3 8.2L7 13L5.7 8.2L1.5 6L5.7 5.1L7 1Z"
                  fill="var(--color-accent)"
                />
              </svg>
              <span style={{ fontSize: 12, fontWeight: 500 }}>AI analyst</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describe your analysis..."
                style={{ flex: 1 }}
                onKeyDown={(e) => e.key === 'Enter' && askAi()}
              />
              <button className="ax-btn" onClick={askAi}>
                Suggest
              </button>
            </div>
            {aiSuggestions.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {aiSuggestions.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 10px',
                      background: 'var(--color-background-secondary)',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Variables preview */}
          <p className="ax-lbl">Variables</p>
          <div className="ax-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="ax-tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Missing</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {(dataset.variables || []).map((v) => (
                  <tr key={v.name}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{v.name}</td>
                    <td>
                      <span style={{ color: 'var(--color-text-info)' }}>{v.dtype}</span>
                    </td>
                    <td>{v.missing}</td>
                    <td>
                      <select
                        value={v.role}
                        onChange={(e) => handleVarUpdate(v.name, { role: e.target.value })}
                        style={{ fontSize: 10, padding: '2px 4px' }}
                      >
                        <option value="feature">feature</option>
                        <option value="target">target</option>
                        <option value="ignore">ignore</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <p className="ax-lbl">Recent datasets</p>
          {datasets.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              No datasets yet. Upload one to get started.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {datasets.map((d) => (
                <div key={d.id} className="ax-card" style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => selectDataset(d.id)}>
                  <div className="ax-row">
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{d.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                        {d.row_count?.toLocaleString()} rows · {d.col_count} variables
                      </p>
                    </div>
                    <button className="ax-btn">Open</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showModal && dataset && (
        <DataGridModal
          datasetId={dataset.id}
          variables={dataset.variables || []}
          onClose={() => setShowModal(false)}
          onVariableUpdate={handleVarUpdate}
        />
      )}
    </>
  )
}
