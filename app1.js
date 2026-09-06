/* ============================================================
   Urban Flood Nowcasting System — app1.js
   Prototype with sample data. Structure designed so real APIs
   and ML models can be connected in place of mock data.
   ============================================================ */

'use strict';

// ============================================================
// SAMPLE DATA — replace with real API/ML endpoints
// ============================================================

const SAMPLE_DATA = {
  rainfall: 38,           // mm/hr
  drainageCapacity: 45,   // mm/hr rated
  inflow: 42,             // mm/hr (rainfall + runoff coefficient)
  outflowCapacity: 40,    // mm/hr effective
  floodRisk: 'MEDIUM',    // LOW | MEDIUM | HIGH
  timestamp: new Date()
};

// Ward/location data for the interactive map
const WARDS = [
  {
    id: 'w1', name: 'Rajiv Nagar Ward',
    lat: 19.078, lng: 72.877,
    risk: 'HIGH',
    rainfall: 52, drainage: 35, runoff: 58, capacity: 40,
    inflow: 62, outflow: 38,
    trafficSlowdown: 'Yes — 40% slower',
    citizenReports: 6,
    drainStatus: 'overloaded',
    reason: 'Inflow exceeds drainage capacity by 63%'
  },
  {
    id: 'w2', name: 'Shivaji Park Ward',
    lat: 19.028, lng: 72.837,
    risk: 'MEDIUM',
    rainfall: 38, drainage: 45, runoff: 42, capacity: 48,
    inflow: 44, outflow: 40,
    trafficSlowdown: 'Yes — 20% slower',
    citizenReports: 3,
    drainStatus: 'stress',
    reason: 'Runoff nearing drainage limit'
  },
  {
    id: 'w3', name: 'Andheri East Ward',
    lat: 19.115, lng: 72.867,
    risk: 'HIGH',
    rainfall: 55, drainage: 30, runoff: 62, capacity: 34,
    inflow: 68, outflow: 32,
    trafficSlowdown: 'Yes — 55% slower',
    citizenReports: 9,
    drainStatus: 'overloaded',
    reason: 'Drain capacity severely exceeded'
  },
  {
    id: 'w4', name: 'Bandra West Ward',
    lat: 19.050, lng: 72.823,
    risk: 'MEDIUM',
    rainfall: 36, drainage: 50, runoff: 38, capacity: 52,
    inflow: 41, outflow: 44,
    trafficSlowdown: 'Minor',
    citizenReports: 1,
    drainStatus: 'stress',
    reason: 'Moderate drainage pressure'
  },
  {
    id: 'w5', name: 'Dadar Ward',
    lat: 19.018, lng: 72.843,
    risk: 'LOW',
    rainfall: 22, drainage: 55, runoff: 24, capacity: 58,
    inflow: 26, outflow: 52,
    trafficSlowdown: 'None',
    citizenReports: 0,
    drainStatus: 'normal',
    reason: 'Drainage operating normally'
  },
  {
    id: 'w6', name: 'Kurla Ward',
    lat: 19.068, lng: 72.878,
    risk: 'LOW',
    rainfall: 25, drainage: 48, runoff: 27, capacity: 50,
    inflow: 29, outflow: 46,
    trafficSlowdown: 'None',
    citizenReports: 0,
    drainStatus: 'normal',
    reason: 'Drainage capacity sufficient'
  }
];

// Early warning messages
const WARNINGS = [
  {
    id: 'a1', level: 'HIGH', location: 'Rajiv Nagar Ward',
    reason: 'Inflow exceeds drainage capacity',
    message: 'Flood risk detected. Avoid low-lying areas. Authorities have been alerted.',
    time: '12 min ago'
  },
  {
    id: 'a2', level: 'HIGH', location: 'Andheri East Ward',
    reason: 'Drain capacity severely exceeded',
    message: 'Immediate flood risk. Road closures possible. Emergency teams deployed.',
    time: '8 min ago'
  },
  {
    id: 'a3', level: 'MEDIUM', location: 'Shivaji Park Ward',
    reason: 'Runoff nearing drainage limit',
    message: 'Waterlogging possible. Monitor conditions. Keep drains clear.',
    time: '20 min ago'
  },
  {
    id: 'a4', level: 'MEDIUM', location: 'Bandra West Ward',
    reason: 'Moderate drainage pressure',
    message: 'Drainage under stress. Residents advised to stay alert.',
    time: '25 min ago'
  },
  {
    id: 'a5', level: 'LOW', location: 'Dadar Ward',
    reason: 'Light rainfall, drainage adequate',
    message: 'Conditions normal. No immediate action required.',
    time: '30 min ago'
  },
  {
    id: 'a6', level: 'LOW', location: 'Kurla Ward',
    reason: 'Drainage capacity sufficient',
    message: 'No flood risk at this time. System operating normally.',
    time: '30 min ago'
  }
];

