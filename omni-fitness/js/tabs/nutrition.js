let currentNutritionTab = 'today';
let isFoodModalOpen = false;
let currentMealSelection = 'breakfast';
let searchQuery = '';
let fastingTimerInterval = null;

function initNutritionState() {
  if (!state.customFoods) state.customFoods = [];
  if (!state.nutritionTargets) state.nutritionTargets = {
    goalType: 'Fat Loss',
    calorieTarget: 2200,
    protein: 160,
    carbs: 200,
    fats: 60,
    trainingDayCalories: 2600,
    trainingDayToggle: false,
    hydrationTarget: 3.5,
    fiberMinimum: 30
  };
  if (!state.waterLogs) state.waterLogs = [];
  if (!state.fastingLogs) state.fastingLogs = { active: false, start: null, logs: [] };
  if (!state.weightLogs) state.weightLogs = [];
  if (!state.mealTemplates) state.mealTemplates = [];
  save();
}

function dispatchNutriEvent() {
  document.dispatchEvent(new Event('nutritionUpdated'));
}

document.addEventListener('nutritionUpdated', () => {
    // Also re-render if we are on the page
    if (location.hash.includes('/nutrition')) renderNutritionContent();
});

function renderNutrition() {
  initNutritionState();
  
  view().innerHTML = `
    <section class="page">
      ${header("Fuel protocol","Nutrition")}
      
      <div class="nav-tabs" style="margin-bottom: 24px;">
        <button class="nav-tab ${currentNutritionTab==='today'?'active':''}" onclick="setNutritionTab('today')">Today</button>
        <button class="nav-tab ${currentNutritionTab==='targets'?'active':''}" onclick="setNutritionTab('targets')">Targets</button>
        <button class="nav-tab ${currentNutritionTab==='insights'?'active':''}" onclick="setNutritionTab('insights')">Insights</button>
        <button class="nav-tab ${currentNutritionTab==='strategy'?'active':''}" onclick="setNutritionTab('strategy')">Strategy</button>
      </div>
      
      <div id="nutrition-content" class="stack" style="gap: 20px;"></div>
      ${getFoodModalHtml()}
    </section>
  `;
  
  renderNutritionContent();
}

function setNutritionTab(tab) {
  currentNutritionTab = tab;
  renderNutrition();
}

function renderNutritionContent() {
  const panel = document.getElementById('nutrition-content');
  if (!panel) return;
  if (currentNutritionTab === 'today') panel.innerHTML = renderNutritionToday();
  else if (currentNutritionTab === 'targets') panel.innerHTML = renderNutritionTargets();
  else if (currentNutritionTab === 'insights') panel.innerHTML = renderNutritionInsights();
  else if (currentNutritionTab === 'strategy') panel.innerHTML = renderNutritionStrategy();
  
  if (currentNutritionTab === 'today') bindTodayEvents();
  if (currentNutritionTab === 'targets') bindTargetEvents();
  if (currentNutritionTab === 'insights') drawInsightsCharts();
}

// --------------------------------------------------------------------------------
// TODAY TAB
// --------------------------------------------------------------------------------

function getTodayWater() {
    const activeDate = getSelectedDate();
    const todayLogs = state.waterLogs.filter(w => w.date === activeDate);
    return todayLogs.reduce((acc, curr) => acc + curr.amount, 0); // in ml
}

function addWater(amountMl) {
    const activeDate = getSelectedDate();
    state.waterLogs.push({ id: id(), date: activeDate, amount: amountMl });
    save();
    dispatchNutriEvent();
}

window.resetWater = function() {
    const activeDate = getSelectedDate();
    state.waterLogs = state.waterLogs.filter(w => w.date !== activeDate);
    save();
    dispatchNutriEvent();
};

function deleteFoodLog(logId) {
    state.nutritionLogs = state.nutritionLogs.filter(l => l.id !== logId);
    save();
    dispatchNutriEvent();
}

