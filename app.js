/**
 * Urban Flood Nowcasting System — app.js
 * Team TECHX
 *
 * All data is SIMULATED. No backend or API keys required.
 *
 * Core logic:
 *   Flood Risk (%) = clamp( rainfallFactor + drainageLoadFactor + zoneVulnerability, 0, 100 )
 *
 * Risk categories:
 *   0–30  → LOW
 *   31–60 → MODERATE
 *   61–80 → HIGH
 *   81–100→ CRITICAL
 */

'use strict';

/* ─────────────────────────────────────────────────
   ZONE DEFINITIONS
   baseVulnerability : inherent zone weakness (0–30 pts)
   drainFactor       : how much drainage load amplifies risk
   safeRoute         : emergency route text for HIGH/CRITICAL
───────────────────────────────────────────────── */
const ZONES = {
  A: {
    id: 'A',
    name: 'Zone A – Ahmedabad Central',
    shortName: 'Ahmedabad Central',
    baseVulnerability: 5,    // well-maintained core city
    drainFactor: 0.25,
    safeRoute: 'Zone A → NH-48 → Emergency Shelter (Zone A) → Relief Camp (Zone F)',
    description: 'Central business district with established drainage infrastructure.'
  },
  B: {
    id: 'B',
    name: 'Zone B – Riverfront',
    shortName: 'Riverfront',
    baseVulnerability: 18,   // near river, moderate risk
    drainFactor: 0.35,
    safeRoute: 'Zone B → Canal Road → Zone A → Emergency Shelter',
    description: 'Riverfront promenade area. Elevated risk due to proximity to drainage canal.'
  },
  C: {
    id: 'C',
    name: 'Zone C – East Zone',
    shortName: 'East Zone',
    baseVulnerability: 20,   // older infrastructure
    drainFactor: 0.40,
    safeRoute: 'Zone C → Main Road → Zone A → Emergency Shelter',
    description: 'Eastern residential zone with older drainage pipes and moderate elevation.'
  },
  D: {
    id: 'D',
    name: 'Zone D – West Zone',
    shortName: 'West Zone',
    baseVulnerability: 4,    // newer development
    drainFactor: 0.20,
    safeRoute: 'Zone D → Ring Road → Zone A → Emergency Shelter',
    description: 'Newly developed western zone with modern stormwater systems.'
  },
  E: {
    id: 'E',
    name: 'Zone E – Low-Lying Area',
    shortName: 'Low-Lying Area',
    baseVulnerability: 28,   // highest natural vulnerability
    drainFactor: 0.50,
    safeRoute: 'Zone E → South Bypass → Zone A → Emergency Shelter (urgent)',
    description: 'Low-elevation zone. Most vulnerable to waterlogging. Evacuation priority.'
  },
  F: {
    id: 'F',
    name: 'Zone F – Industrial Area',
    shortName: 'Industrial Area',
    baseVulnerability: 14,
    drainFactor: 0.30,
    safeRoute: 'Zone F → South Bypass → Zone D → Fire Station',
    description: 'Industrial area. Drainage partially blocked by industrial runoff.'
  }
};

/* ─────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────── */
const DEFAULT_RAINFALL  = 40;
const MAX_RAINFALL      = 150;
const BASE_DRAIN_CAPACITY = 65;  // % of total capacity available (fixed for prototype)

/* ─────────────────────────────────────────────────
   RISK HELPERS
───────────────────────────────────────────────── */
/**
 * Calculate drainage load (%) from rainfall intensity.
 * Uses a non-linear model so that extreme rainfall saturates drainage quickly.
 */
function calcDrainageLoad(rainfall) {
  // 0 mm/hr → ~10%, 40 mm/hr → ~42%, 80 mm/hr → ~68%, 120 mm/hr → ~88%, 150 mm/hr → ~97%
  const raw = 10 + (rainfall / MAX_RAINFALL) * 87 * (1 + (rainfall / MAX_RAINFALL) * 0.3);
  return Math.min(Math.round(raw), 100);
}

/**
 * Calculate flood risk (%) for a zone given current rainfall.
 * Formula: rainfallFactor + drainageLoadFactor + zoneVulnerability
 */
