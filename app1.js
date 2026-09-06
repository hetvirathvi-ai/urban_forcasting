/* ============================================================
   Urban Flood Nowcasting System — app.js
   Mock/sample data prototype. Wire up real APIs here.
   ============================================================ */

'use strict';

// ─────────────────────────────────────────────────────────────
// DATA STORE
// ─────────────────────────────────────────────────────────────
const ZONES = [
  { id:'Z1', name:'Dharavi',     ward:'Ward-A', lat:19.041,  lng:72.854, rainfall:68, capacity:500, inflow:580, runoff:540, risk:'HIGH',     drain:92, traffic:'Heavy slowdown', reports:3 },
  { id:'Z2', name:'Kurla',       ward:'Ward-B', lat:19.071,  lng:72.879, rainfall:55, capacity:420, inflow:420, runoff:380, risk:'MEDIUM',   drain:70, traffic:'Moderate',       reports:1 },
  { id:'Z3', name:'Andheri E',   ward:'Ward-C', lat:19.115,  lng:72.869, rainfall:78, capacity:380, inflow:490, runoff:470, risk:'CRITICAL', drain:98, traffic:'Severe block',    reports:5 },
  { id:'Z4', name:'Bandra',      ward:'Ward-D', lat:19.059,  lng:72.834, rainfall:30, capacity:460, inflow:280, runoff:260, risk:'LOW',      drain:42, traffic:'Normal',          reports:0 },
  { id:'Z5', name:'Goregaon',    ward:'Ward-E', lat:19.157,  lng:72.850, rainfall:48, capacity:400, inflow:350, runoff:320, risk:'MEDIUM',   drain:65, traffic:'Slow',            reports:2 },
  { id:'Z6', name:'Chembur',     ward:'Ward-F', lat:19.052,  lng:72.900, rainfall:22, capacity:480, inflow:210, runoff:190, risk:'LOW',      drain:28, traffic:'Normal',          reports:0 },
  { id:'Z7', name:'Mulund',      ward:'Ward-G', lat:19.172,  lng:72.956, rainfall:35, capacity:350, inflow:290, runoff:270, risk:'MEDIUM',   drain:58, traffic:'Slight delay',    reports:1 },
  { id:'Z8', name:'Malad',       ward:'Ward-H', lat:19.188,  lng:72.848, rainfall:61, capacity:390, inflow:430, runoff:400, risk:'HIGH',     drain:87, traffic:'Heavy',           reports:4 },
  { id:'Z9', name:'Borivali',    ward:'Ward-I', lat:19.228,  lng:72.856, rainfall:18, capacity:440, inflow:170, runoff:155, risk:'LOW',      drain:22, traffic:'Normal',          reports:0 },
  { id:'Z10',name:'Vikhroli',    ward:'Ward-J', lat:19.106,  lng:72.926, rainfall:44, capacity:360, inflow:330, runoff:310, risk:'MEDIUM',   drain:62, traffic:'Moderate',        reports:1 },
  { id:'Z11',name:'Jogeshwari',  ward:'Ward-K', lat:19.136,  lng:72.849, rainfall:58, capacity:370, inflow:390, runoff:365, risk:'HIGH',     drain:84, traffic:'Heavy',           reports:3 },
  { id:'Z12',name:'Ghatkopar',   ward:'Ward-L', lat:19.083,  lng:72.908, rainfall:39, capacity:430, inflow:310, runoff:290, risk:'MEDIUM',   drain:52, traffic:'Slight delay',    reports:1 },
];

const RISK_COLORS = { LOW:'#22c55e', MEDIUM:'#f59e0b', HIGH:'#ef4444', CRITICAL:'#7c3aed' };
const RISK_CLASS  = { LOW:'low', MEDIUM:'medium', HIGH:'high', CRITICAL:'critical' };

let citizenReports = [
  { icon:'🚗', loc:'Andheri E — SV Road', type:'Traffic Slowdown', time:'12 mins ago' },
  { icon:'💧', loc:'Dharavi — 90-Ft Road', type:'Drain Overflow', time:'18 mins ago' },
  { icon:'🌊', loc:'Malad — Link Road', type:'Flooding Observed', time:'25 mins ago' },
  { icon:'🚗', loc:'Kurla — LBS Marg', type:'Traffic Slowdown', time:'31 mins ago' },
  { icon:'💧', loc:'Jogeshwari — Junction', type:'Drain Overflow', time:'40 mins ago' },
];

let alertFilter = 'all';
let currentRainfall = 42;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function riskClass(r){ return RISK_CLASS[r] || 'low'; }
function riskColor(r){ return RISK_COLORS[r] || '#22c55e'; }
function badgeClass(r){ return `badge-${riskClass(r)}`; }

function scaledInflow(zone, mm) {
  const base = zone.inflow;
  return Math.round(base * (mm / 42));
}

function computeExcess(inflow, cap) {
  const pct = ((inflow - cap) / cap * 100);
  return pct > 0 ? pct.toFixed(1) : null;
}

function riskFromInflow(inflow, cap) {
  const ratio = inflow / cap;
  if (ratio >= 1.3) return 'CRITICAL';
  if (ratio >= 1.0) return 'HIGH';
  if (ratio >= 0.75) return 'MEDIUM';
  return 'LOW';
}

// ─────────────────────────────────────────────────────────────
// NAVBAR
// ─────────────────────────────────────────────────────────────
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('nav-links').classList.toggle('open');
});

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    document.getElementById('nav-links').classList.remove('open');
  });
});

