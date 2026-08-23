import React from 'react';
import RiskBadge from './RiskBadge.jsx';

const conditionIcon = {
    'Sunny': '☀️',
    'Partly Cloudy': '⛅',
    'Overcast': '☁️',
    'Light Rain': '🌦️',
    'Heavy Rain': '🌧️',
    'Thunderstorm': '⛈️',
};

export function WeatherTable({ records }) {
    return (
        <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
                <thead>
                <tr>
                    <th>Date</th>
                    <th>Condition</th>
                    <th>Temp (°C)</th>
                    <th>Humidity (%)</th>
                    <th>Rainfall (mm)</th>
                    <th>Wind (km/h)</th>
                    <th>Dengue Risk</th>
                </tr>
                </thead>
                <tbody>
                {records.map((r) => (
                    <tr key={r.date}>
                        <td>
                <span className="font-mono" style={{ fontSize: 13 }}>
                  {r.date}
                </span>
                        </td>
                        <td>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{conditionIcon[r.condition] || '🌡️'}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{r.condition}</span>
                </span>
                        </td>
                        <td>
                <span style={{
                    color: r.temperature > 30 ? '#f87171' : r.temperature > 27 ? '#fbbf24' : '#60a5fa',
                    fontFamily: 'JetBrains Mono',
                    fontWeight: 500
                }}>
                  {r.temperature}
                </span>
                        </td>
                        <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                    width: 48, height: 4, background: 'var(--border)',
                                    borderRadius: 2, overflow: 'hidden'
                                }}>
                                    <div style={{
                                        width: `${r.humidity}%`, height: '100%',
                                        background: r.humidity > 80 ? '#f87171' : '#4ade80',
                                        borderRadius: 2
                                    }} />
                                </div>
                                <span className="font-mono" style={{ fontSize: 13 }}>{r.humidity}</span>
                            </div>
                        </td>
                        <td>
                <span className="font-mono" style={{
                    fontSize: 13,
                    color: r.rainfall > 25 ? '#f87171' : r.rainfall > 10 ? '#fbbf24' : 'var(--text-primary)'
                }}>
                  {r.rainfall}
                </span>
                        </td>
                        <td>
                <span className="font-mono" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {r.windSpeed}
                </span>
                        </td>
                        <td>
                            <RiskBadge score={r.dengueRiskScore} />
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}