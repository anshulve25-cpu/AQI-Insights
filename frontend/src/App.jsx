import React, { useRef, useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
window.L = window.L || L;
import 'leaflet.heat';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ChartTooltip, Legend, ResponsiveContainer
} from 'recharts';

// ─── Icons ────────────────────────────────────────────────────────────────────

const radarBlipIcon = new L.divIcon({
  className: '',
  html: `<div style="position:relative;width:14px;height:14px;display:flex;align-items:center;justify-content:center;">
    <span style="position:absolute;inset:0;border-radius:50%;background:rgba(56,189,248,0.45);animation:blip-ping 1.6s cubic-bezier(0,0,0.2,1) infinite;"></span>
    <span style="position:relative;width:7px;height:7px;border-radius:50%;background:#38bdf8;box-shadow:0 0 8px 2px rgba(56,189,248,0.8);"></span>
  </div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const droneBlipIcon = new L.divIcon({
  className: '',
  html: `<div style="position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center;">
    <div style="position:absolute;inset:0;border:1.5px dashed rgba(232,121,249,0.6);border-radius:50%;animation:blip-spin 5s linear infinite;"></div>
    <div style="position:absolute;width:20px;height:1px;background:rgba(232,121,249,0.65);"></div>
    <div style="position:absolute;width:1px;height:20px;background:rgba(232,121,249,0.65);"></div>
    <div style="width:7px;height:7px;background:#e879f9;transform:rotate(45deg);box-shadow:0 0 12px 3px rgba(232,121,249,0.85);"></div>
  </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// ─── Constants ────────────────────────────────────────────────────────────────

const DRONE_IDS    = ['DRONE-01', 'DRONE-02', 'DRONE-03'];
const DRONE_COLORS = { 'DRONE-01': '#f87171', 'DRONE-02': '#fbbf24', 'DRONE-03': '#34d399' };

const CAMPUS_LOCATIONS = [
  { name: 'James Thomason Bldg',  coords: [29.8649, 77.8966] },
  { name: 'Lecture Hall Complex', coords: [29.8665, 77.8940] },
  { name: 'Ravindra Bhawan',      coords: [29.8615, 77.9025] },
  { name: 'Kasturba Bhawan',      coords: [29.8655, 77.9015] },
  { name: 'Hydrology Dept',       coords: [29.8690, 77.8955] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function aqiBand(aqi) {
  if (aqi <= 50)  return { label: 'Good',      color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  };
  if (aqi <= 100) return { label: 'Moderate',  color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  };
  if (aqi <= 150) return { label: 'Unhealthy', color: '#f97316', bg: 'rgba(249,115,22,0.12)'  };
  return              { label: 'Hazardous', color: '#f87171', bg: 'rgba(248,113,113,0.18)' };
}

function fmt(n) { return typeof n === 'number' ? Math.round(n) : '—'; }

// ─── Small UI pieces ──────────────────────────────────────────────────────────

function StatusDot({ connected, hazard }) {
  const color = !connected ? '#6b7280' : hazard ? '#f87171' : '#4ade80';
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: color, boxShadow: `0 0 6px ${color}`,
      animation: connected ? 'pulse-dot 2s ease-in-out infinite' : 'none',
      flexShrink: 0,
    }} />
  );
}

function InfoRow({ label, value, color, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{
        fontSize: 11, color: color || '#cbd5e1', fontWeight: 500,
        fontFamily: mono ? "'JetBrains Mono', monospace" : "'Inter', sans-serif",
        textAlign: 'right',
      }}>{value}</span>
    </div>
  );
}

