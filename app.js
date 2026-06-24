const API = "https://codeforces.com/api/";
let charts = {};
let apiCreds = loadCreds();
const scriptURL = 'https://script.google.com/macros/s/AKfycbxd8OSJYJyQUGqWHFGvwKgy1TB0murEUc0htBL6rmFACATqzQ40PaMCVjQMkg6MGuCj/exec';
const $ = id => document.getElementById(id);

function loadCreds(){
  try{
    const raw = localStorage.getItem('cf_analyzer_creds');
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}
function saveCreds(key, secret){
  localStorage.setItem('cf_analyzer_creds', JSON.stringify({key, secret}));
  apiCreds = {key, secret};
  refreshApiStatus();
}
function clearCreds(){
  localStorage.removeItem('cf_analyzer_creds');
  apiCreds = null;
  $('apiKeyInput').value = '';
  $('apiSecretInput').value = '';
  refreshApiStatus();
}
function refreshApiStatus(){
  const el = $('apiStatusText');
  if(apiCreds && apiCreds.key){
    el.textContent = 'api: activated (' + apiCreds.key.slice(0,6) + '…)';
  } else {
    el.textContent = 'api: public mode';
  }
}

async function sha512Hex(str){
  const buf = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function randString(len){
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for(let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}
// Builds a signed query string per Codeforces API auth spec when credentials are active.
async function buildUrl(methodName, params){
  if(!apiCreds || !apiCreds.key || !apiCreds.secret){
    const qs = new URLSearchParams(params).toString();
    return API + methodName + (qs ? '?' + qs : '');
  }
  const time = Math.floor(Date.now()/1000);
  const allParams = { ...params, apiKey: apiCreds.key, time: String(time) };
  const sortedKeys = Object.keys(allParams).sort();
  const paramStr = sortedKeys.map(k => `${k}=${allParams[k]}`).join('&');
  const rand = randString(6);
  const toHash = `${rand}/${methodName}?${paramStr}#${apiCreds.secret}`;
  const apiSig = await sha512Hex(toHash);
  return `${API}${methodName}?${paramStr}&apiSig=${rand}${apiSig}`;
}

$('settingsBtn').addEventListener('click', () => {
  $('settingsPanel').classList.toggle('open');
});
$('saveApiBtn').addEventListener('click', () => {
  const key = $('apiKeyInput').value.trim();
  const secret = $('apiSecretInput').value.trim();
  if(!key || !secret){
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
  if(key && secret) apiCreds = { key, secret };
  $('apiTestResult').textContent = 'testing…';
  $('apiTestResult').className = '';
  try{
    const url = await buildUrl('user.info', { handles: 'tourist' });
    const res = await fetch(url);
    const data = await res.json();
    if(data.status === 'OK'){
      $('apiTestResult').textContent = 'connection ok ✓';
      $('apiTestResult').className = 'ok';
    } else {
      throw new Error(data.comment || 'request failed');
    }
  }catch(e){
    $('apiTestResult').textContent = 'failed: ' + e.message;
    $('apiTestResult').className = 'bad';
    apiCreds = prevCreds;
  }
});
if(apiCreds){
  $('apiKeyInput').value = apiCreds.key || '';
  $('apiSecretInput').value = apiCreds.secret || '';
}
refreshApiStatus();

$('analyzeBtn').addEventListener('click', runAnalysis);
$('handleInput').addEventListener('keydown', e => { if(e.key==='Enter') runAnalysis(); });
$('newSearchBtn').addEventListener('click', () => {
  $('content').classList.remove('show');
  document.getElementById('search-section').scrollIntoView({behavior:'smooth'});
});
$('exportBtn').addEventListener('click', exportPDF);

function showError(msg){
  const box = $('errorBox');
  box.textContent = "ERR // " + msg;
  box.classList.add('show');
}
function clearError(){ $('errorBox').classList.remove('show'); $('errorBox').textContent=''; }
function setLoading(on, text){
  $('loader').classList.toggle('show', on);
  if(text) $('loaderText').textContent = text;
  $('analyzeBtn').disabled = on;
}

async function cfFetch(methodName, params={}){
  const url = await buildUrl(methodName, params);
  const res = await fetch(url);
  const data = await res.json();
  if(data.status !== 'OK') throw new Error(data.comment || 'API error');
  return data.result;
}

async function runAnalysis(){
  const handle = $('handleInput').value.trim();
  clearError();
  if(!handle){ showError('please enter a handle'); return; }

  $('content').classList.remove('show');
  setLoading(true, 'fetching profile…');

  try{
    const [info, rating, status] = await Promise.allSettled([
      cfFetch('user.info', { handles: handle }),
      cfFetch('user.rating', { handle: handle }),
      cfFetch('user.status', { handle: handle, from: '1', count: '10000' })
    ]);

    if(info.status === 'rejected') throw new Error(info.reason.message || 'handle not found');

    const userInfo = info.value[0];
    const ratingHistory = rating.status === 'fulfilled' ? rating.value : [];
    const submissions = status.status === 'fulfilled' ? status.value : [];

    setLoading(true, 'crunching numbers…');
    await new Promise(r=>setTimeout(r,150));

    renderAll(userInfo, ratingHistory, submissions);

    setLoading(false);
    $('content').classList.add('show');
    $('content').scrollIntoView({behavior:'smooth'});
  }catch(err){
    setLoading(false);
    showError(err.message || 'something went wrong. check the handle and try again.');
  }
}
async function saveToGoogleSheet(user, stats) {
  try {
    await fetch(scriptURL, {
      method: "POST",
      body: new URLSearchParams({
        handle: user.handle,
        rating: user.rating || 0,
        maxRating: user.maxRating || 0,
        totalSolved: stats.solvedCount || 0,
        currentStreak: document.getElementById("curStreak").textContent || 0,
        strongestTopic: Object.entries(stats.tagCount)
          .sort((a,b) => b[1]-a[1])[0]?.[0] || "None"
      })
    });

    console.log("Saved to Google Sheet");
  } catch (err) {
    console.error("Failed to save:", err);
  }
}

function renderAll(user, ratingHistory, submissions){
  renderProfileHead(user);
  const submStats = computeSubmissionStats(submissions);
  renderStatGrid(user, ratingHistory, submStats);
  renderRatingChart(ratingHistory);
  renderDifficultyChart(submStats);
  renderVerdictChart(submStats);
  renderTags(submStats);
  renderStreaks(submStats);
  renderMonthlyYearly(submStats);
  renderContestTable(ratingHistory);
  renderRecentActivity(submissions);
  saveToGoogleSheet(user, submStats);
  $('footHandle').textContent = user.handle;
}

function renderProfileHead(user){
  $('handleName').textContent = user.handle;
  $('avatar').src = (user.avatar && !user.avatar.includes('no-avatar')) ? (user.avatar.startsWith('http')?user.avatar:'https:'+user.avatar) : '';
  $('avatar').style.display = $('avatar').src ? 'block':'none';
  const org = user.organization ? ' · ' + user.organization : '';
  const loc = [user.city, user.country].filter(Boolean).join(', ');
  $('profileSub').textContent = [loc, org].filter(Boolean).join('') || 'no location data';
  $('rankPill').textContent = (user.rank || 'unrated').toUpperCase();
}

function computeSubmissionStats(subs){
  const solvedSet = new Set();
  const solvedProblems = [];
  let totalOK = 0;
  const verdictCount = {};
  const tagCount = {};
  const tagAttempt = {};
  const difficultyBuckets = {};
  const dateSet = new Set(); // days with AC
  const monthMap = {}; // 'YYYY-MM' -> count (unique solved)
  const yearMap = {};
  const tagSolvedDates = {};

  // need per-tag attempts (all submissions of problems with that tag, unique problem attempted)
  const attemptedProblemTags = {};

  for(const s of subs){
    const verdict = s.verdict || 'UNKNOWN';
    verdictCount[verdict] = (verdictCount[verdict]||0) + 1;
    const p = s.problem;
    const pid = p.contestId + p.index;

    if(p.tags){
      for(const t of p.tags){
        if(!attemptedProblemTags[t]) attemptedProblemTags[t] = new Set();
        attemptedProblemTags[t].add(pid);
      }
    }

    if(verdict === 'OK'){
      totalOK++;
      if(!solvedSet.has(pid)){
        solvedSet.add(pid);
        solvedProblems.push(p);
        const d = new Date(s.creationTimeSeconds*1000);
        const dayKey = d.toISOString().slice(0,10);
        dateSet.add(dayKey);
        const monthKey = d.toISOString().slice(0,7);
        monthMap[monthKey] = (monthMap[monthKey]||0)+1;
        const yearKey = String(d.getFullYear());
        yearMap[yearKey] = (yearMap[yearKey]||0)+1;

        if(p.rating){
          const bucket = Math.floor(p.rating/100)*100;
          difficultyBuckets[bucket] = (difficultyBuckets[bucket]||0)+1;
        }
        if(p.tags){
          for(const t of p.tags){
            tagCount[t] = (tagCount[t]||0)+1;
          }
        }
      }
    }
  }

  const avgRating = solvedProblems.filter(p=>p.rating).length
    ? Math.round(solvedProblems.filter(p=>p.rating).reduce((a,p)=>a+p.rating,0) / solvedProblems.filter(p=>p.rating).length)
    : 0;

  // tag success rate = solved problems with tag / attempted unique problems with tag
  const tagSuccess = {};
  for(const t in tagCount){
    const attempted = attemptedProblemTags[t] ? attemptedProblemTags[t].size : tagCount[t];
    tagSuccess[t] = { solved: tagCount[t], attempted, rate: attempted ? tagCount[t]/attempted : 0 };
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

function renderStatGrid(user, ratingHistory, st){
  const stats = [
    { v: user.rating ?? '—', l: 'Current Rating', sub: '' },
    { v: user.maxRating ?? '—', l: 'Max Rating', sub: user.maxRank ? `max: ${user.maxRank}` : '' },
    { v: (user.rank||'unrated'), l: 'Current Rank', sub: '' },
    { v: st.solvedCount, l: 'Problems Solved', sub: '' },
    { v: st.totalSubmissions, l: 'Total Submissions', sub: '' },
    { v: st.acceptanceRate.toFixed(1)+'%', l: 'Acceptance Rate', sub: '' },
    { v: ratingHistory.length, l: 'Contests Played', sub: '' },
    { v: st.avgRating || '—', l: 'Avg. Solved Rating', sub: '' },
    { v: ratingHistory.length ? Math.max(...ratingHistory.map(r=>r.newRating - r.oldRating)) : '—', l: 'Best Rating Gain', sub: '' },
    { v: Object.keys(st.tagCount).length, l: 'Distinct Tags Solved', sub: '' },
    { v: st.dateSet.size, l: 'Active Solving Days', sub: '' },
    { v: user.contribution ?? 0, l: 'Contribution', sub: '' },
  ];
  $('statGrid').innerHTML = stats.map(s => `
    <div class="stat">
      <div class="v">${s.v}</div>
      <div class="l">${s.l}</div>
      ${s.sub ? `<div class="sub2">${s.sub}</div>`:''}
    </div>
  `).join('');
  $('statCount').textContent = '12 metrics';
}

function destroyChart(key){ if(charts[key]){ charts[key].destroy(); delete charts[key]; } }

const monoFont = "'IBM Plex Mono', monospace";

function renderRatingChart(history){
  destroyChart('rating');
  const ctx = $('ratingChart').getContext('2d');
  if(!history.length){
    ctx.canvas.parentElement.innerHTML = '<div style="font-size:13px;color:#6b6b6b;padding:30px 0;">No rated contests found for this handle.</div>';
    return;
  }
  const labels = history.map(r => r.contestName.length>18 ? r.contestName.slice(0,18)+'…' : r.contestName);
  const data = history.map(r => r.newRating);
  charts.rating = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[{
      label:'Rating', data,
      borderColor:'#0a0a0a', backgroundColor:'rgba(10,10,10,0.06)',
      borderWidth:2, pointRadius:2.5, pointBackgroundColor:'#0a0a0a', fill:true, tension:0.15
    }]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{
        backgroundColor:'#0a0a0a', titleFont:{family:monoFont}, bodyFont:{family:monoFont},
        callbacks:{ title: (items)=> history[items[0].dataIndex].contestName,
          label: (item)=> `rating: ${item.raw} (rank ${history[item.dataIndex].rank})` }
      }},
      scales:{
        x:{ display:false },
        y:{ grid:{color:'#e4e4e4'}, ticks:{font:{family:monoFont, size:10}, color:'#6b6b6b'} }
      }
    }
  });
}

function renderDifficultyChart(st){
  destroyChart('diff');
  const buckets = Object.keys(st.difficultyBuckets).map(Number).sort((a,b)=>a-b);
  const ctx = $('difficultyChart').getContext('2d');
  if(!buckets.length){
    ctx.canvas.parentElement.innerHTML = '<div style="font-size:13px;color:#6b6b6b;">No rated solves found.</div>';
    return;
  }
  charts.diff = new Chart(ctx, {
    type:'bar',
    data:{ labels: buckets.map(b=>b+''), datasets:[{ data: buckets.map(b=>st.difficultyBuckets[b]), backgroundColor:'#0a0a0a' }] },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{backgroundColor:'#0a0a0a',titleFont:{family:monoFont},bodyFont:{family:monoFont}} },
      scales:{
        x:{ grid:{display:false}, ticks:{font:{family:monoFont, size:9}, color:'#6b6b6b'} },
        y:{ grid:{color:'#e4e4e4'}, ticks:{font:{family:monoFont, size:10}, color:'#6b6b6b'} }
      }
    }
  });
}

