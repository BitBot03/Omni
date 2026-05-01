function shell(){
  const path=currentPath();
  const activeDate = getSelectedDate();
  const formattedDate = new Date(activeDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  
  document.getElementById("app").innerHTML=`
    <div class="app-shell">
      <aside class="sidebar">
        <button class="logo" data-go="/"><span>O</span><small>OMNI</small></button>
        <nav class="nav">${navItems.map(n=>navButton(n,path)).join("")}</nav>
        <div class="nav-bottom">
          <div class="date-selector-v2">
            <input type="date" id="shellDateInput" value="${activeDate}" class="hidden-date-input">
            <button class="nav-btn date-trigger" onclick="document.getElementById('shellDateInput').showPicker()">
              <span class="nav-icon">${icons.calendar}</span>
              <span class="nav-text">${formattedDate}</span>
            </button>
          </div>
          ${navButton({path:"/settings",label:"Settings",icon:icons.settings},path)}
        </div>
      </aside>
      <main class="main">
        <div id="view"></div>
      </main>
      <nav class="mobile-nav">
        ${navItems.map(n=>navButton(n,path)).join("")}
        <div class="mobile-date-trigger">
          <input type="date" id="mobileDateInput" value="${activeDate}" class="hidden-date-input">
          <button class="nav-btn" onclick="document.getElementById('mobileDateInput').showPicker()">
            <span class="nav-icon">${icons.calendar}</span>
          </button>
        </div>
      </nav>
      ${path!=="/ai"?'<button class="fab" data-go="/ai">'+icons.ai+'<span>Coach</span></button>':""}
    </div>
  `;
  
  const dateHandler = (e) => setSelectedDate(e.target.value);
  document.getElementById("shellDateInput")?.addEventListener("change", dateHandler);
  document.getElementById("mobileDateInput")?.addEventListener("change", dateHandler);
  
  document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));
  renderView(path)
}

function navButton(n,path){
  const active=path===n.path||(n.path!=="/"&&path.startsWith(n.path));
  return `<button class="nav-btn ${active?"active":""}" data-go="${n.path}" title="${n.label}">
            <span class="nav-icon">${n.icon}</span><span class="nav-text">${n.label}</span><span class="nav-tip">${n.label}</span>
          </button>`;
}

function renderView(path){
  cleanup();
  cleanup=()=>{};
  if(path.startsWith("/workouts"))return renderWorkouts();
  if(path==="/nutrition")return renderNutrition();
  if(path==="/recovery")return renderRecovery();
  if(path==="/analytics")return renderAnalytics();
  if(path==="/ai")return renderAI();
  if(path==="/settings")return renderSettings();
  return renderDashboard()
}

window.addEventListener("hashchange",shell);
shell();
