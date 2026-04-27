import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useToast, useErrorToast } from '../ui/Toast'
import { useConfirm } from '../ui/Confirm'

export default function ProjectsPage() {
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const fileRef = useRef(null)
  const navigate = useNavigate()
  const toast = useToast()
  const showError = useErrorToast()
  const confirm = useConfirm()

  const refresh = () => {
    setLoading(true)
    api
      .listDatasets()
      .then(setDatasets)
      .catch((err) => showError(err, 'Could not load projects'))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  const handleUpload = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setUploading(true)
    try {
      const result = await api.uploadDataset(f)
      toast.success(`Uploaded ${f.name}`)
      navigate(`/projects/${result.id}`)
    } catch (err) {
      showError(err, 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDelete = async (d, e) => {
    e.stopPropagation()
    const ok = await confirm({
      title: `Delete "${d.name}"?`,
      message:
        'This permanently removes the dataset along with every analysis and model trained on it. This cannot be undone.',
      confirmLabel: 'Delete project',
      danger: true,
    })
    if (!ok) return
    setBusyId(d.id)
    try {
      await api.deleteDataset(d.id)
      setDatasets((list) => list.filter((x) => x.id !== d.id))
      toast.success(`Deleted ${d.name}`)
    } catch (err) {
      showError(err, 'Delete failed')
    } finally {
      setBusyId(null)
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
      {loading ? (
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Loading…</p>
      ) : datasets.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          No projects yet. Upload a dataset to get started.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {datasets.map((d) => (
            <div
              key={d.id}
              className="ax-card"
              style={{ padding: '10px 12px', cursor: 'pointer', opacity: busyId === d.id ? 0.5 : 1 }}
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
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="ax-btn"
                    onClick={(e) => handleDelete(d, e)}
                    disabled={busyId === d.id}
                    style={{ color: 'var(--color-text-danger)' }}
                  >
                    Delete
                  </button>
                  <button className="ax-btn">Open →</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
