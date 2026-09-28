import { useState } from 'react'
import { Download, CheckCircle, AlertCircle } from 'lucide-react'
import { downloadTrainingCsv, downloadWeatherCsv, downloadPredictionsCsv } from '../../api/weatherApi'

export default function DatasetInputPanel() {
  const [message, setMessage] = useState(null)

  const handleDownload = async (kind) => {
    try {
      if (kind === 'weather') await downloadWeatherCsv()
      else if (kind === 'predictions') await downloadPredictionsCsv()
      else await downloadTrainingCsv()
    } catch (e) {
      setMessage({ type: 'error', text: e.message || 'Failed to download CSV' })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
          Export Datasets:
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => handleDownload('training')} style={{ padding: '8px 12px', fontSize: 11, background: 'var(--bg-elevated)' }}>
            <Download size={14} /> Training CSV
          </button>
          <button className="btn" onClick={() => handleDownload('weather')} style={{ padding: '8px 12px', fontSize: 11, background: 'var(--bg-elevated)' }}>
            <Download size={14} /> Weather
          </button>
          <button className="btn" onClick={() => handleDownload('predictions')} style={{ padding: '8px 12px', fontSize: 11, background: 'var(--bg-elevated)' }}>
            <Download size={14} /> Predictions
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 8, marginTop: 12, fontSize: 13,
          background: message.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${message.type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          color: message.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'
        }}>
          {message.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {message.text}
        </div>
      )}
    </div>
  )
}