function calcZoneRisk(zone, rainfall) {
  const drainLoad     = calcDrainageLoad(rainfall);
  // Rainfall contributes up to 40 pts (linear)
  const rainfallFactor = (rainfall / MAX_RAINFALL) * 40;
  // Drainage load amplified by zone's sensitivity – up to ~50 pts at max drain
  const drainageFactor = (drainLoad / 100) * zone.drainFactor * 100;
  const raw = rainfallFactor + drainageFactor + zone.baseVulnerability;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

/**
 * Map a risk percentage to a named category.
 */
function riskCategory(pct) {
  if (pct <= 30) return 'LOW';
  if (pct <= 60) return 'MODERATE';
  if (pct <= 80) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Return a CSS class suffix for a given risk category.
 */
function riskClass(cat) {
  return { LOW: 'low', MODERATE: 'moderate', HIGH: 'high', CRITICAL: 'critical' }[cat];
}

/**
 * Return the SVG fill colour for a risk category.
 */
function riskColor(cat) {
  return { LOW: '#22c55e', MODERATE: '#eab308', HIGH: '#f97316', CRITICAL: '#ef4444' }[cat];
}

/**
 * Return a friendly drainage condition label for a load %.
 */
function drainConditionLabel(drainLoad) {
  if (drainLoad <= 30) return 'Low Load';
  if (drainLoad <= 55) return 'Normal Load';
  if (drainLoad <= 75) return 'High Load';
  if (drainLoad <= 90) return 'Very High Load';
  return 'Critical – Overflow Risk';
}

/**
 * Return a drainage status label.
 */
function drainStatusLabel(drainLoad) {
  if (drainLoad <= 40)  return 'Normal';
  if (drainLoad <= 65)  return 'Elevated';
  if (drainLoad <= 80)  return 'High';
  if (drainLoad <= 90)  return 'Critical';
  return 'Overflow';
}

/* ─────────────────────────────────────────────────
   LANDING PAGE → DASHBOARD TRANSITION
───────────────────────────────────────────────── */
function createRain() {
  const container = document.getElementById('rainContainer');
  if (!container) return;
  for (let i = 0; i < 60; i++) {
    const drop = document.createElement('div');
    drop.className = 'rain-drop';
    const height  = Math.random() * 60 + 30;
    const left    = Math.random() * 100;
    const duration = Math.random() * 1.2 + 0.6;
    const delay    = Math.random() * 3;
    drop.style.cssText = `left:${left}%;height:${height}px;animation-duration:${duration}s;animation-delay:${delay}s;`;
    container.appendChild(drop);
  }
}

document.getElementById('enterDashboard').addEventListener('click', function () {
  const landing   = document.getElementById('landing-page');
  const dashboard = document.getElementById('dashboard-page');
  landing.style.opacity = '0';
  landing.style.transition = 'opacity 0.5s ease';
  setTimeout(() => {
    landing.classList.add('hidden');
    dashboard.classList.remove('hidden');
    dashboard.style.opacity = '0';
    dashboard.style.transition = 'opacity 0.4s ease';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { dashboard.style.opacity = '1'; });
    });
  }, 500);
});

/* ─────────────────────────────────────────────────
   HAMBURGER MENU
───────────────────────────────────────────────── */
document.getElementById('hamburger').addEventListener('click', function () {
  document.getElementById('navLinks').classList.toggle('open');
});

