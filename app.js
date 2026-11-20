/**
 * app.js - Codeforces Telemetry & Analytics Engine
 * Optimized for high performance, cached API transactions, and aesthetic data visualization.
 */

const API = "https://codeforces.com/api/";
let charts = {};
let apiCreds = loadCreds();
const scriptURL = 'https://script.google.com/macros/s/AKfycbwpjdyTcCyParde7ppWBC57blAfdXREUc_3UCTBRfTjrYWLOc2Xm24k3dVI4fNZ7UE5/exec';
const $ = id => document.getElementById(id);

// =========================================================================
// 1. THEME CONTROLLER & API CREDENTIALS
// =========================================================================
function initTheme() {
  const savedTheme = localStorage.getItem('cf_analyzer_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeButton(savedTheme);

  const themeBtn = $('themeToggleBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('cf_analyzer_theme', next);
      updateThemeButton(next);
      window.dispatchEvent(new Event('themeChanged'));
      // Re-render charts with updated theme palette if open
      if ($('content').classList.contains('show') && window.__lastRenderData) {
        renderAll(window.__lastRenderData.user, window.__lastRenderData.ratingHistory, window.__lastRenderData.submissions, true);
      }
    });
  }
}

function updateThemeButton(theme) {
  const icon = $('themeIcon');
  const text = $('themeText');
  if (icon && text) {
    if (theme === 'dark') {
      icon.textContent = '☀';
      text.textContent = 'LIGHT';
    } else {
      icon.textContent = '☾';
      text.textContent = 'DARK';
    }
  }
}

function loadCreds() {
  try {
    const raw = localStorage.getItem('cf_analyzer_creds');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveCreds(key, secret) {
  localStorage.setItem('cf_analyzer_creds', JSON.stringify({ key, secret }));
  apiCreds = { key, secret };
  refreshApiStatus();
}

function clearCreds() {
  localStorage.removeItem('cf_analyzer_creds');
  apiCreds = null;
  $('apiKeyInput').value = '';
  $('apiSecretInput').value = '';
  refreshApiStatus();
}

function refreshApiStatus() {
  const el = $('apiStatusText');
  if (!el) return;
  if (apiCreds && apiCreds.key) {
    el.textContent = 'api: activated (' + apiCreds.key.slice(0, 6) + '…)';
    el.style.color = 'var(--accent)';
  } else {
    el.textContent = 'api: public mode';
    el.style.color = 'var(--mid)';
  }
}

async function sha512Hex(str) {
  const buf = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randString(len) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function buildUrl(methodName, params) {
  if (!apiCreds || !apiCreds.key || !apiCreds.secret) {
    const qs = new URLSearchParams(params).toString();
    return API + methodName + (qs ? '?' + qs : '');
  }
  const time = Math.floor(Date.now() / 1000);
  const allParams = { ...params, apiKey: apiCreds.key, time: String(time) };
  const sortedKeys = Object.keys(allParams).sort();
  const paramStr = sortedKeys.map(k => `${k}=${allParams[k]}`).join('&');
  const rand = randString(6);
  const toHash = `${rand}/${methodName}?${paramStr}#${apiCreds.secret}`;
  const apiSig = await sha512Hex(toHash);
  return `${API}${methodName}?${paramStr}&apiSig=${rand}${apiSig}`;
}

// =========================================================================
// 2. UI EVENT LISTENERS
// =========================================================================
$('settingsBtn').addEventListener('click', () => {
  $('settingsPanel').classList.toggle('open');
});

$('saveApiBtn').addEventListener('click', () => {
  const key = $('apiKeyInput').value.trim();
  const secret = $('apiSecretInput').value.trim();
  if (!key || !secret) {
    $('apiTestResult').textContent = 'enter both a key and a secret to activate.';
    $('apiTestResult').className = 'bad';
    return;
  }
  saveCreds(key, secret);
  $('apiTestResult').textContent = 'activated — saved in this browser only.';
  $('apiTestResult').className = 'ok';
});

$('clearApiBtn').addEventListener('click', () => {
  clearCreds();
  $('apiTestResult').textContent = 'cleared — back to public mode.';
  $('apiTestResult').className = '';
});

$('testApiBtn').addEventListener('click', async () => {
  const key = $('apiKeyInput').value.trim();
  const secret = $('apiSecretInput').value.trim();
  const prevCreds = apiCreds;
  if (key && secret) apiCreds = { key, secret };
  $('apiTestResult').textContent = 'testing…';
  $('apiTestResult').className = '';
  try {
    const url = await buildUrl('user.info', { handles: 'tourist' });
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK') {
      $('apiTestResult').textContent = 'connection ok ✓';
      $('apiTestResult').className = 'ok';
    } else {
      throw new Error(data.comment || 'request failed');
    }
  } catch (e) {
    $('apiTestResult').textContent = 'failed: ' + e.message;
    $('apiTestResult').className = 'bad';
    apiCreds = prevCreds;
  }
});

$('analyzeBtn').addEventListener('click', () => runAnalysis());
$('handleInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') runAnalysis();
});