function renderNutritionToday() {
  const activeDate = getSelectedDate();
  const logs = state.nutritionLogs.filter(l => l.date === activeDate);
  const t = state.nutritionTargets;
  
  // Is Training Day?
  const isTrainingDay = state.workouts.some(w => w.date === activeDate && w.status === 'completed');
  const targetCals = (isTrainingDay && t.trainingDayToggle) ? t.trainingDayCalories : t.calorieTarget;
  
  let consumedCal = 0, consumedPro = 0, consumedCarb = 0, consumedFat = 0;
  logs.forEach(l => {
      consumedCal += l.calories;
      consumedPro += l.protein;
      consumedCarb += l.carbs;
      consumedFat += l.fat;
  });
  
  const waterConsumedLiters = getTodayWater() / 1000;
  const calPct = Math.min(100, (consumedCal / targetCals) * 100);
  const proPct = Math.min(100, (consumedPro / t.protein) * 100);
  const waterPct = Math.min(100, (waterConsumedLiters / t.hydrationTarget) * 100);
  
  // Score formula
  const score = Math.round((calPct * 0.4) + (proPct * 0.4) + (waterPct * 0.2));
  
  const meals = ['breakfast', 'lunch', 'dinner', 'snacks', 'pre-workout', 'post-workout'];

  let html = `
    <!-- HERO CARD -->
    <div class="card glass bento-12" style="position:relative; overflow:hidden;">
      <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg, var(--teal) ${score}%, rgba(255,255,255,0.05) ${score}%); transition: width 0.3s ease;"></div>
      <div class="section-head" style="margin-top: 0;">
        <div>
          <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">Daily Fuel Overview</h2>
          <div class="row" style="justify-content: flex-start; gap: 12px; margin-top: 4px;">
            <h2 style="font-size: 32px; font-weight: 700; tracking: -1px;">${Math.round(consumedCal)}<span class="muted" style="font-size:16px; font-weight:500;"> / ${targetCals} kcal</span></h2>
            <span class="badge ${score >= 80 ? 'green' : 'orange'}" style="font-size: 13px; font-weight: 600;">Score: ${Math.round(score)}%</span>
          </div>
        </div>
      </div>
      
      <div class="stack" style="gap: 20px; margin-top: 20px;">
        <div>
          <div class="row" style="margin-bottom: 6px;">
            <span class="tiny muted" style="font-weight:700; letter-spacing: 0.5px;">PROTEIN</span>
            <span class="tiny text-white" style="font-weight:700">${Math.round(consumedPro)}g / ${t.protein}g</span>
          </div>
          <div style="width:100%; height:12px; background:rgba(255,255,255,0.05); border-radius:6px; overflow:hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);">
            <div style="width:${proPct}%; height:100%; background:var(--teal); border-radius:6px; transition: width 0.5s ease; box-shadow: 0 0 10px rgba(0,212,255,0.3);"></div>
          </div>
        </div>
        
        <div>
          <div class="row" style="margin-bottom: 6px;">
            <span class="tiny muted" style="font-weight:700; letter-spacing: 0.5px;">CARBS</span>
            <span class="tiny text-white" style="font-weight:700">${Math.round(consumedCarb)}g / ${t.carbs}g</span>
          </div>
          <div style="width:100%; height:12px; background:rgba(255,255,255,0.05); border-radius:6px; overflow:hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);">
            <div style="width:${Math.min(100, (consumedCarb/t.carbs)*100)}%; height:100%; background:var(--purple); border-radius:6px; transition: width 0.5s ease;"></div>
          </div>
        </div>
        
        <div>
          <div class="row" style="margin-bottom: 6px;">
            <span class="tiny muted" style="font-weight:700; letter-spacing: 0.5px;">FATS</span>
            <span class="tiny text-white" style="font-weight:700">${Math.round(consumedFat)}g / ${t.fats}g</span>
          </div>
          <div style="width:100%; height:12px; background:rgba(255,255,255,0.05); border-radius:6px; overflow:hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);">
            <div style="width:${Math.min(100, (consumedFat/t.fats)*100)}%; height:100%; background:var(--orange); border-radius:6px; transition: width 0.5s ease;"></div>
          </div>
        </div>
      </div>
      
      <div style="margin-top: 24px; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 12px;">
        <span class="tiny muted" style="font-weight:700;">REMAINING / GAP: <span style="color:var(--text); font-size: 13px; margin-left: 4px;">${Math.max(0, targetCals - consumedCal)} kcal</span> <span style="margin:0 8px; color:rgba(255,255,255,0.1)">|</span> <span style="color:var(--teal); font-size: 13px;">${Math.max(0, t.protein - consumedPro)}g Pro</span></span>
      </div>
    </div>
    
    <!-- HYDRATION ROW -->
    <div class="card glass" style="padding: 20px; display:flex; flex-direction:column; justify-content:space-between;">
      <div>
         <div class="row" style="margin-bottom: 8px;">
             <h2 style="font-size: 18px; font-weight: 600;">Hydration</h2>
             <div class="row" style="gap:12px;">
                 <span style="font-size: 12px; font-weight: 700; color: #00d4ff;">${Math.round(waterPct)}%</span>
                 <button class="btn btn-icon" style="padding:4px; height:auto; color:var(--muted); background:transparent;" onclick="resetWater()" title="Reset Hydration">
                    ${Icons.reset(20)}
                 </button>
             </div>
         </div>
         <b style="font-size: 24px; font-weight:700; color: #00d4ff;">${waterConsumedLiters.toFixed(2)}L <span class="muted" style="font-size: 13px;">/ ${t.hydrationTarget}L</span></b>
         <div style="width:100%; height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden; margin-top: 12px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);">
           <div style="width:${waterPct}%; height:100%; background:#00d4ff; border-radius:4px; transition: width 0.4s ease-out; box-shadow: 0 0 10px rgba(0,212,255,0.5);"></div>
         </div>
      </div>
      <div class="row" style="gap: 8px; margin-top: 20px;">
        <button class="btn" style="flex:1; background:rgba(0,212,255,0.1); color:#00d4ff; font-size: 13px; font-weight:600; padding:8px 4px;" onclick="addWater(150)">+150ml</button>
        <button class="btn" style="flex:1; background:rgba(0,212,255,0.1); color:#00d4ff; font-size: 13px; font-weight:600; padding:8px 4px;" onclick="addWater(250)">+250ml</button>
        <button class="btn" style="flex:1; background:rgba(0,212,255,0.1); color:#00d4ff; font-size: 13px; font-weight:600; padding:8px 4px;" onclick="addWater(500)">+500ml</button>
      </div>
    </div>

    <!-- MEAL LOGGING -->
    <div class="stack" style="gap: 16px;">
      ${meals.map(meal => {
        const mealLogs = logs.filter(l => l.mealCategory === meal);
        const mealCals = mealLogs.reduce((acc, l) => acc + l.calories, 0);
        const mealPro = mealLogs.reduce((acc, l) => acc + l.protein, 0);
        let itemsHtml = '';
        if (mealLogs.length > 0) {
           itemsHtml = '<hr style="border:0; border-top: 1px solid rgba(255,255,255,0.05); margin: 12px 0;">' + 
             mealLogs.map(l => 
                '<div class="row" style="margin-bottom: 8px; gap: 12px; align-items: center;">' +
                  '<div style="flex:1">' +
                    '<p class="small" style="font-weight: 600;">' + esc(l.foodName) + '</p>' +
                    '<p class="tiny muted">' + l.servings + ' serving(s) &middot; ' + Math.round(l.calories) + ' kcal &middot; ' + Math.round(l.protein) + 'g P</p>' +
                  '</div>' +
                  '<button class="icon-box" style="width:32px; height:32px; background:transparent; border:none; color:var(--danger); box-shadow:none; padding:4px;" onclick="deleteFoodLog(`' + l.id + '`)">' +
                    Icons.close(18) +
                  '</button>' +
                '</div>'
             ).join('');
        }
        return `
          <div class="card glass" style="padding: 20px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: inset 0 2px 10px rgba(255, 255, 255, 0.01);">
            <div class="row" style="margin-bottom: ${mealLogs.length > 0 ? '16px' : '0'};">
              <div>
                <p class="stat-label" style="text-transform: capitalize; color: var(--text); font-size: 14px; margin-bottom: 4px;">${meal.replace('-', ' ')}</p>
                <div class="row" style="justify-content: flex-start; gap: 8px;">
                  <span style="font-size: 18px; font-weight: 700;">${Math.round(mealCals)} <span class="muted" style="font-size: 12px; font-weight: 500;">kcal</span></span>
                  <span class="muted" style="font-size:12px;">|</span>
                  <span style="font-size: 14px; font-weight: 600; color: var(--teal);">${Math.round(mealPro)}g <span class="muted" style="color:var(--teal); font-size: 12px; font-weight: 500;">Pro</span></span>
                </div>
              </div>
              <button class="btn btn-teal" style="padding: 8px 18px; font-size: 13px; font-weight: 700; border-radius: 999px; box-shadow: 0 4px 12px rgba(0, 212, 255, 0.2);" onclick="openFoodModal('${meal}')">+ Add</button>
            </div>
            ${itemsHtml}
          </div>
        `;
      }).join('')}
    </div>
  `;
  return html;
}