// ============================================================
// NAVIGATION
// ============================================================

const sections = ['home', 'map-section', 'drainage-stress', 'early-warnings', 'dashboard'];

/**
 * Navigate to a section by ID.
 * @param {string} sectionId
 */
function navigateTo(sectionId) {
  // Hide all sections
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active-section');
  });

  // Show target section
  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.add('active-section');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Update nav link active states
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-section') === sectionId) {
      link.classList.add('active');
    }
  });

  // Lazy-init map when first opened
  if (sectionId === 'map-section' && !mapInitialised) {
    initMap();
  }

  // Update dashboard timestamp on open
  if (sectionId === 'dashboard') {
    updateDashboard();
  }

  // Close mobile nav
  document.getElementById('navLinks').classList.remove('open');
}

// Attach nav link click handlers
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', function (e) {
    e.preventDefault();
    navigateTo(this.getAttribute('data-section'));
  });
});

// Mobile hamburger toggle
document.getElementById('navToggle').addEventListener('click', function () {
  document.getElementById('navLinks').classList.toggle('open');
});

// ============================================================
// RAINFALL–DRAINAGE COUPLING (Home page metrics)
// ============================================================

/**
 * Update coupling metrics on the home page with current sample data.
 * Replace SAMPLE_DATA assignments with real API responses here.
 */
function updateCouplingMetrics() {
  const d = SAMPLE_DATA;
  const maxVal = 80; // mm/hr scale reference

  // Update values
  document.getElementById('rainfallVal').textContent   = d.rainfall + ' mm/hr';
  document.getElementById('drainCapVal').textContent   = d.drainageCapacity + ' mm/hr';
  document.getElementById('inflowVal').textContent     = d.inflow + ' mm/hr';
  document.getElementById('outflowVal').textContent    = d.outflowCapacity + ' mm/hr';

  // Update progress bars
  setBarWidth('rainfallBar', d.rainfall, maxVal);
  setBarWidth('drainCapBar', d.drainageCapacity, maxVal);
  setBarWidth('inflowBar',   d.inflow, maxVal);
  setBarWidth('outflowBar',  d.outflowCapacity, maxVal);

  // Count areas exceeding capacity
  const exceeding = WARDS.filter(w => w.inflow > w.outflow).length;
  const statusEl = document.getElementById('couplingStatus');
  const level = exceeding >= 3 ? 'high' : exceeding >= 1 ? 'medium' : 'low';
  statusEl.className = 'coupling-status';
  statusEl.innerHTML = `
    <span class="status-dot ${level}"></span>
    <strong>${exceeding} area${exceeding !== 1 ? 's' : ''}</strong> where inflow exceeds outflow capacity
    <span class="status-badge ${level}-badge">${level === 'high' ? 'Critical' : level === 'medium' ? 'Attention Required' : 'Normal'}</span>
  `;

  // Nowcast risk
  updateNowcast(d.floodRisk);
}

function setBarWidth(id, value, max) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.min(100, Math.round((value / max) * 100)) + '%';
}

/**
 * Update the AI nowcast risk indicator.
 * @param {'LOW'|'MEDIUM'|'HIGH'} risk
 */
function updateNowcast(risk) {
  ['riskLow', 'riskMedium', 'riskHigh'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active-risk');
  });
  const map = { LOW: 'riskLow', MEDIUM: 'riskMedium', HIGH: 'riskHigh' };
  const active = document.getElementById(map[risk]);
  if (active) active.classList.add('active-risk');
  const lbl = document.getElementById('currentRiskLabel');
  if (lbl) lbl.textContent = risk;
}

// ============================================================
// INTERACTIVE MAP (Leaflet)
// ============================================================

let mapInstance = null;
let mapInitialised = false;
let selectedWardId = null;

/** Map marker colors per risk level */
const MARKER_COLORS = { HIGH: '#dc2626', MEDIUM: '#d97706', LOW: '#16a34a' };

function riskCircleStyle(risk) {
  return {
    radius: 14,
    fillColor: MARKER_COLORS[risk],
    color: '#fff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.85
  };
}

/** Initialise Leaflet map with ward markers */
function initMap() {
  if (mapInitialised) return;
  mapInitialised = true;

  // Centre on Mumbai area
  mapInstance = L.map('floodMap', { zoomControl: true }).setView([19.070, 72.855], 12);

  // OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18
  }).addTo(mapInstance);

  // Add ward markers
  WARDS.forEach(ward => {
    const circle = L.circleMarker([ward.lat, ward.lng], riskCircleStyle(ward.risk))
      .addTo(mapInstance)
      .bindTooltip(`<strong>${ward.name}</strong><br>Risk: ${ward.risk}`, { sticky: true });

    circle.on('click', () => selectWard(ward.id, circle));
    ward._marker = circle;
  });

  // Populate sidebar ward list
  renderWardList();
}