$('newSearchBtn').addEventListener('click', () => {
  $('handleInput').focus();
  document.getElementById('search-section').scrollIntoView({ behavior: 'smooth' });
});

$('exportBtn').addEventListener('click', exportPDF);

// Quick pick handles
document.querySelectorAll('.chip[data-handle]').forEach(chip => {
  chip.addEventListener('click', () => {
    $('handleInput').value = chip.dataset.handle;
    runAnalysis(chip.dataset.handle);
  });
});

function showError(msg) {
  const box = $('errorBox');
  box.textContent = "ERR // " + msg;
  box.classList.add('show');
}

function clearError() {
  $('errorBox').classList.remove('show');
  $('errorBox').textContent = '';
}

function setLoading(on, text) {
  $('loader').classList.toggle('show', on);
  if (text) $('loaderText').textContent = text;
  $('analyzeBtn').disabled = on;
}

// =========================================================================
// 3. CODEFORCES API WITH INTELLIGENT CACHING
// =========================================================================
async function cfFetch(methodName, params = {}) {
  const cacheKey = `cf_${methodName}_${JSON.stringify(params)}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      // Cache valid for 3 minutes
      if (Date.now() - parsed.timestamp < 180000) {
        return parsed.data;
      }
    } catch (e) { /* fallback to fetch */ }
  }

  const url = await buildUrl(methodName, params);
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK') throw new Error(data.comment || 'API error');

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: data.result }));
  } catch (e) { /* storage quota limit */ }

  return data.result;
}

async function runAnalysis(manualHandle) {
  const handle = (manualHandle || $('handleInput').value).trim();
  clearError();
  if (!handle) {
    showError('please enter a valid Codeforces handle');
    return;
  }

  // Update URL search query without reloading
  const newUrl = new URL(window.location);
  newUrl.searchParams.set('handle', handle);
  window.history.replaceState({}, '', newUrl);

  $('content').classList.remove('show');
  setLoading(true, `interrogating telemetry for "${handle}"…`);

  try {
    const [info, rating, status] = await Promise.allSettled([
      cfFetch('user.info', { handles: handle }),
      cfFetch('user.rating', { handle: handle }),
      cfFetch('user.status', { handle: handle, from: '1', count: '10000' })
    ]);

    if (info.status === 'rejected') {
      throw new Error(info.reason.message || 'handle not found or API unavailable');
    }

    const userInfo = info.value[0];
    const ratingHistory = rating.status === 'fulfilled' ? rating.value : [];
    const submissions = status.status === 'fulfilled' ? status.value : [];

    setLoading(true, 'synthesizing telemetry models…');
    await new Promise(r => setTimeout(r, 120));

    // Save state for responsive theme switches
    window.__lastRenderData = { user: userInfo, ratingHistory, submissions };

    renderAll(userInfo, ratingHistory, submissions);

    setLoading(false);
    $('content').classList.add('show');
    if (window.initScrollReveal) window.initScrollReveal();
    $('content').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    setLoading(false);
    showError(err.message || 'Network error. Verify handle and try again.');
  }
}

// Background sync to Google Sheet (non-blocking)
async function saveToGoogleSheet(user, stats) {
  try {
    const strongest = Object.entries(stats.tagCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";
    await fetch(scriptURL, {
      method: "POST",
      mode: 'no-cors',
      body: new URLSearchParams({
        handle: user.handle,
        rating: user.rating || 0,
        maxRating: user.maxRating || 0,
        totalSolved: stats.solvedCount || 0,
        currentStreak: stats.curStreak || 0,
        strongestTopic: strongest
      })
    });
  } catch (err) {
    // Silent catch
  }
}

// =========================================================================
// 4. DATA PROCESSING & STATS COMPUTATION
// =========================================================================
function computeSubmissionStats(subs) {
  const solvedSet = new Set();
  const solvedProblems = [];
  let totalOK = 0;
  const verdictCount = {};
  const tagCount = {};
  const difficultyBuckets = {};
  const dateSet = new Set();
  const monthMap = {};
  const yearMap = {};
  
  // FIX: Properly initialize attemptedProblemTags
  const attemptedProblemTags = {};

  for (const s of subs) {
    const verdict = s.verdict || 'UNKNOWN';
    verdictCount[verdict] = (verdictCount[verdict] || 0) + 1;
    const p = s.problem;
    if (!p) continue;
    const pid = String(p.contestId || '') + String(p.index || '');

    if (p.tags) {
      for (const t of p.tags) {
        if (!attemptedProblemTags[t]) attemptedProblemTags[t] = new Set();
        attemptedProblemTags[t].add(pid);
      }
    }

    if (verdict === 'OK') {
      totalOK++;
      if (!solvedSet.has(pid)) {
        solvedSet.add(pid);
        solvedProblems.push(p);
        const d = new Date(s.creationTimeSeconds * 1000);
        const dayKey = d.toISOString().slice(0, 10);
        dateSet.add(dayKey);
        const monthKey = d.toISOString().slice(0, 7);
        monthMap[monthKey] = (monthMap[monthKey] || 0) + 1;
        const yearKey = String(d.getFullYear());
        yearMap[yearKey] = (yearMap[yearKey] || 0) + 1;

        if (p.rating) {
          const bucket = Math.floor(p.rating / 100) * 100;
          difficultyBuckets[bucket] = (difficultyBuckets[bucket] || 0) + 1;
        }
        if (p.tags) {
          for (const t of p.tags) {
            tagCount[t] = (tagCount[t] || 0) + 1;
          }
        }
      }
    }
  }

  const ratedSolves = solvedProblems.filter(p => p.rating);
  const avgRating = ratedSolves.length
    ? Math.round(ratedSolves.reduce((a, p) => a + p.rating, 0) / ratedSolves.length)
    : 0;

  const tagSuccess = {};
  for (const t in tagCount) {
    const attempted = attemptedProblemTags[t] ? attemptedProblemTags[t].size : tagCount[t];
    tagSuccess[t] = { solved: tagCount[t], attempted, rate: attempted ? tagCount[t] / attempted : 0 };
  }

  return {
    totalSubmissions: subs.length,
    totalOK,
    solvedCount: solvedSet.size,
    verdictCount,
    tagCount,
    tagSuccess,
    difficultyBuckets,
    dateSet,
    monthMap,
    yearMap,
    avgRating,
    acceptanceRate: subs.length ? (solvedSet.size / subs.length * 100) : 0
  };
}

// =========================================================================
// 5. RENDERING PIPELINE
// =========================================================================
function renderAll(user, ratingHistory, submissions, isThemeRefresh = false) {
  const submStats = computeSubmissionStats(submissions);
  
  renderProfileHead(user);
  renderStatGrid(user, ratingHistory, submStats);
  renderRatingChart(ratingHistory);
  renderDifficultyChart(submStats);
  renderVerdictChart(submStats);
  renderTags(submStats);
  renderStreaks(submStats);
  renderMonthlyYearly(submStats);
  renderContestTable(ratingHistory);
  renderRecentActivity(submissions);

  if (!isThemeRefresh) {
    saveToGoogleSheet(user, submStats);
  }
  $('footHandle').textContent = user.handle;
}

// Codeforces Rank Color Palette
function getRankTheme(rank) {
  const r = (rank || '').toLowerCase();
  if (r.includes('legendary') || r.includes('tourist')) return { color: '#ff3333', name: 'Legendary Grandmaster' };
  if (r.includes('grandmaster')) return { color: '#ff4444', name: 'Grandmaster' };
  if (r.includes('master')) return { color: '#ffbb55', name: 'Master' };
  if (r.includes('candidate')) return { color: '#bb55ff', name: 'Candidate Master' };
  if (r.includes('expert')) return { color: '#5588ff', name: 'Expert' };
  if (r.includes('specialist')) return { color: '#03a89e', name: 'Specialist' };
  if (r.includes('pupil')) return { color: '#00cc66', name: 'Pupil' };
  if (r.includes('newbie')) return { color: '#999999', name: 'Newbie' };
  return { color: 'var(--mid)', name: 'Unrated' };
}

function renderProfileHead(user) {
  $('handleName').textContent = user.handle;
  const rankInfo = getRankTheme(user.rank);
  $('handleName').style.color = rankInfo.color;

  const cfLink = $('cfProfileLink');
  if (cfLink) cfLink.href = `https://codeforces.com/profile/${encodeURIComponent(user.handle)}`;

  const avatar = $('avatar');
  if (user.avatar && !user.avatar.includes('no-avatar')) {
    avatar.src = user.avatar.startsWith('http') ? user.avatar : 'https:' + user.avatar;
    avatar.style.display = 'block';
    avatar.style.borderColor = rankInfo.color;
  } else {
    avatar.style.display = 'none';
  }

  const org = user.organization ? ' · ' + user.organization : '';
  const loc = [user.city, user.country].filter(Boolean).join(', ');
  $('profileSub').textContent = [loc, org].filter(Boolean).join('') || 'Global Competitor';

  const pill = $('rankPill');
  pill.textContent = (user.rank || 'unrated').toUpperCase();
  pill.style.borderColor = rankInfo.color;
  pill.style.color = rankInfo.color;
}