function bindTodayEvents() {
  if (fastingTimerInterval) clearInterval(fastingTimerInterval);
}

// --------------------------------------------------------------------------------
// MODAL & FOOD LOGGING
// --------------------------------------------------------------------------------

function openFoodModal(meal) {
  currentMealSelection = meal;
  document.getElementById('addFoodModal').style.display = 'flex';
  renderFoodModalContent();
}

function closeFoodModal() {
  document.getElementById('addFoodModal').style.display = 'none';
  searchQuery = '';
}

function getFoodModalHtml() {
  return `
    <div id="addFoodModal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); z-index:100; align-items:flex-end; justify-content:center;">
      <div class="card glass" style="width:100%; max-width:600px; max-height:85vh; overflow-y:auto; border-radius: 24px 24px 0 0; padding: 24px;">
        <div class="row" style="margin-bottom: 12px;">
          <h2 style="font-size: 20px;">Add to <span style="color:var(--teal); text-transform:capitalize;" id="modalMealLabel">Breakfast</span></h2>
          <button class="icon-box" style="background:transparent;" onclick="closeFoodModal()">${Icons.close(20)}</button>
        </div>
        
        <div class="row" style="gap: 8px; margin-bottom: 20px; overflow-x: auto; white-space: nowrap; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);" id="foodModalTabs">
          <button class="b-pill active" onclick="renderFoodModalContent('search')" data-tab="search">Search</button>
          <button class="b-pill" onclick="renderFoodModalContent('custom')" data-tab="custom">Custom Entry</button>
          <button class="b-pill" onclick="renderFoodModalContent('quick')" data-tab="quick">Quick Kcal</button>
        </div>
        
        <div id="foodModalBody"></div>
      </div>
    </div>
  `;
}

function searchFoods(query) {
  searchQuery = query.toLowerCase();
  renderFoodModalContent('search');
}

