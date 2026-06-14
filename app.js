const CF_API = 'https://codeforces.com/api';

// In-memory credentials (never persisted to disk)
let CF_KEY = '';
let CF_SECRET = '';

let diffChartInst = null;
let tagChartInst = null;

const TAG_GROUPS = {
  'dp': 'DP',
  'graphs': 'Graphs',
  'greedy': 'Greedy',
  'math': 'Math',
  'binary search': 'Binary Search',
  'trees': 'Trees',
  'number theory': 'Number Theory',
  'constructive algorithms': 'Constructive',
  'strings': 'Strings',
  'brute force': 'Brute Force',
};

const RANK_STYLES = {
  'newbie':          { color: '#808080', bg: 'rgba(128,128,128,0.1)', border: 'rgba(128,128,128,0.3)' },
  'pupil':           { color: '#008000', bg: 'rgba(0,128,0,0.1)',     border: 'rgba(0,128,0,0.3)'     },
  'specialist':      { color: '#03a89e', bg: 'rgba(3,168,158,0.1)',   border: 'rgba(3,168,158,0.3)'   },
  'expert':          { color: '#4f9cf9', bg: 'rgba(79,156,249,0.1)',  border: 'rgba(79,156,249,0.3)'  },
  'candidate master':{ color: '#aa00aa', bg: 'rgba(170,0,170,0.1)',   border: 'rgba(170,0,170,0.3)'   },
  'master':          { color: '#ff8c00', bg: 'rgba(255,140,0,0.1)',   border: 'rgba(255,140,0,0.3)'   },
  'international master':{ color:'#ff8c00',bg:'rgba(255,140,0,0.1)', border:'rgba(255,140,0,0.3)'    },
  'grandmaster':     { color: '#f44747', bg: 'rgba(244,71,71,0.1)',   border: 'rgba(244,71,71,0.3)'   },
  'international grandmaster':{ color:'#f44747',bg:'rgba(244,71,71,0.1)',border:'rgba(244,71,71,0.3)'},
  'legendary grandmaster':{ color:'#f44747',bg:'rgba(244,71,71,0.1)',border:'rgba(244,71,71,0.3)'    },
};

function toggleSettings() {
  const panel = document.getElementById('settingsPanel');
  panel.classList.toggle('open');
  if (CF_KEY) document.getElementById('cfApiKey').value = CF_KEY;
  if (CF_SECRET) document.getElementById('cfApiSecret').value = CF_SECRET;
}

function saveApiCredentials() {
  const key = document.getElementById('cfApiKey').value.trim();
  const secret = document.getElementById('cfApiSecret').value.trim();
  if (!key || !secret) {
    document.getElementById('settingsStatus').textContent = '⚠ Both fields required';
    document.getElementById('settingsStatus').style.color = 'var(--red)';
    return;
  }
  CF_KEY = key;
  CF_SECRET = secret;
  document.getElementById('settingsDot').classList.add('active');
  document.getElementById('savedLabel').textContent = '✓ saved';
  document.getElementById('settingsStatus').textContent = '✓ Credentials saved for this session';
  document.getElementById('settingsStatus').style.color = 'var(--green)';
  setTimeout(() => {
    document.getElementById('settingsPanel').classList.remove('open');
    document.getElementById('settingsStatus').textContent = '';
  }, 1800);
}

function clearApiCredentials() {
  CF_KEY = ''; CF_SECRET = '';
  document.getElementById('cfApiKey').value = '';
  document.getElementById('cfApiSecret').value = '';
  document.getElementById('settingsDot').classList.remove('active');
  document.getElementById('savedLabel').textContent = '';
  document.getElementById('settingsStatus').textContent = 'Cleared — using public API';
  document.getElementById('settingsStatus').style.color = 'var(--text2)';
}

// Build a signed Codeforces API URL using key + secret
async function signedUrl(method, params) {
  const time = Math.floor(Date.now() / 1000);
  const rand = Math.floor(100000 + Math.random() * 900000);
  const allParams = { ...params, apiKey: CF_KEY, time };
  const sorted = Object.keys(allParams).sort().map(k => `${k}=${allParams[k]}`).join('&');
  const toHash = `${rand}/${method}?${sorted}#${CF_SECRET}`;
  
  // SHA-512 via SubtleCrypto
  const msgBuf = new TextEncoder().encode(toHash);
  const hashBuf = await crypto.subtle.digest('SHA-512', msgBuf);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  const hashHex = hashArr.map(b => b.toString(16).padStart(2,'0')).join('');
  const apiSig = `${rand}${hashHex}`;
  return `${CF_API}/${method}?${sorted}&apiSig=${apiSig}`;
}

async function cfFetch(method, params) {
  let url;
  if (CF_KEY && CF_SECRET) {
    url = await signedUrl(method, params);
  } else {
    const qs = Object.entries(params).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    url = `${CF_API}/${method}?${qs}`;
  }
  const res = await fetch(url);
  return res.json();
}

