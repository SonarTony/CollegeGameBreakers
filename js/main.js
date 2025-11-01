// js/main.js
// Entry point for tabs, Play/League/Season wiring, Postseason controls, and History (export/import).

import { OFF_SLOTS, DEF_SLOTS, LS_HISTORY } from "./constants.js";
import { loadLeague } from "./league.js";
import {
  loadSeason,
  saveSeason,
  createSeasonFromLeague,
  simulateMatchByTeams
} from "./season.js";

import {
  fillAllPlaySelects,
  neutralDefaultsPlay,
  wirePlayTab,
  tieLogToPanel,
  applyTeamToSide,
  collectSide,
  buildBreakdownHTML
} from "./ui_play.js";

import {
  refreshTeamPickers,
  renderLeagueSidebar,
  setupEditorSelects,
  clearEditorSelection,
  getTeamByIndexStr,
  setTeamByIndexStr,
  LEAGUE as LEAGUE_STATE,
  refreshLeagueAll,
  getTeam
} from "./ui_league.js";

import {
  renderWeekPicker,
  renderGames,
  standingsTableHTML,
  renderPostseason
} from "./ui_season.js";

import {
  generatePostseason,
  playUnplayedBowls,
  buildQuarterfinals,
  playQuarterfinals,
  buildSemifinals,
  playSemifinals,
  buildChampionship,
  playChampionship,
  resetPostseason
} from "./postseason.js";

let LEAGUE = LEAGUE_STATE;
let SEASON = null;

/* =========================
   HISTORY: helpers
========================= */
const HISTORY_KEY = LS_HISTORY || "GBCF_HISTORY_V1";

function loadHistory(){
  const raw = localStorage.getItem(HISTORY_KEY);
  if(!raw) return { seasons: [] };
  try { return JSON.parse(raw) || { seasons: [] }; }
  catch(e){ return { seasons: [] }; }
}

function saveHistory(hist){
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
}

function clearHistory(){
  localStorage.removeItem(HISTORY_KEY);
}

function downloadJSON(filename, dataObj){
  const str = JSON.stringify(dataObj, null, 2);
  const blob = new Blob([str], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 0);
}

function exportHistoryJSON(){
  const hist = loadHistory();
  const now = new Date();
  const pad = (n)=> String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const fname = `gbcf_history_${stamp}.json`;
  downloadJSON(fname, hist);
}

/**
 * Minimal schema check: object with .seasons being an array
 */
function validateHistorySchema(obj){
  return obj && typeof obj === "object" && Array.isArray(obj.seasons);
}

/**
 * Build a snapshot of the finished (or current) season so it can be shown later.
 */
