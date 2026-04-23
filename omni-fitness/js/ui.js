const navItems=[
  {path:"/",label:"Dashboard",icon:icons.dashboard},
  {path:"/workouts",label:"Workouts",icon:icons.workouts},
  {path:"/nutrition",label:"Nutrition",icon:icons.nutrition},
  {path:"/recovery",label:"Recovery",icon:icons.recovery},
  {path:"/analytics",label:"Analytics",icon:icons.analytics},
  {path:"/ai",label:"AI Coach",icon:icons.ai}
];

function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]))}
function money(n){return Math.round(n||0).toLocaleString()}
function currentPath(){const h=location.hash.replace(/^#/,"");return h||"/"}
function go(path){location.hash=path}
function view(){return document.getElementById("view")}
function toast(msg){const t=document.createElement("div");t.className="toast";t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2600)}

function flexHtml(content) { return content; } // just for standard formatting
function header(eyebrow,title,right=""){return`<header class="page-header"><div><p class="eyebrow">${eyebrow}</p><h1 class="display">${title}</h1></div>${right}</header>`}
function barChart(data){const max=Math.max(...data.map(d=>d.volume),1);const labels=["MON","TUE","WED","THU","FRI","SAT","SUN"];const today=(new Date().getDay()+6)%7;return`<div class="bar-chart">${data.map((d,i)=>`<div class="bar-wrap"><div class="bar ${i===today?"today":""}" title="${money(d.volume)} lbs" style="height:${Math.max(4,d.volume/max*100)}%"></div><div class="bar-label">${labels[i]}</div></div>`).join("")}</div>`}
function muscleBars(items){return`<div class="stack">${items.map(x=>`<div><div class="row"><span class="stat-label">${x.label}</span><strong style="color:${x.color}">${x.pct}%</strong></div><div class="progress mini-progress"><span style="--w:${x.pct}%;background:${x.color};color:${x.color}"></span></div></div>`).join("")}</div>`}
function habitDots(rate){const filled=Math.round(50*rate);return`<div class="habit-grid">${Array.from({length:50},(_,i)=>`<span class="dot ${i<filled?"on":""}"></span>`).join("")}</div>`}
function muscleSvg(){return`<svg class="muscle-svg" viewBox="0 0 120 220" fill="none"><ellipse cx="60" cy="22" rx="14" ry="17" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.15)"/><rect x="53" y="37" width="14" height="10" rx="3" fill="rgba(255,255,255,.07)"/><path d="M35 47 Q30 55 30 75 L30 120 Q30 130 45 132 L75 132 Q90 130 90 120 L90 75 Q90 55 85 47 Z" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.12)"/><ellipse cx="48" cy="65" rx="14" ry="10" fill="rgba(255,120,0,.55)" filter="blur(5px)"/><ellipse cx="72" cy="65" rx="14" ry="10" fill="rgba(255,120,0,.55)" filter="blur(5px)"/><ellipse cx="31" cy="55" rx="9" ry="8" fill="rgba(255,120,0,.5)" filter="blur(4px)"/><ellipse cx="89" cy="55" rx="9" ry="8" fill="rgba(255,120,0,.5)" filter="blur(4px)"/><path d="M24 62 Q16 72 14 95 Q18 102 22 95 Q26 72 32 65 Z" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.1)"/><path d="M96 62 Q104 72 106 95 Q102 102 98 95 Q94 72 88 65 Z" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.1)"/><path d="M38 130 Q38 145 60 148 Q82 145 82 130 Z" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.1)"/><rect x="36" y="148" width="20" height="40" rx="8" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.1)"/><rect x="64" y="148" width="20" height="40" rx="8" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.1)"/><rect x="38" y="192" width="16" height="26" rx="7" fill="rgba(255,255,255,.04)"/><rect x="66" y="192" width="16" height="26" rx="7" fill="rgba(255,255,255,.04)"/>${[80,92,104].map(y=>`<rect x="50" y="${y}" width="8" height="8" rx="2" fill="rgba(255,255,255,.08)"/><rect x="62" y="${y}" width="8" height="8" rx="2" fill="rgba(255,255,255,.08)"/>`).join("")}</svg>`}

function field(label,key,value,type){return`<div class="field"><label class="stat-label">${label}</label><input class="input setting" data-key="${key}" type="${type}" value="${esc(value)}"></div>`}

window.toggleAccordion = (el, id) => {
  const anyRunning = Object.values(window.activeSessions || {}).some(s => !s.paused);
  const thisRunning = id && window.activeSessions && window.activeSessions[id] && !window.activeSessions[id].paused;

  if (anyRunning && !thisRunning) return; // Prevent opening another if a session is running
  if (thisRunning) return; // Prevent closing if this session is running

  const wasOpen = el.classList.contains('open');
  document.querySelectorAll('.expanding-item').forEach(i => i.classList.remove('open'));
  if (!wasOpen) el.classList.add('open');
};
