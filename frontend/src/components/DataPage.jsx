import React, { useState } from 'react'
import { api } from '../api'
import DataGridModal from './DataGridModal'

export default function DataPage({ dataset }) {
  const [showModal, setShowModal] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState([])

  const askAi = async () => {
    if (!dataset || !aiPrompt.trim()) return
    const r = await api.aiSuggest(dataset.id, aiPrompt)
    setAiSuggestions(r.suggestions || [])
  }

  return (
    <>
      <h1 className="ax-page-title">{dataset.name}</h1>
      <p className="ax-page-sub">
        {dataset.row_count?.toLocaleString()} rows · {dataset.col_count} variables
      </p>

      <div className="ax-card" style={{ marginBottom: 16 }}>
        <div className="ax-row">
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>Raw data</p>
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
              Browse the full dataset in an Excel-style grid.
            </p>
          </div>
          <button className="ax-btn prim" onClick={() => setShowModal(true)}>
            View data grid
          </button>
        </div>
      </div>

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

      <p className="ax-lbl">Variables</p>
      <div className="ax-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="ax-tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Missing</th>
              <th>Unique</th>
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
                <td>{v.unique}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <DataGridModal
          datasetId={dataset.id}
          variables={dataset.variables || []}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