function renderStatGrid(user, ratingHistory, st) {
  const stats = [
    { v: user.rating ?? '—', l: 'Current Rating', sub: '' },
    { v: user.maxRating ?? '—', l: 'Max Rating', sub: user.maxRank ? `peak: ${user.maxRank}` : '' },
    { v: (user.rank || 'unrated'), l: 'Current Rank', sub: '' },
    { v: st.solvedCount, l: 'Problems Solved', sub: '' },
    { v: st.totalSubmissions, l: 'Total Submissions', sub: '' },
    { v: st.acceptanceRate.toFixed(1) + '%', l: 'Acceptance Rate', sub: '' },
    { v: ratingHistory.length, l: 'Contests Played', sub: '' },
    { v: st.avgRating || '—', l: 'Avg Solved Rating', sub: '' },
    { v: ratingHistory.length ? Math.max(...ratingHistory.map(r => r.newRating - r.oldRating)) : '—', l: 'Best Rating Gain', sub: '' },
    { v: Object.keys(st.tagCount).length, l: 'Distinct Tags', sub: '' },
    { v: st.dateSet.size, l: 'Active Solve Days', sub: '' },
    { v: user.contribution ?? 0, l: 'Contribution', sub: '' },
  ];

  $('statGrid').innerHTML = stats.map(s => `
    <div class="stat">
      <div class="v">${s.v}</div>
      <div class="l">${s.l}</div>
      ${s.sub ? `<div class="sub2">${s.sub}</div>` : ''}
    </div>
  `).join('');
}

