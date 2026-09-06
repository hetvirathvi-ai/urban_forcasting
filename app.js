/* ============================================================
   Urban Flood Nowcasting System – app1.js
   Team TECHX
   ============================================================
   Architecture:
   1. ZONE_DATA   – static zone config (name, vulnerability, drainage capacity)
   2. calcRisk()  – deterministic risk model
   3. updateAll() – master update called on slider change / reset
   4. Modal       – zone click → popup
   5. Navigation  – landing → dashboard, nav links, hamburger
   ============================================================ */

'use strict';

/* ─────────────────────────────────────────────
   1. ZONE CONFIGURATION
   vulnerability: 0-1 (higher = more flood-prone)
   drainCap: drainage capacity % (higher = better drainage)
───────────────────────────────────────────── */
const ZONE_DATA = {
  A: {
    name: 'Zone A – Ahmedabad Central',
    shortName: 'Ahmedabad Central',
    vulnerability: 0.40,   // medium – well-maintained city centre
    drainCap: 70,
    routes: {
      avoid: 'Zone A – Ahmedabad Central',
      safe: 'Zone A → Main Road (North) → Emergency Shelter (Zone B Area)'
    }
  },
  B: {
    name: 'Zone B – Riverfront',
    shortName: 'Riverfront',
    vulnerability: 0.55,   // higher – proximity to river
    drainCap: 55,
    routes: {
      avoid: 'Zone B – Riverfront',
      safe: 'Zone B → Central Ave → Zone A → Emergency Shelter'
    }
  },
  C: {
    name: 'Zone C – East Zone',
    shortName: 'East Zone',
    vulnerability: 0.60,   // elevated – older drainage
    drainCap: 50,
    routes: {
      avoid: 'Zone C – East Zone',
      safe: 'Zone C → Main Road → Zone A → Emergency Shelter'
    }
  },
  D: {
    name: 'Zone D – West Zone',
    shortName: 'West Zone',
    vulnerability: 0.30,   // lower – newer infrastructure
    drainCap: 80,
    routes: {
      avoid: 'Zone D – West Zone',
      safe: 'Zone D → Ring Road → Zone A → Emergency Shelter'
    }
  },
  E: {
    name: 'Zone E – Low-Lying Area',
    shortName: 'Low-Lying Area',
    vulnerability: 0.75,   // highest – topography
    drainCap: 40,
    routes: {
      avoid: 'Zone E – Low-Lying Area',
      safe: 'Zone E → Ring Road → Central Ave → Zone A → Emergency Shelter'
    }
  },
  F: {
    name: 'Zone F – Industrial Area',
    shortName: 'Industrial Area',
    vulnerability: 0.45,   // moderate – impermeable surfaces
    drainCap: 65,
    routes: {
      avoid: 'Zone F – Industrial Area',
      safe: 'Zone F → East Blvd → Zone A → Emergency Shelter'
    }
  }
};

/* ─────────────────────────────────────────────
   2. RISK CALCULATION
   Inputs : rainfall (0–150 mm/hr)
   Returns: { riskPct, riskLevel, drainLoad,
              drainStatus, rfFactor, dlFactor }
   Formula:
     rfFactor  = rainfall / 150  (0–1)
     dlFactor  = clamp(rfFactor * (1 / (drainCap/100)), 0, 1)
     riskPct   = rfFactor*45 + dlFactor*35 + vulnerability*20
     clamped to [0, 100]
───────────────────────────────────────────── */
function calcZoneRisk(rainfall, zoneKey) {
  const z = ZONE_DATA[zoneKey];
  const rfFactor = rainfall / 150;                          // 0–1
  const drainRatio = 1 - (z.drainCap / 100);               // lower cap = harder to drain
  const dlFactor = Math.min(rfFactor * (1 + drainRatio * 1.5), 1); // 0–1
  const riskRaw = rfFactor * 45 + dlFactor * 35 + z.vulnerability * 20;
  const riskPct = Math.round(Math.min(Math.max(riskRaw, 0), 100));
  const drainLoad = Math.round(Math.min(dlFactor * 100, 100));

  let riskLevel, drainStatus;
  if (riskPct <= 30)      { riskLevel = 'LOW';      }
  else if (riskPct <= 60) { riskLevel = 'MODERATE'; }
  else if (riskPct <= 80) { riskLevel = 'HIGH';     }
  else                    { riskLevel = 'CRITICAL'; }

  if (drainLoad <= 30)      { drainStatus = 'Normal';   }
  else if (drainLoad <= 55) { drainStatus = 'Moderate'; }
  else if (drainLoad <= 80) { drainStatus = 'High';     }
  else                      { drainStatus = 'Critical'; }

  return {
    riskPct,
    riskLevel,
    rfFactor,
    dlFactor,
    drainLoad,
    drainStatus
  };
}