function buildSeasonSnapshot(SEASON){
  const hist = loadHistory();
  const seasonNumber = (hist.seasons?.length || 0) + 1;
  const label = SEASON?.year ? `Season ${SEASON.year}` : `Season ${seasonNumber}`;

  // Standings copy
  const standings = {};
  Object.keys(SEASON.standings).forEach(key=>{
    const rec = SEASON.standings[key];
    standings[key] = { w:rec.w, l:rec.l, pf:rec.pf, pa:rec.pa };
  });

  // Postseason summary
  const ps = SEASON.postseason || null;

  // Per-team counters for THIS season
  const seasonTeamMeta = {}; // key "ci:ti" → { bowls:0, champ:0, name }
  const addTeam = (ref)=>{
    if(!ref) return;
    const k = `${ref.ci}:${ref.ti}`;
    if(!seasonTeamMeta[k]) seasonTeamMeta[k] = { bowls:0, champ:0, name:getTeam(ref.ci,ref.ti).name };
    return seasonTeamMeta[k];
  };

  if(ps){
    (ps.bowlsInitial||[]).forEach(b=>{
      addTeam(b.home).bowls++;
      addTeam(b.away).bowls++;
    });
    (ps.quarters||[]).forEach(m=>{ addTeam(m.home).bowls++; addTeam(m.away).bowls++; });
    (ps.semis||[]).forEach(m=>{ addTeam(m.home).bowls++; addTeam(m.away).bowls++; });
    if(ps.championship){
      addTeam(ps.championship.home).bowls++;
      addTeam(ps.championship.away).bowls++;
      if(ps.championship.winner){
        addTeam(ps.championship.winner).champ++;
      }
    }
  }

  const teams = {};
  Object.keys(standings).forEach(k=>{
    const [ci,ti] = k.split(":").map(n=>parseInt(n,10));
    teams[k] = { name: getTeam(ci,ti).name, ci, ti };
  });

  return {
    label,
    createdAt: Date.now(),
    standings,
    teams,
    postseason: ps ? {
      bowlsInitial: (ps.bowlsInitial||[]).map(b=>({
        id:b.id, name:b.name, playoff:!!b.playoff, round:b.round,
        home:b.home, away:b.away, played:b.played,
        score:b.score, winner:b.winner
      })),
      quarters: (ps.quarters||[]).map(m=>({
        id:m.id, home:m.home, away:m.away, played:m.played, score:m.score, winner:m.winner
      })),
      semis: (ps.semis||[]).map(m=>({
        id:m.id, home:m.home, away:m.away, played:m.played, score:m.score, winner:m.winner
      })),
      championship: ps.championship ? {
        id: ps.championship.id,
        name: ps.championship.name,
        home: ps.championship.home,
        away: ps.championship.away,
        played: ps.championship.played,
        score: ps.championship.score,
        winner: ps.championship.winner
      } : null
    } : null,
    seasonTeamMeta
  };
}

function computeTotals(history){
  const totals = {}; // key ci:ti
  const addTeam = (k, name)=>{
    if(!totals[k]) totals[k] = { name, w:0, l:0, bowls:0, champ:0 };
    return totals[k];
  };
  (history.seasons||[]).forEach(s=>{
    Object.keys(s.standings).forEach(k=>{
      const rec = s.standings[k];
      const nm = s.teams[k]?.name || "(Unknown)";
      const row = addTeam(k, nm);
      row.w += rec.w || 0;
      row.l += rec.l || 0;
    });
    Object.keys(s.seasonTeamMeta||{}).forEach(k=>{
      const st = s.seasonTeamMeta[k];
      const row = addTeam(k, st.name);
      row.bowls += st.bowls || 0;
      row.champ += st.champ || 0;
    });
  });
  const arr = Object.keys(totals).map(k=>({ key:k, ...totals[k] }));
  arr.sort((a,b)=> (b.champ - a.champ) || (b.bowls - a.bowls) || (b.w - a.w) || a.name.localeCompare(b.name));
  return arr;
}

/* =========================
   Tabs
========================= */
function initTabs(){
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      tabs.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const name = btn.dataset.tab;
      document.querySelectorAll(".tabpanel").forEach(p=>p.classList.remove("active"));
      document.getElementById(`tab-${name}`).classList.add("active");

      if(name==="league"){
        renderLeagueSidebar();
      }
      if(name==="play"){
        refreshTeamPickers();
      }
      if(name==="season"){
        ensureSeason();
        renderWeekPicker(SEASON, ()=>{ renderGames(SEASON); });
        renderGames(SEASON);
        renderStandingsAll();
        renderPostseason(SEASON);
      }
      if(name==="history"){
        renderHistoryTab();
      }
    });
  });
}

/* =========================
   Season helpers
========================= */
function ensureSeason(){
  if (SEASON) return;
  const raw = loadSeason();
  if (raw){ SEASON = raw; return; }
  SEASON = createSeasonFromLeague(LEAGUE);
  saveSeason(SEASON);
}

function renderStandingsAll(){
  const box = document.getElementById("standingsAll");
  box.innerHTML = "";
  LEAGUE.forEach((conf, ci)=>{
    const blk = document.createElement("div");
    blk.className = "standings-block";
    const h = document.createElement("h4");
    h.textContent = conf.name;
    blk.appendChild(h);
    const html = standingsTableHTML(SEASON, LEAGUE, ci);
    const holder = document.createElement("div");
    holder.innerHTML = html;
    blk.appendChild(holder.firstChild);
    box.appendChild(blk);
  });
}