function renderFoodModalContent(mode = 'search') {
  const body = document.getElementById('foodModalBody');
  if (!body) return;
  
  // Highlight active tab
  const tabs = document.querySelectorAll('#foodModalTabs .b-pill');
  tabs.forEach(t => t.classList.remove('active'));
  const activeTabBtn = document.querySelector(`#foodModalTabs .b-pill[data-tab="${mode}"]`);
  if (activeTabBtn) activeTabBtn.classList.add('active');

  const mealLabel = document.getElementById('modalMealLabel');
  if (mealLabel) mealLabel.textContent = currentMealSelection.replace('-', ' ');
  
  if (mode === 'search') {
    let combined = [...foods, ...state.customFoods];
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        combined = combined.filter(f => f.name.toLowerCase().includes(q));
    }
    
    let itemsHtml = '';
    if (combined.length > 0) {
      itemsHtml = combined.map(f => 
        '<div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; max-width: 100%;">' +
          '<div style="flex:1; min-width: 0;">' +
            '<b style="font-size: 15px; color:#fff; display:block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom:4px;">' + esc(f.name) + '</b>' +
            '<p class="tiny muted" style="margin:0; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + Math.round(f.calories) + ' kcal &middot; ' + Math.round(f.protein) + 'g P &middot; ' + Math.round(f.carbs) + 'g C &middot; ' + Math.round(f.fat) + 'g F</p>' +
          '</div>' +
          '<div class="row" style="gap: 8px; flex: 0 0 auto;">' +
            '<div class="row" style="background: rgba(0,0,0,0.3); border-radius:6px; padding:2px; height: 32px; border: 1px solid rgba(255,255,255,0.05); align-items:center;">' +
              '<span class="tiny muted" style="padding: 0 8px; font-weight:700; display: none;">SERVINGS</span>' + // Hidden on small space explicitly by default, using simple input
              '<input type="number" id="servings-' + f.id + '" class="input" style="width: 40px; height:24px; min-height: 24px; padding: 0; text-align: center; font-size:14px; background: transparent; border: none;" value="1" step="0.25" min="0.25">' +
            '</div>' +
            '<button class="btn btn-teal" style="padding: 0 16px; height: 32px; font-size: 13px; font-weight: 700; border-radius: 999px;" onclick="logFoodItem(' + f.id + ')">+ Add</button>' +
          '</div>' +
        '</div>'
      ).join('');
    } else {
      itemsHtml = '<p class="muted small text-center" style="margin-top:20px;">No foods found</p>';
    }

    body.innerHTML = `
      <input type="text" class="input" id="foodSearchInput" placeholder="Search saved foods & database..." style="margin-bottom: 20px; font-size: 16px; padding: 12px 16px;" oninput="searchFoods(this.value)" value="${searchQuery}">
      <div class="stack" style="gap: 12px; margin-bottom: 20px; max-height: 50vh; overflow-y: auto; padding-right: 4px;">
        ${itemsHtml}
      </div>
    `;
    setTimeout(() => { const i = document.getElementById('foodSearchInput'); if(i && !searchQuery) i.focus(); }, 50);

  } else if (mode === 'custom') {
    body.innerHTML = `
      <div class="stack" style="gap: 16px;">
        <div>
           <label class="stat-label" style="display:block; margin-bottom: 6px;">Food Name / Brand</label>
           <input type="text" class="input" id="cFoodName" placeholder="e.g. Greek Yogurt" style="padding: 12px;">
        </div>
        <div>
           <label class="stat-label" style="display:block; margin-bottom: 6px;">Calories (kcal) *</label>
           <input type="number" class="input" id="cFoodCals" placeholder="0" style="padding: 12px;">
        </div>
        <div class="grid grid-3">
          <div>
            <label class="stat-label" style="display:block; margin-bottom: 6px;">Protein (g)</label>
            <input type="number" class="input" id="cFoodPro" placeholder="0" style="padding: 12px;">
          </div>
          <div>
            <label class="stat-label" style="display:block; margin-bottom: 6px;">Carbs (g)</label>
            <input type="number" class="input" id="cFoodCarb" placeholder="0" style="padding: 12px;">
          </div>
          <div>
            <label class="stat-label" style="display:block; margin-bottom: 6px;">Fats (g)</label>
            <input type="number" class="input" id="cFoodFat" placeholder="0" style="padding: 12px;">
          </div>
        </div>
        <button class="btn btn-teal" style="margin-top: 10px; padding: 14px; font-size: 16px; font-weight:600;" onclick="saveCustomFood()">Save & Add to ${currentMealSelection.replace('-', ' ')}</button>
      </div>
    `;
  } else if (mode === 'quick') {
    body.innerHTML = `
      <div class="stack" style="gap: 16px;">
        <div class="card" style="background: rgba(0,212,255,0.05); border: 1px solid rgba(0,212,255,0.2); padding: 16px;">
           <p class="small" style="color: #00d4ff;">Use Quick Add when you only know the total calories of a meal but still want to track it against your daily goal.</p>
        </div>
        <div>
           <label class="stat-label" style="display:block; margin-bottom: 6px;">Total Calories (kcal) *</label>
           <input type="number" class="input" id="qCals" placeholder="e.g. 450" style="padding: 12px; font-size:18px;">
        </div>
        <div>
           <label class="stat-label" style="display:block; margin-bottom: 6px;">Estimated Protein (g) - Optional</label>
           <input type="number" class="input" id="qPro" placeholder="e.g. 20" style="padding: 12px; font-size:18px;">
        </div>
        <button class="btn btn-teal" style="margin-top: 10px; padding: 14px; font-size: 16px; font-weight:600;" onclick="quickAddLog()">Add Kcal to ${currentMealSelection.replace('-', ' ')}</button>
      </div>
    `;
  }
}

function logFoodItem(foodId) {
    const isCustom = state.customFoods.some(f => f.id === foodId);
    const fObj = isCustom ? state.customFoods.find(f => f.id === foodId) : foods.find(f => f.id === foodId);
    if (!fObj) return;
    
    const qtyEl = document.getElementById('servings-' + foodId);
    const servings = qtyEl ? (Number(qtyEl.value) || 1) : 1;
    
    state.nutritionLogs.push({
        id: id(),
        date: getSelectedDate(),
        foodId: foodId,
        foodName: fObj.name,
        mealCategory: currentMealSelection,
        servings: servings,
        calories: fObj.calories * servings,
        protein: fObj.protein * servings,
        carbs: (fObj.carbs||0) * servings,
        fat: (fObj.fat||0) * servings,
        fiber: (fObj.fiber||0) * servings
    });
    save();
    closeFoodModal();
    dispatchNutriEvent();
}

function saveCustomFood() {
    const name = document.getElementById('cFoodName').value;
    const cals = Number(document.getElementById('cFoodCals').value);
    const pro = Number(document.getElementById('cFoodPro').value);
    const carb = Number(document.getElementById('cFoodCarb').value);
    const fat = Number(document.getElementById('cFoodFat').value);
    if (!name || !cals) return toast('Name and calories required.');
    
    const newFood = {
        id: Date.now(),
        name: name,
        calories: cals,
        protein: pro||0,
        carbs: carb||0,
        fat: fat||0
    };
    state.customFoods.push(newFood);
    save();
    logFoodItem(newFood.id);
}