// ─────────────────────────────────────────────────────────────
// MODULE 1 — RAINFALL–DRAINAGE COUPLING
// ─────────────────────────────────────────────────────────────
let couplingChart = null;

function buildCouplingCards(mm) {
  const totalInflow = ZONES.reduce((s,z) => s + scaledInflow(z, mm), 0);
  const totalCap    = ZONES.reduce((s,z) => s + z.capacity, 0);
  const overflowZones = ZONES.filter(z => scaledInflow(z, mm) > z.capacity).length;
  const avgDrain = Math.min(100, Math.round(totalInflow / totalCap * 100));
  const cards = [
    { icon:'🌧️', val:`${mm}`, unit:'mm/hr', label:'Current Rainfall', pct: Math.round(mm/120*100), color:'#3b82f6', badge: mm > 60 ? 'HIGH' : mm > 30 ? 'MEDIUM' : 'LOW' },
    { icon:'🏗️', val: totalCap.toLocaleString(), unit:'m³/hr', label:'Total Drain Capacity', pct: 100, color:'#22c55e', badge:'NORMAL' },
    { icon:'⬇️', val: totalInflow.toLocaleString(), unit:'m³/hr', label:'Total Inflow', pct: Math.min(100, Math.round(totalInflow/totalCap*100)), color: totalInflow > totalCap ? '#ef4444' : '#f59e0b', badge: totalInflow > totalCap ? 'EXCESS' : 'OK' },
    { icon:'⚠️', val: overflowZones, unit:'zones', label:'Overflow Zones', pct: Math.round(overflowZones/ZONES.length*100), color:'#ef4444', badge: overflowZones > 3 ? 'HIGH' : overflowZones > 0 ? 'MEDIUM' : 'LOW' },
  ];
  const container = document.getElementById('coupling-cards');
  container.innerHTML = cards.map(c => `
    <div class="kpi-card">
      <div class="kpi-icon">${c.icon}</div>
      <div class="kpi-val">${c.val} <span style="font-size:.9rem;color:var(--muted)">${c.unit}</span></div>
      <div class="kpi-label">${c.label}</div>
      <span class="kpi-badge ${badgeClass(c.badge === 'NORMAL' || c.badge === 'OK' ? 'LOW' : c.badge === 'EXCESS' ? 'HIGH' : c.badge)}">${c.badge}</span>
      <div class="kpi-bar"><div class="kpi-fill" style="width:${c.pct}%;background:${c.color}"></div></div>
    </div>`).join('');
}

function buildCouplingChart(mm) {
  const labels = ZONES.map(z => z.name);
  const inflows = ZONES.map(z => scaledInflow(z, mm));
  const caps    = ZONES.map(z => z.capacity);
  const ctx = document.getElementById('coupling-chart').getContext('2d');
  if (couplingChart) { couplingChart.destroy(); }
  couplingChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'Inflow (m³/hr)',   data: inflows, backgroundColor: inflows.map((v,i) => v > caps[i] ? 'rgba(239,68,68,.8)' : 'rgba(59,130,246,.7)'), borderRadius:4, borderSkipped:false },
        { label:'Capacity (m³/hr)', data: caps,    backgroundColor:'rgba(34,197,94,.25)', borderColor:'rgba(34,197,94,.6)', borderWidth:2, type:'bar', borderRadius:4, borderSkipped:false },
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:true,
      plugins:{ legend:{ labels:{ color:'#8b9ab4', boxWidth:12 } }, tooltip:{ mode:'index', intersect:false } },
      scales:{
        x:{ ticks:{ color:'#8b9ab4', font:{size:11} }, grid:{ color:'rgba(255,255,255,.04)' } },
        y:{ ticks:{ color:'#8b9ab4', font:{size:11} }, grid:{ color:'rgba(255,255,255,.06)' }, title:{ display:true, text:'m³/hr', color:'#8b9ab4', font:{size:11} } }
      }
    }
  });
}

function buildOverflowTable(mm) {
  const tbody = document.getElementById('overflow-tbody');
  const rows = ZONES.map(z => {
    const inf = scaledInflow(z, mm);
    const exc = computeExcess(inf, z.capacity);
    const risk = riskFromInflow(inf, z.capacity);
    return { name:z.name, inf, cap:z.capacity, exc, risk };
  }).filter(r => r.exc !== null).sort((a,b) => parseFloat(b.exc) - parseFloat(a.exc));
  tbody.innerHTML = rows.length === 0
    ? `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:1.5rem">No overflow detected at current rainfall intensity.</td></tr>`
    : rows.map(r => `<tr>
        <td><strong>${r.name}</strong></td>
        <td>${r.inf.toLocaleString()}</td>
        <td>${r.cap.toLocaleString()}</td>
        <td style="color:var(--high);font-weight:700">+${r.exc}%</td>
        <td><span class="risk-pill ${riskClass(r.risk)}">${r.risk}</span></td>
      </tr>`).join('');
}

function refreshCoupling(mm) {
  buildCouplingCards(mm);
  buildCouplingChart(mm);
  buildOverflowTable(mm);
}

// Slider interaction
document.getElementById('rainfall-slider').addEventListener('input', function() {
  const val = parseInt(this.value);
  currentRainfall = val;
  document.getElementById('rainfall-val').textContent = `${val} mm/hr`;
  refreshCoupling(val);
});

document.getElementById('coupling-refresh').addEventListener('click', () => {
  const newVal = Math.floor(Math.random() * 90) + 15;
  currentRainfall = newVal;
  const slider = document.getElementById('rainfall-slider');
  slider.value = newVal;
  document.getElementById('rainfall-val').textContent = `${newVal} mm/hr`;
  refreshCoupling(newVal);
});