/* =========================
   Play tab rendering (results & rewatch)
========================= */
function renderGameResultsToPlayTab(homeTeam, awayTeam, details, score){
  document.querySelector('[data-tab="play"]').click();
  refreshTeamPickers();
  applyTeamToSide(homeTeam, "home");
  applyTeamToSide(awayTeam, "away");

  const { h, a, hf, af } = details;
  const hRender = buildBreakdownHTML(h, a, hf);
  const aRender = buildBreakdownHTML(a, h, af);

  document.getElementById("homeScore").textContent = score.home;
  document.getElementById("awayScore").textContent = score.away;
  document.getElementById("homeSummary").textContent = hRender.summary;
  document.getElementById("awaySummary").textContent = aRender.summary;
  document.getElementById("homeDetail").innerHTML = hRender.body;
  document.getElementById("awayDetail").innerHTML = aRender.body;
}

function playScheduledGame(g, {replay=false}={}){
  const homeTeam = JSON.parse(JSON.stringify(getTeam(g.home.ci, g.home.ti)));
  const awayTeam = JSON.parse(JSON.stringify(getTeam(g.away.ci, g.away.ti)));

  if (replay && g.played && g.details){
    renderGameResultsToPlayTab(homeTeam, awayTeam, g.details, g.score);
    return;
  }

  const sim = simulateMatchByTeams(homeTeam, awayTeam);
  const { score, details } = sim;

  if (!g.played){
    g.played = true;
    g.score = score;
    g.details = details;

    const hk = `${g.home.ci}:${g.home.ti}`;
    const ak = `${g.away.ci}:${g.away.ti}`;
    SEASON.standings[hk].pf += score.home;
    SEASON.standings[hk].pa += score.away;
    SEASON.standings[ak].pf += score.away;
    SEASON.standings[ak].pa += score.home;
    if (score.home > score.away){
      SEASON.standings[hk].w++; SEASON.standings[ak].l++;
    } else {
      SEASON.standings[ak].w++; SEASON.standings[hk].l++;
    }
    saveSeason(SEASON);
  }

  renderGameResultsToPlayTab(homeTeam, awayTeam, details, score);
  document.querySelector('[data-tab="season"]').click();
  renderGames(SEASON);
  renderStandingsAll();
}
window.playScheduledGame = playScheduledGame;

/* =========================
   Season tab buttons
========================= */
function wireSeasonButtons(){
  const weekSel = document.getElementById("seasonWeek");

  document.getElementById("btnSimWeek").addEventListener("click", ()=>{
    const w = SEASON.weeks.find(x=>x.week===parseInt(weekSel.value,10));
    w.games.forEach(g=>{ if(!g.played) playScheduledGame(g, {replay:false}); });
  });

  document.getElementById("btnSimSeason").addEventListener("click", ()=>{
    SEASON.weeks.forEach(w=>{
      w.games.forEach(g=>{ if(!g.played) playScheduledGame(g, {replay:false}); });
    });
  });

  document.getElementById("btnResetSeason").addEventListener("click", ()=>{
    if(!confirm("Reset season schedule and standings?")) return;
    SEASON = createSeasonFromLeague(LEAGUE);
    saveSeason(SEASON);
    renderWeekPicker(SEASON, ()=>{ renderGames(SEASON); });
    renderGames(SEASON);
    renderStandingsAll();
    renderPostseason(SEASON);
  });

  const btnSaveHist = document.getElementById("btnSaveSeasonHistory");
  if(btnSaveHist){
    btnSaveHist.addEventListener("click", ()=>{
      const snapshot = buildSeasonSnapshot(SEASON);
      const hist = loadHistory();
      hist.seasons.push(snapshot);
      saveHistory(hist);
      alert(`Saved ${snapshot.label} to History.`);
    });
  }
}