function quickAddLog() {
    const cals = Number(document.getElementById('qCals').value);
    const pro = Number(document.getElementById('qPro').value);
    if (!cals) return;
    state.nutritionLogs.push({
        id: id(),
        date: getSelectedDate(),
        foodId: 0,
        foodName: 'Quick Add Calories',
        mealCategory: currentMealSelection,
        servings: 1,
        calories: cals,
        protein: pro||0,
        carbs: 0,
        fat: 0,
        fiber: 0
    });
    save();
    closeFoodModal();
    dispatchNutriEvent();
}

// --------------------------------------------------------------------------------
// TARGETS TAB
// --------------------------------------------------------------------------------

function renderNutritionTargets() {
  const t = state.nutritionTargets;
  const totalMacroCals = (t.protein * 4) + (t.carbs * 4) + (t.fats * 9);
  const pPct = totalMacroCals ? Math.round(((t.protein*4)/totalMacroCals)*100) : 0;
  const cPct = totalMacroCals ? Math.round(((t.carbs*4)/totalMacroCals)*100) : 0;
  const fPct = totalMacroCals ? Math.round(((t.fats*9)/totalMacroCals)*100) : 0;

  return `
    <div class="stack" style="gap: 16px;">
      <div class="card glass" style="padding: 20px;">
        <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">Goal Strategy</h2>
        <div>
          <label class="stat-label" style="display:block; margin-bottom:10px;">Select your primary goal</label>
          <div class="breathing-pills" style="margin-top: 0; padding-bottom: 0;">
            <button class="b-pill ${t.goalType==='Fat Loss'?'active':''}" style="font-size:13px; padding:8px 14px;" onclick="updateTargetGoal('Fat Loss')">Fat Loss</button>
            <button class="b-pill ${t.goalType==='Maintenance'?'active':''}" style="font-size:13px; padding:8px 14px;" onclick="updateTargetGoal('Maintenance')">Maintenance</button>
            <button class="b-pill ${t.goalType==='Lean Gain'?'active':''}" style="font-size:13px; padding:8px 14px;" onclick="updateTargetGoal('Lean Gain')">Lean Gain</button>
            <button class="b-pill ${t.goalType==='Custom'?'active':''}" style="font-size:13px; padding:8px 14px;" onclick="updateTargetGoal('Custom')">Custom</button>
          </div>
          <!-- Hidden input to maintain compatibility with updateTargets -->
          <input type="hidden" id="t-goal" value="${t.goalType}">
        </div>
      </div>

      <div class="card glass" style="padding: 20px;">
        <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">Baseline Target</h2>
        <div>
          <label class="stat-label" style="display:block; margin-bottom:6px;">Daily Calorie Target (kcal)</label>
          <input type="number" class="input" id="t-cals" value="${t.calorieTarget}" onchange="updateTargets()">
        </div>
      </div>

      <div class="card glass" style="padding: 20px;">
        <div class="row" style="margin-bottom: 16px;">
          <h2 style="font-size: 18px; font-weight: 600;">Macro Distribution</h2>
          <span style="font-size: 13px; font-weight: 500; color: var(--soft); letter-spacing: 0.5px; background: rgba(255,255,255,0.04); padding: 4px 10px; border-radius: 8px;">${pPct}% P &middot; ${cPct}% C &middot; ${fPct}% F</span>
        </div>
        <div class="grid grid-3">
          <div>
            <label class="stat-label" style="display:block; margin-bottom:6px;">Protein (g)</label>
            <input type="number" class="input" id="t-pro" value="${t.protein}" onchange="updateTargets()">
          </div>
          <div>
            <label class="stat-label" style="display:block; margin-bottom:6px;">Carbs (g)</label>
            <input type="number" class="input" id="t-carb" value="${t.carbs}" onchange="updateTargets()">
          </div>
          <div>
            <label class="stat-label" style="display:block; margin-bottom:6px;">Fats (g)</label>
            <input type="number" class="input" id="t-fat" value="${t.fats}" onchange="updateTargets()">
          </div>
        </div>
      </div>

      <div class="card glass" style="padding: 20px;">
        <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">Advanced Targets</h2>
        <div class="row" style="cursor: pointer;" onclick="document.getElementById('t-train-toggle').click()">
          <label class="stat-label" style="margin:0; font-size: 14px; text-transform: none; color: var(--text); cursor:pointer;">Enable Training Day Calories</label>
          <label style="position: relative; width: 44px; height: 24px; cursor: pointer;" onclick="event.stopPropagation()">
            <input type="checkbox" id="t-train-toggle" ${t.trainingDayToggle?'checked':''} onchange="updateTargets()" style="opacity: 0; width: 0; height: 0; position: absolute;">
            <span style="position: absolute; inset: 0; background: ${t.trainingDayToggle ? 'var(--teal)' : 'rgba(255,255,255,0.1)'}; border-radius: 34px; transition: 0.3s; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);"></span>
            <span style="position: absolute; left: ${t.trainingDayToggle ? '22px' : '2px'}; top: 2px; height: 20px; width: 20px; background: #fff; border-radius: 50%; transition: 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></span>
          </label>
        </div>
        
        ${t.trainingDayToggle ? '<div style="margin-top:16px"><label class="stat-label" style="display:block; margin-bottom:6px;">Training Day Calorie Target (kcal)</label><input type="number" class="input" id="t-train-cals" value="' + t.trainingDayCalories + '" onchange="updateTargets()"></div>' : ''}

        <hr style="border:0; border-top: 1px solid rgba(255,255,255,0.05); margin: 20px 0;">

        <div class="grid grid-2">
          <div>
            <label class="stat-label" style="display:block; margin-bottom:6px;">Hydration Target (Liters)</label>
            <input type="number" class="input" id="t-water" value="${t.hydrationTarget}" step="0.1" onchange="updateTargets()">
          </div>
          <div>
            <label class="stat-label" style="display:block; margin-bottom:6px;">Fiber Minimum (g)</label>
            <input type="number" class="input" id="t-fiber" value="${t.fiberMinimum}" onchange="updateTargets()">
          </div>
        </div>
      </div>
    </div>
  `;
}