function renderVerdictChart(st){
  destroyChart('verdict');
  const entries = Object.entries(st.verdictCount).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const ctx = $('verdictChart').getContext('2d');
  const shades = ['#0a0a0a','#2e2e2e','#4f4f4f','#6b6b6b','#8f8f8f','#b3b3b3'];
  charts.verdict = new Chart(ctx, {
    type:'doughnut',
    data:{ labels: entries.map(e=>e[0]), datasets:[{ data: entries.map(e=>e[1]), backgroundColor:shades, borderColor:'#fff', borderWidth:2 }] },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{position:'right', labels:{font:{family:monoFont, size:10.5}, boxWidth:12, color:'#0a0a0a'}},
        tooltip:{backgroundColor:'#0a0a0a',titleFont:{family:monoFont},bodyFont:{family:monoFont}} },
      cutout:'60%'
    }
  });
}

function renderTagList(elId, entries, mode){
  const max = entries.length ? Math.max(...entries.map(e=>e[1])) : 1;
  $(elId).innerHTML = entries.map(([name, val])=>{
    const pct = mode==='rate' ? Math.round(val*100) : Math.round((val/max)*100);
    const display = mode==='rate' ? Math.round(val*100)+'%' : val;
    return `<li><span class="name">${name}</span><span class="bar-wrap"><span class="bar" style="width:${pct}%;"></span></span><span class="num">${display}</span></li>`;
  }).join('') || '<li><span class="name">no data</span></li>';
}

