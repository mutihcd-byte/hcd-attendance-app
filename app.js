/* =========================
   MINI HRIS DIRECT PWA APP
========================= */

let trainingsCached = false;
let employeesCached = false;

let activeTraining = null;
let activeEmployee = null;

let trainings = [];
let employees = [];

/*
  IMPORTANT:
  This must be your MINI HRIS deployed /exec URL.
  If this URL is Mini HRIS, the PWA will no longer append directly to the kiosk sheet.
*/
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzhvXobopivkX90wiTbbQ4I5RnzAL--EpMLzyocWDBh2LXcEoSfs9VHLt-uqU7ghF16/exec";


/* =========================
   SMALL HELPERS
========================= */

function cleanValue(value){
  if(value === null || value === undefined) return "";
  return String(value).trim();
}

function cleanUpper(value){
  return cleanValue(value).toUpperCase();
}

function safeJsonParse(text, fallback){
  try {
    return JSON.parse(text);
  } catch(err){
    console.error("JSON parse failed:", err, text);
    return fallback;
  }
}

function normalizeListResponse(json, key){
  if(Array.isArray(json)) return json;
  if(json && Array.isArray(json[key])) return json[key];
  return [];
}

function formatTrainingDate(dateValue){
  if(!dateValue) return "";

  const parsed = new Date(dateValue);

  if(isNaN(parsed.getTime())){
    return cleanValue(dateValue);
  }

  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric"
  });
}

function getAttendanceLogs(){
  try {
    return JSON.parse(localStorage.getItem("attendanceLogs") || "[]");
  } catch(err){
    return [];
  }
}

function saveAttendanceLogs(logs){
  localStorage.setItem("attendanceLogs", JSON.stringify(logs || []));
}


/* =========================
   LOAD TRAININGS + EMPLOYEES
========================= */

async function loadData(){

  console.log("LOAD DATA STARTED");
  console.log("API URL:", GOOGLE_SCRIPT_URL);

  try {

    // =========================
    // TRAININGS
    // =========================
    console.log("STEP 1: FETCH TRAININGS");

    const trainRes = await fetch(
      GOOGLE_SCRIPT_URL + "?action=trainings&cacheBust=" + Date.now()
    );

    console.log("STEP 2: TRAININGS STATUS =", trainRes.status);

    const trainText = await trainRes.text();

    console.log("STEP 3: TRAININGS RAW =", trainText);

    const trainJson = safeJsonParse(trainText, []);
    trainings = normalizeListResponse(trainJson, "trainings");

    localStorage.setItem("cachedTrainings", JSON.stringify(trainings));
    trainingsCached = true;
    updateCacheStatus();

    console.log("STEP 4: TRAININGS PARSED =", trainings);


    // =========================
    // EMPLOYEES
    // =========================
    console.log("STEP 5: FETCH EMPLOYEES");

    const empRes = await fetch(
      GOOGLE_SCRIPT_URL + "?action=employees&cacheBust=" + Date.now()
    );

    console.log("STEP 6: EMP STATUS =", empRes.status);

    const empText = await empRes.text();

    console.log("STEP 7: EMP RAW =", empText);

    const empJson = safeJsonParse(empText, []);
    employees = normalizeListResponse(empJson, "employees");

    localStorage.setItem("cachedEmployees", JSON.stringify(employees));
    employeesCached = true;
    updateCacheStatus();

    console.log("STEP 8: EMP PARSED =", employees);

  } catch(err){

    console.error("LOAD DATA FAILED:", err);

    trainings = safeJsonParse(
      localStorage.getItem("cachedTrainings") || "[]",
      []
    );

    employees = safeJsonParse(
      localStorage.getItem("cachedEmployees") || "[]",
      []
    );

    trainingsCached = trainings.length > 0;
    employeesCached = employees.length > 0;

    updateCacheStatus();

    const trainingMsg = document.getElementById("trainingMsg");
    if(trainingMsg){
      trainingMsg.innerText = "Offline mode";
    }

    console.log("USING OFFLINE CACHE");
  }

  console.log("DATA LOADED SUCCESSFULLY");
}


/* =========================
   TRAINING VALIDATION
========================= */

