import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { DISTRICT_COORDINATES } from '../utils/districtsGeo'
import HeatmapLayer from './HeatmapLayer'
import ErrorBoundary from './ErrorBoundary'

function MapInner({ predictions, onDistrictClick, selectedDistrict }) {
  const predMap = {}
  ;(predictions || []).forEach(p => { predMap[p.district] = p })

  const heatPoints = Object.keys(DISTRICT_COORDINATES).map(name => {
    const pos = DISTRICT_COORDINATES[name]
    const pred = predMap[name]
    const cases = pred ? parseInt(pred.predicted_cases) || 0 : 0
    const intensity = pred ? Math.max(cases, 8) : 0
    return [pos[0], pos[1], intensity]
  }).filter(p => p[2] > 0)

  const tileUrl = import.meta.env.VITE_CARTO_API_KEY
    ? `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${import.meta.env.VITE_CARTO_API_KEY}`
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png'

  return (
    <MapContainer
      center={[7.8731, 80.7718]}
      zoom={7}
      style={{ height: '100%', width: '100%', background: '#1a1a1a' }}
      zoomControl={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      dragging={false}
    >
      <TileLayer
        url={tileUrl}
        attribution='&copy; OpenStreetMap, &copy; CARTO'
        subdomains="abcd"
        maxZoom={20}
      />
      <HeatmapLayer points={heatPoints} />
      {Object.keys(DISTRICT_COORDINATES).map(name => {
        const pos = DISTRICT_COORDINATES[name]
        if (!pos) return null
        const isSelected = selectedDistrict === name
        const pred = predMap[name]
        const cases = pred ? parseInt(pred.predicted_cases) || 0 : 0
        return (
          <CircleMarker
            key={name}
            center={pos}
            radius={isSelected ? 10 : 8}
            fillColor={isSelected ? '#ffffff' : 'transparent'}
            fillOpacity={isSelected ? 0.3 : 0}
            color={isSelected ? '#ffffff' : 'rgba(255,255,255,0.2)'}
            weight={isSelected ? 2 : 1}
            eventHandlers={{
              click: () => onDistrictClick?.(name),
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={1}>
              <div style={{ textAlign: 'center' }}>
                <strong>{name}</strong><br />
                {cases} Predicted Cases
              </div>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}

export default function SriLankaMap(props) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setReady(true)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '400px', borderRadius: '12px', overflow: 'hidden' }}>
      {ready ? (
        <ErrorBoundary title="Map failed to load">
          <MapInner {...props} />
        </ErrorBoundary>
      ) : (
        <div style={{ height: '100%', background: '#1a1a1a' }} />
      )}
      <div style={{
        position: 'absolute', bottom: 10, left: 10, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: '8px',
        backdropFilter: 'blur(4px)', display: 'flex', gap: '10px', alignItems: 'center',
      }}>
        <span style={{ fontSize: '10px', color: '#fff', fontWeight: 500 }}>Dengue Hotspots:</span>
        <div style={{ width: '80px', height: '8px', background: 'linear-gradient(to right, green, yellow, orange, red, purple)', borderRadius: '4px' }} />
      </div>
    </div>
  )
}