/* =========================
   Play tab: load/save pickers
========================= */
function wirePlayPickers(){
  document.getElementById("btnLoadHome").addEventListener("click", ()=>{
    const id = document.getElementById("pickHomeTeam").value;
    if(!id) return;
    const team = getTeamByIndexStr(id);
    applyTeamToSide(team, "home");
  });

  document.getElementById("btnLoadAway").addEventListener("click", ()=>{
    const id = document.getElementById("pickAwayTeam").value;
    if(!id) return;
    const team = getTeamByIndexStr(id);
    applyTeamToSide(team, "away");
  });

  document.getElementById("btnSaveHomeBack").addEventListener("click", ()=>{
    const sel = document.getElementById("pickHomeTeam").value;
    if(!sel) return;
    const team = collectSide("home");
    setTeamByIndexStr(sel, team);
    renderLeagueSidebar();
    refreshTeamPickers();
  });

  document.getElementById("btnSaveAwayBack").addEventListener("click", ()=>{
    const sel = document.getElementById("pickAwayTeam").value;
    if(!sel) return;
    const team = collectSide("away");
    setTeamByIndexStr(sel, team);
    renderLeagueSidebar();
    refreshTeamPickers();
  });
}

/* =========================
   Postseason wiring
========================= */
function wirePostseasonButtons(){
  const g = id => document.getElementById(id);

  const btnGen = g("btnGenPostseason");
  if (btnGen){
    btnGen.addEventListener("click", ()=>{
      SEASON.postseason = null;
      generatePostseason(LEAGUE, SEASON);
      renderPostseason(SEASON);
    });
  }

  const btnResetPS = g("btnResetPostseason");
  if (btnResetPS){
    btnResetPS.addEventListener("click", ()=>{
      if(confirm("Reset postseason?")){
        resetPostseason(SEASON);
        renderPostseason(SEASON);
      }
    });
  }

  const pv = document.getElementById("postseasonView");
  if (pv){
    pv.addEventListener("click", (e)=>{
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;

      if (t.id === "btnPlayAllBowls"){
        if(!SEASON.postseason) return;
        playUnplayedBowls(SEASON, LEAGUE);
        renderPostseason(SEASON);
        return;
      }
      if (t.id === "btnPlayQuarterfinals"){
        if(!SEASON.postseason) return;
        if((SEASON.postseason.quarters||[]).length===0) buildQuarterfinals(SEASON);
        playQuarterfinals(SEASON, LEAGUE);
        renderPostseason(SEASON);
        return;
      }
      if (t.id === "btnPlaySemifinals"){
        if(!SEASON.postseason) return;
        if((SEASON.postseason.semis||[]).length===0) buildSemifinals(SEASON);
        playSemifinals(SEASON, LEAGUE);
        renderPostseason(SEASON);
        return;
      }
      if (t.id === "btnPlayChampionship"){
        if(!SEASON.postseason) return;
        if(!SEASON.postseason.championship) buildChampionship(SEASON);
        playChampionship(SEASON, LEAGUE);
        renderPostseason(SEASON);
        return;
      }
    });
  }

  // Per-game handlers
  window.playBowlById = (id)=>{
    const ps = SEASON.postseason; if(!ps) return;
    const b = ps.bowlsInitial.find(x=>x.id===id); if(!b) return;

    if(!b.played){
      const home = JSON.parse(JSON.stringify(getTeam(b.home.ci, b.home.ti)));
      const away = JSON.parse(JSON.stringify(getTeam(b.away.ci, b.away.ti)));
      const sim = simulateMatchByTeams(home, away);
      b.played = true;
      b.score = sim.score;
      b.details = sim.details;
      b.winner = (sim.score.home>sim.score.away ? b.home : b.away);
      saveSeason(SEASON);
      buildQuarterfinals(SEASON);
      renderPostseason(SEASON);
    }

    document.querySelector('[data-tab="play"]').click();
    refreshTeamPickers();
    const homeTeam = JSON.parse(JSON.stringify(getTeam(b.home.ci, b.home.ti)));
    const awayTeam = JSON.parse(JSON.stringify(getTeam(b.away.ci, b.away.ti)));
    applyTeamToSide(homeTeam, "home");
    applyTeamToSide(awayTeam, "away");

    const { h, a, hf, af } = b.details;
    const hRender = buildBreakdownHTML(h, a, hf);
    const aRender = buildBreakdownHTML(a, h, af);
    document.getElementById("homeScore").textContent = b.score.home;
    document.getElementById("awayScore").textContent = b.score.away;
    document.getElementById("homeSummary").textContent = hRender.summary;
    document.getElementById("awaySummary").textContent = aRender.summary;
    document.getElementById("homeDetail").innerHTML = hRender.body;
    document.getElementById("awayDetail").innerHTML = aRender.body;
  };

  window.playQuarterById = (qid)=>{
    const ps = SEASON.postseason; if(!ps || !ps.quarters) return;
    const m = ps.quarters.find(x=>x.id===qid); if(!m) return;

    if(!m.played){
      const home = JSON.parse(JSON.stringify(getTeam(m.home.ci, m.home.ti)));
      const away = JSON.parse(JSON.stringify(getTeam(m.away.ci, m.away.ti)));
      const sim = simulateMatchByTeams(home, away);
      m.played = true;
      m.score = sim.score;
      m.details = sim.details;
      m.winner = (sim.score.home>sim.score.away ? m.home : m.away);
      saveSeason(SEASON);
      buildSemifinals(SEASON);
      renderPostseason(SEASON);
    }

    document.querySelector('[data-tab="play"]').click();
    refreshTeamPickers();
    const homeTeam = JSON.parse(JSON.stringify(getTeam(m.home.ci, m.home.ti)));
    const awayTeam = JSON.parse(JSON.stringify(getTeam(m.away.ci, m.away.ti)));
    applyTeamToSide(homeTeam, "home");
    applyTeamToSide(awayTeam, "away");

    const { h, a, hf, af } = m.details;
    const hRender = buildBreakdownHTML(h, a, hf);
    const aRender = buildBreakdownHTML(a, h, af);
    document.getElementById("homeScore").textContent = m.score.home;
    document.getElementById("awayScore").textContent = m.score.away;
    document.getElementById("homeSummary").textContent = hRender.summary;
    document.getElementById("awaySummary").textContent = aRender.summary;
    document.getElementById("homeDetail").innerHTML = hRender.body;
    document.getElementById("awayDetail").innerHTML = aRender.body;
  };

  window.playSemiById = (sid)=>{
    const ps = SEASON.postseason; if(!ps || !ps.semis) return;
    const m = ps.semis.find(x=>x.id===sid); if(!m) return;

    if(!m.played){
      const home = JSON.parse(JSON.stringify(getTeam(m.home.ci, m.home.ti)));
      const away = JSON.parse(JSON.stringify(getTeam(m.away.ci, m.away.ti)));
      const sim = simulateMatchByTeams(home, away);
      m.played = true;
      m.score = sim.score;
      m.details = sim.details;
      m.winner = (sim.score.home>sim.score.away ? m.home : m.away);
      saveSeason(SEASON);
      buildChampionship(SEASON);
      renderPostseason(SEASON);
    }

    document.querySelector('[data-tab="play"]').click();
    refreshTeamPickers();
    const homeTeam = JSON.parse(JSON.stringify(getTeam(m.home.ci, m.home.ti)));
    const awayTeam = JSON.parse(JSON.stringify(getTeam(m.away.ci, m.away.ti)));
    applyTeamToSide(homeTeam, "home");
    applyTeamToSide(awayTeam, "away");

    const { h, a, hf, af } = m.details;
    const hRender = buildBreakdownHTML(h, a, hf);
    const aRender = buildBreakdownHTML(a, h, af);
    document.getElementById("homeScore").textContent = m.score.home;
    document.getElementById("awayScore").textContent = m.score.away;
    document.getElementById("homeSummary").textContent = hRender.summary;
    document.getElementById("awaySummary").textContent = aRender.summary;
    document.getElementById("homeDetail").innerHTML = hRender.body;
    document.getElementById("awayDetail").innerHTML = aRender.body;
  };

  window.playChampionshipSingle = ()=>{
    const ps = SEASON.postseason; if(!ps || !ps.championship) return;
    const g = ps.championship;

    if(!g.played){
      const home = JSON.parse(JSON.stringify(getTeam(g.home.ci, g.home.ti)));
      const away = JSON.parse(JSON.stringify(getTeam(g.away.ci, g.away.ti)));
      const sim = simulateMatchByTeams(home, away);
      g.played = true;
      g.score = sim.score;
      g.details = sim.details;
      g.winner = (sim.score.home>sim.score.away ? g.home : g.away);
      saveSeason(SEASON);
      renderPostseason(SEASON);
    }

    document.querySelector('[data-tab="play"]').click();
    refreshTeamPickers();
    const homeTeam = JSON.parse(JSON.stringify(getTeam(g.home.ci, g.home.ti)));
    const awayTeam = JSON.parse(JSON.stringify(getTeam(g.away.ci, g.away.ti)));
    applyTeamToSide(homeTeam, "home");
    applyTeamToSide(awayTeam, "away");

    const { h, a, hf, af } = g.details;
    const hRender = buildBreakdownHTML(h, a, hf);
    const aRender = buildBreakdownHTML(a, h, af);
    document.getElementById("homeScore").textContent = g.score.home;
    document.getElementById("awayScore").textContent = g.score.away;
    document.getElementById("homeSummary").textContent = hRender.summary;
    document.getElementById("awaySummary").textContent = aRender.summary;
    document.getElementById("homeDetail").innerHTML = hRender.body;
    document.getElementById("awayDetail").innerHTML = aRender.body;
  };
}

