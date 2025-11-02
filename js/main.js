// js/main.js
// Entry point for tabs, Play/League/Season wiring, and Postseason controls.
// Integrated with your existing offseason.js (advanceSeasonAndSummarize).

import { OFF_SLOTS, DEF_SLOTS, LS_HISTORY } from "./constants.js";
import { loadLeague } from "./league.js";
import {
  loadSeason,
  saveSeason,
  createSeasonFromLeague,
  simulateMatchByTeams
} from "./season.js";
import { advanceSeasonAndSummarize } from "./offseason.js";

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

/* -------------------------
   Small, guarded history helpers (no UI assumptions)
--------------------------*/
function loadHistory(){
  try{
    const raw = localStorage.getItem(LS_HISTORY);
    if (!raw) return { seasons: [] };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { seasons: parsed };
    if (!parsed || !Array.isArray(parsed.seasons)) return { seasons: [] };
    return parsed;
  }catch{ return { seasons: [] }; }
}
function saveHistory(obj){ localStorage.setItem(LS_HISTORY, JSON.stringify(obj)); }
function pushSeasonToHistory(snapshot){
  const h = loadHistory();
  h.seasons.push(snapshot);
  saveHistory(h);
}

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
      const panel = document.getElementById(`tab-${name}`);
      if (panel) panel.classList.add("active");

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
        wireSeasonButtons();        // (idempotent binding guarded below)
        wirePostseasonButtons();    // (idempotent binding guarded below)
        updateSaveSeasonButton();   // save-season disabled until NCG played
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
  if (!box) return;
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
  // Jump to Play tab
  const t = document.querySelector('[data-tab="play"]');
  if (t) t.click();

  // Ensure pickers exist/are populated
  refreshTeamPickers();

  // Show the two teams and the saved breakdown
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

/**
 * Play or Rewatch a scheduled season game.
 * - replay=false: simulate if not played, save standings, store full details.
 * - replay=true : do not simulate; render saved score/details into Play tab.
 */
function playScheduledGame(g, {replay=false}={}){
  const homeTeam = JSON.parse(JSON.stringify(getTeam(g.home.ci, g.home.ti)));
  const awayTeam = JSON.parse(JSON.stringify(getTeam(g.away.ci, g.away.ti)));

  if (replay && g.played && g.details){
    renderGameResultsToPlayTab(homeTeam, awayTeam, g.details, g.score);
    return;
  }

  // Fresh simulation
  const sim = simulateMatchByTeams(homeTeam, awayTeam);
  const { score, details } = sim;

  // First-time play: persist into season + standings
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

  // Show result in Play tab
  renderGameResultsToPlayTab(homeTeam, awayTeam, details, score);

  // Return to Season view and refresh UI
  const s = document.querySelector('[data-tab="season"]');
  if (s) s.click();
  renderGames(SEASON);
  renderStandingsAll();
}
window.playScheduledGame = playScheduledGame;