/* Global drainage summary uses Zone A as representative */
function calcGlobalDrainage(rainfall) {
  // average across all zones
  let sumLoad = 0;
  const keys = Object.keys(ZONE_DATA);
  keys.forEach(k => {
    const r = calcZoneRisk(rainfall, k);
    sumLoad += r.drainLoad;
  });
  const avgLoad = Math.round(sumLoad / keys.length);
  const available = Math.max(100 - avgLoad, 0);
  let status;
  if (avgLoad <= 30)      { status = 'Normal';   }
  else if (avgLoad <= 55) { status = 'Moderate'; }
  else if (avgLoad <= 80) { status = 'High';     }
  else                    { status = 'Critical'; }
  return { avgLoad, available, status };
}

/* ─────────────────────────────────────────────
   3. DOM ELEMENT CACHE
───────────────────────────────────────────── */
const $ = id => document.getElementById(id);

const els = {
  landingPage:     $('landing-page'),
  dashPage:        $('dashboard-page'),
  goDash:          $('go-dashboard'),
  slider:          $('rainfall-slider'),
  rainfallDisplay: $('rainfall-display'),
  lastUpdated:     $('last-updated-time'),
  rfBar:           $('rf-bar'),
  dlBar:           $('dl-bar'),
  rfPct:           $('rf-pct'),
  dlPct:           $('dl-pct'),
  drainAvail:      $('drain-available'),
  drainLoad:       $('drain-load'),
  drainStatus:     $('drain-status'),
  drainBarFill:    $('drain-bar-fill'),
  alertBox:        $('alert-box'),
  alertIcon:       $('alert-icon'),
  alertTitle:      $('alert-title'),
  alertMsg:        $('alert-msg'),
  zoneCards:       $('zone-cards'),
  statRainfall:    $('stat-rainfall'),
  statHigh:        $('stat-high'),
  statCrit:        $('stat-crit'),
  statDrain:       $('stat-drain'),
  statOverall:     $('stat-overall'),
  resetBtn:        $('reset-btn'),
  modal:           $('zone-modal'),
  modalClose:      $('modal-close'),
  hamburger:       $('hamburger'),
  navLinks:        $('nav-links')
};

/* ─────────────────────────────────────────────
   4. HELPERS
───────────────────────────────────────────── */
const RISK_CSS = {
  LOW:      { zone: 'zone-low',  fill: 'bc-low',  text: 'rc-low',  alert: 'alert-low',  border: 'bd-low',  statusCls: 'status-normal'   },
  MODERATE: { zone: 'zone-mod',  fill: 'bc-mod',  text: 'rc-mod',  alert: 'alert-mod',  border: 'bd-mod',  statusCls: 'status-moderate' },
  HIGH:     { zone: 'zone-high', fill: 'bc-high', text: 'rc-high', alert: 'alert-high', border: 'bd-high', statusCls: 'status-high'     },
  CRITICAL: { zone: 'zone-crit', fill: 'bc-crit', text: 'rc-crit', alert: 'alert-crit', border: 'bd-crit', statusCls: 'status-critical' }
};

