import React, { useEffect, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import { api } from '../api'

const ALGOS = [
  { key: 'logistic', label: 'Logistic regression' },
  { key: 'rf', label: 'Random forest' },
  { key: 'gbm', label: 'Gradient boost' },
  { key: 'linear', label: 'Linear regression' },
]

export default function ModelsPage({ dataset, setActiveModel, onGo }) {
  const [algo, setAlgo] = useState('logistic')
  const [target, setTarget] = useState('')
  const [features, setFeatures] = useState([])
  const [models, setModels] = useState([])
  const [latest, setLatest] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!dataset) return
    api.listModels(dataset.id).then(setModels).catch(console.error)
    // auto-pick the target variable marked as target, if any
    const t = (dataset.variables || []).find((v) => v.role === 'target')
    if (t) setTarget(t.name)
  }, [dataset?.id])

  if (!dataset) return <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Upload a dataset first.</p>

  const variables = dataset.variables || []
  const candidateFeatures = variables.filter((v) => v.role !== 'ignore' && v.name !== target)

  const toggleFeature = (name) => {
    setFeatures(features.includes(name) ? features.filter((x) => x !== name) : [...features, name])
  }

  const train = async () => {
    if (!target) return alert('Pick a target variable')
    setLoading(true)
    try {
      const r = await api.trainModel(dataset.id, {
        target,
        features: features.length ? features : candidateFeatures.map((v) => v.name),
        algorithm: algo,
      })
      setLatest(r)
      const list = await api.listModels(dataset.id)
      setModels(list)
    } catch (err) {
      alert('Training failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const useInWhatIf = (model) => {
    setActiveModel(model)
    onGo('whatif')
  }

  return (
    <>
      <h1 className="ax-page-title">Build a model</h1>
      <p className="ax-page-sub">Train a predictive model on your data with an 80/20 train/test split.</p>

      <p className="ax-lbl">Algorithm</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {ALGOS.map((a) => (
          <button key={a.key} className={`ax-pill ${algo === a.key ? 'active' : ''}`} onClick={() => setAlgo(a.key)}>
            {a.label}
          </button>
        ))}
      </div>

      <div className="ax-card" style={{ marginBottom: 12 }}>
        <p className="ax-lbl" style={{ marginTop: 0 }}>Target (what to predict)</p>
        <select value={target} onChange={(e) => setTarget(e.target.value)} style={{ marginBottom: 14 }}>
          <option value="">— select —</option>
          {variables.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.dtype})</option>)}
        </select>

        <p className="ax-lbl">Features · tap to select (none = use all)</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {candidateFeatures.map((v) => (
            <span key={v.name} className={`ax-chip ${features.includes(v.name) ? 'active' : ''}`} onClick={() => toggleFeature(v.name)}>
              {v.name}
            </span>
          ))}
        </div>

        <button className="ax-btn prim" disabled={loading || !target} onClick={train}>
          {loading ? 'Training…' : 'Train model'}
        </button>
      </div>

      {latest && <ModelResult model={latest} onUseInWhatIf={() => useInWhatIf(latest)} />}

      {models.length > 0 && (
        <>
          <p className="ax-lbl" style={{ marginTop: 20 }}>Previous models</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {models.map((m) => (
              <div key={m.id} className="ax-card" style={{ padding: '10px 12px' }}>
                <div className="ax-row">
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, margin: 0 }}>{m.algorithm} · {m.target}</p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                      {formatMetrics(m.metrics)}
                    </p>
                  </div>
                  {m.has_whatif && (
                    <button className="ax-btn" onClick={() => useInWhatIf(m)}>Use in what-if →</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function formatMetrics(m) {
  if (!m) return ''
  if (m.task === 'classification') {
    const parts = [`accuracy ${(m.accuracy * 100).toFixed(1)}%`]
    if (m.auc != null) parts.push(`AUC ${m.auc.toFixed(3)}`)
    return parts.join(' · ')
  }
  return `R² ${m.r2?.toFixed(3) ?? '—'} · RMSE ${m.rmse?.toFixed(3) ?? '—'}`
}

function ModelResult({ model, onUseInWhatIf }) {
  const metrics = model.metrics
  const importance = model.feature_importance || {}
  const impLabels = Object.keys(importance)
  const impValues = Object.values(importance)

  const metricCards = metrics.task === 'classification'
    ? [
        { label: 'Accuracy', value: `${(metrics.accuracy * 100).toFixed(1)}%` },
        { label: 'AUC', value: metrics.auc?.toFixed(3) ?? '—' },
        { label: 'Precision', value: metrics.precision?.toFixed(3) },
        { label: 'Recall', value: metrics.recall?.toFixed(3) },
      ]
    : [
        { label: 'R²', value: metrics.r2?.toFixed(3) },
        { label: 'RMSE', value: metrics.rmse?.toFixed(3) },
        { label: 'MAE', value: metrics.mae?.toFixed(3) },
      ]

  return (
    <>
      <p className="ax-lbl" style={{ marginTop: 16 }}>Performance</p>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${metricCards.length}, 1fr)`, gap: 6, marginBottom: 14 }}>
        {metricCards.map((m) => (
          <div key={m.label} style={{ background: 'var(--color-background-primary)', borderRadius: 6, padding: 10, border: '0.5px solid var(--color-border-tertiary)' }}>
            <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', margin: 0 }}>{m.label}</p>
            <p style={{ fontSize: 18, fontWeight: 500, margin: '2px 0 0' }}>{m.value}</p>
          </div>
        ))}
      </div>

      {impLabels.length > 0 && (
        <>
          <p className="ax-lbl">Feature importance</p>
          <div className="ax-card" style={{ marginBottom: 10 }}>
            <div style={{ height: Math.max(180, impLabels.length * 22) }}>
              <Bar
                data={{
                  labels: impLabels,
                  datasets: [{
                    label: 'Importance',
                    data: impValues,
                    backgroundColor: '#7F77DD',
                    borderRadius: 2,
                  }],
                }}
                options={{
                  indexAxis: 'y',
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { beginAtZero: true, ticks: { font: { size: 10 } } },
                    y: { ticks: { font: { size: 10 } } },
                  },
                }}
              />
            </div>
          </div>
        </>
      )}

      {model.has_whatif && (
        <div style={{ textAlign: 'right' }}>
          <button className="ax-btn prim" onClick={onUseInWhatIf}>Use in what-if →</button>
        </div>
      )}
    </>
  )
}