/* -------------------------
   Season tab buttons (guard each bind)
--------------------------*/
let seasonButtonsWired = false;
function wireSeasonButtons(){
  if (seasonButtonsWired) return;
  seasonButtonsWired = true;

  const weekSel = document.getElementById("seasonWeek");

  const btnWeek = document.getElementById("btnSimWeek");
  if (btnWeek){
    btnWeek.addEventListener("click", ()=>{
      const w = SEASON.weeks.find(x=>x.week===parseInt(weekSel.value,10));
      w.games.forEach(g=>{ if(!g.played) playScheduledGame(g, {replay:false}); });
    });
  }

  const btnSeason = document.getElementById("btnSimSeason");
  if (btnSeason){
    btnSeason.addEventListener("click", ()=>{
      SEASON.weeks.forEach(w=>{
        w.games.forEach(g=>{ if(!g.played) playScheduledGame(g, {replay:false}); });
      });
    });
  }

  const btnReset = document.getElementById("btnResetSeason");
  if (btnReset){
    btnReset.addEventListener("click", ()=>{
      if(!confirm("Reset season schedule and standings?")) return;
      SEASON = createSeasonFromLeague(LEAGUE);
      saveSeason(SEASON);
      renderWeekPicker(SEASON, ()=>{ renderGames(SEASON); });
      renderGames(SEASON);
      renderStandingsAll();
      renderPostseason(SEASON);
      updateSaveSeasonButton();
    });
  }

  // OPTIONAL: Save Season (only if this button is present in your current index.html)
  const btnSave = document.getElementById("btnSaveSeason");
  if (btnSave){
    btnSave.addEventListener("click", ()=>{
      if (!isSeasonComplete()) return;
      const snapshot = {
        ts: Date.now(),
        standings: SEASON.standings,
        postseason: SEASON.postseason
      };
      pushSeasonToHistory(snapshot);
      updateSaveSeasonButton();
      alert("Season saved to history.");
    });
  }

  // OPTIONAL: Advance Season (only if this button is present in your current index.html)
  const btnAdv = document.getElementById("btnAdvanceSeason");
  if (btnAdv){
    btnAdv.addEventListener("click", ()=>{
      // If you require championship first, guard here:
      // if (!isSeasonComplete() && !confirm("Championship not complete. Advance anyway?")) return;

      // Progress players & replace SRs using YOUR offseason.js
      const html = advanceSeasonAndSummarize(LEAGUE); // mutates LEAGUE, returns recap HTML

      // Build a fresh schedule for the new year
      SEASON = createSeasonFromLeague(LEAGUE);
      saveSeason(SEASON);

      // Re-render Season tab
      renderWeekPicker(SEASON, ()=>{ renderGames(SEASON); });
      renderGames(SEASON);
      renderStandingsAll();
      renderPostseason(SEASON);
      updateSaveSeasonButton();

      // Present a summary — keep it simple (no new DOM/CSS):
      const tmp = document.createElement("div");
      tmp.style.maxHeight = "60vh";
      tmp.style.overflow = "auto";
      tmp.innerHTML = html;
      // Open in a separate window for readability without CSS changes
      const w = window.open("", "_blank");
      if (w && w.document){
        w.document.write("<!doctype html><title>Year-End Recap</title>");
        w.document.write('<meta charset="utf-8"/>');
        w.document.write('<div style="font-family:system-ui,Arial,sans-serif; padding:12px; color:#111;">');
        w.document.write("<h2>Year-End Recap</h2>");
        w.document.write(tmp.innerHTML);
        w.document.write("</div>");
        w.document.close();
      } else {
        alert("Season advanced. A recap window was blocked by the browser — enable popups to see the detailed summary.");
      }
    });
  }
}

/* -------------------------
   Save Season enablement
--------------------------*/
function isSeasonComplete(){
  const ps = SEASON?.postseason;
  return !!(ps && ps.championship && ps.championship.played);
}
function updateSaveSeasonButton(){
  const btn = document.getElementById("btnSaveSeason");
  if (btn) btn.disabled = !isSeasonComplete();
}

/* -------------------------
   Play tab: load/save pickers for teams
--------------------------*/
function wirePlayPickers(){
  const b1 = document.getElementById("btnLoadHome");
  if (b1){
    b1.addEventListener("click", ()=>{
      const id = document.getElementById("pickHomeTeam").value;
      if(!id) return;
      const team = getTeamByIndexStr(id);
      applyTeamToSide(team, "home");
    });
  }

  const b2 = document.getElementById("btnLoadAway");
  if (b2){
    b2.addEventListener("click", ()=>{
      const id = document.getElementById("pickAwayTeam").value;
      if(!id) return;
      const team = getTeamByIndexStr(id);
      applyTeamToSide(team, "away");
    });
  }

  const b3 = document.getElementById("btnSaveHomeBack");
  if (b3){
    b3.addEventListener("click", ()=>{
      const sel = document.getElementById("pickHomeTeam").value;
      if(!sel) return;
      const team = collectSide("home");
      setTeamByIndexStr(sel, team);
      renderLeagueSidebar();
      refreshTeamPickers();
    });
  }

  const b4 = document.getElementById("btnSaveAwayBack");
  if (b4){
    b4.addEventListener("click", ()=>{
      const sel = document.getElementById("pickAwayTeam").value;
      if(!sel) return;
      const team = collectSide("away");
      setTeamByIndexStr(sel, team);
      renderLeagueSidebar();
      refreshTeamPickers();
    });
  }
}

