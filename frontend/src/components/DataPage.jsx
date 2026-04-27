import React, { useState } from 'react'
import { api } from '../api'
import DataGridModal from './DataGridModal'
import ColumnValuesModal from './ColumnValuesModal'
import StageTimeline from './StageTimeline'

export default function DataPage({ dataset, setDataset }) {
  const [viewStageId, setViewStageId] = useState(null)
  const [viewStageLabel, setViewStageLabel] = useState(null)
  const [activeVar, setActiveVar] = useState(null)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [historyKey, setHistoryKey] = useState(0)

  const askAi = async () => {
    if (!dataset || !aiPrompt.trim()) return
    const r = await api.aiSuggest(dataset.id, aiPrompt)
    setAiSuggestions(r.suggestions || [])
  }

  const refreshDataset = async () => {
    try {
      const fresh = await api.getDataset(dataset.id)
      setDataset?.(fresh)
      setHistoryKey((k) => k + 1)
    } catch (err) {
      console.error('Failed to refresh dataset', err)
    }
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
          <div style={{ display: 'flex', gap: 6 }}>
            <a
              className="ax-btn"
              href={api.exportCsvUrl(dataset.id)}
              download
              style={{ textDecoration: 'none' }}
            >
              Download CSV
            </a>
            <button
              className="ax-btn prim"
              onClick={() => {
                setViewStageId('current')
                setViewStageLabel(null)
              }}
            >
              View data grid
            </button>
          </div>
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

      <p className="ax-lbl">Data history</p>
      <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '0 0 6px' }}>
        Every cleaning, merge, or expansion creates a new stage. Original data is always preserved
        and can be viewed or exported at any time.
      </p>
      <div style={{ marginBottom: 16 }}>
        <StageTimeline
          datasetId={dataset.id}
          refreshKey={historyKey}
          onView={(stageId) => {
            setViewStageId(stageId)
            setViewStageLabel(stageId === 'original' ? 'Original upload' : `Stage ${stageId.slice(0, 8)}`)
          }}
          onRestored={refreshDataset}
        />
      </div>

      <p className="ax-lbl">Variables</p>
      <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '0 0 6px' }}>
        Click a row to view all entries for that variable.
      </p>
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
              <tr
                key={v.name}
                style={{ cursor: 'pointer' }}
                onClick={() => setActiveVar(v)}
              >
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

      {viewStageId && (
        <DataGridModal
          datasetId={dataset.id}
          variables={dataset.variables || []}
          stageId={viewStageId === 'current' ? null : viewStageId}
          stageLabel={viewStageLabel}
          onClose={() => {
            setViewStageId(null)
            setViewStageLabel(null)
          }}
        />
      )}
      {activeVar && (
        <ColumnValuesModal
          datasetId={dataset.id}
          variable={activeVar}
          onClose={() => setActiveVar(null)}
        />
      )}
    </>
  )
}
