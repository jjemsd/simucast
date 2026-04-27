import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

export default function DashboardPage() {
  const [datasets, setDatasets] = useState([])

  useEffect(() => {
    api.listDatasets().then(setDatasets).catch(console.error)
  }, [])

  const totalRows = datasets.reduce((acc, d) => acc + (d.row_count || 0), 0)
  const latest = datasets[0]

  return (
    <>
      <h1 className="ax-page-title">Dashboard</h1>
      <p className="ax-page-sub">Quick overview of your work in Axion.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <StatCard label="Projects" value={datasets.length} />
        <StatCard label="Total rows" value={totalRows.toLocaleString()} />
        <StatCard label="Latest project" value={latest?.name || '—'} small={!!latest} />
      </div>

      <p className="ax-lbl">Recent projects</p>
      {datasets.length === 0 ? (
        <div className="ax-card">
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
            No projects yet. Head to <Link to="/projects">Projects</Link> to upload a dataset.
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
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{d.name}</p>
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