function updateTargetGoal(val) {
   state.nutritionTargets.goalType = val;
   save();
   dispatchNutriEvent();
}

function updateTargets() {
  const goalType = document.getElementById('t-goal').value;
  const cals = Number(document.getElementById('t-cals').value) || 2000;
  const pro = Number(document.getElementById('t-pro').value) || 150;
  const carb = Number(document.getElementById('t-carb').value) || 150;
  const fat = Number(document.getElementById('t-fat').value) || 50;
  const trainToggle = document.getElementById('t-train-toggle').checked;
  const trainCals = document.getElementById('t-train-cals') ? Number(document.getElementById('t-train-cals').value) : state.nutritionTargets.trainingDayCalories;
  const water = Number(document.getElementById('t-water').value) || 3;
  const fiber = Number(document.getElementById('t-fiber').value) || 25;

  state.nutritionTargets = {
    goalType: goalType,
    calorieTarget: cals,
    protein: pro,
    carbs: carb,
    fats: fat,
    trainingDayToggle: trainToggle,
    trainingDayCalories: trainCals,
    hydrationTarget: water,
    fiberMinimum: fiber
  };
  save();
  dispatchNutriEvent(); // Will trigger re-render of targets tab
}

function bindTargetEvents() {}

// --------------------------------------------------------------------------------
// INSIGHTS TAB
// --------------------------------------------------------------------------------

