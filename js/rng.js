export function d6(){ return 1 + Math.floor(Math.random()*6); }
export function isDash(v){ return v === "-" || v === "–" || v === "" || v == null; }
export function toRating(v){ return isDash(v) ? null : Math.max(0, Math.min(4, v|0)); }
export function fromRating(r){ return (r==null?"-":String(r)); }
export function randOf(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
export function pickWeighted(weights){
  const total = weights.reduce((a,x)=>a+x.w,0);
  let r = Math.random()*total;
  for(const x of weights){ if((r-=x.w)<=0) return x.v; }
  return weights[weights.length-1].v;
}
