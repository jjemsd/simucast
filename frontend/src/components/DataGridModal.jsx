import React, { useEffect, useState } from 'react'
import { api } from '../api'

/**
 * DataGridModal
 * Excel/SPSS-style viewer with two tabs:
 *   - Data View: paginated grid of actual rows (frozen row numbers, column headers show dtype)
 *   - Variable View: metadata about each column (name, type, role, missing, unique)
 */
export default function DataGridModal({ datasetId, variables, onClose, onVariableUpdate }) {
  const [tab, setTab] = useState('data')
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(100)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (tab !== 'data') return
    setLoading(true)
    api
      .getRows(datasetId, page, pageSize)
      .then((r) => {
        setRows(r.rows)
        setTotal(r.total)
      })
      .finally(() => setLoading(false))
  }, [datasetId, page, pageSize, tab])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const columns = variables.map((v) => v.name)

  return (
    <div className="ax-modal-bg" onClick={onClose}>
      <div className="ax-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ax-modal-header">
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>Dataset viewer</p>
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
              {total.toLocaleString()} rows · {variables.length} columns
            </p>
          </div>
          <button className="ax-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="ax-tabs">
          <button className={`ax-tab ${tab === 'data' ? 'active' : ''}`} onClick={() => setTab('data')}>
            Data View
          </button>
          <button className={`ax-tab ${tab === 'var' ? 'active' : ''}`} onClick={() => setTab('var')}>
            Variable View
          </button>
        </div>

        <div className="ax-modal-body">
          {tab === 'data' && (
            <>
              <div className="ax-grid-wrap">
                {loading ? (
                  <p style={{ padding: 20, color: 'var(--color-text-secondary)' }}>Loading rows…</p>
                ) : (
                  <table className="ax-grid">
                    <thead>
                      <tr>
                        <th className="ax-grid-row-num-head">#</th>
                        {variables.map((v) => (
                          <th key={v.name}>
                            {v.name}
                            <span className="ax-grid-type">{v.dtype}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i}>
                          <td className="ax-grid-row-num">{(page - 1) * pageSize + i + 1}</td>
                          {columns.map((c) => {
                            const v = r[c]
                            const missing = v === null || v === undefined || v === ''
                            return (
                              <td key={c} className={missing ? 'missing' : ''}>
                                {missing ? '—' : formatCell(v)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* pagination */}
              <div
                style={{
                  padding: '10px 18px',
                  borderTop: '0.5px solid var(--color-border-tertiary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  Page {page} of {totalPages} · showing rows {(page - 1) * pageSize + 1}–
                  {Math.min(page * pageSize, total)}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="ax-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>
                    Previous
                  </button>
                  <button
                    className="ax-btn"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}

          {tab === 'var' && (
            <div style={{ padding: 18 }}>
              <table className="ax-tbl" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Role</th>
                    <th>Missing</th>
                    <th>Unique</th>
                  </tr>
                </thead>
                <tbody>
                  {variables.map((v) => (
                    <tr key={v.name}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{v.name}</td>
                      <td>
                        <span
                          className="ax-chip"
                          style={{
                            background: dtypeColor(v.dtype).bg,
                            color: dtypeColor(v.dtype).fg,
                          }}
                        >
                          {v.dtype}
                        </span>
                      </td>
                      <td>
                        <select
                          value={v.role}
                          onChange={(e) => onVariableUpdate(v.name, { role: e.target.value })}
                          style={{ fontSize: 11, padding: '3px 6px' }}
                        >
                          <option value="feature">feature</option>
                          <option value="target">target</option>
                          <option value="ignore">ignore</option>
                        </select>
                      </td>
                      <td>{v.missing}</td>
                      <td>{v.unique}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatCell(v) {
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return v.toString()
    return v.toFixed(3)
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}

function dtypeColor(t) {
  const map = {
    numeric: { bg: '#E6F1FB', fg: '#185FA5' },
    binary: { bg: '#FBEAF0', fg: '#993556' },
    category: { bg: '#E1F5EE', fg: '#0F6E56' },
    datetime: { bg: '#FAEEDA', fg: '#854F0B' },
    text: { bg: '#F1EFE8', fg: '#5F5E5A' },
  }
  return map[t] || map.text
}
