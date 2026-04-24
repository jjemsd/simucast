import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function ProjectsPage() {
  const [datasets, setDatasets] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.listDatasets().then(setDatasets).catch(console.error)
  }, [])

  const handleUpload = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setUploading(true)
    try {
      const result = await api.uploadDataset(f)
      navigate(`/projects/${result.id}`)
    } catch (err) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
      <h1 className="ax-page-title">Projects</h1>
      <p className="ax-page-sub">Each project is a dataset you can clean, describe, test, and model.</p>

      <div className="ax-card" style={{ marginBottom: 16 }}>
        <div className="ax-row">
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>New project</p>
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
              Upload a .csv, .xlsx, or .xls file (max 50 MB)
            </p>
          </div>
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

      <p className="ax-lbl">All projects</p>
      {datasets.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          No projects yet. Upload a dataset to get started.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {datasets.map((d) => (
            <div
              key={d.id}
              className="ax-card"
              style={{ padding: '10px 12px', cursor: 'pointer' }}
              onClick={() => navigate(`/projects/${d.id}`)}
            >
              <div className="ax-row">
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{d.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                    {d.row_count?.toLocaleString()} rows · {d.col_count} variables
                    {d.created_at && ` · ${new Date(d.created_at).toLocaleDateString()}`}
                  </p>
                </div>
                <button className="ax-btn">Open →</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
