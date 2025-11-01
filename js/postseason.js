// js/postseason.js
// Uses your exact shapes and helpers. Only change: after a round is played,
// we auto-build the next round if all winners are present, so the next stage
// appears immediately on re-render (no need to click the previous simulate again).

import { simulateMatchByTeams } from "./season.js";
import { LS_SEASON } from "./constants.js";
import { getTeam } from "./ui_league.js";

export const BOWL_NAMES = {
  1:"Rose Bowl",2:"Orange Bowl",3:"Sugar Bowl",4:"Cotton Bowl",
  5:"Fiesta Bowl",6:"Peach Bowl",7:"Citrus Bowl",8:"Alamo Bowl",
  9:"Holiday Bowl",10:"Gator Bowl",11:"Sun Bowl",12:"Liberty Bowl"
};

function rankConference(LEAGUE, SEASON, ci){
  const conf = LEAGUE[ci];
  const arr = conf.teams.map((t, ti)=>{
    const rec = SEASON.standings[`${ci}:${ti}`];
    return { ti, w:rec.w, pf:rec.pf, pa:rec.pa, diff: rec.pf - rec.pa, name:t.name };
  });
  arr.sort((a,b)=> (b.w - a.w) || (b.diff - a.diff) || (b.pf - a.pf) || a.name.localeCompare(b.name));
  return arr.map(x=>x.ti);
}

function seedInitialBowls(LEAGUE, SEASON){
  const A=0,P=1,H=2,S=3,M=4,N=5;
  const rA=rankConference(LEAGUE,SEASON,A), rP=rankConference(LEAGUE,SEASON,P);
  const rH=rankConference(LEAGUE,SEASON,H), rS=rankConference(LEAGUE,SEASON,S);
  const rM=rankConference(LEAGUE,SEASON,M), rN=rankConference(LEAGUE,SEASON,N);
  const bowls = [
    {id:1, name:BOWL_NAMES[1], playoff:true,  round:"Play-in", home:{ci:A,ti:rA[0]}, away:{ci:M,ti:rM[1]}},
    {id:2, name:BOWL_NAMES[2], playoff:true,  round:"Play-in", home:{ci:P,ti:rP[0]}, away:{ci:N,ti:rN[1]}},
    {id:3, name:BOWL_NAMES[3], playoff:true,  round:"Play-in", home:{ci:S,ti:rS[0]}, away:{ci:A,ti:rA[2]}},
    {id:4, name:BOWL_NAMES[4], playoff:true,  round:"Play-in", home:{ci:H,ti:rH[0]}, away:{ci:P,ti:rP[2]}},
    {id:5, name:BOWL_NAMES[5], playoff:true,  round:"Play-in", home:{ci:P,ti:rP[1]}, away:{ci:M,ti:rM[0]}},
    {id:6, name:BOWL_NAMES[6], playoff:true,  round:"Play-in", home:{ci:A,ti:rA[1]}, away:{ci:N,ti:rN[0]}},
    {id:7, name:BOWL_NAMES[7], playoff:true,  round:"Play-in", home:{ci:S,ti:rS[1]}, away:{ci:H,ti:rH[2]}},
    {id:8, name:BOWL_NAMES[8], playoff:true,  round:"Play-in", home:{ci:H,ti:rH[1]}, away:{ci:S,ti:rS[2]}},
    {id:9,  name:BOWL_NAMES[9],  playoff:false, round:"Bowl",    home:{ci:A,ti:rA[3]}, away:{ci:M,ti:rM[2]}},
    {id:10, name:BOWL_NAMES[10], playoff:false, round:"Bowl",    home:{ci:P,ti:rP[3]}, away:{ci:N,ti:rN[2]}},
    {id:11, name:BOWL_NAMES[11], playoff:false, round:"Bowl",    home:{ci:H,ti:rH[3]}, away:{ci:S,ti:rS[3]}},
    {id:12, name:BOWL_NAMES[12], playoff:false, round:"Bowl",    home:{ci:A,ti:rA[4]}, away:{ci:P,ti:rP[4]}}
  ];
  bowls.forEach(b=>{ b.played=false; b.score=null; b.details=null; b.winner=null; });
  return bowls;
}

