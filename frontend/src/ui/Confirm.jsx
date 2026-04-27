import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

const ConfirmCtx = createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  // state: { title, message, confirmLabel, cancelLabel, danger, resolve }

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      setState({
        title: opts.title || 'Are you sure?',
        message: opts.message || '',
        confirmLabel: opts.confirmLabel || 'Confirm',
        cancelLabel: opts.cancelLabel || 'Cancel',
        danger: !!opts.danger,
        resolve,
      })
    })
  }, [])

  const close = (value) => {
    if (state) state.resolve(value)
    setState(null)
  }

  // Esc cancels, Enter confirms.
  useEffect(() => {
    if (!state) return
    const onKey = (e) => {
      if (e.key === 'Escape') close(false)
      if (e.key === 'Enter') close(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div className="ax-modal-bg" onClick={() => close(false)}>
          <div className="ax-confirm" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
            <p className="ax-confirm-title">{state.title}</p>
            {state.message && <p className="ax-confirm-msg">{state.message}</p>}
            <div className="ax-confirm-actions">
              <button className="ax-btn" onClick={() => close(false)}>
                {state.cancelLabel}
              </button>
              <button
                className={`ax-btn ${state.danger ? 'danger' : 'prim'}`}
                onClick={() => close(true)}
                autoFocus
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx)
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider')
  return ctx
}