function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
    delete charts[key];
  }
}

function getChartColors() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    line: isLight ? '#0052cc' : '#00f0ff',
    fill: isLight ? 'rgba(0, 82, 204, 0.08)' : 'rgba(0, 240, 255, 0.1)',
    grid: isLight ? '#e2e8f0' : '#1c263c',
    text: isLight ? '#475569' : '#8892b0',
    bar: isLight ? '#0052cc' : '#00f0ff',
    surface: isLight ? '#ffffff' : '#101626'
  };
}

const monoFont = "'IBM Plex Mono', Consolas, monospace";

// Rating History Line Chart
function renderRatingChart(history) {
  destroyChart('rating');
  const canvasEl = $('ratingChart');
  const ctx = canvasEl.getContext('2d');
  const colors = getChartColors();

  if (!history.length) {
    canvasEl.parentElement.innerHTML = '<div style="font-size:13px;color:var(--mid);padding:40px 0;text-align:center;">No rated contests recorded for this handle.</div>';
    return;
  }

  const labels = history.map(r => r.contestName.length > 20 ? r.contestName.slice(0, 20) + '…' : r.contestName);
  const data = history.map(r => r.newRating);

  charts.rating = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Rating',
        data,
        borderColor: colors.line,
        backgroundColor: colors.fill,
        borderWidth: 2.5,
        pointRadius: history.length > 80 ? 1.5 : 3.5,
        pointHoverRadius: 6,
        pointBackgroundColor: colors.line,
        fill: true,
        tension: 0.2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#07090e',
          borderColor: colors.line,
          borderWidth: 1,
          titleFont: { family: monoFont, size: 12 },
          bodyFont: { family: monoFont, size: 12 },
          callbacks: {
            title: (items) => history[items[0].dataIndex].contestName,
            label: (item) => `Rating: ${item.raw} (Rank ${history[item.dataIndex].rank})`
          }
        }
      },
      scales: {
        x: { display: false },
        y: {
          grid: { color: colors.grid },
          ticks: { font: { family: monoFont, size: 10 }, color: colors.text }
        }
      }
    }
  });
}