export function generatePostseason(LEAGUE, SEASON){
  const postseason = {
    bowlsInitial: seedInitialBowls(LEAGUE, SEASON),
    quarters: [], semis: [], championship: null
  };
  SEASON.postseason = postseason;
  savePostseason(SEASON);
  return postseason;
}

function cloneRef(x){ return JSON.parse(JSON.stringify(x)); }
function playPair(homeRef, awayRef, LEAGUE){
  const home = JSON.parse(JSON.stringify(getTeam(homeRef.ci, homeRef.ti)));
  const away = JSON.parse(JSON.stringify(getTeam(awayRef.ci, awayRef.ti)));
  const sim = simulateMatchByTeams(home, away);
  const winner = (sim.score.home > sim.score.away) ? homeRef : awayRef;
  return { score:sim.score, details:sim.details, winner };
}

// ---------- Auto-advance helpers (non-invasive) ----------
function allWinnersPresent(arr) {
  return Array.isArray(arr) && arr.length > 0 && arr.every(x => x && x.winner);
}

function ensureQuartersIfReady(SEASON){
  const ps = SEASON.postseason; if(!ps) return;
  // Already built
  if (ps.quarters && ps.quarters.length) return;
  // Need winners from bowls 1..8
  const winners = [];
  for(let i=1;i<=8;i++){
    const b = ps.bowlsInitial && ps.bowlsInitial.find(x=>x.id===i);
    if(!b || !b.winner) return; // not ready
    winners.push(b.winner);
  }
  // Build using your exact mapping
  ps.quarters = [
    { id:"Q1", round:"Quarterfinal", home:cloneRef(winners[0]), away:cloneRef(winners[7]), played:false, score:null, details:null, winner:null },
    { id:"Q2", round:"Quarterfinal", home:cloneRef(winners[1]), away:cloneRef(winners[6]), played:false, score:null, details:null, winner:null },
    { id:"Q3", round:"Quarterfinal", home:cloneRef(winners[2]), away:cloneRef(winners[5]), played:false, score:null, details:null, winner:null },
    { id:"Q4", round:"Quarterfinal", home:cloneRef(winners[3]), away:cloneRef(winners[4]), played:false, score:null, details:null, winner:null }
  ];
}

function ensureSemisIfReady(SEASON){
  const ps = SEASON.postseason; if(!ps) return;
  if (ps.semis && ps.semis.length) return;
  if (!ps.quarters || ps.quarters.length !== 4) return;
  if (ps.quarters.some(m=>!m.winner)) return;
  const w = ps.quarters.map(m=>m.winner);
  ps.semis = [
    { id:"S1", round:"Semifinal", home:cloneRef(w[0]), away:cloneRef(w[3]), played:false, score:null, details:null, winner:null },
    { id:"S2", round:"Semifinal", home:cloneRef(w[1]), away:cloneRef(w[2]), played:false, score:null, details:null, winner:null }
  ];
}

function ensureChampionshipIfReady(SEASON){
  const ps = SEASON.postseason; if(!ps) return;
  if (ps.championship) return;
  if (!ps.semis || ps.semis.length !== 2) return;
  if (ps.semis.some(m=>!m.winner)) return;
  const [w1,w2] = ps.semis.map(m=>m.winner);
  ps.championship = { id:"NCG", round:"National Championship", name:"College Football Championship",
    home:cloneRef(w1), away:cloneRef(w2), played:false, score:null, details:null, winner:null };
}

function autoAdvance(SEASON){
  // Build each next round if all prior winners exist
  ensureQuartersIfReady(SEASON);
  ensureSemisIfReady(SEASON);
  ensureChampionshipIfReady(SEASON);
  savePostseason(SEASON); // persist after any build
}

// ---------- Public simulate & build functions (original names retained) ----------

export function playUnplayedBowls(SEASON, LEAGUE){
  const ps = SEASON.postseason; if(!ps) return;
  ps.bowlsInitial.forEach(b=>{
    if(!b.played){
      const res = playPair(b.home, b.away, LEAGUE);
      b.played = true; b.score = res.score; b.details = res.details; b.winner = res.winner;
    }
  });
  // NEW: auto-build Quarters now that winners exist
  autoAdvance(SEASON);
}

