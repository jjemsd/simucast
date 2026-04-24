import React, { useEffect, useState } from 'react'
import { api } from '../api'

export default function FilesPage() {
  const [datasets, setDatasets] = useState([])

  useEffect(() => {
    api.listDatasets().then(setDatasets).catch(console.error)
  }, [])

  return (
    <>
      <h1 className="ax-page-title">Files</h1>
      <p className="ax-page-sub">Source files uploaded into Axion. Each file powers one project.</p>

      {datasets.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          No files yet.
        </p>
      ) : (
        <div className="ax-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="ax-tbl">
            <thead>
              <tr>
                <th>File</th>
                <th>Project</th>
                <th>Rows</th>
                <th>Columns</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{d.filename || '—'}</td>
                  <td>{d.name}</td>
                  <td>{d.row_count?.toLocaleString()}</td>
                  <td>{d.col_count}</td>
                  <td>{d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