function getLast7Days() {
  const dates = [];
  const activeDate = getSelectedDate();
  const base = new Date(activeDate);
  for(let i=6; i>=0; i--) {
     const d = new Date(base);
     d.setDate(d.getDate() - i);
     dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function renderNutritionInsights() {
  const dates = getLast7Days();
  const calsPerDay = [];
  const proPerDay = [];
  
  let totalCals=0, totalPro=0, totalCarb=0, totalFat=0, daysLogged=0, totalWater=0, daysHitTarget=0;
  const t = state.nutritionTargets;
  
  dates.forEach(d => {
    const logs = state.nutritionLogs.filter(l => l.date === d);
    let c=0, p=0, ca=0, f=0;
    logs.forEach(l => { c+=l.calories; p+=l.protein; ca+=l.carbs; f+=l.fat; });
    calsPerDay.push(c);
    proPerDay.push(p);
    
    // Check hit target
    if (c >= (t.calorieTarget - 100) && c <= (t.calorieTarget + 100)) daysHitTarget++;

    const wLogs = state.waterLogs.filter(w => w.date === d);
    const dayWater = wLogs.reduce((acc, curr) => acc + curr.amount, 0);
    totalWater += dayWater;

    if(c > 0) {
      totalCals+=c; totalPro+=p; totalCarb+=ca; totalFat+=f; daysLogged++;
    }
  });
  
  const avgCals = daysLogged ? Math.round(totalCals/daysLogged) : 0;
  const avgPro = daysLogged ? Math.round(totalPro/daysLogged) : 0;
  const calAdherence = daysLogged ? Math.min(100, Math.round((avgCals / t.calorieTarget)*100)) : 0;

  return `
    <div class="card glass bento-12" style="padding: 24px;">
      <h2 style="font-size: 18px; font-weight: 600;">Last 7 Days Intel</h2>
      <div style="display:flex; flex-wrap:nowrap; align-items:center; margin-top: 20px; gap: 16px;">
        <div class="stack" style="flex:1; min-width:0; gap: 16px;">
          <div><p class="tiny muted" style="margin-bottom:4px; font-weight:600; letter-spacing:0.5px;">AVG KCAL</p><h2 style="font-size:clamp(16px, 4vw, 24px); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${avgCals} <span class="muted" style="font-size: 12px; font-weight:500;">kcal/d</span></h2></div>
          <div><p class="tiny muted" style="margin-bottom:4px; font-weight:600; letter-spacing:0.5px;">AVG PRO</p><h2 style="font-size:clamp(16px, 4vw, 24px); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${avgPro} <span class="muted" style="font-size: 12px; font-weight:500;">g/d</span></h2></div>
          <div><p class="tiny muted" style="margin-bottom:4px; font-weight:600; letter-spacing:0.5px;">AVG H2O</p><h2 style="font-size:clamp(16px, 4vw, 24px); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${(totalWater / (daysLogged||1) / 1000).toFixed(1)} <span class="muted" style="font-size: 12px; font-weight:500;">L/d</span></h2></div>
        </div>
        <div style="flex:0 0 auto; display:flex; flex-direction:column; align-items:center; justify-content:center; background: rgba(0,212,255,0.05); padding: clamp(16px, 4vw, 32px) clamp(16px, 4vw, 20px); border-radius: 20px; border: 1px solid rgba(0,212,255,0.15);">
          <div><p class="tiny muted" style="margin-bottom:8px; font-weight:700; color:#00d4ff; text-align:center; letter-spacing:1px;">ADHERE</p><h2 style="font-size:clamp(40px, 8vw, 64px); color:#00d4ff; line-height:1; text-align:center;">${calAdherence}%</h2></div>
        </div>
      </div>
    </div>
    
    <div class="card glass">
      <h2 style="font-size: 18px; font-weight: 600;">Calories Trend (Last 7 Days)</h2>
      <canvas id="calChart" style="width:100%; height:150px; margin-top:20px;"></canvas>
    </div>

    <div class="card glass">
      <h2 style="font-size: 18px; font-weight: 600;">Protein Trend (Last 7 Days)</h2>
      <canvas id="proChart" style="width:100%; height:150px; margin-top:20px;"></canvas>
    </div>
    
    <div class="card glass">
      <div class="row" style="align-items: center;">
         <h2 style="font-size: 18px; font-weight: 600;">Bodyweight Log</h2>
         <div style="display:flex; gap: 8px;">
           <input type="number" id="inlineWeightInput" placeholder="e.g. 75.5" class="input" style="width: 100px; padding: 6px 12px; font-size:14px; height: 36px; min-height: 36px; border: 1px solid rgba(255,255,255,0.1);" />
           <button class="btn btn-teal" style="padding:0 14px; height: 36px; font-weight:600; border-radius:8px;" onclick="logWeightInline()">Log</button>
         </div>
      </div>
      <canvas id="weightChart" style="width:100%; height:150px; margin-top:20px;"></canvas>
    </div>
  `;
}

function logWeightInline() {
    const input = document.getElementById('inlineWeightInput');
    if(!input) return;
    const w = input.value;
    if(w && !isNaN(Number(w))) {
        const todayStr = getSelectedDate();
        const existingIdx = state.weightLogs.findIndex(x => x.date === todayStr);
        if (existingIdx >= 0) {
            state.weightLogs[existingIdx].weight = Number(w);
        } else {
            state.weightLogs.push({ id: id(), date: todayStr, weight: Number(w) });
        }
        save();
        dispatchNutriEvent();
        input.value = ''; // clear upon success
    } else {
        toast("Please enter a valid number");
    }
}

function drawInsightsCharts() {
   const dates = getLast7Days();
   const labels = dates.map(d => {
       const dt = new Date(d);
       return dt.toLocaleDateString('en-US', { weekday: 'short' });
   });
   const calsPerDay = dates.map(d => state.nutritionLogs.filter(l=>l.date===d).reduce((a,c)=>a+c.calories, 0));
   const proPerDay = dates.map(d => state.nutritionLogs.filter(l=>l.date===d).reduce((a,c)=>a+c.protein, 0));
   const weightData = dates.map(d => {
       const w = state.weightLogs.find(x => x.date === d);
       return w ? w.weight : null;
   });

   drawCanvasChart('calChart', calsPerDay, labels, '#00d4ff', 'bar');
   drawCanvasChart('proChart', proPerDay, labels, '#b280ff', 'line');
   drawCanvasChart('weightChart', weightData, labels, '#10b981', 'line', true); // skip nulls visually
}

function drawCanvasChart(canvasId, dataArr, labels, color, type='bar', hasNulls=false) {
    const canvas = document.getElementById(canvasId);
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Pixel-perfect rendering for high-DPI screens
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, rect.width, rect.height);
    
    if(dataArr.length === 0 || dataArr.every(x => !x || x === 0)) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No data available yet', rect.width/2, rect.height/2);
        return;
    }

    let min = hasNulls ? Math.min(...dataArr.filter(x=>x)) * 0.9 : 0;
    let max = Math.max(...dataArr.filter(x=>x)) * 1.1;
    if(max === 0) max = 100;
    
    const cw = rect.width;
    const bottomPad = 24;
    const ch = rect.height - bottomPad;
    const step = cw / (dataArr.length - 1 || 1);
    const barW = Math.min(24, cw/dataArr.length - 6);
    
    // Draw faint grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, ch/2); ctx.lineTo(cw, ch/2);
    ctx.moveTo(0, ch); ctx.lineTo(cw, ch);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = color;

    let lastX = null, lastY = null;

    for(let i=0; i<dataArr.length; i++) {
       const val = dataArr[i];
       if(hasNulls && !val) continue;
       const x = (i * (cw/dataArr.length)) + (cw/dataArr.length/2);
       const range = max - min;
       const y = ch - (((val - min) / (range || 1)) * (ch * 0.85));
       
       if(type === 'bar') {
          ctx.beginPath();
          ctx.roundRect(x - barW/2, y, barW, ch-y, [6,6,0,0]);
          ctx.fill();
       } else {
          if (lastX === null) {
             ctx.moveTo(x, y);
          } else {
             ctx.lineTo(x, y);
          }
          lastX = x;
          lastY = y;
       }
    }
    
    if (type === 'line') {
      ctx.stroke();
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0; // reset
      
      // Draw points
      ctx.fillStyle = '#fff';
      for(let i=0; i<dataArr.length; i++) {
        const val = dataArr[i];
        if(hasNulls && !val) continue;
        const x = (i * (cw/dataArr.length)) + (cw/dataArr.length/2);
        const range = max - min;
        const y = ch - (((val - min) / (range || 1)) * (ch * 0.85));
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI*2);
        ctx.fill();
      }
    }

    // Draw Labels
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '600 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    for(let i=0; i<labels.length; i++) {
        const x = (i * (cw/labels.length)) + (cw/labels.length/2);
        ctx.fillText(labels[i].toUpperCase(), x, rect.height - 4);
        
        // Value labels on top of graphs
        if (dataArr[i]) {
            const range = max - min;
            const y = ch - (((dataArr[i] - min) / (range || 1)) * (ch * 0.85));
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillText(Math.round(dataArr[i]), x, y - 8);
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
        }
    }
}