function riskLevelClass(level) { return RISK_CSS[level]; }

function animateValue(el, newVal) {
  if (el.textContent === newVal) return;
  el.textContent = newVal;
  el.classList.remove('num-pop');
  void el.offsetWidth; // reflow
  el.classList.add('num-pop');
}

function nowTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ─────────────────────────────────────────────
   5. ALERT CONFIG
───────────────────────────────────────────── */
const ALERTS = {
  LOW: {
    icon:  '🟢',
    title: 'System Normal',
    msg:   'Current conditions are within safe limits.'
  },
  MODERATE: {
    icon:  '🟡',
    title: 'Moderate Alert',
    msg:   'Rainfall increasing. Monitor drainage capacity.'
  },
  HIGH: {
    icon:  '🟠',
    title: 'High Risk Alert',
    msg:   'Heavy rainfall detected. High-risk zones require immediate attention.'
  },
  CRITICAL: {
    icon:  '🔴',
    title: 'Critical Flood Alert',
    msg:   'Extreme rainfall and overloaded drainage detected. Immediate response recommended.'
  }
};

/* Determine overall risk level from avg risk pct */
function overallLevel(avgPct) {
  if (avgPct <= 30)      return 'LOW';
  if (avgPct <= 60)      return 'MODERATE';
  if (avgPct <= 80)      return 'HIGH';
  return 'CRITICAL';
}

/* ─────────────────────────────────────────────
   6. UPDATE ALL – master update function
───────────────────────────────────────────── */
function updateAll(rainfall) {
  const results = {};
  let sumRisk = 0;
  let highCount = 0;
  let critCount = 0;

  Object.keys(ZONE_DATA).forEach(key => {
    results[key] = calcZoneRisk(rainfall, key);
    sumRisk += results[key].riskPct;
    if (results[key].riskLevel === 'HIGH')     highCount++;
    if (results[key].riskLevel === 'CRITICAL') critCount++;
  });

  const avgRisk    = Math.round(sumRisk / Object.keys(ZONE_DATA).length);
  const overall    = overallLevel(avgRisk);
  const globalDr   = calcGlobalDrainage(rainfall);
  const rfFactorGl = rainfall / 150;

  // ── Slider display ──
  els.rainfallDisplay.textContent = `${rainfall} mm/hr`;

  // ── Coupling bars ──
  const rfPct = Math.round(rfFactorGl * 100);
  els.rfBar.style.width = rfPct + '%';
  els.rfPct.textContent = rfPct + '%';
  els.dlBar.style.width = globalDr.avgLoad + '%';
  els.dlPct.textContent = globalDr.avgLoad + '%';

  // ── Drainage card ──
  els.drainAvail.textContent   = globalDr.available + '%';
  animateValue(els.drainLoad,  globalDr.avgLoad + '%');
  els.drainBarFill.style.width = globalDr.avgLoad + '%';

  // Status tag
  const dStatusCls = RISK_CSS[
    globalDr.status === 'Normal'   ? 'LOW'      :
    globalDr.status === 'Moderate' ? 'MODERATE' :
    globalDr.status === 'High'     ? 'HIGH'     : 'CRITICAL'
  ].statusCls;
  els.drainStatus.textContent  = globalDr.status;
  els.drainStatus.className    = 'ds-value status-tag ' + dStatusCls;

  // ── Alert panel ──
  const alert = ALERTS[overall];
  els.alertIcon.textContent  = alert.icon;
  els.alertTitle.textContent = alert.title;
  els.alertMsg.textContent   = alert.msg;
  els.alertBox.className     = 'alert-box alert-' + overall.toLowerCase().replace('moderate', 'mod').replace('critical', 'crit');

  // ── Map zones ──
  Object.keys(results).forEach(key => {
    const r   = results[key];
    const css = riskLevelClass(r.riskLevel);
    const svgZone = document.getElementById('zone-' + key);
    const svgPct  = document.getElementById('zone-' + key + '-pct');
    if (svgZone) {
      svgZone.className.baseVal = 'map-zone ' + css.zone;
    }
    if (svgPct) {
      svgPct.textContent = r.riskPct + '%';
    }
  });

  // ── Zone mini cards ──
  updateZoneCards(results, rainfall);

  // ── Stats bar ──
  animateValue(els.statRainfall, rainfall + ' mm/hr');
  animateValue(els.statHigh,     String(highCount));
  animateValue(els.statCrit,     String(critCount));
  animateValue(els.statDrain,    globalDr.avgLoad + '%');
  animateValue(els.statOverall,  overall);

  // Style stat-overall colour
  const ocls = riskLevelClass(overall);
  els.statOverall.style.color = getComputedStyle(document.documentElement)
    .getPropertyValue(
      overall === 'LOW'      ? '--green'  :
      overall === 'MODERATE' ? '--yellow' :
      overall === 'HIGH'     ? '--orange' : '--red'
    );

  // ── Timestamp ──
  els.lastUpdated.textContent = nowTime();
}