// ─────────────────────────────────────────────────────────────
// MODULE 2 — AI NOWCASTING
// ─────────────────────────────────────────────────────────────
const NOWCAST_PARAMS = [
  { key:'rainfall',    label:'Rainfall Intensity',   val:42, unit:'mm/hr', min:0, max:120 },
  { key:'humidity',    label:'Relative Humidity',    val:88, unit:'%',     min:0, max:100 },
  { key:'drain_load',  label:'Drain Load',           val:74, unit:'%',     min:0, max:100 },
  { key:'soil_sat',    label:'Soil Saturation',      val:65, unit:'%',     min:0, max:100 },
  { key:'temp',        label:'Temperature',          val:28, unit:'°C',    min:10, max:45 },
  { key:'wind',        label:'Wind Speed',           val:12, unit:'km/h',  min:0, max:80 },
];

let nowcastChartInst = null;
let paramValues = {};
NOWCAST_PARAMS.forEach(p => { paramValues[p.key] = p.val; });

function buildParamInputs() {
  const container = document.getElementById('param-list');
  container.innerHTML = NOWCAST_PARAMS.map(p => `
    <div class="param-row" id="pr-${p.key}">
      <div>
        <div class="param-name">${p.label}</div>
        <input type="range" min="${p.min}" max="${p.max}" value="${p.val}" 
          style="width:120px;margin-top:.2rem"
          class="slider" id="slider-${p.key}" 
          oninput="updateParam('${p.key}',this.value)"/>
      </div>
      <div>
        <span class="param-val" id="pval-${p.key}">${p.val}</span>
        <span class="param-unit">${p.unit}</span>
      </div>
    </div>`).join('');
}

function updateParam(key, val) {
  paramValues[key] = parseFloat(val);
  document.getElementById(`pval-${key}`).textContent = val;
}

function computeNowcastRisk() {
  const rain = paramValues.rainfall;
  const drain = paramValues.drain_load;
  const hum = paramValues.humidity;
  const soil = paramValues.soil_sat;
  const score = (rain/120)*0.4 + (drain/100)*0.3 + (hum/100)*0.15 + (soil/100)*0.15;
  let level, pct, color;
  if (score >= 0.75)      { level='CRITICAL'; pct=95; color='#7c3aed'; }
  else if (score >= 0.55) { level='HIGH';     pct=75; color='#ef4444'; }
  else if (score >= 0.35) { level='MEDIUM';   pct=50; color='#f59e0b'; }
  else                    { level='LOW';       pct=20; color='#22c55e'; }
  return { level, pct, score: Math.round(score*100), color };
}

function buildRiskDial(result) {
  const { level, pct, score, color } = result;
  const R = 70, CX = 90, CY = 80;
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const sweepAngle = startAngle + (pct / 100) * Math.PI;

  function polarToXY(angle, r) {
    return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
  }

  // Background arc
  const arcBg = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
  // Filled arc
  const endPt = polarToXY(sweepAngle, R);
  const largeArc = pct > 50 ? 1 : 0;
  const arcFg = `M ${CX - R} ${CY} A ${R} ${R} 0 ${largeArc} 1 ${endPt.x} ${endPt.y}`;
  // Needle
  const needlePt = polarToXY(sweepAngle, R - 10);
  const baseL = polarToXY(sweepAngle - 0.15, 10);
  const baseR = polarToXY(sweepAngle + 0.15, 10);

  const dialHtml = `
    <svg viewBox="0 0 180 100" xmlns="http://www.w3.org/2000/svg" style="width:200px;height:auto;margin:0 auto;display:block">
      <path d="${arcBg}" stroke="rgba(255,255,255,.07)" stroke-width="12" fill="none" stroke-linecap="round"/>
      <path d="${arcFg}" stroke="${color}" stroke-width="12" fill="none" stroke-linecap="round"/>
      <polygon points="${needlePt.x},${needlePt.y} ${baseL.x},${baseL.y} ${baseR.x},${baseR.y}" fill="${color}" opacity=".9"/>
      <circle cx="${CX}" cy="${CY}" r="6" fill="${color}"/>
      <text x="${CX}" y="${CY + 22}" text-anchor="middle" font-size="13" font-weight="900" fill="${color}">${level}</text>
      <text x="${CX}" y="${CY + 34}" text-anchor="middle" font-size="9" fill="#8b9ab4">Risk Score: ${score}%</text>
      <text x="${CX - R}" y="${CY + 14}" text-anchor="middle" font-size="8" fill="#4a5568">LOW</text>
      <text x="${CX + R}" y="${CY + 14}" text-anchor="middle" font-size="8" fill="#4a5568">HIGH</text>
    </svg>`;

  document.getElementById('risk-dial-wrap').innerHTML = dialHtml;

  const descs = {
    LOW: 'Low flood probability. Drainage systems are operating within capacity. Routine monitoring advised.',
    MEDIUM: 'Moderate flood risk. Some drainage stress expected. Precautionary monitoring recommended.',
    HIGH: 'High flood risk. Drainage capacity likely to be exceeded. Prepare response resources.',
    CRITICAL: 'Critical flood alert. Immediate overflow expected. Deploy emergency response immediately.',
  };
  document.getElementById('risk-result-text').innerHTML = `
    <div style="margin-top:.5rem">
      <div class="risk-level-big" style="color:${color}">${level} RISK</div>
      <div class="risk-desc">${descs[level]}</div>
      <div style="margin-top:.75rem;display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap">
        ${['LOW','MEDIUM','HIGH','CRITICAL'].map(l => `<span class="risk-pill ${riskClass(l)}" style="${l===level?'opacity:1':'opacity:.35'}">${l}</span>`).join('')}
      </div>
    </div>`;
}