/* =========================
   HISTORY: rendering, import & wiring
========================= */
function renderHistoryTab(){
  const hist = loadHistory();
  const select = document.getElementById("historySelect");
  const view = document.getElementById("historyView");

  // Build dropdown: "Totals" + each season label
  select.innerHTML = "";
  const optTotals = document.createElement("option");
  optTotals.value = "TOTALS";
  optTotals.textContent = "Totals (All Seasons)";
  select.appendChild(optTotals);

  const seasons = [...(hist.seasons||[])];
  seasons.forEach((s, idx)=>{
    const opt = document.createElement("option");
    opt.value = `S:${idx}`;
    opt.textContent = s.label || `Season ${idx+1}`;
    select.appendChild(opt);
  });

  select.onchange = ()=> renderHistoryView(select.value, hist, view);
  select.value = "TOTALS";
  renderHistoryView("TOTALS", hist, view);

  // wire delete + export
  const btnDel = document.getElementById("btnClearHistory");
  if(btnDel){
    btnDel.onclick = ()=>{
      if(!confirm("Delete ALL saved history? This cannot be undone.")) return;
      clearHistory();
      renderHistoryTab();
    };
  }

  const btnExport = document.getElementById("btnExportHistory");
  if(btnExport){
    btnExport.onclick = ()=> exportHistoryJSON();
  }

  // wire import
  const inputImport = document.getElementById("importHistoryFile");
  if(inputImport){
    inputImport.onchange = async (e)=>{
      const file = e.target.files && e.target.files[0];
      if(!file) return;

      try{
        const text = await file.text();
        const data = JSON.parse(text);

        if(!validateHistorySchema(data)){
          alert("Invalid history file. Expected an object with a 'seasons' array.");
          inputImport.value = "";
          return;
        }

        const existing = loadHistory();
        let merged;

        if((existing.seasons||[]).length > 0){
          const doAppend = confirm("Append imported seasons to existing history?\nOK = Append, Cancel = Replace");
          if(doAppend){
            merged = { seasons: [...existing.seasons, ...data.seasons] };
          }else{
            merged = { seasons: [...data.seasons] };
          }
        }else{
          merged = { seasons: [...data.seasons] };
        }

        saveHistory(merged);
        alert(`Imported ${data.seasons.length} season(s) successfully.`);
        // Refresh the view
        renderHistoryTab();
      }catch(err){
        console.error(err);
        alert("Failed to import history. Ensure it's a valid JSON file.");
      }finally{
        inputImport.value = "";
      }
    };
  }
}

