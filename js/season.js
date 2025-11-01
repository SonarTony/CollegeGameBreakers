import { LS_SEASON } from "./constants.js";
import { resolveSide, finalizeScore, resolveTieByCoaches } from "./engine.js";

/** Utility keys */
function tkey(ci, ti){ return `${ci}:${ti}`; }

/** Canonical round-robin generator (no bugs, supports even/odd teams) */
export function buildRoundRobin(n){
  const teams = [...Array(n).keys()];
  if (n % 2 === 1) { teams.push(-1); } // bye with -1
  const size = teams.length;
  const rounds = size - 1;
  const half = size / 2;

  // initial ordering
  const arr = teams.slice();
  const weeks = [];
  for (let r=0; r<rounds; r++){
    const pairs = [];
    for (let i=0; i<half; i++){
      const t1 = arr[i];
      const t2 = arr[size - 1 - i];
      if (t1 !== -1 && t2 !== -1) pairs.push([t1, t2]);
    }
    weeks.push(pairs);

    // rotate all but first
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop());
    arr.splice(1, rest.length, ...rest);
    arr[0] = fixed;
  }
  return weeks; // rounds × (size/2) pairs
}

export function createStandings(league){
  const tbl = {};
  league.forEach((conf, ci)=>{
    conf.teams.forEach((t, ti)=>{
      tbl[tkey(ci,ti)] = { w:0, l:0, pf:0, pa:0 };
    });
  });
  return tbl;
}

export function createSeasonFromLeague(league){
  const standings = createStandings(league);
  const weeks = [];

  // per-conference round-robins
  const perConfWeeks = league.map((conf,ci)=>{
    const rr = buildRoundRobin(conf.teams.length); // 12 -> 11 rounds, each 6 games
    // Alternate home/away by round for balance
    return rr.map((pairs, rIdx)=> pairs.map(([i,j], k)=>({
      confIndex: ci,
      home: {ci, ti: (rIdx % 2 === 0 ? i : j)},
      away: {ci, ti: (rIdx % 2 === 0 ? j : i)},
      played: false,
      score: null
    })));
  });

  const rounds = perConfWeeks[0].length; // 11 rounds
  for(let r=0; r<rounds; r++){
    const games = [];
    perConfWeeks.forEach(confWeeks=>{ games.push(...confWeeks[r]); });
    weeks.push({ week: r+1, games });
  }
  return { weeks, standings, currentWeek: 1 };
}

export function loadSeason(){ const raw = localStorage.getItem(LS_SEASON); return raw ? JSON.parse(raw) : null; }
export function saveSeason(s){ localStorage.setItem(LS_SEASON, JSON.stringify(s)); }

export function simulateMatchByTeams(homeTeam, awayTeam){
  const h = resolveSide(homeTeam);
  const a = resolveSide(awayTeam);
  const hf = finalizeScore(h, a);
  const af = finalizeScore(a, h);

  let homeScore = hf.final;
  let awayScore = af.final;

  if (homeScore === awayScore){
    const t = resolveTieByCoaches(homeTeam, awayTeam, homeScore, awayScore);
    homeScore = t.home; awayScore = t.away;
  }

  return {
    score: { home: homeScore, away: awayScore },
    details: { h, a, hf, af }
  };
}