export function buildQuarterfinals(SEASON){
  // Keep your original build (idempotent with autoAdvance)
  const ps = SEASON.postseason; if(!ps) return;
  const winners = [];
  for(let i=1;i<=8;i++){ const b = ps.bowlsInitial.find(x=>x.id===i); if(!b || !b.winner) return; winners.push(b.winner); }
  ps.quarters = [
    { id:"Q1", round:"Quarterfinal", home:cloneRef(winners[0]), away:cloneRef(winners[7]), played:false, score:null, details:null, winner:null },
    { id:"Q2", round:"Quarterfinal", home:cloneRef(winners[1]), away:cloneRef(winners[6]), played:false, score:null, details:null, winner:null },
    { id:"Q3", round:"Quarterfinal", home:cloneRef(winners[2]), away:cloneRef(winners[5]), played:false, score:null, details:null, winner:null },
    { id:"Q4", round:"Quarterfinal", home:cloneRef(winners[3]), away:cloneRef(winners[4]), played:false, score:null, details:null, winner:null }
  ];
  savePostseason(SEASON);
}

export function playQuarterfinals(SEASON, LEAGUE){
  const ps = SEASON.postseason; if(!ps) return;
  ps.quarters.forEach(m=>{
    if(!m.played){
      const res = playPair(m.home, m.away, LEAGUE);
      m.played = true; m.score = res.score; m.details = res.details; m.winner = res.winner;
    }
  });
  // NEW: auto-build Semis now that QF winners exist
  autoAdvance(SEASON);
}

export function buildSemifinals(SEASON){
  // Keep original build
  const ps = SEASON.postseason; if(!ps) return;
  if(ps.quarters.some(m=>!m.winner)) return;
  const w = ps.quarters.map(m=>m.winner);
  ps.semis = [
    { id:"S1", round:"Semifinal", home:cloneRef(w[0]), away:cloneRef(w[3]), played:false, score:null, details:null, winner:null },
    { id:"S2", round:"Semifinal", home:cloneRef(w[1]), away:cloneRef(w[2]), played:false, score:null, details:null, winner:null }
  ];
  savePostseason(SEASON);
}

export function playSemifinals(SEASON, LEAGUE){
  const ps = SEASON.postseason; if(!ps) return;
  ps.semis.forEach(m=>{
    if(!m.played){
      const res = playPair(m.home, m.away, LEAGUE);
      m.played = true; m.score = res.score; m.details = res.details; m.winner = res.winner;
    }
  });
  // NEW: auto-build Championship now that SF winners exist
  autoAdvance(SEASON);
}

export function buildChampionship(SEASON){
  // Keep original build
  const ps = SEASON.postseason; if(!ps) return;
  if(ps.semis.some(m=>!m.winner)) return;
  const [w1,w2] = ps.semis.map(m=>m.winner);
  ps.championship = { id:"NCG", round:"National Championship", name:"College Football Championship",
    home:cloneRef(w1), away:cloneRef(w2), played:false, score:null, details:null, winner:null };
  savePostseason(SEASON);
}

export function playChampionship(SEASON, LEAGUE){
  const ps = SEASON.postseason; if(!ps || !ps.championship) return;
  const g = ps.championship;
  if(!g.played){
    const res = playPair(g.home, g.away, LEAGUE);
    g.played = true; g.score = res.score; g.details = res.details; g.winner = res.winner;
    savePostseason(SEASON);
  }
}

export function resetPostseason(SEASON){
  if(SEASON){ SEASON.postseason = null; savePostseason(SEASON); }
}

function savePostseason(SEASON){
  const raw = localStorage.getItem(LS_SEASON);
  let s = SEASON;
  if(raw){ try{ s = JSON.parse(raw); }catch(e){ s = SEASON; } }
  s.postseason = SEASON.postseason;
  localStorage.setItem(LS_SEASON, JSON.stringify(s));
}
