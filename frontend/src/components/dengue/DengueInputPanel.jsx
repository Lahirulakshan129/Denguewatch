import { useState, useRef } from 'react'
import { Upload, Save, FileText, Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react'

const DISTRICTS = [
  "Colombo","Gampaha","Kalutara","Kandy","Matale","Nuwara Eliya",
  "Galle","Matara","Hambantota","Jaffna","Kilinochchi","Mannar",
  "Vavuniya","Mullaitivu","Batticaloa","Ampara","Trincomalee",
  "Kurunegala","Puttalam","Anuradhapura","Polonnaruwa","Badulla",
  "Monaragala","Ratnapura","Kegalle"
]

function getCurrentWeekYear() {
  const now = new Date()
  const week = parseInt(now.toISOString().slice(0,4) && String(Math.ceil((((now - new Date(now.getFullYear(), 0, 1)) / 86400000) + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7)))
  return { week: isNaN(week) ? 1 : Math.min(week, 52), year: now.getFullYear() }
}

function parseCSV(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const rows = []
  const errors = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const vals = lines[i].split(',')
    const row = {}
    headers.forEach((h, idx) => row[h] = vals[idx]?.trim() ?? '')
    if (!row.district || !row.week || !row.year || row.cases === undefined) {
      errors.push(`Row ${i+1}: missing required columns (district, week, year, cases)`)
      continue
    }
    rows.push({ district: row.district, week: parseInt(row.week), year: parseInt(row.year), cases: parseInt(row.cases) || 0 })
  }
  return { rows, errors }
}

export default function DengueInputPanel({ dengueCounts, onUpload, onSave }) {
  const [mode, setMode]           = useState('upload') // 'upload' | 'manual'
  const [manualRows, setManual]   = useState(() => {
    const { week, year } = getCurrentWeekYear()
    return DISTRICTS.map(d => ({ district: d, week, year, cases: '' }))
  })
  const [weekInput, setWeekInput] = useState(() => getCurrentWeekYear().week)
  const [yearInput, setYearInput] = useState(() => getCurrentWeekYear().year)
  const [file, setFile]           = useState(null)
  const [preview, setPreview]     = useState(null)
  const [parseErrors, setErrors]  = useState([])
  const [saving, setSaving]       = useState(false)
  const [message, setMessage]     = useState(null)
  const fileRef = useRef()

  const handleFileChange = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const { rows, errors } = parseCSV(ev.target.result)
      setPreview(rows)
      setErrors(errors)
    }
    reader.readAsText(f)
  }

  const handleUploadSave = async () => {
    if (!preview?.length) return
    setSaving(true)
    try {
      await onSave(preview)
      setMessage({ type: 'success', text: `Saved ${preview.length} records successfully` })
      setFile(null); setPreview(null); setErrors([])
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 4000)
    }
  }

  const updateManualRow = (district, val) => {
    setManual(rows => rows.map(r => r.district === district ? { ...r, cases: val } : r))
  }

  const updateAllWeek = (week, year) => {
    setWeekInput(week); setYearInput(year)
    setManual(rows => rows.map(r => ({ ...r, week, year })))
  }

  const handleManualSave = async () => {
    const valid = manualRows.filter(r => r.cases !== '' && !isNaN(parseInt(r.cases)))
    if (!valid.length) { setMessage({ type: 'error', text: 'Enter at least one case count' }); return }
    setSaving(true)
    try {
      await onSave(valid.map(r => ({ ...r, cases: parseInt(r.cases) })))
      setMessage({ type: 'success', text: `Saved ${valid.length} district records` })
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 4000)
    }
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, marginBottom: 2 }}>
            Weekly Dengue Case Counts
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Input reported cases per district to improve ML predictions
          </p>
        </div>
        <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 8, padding: 3, gap: 3 }}>
          {['upload','manual'].map(m => (
            <button
              key={m}
              className="btn"
              style={{
                padding: '5px 14px', fontSize: 12,
                background: mode === m ? 'var(--bg-card)' : 'transparent',
                border: mode === m ? '1px solid var(--border-strong)' : '1px solid transparent',
                color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)'
              }}
              onClick={() => setMode(m)}
            >
              {m === 'upload' ? '↑ Upload CSV' : '✏ Enter Manually'}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13,
          background: message.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${message.type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          color: message.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'
        }}>
          {message.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {message.text}
        </div>
      )}

      {mode === 'upload' && (
        <div>
          {/* Template hint */}
          <div style={{
            padding: '10px 14px',
            background: 'rgba(59,130,246,0.07)',
            border: '1px solid rgba(59,130,246,0.15)',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 12,
            color: 'var(--text-secondary)'
          }}>
            <strong style={{ color: 'var(--accent-blue)' }}>CSV format required:</strong>{' '}
            <code style={{ fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 3 }}>
              district,week,year,cases
            </code>
            {' — e.g. Colombo,22,2025,47'}
          </div>

          <div
            style={{
              border: `2px dashed ${file ? 'var(--accent-blue)' : 'var(--border-strong)'}`,
              borderRadius: 10,
              padding: 32,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: file ? 'rgba(59,130,246,0.04)' : 'transparent'
            }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              const f = e.dataTransfer.files[0]
              if (f) { fileRef.current.files = e.dataTransfer.files; handleFileChange({ target: { files: [f] } }) }
            }}
          >
            <Upload size={28} style={{ color: file ? 'var(--accent-blue)' : 'var(--text-muted)', marginBottom: 10 }} />
            <p style={{ fontSize: 14, color: file ? 'var(--text-primary)' : 'var(--text-secondary)', marginBottom: 4 }}>
              {file ? file.name : 'Drop CSV file here or click to browse'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {file ? `${preview?.length ?? 0} rows parsed` : '.csv files only'}
            </p>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
          </div>

          {parseErrors.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {parseErrors.map((err, i) => (
                <p key={i} style={{ fontSize: 11, color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <AlertCircle size={11} /> {err}
                </p>
              ))}
            </div>
          )}

          {preview?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Preview ({preview.length} rows):</p>
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                <table className="data-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>District</th><th>Week</th><th>Year</th><th>Cases</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 30).map((r, i) => (
                      <tr key={i}>
                        <td>{r.district}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{r.week}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{r.year}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-yellow)' }}>{r.cases}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="btn btn-success" onClick={handleUploadSave} disabled={saving}>
                  {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Save size={14} />}
                  Save {preview.length} Records
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'manual' && (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>WEEK</label>
              <input
                type="number" min={1} max={52} value={weekInput}
                style={{ width: 80 }}
                onChange={e => updateAllWeek(parseInt(e.target.value) || 1, yearInput)}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>YEAR</label>
              <input
                type="number" min={2020} max={2099} value={yearInput}
                style={{ width: 90 }}
                onChange={e => updateAllWeek(weekInput, parseInt(e.target.value) || 2025)}
              />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', paddingBottom: 6 }}>
              Enter case counts for W{String(weekInput).padStart(2,'0')} {yearInput}
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 10,
            maxHeight: 380,
            overflowY: 'auto',
            paddingRight: 4
          }}>
            {manualRows.map(row => (
              <div key={row.district} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px',
                border: row.cases !== '' ? '1px solid rgba(234,179,8,0.2)' : '1px solid var(--border)'
              }}>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>{row.district}</span>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={row.cases}
                  onChange={e => updateManualRow(row.district, e.target.value)}
                  style={{
                    width: 64, textAlign: 'right',
                    fontFamily: 'var(--font-mono)', fontSize: 13,
                    color: 'var(--accent-yellow)',
                    background: 'transparent',
                    border: 'none', borderBottom: '1px solid var(--border-strong)',
                    borderRadius: 0, padding: '2px 4px'
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn btn-success" onClick={handleManualSave} disabled={saving}>
              {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Save size={14} />}
              Save Week {weekInput}
            </button>
          </div>
        </div>
      )}

      {/* Existing data summary */}
      {dengueCounts?.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            EXISTING RECORDS: {dengueCounts.length} rows across{' '}
            {new Set(dengueCounts.map(r => `${r.week}_${r.year}`)).size} weeks
          </p>
        </div>
      )}
    </div>
  )
}