/** Render the clickable ward list in the sidebar */
function renderWardList() {
  const container = document.getElementById('wardList');
  if (!container) return;
  container.innerHTML = '';
  WARDS.forEach(ward => {
    const item = document.createElement('div');
    item.className = 'ward-item';
    item.id = 'ward-' + ward.id;
    item.innerHTML = `
      <span>${ward.name}</span>
      <span class="ward-risk ${ward.risk.toLowerCase()}">${ward.risk}</span>
    `;
    item.addEventListener('click', () => {
      selectWard(ward.id, null);
      if (mapInstance) mapInstance.setView([ward.lat, ward.lng], 14, { animate: true });
    });
    container.appendChild(item);
  });
}

/** Show ward info card on the map */
function selectWard(wardId, markerRef) {
  selectedWardId = wardId;
  const ward = WARDS.find(w => w.id === wardId);
  if (!ward) return;

  // Highlight sidebar item
  document.querySelectorAll('.ward-item').forEach(el => el.classList.remove('selected'));
  const sideItem = document.getElementById('ward-' + wardId);
  if (sideItem) sideItem.classList.add('selected');

  // Fill info card
  document.getElementById('micTitle').textContent = ward.name;
  const riskEl = document.getElementById('micRisk');
  riskEl.textContent = ward.risk + ' RISK';
  riskEl.className = 'mic-risk ' + ward.risk.toLowerCase();

  const rows = [
    ['Rainfall', ward.rainfall + ' mm/hr'],
    ['Inflow', ward.inflow + ' mm/hr'],
    ['Outflow Capacity', ward.outflow + ' mm/hr'],
    ['Drainage Capacity', ward.drainage + ' mm/hr'],
    ['Reason', ward.reason]
  ];
  const rowsEl = document.getElementById('micRows');
  rowsEl.innerHTML = rows.map(([k, v]) =>
    `<div class="mic-row"><span class="mic-key">${k}</span><span class="mic-val">${v}</span></div>`
  ).join('');

  document.getElementById('mapInfoCard').style.display = 'block';
}

function closeMapCard() {
  document.getElementById('mapInfoCard').style.display = 'none';
  document.querySelectorAll('.ward-item').forEach(el => el.classList.remove('selected'));
  selectedWardId = null;
}

// ============================================================
// DRAINAGE STRESS MONITORING
// ============================================================

