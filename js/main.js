// js/main.js
// Entry point for tabs, Play/League/Season wiring, Postseason, History, and Offseason.

import { OFF_SLOTS, DEF_SLOTS } from "./constants.js";
import { loadLeague, saveLeague } from "./league.js";
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

import {
  loadHistory, addCurrentSeasonToHistory,
  exportHistoryJSON, importHistoryFromFile, clearAllHistory,
  buildTotalsTableHTML, buildSeasonRecapHTML, seasonsList
} from "./history.js";

import { advanceSeasonAndSummarize } from "./offseason.js";

let LEAGUE = LEAGUE_STATE;
let SEASON = null;

/* -------------------------
   Tabs
--------------------------*/
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
        attachPSSectionButtons();
      }
      if(name==="history"){
        renderHistoryUI();
      }
    });
  });
}

/* -------------------------
   Season helpers
--------------------------*/
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

/* -------------------------
   Play tab rendering (results & rewatch)
--------------------------*/
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

/* -------------------------
   Season tab buttons
--------------------------*/
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
    attachPSSectionButtons();
    hideYearEndSummary();
  });

  const btnSave = document.getElementById("btnSaveSeasonToHistory");
  if (btnSave){
    btnSave.addEventListener("click", ()=>{
      if(!confirm("Save current season to history?")) return;
      addCurrentSeasonToHistory(SEASON, LEAGUE);
      alert("Season saved to history.");
    });
  }

  const btnAdvance = document.getElementById("btnAdvanceYear");
  if (btnAdvance){
    btnAdvance.addEventListener("click", ()=>{
      if(!confirm("Advance the year? Seniors will graduate and freshmen will be added.")) return;
      const summaryHTML = advanceSeasonAndSummarize(LEAGUE);
      saveLeague(LEAGUE);
      // Optionally reset season schedule for the new year
      SEASON = createSeasonFromLeague(LEAGUE);
      saveSeason(SEASON);
      renderWeekPicker(SEASON, ()=>{ renderGames(SEASON); });
      renderGames(SEASON);
      renderStandingsAll();
      renderPostseason(SEASON);
      attachPSSectionButtons();
      showYearEndSummary(summaryHTML);
    });
  }
}

/* -------------------------
   Postseason wiring
--------------------------*/
function wirePostseasonButtons(){
  const g = id => document.getElementById(id);

  g("btnGenPostseason").addEventListener("click", ()=>{
    SEASON.postseason = null;
    generatePostseason(LEAGUE, SEASON);
    renderPostseason(SEASON);
    attachPSSectionButtons();
  });

  g("btnResetPostseason").addEventListener("click", ()=>{
    if(confirm("Reset postseason?")){
      resetPostseason(SEASON);
      renderPostseason(SEASON);
      attachPSSectionButtons();
    }
  });
}

// Install/refresh section-level postseason buttons rendered inside each section
function attachPSSectionButtons(){
  const bowlsAll = document.getElementById("btnSecPlayBowlsAll");
  if (bowlsAll){
    bowlsAll.onclick = ()=>{
      if(!SEASON.postseason) return;
      playUnplayedBowls(SEASON, LEAGUE);
      renderPostseason(SEASON);
      attachPSSectionButtons();
    };
  }
  const qf = document.getElementById("btnSecPlayQF");
  if (qf){
    qf.onclick = ()=>{
      if(!SEASON.postseason) return;
      if((SEASON.postseason.quarters||[]).length===0) buildQuarterfinals(SEASON);
      playQuarterfinals(SEASON, LEAGUE);
      renderPostseason(SEASON);
      attachPSSectionButtons();
    };
  }
  const sf = document.getElementById("btnSecPlaySF");
  if (sf){
    sf.onclick = ()=>{
      if(!SEASON.postseason) return;
      if((SEASON.postseason.semis||[]).length===0) buildSemifinals(SEASON);
      playSemifinals(SEASON, LEAGUE);
      renderPostseason(SEASON);
      attachPSSectionButtons();
    };
  }
  const ncg = document.getElementById("btnSecPlayNCG");
  if (ncg){
    ncg.onclick = ()=>{
      if(!SEASON.postseason) return;
      if(!SEASON.postseason.championship) buildChampionship(SEASON);
      playChampionship(SEASON, LEAGUE);
      renderPostseason(SEASON);
      attachPSSectionButtons();
    };
  }
}

// Single-game handlers used by ui_season
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
    renderPostseason(SEASON);
    attachPSSectionButtons();
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