function buildNowcastTimeline(result) {
  const labels = ['Now','+5','+10','+15','+20','+25','+30'];
  const base = result.score;
  const trend = labels.map((_,i) => Math.min(100, Math.max(0, base + (Math.random()*10-4)*(i+1)*0.6)));
  const ctx = document.getElementById('nowcast-chart').getContext('2d');
  if (nowcastChartInst) { nowcastChartInst.destroy(); }
  const color = result.color;
  nowcastChartInst = new Chart(ctx, {
    type:'line',
    data:{
      labels,
      datasets:[{
        label:'Flood Risk Score (%)',
        data:trend,
        borderColor:color,
        backgroundColor: color.replace(')',',0.12)').replace('rgb','rgba').replace('#','rgba(').replace(/[0-9a-f]{2}/gi, m => parseInt(m,16) + ',').slice(0,-1) + ')',
        fill:true,
        tension:0.4,
        pointBackgroundColor:color,
        pointRadius:4,
        borderWidth:2,
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:true,
      plugins:{ legend:{ labels:{ color:'#8b9ab4', boxWidth:12 } } },
      scales:{
        x:{ ticks:{ color:'#8b9ab4', font:{size:11} }, grid:{ color:'rgba(255,255,255,.04)' }, title:{ display:true, text:'Minutes', color:'#8b9ab4', font:{size:10} } },
        y:{ min:0, max:100, ticks:{ color:'#8b9ab4', font:{size:11} }, grid:{ color:'rgba(255,255,255,.06)' }, title:{ display:true, text:'Risk Score (%)', color:'#8b9ab4', font:{size:10} } }
      }
    }
  });
}

function runNowcast() {
  const result = computeNowcastRisk();
  buildRiskDial(result);
  buildNowcastTimeline(result);
}

document.getElementById('run-nowcast').addEventListener('click', runNowcast);

// ─────────────────────────────────────────────────────────────
// MODULE 3 — MAP
// ─────────────────────────────────────────────────────────────
let floodMap = null;
let mapMarkers = [];
let currentView = 'ward';

function initMap() {
  floodMap = L.map('flood-map', { center:[19.1, 72.87], zoom:11, zoomControl:true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:'© OpenStreetMap contributors',
    maxZoom:18,
  }).addTo(floodMap);
  addMapMarkers();
}

function addMapMarkers() {
  mapMarkers.forEach(m => m.remove());
  mapMarkers = [];
  const zones = currentView === 'ward'
    ? ZONES
    : ZONES.flatMap(z => [
        { ...z, lat: z.lat + (Math.random()*.01-.005), lng: z.lng + (Math.random()*.01-.005), name: z.name + ' — St.1', risk: z.risk },
        { ...z, lat: z.lat + (Math.random()*.01-.005), lng: z.lng + (Math.random()*.01-.005), name: z.name + ' — St.2', risk: randomNeighborRisk(z.risk) },
      ]);

  zones.forEach(zone => {
    const color = riskColor(zone.risk);
    const size = zone.risk === 'CRITICAL' ? 18 : zone.risk === 'HIGH' ? 15 : 12;
    const icon = L.divIcon({
      html:`<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid rgba(255,255,255,.7);box-shadow:0 0 8px ${color}"></div>`,
      className:'',
      iconSize:[size,size],
      iconAnchor:[size/2,size/2],
    });
    const marker = L.marker([zone.lat, zone.lng], { icon });
    marker.bindPopup(`
      <div style="font-family:-apple-system,sans-serif;min-width:180px">
        <div style="font-weight:700;font-size:.95rem;margin-bottom:.5rem;color:#fff">${zone.name}</div>
        <div style="font-size:.8rem;color:#8b9ab4;margin-bottom:.4rem">${zone.ward}</div>
        <div style="display:flex;justify-content:space-between;font-size:.82rem;padding:.3rem 0;border-bottom:1px solid #1e2d45"><span>Rainfall</span><span style="color:#3b82f6;font-weight:700">${zone.rainfall} mm/hr</span></div>
        <div style="display:flex;justify-content:space-between;font-size:.82rem;padding:.3rem 0;border-bottom:1px solid #1e2d45"><span>Drain Load</span><span style="color:#f59e0b;font-weight:700">${zone.drain}%</span></div>
        <div style="display:flex;justify-content:space-between;font-size:.82rem;padding:.3rem 0"><span>Flood Risk</span><span style="color:${color};font-weight:800">${zone.risk}</span></div>
      </div>`, { className:'custom-popup' });
    marker.on('click', () => showZoneDetail(zone));
    marker.addTo(floodMap);
    mapMarkers.push(marker);
  });

  // Risk circles overlay
  ZONES.filter(z => z.risk === 'HIGH' || z.risk === 'CRITICAL').forEach(z => {
    L.circle([z.lat, z.lng], {
      radius: z.risk === 'CRITICAL' ? 600 : 400,
      color: riskColor(z.risk),
      fillColor: riskColor(z.risk),
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray:'6,4',
    }).addTo(floodMap);
  });
}

function randomNeighborRisk(r) {
  const levels = ['LOW','MEDIUM','HIGH','CRITICAL'];
  const idx = levels.indexOf(r);
  const adj = idx + Math.floor(Math.random()*3) - 1;
  return levels[Math.max(0, Math.min(3, adj))];
}

function showZoneDetail(zone) {
  const color = riskColor(zone.risk);
  document.getElementById('zone-detail-panel').innerHTML = `
    <div class="zd-name">${zone.name}</div>
    <div style="margin-bottom:.5rem"><span class="risk-pill ${riskClass(zone.risk)}">${zone.risk}</span></div>
    <div class="zd-row"><span class="zd-key">Ward</span><span class="zd-val">${zone.ward}</span></div>
    <div class="zd-row"><span class="zd-key">Rainfall</span><span class="zd-val">${zone.rainfall} mm/hr</span></div>
    <div class="zd-row"><span class="zd-key">Inflow</span><span class="zd-val">${zone.inflow} m³/hr</span></div>
    <div class="zd-row"><span class="zd-key">Capacity</span><span class="zd-val">${zone.capacity} m³/hr</span></div>
    <div class="zd-row"><span class="zd-key">Drain Load</span><span class="zd-val">${zone.drain}%</span></div>
    <div class="zd-row"><span class="zd-key">Traffic</span><span class="zd-val">${zone.traffic}</span></div>
    <div class="zd-row"><span class="zd-key">Reports</span><span class="zd-val">${zone.reports}</span></div>
    <div style="margin-top:.75rem;padding:.6rem;background:rgba(255,255,255,.04);border-radius:6px;font-size:.78rem;color:#8b9ab4">
      Last updated: <strong style="color:#fff">just now</strong>
    </div>`;
}

window.setView = function(view) {
  currentView = view;
  document.getElementById('view-ward').classList.toggle('active-view', view === 'ward');
  document.getElementById('view-street').classList.toggle('active-view', view === 'street');
  addMapMarkers();
};

// ─────────────────────────────────────────────────────────────
// MODULE 4 — DRAINAGE STRESS
// ─────────────────────────────────────────────────────────────
let stressChartInst = null;

function buildStressSummaryCards() {
  const overloaded = ZONES.filter(z => z.drain >= 80).length;
  const maxDrain = Math.max(...ZONES.map(z => z.drain));
  const avgDrain = Math.round(ZONES.reduce((s,z) => s+z.drain, 0) / ZONES.length);
  const totalReports = ZONES.reduce((s,z) => s+z.reports, 0);
  const data = [
    { icon:'📊', val:avgDrain+'%', label:'Avg Drain Load',     badge: avgDrain > 70 ? 'HIGH' : avgDrain > 50 ? 'MEDIUM' : 'LOW', color:'#3b82f6' },
    { icon:'🔴', val:overloaded,   label:'Overloaded Drains',  badge: overloaded > 3 ? 'CRITICAL' : overloaded > 1 ? 'HIGH' : 'LOW', color:'#ef4444' },
    { icon:'🔺', val:maxDrain+'%', label:'Peak Drain Load',    badge: maxDrain >= 90 ? 'CRITICAL' : maxDrain >= 75 ? 'HIGH' : 'MEDIUM', color:'#f59e0b' },
    { icon:'📣', val:totalReports, label:'Citizen Reports',    badge: totalReports > 10 ? 'HIGH' : 'MEDIUM', color:'#06b6d4' },
  ];
  document.getElementById('stress-summary-cards').innerHTML = data.map(c => `
    <div class="kpi-card">
      <div class="kpi-icon">${c.icon}</div>
      <div class="kpi-val">${c.val}</div>
      <div class="kpi-label">${c.label}</div>
      <span class="kpi-badge ${badgeClass(c.badge)}">${c.badge}</span>
      <div class="kpi-bar"><div class="kpi-fill" style="width:${typeof c.val==='string'?parseInt(c.val):Math.min(100,c.val*10)}%;background:${c.color}"></div></div>
    </div>`).join('');
}

function buildStressChart() {
  const ctx = document.getElementById('stress-chart').getContext('2d');
  if (stressChartInst) { stressChartInst.destroy(); }
  const labels = ZONES.map(z => z.name);
  const runoffs = ZONES.map(z => Math.round(z.inflow * 0.92));
  const caps    = ZONES.map(z => z.capacity);
  stressChartInst = new Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[
        { label:'Runoff Estimate (m³/hr)', data:runoffs, backgroundColor: runoffs.map((v,i) => v > caps[i] ? 'rgba(239,68,68,.75)' : 'rgba(245,158,11,.65)'), borderRadius:4, borderSkipped:false },
        { label:'Rated Capacity (m³/hr)',  data:caps, backgroundColor:'rgba(34,197,94,.2)', borderColor:'rgba(34,197,94,.5)', borderWidth:2, borderRadius:4, borderSkipped:false },
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:true,
      plugins:{ legend:{ labels:{ color:'#8b9ab4', boxWidth:12 } }, tooltip:{ mode:'index', intersect:false } },
      scales:{
        x:{ ticks:{ color:'#8b9ab4', font:{size:11} }, grid:{ color:'rgba(255,255,255,.04)' } },
        y:{ ticks:{ color:'#8b9ab4', font:{size:11} }, grid:{ color:'rgba(255,255,255,.06)' } }
      }
    }
  });
}