/** Render all drainage stress cards */
function renderDrainageStress() {
  const container = document.getElementById('drainGrid');
  if (!container) return;
  container.innerHTML = '';

  WARDS.forEach(ward => {
    const pct = Math.min(100, Math.round((ward.runoff / ward.capacity) * 100));
    const statusLabel = ward.drainStatus === 'overloaded'
      ? 'OVERLOADED' : ward.drainStatus === 'stress'
      ? 'UNDER STRESS' : 'NORMAL';
    const barClass = ward.drainStatus + '-bar';

    const card = document.createElement('div');
    card.className = 'drain-card';
    card.innerHTML = `
      <div class="drain-card-top">
        <div class="drain-name">${ward.name}</div>
        <div class="drain-status ${ward.drainStatus}">${statusLabel}</div>
      </div>
      <div class="drain-metrics">
        <div class="dm-row">
          <div class="dm-label">Runoff vs Drain Capacity</div>
          <div class="dm-bar-wrap">
            <div class="dm-bar ${barClass}" style="width:${pct}%"></div>
          </div>
          <div class="dm-vals">
            <span>Runoff: ${ward.runoff} mm/hr</span>
            <span>Capacity: ${ward.capacity} mm/hr</span>
          </div>
        </div>
        <div class="dm-row">
          <div class="dm-label">Inflow vs Outflow</div>
          <div class="dm-bar-wrap">
            <div class="dm-bar ${barClass}" style="width:${Math.min(100,Math.round((ward.inflow/ward.outflow)*100))}%"></div>
          </div>
          <div class="dm-vals">
            <span>Inflow: ${ward.inflow} mm/hr</span>
            <span>Outflow: ${ward.outflow} mm/hr</span>
          </div>
        </div>
      </div>
      <div class="drain-extra">
        <span class="drain-tag">🚦 Traffic: ${ward.trafficSlowdown}</span>
        <span class="drain-tag">📢 Reports: ${ward.citizenReports} citizen report${ward.citizenReports !== 1 ? 's' : ''}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

// ============================================================
// EARLY WARNING SYSTEM
// ============================================================

let activeFilter = 'all';

/** Render warning cards, optionally filtered by risk level */
function renderWarnings(filter) {
  activeFilter = filter || 'all';
  const container = document.getElementById('warningsGrid');
  if (!container) return;

  const list = activeFilter === 'all'
    ? WARNINGS
    : WARNINGS.filter(w => w.level === activeFilter);

  if (list.length === 0) {
    container.innerHTML = '<p style="color:var(--muted);font-size:14px;padding:16px 0;">No warnings for this filter.</p>';
    return;
  }

  container.innerHTML = list.map(w => `
    <div class="warn-card ${w.level.toLowerCase()}">
      <div class="warn-top">
        <span class="warn-level ${w.level.toLowerCase()}">${w.level} RISK</span>
        <span class="warn-time">${w.time}</span>
      </div>
      <div class="warn-location">📍 ${w.location}</div>
      <div class="warn-reason">Reason: ${w.reason}</div>
      <div class="warn-msg">⚠ ${w.message}</div>
    </div>
  `).join('');
}

/** Filter button handler */
function filterWarnings(filter, btnEl) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  renderWarnings(filter);
}

// ============================================================
// DECISION SUPPORT DASHBOARD
// ============================================================

/** Update all dashboard KPIs and lists */
function updateDashboard() {
  const d = SAMPLE_DATA;
  const highRiskWards = WARDS.filter(w => w.risk === 'HIGH');
  const activeWarnings = WARNINGS.filter(w => w.level === 'HIGH' || w.level === 'MEDIUM');
  const drainStressed = WARDS.filter(w => w.drainStatus !== 'normal');

  // KPI values
  document.getElementById('dashRainfallVal').textContent = d.rainfall + ' mm/hr';

  const riskKpi = document.getElementById('dashRiskVal');
  riskKpi.textContent = d.floodRisk;
  riskKpi.className = 'kpi-value ' + d.floodRisk.toLowerCase();

  const drainKpi = document.getElementById('dashDrainVal');
  const drainWord = drainStressed.length >= 3 ? 'OVERLOADED' : drainStressed.length >= 1 ? 'UNDER STRESS' : 'NORMAL';
  drainKpi.textContent = drainWord;
  drainKpi.className = 'kpi-value ' + (drainStressed.length >= 3 ? 'high' : drainStressed.length >= 1 ? 'medium' : 'low');

  document.getElementById('dashHighRiskVal').textContent = highRiskWards.length;
  document.getElementById('dashWarningsVal').textContent = WARNINGS.filter(w => w.level !== 'LOW').length;

  // High-risk location list
  const hrList = document.getElementById('dashHighRiskList');
  hrList.innerHTML = highRiskWards.length
    ? highRiskWards.map(w => `
        <div class="dash-row">
          <span class="dash-row-name">📍 ${w.name}</span>
          <span class="dash-row-badge high-badge">${w.risk}</span>
        </div>
      `).join('')
    : '<p style="color:var(--muted);font-size:13px;">No high-risk areas currently.</p>';

  // Active warnings list
  const warnList = document.getElementById('dashWarnList');
  warnList.innerHTML = activeWarnings.slice(0, 5).map(w => `
    <div class="dash-row">
      <span class="dash-row-name">${w.location}</span>
      <span class="dash-row-badge ${w.level === 'HIGH' ? 'high-badge' : 'medium-badge'}">${w.level}</span>
    </div>
  `).join('');

  // Timestamp
  document.getElementById('lastUpdated').textContent =
    'Last updated: ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Simulate refreshing data (cycles through preset scenarios) */
let refreshCycle = 0;
const SCENARIOS = [
  { rainfall: 38, drainageCapacity: 45, inflow: 42, outflowCapacity: 40, floodRisk: 'MEDIUM' },
  { rainfall: 55, drainageCapacity: 45, inflow: 62, outflowCapacity: 38, floodRisk: 'HIGH' },
  { rainfall: 20, drainageCapacity: 45, inflow: 22, outflowCapacity: 44, floodRisk: 'LOW' },
  { rainfall: 44, drainageCapacity: 45, inflow: 48, outflowCapacity: 40, floodRisk: 'MEDIUM' }
];

function refreshDashboard() {
  refreshCycle = (refreshCycle + 1) % SCENARIOS.length;
  Object.assign(SAMPLE_DATA, SCENARIOS[refreshCycle]);
  updateDashboard();
  updateCouplingMetrics();
}

// ============================================================
// INITIALISE
// ============================================================

function init() {
  // Coupling metrics on home page
  updateCouplingMetrics();

  // Drainage stress cards
  renderDrainageStress();

  // Warnings
  renderWarnings('all');

  // Dashboard initial state
  updateDashboard();

  // Default active section
  navigateTo('home');
}

// Boot when DOM is ready
document.addEventListener('DOMContentLoaded', init);
