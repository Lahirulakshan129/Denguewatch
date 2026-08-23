import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { DISTRICT_COORDINATES } from '../utils/districtsGeo';
import HeatmapLayer from './HeatmapLayer';

export default function SriLankaMap({ predictions, onDistrictClick, selectedDistrict }) {
  // Map predictions to districts
  const predMap = {};
  predictions.forEach(p => { predMap[p.district] = p });

  // Generate heatmap points: [lat, lng, intensity (cases)]
  const heatPoints = Object.keys(DISTRICT_COORDINATES).map(name => {
    const pos = DISTRICT_COORDINATES[name];
    const pred = predMap[name];
    const cases = pred ? parseInt(pred.predicted_cases) || 0 : 0;
    const intensity = pred ? Math.max(cases, 8) : 0;
    return [pos[0], pos[1], intensity];
  }).filter(p => p[2] > 0)

  return (
    <div style={{ position: 'relative', width: '100%', height: '400px', borderRadius: '12px', overflow: 'hidden' }}>
      <MapContainer 
        center={[7.8731, 80.7718]} 
        zoom={7} 
        style={{ height: '100%', width: '100%', background: '#1a1a1a' }}
        zoomControl={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        dragging={false}
      >
        {/* Dark Matter tile layer for premium dark UI */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {/* The actual Heatmap layer driven by predicted dengue cases */}
        <HeatmapLayer points={heatPoints} />

        {/* Invisible or subtle clickable markers over each district for interaction */}
        {Object.keys(DISTRICT_COORDINATES).map(name => {
          const pos = DISTRICT_COORDINATES[name];
          const isSelected = selectedDistrict === name;
          const pred = predMap[name];
          const cases = pred ? parseInt(pred.predicted_cases) || 0 : 0;

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
                  <strong>{name}</strong><br/>
                  {cases} Predicted Cases
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Custom Legend Overlay */}
      <div style={{ 
        position: 'absolute', bottom: 10, left: 10, zIndex: 1000, 
        background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: '8px',
        backdropFilter: 'blur(4px)', display: 'flex', gap: '10px', alignItems: 'center'
      }}>
        <span style={{ fontSize: '10px', color: '#fff', fontWeight: 500 }}>Dengue Hotspots:</span>
        <div style={{ width: '80px', height: '8px', background: 'linear-gradient(to right, green, yellow, orange, red, purple)', borderRadius: '4px' }}></div>
      </div>
    </div>
  );
}