function validateTraining(){

  const input = document.getElementById("trainingId");
  const msg = document.getElementById("trainingMsg");

  if(!input || !msg) return;

  if(!trainings || trainings.length === 0){
    msg.innerText = "Loading training data... please wait";
    return;
  }

  const trainingId = cleanUpper(input.value);

  if(!trainingId){
    msg.innerText = "Enter Training ID";
    return;
  }

  msg.innerText = "Validating...";

  const found = trainings.find(t =>
    cleanUpper(t.id || t.trainingId || t.trainingCode || t.code) === trainingId
  );

  if(found){

    activeTraining = {
      id: cleanValue(found.id || found.trainingId || found.trainingCode || found.code),
      title: cleanValue(found.title || found.trainingTitle || found.trainingName || found.name),
      date: cleanValue(found.date || found.trainingDate || found.schedule),
      manhours: Number(found.manhours || found.manHours || found.tmh || 0)
    };

    msg.innerText = "Training Validated ✔";

    const formattedDate = formatTrainingDate(activeTraining.date);

    const trainingTitleDisplay = document.getElementById("trainingTitleDisplay");

    if(trainingTitleDisplay){
      trainingTitleDisplay.innerHTML =
        activeTraining.title +
        (formattedDate
          ? ' <span class="trainingDate">- ' + formattedDate + '</span>'
          : "");
    }

    const trainingSection = document.getElementById("trainingSection");
    const employeeSection = document.getElementById("employeeSection");

    if(trainingSection) trainingSection.style.display = "none";
    if(employeeSection) employeeSection.style.display = "block";

  } else {

    activeTraining = null;
    msg.innerText = "Training not found";
  }
}


/* =========================
   EMPLOYEE VALIDATION
========================= */

function validateEmployee(){

  const input = document.getElementById("empId");
  const msg = document.getElementById("employeeMsg");

  if(!input || !msg) return;

  const empId = cleanUpper(input.value);

  if(!empId){
    msg.innerText = "Enter Employee ID";
    return;
  }

  msg.innerText = "Searching...";

  const found = employees.find(e =>
    cleanUpper(e.id || e.employeeId || e.empId) === empId
  );

  if(found){

    activeEmployee = {
      id: cleanValue(found.id || found.employeeId || found.empId),
      name: cleanValue(found.name || found.fullName || found.fullname || found.employeeName),
      department: cleanValue(found.department || found.branch || found.company || found.depBranch),
      position: cleanValue(found.position || found.jobTitle),
      buBranch: cleanValue(found.buBranch || found.branch || found.businessUnit || found.department)
    };

    const employeeCard = document.getElementById("employeeCard");
    const submitBtn = document.getElementById("submitBtn");

    if(employeeCard) employeeCard.style.display = "block";
    if(submitBtn) submitBtn.style.display = "block";

    const empName = document.getElementById("empName");
    const empDept = document.getElementById("empDept");
    const empPos = document.getElementById("empPos");

    if(empName) empName.innerText = activeEmployee.name;
    if(empDept) empDept.innerText = activeEmployee.department;
    if(empPos) empPos.innerText = activeEmployee.position;

    msg.innerText = "";

  } else {

    msg.innerText = "Employee not found";

    const employeeCard = document.getElementById("employeeCard");
    const submitBtn = document.getElementById("submitBtn");

    if(employeeCard) employeeCard.style.display = "none";
    if(submitBtn) submitBtn.style.display = "none";
  }
}


/* =========================
   SUBMIT ATTENDANCE
   Saves locally first, then auto-syncs if online.
========================= */

function submitAttendance(){

  const msg = document.getElementById("employeeMsg");

  if(!msg) return;

  if(!activeTraining || !activeEmployee){
    msg.innerText = "Missing data";
    return;
  }

  msg.innerText = "Recording attendance...";

  let logs = getAttendanceLogs();

  const duplicate = logs.some(l =>
    cleanUpper(l.trainingId) === cleanUpper(activeTraining.id) &&
    cleanUpper(l.employeeId) === cleanUpper(activeEmployee.id)
  );

  if(duplicate){
    msg.innerText = "Already recorded for this training";
    return;
  }

  const record = {
    trainingId: activeTraining.id,
    trainingCode: activeTraining.id,
    title: activeTraining.title,
    trainingTitle: activeTraining.title,
    trainingName: activeTraining.title,
    trainingDate: activeTraining.date || new Date().toISOString(),

    employeeId: activeEmployee.id,
    empId: activeEmployee.id,
    name: activeEmployee.name,
    employeeName: activeEmployee.name,
    department: activeEmployee.department || "",
    position: activeEmployee.position || "",
    buBranch: activeEmployee.buBranch || activeEmployee.department || "",

    manhours: Number(activeTraining.manhours || 0),
    timestamp: new Date().toISOString(),
    source: "Offline PWA Direct"
  };

  logs.push(record);
  saveAttendanceLogs(logs);
  updateSyncCounter();

  msg.innerText = "Attendance saved successfully!";

  const empInput = document.getElementById("empId");
  const employeeCard = document.getElementById("employeeCard");
  const submitBtn = document.getElementById("submitBtn");

  if(empInput) empInput.value = "";
  if(employeeCard) employeeCard.style.display = "none";
  if(submitBtn) submitBtn.style.display = "none";

  activeEmployee = null;

  if(empInput) empInput.focus();

  // Direct sync when online.
  // If sync fails, record stays in localStorage for later.
  if(navigator.onLine){
    syncToGoogleSheets(true);
  }
}


