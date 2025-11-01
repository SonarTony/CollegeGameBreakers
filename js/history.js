// js/history.js
// Season history: save, load, clear, export/import, totals and per-season recap.

import { LS_HISTORY } from "./constants.js";
import { getTeam } from "./ui_league.js";

// ---------- Storage ----------
export function loadHistory(){
  try{
    const raw = localStorage.getItem(LS_HISTORY);
    if(!raw) return { seasons: [], totals: {} };
    const obj = JSON.parse(raw);
    if(!obj || typeof obj !== "object") return { seasons: [], totals: {} };
    if(!Array.isArray(obj.seasons)) obj.seasons = [];
    if(!obj.totals || typeof obj.totals !== "object") obj.totals = {};
    return obj;
  }catch{
    return { seasons: [], totals: {} };
  }
}
export function saveHistory(h){ localStorage.setItem(LS_HISTORY, JSON.stringify(h)); }
export function clearAllHistory(){ saveHistory({ seasons:[], totals:{} }); }

// ---------- Compute keys/labels ----------
function tkey(ci, ti){ return `${ci}:${ti}`; }

// ---------- Build a recap object from current SEASON ----------
function deriveBowlAppearances(SEASON){
  const app = new Set();
  const ps = SEASON.postseason;
  if(!ps) return app;
  (ps.bowlsInitial||[]).forEach(b=>{
    app.add(tkey(b.home.ci, b.home.ti));
    app.add(tkey(b.away.ci, b.away.ti));
  });
  (ps.quarters||[]).forEach(m=>{
    app.add(tkey(m.home.ci, m.home.ti));
    app.add(tkey(m.away.ci, m.away.ti));
  });
  (ps.semis||[]).forEach(m=>{
    app.add(tkey(m.home.ci, m.home.ti));
    app.add(tkey(m.away.ci, m.away.ti));
  });
  if(ps.championship){
    app.add(tkey(ps.championship.home.ci, ps.championship.home.ti));
    app.add(tkey(ps.championship.away.ci, ps.championship.away.ti));
  }
  return app;
}

function deriveChampionKey(SEASON){
  const ps = SEASON.postseason;
  if(!ps || !ps.championship) return null;
  const g = ps.championship;
  if(!g.played || !g.winner) return null;
  return tkey(g.winner.ci, g.winner.ti);
}

export function addCurrentSeasonToHistory(SEASON, LEAGUE){
  const hist = loadHistory();

  // 1) Snapshot standings
  const standings = {};
  Object.entries(SEASON.standings).forEach(([k,rec])=>{
    standings[k] = { w: rec.w, l: rec.l, pf: rec.pf, pa: rec.pa };
  });

  // 2) Bowl/Playoff appearances, champion
  const appeared = deriveBowlAppearances(SEASON);
  const championKey = deriveChampionKey(SEASON);

  // 3) Update totals
  Object.entries(standings).forEach(([k,rec])=>{
    if(!hist.totals[k]) hist.totals[k] = { w:0, l:0, bowls:0, championships:0 };
    hist.totals[k].w += rec.w;
    hist.totals[k].l += rec.l;
  });
  appeared.forEach(k=>{
    if(!hist.totals[k]) hist.totals[k] = { w:0, l:0, bowls:0, championships:0 };
    hist.totals[k].bowls += 1;
  });
  if(championKey){
    if(!hist.totals[championKey]) hist.totals[championKey] = { w:0, l:0, bowls:0, championships:0 };
    hist.totals[championKey].championships += 1;
  }

  // 4) Push season recap
  const seasonRecap = {
    standings,                         // by team key
    appeared: Array.from(appeared),    // team keys
    champion: championKey,             // key or null
    timestamp: Date.now()
  };
  hist.seasons.push(seasonRecap);

  saveHistory(hist);
  return hist;
}

// ---------- Export / Import ----------
export function exportHistoryJSON(){
  return JSON.stringify(loadHistory(), null, 2);
}
export async function importHistoryFromFile(file){
  const text = await file.text();
  const obj = JSON.parse(text);
  if(!obj || typeof obj !== "object" || !Array.isArray(obj.seasons) || !obj.totals){
    throw new Error("Invalid history file");
  }
  saveHistory(obj);
}

// ---------- UI helpers (HTML builders) ----------
export function seasonsList(hist){
  const frag = document.createDocumentFragment();
  const optTotals = document.createElement("option");
  optTotals.value = "TOTALS"; optTotals.textContent = "Totals";
  frag.appendChild(optTotals);
  hist.seasons.forEach((s, idx)=>{
    const opt = document.createElement("option");
    opt.value = String(idx); opt.textContent = `Season ${idx+1}`;
    frag.appendChild(opt);
  });
  return frag;
}

export function buildTotalsTableHTML(hist, LEAGUE){
  let html = `<table class="standings-table"><thead><tr>
    <th>Team</th><th>W</th><th>L</th><th>Bowl Apps</th><th>Championships</th>
  </tr></thead><tbody>`;
  LEAGUE.forEach((conf, ci)=>{
    conf.teams.forEach((t, ti)=>{
      const k = `${ci}:${ti}`;
      const rec = hist.totals[k] || { w:0,l:0,bowls:0,championships:0 };
      html += `<tr><td>${t.name}</td><td>${rec.w}</td><td>${rec.l}</td><td>${rec.bowls}</td><td>${rec.championships}</td></tr>`;
    });
  });
  html += `</tbody></table>`;
  return html;
}

export function buildSeasonRecapHTML(hist, idx, LEAGUE){
  const s = hist.seasons[idx];
  if(!s) return `<em>No data</em>`;
  const rows = Object.entries(s.standings).map(([k,rec])=>{
    const [ci,ti] = k.split(":").map(n=>parseInt(n,10));
    const name = getTeam(ci,ti)?.name || k;
    return { name, w:rec.w, l:rec.l, pf:rec.pf, pa:rec.pa, diff: rec.pf - rec.pa };
  }).sort((a,b)=> (b.w - a.w) || (b.diff - a.diff) || (b.pf - a.pf) || a.name.localeCompare(b.name));

  let html = `<div class="standings-block">
    <h4>Final Standings (recap)</h4>
    <table class="standings-table"><thead><tr>
    <th>Team</th><th>W</th><th>L</th><th>PF</th><th>PA</th><th>Diff</th>
    </tr></thead><tbody>`;
  rows.forEach(r=>{
    html += `<tr><td>${r.name}</td><td>${r.w}</td><td>${r.l}</td><td>${r.pf}</td><td>${r.pa}</td><td>${r.diff>=0?'+':''}${r.diff}</td></tr>`;
  });
  html += `</tbody></table></div>`;

  const apps = (s.appeared||[]).map(k=>{
    const [ci,ti] = k.split(":").map(n=>parseInt(n,10));
    return getTeam(ci,ti)?.name || k;
  }).sort((a,b)=> a.localeCompare(b));
  const champName = s.champion ? (()=>{ const [ci,ti]=s.champion.split(":").map(n=>parseInt(n,10)); return getTeam(ci,ti)?.name || s.champion; })() : "—";

  html += `<div class="standings-block"><h4>Postseason</h4>
    <p><strong>Champion:</strong> ${champName}</p>
    <p><strong>Appearances:</strong> ${apps.length?apps.join(", "):"—"}</p>
  </div>`;

  return html;
}

