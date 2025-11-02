// js/main.js
// Tabs, Play/League/Season wiring, Postseason controls, and History helpers.

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
  getTeam,
  wireLeagueEditor            // ⟵ added
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
   HISTORY (storage + helpers)
--------------------------*/
function loadHistory(){
  try{
    const raw = localStorage.getItem(LS_HISTORY);
    if (!raw) return { seasons: [] };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { seasons: parsed }; // legacy array
    if (!parsed || !Array.isArray(parsed.seasons)) return { seasons: [] };
    return parsed;
  }catch{ return { seasons: [] }; }
}
function saveHistory(obj){ localStorage.setItem(LS_HISTORY, JSON.stringify(obj)); }
function clearHistory(){ saveHistory({ seasons: [] }); }
function nextSeasonNumber(){ return loadHistory().seasons.length + 1; }
function snapshotTeamNames(){
  const map = {};
  LEAGUE.forEach((conf, ci)=>{
    conf.teams.forEach((t, ti)=>{ map[`${ci}:${ti}`] = t.name; });
  });
  return map;
}
function resolveTeamName(key, teamNames){
  if (teamNames && teamNames[key]) return teamNames[key];
  if (/^\d+:\d+$/.test(key)){
    const [ci, ti] = key.split(":").map(n=>parseInt(n,10));
    if (LEAGUE[ci]?.teams?.[ti]) return LEAGUE[ci].teams[ti].name || key;
  }
  return key;
}
function countAppearancesForSeason(postseason, teamNameByKey){
  const counts = {};
  const inc = (ref)=>{
    if (!ref) return;
    const key = `${ref.ci}:${ref.ti}`;
    const name = resolveTeamName(key, teamNameByKey);
    counts[name] = (counts[name]||0) + 1;
  };
  if (!postseason) return counts;
  (postseason.bowlsInitial||[]).forEach(b=>{ inc(b.home); inc(b.away); });
  (postseason.quarters||[]).forEach(m=>{ inc(m.home); inc(m.away); });
  (postseason.semis||[]).forEach(m=>{ inc(m.home); inc(m.away); });
  if (postseason.championship){ inc(postseason.championship.home); inc(postseason.championship.away); }
  return counts;
}
function winnerNameIfAny(postseason, teamNames){
  const g = postseason && postseason.championship;
  if (!g || !g.winner) return null;
  const key = `${g.winner.ci}:${g.winner.ti}`;
  return resolveTeamName(key, teamNames);
}
function computeAllTimeTotals(history){
  const totals = {};
  const addTeam = (n)=>{ if(!totals[n]) totals[n] = {w:0,l:0,bowls:0,champs:0}; };
  history.seasons.forEach(sea=>{
    const names = sea.teamNames || {};
    Object.entries(sea.standings||{}).forEach(([key,rec])=>{
      const n = resolveTeamName(key, names); addTeam(n);
      totals[n].w += rec.w||0; totals[n].l += rec.l||0;
    });
    const apps = countAppearancesForSeason(sea.postseason, names);
    Object.entries(apps).forEach(([n,c])=>{ addTeam(n); totals[n].bowls += c; });
    const champ = winnerNameIfAny(sea.postseason, names);
    if (champ){ addTeam(champ); totals[champ].champs += 1; }
  });
  return totals;
}
function tableTotalsHTML(t){
  const rows = Object.entries(t).sort((a,b)=>{
    const A=a[1], B=b[1];
    return (B.champs-A.champs)||(B.bowls-A.bowls)||(B.w-A.w)||a[0].localeCompare(b[0]);
  }).map(([n,v])=>`<tr><td>${n}</td><td>${v.w}</td><td>${v.l}</td><td>${v.bowls}</td><td>${v.champs}</td></tr>`).join("");
  return `<table class="standings-table"><thead><tr><th>Team</th><th>W</th><th>L</th><th>Bowl Apps</th><th>Titles</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function tableSeasonStandingsHTML(season){
  const names = season.teamNames || {};
  const rows = Object.entries(season.standings||{}).map(([k,r])=>{
    const n = resolveTeamName(k, names); const diff=(r.pf||0)-(r.pa||0);
    return {name:n, ...r, diff};
  }).sort((a,b)=> (b.w-a.w)||(b.diff-a.diff)||(b.pf-a.pf)||a.name.localeCompare(b.name))
    .map(r=>`<tr><td>${r.name}</td><td>${r.w}</td><td>${r.l}</td><td>${r.pf}</td><td>${r.pa}</td><td>${r.diff>=0?'+':''}${r.diff}</td></tr>`).join("");
  return `<table class="standings-table"><thead><tr><th>Team</th><th>W</th><th>L</th><th>PF</th><th>PA</th><th>Diff</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function seasonSummaryHTML(season){
  const names = season.teamNames || {};
  const champ = winnerNameIfAny(season.postseason, names);
  const apps = countAppearancesForSeason(season.postseason, names);
  const top = Object.entries(apps).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([n,c])=>
    `<div class="game-row"><div class="game-names">${n}</div><div class="game-score">${c}</div><div class="game-actions"></div></div>`).join("") || `<div class="small-muted">No bowls played</div>`;
  return `${champ?`<p><strong>Champion:</strong> ${champ}</p>`:`<p><em>No champion recorded</em></p>`}
          <h4>Top Bowl Appearances</h4><div class="games-list">${top}</div>`;
}
function exportHistoryJSON(){
  const h = loadHistory();
  const blob = new Blob([JSON.stringify(h,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = "gbcf_history.json"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function renderHistoryUI(){
  const sel = document.getElementById("historySeasonSelect");
  const totalsBox = document.getElementById("historyTotals");
  const detailsBox = document.getElementById("historyDetails");
  const title = document.getElementById("historyTitle");
  if (!sel || !totalsBox || !detailsBox || !title) return;
  const history = loadHistory();

  sel.innerHTML = "";
  const optAll = document.createElement("option"); optAll.value = "ALL"; optAll.textContent = "Totals (All-Time)"; sel.appendChild(optAll);
  history.seasons.forEach((s,i)=>{ const o=document.createElement("option"); o.value=String(i); o.textContent=s.label||`Season ${i+1}`; sel.appendChild(o); });
  sel.value = sel.value || "ALL";

  function draw(){
    const v = sel.value;
    if (v==="ALL"){
      title.textContent = "Totals (All-Time)";
      totalsBox.innerHTML = tableTotalsHTML(computeAllTimeTotals(history));
      detailsBox.innerHTML = `<div class="small-muted">Select a specific season to see its standings and champion.</div>`;
    }else{
      const idx = parseInt(v,10);
      const season = history.seasons[idx];
      title.textContent = season.label || `Season ${idx+1}`;
      totalsBox.innerHTML = tableSeasonStandingsHTML(season);
      detailsBox.innerHTML = seasonSummaryHTML(season);
    }
  }
  sel.onchange = draw; draw();
}
function deleteSelectedSeasonFromHistory(){
  const sel = document.getElementById("historySeasonSelect");
  if (!sel || sel.value==="ALL") return;
  const idx=parseInt(sel.value,10);
  const h=loadHistory(); if(idx<0||idx>=h.seasons.length) return;
  if(!confirm(`Delete ${h.seasons[idx].label||`Season ${idx+1}`} from history?`)) return;
  h.seasons.splice(idx,1); saveHistory(h); renderHistoryUI();
}
function wireHistoryTab(){
  const btnDel = document.getElementById("btnDeleteSeasonFromHistory");
  if (btnDel) btnDel.addEventListener("click", deleteSelectedSeasonFromHistory);
  const btnClr = document.getElementById("btnClearHistory");
  if (btnClr) btnClr.addEventListener("click", ()=>{ if(confirm("Delete ALL saved seasons from history?")){ clearHistory(); renderHistoryUI(); }});
  const btnExp = document.getElementById("btnExportHistory");
  if (btnExp) btnExp.addEventListener("click", exportHistoryJSON);
  const inpImp = document.getElementById("importHistoryFile");
  if (inpImp){
    inpImp.addEventListener("change", async (e)=>{
      const f = e.target.files?.[0]; if(!f) return;
      try{
        const text = await f.text(); const parsed = JSON.parse(text);
        const obj = Array.isArray(parsed) ? {seasons:parsed} : parsed;
        if(!obj || !Array.isArray(obj.seasons)) throw new Error();
        saveHistory(obj); renderHistoryUI(); alert("History imported.");
      }catch{ alert("Failed to import history JSON."); }
      e.target.value = "";
    });
  }
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
      const panel = document.getElementById(`tab-${name}`); if(panel) panel.classList.add("active");

      if(name==="league"){ renderLeagueSidebar(); }
      if(name==="play"){ refreshTeamPickers(); }
      if(name==="season"){
        ensureSeason();
        renderWeekPicker(SEASON, ()=>{ renderGames(SEASON); });
        renderGames(SEASON);
        renderStandingsAll();
        renderPostseason(SEASON);
        wireSeasonButtons();
        wirePostseasonButtons();
        updateSaveSeasonButton();
      }
      if(name==="history"){ renderHistoryUI(); wireHistoryTab(); }
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
    const blk = document.createElement("div"); blk.className="standings-block";
    const h = document.createElement("h4"); h.textContent = conf.name; blk.appendChild(h);
    const html = standingsTableHTML(SEASON, LEAGUE, ci); const holder=document.createElement("div");
    holder.innerHTML=html; blk.appendChild(holder.firstChild); box.appendChild(blk);
  });
}

/* -------------------------
   Play tab rendering (results & rewatch)
--------------------------*/
function renderGameResultsToPlayTab(homeTeam, awayTeam, details, score){
  document.querySelector('[data-tab="play"]')?.click();
  refreshTeamPickers();
  applyTeamToSide(homeTeam,"home"); applyTeamToSide(awayTeam,"away");
  const { h,a,hf,af } = details;
  const hR = buildBreakdownHTML(h,a,hf); const aR = buildBreakdownHTML(a,h,af);
  document.getElementById("homeScore").textContent = score.home;
  document.getElementById("awayScore").textContent = score.away;
  document.getElementById("homeSummary").textContent = hR.summary;
  document.getElementById("awaySummary").textContent = aR.summary;
  document.getElementById("homeDetail").innerHTML = hR.body;
  document.getElementById("awayDetail").innerHTML = aR.body;
}
function playScheduledGame(g,{replay=false}={}){
  const homeTeam = JSON.parse(JSON.stringify(getTeam(g.home.ci,g.home.ti)));
  const awayTeam = JSON.parse(JSON.stringify(getTeam(g.away.ci,g.away.ti)));
  if(replay && g.played && g.details){ renderGameResultsToPlayTab(homeTeam,awayTeam,g.details,g.score); return; }
  const sim = simulateMatchByTeams(homeTeam,awayTeam);
  const { score, details } = sim;
  if(!g.played){
    g.played=true; g.score=score; g.details=details;
    const hk=`${g.home.ci}:${g.home.ti}`, ak=`${g.away.ci}:${g.away.ti}`;
    SEASON.standings[hk].pf+=score.home; SEASON.standings[hk].pa+=score.away;
    SEASON.standings[ak].pf+=score.away; SEASON.standings[ak].pa+=score.home;
    if(score.home>score.away){ SEASON.standings[hk].w++; SEASON.standings[ak].l++; }
    else { SEASON.standings[ak].w++; SEASON.standings[hk].l++; }
    saveSeason(SEASON);
  }
  renderGameResultsToPlayTab(homeTeam,awayTeam,details,score);
  document.querySelector('[data-tab="season"]')?.click();
  renderGames(SEASON); renderStandingsAll();
}
window.playScheduledGame = playScheduledGame;

/* -------------------------
   Season tab buttons
--------------------------*/
let seasonButtonsWired=false;
function wireSeasonButtons(){
  if(seasonButtonsWired) return; seasonButtonsWired=true;
  const weekSel = document.getElementById("seasonWeek");
  document.getElementById("btnSimWeek")?.addEventListener("click", ()=>{
    const w = SEASON.weeks.find(x=>x.week===parseInt(weekSel.value,10));
    w.games.forEach(g=>{ if(!g.played) playScheduledGame(g,{replay:false}); });
  });
  document.getElementById("btnSimSeason")?.addEventListener("click", ()=>{
    SEASON.weeks.forEach(w=> w.games.forEach(g=>{ if(!g.played) playScheduledGame(g,{replay:false}); }));
  });
  document.getElementById("btnResetSeason")?.addEventListener("click", ()=>{
    if(!confirm("Reset season schedule and standings?")) return;
    SEASON = createSeasonFromLeague(LEAGUE); saveSeason(SEASON);
    renderWeekPicker(SEASON, ()=>{ renderGames(SEASON); });
    renderGames(SEASON); renderStandingsAll(); renderPostseason(SEASON); updateSaveSeasonButton();
  });
  // Save Season (enabled only after championship)
  document.getElementById("btnSaveSeason")?.addEventListener("click", ()=>{
    if(!isSeasonComplete()) return;
    const teamNames = snapshotTeamNames();
    const history = loadHistory(); const sn = nextSeasonNumber();
    const snap = { id:`S${sn}`, label:`Season ${sn}`, ts:Date.now(), teamNames, standings:SEASON.standings, postseason:SEASON.postseason };
    history.seasons.push(snap); saveHistory(history); updateSaveSeasonButton(); alert(`Saved ${snap.label} to history.`);
    if(document.getElementById("tab-history")?.classList.contains("active")) renderHistoryUI();
  });
  // Advance Season → recap popup (players/coach advancement handled elsewhere)
  document.getElementById("btnAdvanceSeason")?.addEventListener("click", ()=>{
    const recapHTML = advanceSeasonAndSummarize(LEAGUE);
    SEASON = createSeasonFromLeague(LEAGUE); saveSeason(SEASON);
    renderWeekPicker(SEASON, ()=>{ renderGames(SEASON); });
    renderGames(SEASON); renderStandingsAll(); renderPostseason(SEASON); updateSaveSeasonButton();
    const w = window.open("","_blank");
    if(w && w.document){
      w.document.write("<!doctype html><title>Year-End Recap</title><meta charset='utf-8'/>");
      w.document.write("<div style='font-family:system-ui,Arial,sans-serif; padding:12px; color:#111;'><h2>Year-End Recap</h2>");
      w.document.write(recapHTML || "<em>No changes</em>"); w.document.write("</div>"); w.document.close();
    }else{ alert("Season advanced. Enable popups to view the recap."); }
  });
}
function isSeasonComplete(){
  const ps=SEASON?.postseason; return !!(ps && ps.championship && ps.championship.played);
}
function updateSaveSeasonButton(){
  const b=document.getElementById("btnSaveSeason"); if(b) b.disabled = !isSeasonComplete();
}

/* -------------------------
   Play tab: load/save pickers for teams
--------------------------*/
function wirePlayPickers(){
  document.getElementById("btnLoadHome")?.addEventListener("click", ()=>{
    const id=document.getElementById("pickHomeTeam").value; if(!id) return;
    const team=getTeamByIndexStr(id); applyTeamToSide(team,"home");
  });
  document.getElementById("btnLoadAway")?.addEventListener("click", ()=>{
    const id=document.getElementById("pickAwayTeam").value; if(!id) return;
    const team=getTeamByIndexStr(id); applyTeamToSide(team,"away");
  });
  document.getElementById("btnSaveHomeBack")?.addEventListener("click", ()=>{
    const sel=document.getElementById("pickHomeTeam").value; if(!sel) return;
    const team=collectSide("home"); setTeamByIndexStr(sel,team); renderLeagueSidebar(); refreshTeamPickers();
  });
  document.getElementById("btnSaveAwayBack")?.addEventListener("click", ()=>{
    const sel=document.getElementById("pickAwayTeam").value; if(!sel) return;
    const team=collectSide("away"); setTeamByIndexStr(sel,team); renderLeagueSidebar(); refreshTeamPickers();
  });
}

/* -------------------------
   Postseason wiring (globals for per-game play/rewatch)
--------------------------*/
let psButtonsWired=false;
function wirePostseasonButtons(){
  if(psButtonsWired) return; psButtonsWired=true;
  const g=id=>document.getElementById(id);

  g("btnGenPostseason")?.addEventListener("click", ()=>{
    SEASON.postseason=null; generatePostseason(LEAGUE,SEASON);
    renderPostseason(SEASON); updateSaveSeasonButton();
  });
  g("btnPlayAllBowls")?.addEventListener("click", ()=>{
    if(!SEASON.postseason) return; playUnplayedBowls(SEASON,LEAGUE);
    renderPostseason(SEASON); updateSaveSeasonButton();
  });
  g("btnPlayQuarterfinals")?.addEventListener("click", ()=>{
    if(!SEASON.postseason) return;
    if((SEASON.postseason.quarters||[]).length===0) buildQuarterfinals(SEASON);
    playQuarterfinals(SEASON,LEAGUE);
    if(SEASON.postseason.quarters.every(m=>m.played) && (!SEASON.postseason.semis||SEASON.postseason.semis.length===0)) buildSemifinals(SEASON);
    renderPostseason(SEASON); updateSaveSeasonButton();
  });
  g("btnPlaySemifinals")?.addEventListener("click", ()=>{
    if(!SEASON.postseason) return;
    if((SEASON.postseason.semis||[]).length===0) buildSemifinals(SEASON);
    playSemifinals(SEASON,LEAGUE);
    if(SEASON.postseason.semis.every(m=>m.played) && !SEASON.postseason.championship) buildChampionship(SEASON);
    renderPostseason(SEASON); updateSaveSeasonButton();
  });
  g("btnPlayChampionship")?.addEventListener("click", ()=>{
    if(!SEASON.postseason) return;
    if(!SEASON.postseason.championship) buildChampionship(SEASON);
    playChampionship(SEASON,LEAGUE); renderPostseason(SEASON); updateSaveSeasonButton();
  });
  g("btnResetPostseason")?.addEventListener("click", ()=>{
    if(confirm("Reset postseason?")){ resetPostseason(SEASON); renderPostseason(SEASON); updateSaveSeasonButton(); }
  });

  function rewatchToPlayTab(obj){
    const home=JSON.parse(JSON.stringify(getTeam(obj.home.ci,obj.home.ti)));
    const away=JSON.parse(JSON.stringify(getTeam(obj.away.ci,obj.away.ti)));
    renderGameResultsToPlayTab(home,away,obj.details,obj.score);
  }

  window.playBowlById = (id)=>{
    const ps=SEASON.postseason; if(!ps) return;
    const b=ps.bowlsInitial.find(x=>x.id===id); if(!b) return;
    if(!b.played){
      const home=JSON.parse(JSON.stringify(getTeam(b.home.ci,b.home.ti)));
      const away=JSON.parse(JSON.stringify(getTeam(b.away.ci,b.away.ti)));
      const sim=simulateMatchByTeams(home,away);
      b.played=true; b.score=sim.score; b.details=sim.details;
      b.winner=(sim.score.home>sim.score.away?b.home:b.away);
      saveSeason(SEASON); renderPostseason(SEASON); updateSaveSeasonButton();
    }else{ rewatchToPlayTab(b); }
  };
  window.playQuarterById = (id)=>{
    const ps=SEASON.postseason; if(!ps) return;
    if(!ps.quarters||ps.quarters.length===0) buildQuarterfinals(SEASON);
    const m=ps.quarters.find(x=>x.id===id); if(!m) return;
    if(!m.played){
      const home=JSON.parse(JSON.stringify(getTeam(m.home.ci,m.home.ti)));
      const away=JSON.parse(JSON.stringify(getTeam(m.away.ci,m.away.ti)));
      const sim=simulateMatchByTeams(home,away);
      m.played=true; m.score=sim.score; m.details=sim.details;
      m.winner=(sim.score.home>sim.score.away?m.home:m.away);
      saveSeason(SEASON);
      if(ps.quarters.every(q=>q.played) && (!ps.semis||ps.semis.length===0)) buildSemifinals(SEASON);
      renderPostseason(SEASON); updateSaveSeasonButton();
    }else{ rewatchToPlayTab(m); }
  };
  window.playSemiById = (id)=>{
    const ps=SEASON.postseason; if(!ps) return;
    if(!ps.semis||ps.semis.length===0) buildSemifinals(SEASON);
    const m=ps.semis.find(x=>x.id===id); if(!m) return;
    if(!m.played){
      const home=JSON.parse(JSON.stringify(getTeam(m.home.ci,m.home.ti)));
      const away=JSON.parse(JSON.stringify(getTeam(m.away.ci,m.away.ti)));
      const sim=simulateMatchByTeams(home,away);
      m.played=true; m.score=sim.score; m.details=sim.details;
      m.winner=(sim.score.home>sim.score.away?m.home:m.away);
      saveSeason(SEASON);
      if(ps.semis.every(s=>s.played) && !ps.championship) buildChampionship(SEASON);
      renderPostseason(SEASON); updateSaveSeasonButton();
    }else{ rewatchToPlayTab(m); }
  };
  window.playChampionshipNow = ()=>{
    const ps=SEASON.postseason; if(!ps) return;
    if(!ps.championship) buildChampionship(SEASON);
    const g=ps.championship;
    if(!g.played){
      const home=JSON.parse(JSON.stringify(getTeam(g.home.ci,g.home.ti)));
      const away=JSON.parse(JSON.stringify(getTeam(g.away.ci,g.away.ti)));
      const sim=simulateMatchByTeams(home,away);
      g.played=true; g.score=sim.score; g.details=sim.details;
      g.winner=(sim.score.home>sim.score.away?g.home:g.away);
      saveSeason(SEASON); renderPostseason(SEASON); updateSaveSeasonButton();
    }else{ rewatchToPlayTab(g); }
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
  wirePlayPickers();

  // League tab setup
  setupEditorSelects();
  renderLeagueSidebar();
  clearEditorSelection();
  refreshTeamPickers();
  wireLeagueEditor();          // ⟵ added so Export/Import/Reset work

  // Season tab setup
  ensureSeason();
  renderWeekPicker(SEASON, ()=>{ renderGames(SEASON); });
  renderGames(SEASON);
  renderStandingsAll();
  renderPostseason(SEASON);
  wireSeasonButtons();
  wirePostseasonButtons();
  updateSaveSeasonButton();

  // History tab setup
  renderHistoryUI();
  wireHistoryTab();
});