/* ─────────────────────────────────────────────────
   ZONE CARDS – INITIAL RENDER
───────────────────────────────────────────────── */
function renderZoneCards(rainfall) {
  const list = document.getElementById('zoneCardsList');
  list.innerHTML = '';

  Object.values(ZONES).forEach(zone => {
    const risk = calcZoneRisk(zone, rainfall);
    const cat  = riskCategory(risk);
    const cls  = riskClass(cat);
    const drainLoad = calcDrainageLoad(rainfall);

    const card = document.createElement('div');
    card.className = 'zone-card';
    card.setAttribute('data-zone', zone.id);
    card.setAttribute('title', 'Click for zone details');
    card.innerHTML = `
      <div class="zone-card-header">
        <span class="zone-card-name">${zone.name}</span>
        <span class="zone-card-badge badge-${cls}">${cat}</span>
      </div>
      <div class="zone-card-row">
        <span>Risk</span>
        <span class="risk-${cls}" style="font-weight:700">${risk}%</span>
      </div>
      <div class="zone-card-row">
        <span>Rainfall</span>
        <span>${rainfall} mm/hr</span>
      </div>
      <div class="zone-card-row">
        <span>Drainage</span>
        <span>${drainConditionLabel(drainLoad)}</span>
      </div>
      <div class="zone-risk-bar-wrap">
        <div class="zone-risk-bar" style="width:${risk}%;background:${riskColor(cat)}"></div>
      </div>
    `;
    card.addEventListener('click', () => openModal(zone.id, rainfall));
    list.appendChild(card);
  });
}

/* ─────────────────────────────────────────────────
   MAP – UPDATE ZONE COLOURS & LABELS
───────────────────────────────────────────────── */
function updateMap(rainfall) {
  Object.values(ZONES).forEach(zone => {
    const risk  = calcZoneRisk(zone, rainfall);
    const cat   = riskCategory(risk);
    const color = riskColor(cat);

    const rect = document.getElementById(`zone-${zone.id}`);
    const pctEl = document.getElementById(`zone${zone.id}-pct`);
    if (rect)  rect.setAttribute('fill', color);
    if (pctEl) pctEl.textContent = `${risk}%`;
  });
}

/* ─────────────────────────────────────────────────
   DRAINAGE PANEL – UPDATE
───────────────────────────────────────────────── */
function updateDrainage(rainfall) {
  const drainLoad = calcDrainageLoad(rainfall);
  // Available capacity decreases as load increases
  const available = Math.max(0, BASE_DRAIN_CAPACITY - Math.round(drainLoad * 0.3));

  document.getElementById('loadPct').textContent   = `${drainLoad}%`;
  document.getElementById('capacityPct').textContent = `${available}%`;
  document.getElementById('loadBar').style.width     = `${drainLoad}%`;
  document.getElementById('capacityBar').style.width = `${available}%`;
  document.getElementById('drainStatus').textContent = drainStatusLabel(drainLoad);

  // Colour the load bar based on severity
  const loadBar = document.getElementById('loadBar');
  if (drainLoad <= 40)       loadBar.style.background = 'linear-gradient(to right,#22c55e,#86efac)';
  else if (drainLoad <= 65)  loadBar.style.background = 'linear-gradient(to right,#eab308,#fbbf24)';
  else if (drainLoad <= 85)  loadBar.style.background = 'linear-gradient(to right,#f97316,#fb923c)';
  else                       loadBar.style.background = 'linear-gradient(to right,#ef4444,#f87171)';
}

/* ─────────────────────────────────────────────────
   STATISTICS BAR – UPDATE
───────────────────────────────────────────────── */
function updateStats(rainfall) {
  const drainLoad  = calcDrainageLoad(rainfall);
  const risks      = Object.values(ZONES).map(z => ({ zone: z, risk: calcZoneRisk(z, rainfall) }));
  const highCount  = risks.filter(r => riskCategory(r.risk) === 'HIGH').length;
  const critCount  = risks.filter(r => riskCategory(r.risk) === 'CRITICAL').length;
  const avgRisk    = Math.round(risks.reduce((s, r) => s + r.risk, 0) / risks.length);
  const overallCat = riskCategory(avgRisk);

  animateValue('stat-rainfall', `${rainfall} mm/hr`);
  animateValue('stat-high',     `${highCount}`);
  animateValue('stat-critical', `${critCount}`);
  animateValue('stat-drain',    `${drainLoad}%`);

  const overallEl = document.getElementById('stat-overall');
  overallEl.textContent = overallCat;
  overallEl.className = `stat-value risk-${riskClass(overallCat)}`;
}

/* Simple flash animation for value change */
function animateValue(id, newVal) {
  const el = document.getElementById(id);
  if (!el || el.textContent === newVal) return;
  el.style.transform = 'scale(1.15)';
  el.style.transition = 'transform 0.15s';
  el.textContent = newVal;
  setTimeout(() => { el.style.transform = 'scale(1)'; }, 150);
}

