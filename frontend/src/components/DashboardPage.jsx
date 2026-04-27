import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import NewProjectModal from './NewProjectModal'

export default function DashboardPage() {
  const [datasets, setDatasets] = useState([])
  const [uploading, setUploading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const fileRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.listDatasets().then(setDatasets).catch(console.error)
  }, [])

  const totalRows = datasets.reduce((acc, d) => acc + (d.row_count || 0), 0)
  const latest = datasets[0]

  const handleQuickUpload = async (e) => {
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
      <div className="ax-row" style={{ marginBottom: 4 }}>
        <div>
          <h1 className="ax-page-title" style={{ marginBottom: 0 }}>Dashboard</h1>
          <p className="ax-page-sub">Quick overview of your work in SimuCast.</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleQuickUpload}
            style={{ display: 'none' }}
          />
          <button
            className="ax-btn"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? 'Uploading…' : 'Upload new file'}
          </button>
          <button
            className="ax-btn prim"
            onClick={() => setModalOpen(true)}
          >
            + Add new project
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, margin: '12px 0 16px' }}>
        <StatCard label="Projects" value={datasets.length} />
        <StatCard label="Total rows" value={totalRows.toLocaleString()} />
        <StatCard label="Latest project" value={latest?.name || '—'} small={!!latest} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <section>
          <div className="ax-row" style={{ marginBottom: 6 }}>
            <p className="ax-lbl" style={{ margin: 0 }}>Recent projects</p>
            <Link to="/projects" style={{ fontSize: 11, color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
              View all →
            </Link>
          </div>
          {datasets.length === 0 ? (
            <div className="ax-card">
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
                No projects yet. Click <strong>+ Add new project</strong> to get started.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {datasets.slice(0, 5).map((d) => (
                <Link
                  key={d.id}
                  to={`/projects/${d.id}`}
                  className="ax-card"
                  style={{ padding: '10px 12px', textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                  <div className="ax-row">
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                        {d.row_count?.toLocaleString()} rows · {d.col_count} variables
                      </p>
                    </div>
                    <span className="ax-btn">Open →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="ax-row" style={{ marginBottom: 6 }}>
            <p className="ax-lbl" style={{ margin: 0 }}>Recent files</p>
            <Link to="/files" style={{ fontSize: 11, color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
              View all →
            </Link>
          </div>
          {datasets.length === 0 ? (
            <div className="ax-card">
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
                No files yet. Click <strong>Upload new file</strong> to add one.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {datasets.slice(0, 5).map((d) => (
                <Link
                  key={d.id}
                  to={`/projects/${d.id}`}
                  className="ax-card"
                  style={{ padding: '10px 12px', textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                  <div className="ax-row">
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, margin: 0, fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.filename || d.name}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                        {d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'} · {d.row_count?.toLocaleString()} rows
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <NewProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(result) => {
          setModalOpen(false)
          navigate(`/projects/${result.id}`)
        }}
      />
    </>
  )
}

function StatCard({ label, value, small }) {
  return (
    <div className="ax-card">
      <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <p
        style={{
          fontSize: small ? 14 : 22,
          fontWeight: 500,
          margin: '6px 0 0',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </p>
    </div>
  )
}
