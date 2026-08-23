import { useState, useRef } from 'react'
import { Upload, Save, FileText, CheckCircle, AlertCircle, Download } from 'lucide-react'
import axios from 'axios'

export default function DatasetInputPanel() {
  const [file, setFile]           = useState(null)
  const [message, setMessage]     = useState(null)
  const [saving, setSaving]       = useState(false)
  const fileRef = useRef()

  const handleFileChange = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
  }

  const handleUploadSave = async () => {
    if (!file) return
    setSaving(true)
    
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await axios.post('/api/dataset/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setMessage({ type: 'success', text: `Successfully saved ${res.data.count} records to database!` })
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.message || e.message })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 5000)
    }
  }

  const handleDownload = async () => {
    try {
      const res = await axios.get('/api/dataset/download', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'training_dataset.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to download dataset' })
    }
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, marginBottom: 2 }}>
            Master Dataset (DB Table)
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Upload or download the complete historical dataset (weather + dengue cases)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={handleDownload} style={{ padding: '8px 14px', fontSize: 12, background: 'var(--bg-elevated)' }}>
            <Download size={14} /> Download CSV
          </button>
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

      <div>
        <div style={{
          padding: 32, border: '1px dashed var(--border-strong)', borderRadius: 8,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          background: 'var(--bg-elevated)'
        }}>
          <FileText size={32} style={{ color: 'var(--text-muted)' }} />
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {file ? file.name : "Select CSV matching the exact training model headers"}
          </p>
          <input
            type="file"
            accept=".csv"
            ref={fileRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="csv-upload"
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={() => document.getElementById('csv-upload').click()} style={{ fontSize: 12 }}>
              Choose File
            </button>
            {file && (
              <button 
                className="btn btn-primary" 
                onClick={handleUploadSave} 
                disabled={saving}
                style={{ fontSize: 12 }}
              >
                {saving ? <span className="spinner" /> : <Upload size={14} />} 
                Save to Database
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