function DroneRow({ id, stat }) {
  if (!stat) return (
    <div style={S.droneRow}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#334155', flexShrink: 0 }} />
        <span style={S.droneLabel}>{id}</span>
      </div>
      <span style={{ ...S.badge, color: '#64748b', borderColor: 'rgba(100,116,139,0.3)', background: 'transparent' }}>
        Standby
      </span>
    </div>
  );
  const band = aqiBand(stat.aqi);
  return (
    <div style={S.droneRow}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: DRONE_COLORS[id] || '#38bdf8',
          boxShadow: `0 0 5px ${DRONE_COLORS[id] || '#38bdf8'}`,
        }} />
        <span style={S.droneLabel}>{id}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: '#64748b' }}>{stat.status || ''}</span>
        <span style={{ ...S.badge, color: band.color, borderColor: band.color + '55', background: band.bg }}>
          {fmt(stat.aqi)}
        </span>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(8,15,28,0.97)', border: '1px solid rgba(56,189,248,0.2)',
      borderRadius: 8, padding: '8px 12px', fontSize: 11,
    }}>
      <p style={{ color: '#64748b', marginBottom: 5, fontSize: 10 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color, margin: '2px 0', fontWeight: 600 }}>
          {p.dataKey}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const mapRef          = useRef(null);
  const droneMarkersRef = useRef({});
  const heatLayerRef    = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [currentTime,  setCurrentTime]  = useState(new Date());
  const [fleetStats,   setFleetStats]   = useState({});
  const [chartData,    setChartData]    = useState([]);
  const [hazardAlert,  setHazardAlert]  = useState({ active: false, triggerDrone: null });

  // Clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Historical telemetry
  useEffect(() => {
    fetch('http://localhost:8000/api/telemetry/history')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.history) setChartData(data.history); })
      .catch(() => {});
  }, []);

  // WebSocket
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/telemetry');
    ws.onopen  = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

    ws.onmessage = ({ data: raw }) => {
      const payload = JSON.parse(raw);
      if (!payload.drones) return;

      setFleetStats(payload.drones);

      const hazardDrone = Object.entries(payload.drones).find(([, d]) => d.aqi > 140)?.[0] ?? null;
      setHazardAlert({ active: !!hazardDrone, triggerDrone: hazardDrone });

      const timeStr = payload.timestamp
        ? new Date(payload.timestamp).toLocaleTimeString([], { hour12: false })
        : new Date().toLocaleTimeString([], { hour12: false });
      const point = { time: timeStr };
      Object.entries(payload.drones).forEach(([id, d]) => { point[id] = Math.round(d.aqi); });
      setChartData(prev => {
        const next = [...prev, point];
        return next.length > 30 ? next.slice(-30) : next;
      });

      const map = mapRef.current;
      if (!map) return;

      Object.entries(payload.drones).forEach(([id, d]) => {
        if (!droneMarkersRef.current[id]) {
          const marker = L.marker([d.lat, d.lng], { icon: droneBlipIcon }).addTo(map);
          marker.bindTooltip(id, {
            permanent: true, direction: 'top', offset: [0, -14],
            className: 'drone-tt',
          });
          droneMarkersRef.current[id] = marker;
        } else {
          droneMarkersRef.current[id].setLatLng([d.lat, d.lng]);
        }
      });

      if (payload.heatmap?.length > 0) {
        if (!heatLayerRef.current) {
          heatLayerRef.current = L.heatLayer(payload.heatmap, {
            radius: 22, blur: 38, maxZoom: 15, max: 1.0, minOpacity: 0.0,
            gradient: { 0.35: '#22c55e', 0.6: '#eab308', 0.8: '#f97316', 1.0: '#ef4444' },
          }).addTo(map);
        } else {
          heatLayerRef.current.setLatLngs(payload.heatmap);
        }
      }
    };

    return () => {
      ws.close();
      Object.values(droneMarkersRef.current).forEach(m => m.remove());
      droneMarkersRef.current = {};
      heatLayerRef.current?.remove();
      heatLayerRef.current = null;
    };
  }, []);

  const exportCSV = useCallback(() => {
    if (!chartData.length) return;
    const header = ['Time', ...DRONE_IDS].join(',');
    const rows   = chartData.map(r => [r.time || '', ...DRONE_IDS.map(id => r[id] ?? 0)].join(','));
    const blob   = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `aqi_report_${Date.now()}.csv`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }, [chartData]);

  const activeCount = Object.keys(fleetStats).length;
  const avgAqi = activeCount
    ? Math.round(Object.values(fleetStats).reduce((s, d) => s + d.aqi, 0) / activeCount)
    : null;

  return (
    <div style={S.root}>

      {/* ── Injected CSS ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes blip-ping {
          0%   { transform: scale(1);   opacity: 0.7; }
          70%  { transform: scale(2.2); opacity: 0;   }
          100% { transform: scale(2.2); opacity: 0;   }
        }
        @keyframes blip-spin  { to { transform: rotate(360deg); } }
        @keyframes pulse-dot  { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
        @keyframes hazard-rim { 0%,100%{opacity:1;} 50%{opacity:0.55;} }
        @keyframes slide-in   {
          from { opacity:0; transform:translateX(-50%) translateY(-10px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0);     }
        }

        /* Leaflet tooltip resets */
        .leaflet-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .leaflet-tooltip::before { display: none !important; }

        .drone-tt {
          color: #e879f9 !important;
          font-family: 'JetBrains Mono', monospace !important;
          font-size: 10px !important;
          font-weight: 600 !important;
          letter-spacing: 0.1em !important;
          text-shadow: 0 0 8px rgba(232,121,249,0.9) !important;
        }
        .campus-tt {
          color: #94a3b8 !important;
          font-family: 'Inter', sans-serif !important;
          font-size: 10px !important;
          font-weight: 500 !important;
          letter-spacing: 0.05em !important;
          text-transform: uppercase !important;
        }
      `}</style>

      {/* ── MAP ── */}
      <MapContainer
        center={[29.8649, 77.8966]}
        zoom={15}
        ref={mapRef}
        style={{ position: 'absolute', inset: 0, zIndex: 0 }}
        zoomControl={false}
      >
        {/* Using OpenStreetMap tiles — always available, no API key needed */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {CAMPUS_LOCATIONS.map((loc, i) => (
          <Marker key={i} position={loc.coords} icon={radarBlipIcon}>
            <Tooltip permanent direction="top" offset={[0, -10]} className="campus-tt">
              {loc.name}
            </Tooltip>
          </Marker>
        ))}
        <Circle
          center={[29.8690, 77.8955]}
          radius={65}
          pathOptions={{ color: '#f97316', weight: 1.5, fillColor: '#f97316', fillOpacity: 0.07, dashArray: '5 5' }}
        >
          <Tooltip permanent direction="bottom" offset={[0, 10]} className="campus-tt"
            style={{ color: '#f97316 !important' }}>
            Critical Zone
          </Tooltip>
        </Circle>
      </MapContainer>

      {/* ── HAZARD RIM ── */}
      {hazardAlert.active && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 9998, pointerEvents: 'none',
          border: '3px solid rgba(248,113,113,0.55)',
          boxShadow: 'inset 0 0 90px rgba(239,68,68,0.15)',
          animation: 'hazard-rim 1.4s ease-in-out infinite',
        }} />
      )}

      {/* ── OFFLINE SCREEN ── */}
      {!isConnected && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 99999,
          background: 'rgba(3,9,18,0.93)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 26, fontWeight: 700, color: '#f87171', letterSpacing: '0.06em', marginBottom: 10 }}>
              Connection Lost
            </p>
            <p style={{ fontSize: 12, color: 'rgba(248,113,113,0.5)', letterSpacing: '0.08em' }}>
              Attempting to reconnect to telemetry server…
            </p>
          </div>
        </div>
      )}

      {/* ── HAZARD BANNER ── */}
      {hazardAlert.active && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', zIndex: 10000,
          transform: 'translateX(-50%)',
          animation: 'slide-in 0.25s ease both',
          background: 'rgba(10,3,3,0.9)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 8, padding: '9px 18px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 0 24px rgba(239,68,68,0.18)',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f87171', animation: 'pulse-dot 0.9s ease-in-out infinite', flexShrink: 0 }} />
          <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 12, color: '#fca5a5', letterSpacing: '0.05em' }}>
            Critical AQI — {hazardAlert.triggerDrone}
          </span>
          <span style={{ fontSize: 11, color: 'rgba(248,113,113,0.7)' }}>Evacuation advisory active</span>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f87171', animation: 'pulse-dot 0.9s ease-in-out infinite 0.45s', flexShrink: 0 }} />
        </div>
      )}

      {/* ── TOP-LEFT: System Status ── */}
      <div style={{ ...S.panel, top: 16, left: 16, width: 230 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <StatusDot connected={isConnected} hazard={hazardAlert.active} />
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, color: '#e2e8f0', letterSpacing: '0.08em' }}>
            {isConnected ? (hazardAlert.active ? 'HAZARD OVERRIDE' : 'TELEMETRY LIVE') : 'OFFLINE'}
          </span>
        </div>
        <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <InfoRow label="Time"    value={currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} mono />
          <InfoRow label="Zone"    value="IIT Roorkee" />
          <InfoRow label="Units"   value={`${activeCount} / 3`} color={activeCount === 3 ? '#4ade80' : '#fbbf24'} />
          {avgAqi !== null && <InfoRow label="Avg AQI" value={fmt(avgAqi)} color={aqiBand(avgAqi).color} mono />}
        </div>
      </div>

      {/* ── TOP-RIGHT: AQI Scale ── */}
      <div style={{ ...S.panel, top: 16, right: 16, width: 190 }}>
        <p style={S.panelTitle}>AQI Scale</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 6 }}>
          {[
            { range: '0 – 50',    label: 'Good',      color: '#4ade80' },
            { range: '51 – 100',  label: 'Moderate',  color: '#fbbf24' },
            { range: '101 – 150', label: 'Unhealthy', color: '#f97316' },
            { range: '150+',      label: 'Hazardous', color: '#f87171' },
          ].map(b => (
            <div key={b.range} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: b.color, flexShrink: 0, boxShadow: `0 0 4px ${b.color}` }} />
              <span style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>{b.range}</span>
              <span style={{ fontSize: 10, color: '#475569' }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── BOTTOM-LEFT: Fleet ── */}
      <div style={{ ...S.panel, bottom: 16, left: 16, width: 260 }}>
        <p style={S.panelTitle}>UAV Fleet</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
          {DRONE_IDS.map(id => <DroneRow key={id} id={id} stat={fleetStats[id]} />)}
        </div>
      </div>

      {/* ── BOTTOM-RIGHT: Chart ── */}
      <div style={{ ...S.panel, bottom: 16, right: 16, width: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <p style={S.panelTitle}>AQI Over Time</p>
            <p style={{ fontSize: 9, color: '#334155', marginTop: 1 }}>Last 30 readings</p>
          </div>
          <button onClick={exportCSV} style={S.exportBtn}>Export CSV</button>
        </div>
        <ResponsiveContainer width="100%" height={145}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" vertical={false} />
            <XAxis dataKey="time" stroke="#1e293b" fontSize={9} tick={{ fill: '#475569' }} tickMargin={5} minTickGap={22} />
            <YAxis stroke="#1e293b" fontSize={9} tick={{ fill: '#475569' }} domain={[0, 'dataMax + 20']} tickCount={4} />
            <ChartTooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 10, color: '#64748b', paddingTop: 6 }} />
            {DRONE_IDS.map(id => (
              <Line key={id} type="stepAfter" dataKey={id} stroke={DRONE_COLORS[id]}
                strokeWidth={1.8} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  root: {
    position: 'relative', width: '100vw', height: '100vh',
    background: '#060d1a', overflow: 'hidden',
    fontFamily: "'Inter', sans-serif",
  },
  panel: {
    position: 'absolute', zIndex: 1000,
    background: 'rgba(6,14,26,0.85)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(148,163,184,0.1)',
    borderRadius: 10,
    padding: '14px 16px',
    boxShadow: '0 4px 30px rgba(0,0,0,0.5)',
  },
  panelTitle: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
    color: '#475569', textTransform: 'uppercase',
  },
  droneRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 0', borderBottom: '1px solid rgba(148,163,184,0.06)',
  },
  droneLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11, color: '#94a3b8', fontWeight: 600,
  },
  badge: {
    fontSize: 10, fontWeight: 700,
    border: '1px solid', borderRadius: 4, padding: '2px 7px',
    fontFamily: "'JetBrains Mono', monospace",
  },
  exportBtn: {
    background: 'rgba(56,189,248,0.07)',
    border: '1px solid rgba(56,189,248,0.22)',
    borderRadius: 5, padding: '4px 10px',
    fontSize: 10, fontWeight: 600, color: '#7dd3fc',
    cursor: 'pointer', letterSpacing: '0.04em',
  },
};

export default App;