/* ─────────────────────────────────────────────
   7. ZONE MINI CARDS
───────────────────────────────────────────── */
function updateZoneCards(results, rainfall) {
  const container = els.zoneCards;

  // Build or update
  Object.keys(results).forEach(key => {
    const r   = results[key];
    const z   = ZONE_DATA[key];
    const css = riskLevelClass(r.riskLevel);
    let card  = document.getElementById('zmc-' + key);

    if (!card) {
      card = document.createElement('div');
      card.className = 'zone-mini-card';
      card.id = 'zmc-' + key;
      card.setAttribute('data-zone', key);
      card.setAttribute('tabindex', '0');
      card.setAttribute('title', 'Click for details');
      card.addEventListener('click', () => openModal(key));
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openModal(key); });
      container.appendChild(card);
    }

    card.className = 'zone-mini-card ' + css.border;

    card.innerHTML = `
      <div class="zmc-header">
        <span class="zmc-name">${z.name}</span>
        <span class="zmc-pct ${css.text}">${r.riskPct}%</span>
      </div>
      <div class="zmc-bar-bg">
        <div class="zmc-bar-fill ${css.fill}" style="width:${r.riskPct}%"></div>
      </div>
      <div class="zmc-meta">
        <span class="zmc-tag ${css.text}">${r.riskLevel}</span>
        <span class="zmc-tag">🌧 ${rainfall} mm/hr</span>
        <span class="zmc-tag">🚰 Load: ${r.drainLoad}%</span>
        <span class="zmc-tag">${r.drainStatus}</span>
      </div>
    `;
  });
}

/* ─────────────────────────────────────────────
   8. MODAL
───────────────────────────────────────────── */
function floodConditionText(riskLevel) {
  return {
    LOW:      'Minimal flooding expected',
    MODERATE: 'Localised waterlogging possible',
    HIGH:     'Significant flooding likely',
    CRITICAL: 'Severe flooding – emergency conditions'
  }[riskLevel];
}

function recommendedAction(riskLevel) {
  return {
    LOW:      'No immediate action required. Continue routine monitoring.',
    MODERATE: 'Rainfall increasing. Monitor drainage capacity and stay informed.',
    HIGH:     'Monitor continuously. Prepare emergency response teams. Avoid low areas.',
    CRITICAL: 'Evacuate if necessary. Deploy emergency response immediately. All units alert.'
  }[riskLevel];
}