// --------------------------------------------------------------------------------
// STRATEGY TAB
// --------------------------------------------------------------------------------

function renderNutritionStrategy() {
  const activeDate = getSelectedDate();
  const logs = state.nutritionLogs.filter(l => l.date === activeDate);
  const waterLogs = state.waterLogs.filter(w => w.date === activeDate);
  const t = state.nutritionTargets;
  let cals = 0, pro = 0;
  logs.forEach(l => { cals += l.calories; pro += l.protein; });
  let waterConsumedLiters = waterLogs.reduce((acc, curr) => acc + curr.amount, 0) / 1000;
  
  const calsLeft = Math.max(0, t.calorieTarget - cals);
  const proLeft = Math.max(0, t.protein - pro);
  const waterLeft = Math.max(0, t.hydrationTarget - waterConsumedLiters);
  
  let suggestion = "Log more meals to receive intelligent macro gap suggestions.";
  let suggestedFoodsHtml = '';

  if (logs.length === 0 && waterConsumedLiters === 0) {
      suggestion = "More data required for adjustments. Please start logging your meals and water today.";
  } else if (proLeft > 20 && calsLeft > 150) {
      suggestion = `We recommend a lean protein source. To hit ${Math.round(proLeft)}g protein within ${Math.round(calsLeft)} kcal, prioritize these:`;
      const matches = foods.filter(f => f.protein >= 15 && f.calories <= calsLeft).slice(0, 3);
      suggestedFoodsHtml = renderSuggestedFoods(matches);
  } else if (proLeft <= 10 && calsLeft > 300) {
      suggestion = `Protein target hit! You have ${Math.round(calsLeft)} kcal remaining. Clean carb or fat sources are completely fine to close the gap:`;
      const matches = foods.filter(f => f.protein < 10 && f.calories >= 100 && f.calories <= calsLeft).slice(0, 3);
      suggestedFoodsHtml = renderSuggestedFoods(matches);
  } else if (calsLeft === 0 && proLeft > 20) {
      suggestion = `Warning: You hit your calories but missed protein by ${Math.round(proLeft)}g. Tomorrow, prioritize protein in your first two meals.`;
  } else if (calsLeft <= 50 && proLeft <= 10 && waterLeft > 0.5) {
      suggestion = `Improve with layered intelligence: Macros are perfect, but your hydration is low. Drink ${waterLeft.toFixed(1)}L to optimize nutrient delivery and cell volumization.`;
  } else if (calsLeft <= 50 && proLeft <= 10) {
      suggestion = `Optimal Adherence! You have perfectly hit your macro and hydration goals for the day.`;
  }

  return `
    <div class="card glass">
      <div class="row" style="margin-bottom:16px;">
        <h2 style="font-size: 18px; font-weight: 600;">Intelligent Guidance</h2>
        <span class="badge" style="background:rgba(139,92,246,0.1); color:var(--purple); border-color:rgba(139,92,246,0.3);">ACTIVE</span>
      </div>
      <h2 style="font-size: 20px; line-height:1.4;">Macro Gap Assistant</h2>
      
      <div class="grid grid-2" style="margin-top: 20px; gap: 12px;">
         <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
            <p class="tiny muted" style="margin-bottom: 4px;">CALORIES REMAINING</p>
            <h3 style="font-size: 24px; color: var(--text);">${Math.round(calsLeft)}</h3>
         </div>
         <div style="background: rgba(0,212,255,0.05); padding: 16px; border-radius: 12px; border: 1px solid rgba(0,212,255,0.1);">
            <p class="tiny muted" style="margin-bottom: 4px; color: var(--teal);">PROTEIN REMAINING</p>
            <h3 style="font-size: 24px; color: var(--teal);">${Math.round(proLeft)}g</h3>
         </div>
      </div>

      <div style="background: rgba(0,212,255,0.05); border: 1px solid rgba(0,212,255,0.2); border-left: 4px solid var(--teal); padding: 16px; border-radius: 8px; margin-top: 20px;">
         <p class="small" style="line-height: 1.5;">${suggestion}</p>
      </div>

      ${suggestedFoodsHtml}
    </div>

    <div class="card glass">
      <h2 style="font-size: 18px; font-weight: 600;">System Rule-Based Engine</h2>
      <ul style="margin-top: 16px; padding-left: 18px; color: var(--muted); font-size: 14px; gap: 12px; display: flex; flex-direction: column;">
         <li>If bodyweight stagnates for 14 days and calorie adherence is >85%, the engine will recommend a 100-200 kcal adjustment.</li>
         <li>Uneven meal distribution (e.g., >60% of daily calories in dinner) triggers a digestion optimization warning.</li>
      </ul>
    </div>
  `;
}

function renderSuggestedFoods(foodList) {
    if(!foodList || foodList.length === 0) return '';
    let html = '<div class="stack" style="gap: 12px; margin-top: 16px;">';
    foodList.forEach(f => {
       html += `
         <div class="row" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 12px 16px; border-radius: 8px;">
            <div>
               <b style="font-size: 14px; display:block; margin-bottom: 4px;">${esc(f.name)}</b>
               <p class="tiny muted">${Math.round(f.calories)} kcal &middot; ${Math.round(f.protein)}g Pro</p>
            </div>
         </div>
       `;
    });
    html += '</div>';
    return html;
}