/* ─────────────────────────────────────────────────
   ALERT BOX – UPDATE
───────────────────────────────────────────────── */
function updateAlert(rainfall) {
  const drainLoad = calcDrainageLoad(rainfall);
  const risks     = Object.values(ZONES).map(z => calcZoneRisk(z, rainfall));
  const maxRisk   = Math.max(...risks);
  const cat       = riskCategory(maxRisk);

  const ALERTS = {
    LOW:      { cls: 'alert-safe',     icon: '🟢', title: 'System Normal',       msg: 'Current conditions are within safe limits. Continue routine monitoring.' },
    MODERATE: { cls: 'alert-moderate', icon: '🟡', title: 'Moderate Alert',       msg: 'Rainfall increasing. Monitor drainage capacity. Stay alert for changes.' },
    HIGH:     { cls: 'alert-high',     icon: '🟠', title: 'High Risk Alert',      msg: 'Heavy rainfall detected. High-risk zones require attention. Prepare response teams.' },
    CRITICAL: { cls: 'alert-critical', icon: '🔴', title: 'Critical Flood Alert', msg: 'Extreme rainfall and overloaded drainage detected. Immediate emergency response recommended. Evacuate low-lying areas.' }
  };

  const a   = ALERTS[cat];
  const box = document.getElementById('alertBox');
  box.className = `alert-box ${a.cls}`;
  box.innerHTML = `
    <span class="alert-icon">${a.icon}</span>
    <div class="alert-content">
      <strong>${a.title}</strong>
      <p>${a.msg}</p>
    </div>
  `;
}

/* ─────────────────────────────────────────────────
   TIMESTAMP UPDATE
───────────────────────────────────────────────── */
function updateTimestamp() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('lastUpdated').textContent = `${h}:${m}:${s} — Simulated`;
}

/* ─────────────────────────────────────────────────
   MASTER UPDATE — called on every slider change
───────────────────────────────────────────────── */
function updateAll(rainfall) {
  updateMap(rainfall);
  updateDrainage(rainfall);
  updateStats(rainfall);
  updateAlert(rainfall);
  renderZoneCards(rainfall);
  updateTimestamp();
}

/* ─────────────────────────────────────────────────
   RAINFALL SLIDER
───────────────────────────────────────────────── */
const slider = document.getElementById('rainfallSlider');
const rainfallValueEl = document.getElementById('rainfallValue');

slider.addEventListener('input', function () {
  const val = parseInt(this.value, 10);
  rainfallValueEl.textContent = val;
  updateAll(val);
});

/* ─────────────────────────────────────────────────
   RESET BUTTON
───────────────────────────────────────────────── */
document.getElementById('resetBtn').addEventListener('click', function () {
  slider.value = DEFAULT_RAINFALL;
  rainfallValueEl.textContent = DEFAULT_RAINFALL;
  updateAll(DEFAULT_RAINFALL);
});

/* ─────────────────────────────────────────────────
   MAP ZONE CLICK
───────────────────────────────────────────────── */
document.querySelectorAll('.map-zone').forEach(rect => {
  rect.addEventListener('click', function () {
    const zoneId  = this.getAttribute('data-zone');
    const rainfall = parseInt(slider.value, 10);
    openModal(zoneId, rainfall);
  });
});