function openModal(zoneKey) {
  const rainfall  = parseInt(els.slider.value, 10);
  const r         = calcZoneRisk(rainfall, zoneKey);
  const z         = ZONE_DATA[zoneKey];
  const css       = riskLevelClass(r.riskLevel);
  const modal     = els.modal;

  // Populate
  document.getElementById('modal-zone-name').textContent = z.name;
  document.getElementById('m-rainfall').textContent  = rainfall + ' mm/hr';
  document.getElementById('m-risk').textContent      = r.riskPct + '%';
  document.getElementById('m-level').textContent     = r.riskLevel;
  document.getElementById('m-dcap').textContent      = z.drainCap + '%';
  document.getElementById('m-dload').textContent     = r.drainLoad + '%';
  document.getElementById('m-flood').textContent     = floodConditionText(r.riskLevel);
  document.getElementById('m-action').textContent    = recommendedAction(r.riskLevel);

  // Colour risk level
  document.getElementById('m-level').className = 'mi-val ' + css.text;

  // Border colour
  document.querySelector('.modal-box').style.borderTopColor =
    r.riskLevel === 'LOW'      ? '#27ae60' :
    r.riskLevel === 'MODERATE' ? '#f39c12' :
    r.riskLevel === 'HIGH'     ? '#e67e22' : '#c0392b';

  // Route suggestion (HIGH or CRITICAL only)
  const routeSection = document.getElementById('modal-route');
  const routeBody    = document.getElementById('route-body');
  if (r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL') {
    routeSection.style.display = 'block';
    routeBody.innerHTML = `
      <p><span class="avoid">⛔ Avoid:</span> ${z.routes.avoid}</p>
      <p style="margin-top:0.4rem"><span class="route">✅ Suggested Safe Route:</span></p>
      <p>${z.routes.safe}</p>
    `;
  } else {
    routeSection.style.display = 'none';
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  els.modal.classList.remove('open');
  document.body.style.overflow = '';
}

/* ─────────────────────────────────────────────
   9. MAP ZONE CLICK HANDLERS
───────────────────────────────────────────── */
function initMapZoneClicks() {
  document.querySelectorAll('.map-zone').forEach(el => {
    const key = el.getAttribute('data-zone');
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => openModal(key));
  });
}

/* ─────────────────────────────────────────────
   10. NAVIGATION
───────────────────────────────────────────── */
function showDashboard() {
  els.landingPage.classList.remove('active');
  els.dashPage.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initNavigation() {
  // Landing → Dashboard
  els.goDash.addEventListener('click', showDashboard);

  // Nav links smooth scroll (within dashboard)
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // close mobile menu
        els.navLinks.classList.remove('open');
        // active state
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        this.classList.add('active');
      }
    });
  });

  // Hamburger menu
  els.hamburger.addEventListener('click', () => {
    els.navLinks.classList.toggle('open');
  });

  // Close hamburger on outside click
  document.addEventListener('click', e => {
    if (!els.hamburger.contains(e.target) && !els.navLinks.contains(e.target)) {
      els.navLinks.classList.remove('open');
    }
  });
}

/* ─────────────────────────────────────────────
   11. SLIDER + RESET
───────────────────────────────────────────── */
function initControls() {
  els.slider.addEventListener('input', function() {
    updateAll(parseInt(this.value, 10));
  });

  els.resetBtn.addEventListener('click', function() {
    els.slider.value = 40;
    updateAll(40);
    // brief visual feedback
    this.textContent = '✓ Reset!';
    setTimeout(() => { this.textContent = '↺ RESET SIMULATION'; }, 1200);
  });
}

/* ─────────────────────────────────────────────
   12. MODAL CLOSE HANDLERS
───────────────────────────────────────────── */
function initModal() {
  els.modalClose.addEventListener('click', closeModal);
  els.modal.addEventListener('click', function(e) {
    if (e.target === this) closeModal();   // click backdrop
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

/* ─────────────────────────────────────────────
   13. INITIALISE
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  initNavigation();
  initControls();
  initModal();
  initMapZoneClicks();

  // Initial render with default rainfall = 40 mm/hr
  updateAll(40);
});