function getRankStyle(rank) {
  if (!rank) return { color: '#8b92a8', bg: 'rgba(139,146,168,0.1)', border: 'rgba(139,146,168,0.3)' };
  const key = rank.toLowerCase();
  for (const k in RANK_STYLES) { if (key.includes(k)) return RANK_STYLES[k]; }
  return { color: '#8b92a8', bg: 'rgba(139,146,168,0.1)', border: 'rgba(139,146,168,0.3)' };
}

function showError(msg) {
  const box = document.getElementById('errorBox');
  box.textContent = '⚠ ' + msg;
  box.style.display = 'block';
}

function hideError() {
  document.getElementById('errorBox').style.display = 'none';
}

async function analyze() {
  const handle = document.getElementById('handleInput').value.trim();
  if (!handle) { showError('Enter a Codeforces handle.'); return; }

  hideError();
  document.getElementById('analyzeBtn').disabled = true;
  document.getElementById('loadingHandle').textContent = handle;
  document.getElementById('searchSection').style.display = 'none';
  document.getElementById('loadingState').style.display = 'block';
  document.getElementById('dashboard').style.display = 'none';

  try {
    const [infoData, subsData] = await Promise.all([
      cfFetch('user.info', { handles: handle }),
      cfFetch('user.status', { handle, from: 1, count: 10000 })
    ]);

    if (infoData.status !== 'OK') throw new Error(infoData.comment || 'User not found');
    if (subsData.status !== 'OK') throw new Error(subsData.comment || 'Could not fetch submissions');

    const user = infoData.result[0];
    const subs = subsData.result;

    buildDashboard(user, subs, handle);

  } catch (e) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('searchSection').style.display = 'block';
    showError(e.message || 'Failed to fetch data. Check the handle and try again.');
  } finally {
    document.getElementById('analyzeBtn').disabled = false;
  }
}