/* ─────────────────────────────────────────────────
   MODAL
───────────────────────────────────────────────── */
function openModal(zoneId, rainfall) {
  const zone      = ZONES[zoneId];
  const risk      = calcZoneRisk(zone, rainfall);
  const cat       = riskCategory(risk);
  const cls       = riskClass(cat);
  const drainLoad = calcDrainageLoad(rainfall);
  const available = Math.max(0, BASE_DRAIN_CAPACITY - Math.round(drainLoad * 0.3));
  const drainCond = drainConditionLabel(drainLoad);

  // Recommended action
  const ACTIONS = {
    LOW:      'No immediate action required. Continue normal operations and routine monitoring.',
    MODERATE: 'Increase monitoring frequency. Check drainage channels. Alert local authorities.',
    HIGH:     'Deploy emergency response teams. Monitor continuously and prepare evacuation routes.',
    CRITICAL: 'Initiate evacuation immediately. Close roads. Activate all emergency services.'
  };

  // Estimated flood condition
  const FLOOD_COND = {
    LOW:      'No flooding expected.',
    MODERATE: 'Minor waterlogging possible in low-lying areas.',
    HIGH:     'Significant flooding likely. Road closures possible.',
    CRITICAL: 'Severe flooding imminent. Evacuation required.'
  };

  document.getElementById('modalTitle').textContent = zone.name;

  document.getElementById('modalGrid').innerHTML = `
    <div class="modal-item">
      <div class="modal-item-label">CURRENT RAINFALL</div>
      <div class="modal-item-value">${rainfall} mm/hr</div>
    </div>
    <div class="modal-item">
      <div class="modal-item-label">FLOOD RISK</div>
      <div class="modal-item-value risk-${cls}">${risk}%</div>
    </div>
    <div class="modal-item">
      <div class="modal-item-label">RISK LEVEL</div>
      <div class="modal-item-value risk-${cls}">${cat}</div>
    </div>
    <div class="modal-item">
      <div class="modal-item-label">DRAINAGE CAPACITY</div>
      <div class="modal-item-value">${available}%</div>
    </div>
    <div class="modal-item">
      <div class="modal-item-label">DRAINAGE LOAD</div>
      <div class="modal-item-value">${drainLoad}%</div>
    </div>
    <div class="modal-item">
      <div class="modal-item-label">DRAINAGE CONDITION</div>
      <div class="modal-item-value" style="font-size:12px">${drainCond}</div>
    </div>
    <div class="modal-item" style="grid-column:span 2">
      <div class="modal-item-label">ESTIMATED FLOOD CONDITION</div>
      <div class="modal-item-value" style="font-size:13px">${FLOOD_COND[cat]}</div>
    </div>
    <div class="modal-item" style="grid-column:span 2">
      <div class="modal-item-label">ZONE DESCRIPTION</div>
      <div class="modal-item-value" style="font-size:12px;font-weight:400;color:#475569">${zone.description}</div>
    </div>
  `;

  // Alert inside modal
  const alertEl = document.getElementById('modalAlert');
  const ALERT_STYLES = {
    LOW:      { bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
    MODERATE: { bg: '#fefce8', color: '#854d0e', border: '#fde047' },
    HIGH:     { bg: '#fff7ed', color: '#9a3412', border: '#fdba74' },
    CRITICAL: { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' }
  };
  const style = ALERT_STYLES[cat];
  alertEl.className = 'modal-alert show';
  alertEl.style.cssText = `background:${style.bg};border:1px solid ${style.border};color:${style.color}`;
  alertEl.innerHTML = `<strong>Recommended Action:</strong> ${ACTIONS[cat]}`;

  // Emergency route for HIGH / CRITICAL
  const routeEl = document.getElementById('modalRoute');
  if (cat === 'HIGH' || cat === 'CRITICAL') {
    routeEl.className = 'modal-route show';
    routeEl.innerHTML = `
      <h4>🚨 Emergency Route Suggestion</h4>
      <div class="route-avoid">⛔ Avoid: ${zone.name}</div>
      <div class="route-suggest">✅ Suggested Safe Route:<br>${zone.safeRoute}</div>
      <div class="route-proto">⚠️ Prototype Route Suggestion — Not real GPS navigation. For demonstration only.</div>
    `;
  } else {
    routeEl.className = 'modal-route';
  }

  // Open modal
  const overlay = document.getElementById('zoneModal');
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('zoneModal').classList.add('hidden');
  document.body.style.overflow = '';
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
document.getElementById('zoneModal').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeModal();
});

/* ─────────────────────────────────────────────────
   SMOOTH SCROLL FOR NAV LINKS
───────────────────────────────────────────────── */
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href && href.startsWith('#') && href.length > 1) {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // Close mobile menu on click
    document.getElementById('navLinks').classList.remove('open');
  });
});

/* ─────────────────────────────────────────────────
   INITIALISE
───────────────────────────────────────────────── */
(function init() {
  createRain();
  updateAll(DEFAULT_RAINFALL);
})();
