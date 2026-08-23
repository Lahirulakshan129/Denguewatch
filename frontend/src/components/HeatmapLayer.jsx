import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export default function HeatmapLayer({ points }) {
    const map = useMap();

    useEffect(() => {
        if (!map || !points || points.length === 0) return;

        let heat;
        // leaflet.heat requires L to be attached to window
        window.L = L;
        
        import('leaflet.heat').then(() => {
            heat = L.heatLayer(points, {
                radius: 35,
                blur: 25,
                maxZoom: 10,
                max: 100,
                gradient: {
                    0.2: 'green',
                    0.4: 'yellow',
                    0.6: 'orange',
                    0.8: 'red',
                    1.0: 'purple'
                }
            });
            heat.addTo(map);
        }).catch(err => console.error("Failed to load leaflet.heat", err));

        return () => {
            if (heat && map) {
                map.removeLayer(heat);
            }
        };
    }, [map, points]);

    return null;
}