function buildCitizenReports() {
  const container = document.getElementById('citizen-reports-list');
  container.innerHTML = citizenReports.slice(0, 5).map(r => `
    <div class="report-item">
      <div class="report-icon">${r.icon}</div>
      <div class="report-info">
        <div class="report-loc">${r.loc}</div>
        <div class="report-type-label">${r.type}</div>
      </div>
      <div class="report-time">${r.time}</div>
    </div>`).join('');
}

function buildGauges() {
  const zones = ZONES.slice(0, 6);
  document.getElementById('gauge-row').innerHTML = zones.map(z => {
    const pct = z.drain;
    const color = pct >= 90 ? '#7c3aed' : pct >= 75 ? '#ef4444' : pct >= 55 ? '#f59e0b' : '#22c55e';
    const circumference = 2 * Math.PI * 28;
    const dashOffset = circumference * (1 - pct / 100);
    return `<div class="gauge-card">
      <div class="gc-name">${z.name}</div>
      <div class="gc-val" style="color:${color}">${pct}%</div>
      <div class="gc-bar-wrap">
        <svg viewBox="0 0 70 70">
          <circle cx="35" cy="35" r="28" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="8"/>
          <circle cx="35" cy="35" r="28" fill="none" stroke="${color}" stroke-width="8"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${dashOffset}"
            stroke-linecap="round"
            transform="rotate(-90 35 35)"/>
          <text x="35" y="40" text-anchor="middle" font-size="11" fill="${color}" font-weight="700">${pct}%</text>
        </svg>
      </div>
      <div style="font-size:.72rem;color:var(--muted);margin-top:.3rem">${z.drain >= 80 ? '⚠️ Overloaded' : z.drain >= 55 ? '⚡ Stressed' : '✅ Normal'}</div>
    </div>`;
  }).join('');
}

