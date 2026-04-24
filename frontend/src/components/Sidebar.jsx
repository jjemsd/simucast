import React from 'react'

const PAGES = [
  { key: 'data', label: 'Data' },
  { key: 'clean', label: 'Clean' },
  { key: 'describe', label: 'Describe' },
  { key: 'tests', label: 'Tests' },
  { key: 'advanced', label: 'Advanced' },
  { key: 'models', label: 'Models' },
  { key: 'whatif', label: 'What-if' },
  { key: 'report', label: 'Report' },
]

export default function Sidebar({ active, onGo, dataset }) {
  const idx = PAGES.findIndex((p) => p.key === active)
  const pct = Math.round(((idx + 1) / PAGES.length) * 100)
  return (
    <aside className="ax-sidebar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 14px' }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            background: 'var(--color-text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 9.5L6 2.5L10 9.5M3.8 7H8.2"
              stroke="var(--color-background-primary)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span style={{ fontWeight: 500, fontSize: 15 }}>Axion</span>
      </div>

      <p className="ax-lbl" style={{ padding: '0 10px' }}>
        Workflow
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {PAGES.map((p) => (
          <div
            key={p.key}
            className={`ax-nav ${active === p.key ? 'active' : ''}`}
            onClick={() => onGo(p.key)}
          >
            {p.label}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 10,
          background: 'var(--color-background-secondary)',
          borderRadius: 6,
        }}
      >
        <p
          style={{
            fontSize: 10,
            color: 'var(--color-text-tertiary)',
            margin: '0 0 4px',
            textTransform: 'uppercase',
            letterSpacing: 0.05,
          }}
        >
          Progress
        </p>
        <div
          style={{
            height: 4,
            background: 'var(--color-background-primary)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-accent)' }} />
        </div>
        <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
          {idx + 1} of {PAGES.length} steps
        </p>
      </div>

      {dataset && (
        <div style={{ marginTop: 20, padding: '0 10px' }}>
          <p className="ax-lbl" style={{ padding: 0 }}>
            Current dataset
          </p>
          <p style={{ fontSize: 12, margin: 0, fontWeight: 500 }}>{dataset.name}</p>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            {dataset.row_count?.toLocaleString()} rows · {dataset.col_count} cols
          </p>
        </div>
      )}
    </aside>
  )
}