function renderTags(st){
  const tagEntries = Object.entries(st.tagCount).sort((a,b)=>b[1]-a[1]);
  renderTagList('topTags', tagEntries.slice(0,8), 'count');

  const strong = Object.entries(st.tagSuccess)
    .filter(([,v])=>v.solved>=3)
    .sort((a,b)=> (b[1].rate - a[1].rate) || (b[1].solved - a[1].solved))
    .slice(0,8)
    .map(([k,v])=>[k, v.rate]);
  renderTagList('strongTags', strong, 'rate');

  const weak = tagEntries.slice(-8).reverse();
  renderTagList('weakTags', weak, 'count');
}

function renderStreaks(st){
  const days = Array.from(st.dateSet).sort();
  let longest = 0, current = 0, run = 0;
  let prev = null;
  for(const d of days){
    const day = new Date(d);
    if(prev){
      const diff = (day - prev) / 86400000;
      run = diff === 1 ? run+1 : 1;
    } else run = 1;
    longest = Math.max(longest, run);
    prev = day;
  }
  // current streak: count back from today/yesterday
  const daySet = st.dateSet;
  let cur = 0;
  let cursor = new Date();
  cursor.setHours(0,0,0,0);
  // allow today not yet solved, start check from today, if missing try yesterday start
  let key = cursor.toISOString().slice(0,10);
  if(!daySet.has(key)){
    cursor.setDate(cursor.getDate()-1);
    key = cursor.toISOString().slice(0,10);
  }
  while(daySet.has(key)){
    cur++;
    cursor.setDate(cursor.getDate()-1);
    key = cursor.toISOString().slice(0,10);
  }
  $('curStreak').textContent = cur;
  $('maxStreak').textContent = longest;
  $('avgRating').textContent = st.avgRating || '—';
}