function renderHistoryView(which, hist, view){
  view.innerHTML = "";
  if(which === "TOTALS"){
    const totals = computeTotals(hist);
    if(totals.length === 0){
      view.innerHTML = `<em>No history saved yet. Use "Save Season to History" on the Season tab.</em>`;
      return;
    }
    const rows = totals.map(r=>`
      <tr>
        <td>${r.name}</td>
        <td>${r.w}</td>
        <td>${r.l}</td>
        <td>${r.bowls}</td>
        <td>${r.champ}</td>
      </tr>
    `).join("");
    view.innerHTML = `
      <div class="history-section">
        <h4 class="history-title">All-Time Totals</h4>
        <table class="history-table">
          <thead><tr><th>Team</th><th>W</th><th>L</th><th>Bowls</th><th>Championships</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    return;
  }

  const idx = parseInt(which.split(":")[1],10);
  const s = (hist.seasons||[])[idx];
  if(!s){
    view.innerHTML = `<em>Season not found.</em>`;
    return;
  }

  const sRows = Object.keys(s.standings).map(k=>{
    const rec = s.standings[k];
    const nm = s.teams[k]?.name || k;
    const diff = (rec.pf - rec.pa);
    return `<tr><td>${nm}</td><td>${rec.w}</td><td>${rec.l}</td><td>${rec.pf}</td><td>${rec.pa}</td><td>${diff>=0?'+':''}${diff}</td></tr>`;
  }).join("");

  let champLine = `<em>No champion recorded.</em>`;
  if(s.postseason?.championship?.winner){
    const wref = s.postseason.championship.winner;
    champLine = `<strong>Champion:</strong> ${getTeam(wref.ci, wref.ti).name}`;
    }

  const metaRows = Object.keys(s.seasonTeamMeta||{}).map(k=>{
    const st = s.seasonTeamMeta[k];
    return `<tr><td>${st.name}</td><td>${st.bowls||0}</td><td>${st.champ||0}</td></tr>`;
  }).join("");

  view.innerHTML = `
    <div class="history-grid">
      <div class="history-section">
        <h4 class="history-title">${s.label}</h4>
        <div><small>Saved: ${new Date(s.createdAt).toLocaleString()}</small></div>
        <p>${champLine}</p>
      </div>

      <div class="history-section">
        <h4 class="history-title">Standings</h4>
        <table class="history-table">
          <thead><tr><th>Team</th><th>W</th><th>L</th><th>PF</th><th>PA</th><th>Diff</th></tr></thead>
          <tbody>${sRows}</tbody>
        </table>
      </div>

      <div class="history-section">
        <h4 class="history-title">Bowl Appearances & Championships (Season)</h4>
        <table class="history-table">
          <thead><tr><th>Team</th><th>Bowls</th><th>Championships</th></tr></thead>
          <tbody>${metaRows || `<tr><td colspan="3"><em>No postseason data.</em></td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `;
}

/* =========================
   Boot
========================= */
window.addEventListener("DOMContentLoaded", ()=>{
  // Tabs
  initTabs();

  // Play tab setup
  fillAllPlaySelects();
  neutralDefaultsPlay();
  wirePlayTab(tieLogToPanel);
  wirePlayPickers();

  // League tab setup
  setupEditorSelects();
  renderLeagueSidebar();
  clearEditorSelection();
  refreshTeamPickers();

  // Season tab setup
  ensureSeason();
  renderWeekPicker(SEASON, ()=>{ renderGames(SEASON); });
  renderGames(SEASON);
  renderStandingsAll();
  wireSeasonButtons();

  // Postseason setup
  renderPostseason(SEASON);
  wirePostseasonButtons();
});


