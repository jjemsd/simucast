import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

const ToastCtx = createContext(null)
let nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const push = useCallback(
    (message, opts = {}) => {
      const id = ++nextId
      const toast = {
        id,
        message,
        kind: opts.kind || 'info', // 'info' | 'success' | 'error' | 'warning'
        duration: opts.duration ?? 4500,
      }
      setToasts((t) => [...t, toast])
      if (toast.duration > 0) {
        setTimeout(() => dismiss(id), toast.duration)
      }
      return id
    },
    [dismiss]
  )

  const api = {
    push,
    dismiss,
    success: (m, o) => push(m, { ...o, kind: 'success' }),
    error: (m, o) => push(m, { ...o, kind: 'error' }),
    warning: (m, o) => push(m, { ...o, kind: 'warning' }),
    info: (m, o) => push(m, { ...o, kind: 'info' }),
  }

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="ax-toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

function ToastItem({ toast, onDismiss }) {
  return (
    <div className={`ax-toast ax-toast--${toast.kind}`}>
      <span className="ax-toast-icon" aria-hidden>
        {toast.kind === 'success' && '✓'}
        {toast.kind === 'error' && '!'}
        {toast.kind === 'warning' && '!'}
        {toast.kind === 'info' && 'i'}
      </span>
      <span className="ax-toast-msg">{toast.message}</span>
      <button className="ax-toast-close" onClick={onDismiss} aria-label="Dismiss">×</button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

// Convenience: surface any error from an awaited promise as an error toast.
export function useErrorToast() {
  const toast = useToast()
  return useCallback(
    (err, prefix) => {
      const msg = err?.message || String(err) || 'Something went wrong'
      toast.error(prefix ? `${prefix}: ${msg}` : msg)
    },
    [toast]
  )
}

// Auto-dismiss escape key
export function useEscapeDismiss(handler) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') handler()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handler])
}