function renderMonthlyYearly(st){
  destroyChart('monthly'); destroyChart('yearly');
  const now = new Date();
  const monthLabels = [];
  const monthData = [];
  for(let i=11;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const key = d.toISOString().slice(0,7);
    monthLabels.push(d.toLocaleString('en', {month:'short', year:'2-digit'}));
    monthData.push(st.monthMap[key]||0);
  }
  charts.monthly = new Chart($('monthlyChart').getContext('2d'), {
    type:'bar',
    data:{ labels: monthLabels, datasets:[{ data: monthData, backgroundColor:'#0a0a0a' }] },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{backgroundColor:'#0a0a0a',titleFont:{family:monoFont},bodyFont:{family:monoFont}}},
      scales:{ x:{grid:{display:false}, ticks:{font:{family:monoFont,size:9},color:'#6b6b6b'}},
        y:{grid:{color:'#e4e4e4'}, ticks:{font:{family:monoFont,size:10},color:'#6b6b6b'}} } }
  });

  const years = Object.keys(st.yearMap).sort();
  charts.yearly = new Chart($('yearlyChart').getContext('2d'), {
    type:'bar',
    data:{ labels: years, datasets:[{ data: years.map(y=>st.yearMap[y]), backgroundColor:'#0a0a0a' }] },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{backgroundColor:'#0a0a0a',titleFont:{family:monoFont},bodyFont:{family:monoFont}}},
      scales:{ x:{grid:{display:false}, ticks:{font:{family:monoFont,size:10},color:'#6b6b6b'}},
        y:{grid:{color:'#e4e4e4'}, ticks:{font:{family:monoFont,size:10},color:'#6b6b6b'}} } }
  });
}