function buildDashboard(user, subs, handle) {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';

  // ── Profile banner ──
  const rank = user.rank || 'unrated';
  const rs = getRankStyle(rank);
  const initials = (user.firstName ? user.firstName[0] : handle[0]).toUpperCase();
  const ring = document.getElementById('avatarRing');
  ring.textContent = initials;
  ring.style.background = rs.bg;
  ring.style.borderColor = rs.border;
  ring.style.color = rs.color;

  document.getElementById('profileHandle').textContent = user.handle;
  document.getElementById('profileHandle').style.color = rs.color;
  document.getElementById('profileCountry').textContent = user.country || 'Location unknown';
  document.getElementById('profileOrg').textContent = user.organization || '';

  const badge = document.getElementById('rankBadge');
  badge.textContent = rank.charAt(0).toUpperCase() + rank.slice(1);
  badge.style.color = rs.color;
  badge.style.borderColor = rs.border;
  badge.style.background = rs.bg;

  document.getElementById('maxRating').textContent = user.maxRating ? user.maxRating : '—';
  document.getElementById('maxRating').style.color = rs.color;

  // ── Compute stats ──
  const totalSubs = subs.length;
  const acceptedSubs = subs.filter(s => s.verdict === 'OK');

  // Unique accepted problems (by problem ID)
  const solvedSet = new Map();
  acceptedSubs.forEach(s => {
    const key = s.problem.contestId + '_' + s.problem.index;
    if (!solvedSet.has(key)) solvedSet.set(key, s.problem);
  });
  const uniqueSolved = [...solvedSet.values()];
  const totalSolved = uniqueSolved.length;
  const acRate = totalSubs > 0 ? ((acceptedSubs.length / totalSubs) * 100).toFixed(1) : '0.0';

  const ratedProblems = uniqueSolved.filter(p => p.rating);
  const hardest = ratedProblems.length ? Math.max(...ratedProblems.map(p => p.rating)) : 0;
  const avgDiff = ratedProblems.length
    ? Math.round(ratedProblems.reduce((s, p) => s + p.rating, 0) / ratedProblems.length)
    : 0;

  // ── Set hero ──
  document.getElementById('totalSolvedBig').textContent = totalSolved.toLocaleString();
  document.getElementById('solvedSubtext').textContent =
    `Across ${totalSubs.toLocaleString()} total submissions`;
  document.getElementById('statTotal').textContent = totalSubs.toLocaleString();
  document.getElementById('statAccepted').textContent = acceptedSubs.length.toLocaleString();
  document.getElementById('statRate').textContent = acRate + '%';
  document.getElementById('statHardest').textContent = hardest || '—';
  document.getElementById('statAvg').textContent = avgDiff || '—';

  // ── Difficulty distribution ──
  const diffBands = {};
  ratedProblems.forEach(p => {
    const band = Math.floor(p.rating / 100) * 100;
    diffBands[band] = (diffBands[band] || 0) + 1;
  });
  const sortedBands = Object.keys(diffBands).map(Number).sort((a,b)=>a-b);
  document.getElementById('diffBadge').textContent = sortedBands.length + ' bands';

  const diffWrap = document.getElementById('diffChartWrap');
  diffWrap.style.height = Math.max(200, sortedBands.length * 32 + 60) + 'px';

  if (diffChartInst) { diffChartInst.destroy(); diffChartInst = null; }
  diffChartInst = new Chart(document.getElementById('diffChart'), {
    type: 'bar',
    data: {
      labels: sortedBands.map(b => b === 3500 ? '3500+' : String(b)),
      datasets: [{
        label: 'Problems solved',
        data: sortedBands.map(b => diffBands[b]),
        backgroundColor: sortedBands.map(b => diffColor(b)),
        borderRadius: 5,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1e29',
          titleColor: '#8b92a8',
          bodyColor: '#e8eaf0',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            title: ctx => 'Rating ' + ctx[0].label,
            label: ctx => ' ' + ctx.raw + ' problems'
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#555d72', font: { family: "'JetBrains Mono'" }, stepSize: 1 },
          border: { color: 'rgba(255,255,255,0.06)' }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#8b92a8', font: { family: "'JetBrains Mono'", size: 12 } },
          border: { color: 'rgba(255,255,255,0.06)' }
        }
      }
    }
  });

  // ── Tags distribution ──
  const tagCounts = {};
  uniqueSolved.forEach(p => {
    if (!p.tags || !p.tags.length) return;
    let matched = false;
    p.tags.forEach(t => {
      const tl = t.toLowerCase();
      for (const key in TAG_GROUPS) {
        if (tl === key) { tagCounts[TAG_GROUPS[key]] = (tagCounts[TAG_GROUPS[key]] || 0) + 1; matched = true; }
      }
    });
    if (!matched) tagCounts['Others'] = (tagCounts['Others'] || 0) + 1;
  });

  const tagEntries = Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]);
  document.getElementById('tagBadge').textContent = tagEntries.length + ' topics';

  // Strongest topic
  if (tagEntries.length) {
    document.getElementById('strongestTopic').textContent = tagEntries[0][0];
    document.getElementById('strongestCount').textContent = tagEntries[0][1] + ' problems solved';
  }

  // Most attempted (from all AC subs, by tag occurrence)
  const tagAttempts = {};
  acceptedSubs.forEach(s => {
    if (!s.problem.tags) return;
    s.problem.tags.forEach(t => {
      const tl = t.toLowerCase();
      for (const key in TAG_GROUPS) {
        if (tl === key) tagAttempts[TAG_GROUPS[key]] = (tagAttempts[TAG_GROUPS[key]] || 0) + 1;
      }
    });
  });
  const topAttempt = Object.entries(tagAttempts).sort((a,b)=>b[1]-a[1])[0];
  if (topAttempt) {
    document.getElementById('mostAttemptedTopic').textContent = topAttempt[0];
    document.getElementById('mostAttemptedCount').textContent = topAttempt[1] + ' accepted submissions';
  }

  const PIE_COLORS = [
    '#4f9cf9','#3dd68c','#f5a623','#7b61ff','#e879f9',
    '#f44747','#03a89e','#ff8c00','#aa00aa','#5eead4','#94a3b8'
  ];

  const tagLabels = tagEntries.map(e => e[0]);
  const tagData = tagEntries.map(e => e[1]);
  const tagTotal = tagData.reduce((a,b)=>a+b,0);

  // Build custom legend
  const legendEl = document.getElementById('tagLegend');
  legendEl.innerHTML = '';
  tagEntries.forEach(([name, count], i) => {
    const pct = tagTotal ? ((count/tagTotal)*100).toFixed(1) : 0;
    legendEl.innerHTML += `<span class="legend-item">
      <span class="legend-dot" style="background:${PIE_COLORS[i % PIE_COLORS.length]}"></span>
      ${name} ${pct}%
    </span>`;
  });

  if (tagChartInst) { tagChartInst.destroy(); tagChartInst = null; }
  tagChartInst = new Chart(document.getElementById('tagChart'), {
    type: 'doughnut',
    data: {
      labels: tagLabels,
      datasets: [{
        data: tagData,
        backgroundColor: PIE_COLORS.slice(0, tagLabels.length),
        borderColor: '#13161e',
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1e29',
          titleColor: '#8b92a8',
          bodyColor: '#e8eaf0',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: ctx => {
              const pct = tagTotal ? ((ctx.raw/tagTotal)*100).toFixed(1) : 0;
              return '  ' + ctx.raw + ' problems (' + pct + '%)';
            }
          }
        }
      }
    }
  });
}

function diffColor(r) {
  if (r < 1200) return '#808080';
  if (r < 1400) return '#008000';
  if (r < 1600) return '#03a89e';
  if (r < 1900) return '#4f9cf9';
  if (r < 2100) return '#aa00aa';
  if (r < 2400) return '#ff8c00';
  return '#f44747';
}

// Enter key support
document.getElementById('handleInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') analyze();
});