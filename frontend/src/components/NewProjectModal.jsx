import React, { useRef, useState } from 'react'
import { api } from '../api'

export default function NewProjectModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  if (!open) return null

  const reset = () => {
    setName('')
    setDescription('')
    setFile(null)
    setError(null)
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const close = () => {
    if (busy) return
    reset()
    onClose()
  }

  const onPick = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (!name) {
      const dot = f.name.lastIndexOf('.')
      setName(dot > 0 ? f.name.slice(0, dot) : f.name)
    }
  }

  const submit = async () => {
    if (!file) {
      setError('Choose a .csv, .xlsx, or .xls file.')
      return
    }
    if (!name.trim()) {
      setError('Give the project a name.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await api.uploadDataset(file, name.trim(), description.trim())
      reset()
      onCreated(result)
    } catch (err) {
      setError(err.message || 'Upload failed')
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ax-card"
        style={{
          width: '100%',
          maxWidth: 480,
          padding: 20,
          background: 'var(--color-background-primary)',
        }}
      >
        <div className="ax-row" style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>New project</p>
          <button
            className="ax-btn"
            onClick={close}
            disabled={busy}
            aria-label="Close"
            style={{ padding: '2px 8px' }}
          >
            ×
          </button>
        </div>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <span className="ax-lbl" style={{ display: 'block', marginBottom: 4 }}>Project name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Customer churn 2026"
            disabled={busy}
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <span className="ax-lbl" style={{ display: 'block', marginBottom: 4 }}>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional — what this dataset is for, where it came from, etc."
            disabled={busy}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </label>

        <div style={{ marginBottom: 12 }}>
          <span className="ax-lbl" style={{ display: 'block', marginBottom: 4 }}>Data file</span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={onPick}
            disabled={busy}
            style={{ display: 'none' }}
          />
          <div className="ax-row" style={{ gap: 8 }}>
            <button
              className="ax-btn"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              type="button"
            >
              {file ? 'Choose different file' : 'Upload file'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file ? file.name : 'No file selected · .csv, .xlsx, .xls (max 50 MB)'}
            </span>
          </div>
        </div>

        {error && (
          <p style={{ fontSize: 12, color: 'var(--color-text-danger)', margin: '0 0 10px' }}>
            {error}
          </p>
        )}

        <div className="ax-row" style={{ justifyContent: 'flex-end', gap: 6 }}>
          <button className="ax-btn" onClick={close} disabled={busy} type="button">Cancel</button>
          <button className="ax-btn prim" onClick={submit} disabled={busy} type="button">
            {busy ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '6px 8px',
  fontSize: 13,
  border: '1px solid var(--color-border-primary)',
  borderRadius: 6,
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
  boxSizing: 'border-box',
}