function renderContestTable(history){
  const rows = history.slice().reverse();
  $('contestTable').innerHTML = rows.map((r,i)=>{
    const delta = r.newRating - r.oldRating;
    const cls = delta >= 0 ? 'delta-up' : 'delta-down';
    return `<tr>
      <td>${rows.length - i}</td>
      <td>${r.contestName}</td>
      <td>${r.rank}</td>
      <td>${r.newRating}</td>
      <td class="${cls}">${delta>=0?'+':''}${delta}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" style="color:#6b6b6b;">No contest history.</td></tr>`;
}

function renderRecentActivity(subs){
  const recent = subs.slice(0,25);
  $('recentActivity').innerHTML = recent.map(s=>{
    const d = new Date(s.creationTimeSeconds*1000);
    const ok = s.verdict === 'OK';
    return `<div class="activity-item">
      <span>${d.toLocaleDateString()} — ${s.problem.contestId}${s.problem.index} ${s.problem.name}</span>
      <span class="${ok?'verdict-ok':'verdict-no'}">${s.verdict||'—'}</span>
    </div>`;
  }).join('') || '<div style="color:#6b6b6b;font-size:13px;">No submissions found.</div>';
}

async function exportPDF(){
  const btn = $('exportBtn');
  const original = btn.textContent;
  btn.textContent = 'Rendering…';
  btn.disabled = true;
  try{
    const target = document.getElementById('content');
    const canvas = await html2canvas(target, { scale:2, backgroundColor:'#ffffff', useCORS:true });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p','pt','a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
    heightLeft -= pageH;
    while(heightLeft > 0){
      position = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
      heightLeft -= pageH;
    }
    const handle = $('handleName').textContent || 'profile';
    pdf.save(`cf_analysis_${handle}.pdf`);
  }catch(e){
    alert('Could not export PDF: ' + e.message);
  }finally{
    btn.textContent = original;
    btn.disabled = false;
  }
}