// Difficulty Distribution Bar Chart
function renderDifficultyChart(st) {
  destroyChart('diff');
  const buckets = Object.keys(st.difficultyBuckets).map(Number).sort((a, b) => a - b);
  const canvasEl = $('difficultyChart');
  const ctx = canvasEl.getContext('2d');
  const colors = getChartColors();

  if (!buckets.length) {
    canvasEl.parentElement.innerHTML = '<div style="font-size:13px;color:var(--mid);padding:40px 0;text-align:center;">No rated solves identified.</div>';
    return;
  }

  charts.diff = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: buckets.map(b => String(b)),
      datasets: [{
        data: buckets.map(b => st.difficultyBuckets[b]),
        backgroundColor: colors.bar,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#07090e',
          borderColor: colors.line,
          borderWidth: 1,
          titleFont: { family: monoFont },
          bodyFont: { family: monoFont }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: monoFont, size: 9 }, color: colors.text } },
        y: { grid: { color: colors.grid }, ticks: { font: { family: monoFont, size: 10 }, color: colors.text } }
      }
    }
  });
}

// Verdict Doughnut Chart
function renderVerdictChart(st) {
  destroyChart('verdict');
  const entries = Object.entries(st.verdictCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const ctx = $('verdictChart').getContext('2d');
  const palette = ['#00f0ff', '#00ff88', '#ff3366', '#ffbb00', '#bb55ff', '#64748b'];

  charts.verdict = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{
        data: entries.map(e => e[1]),
        backgroundColor: palette,
        borderColor: 'var(--paper)',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { font: { family: monoFont, size: 11 }, boxWidth: 12, color: 'var(--ink)' }
        },
        tooltip: {
          backgroundColor: '#07090e',
          borderWidth: 1,
          titleFont: { family: monoFont },
          bodyFont: { family: monoFont }
        }
      },
      cutout: '62%'
    }
  });
}

// Tag List Generator
function renderTagList(elId, entries, mode) {
  const max = entries.length ? Math.max(...entries.map(e => e[1])) : 1;
  const listEl = $(elId);
  if (!listEl) return;

  listEl.innerHTML = entries.map(([name, val]) => {
    const pct = mode === 'rate' ? Math.round(val * 100) : Math.round((val / max) * 100);
    const display = mode === 'rate' ? Math.round(val * 100) + '%' : val;
    return `
      <li>
        <span class="name">${name}</span>
        <span class="bar-wrap"><span class="bar" style="width:${pct}%;"></span></span>
        <span class="num">${display}</span>
      </li>
    `;
  }).join('') || '<li><span class="name">no telemetry</span></li>';
}

function renderTags(st) {
  const tagEntries = Object.entries(st.tagCount).sort((a, b) => b[1] - a[1]);
  renderTagList('topTags', tagEntries.slice(0, 8), 'count');

  const strong = Object.entries(st.tagSuccess)
    .filter(([, v]) => v.solved >= 3)
    .sort((a, b) => (b[1].rate - a[1].rate) || (b[1].solved - a[1].solved))
    .slice(0, 8)
    .map(([k, v]) => [k, v.rate]);
  renderTagList('strongTags', strong, 'rate');

  const weak = tagEntries.slice(-8).reverse();
  renderTagList('weakTags', weak, 'count');
}

// Streak Calculation
function renderStreaks(st) {
  const days = Array.from(st.dateSet).sort();
  let longest = 0, run = 0;
  let prev = null;
  for (const d of days) {
    const day = new Date(d);
    if (prev) {
      const diff = (day - prev) / 86400000;
      run = diff === 1 ? run + 1 : 1;
    } else run = 1;
    longest = Math.max(longest, run);
    prev = day;
  }

  const daySet = st.dateSet;
  let cur = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  let key = cursor.toISOString().slice(0, 10);
  if (!daySet.has(key)) {
    cursor.setDate(cursor.getDate() - 1);
    key = cursor.toISOString().slice(0, 10);
  }
  while (daySet.has(key)) {
    cur++;
    cursor.setDate(cursor.getDate() - 1);
    key = cursor.toISOString().slice(0, 10);
  }

  st.curStreak = cur;
  $('curStreak').textContent = cur;
  $('maxStreak').textContent = longest;
  $('avgRating').textContent = st.avgRating || '—';
}

