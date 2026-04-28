function id(){return (crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now())}
function dateISO(offset=0){const d=new Date();d.setDate(d.getDate()+offset);return d.toISOString().slice(0,10)}
function getSelectedDate() {
  try {
    return state.selectedDate || dateISO();
  } catch (e) {
    return dateISO();
  }
}
function makeWorkout(name,daysAgo,totalVolume,totalSets){
  const date = daysAgo === 0 ? getSelectedDate() : dateISO(-daysAgo);
  return{id:id(),name,startedAt:date + 'T' + new Date().toISOString().split('T')[1],totalVolume,totalSets,sets:[]}
}
function makeFoodLog(foodId,mealCategory,servings){const f=foods.find(x=>x.id===foodId);return{id:id(),foodId,foodName:f.name,date:getSelectedDate(),mealCategory,servings,calories:Math.round(f.calories*servings),protein:Math.round(f.protein*servings),carbs:Math.round(f.carbs*servings),fat:Math.round(f.fat*servings)}}

const defaultState={
  settings:{displayName:"Athlete",height:180,weight:82,age:28,apiKey:"",model:"gpt-4o",trainingCalories:2800,restCalories:2200,proteinGoal:180,carbsGoal:300,fatGoal:80,fiberGoal:35},
  workoutSettings:{units:"lbs",defaultRest:120,autoProgression:true,warmupSets:true,rpeTracking:true,tempoTracking:true,plateCalculator:true,sessionTheme:"Pro Glass",densityMode:"Comfort",soundCues:false},
  exerciseGuides:{},
  routines:[
    {id:id(),name:"Push Strength",description:"Chest, shoulders, triceps",exercises:["Bench Press","Overhead Press","Incline Dumbbell Press"]},
    {id:id(),name:"Pull Hypertrophy",description:"Back and biceps volume",exercises:["Pull Up","Barbell Row","Lat Pulldown"]},
    {id:id(),name:"Leg Power",description:"Squat and posterior chain",exercises:["Squat","Romanian Deadlift","Leg Press"]}
  ],
  workouts:[
    makeWorkout("Push Session",0,28450,18),makeWorkout("Lower Strength",2,32600,20),makeWorkout("Pull Volume",4,24750,17),makeWorkout("Upper Pump",6,19600,14)
  ],
  nutritionLogs:[
    makeFoodLog(3,"breakfast",1),makeFoodLog(7,"breakfast",1),makeFoodLog(1,"lunch",1.5),makeFoodLog(2,"lunch",1),makeFoodLog(8,"snack",1),makeFoodLog(6,"dinner",1)
  ],
  habits:[
    {id:id(),name:"Protein target",targetValue:180,unit:"g"},
    {id:id(),name:"Water intake",targetValue:3,unit:"L"},
    {id:id(),name:"Mobility",targetValue:10,unit:"min"},
    {id:id(),name:"Sleep window",targetValue:8,unit:"hrs"}
  ],
  habitLogs:[],
  aiMessages:[{role:"assistant",content:"I'm OMNI — your AI performance coach. I can use your local workouts, nutrition, recovery metrics, and habits. What should we optimize today?"}],
  activeWorkout:null
};

function loadState(){try{const saved=JSON.parse(localStorage.getItem(STORE_KEY)||"null");return saved?merge(defaultState,saved):structuredClone(defaultState)}catch{return structuredClone(defaultState)}}
function merge(base,saved){return {...structuredClone(base),...saved,settings:{...base.settings,...(saved.settings||{})}}}
function save(){localStorage.setItem(STORE_KEY,JSON.stringify(state))}

let state=loadState();
state.selectedDate = state.selectedDate || dateISO(); // Default to today

function setSelectedDate(date) {
  state.selectedDate = date;
  save();
  shell(); // Trigger re-render of the shell and view
}

let cleanup=()=>{};

function todayLogs(){return state.nutritionLogs.filter(l=>l.date===getSelectedDate())}
function weeklyVolume(){return Array.from({length:7},(_,i)=>{const offset=i-6;const d=dateISO(offset);const volume=state.workouts.filter(w=>w.startedAt.slice(0,10)===d).reduce((s,w)=>s+(w.totalVolume||0),0);return{date:d,volume}})}
function workoutStreak(){let streak=0;for(let i=0;i<365;i++){const d=dateISO(-i);const has=state.workouts.some(w=>w.startedAt.slice(0,10)===d);if(has)streak++;else if(i>0)break}return streak}
function habitRate(){const total=Math.max(1,state.habits.length*30);let done=0;for(let i=0;i<30;i++){const d=dateISO(-i);done+=state.habitLogs.filter(l=>l.date===d&&l.completed).length}return Math.min(1,done/total||.85)}

function summary(){const logs=todayLogs();const calories=logs.reduce((s,l)=>s+l.calories,0);const protein=logs.reduce((s,l)=>s+l.protein,0);const completed=state.habitLogs.filter(l=>l.date===getSelectedDate()&&l.completed).length;const volumes=weeklyVolume();const sleep=7.5;const readiness=Math.min(99,Math.round((sleep/9)*40+82*.3+Math.min(state.workouts.length,7)*4));return{todayCalories:calories,todayProtein:protein,calorieGoal:state.settings.trainingCalories,currentStreak:workoutStreak(),readinessScore:readiness,habitConsistency:habitRate(),habitsCompletedToday:completed,totalHabits:state.habits.length,weeklyVolume:volumes}}