/* -------------------------
   Postseason wiring (keep your current flow)
--------------------------*/
let psButtonsWired = false;
function wirePostseasonButtons(){
  if (psButtonsWired) return;
  psButtonsWired = true;

  const g = id => document.getElementById(id);

  const gen = g("btnGenPostseason");
  if (gen){
    gen.addEventListener("click", ()=>{
      SEASON.postseason = null;
      generatePostseason(LEAGUE, SEASON);
      renderPostseason(SEASON);
      updateSaveSeasonButton();
    });
  }

  const pal = g("btnPlayAllBowls");
  if (pal){
    pal.addEventListener("click", ()=>{
      if(!SEASON.postseason) return;
      playUnplayedBowls(SEASON, LEAGUE);
      renderPostseason(SEASON);
      updateSaveSeasonButton();
    });
  }

  const pq = g("btnPlayQuarterfinals");
  if (pq){
    pq.addEventListener("click", ()=>{
      if(!SEASON.postseason) return;
      if((SEASON.postseason.quarters||[]).length===0) buildQuarterfinals(SEASON);
      playQuarterfinals(SEASON, LEAGUE);
      renderPostseason(SEASON);
      updateSaveSeasonButton();
    });
  }

  const psf = g("btnPlaySemifinals");
  if (psf){
    psf.addEventListener("click", ()=>{
      if(!SEASON.postseason) return;
      if((SEASON.postseason.semis||[]).length===0) buildSemifinals(SEASON);
      playSemifinals(SEASON, LEAGUE);
      renderPostseason(SEASON);
      updateSaveSeasonButton();
    });
  }

  const pc = g("btnPlayChampionship");
  if (pc){
    pc.addEventListener("click", ()=>{
      if(!SEASON.postseason) return;
      if(!SEASON.postseason.championship) buildChampionship(SEASON);
      playChampionship(SEASON, LEAGUE);
      renderPostseason(SEASON);
      updateSaveSeasonButton();
    });
  }

  const pr = g("btnResetPostseason");
  if (pr){
    pr.addEventListener("click", ()=>{
      if(confirm("Reset postseason?")){
        resetPostseason(SEASON);
        renderPostseason(SEASON);
        updateSaveSeasonButton();
      }
    });
  }

  // Allow clicking individual initial bowls (Play/Rewatch)
  window.playBowlById = (id)=>{
    const ps = SEASON.postseason; if(!ps) return;
    const b = ps.bowlsInitial.find(x=>x.id===id); if(!b) return;

    // If not yet played, simulate + persist
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
      updateSaveSeasonButton();
    }

    // Rewatch: render stored details to Play tab
    const t = document.querySelector('[data-tab="play"]');
    if (t) t.click();
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
}

/* -------------------------
   Boot
--------------------------*/
window.addEventListener("DOMContentLoaded", ()=>{
  // Tabs
  initTabs();

  // Play tab setup
  fillAllPlaySelects();
  neutralDefaultsPlay();
  wirePlayTab(tieLogToPanel);
  wirePlayPickers(); // ← important so you can load two arbitrary teams

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
  renderPostseason(SEASON);
  wireSeasonButtons();
  wirePostseasonButtons();
  updateSaveSeasonButton();

  // Dev tip: clear storage while iterating if needed
  // localStorage.removeItem('GBCF_LEAGUE_V5');
  // localStorage.removeItem('GBCF_SEASON_V2');
});