// Monthly & Yearly Timeline Solves
function renderMonthlyYearly(st) {
  destroyChart('monthly');
  destroyChart('yearly');
  const now = new Date();
  const monthLabels = [];
  const monthData = [];
  const colors = getChartColors();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    monthLabels.push(d.toLocaleString('en', { month: 'short', year: '2-digit' }));
    monthData.push(st.monthMap[key] || 0);
  }

  charts.monthly = new Chart($('monthlyChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: monthLabels,
      datasets: [{ data: monthData, backgroundColor: colors.bar, borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#07090e', titleFont: { family: monoFont }, bodyFont: { family: monoFont } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: monoFont, size: 9 }, color: colors.text } },
        y: { grid: { color: colors.grid }, ticks: { font: { family: monoFont, size: 10 }, color: colors.text } }
      }
    }
  });

  const years = Object.keys(st.yearMap).sort();
  charts.yearly = new Chart($('yearlyChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: years,
      datasets: [{ data: years.map(y => st.yearMap[y]), backgroundColor: colors.bar, borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#07090e', titleFont: { family: monoFont }, bodyFont: { family: monoFont } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: monoFont, size: 10 }, color: colors.text } },
        y: { grid: { color: colors.grid }, ticks: { font: { family: monoFont, size: 10 }, color: colors.text } }
      }
    }
  });
}

// Contest History Table
function renderContestTable(history) {
  const rows = history.slice().reverse();
  $('contestTable').innerHTML = rows.map((r, i) => {
    const delta = r.newRating - r.oldRating;
    const cls = delta >= 0 ? 'delta-up' : 'delta-down';
    return `
      <tr>
        <td>${rows.length - i}</td>
        <td><a href="https://codeforces.com/contest/${r.contestId}" target="_blank" rel="noopener">${r.contestName}</a></td>
        <td>${r.rank}</td>
        <td>${r.newRating}</td>
        <td class="${cls}">${delta >= 0 ? '+' : ''}${delta}</td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="5" style="color:var(--mid);text-align:center;">No contest history recorded.</td></tr>`;
}

// Recent Activity Table
function renderRecentActivity(subs) {
  const recent = subs.slice(0, 25);
  $('recentActivity').innerHTML = recent.map(s => {
    const d = new Date(s.creationTimeSeconds * 1000);
    const ok = s.verdict === 'OK';
    const p = s.problem;
    const probLink = p && p.contestId ? `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}` : '#';
    return `
      <div class="activity-item">
        <span>${d.toLocaleDateString()} — <a href="${probLink}" target="_blank" rel="noopener">${p.contestId || ''}${p.index || ''} ${p.name || ''}</a></span>
        <span class="${ok ? 'verdict-ok' : 'verdict-no'}">${s.verdict || '—'}</span>
      </div>
    `;
  }).join('') || '<div style="color:var(--mid);font-size:13px;text-align:center;">No recent activity identified.</div>';
}

// Export PDF using html2canvas & jsPDF
async function exportPDF() {
  const btn = $('exportBtn');
  const original = btn.textContent;
  btn.textContent = 'Rendering PDF…';
  btn.disabled = true;

  try {
    const target = document.getElementById('content');
    const canvas = await html2canvas(target, {
      scale: 2,
      backgroundColor: document.documentElement.getAttribute('data-theme') === 'light' ? '#ffffff' : '#07090e',
      useCORS: true
    });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    let heightLeft = imgH;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
    heightLeft -= pageH;

    while (heightLeft > 0) {
      position = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
      heightLeft -= pageH;
    }

    const handle = $('handleName').textContent || 'profile';
    pdf.save(`cf_analytics_${handle}.pdf`);
  } catch (e) {
    alert('Could not export PDF: ' + e.message);
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
}

// =========================================================================
// 6. INITIALIZATION & URL QUERY TRIGGER
// =========================================================================
window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  refreshApiStatus();

  if (apiCreds) {
    $('apiKeyInput').value = apiCreds.key || '';
    $('apiSecretInput').value = apiCreds.secret || '';
  }

  // URL query parameter check (e.g. ?handle=tourist)
  const params = new URLSearchParams(window.location.search);
  const handleQuery = params.get('handle');
  if (handleQuery) {
    $('handleInput').value = handleQuery;
    runAnalysis(handleQuery);
  }
});