// Report form
document.getElementById('add-report-btn').addEventListener('click', () => {
  const form = document.getElementById('report-form');
  form.style.display = form.style.display === 'none' ? 'flex' : 'none';
});

document.getElementById('submit-report').addEventListener('click', () => {
  const loc  = document.getElementById('report-location').value.trim();
  const type = document.getElementById('report-type');
  const desc = document.getElementById('report-desc').value.trim();
  if (!loc) { alert('Please enter a location.'); return; }
  const typeLabel = type.options[type.selectedIndex].text;
  const icons = { flooding:'🌊', traffic:'🚗', drain:'💧', other:'📌' };
  citizenReports.unshift({ icon: icons[type.value] || '📌', loc, type: typeLabel, time: 'just now' });
  buildCitizenReports();
  document.getElementById('report-location').value = '';
  document.getElementById('report-desc').value = '';
  document.getElementById('report-form').style.display = 'none';
});

// ─────────────────────────────────────────────────────────────
// MODULE 5 — EARLY WARNING SYSTEM
// ─────────────────────────────────────────────────────────────
const ALERTS_DATA = [
  {
    loc:'Andheri East', level:'CRITICAL',
    reason:'Drain overflow imminent — inflow at 129% capacity; heavy rainfall 78 mm/hr continuing',
    citizens:'Avoid low-lying areas and underpasses. Move vehicles to higher ground immediately.',
    authorities:'Deploy pumping units to SV Road and JVLR junction. Alert NDRF team.',
    time:'2 minutes ago'
  },
  {
    loc:'Dharavi', level:'HIGH',
    reason:'Drainage network overloaded — 92% drain load with heavy runoff from upstream zones',
    citizens:'Avoid ground-floor areas near storm drains. Keep emergency contacts ready.',
    authorities:'Pre-position emergency response near 90-Ft Road and Mahim Causeway.',
    time:'5 minutes ago'
  },
  {
    loc:'Malad West', level:'HIGH',
    reason:'Drain capacity exceeded — 87% load, traffic severely disrupted on Link Road',
    citizens:'Use alternate routes. Avoid Link Road and Malad creek bridge areas.',
    authorities:'Traffic diversions required at Link Road. Inspect Malad creek outflow.',
    time:'8 minutes ago'
  },
  {
    loc:'Kurla', level:'MEDIUM',
    reason:'Moderate drainage stress — 70% load, some surface flooding possible in low-lying streets',
    citizens:'Monitor local alerts. Keep drains clear of debris.',
    authorities:'Increase monitoring frequency. Ready quick-response teams for deployment.',
    time:'12 minutes ago'
  },
  {
    loc:'Goregaon', level:'MEDIUM',
    reason:'65% drain load with moderate rainfall. No immediate overflow expected, but watch-level advisory.',
    citizens:'Stay informed. Avoid parking in low-lying areas.',
    authorities:'Monitor upstream sensor data. No action required at this time.',
    time:'15 minutes ago'
  },
  {
    loc:'Jogeshwari', level:'HIGH',
    reason:'Drain load at 84% — multiple citizen reports of flooding at junction area',
    citizens:'Elevated risk near junction. Use caution when travelling in this area.',
    authorities:'Inspect drain blockage near Jogeshwari junction. Citizen reports confirmed.',
    time:'9 minutes ago'
  },
  {
    loc:'Bandra', level:'LOW',
    reason:'Low drain load at 42%. System operating normally under light rainfall.',
    citizens:'No immediate risk. Continue normal activities.',
    authorities:'Routine monitoring — no action required.',
    time:'20 minutes ago'
  },
  {
    loc:'Borivali', level:'LOW',
    reason:'Minimal rainfall (18 mm/hr). Drain load at 22%. System stable.',
    citizens:'No flood risk at this time.',
    authorities:'No action required. System within normal operating range.',
    time:'22 minutes ago'
  },
];