/* =========================
   SYNC LOCAL STORAGE DIRECTLY TO MINI HRIS
========================= */

async function syncToGoogleSheets(isAutoSync){

  let logs = getAttendanceLogs();

  const syncBtn = document.getElementById("syncBtn");

  if(logs.length === 0){

    if(syncBtn){
      syncBtn.innerText = "No Data";

      setTimeout(() => {
        syncBtn.innerText = "Sync";
      }, 2000);
    }

    return;
  }

  if(syncBtn){
    syncBtn.disabled = true;
    syncBtn.innerText = "Syncing...";
  }

  console.log("SYNC TARGET URL:", GOOGLE_SCRIPT_URL);
  console.log("SYNC PAYLOAD:", logs);

  try {

    const response = await fetch(
      GOOGLE_SCRIPT_URL + "?directPwa=" + Date.now(),
      {
        method: "POST",
        body: JSON.stringify({
          records: logs
        })
      }
    );

    const resultText = await response.text();

    console.log("SYNC RESPONSE STATUS:", response.status);
    console.log("SYNC RESPONSE TEXT:", resultText);

    let success = false;
    let resultJson = null;

    try {
      resultJson = JSON.parse(resultText);
      success = resultJson.success === true;
    } catch(e) {
      success = resultText.trim() === "SUCCESS";
    }

    if(success){

      localStorage.removeItem("attendanceLogs");
      updateSyncCounter();

      if(syncBtn){
        syncBtn.innerText = "Success ✔";
      }

      const employeeMsg = document.getElementById("employeeMsg");
      if(employeeMsg && isAutoSync){
        employeeMsg.innerText = "Attendance synced to Mini HRIS ✔";
      }

    } else {

      if(syncBtn){
        syncBtn.innerText = "Failed ✖";
      }

      alert("Sync failed. Response: " + resultText);
    }

  } catch(err){

    console.error("SYNC ERROR", err);

    if(syncBtn){
      syncBtn.innerText = "Error ✖";
    }

    if(!isAutoSync){
      alert("Sync error: " + err.message);
    }
  }

  setTimeout(() => {
    if(syncBtn){
      syncBtn.disabled = false;
      syncBtn.innerText = "Sync";
    }
  }, 2000);
}


/* =========================
   UI STATUS
========================= */

function updateSyncCounter(){

  const counter = document.getElementById("syncCounter");

  if(!counter) return;

  let logs = getAttendanceLogs();
  const count = logs.length;

  if(count > 0){
    counter.innerText = "Pending Sync: " + count;
  } else {
    counter.innerText = "✔ All synced";
  }
}


function updateCacheStatus(){

  const status = document.getElementById("cacheStatus");

  if(!status) return;

  const trainingText = trainingsCached
    ? "✔ Trainings cached (100%)"
    : "⏳ Trainings not cached";

  const employeeText = employeesCached
    ? "✔ Employees cached (100%)"
    : "⏳ Employees not cached";

  status.innerHTML =
    trainingText + "<br>" + employeeText;
}


/* =========================
   INIT
========================= */

document.addEventListener("DOMContentLoaded", () => {
  updateSyncCounter();
  updateCacheStatus();

  loadData().then(() => {
    updateSyncCounter();
    updateCacheStatus();
  });
});


if("serviceWorker" in navigator){

  window.addEventListener("load", () => {

    navigator.serviceWorker.register("./service-worker.js")
      .then(() => console.log("Service Worker Registered"))
      .catch(err => console.log("SW failed", err));

  });

}