window.playQuarterById = (id)=>{
  const ps = SEASON.postseason; if(!ps) return;
  const m = (ps.quarters||[]).find(x=>x.id===id); if(!m) return;

  if(!m.played){
    const home = JSON.parse(JSON.stringify(getTeam(m.home.ci, m.home.ti)));
    const away = JSON.parse(JSON.stringify(getTeam(m.away.ci, m.away.ti)));
    const sim = simulateMatchByTeams(home, away);
    m.played = true;
    m.score = sim.score;
    m.details = sim.details;
    m.winner = (sim.score.home>sim.score.away ? m.home : m.away);
    saveSeason(SEASON);

    if(ps.quarters.every(q=>q.winner) && (ps.semis||[]).length===0){
      buildSemifinals(SEASON);
    }
    renderPostseason(SEASON);
    attachPSSectionButtons();
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

window.playSemiById = (id)=>{
  const ps = SEASON.postseason; if(!ps) return;
  const m = (ps.semis||[]).find(x=>x.id===id); if(!m) return;

  if(!m.played){
    const home = JSON.parse(JSON.stringify(getTeam(m.home.ci, m.home.ti)));
    const away = JSON.parse(JSON.stringify(getTeam(m.away.ci, m.away.ti)));
    const sim = simulateMatchByTeams(home, away);
    m.played = true;
    m.score = sim.score;
    m.details = sim.details;
    m.winner = (sim.score.home>sim.score.away ? m.home : m.away);
    saveSeason(SEASON);

    if(ps.semis.every(s=>s.winner) && !ps.championship){
      buildChampionship(SEASON);
    }
    renderPostseason(SEASON);
    attachPSSectionButtons();
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
    attachPSSectionButtons();
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

/* -------------------------
   Year-End Summary panel
--------------------------*/
function showYearEndSummary(html){
  const panel = document.getElementById("yearEndSummaryPanel");
  const box = document.getElementById("yearEndSummary");
  if (box){ box.innerHTML = html || "<em>No changes</em>"; }
  if (panel){ panel.style.display = "block"; }
}
function hideYearEndSummary(){
  const panel = document.getElementById("yearEndSummaryPanel");
  const box = document.getElementById("yearEndSummary");
  if (box) box.innerHTML = "";
  if (panel) panel.style.display = "none";
}

/* -------------------------
   History tab
--------------------------*/
function renderHistoryUI(){
  const sel = document.getElementById("historySelect");
  const title = document.getElementById("historyTitle");
  const content = document.getElementById("historyContent");

  const hist = loadHistory();

  sel.innerHTML = "";
  sel.appendChild(seasonsList(hist));

  sel.value = "TOTALS";
  title.textContent = "Totals";
  content.innerHTML = buildTotalsTableHTML(hist, LEAGUE);

  sel.onchange = ()=>{
    if(sel.value === "TOTALS"){
      title.textContent = "Totals";
      content.innerHTML = buildTotalsTableHTML(hist, LEAGUE);
    }else{
      const idx = parseInt(sel.value,10);
      title.textContent = `Season ${idx+1} Recap`;
      content.innerHTML = buildSeasonRecapHTML(hist, idx, LEAGUE);
    }
  };

  const btnAdd = document.getElementById("btnHistoryAddSeason");
  const btnExp = document.getElementById("btnExportHistory");
  const btnImp = document.getElementById("importHistoryFile");
  const btnClr = document.getElementById("btnClearHistory");

  if (btnAdd){
    btnAdd.onclick = ()=>{
      if(!confirm("Save current season to history?")) return;
      addCurrentSeasonToHistory(SEASON, LEAGUE);
      renderHistoryUI();
      alert("Season saved to history.");
    };
  }
  if (btnExp){
    btnExp.onclick = ()=>{
      const blob = new Blob([exportHistoryJSON()], {type:"application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "gbcf_history.json";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
  }
  if (btnImp){
    btnImp.onchange = async (e)=>{
      const file = e.target.files?.[0];
      if(!file) return;
      try{
        await importHistoryFromFile(file);
        renderHistoryUI();
        alert("History imported.");
      }catch(err){
        alert("Import failed: "+(err?.message || err));
      }finally{
        e.target.value = "";
      }
    };
  }
  if (btnClr){
    btnClr.onclick = ()=>{
      if(!confirm("Delete ALL history? This cannot be undone.")) return;
      clearAllHistory();
      renderHistoryUI();
    };
  }
}

/* -------------------------
   Boot
--------------------------*/
window.addEventListener("DOMContentLoaded", ()=>{
  initTabs();

  fillAllPlaySelects();
  neutralDefaultsPlay();
  wirePlayTab(tieLogToPanel);

  setupEditorSelects();
  renderLeagueSidebar();
  clearEditorSelection();
  refreshTeamPickers();

  ensureSeason();
  renderWeekPicker(SEASON, ()=>{ renderGames(SEASON); });
  renderGames(SEASON);
  renderStandingsAll();
  renderPostseason(SEASON);
  wireSeasonButtons();
  wirePostseasonButtons();
  attachPSSectionButtons();

  renderHistoryUI();
});