function buildAlerts(filter) {
  const data = filter === 'all' ? ALERTS_DATA : ALERTS_DATA.filter(a => a.level === filter);
  const levelOrder = { CRITICAL:0, HIGH:1, MEDIUM:2, LOW:3 };
  const sorted = [...data].sort((a,b) => levelOrder[a.level] - levelOrder[b.level]);
  document.getElementById('alerts-grid').innerHTML = sorted.length === 0
    ? `<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--muted)">No alerts matching selected filter.</div>`
    : sorted.map(a => `
    <div class="alert-card alert-${riskClass(a.level)}">
      <div class="alert-header">
        <div class="alert-loc">📍 ${a.loc}</div>
        <span class="alert-level risk-pill ${riskClass(a.level)}">${a.level}</span>
      </div>
      <div class="alert-reason">${a.reason}</div>
      <div class="alert-audiences">
        <div class="alert-audience">
          <div class="alert-aud-title">👥 Citizens</div>
          <div class="alert-aud-msg">${a.citizens}</div>
        </div>
        <div class="alert-audience">
          <div class="alert-aud-title">🏛️ Authorities</div>
          <div class="alert-aud-msg">${a.authorities}</div>
        </div>
      </div>
      <div class="alert-time">⏱ ${a.time}</div>
    </div>`).join('');
}

window.filterAlerts = function(f) {
  alertFilter = f;
  ['all','HIGH','MEDIUM','LOW'].forEach(k => {
    document.getElementById('fa-'+k.toLowerCase()).classList.toggle('active', k === f || (f==='all' && k==='all'));
  });
  buildAlerts(f);
};

document.getElementById('refresh-alerts').addEventListener('click', () => { buildAlerts(alertFilter); });

// ─────────────────────────────────────────────────────────────
// MODULE 6 — DECISION SUPPORT DASHBOARD
// ─────────────────────────────────────────────────────────────
let dashRainfallChart = null;
let dashPieChart = null;
let dashStressTrend = null;

function buildDashKPI() {
  const highCount  = ZONES.filter(z => z.risk === 'HIGH' || z.risk === 'CRITICAL').length;
  const avgRain    = Math.round(ZONES.reduce((s,z) => s+z.rainfall, 0) / ZONES.length);
  const avgDrain   = Math.round(ZONES.reduce((s,z) => s+z.drain, 0) / ZONES.length);
  const alertCount = ALERTS_DATA.filter(a => a.level === 'HIGH' || a.level === 'CRITICAL').length;
  const kpis = [
    { icon:'🌧️', val:`${avgRain}`, unit:'mm/hr', label:'Avg Rainfall',      color:'#3b82f6', badge: avgRain > 50 ? 'HIGH' : 'MEDIUM' },
    { icon:'📊', val:`${avgDrain}%`, unit:'',    label:'Avg Drain Load',     color:'#f59e0b', badge: avgDrain > 70 ? 'HIGH' : 'MEDIUM' },
    { icon:'⚠️', val:`${highCount}`, unit:'zones',label:'High-Risk Zones',   color:'#ef4444', badge: highCount > 3 ? 'CRITICAL' : 'HIGH' },
    { icon:'🚨', val:`${alertCount}`,unit:'active',label:'Active Warnings',  color:'#7c3aed', badge: alertCount > 3 ? 'CRITICAL' : 'HIGH' },
    { icon:'📡', val:`${ZONES.length}`,unit:'zones',label:'Monitored Zones', color:'#22c55e', badge:'NORMAL' },
    { icon:'📣', val:`${ZONES.reduce((s,z)=>s+z.reports,0)}`,unit:'reports',label:'Field Reports',color:'#06b6d4', badge:'LOW' },
  ];
  document.getElementById('dash-kpi-row').innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div class="kpi-icon">${k.icon}</div>
      <div class="kpi-val">${k.val} <span style="font-size:.85rem;color:var(--muted)">${k.unit}</span></div>
      <div class="kpi-label">${k.label}</div>
      <span class="kpi-badge ${badgeClass(k.badge === 'NORMAL' ? 'LOW' : k.badge)}">${k.badge}</span>
    </div>`).join('');
}

function buildDashRainfallChart() {
  const hours = Array.from({length:12},(_,i) => `${12-i}h ago`).reverse();
  hours[11] = 'Now';
  const data = [8,12,18,25,22,30,38,52,61,68,65,72];
  const ctx = document.getElementById('dash-rainfall-chart').getContext('2d');
  if (dashRainfallChart) { dashRainfallChart.destroy(); }
  dashRainfallChart = new Chart(ctx, {
    type:'line',
    data:{
      labels: hours,
      datasets:[{
        label:'Rainfall (mm/hr)',
        data,
        borderColor:'#3b82f6',
        backgroundColor:'rgba(59,130,246,.1)',
        fill:true, tension:0.4,
        pointBackgroundColor:'#3b82f6', pointRadius:3, borderWidth:2,
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:true,
      plugins:{ legend:{ labels:{ color:'#8b9ab4', boxWidth:12 } } },
      scales:{
        x:{ ticks:{ color:'#8b9ab4', font:{size:10} }, grid:{ color:'rgba(255,255,255,.04)' } },
        y:{ ticks:{ color:'#8b9ab4', font:{size:10} }, grid:{ color:'rgba(255,255,255,.06)' }, title:{ display:true, text:'mm/hr', color:'#8b9ab4', font:{size:10} } }
      }
    }
  });
}

function buildDashZoneTable() {
  const tbody = document.getElementById('dash-zone-tbody');
  tbody.innerHTML = ZONES.map(z => {
    const warnLevel = z.risk === 'CRITICAL' || z.risk === 'HIGH'
      ? `<span class="risk-pill ${riskClass(z.risk)}">⚠️ ${z.risk}</span>`
      : `<span class="risk-pill normal">—</span>`;
    return `<tr>
      <td><strong>${z.name}</strong></td>
      <td>${z.rainfall} mm/hr</td>
      <td><div style="display:flex;align-items:center;gap:.5rem">
        <div style="flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden">
          <div style="width:${z.drain}%;height:100%;background:${z.drain>=80?'var(--high)':z.drain>=55?'var(--medium)':'var(--low)'}"></div>
        </div>
        <span style="font-size:.78rem;color:var(--text)">${z.drain}%</span>
      </div></td>
      <td><span class="risk-pill ${riskClass(z.risk)}">${z.risk}</span></td>
      <td>${warnLevel}</td>
    </tr>`;
  }).join('');
}

function buildDashPie() {
  const counts = { LOW:0, MEDIUM:0, HIGH:0, CRITICAL:0 };
  ZONES.forEach(z => { counts[z.risk]++; });
  const ctx = document.getElementById('dash-pie-chart').getContext('2d');
  if (dashPieChart) { dashPieChart.destroy(); }
  dashPieChart = new Chart(ctx, {
    type:'doughnut',
    data:{
      labels:['LOW','MEDIUM','HIGH','CRITICAL'],
      datasets:[{ data:[counts.LOW,counts.MEDIUM,counts.HIGH,counts.CRITICAL], backgroundColor:['#22c55e','#f59e0b','#ef4444','#7c3aed'], borderWidth:2, borderColor:'#111827' }]
    },
    options:{
      responsive:true, maintainAspectRatio:true, cutout:'60%',
      plugins:{ legend:{ labels:{ color:'#8b9ab4', font:{size:11}, boxWidth:12 } } }
    }
  });
}

function buildDashStressTrend() {
  const hours = Array.from({length:8},(_,i) => `T-${7-i}h`);
  hours[7] = 'Now';
  const ctx = document.getElementById('dash-stress-trend').getContext('2d');
  if (dashStressTrend) { dashStressTrend.destroy(); }
  dashStressTrend = new Chart(ctx, {
    type:'line',
    data:{
      labels:hours,
      datasets:[
        { label:'Avg Drain Load (%)', data:[38,42,50,58,65,71,76,67], borderColor:'#f59e0b', backgroundColor:'rgba(245,158,11,.08)', fill:true, tension:0.4, pointBackgroundColor:'#f59e0b', pointRadius:3, borderWidth:2 },
        { label:'Overflow Zones',     data:[0,0,1,1,2,3,4,3],        borderColor:'#ef4444', backgroundColor:'rgba(239,68,68,.06)',   fill:true, tension:0.4, pointBackgroundColor:'#ef4444', pointRadius:3, borderWidth:2 },
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:true,
      plugins:{ legend:{ labels:{ color:'#8b9ab4', font:{size:10}, boxWidth:10 } } },
      scales:{
        x:{ ticks:{ color:'#8b9ab4', font:{size:10} }, grid:{ color:'rgba(255,255,255,.04)' } },
        y:{ ticks:{ color:'#8b9ab4', font:{size:10} }, grid:{ color:'rgba(255,255,255,.06)' } }
      }
    }
  });
}

function buildSourcesList() {
  const sources = [
    { dot:'blue',   name:'IMD – Doppler Weather Radar',         status:'Connected' },
    { dot:'green',  name:'Data.gov.in – Rainfall Records',      status:'Synced' },
    { dot:'green',  name:'ISRO Bhuvan – Elevation Data',        status:'Cached' },
    { dot:'orange', name:'Municipal Drain Sensors',             status:'Live' },
    { dot:'blue',   name:'DeepINDRA – AI Forecast Model',       status:'Running' },
    { dot:'green',  name:'MoHUA SOP – Response Protocols',      status:'Loaded' },
    { dot:'orange', name:'Traffic & Citizen Reports',           status:'Live' },
  ];
  document.getElementById('sources-list').innerHTML = sources.map(s => `
    <li>
      <span class="src-dot ${s.dot}"></span>
      <span style="flex:1">${s.name}</span>
      <span style="color:var(--muted);font-size:.72rem">${s.status}</span>
    </li>`).join('');
}

// ─────────────────────────────────────────────────────────────
// INIT + AUTO-REFRESH SIMULATION
// ─────────────────────────────────────────────────────────────
function initAll() {
  refreshCoupling(42);
  buildParamInputs();
  runNowcast();
  initMap();
  buildStressSummaryCards();
  buildStressChart();
  buildCitizenReports();
  buildGauges();
  buildAlerts('all');
  buildDashKPI();
  buildDashRainfallChart();
  buildDashZoneTable();
  buildDashPie();
  buildDashStressTrend();
  buildSourcesList();
}

// Simulate live ticker updates
function simulateLiveUpdates() {
  const alerts = document.getElementById('hs-alerts');
  const sensors = document.getElementById('hs-sensors');
  if (alerts) alerts.textContent = 3 + Math.floor(Math.random()*2);
  if (sensors) sensors.textContent = 46 + Math.floor(Math.random()*4);
  const mapBar = document.getElementById('map-status-text');
  const mins = Math.floor(Math.random()*3);
  if (mapBar) mapBar.textContent = `3 zones at HIGH risk · Last updated: ${mins === 0 ? 'just now' : mins + ' min ago'}`;
}

document.addEventListener('DOMContentLoaded', () => {
  initAll();
  setInterval(simulateLiveUpdates, 8000);
});
