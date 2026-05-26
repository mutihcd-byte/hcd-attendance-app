
/* =========================
   OFFLINE DATA STORAGE
========================= */

let activeTraining = null;
let activeEmployee = null;

/* =========================
   TRAINING DATA (TEMP SAMPLE)
   (later we replace with JSON file)
========================= */

let trainings = [];

/* =========================
   EMPLOYEE DATA (TEMP SAMPLE)
   (later we replace with JSON file)
========================= */

let employees = [];

/* =========================
   TRAINING VALIDATION
========================= */

function validateTraining(){

  const input = document.getElementById("trainingId");
  const msg = document.getElementById("trainingMsg");

  if (!trainings || trainings.length === 0) {
    document.getElementById("trainingMsg").innerText =
    "Loading training data... please wait";
   return;
  }

  const trainingId = String(input.value).trim().toUpperCase();

  if(!trainingId){
    msg.innerText = "Enter Training ID";
    return;
  }

  msg.innerText = "Validating...";

  const found = trainings.find(t =>
   String(t.id).trim().toUpperCase() === trainingId
  );

  if(found){

   activeTraining = found;

   document.getElementById("trainingMsg").innerText = "Training Validated ✔";

  const formattedDate = new Date(found.date).toLocaleDateString(
   "en-US",
   {
     month: "long",
     day: "2-digit",
     year: "numeric"
    }
  );

  document.getElementById("trainingTitleDisplay").innerHTML =
   found.title +
   ' <span class="trainingDate">- ' +
   formattedDate +
   '</span>';

   document.getElementById("trainingSection").style.display = "none";
   document.getElementById("employeeSection").style.display = "block";

  }
}

/* =========================
   EMPLOYEE VALIDATION
========================= */

function validateEmployee(){

  const input = document.getElementById("empId");
  const msg = document.getElementById("employeeMsg");

  const empId = input.value.trim().toUpperCase();

  if(!empId){
    msg.innerText = "Enter Employee ID";
    return;
  }

  msg.innerText = "Searching...";

  const found = employees.find(e => e.id === empId);

  if(found){

    activeEmployee = found;

    document.getElementById("employeeCard").style.display = "block";
    document.getElementById("submitBtn").style.display = "block";

    document.getElementById("empName").innerText = found.name;
    document.getElementById("empDept").innerText = found.department;
    document.getElementById("empPos").innerText = found.position;

    msg.innerText = "";

  } else {

    msg.innerText = "Employee not found";
    document.getElementById("employeeCard").style.display = "none";
    document.getElementById("submitBtn").style.display = "none";
  }
}

/* =========================
   SUBMIT ATTENDANCE
========================= */

function submitAttendance(){

  const msg = document.getElementById("employeeMsg");

  if(!activeTraining || !activeEmployee){
    msg.innerText = "Missing data";
    return;
  }

  msg.innerText = "Recording attendance...";

  // SIMULATE DUPLICATE CHECK STORAGE
  let logs = JSON.parse(localStorage.getItem("attendanceLogs") || "[]");

  const duplicate = logs.some(l =>
   l.trainingId === activeTraining.id &&
   l.employeeId === activeEmployee.id
  );

  if(duplicate){
   msg.innerText = "Already recorded for this training";
   return;
  }

  logs.push({
    trainingId: activeTraining.id,
    title: activeTraining.title,
    employeeId: activeEmployee.id,
    name: activeEmployee.name,
    department: activeEmployee.department,
    timestamp: new Date().toISOString()
  });

  localStorage.setItem("attendanceLogs", JSON.stringify(logs));
  updateSyncCounter();

  msg.innerText = "Attendance saved successfully!";

  // RESET ONLY EMPLOYEE
  document.getElementById("empId").value = "";
  document.getElementById("employeeCard").style.display = "none";
  document.getElementById("submitBtn").style.display = "none";

  activeEmployee = null;

  document.getElementById("empId").focus();
}

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyMK4YDD6oJHwgwuVWLywaR9ZVo1OfEr96RrbtmT8KrUu5nBdyEWVo9FrSNGQSmGCUg/exec";

/**async function loadData(){

  try{

    const empRes = await fetch(
    GOOGLE_SCRIPT_URL + "?action=employees"
  );

   employees = await empRes.json();

    const trainRes = await fetch(
    GOOGLE_SCRIPT_URL + "?action=trainings"
  );

   trainings = await trainRes.json();

    console.log("Data loaded successfully");
    updateSyncCounter();

  } catch(err){
    console.error("Error loading JSON files", err);
  }

}*/

async function loadData(){

  console.log("LOAD DATA STARTED");

  try {

    // =========================
    // TRAININGS
    // =========================
    console.log("STEP 1: FETCH TRAININGS");

    const trainRes = await fetch(GOOGLE_SCRIPT_URL + "?action=trainings");

    console.log("STEP 2: TRAININGS STATUS =", trainRes.status);

    const trainText = await trainRes.text();

    console.log("STEP 3: TRAININGS RAW =", trainText);

    trainings = JSON.parse(trainText);

    console.log("STEP 4: TRAININGS PARSED =", trainings);


    // =========================
    // EMPLOYEES (THIS WAS MISSING)
    // =========================
    console.log("STEP 5: FETCH EMPLOYEES");

    const empRes = await fetch(GOOGLE_SCRIPT_URL + "?action=employees");

    console.log("STEP 6: EMP STATUS =", empRes.status);

    const empText = await empRes.text();

    console.log("STEP 7: EMP RAW =", empText);

    employees = JSON.parse(empText);

    console.log("STEP 8: EMP PARSED =", employees);

  } catch(err){
    console.error("LOAD DATA FAILED:", err);
  }

  console.log("DATA LOADED SUCCESSFULLY");
}

loadData();

if ("serviceWorker" in navigator) {

  window.addEventListener("load", () => {

    navigator.serviceWorker.register("./service-worker.js")
      .then(() => console.log("Service Worker Registered"))
      .catch(err => console.log("SW failed", err));

  });

}


/**
 * SYNC LOCAL STORAGE TO GOOGLE SHEETS
 */
async function syncToGoogleSheets(){

  let logs = JSON.parse(localStorage.getItem("attendanceLogs") || "[]");

  const syncBtn = document.getElementById("syncBtn");

  if(logs.length === 0){

    syncBtn.innerText = "No Data";

    setTimeout(() => {
      syncBtn.innerText = "Sync";
    }, 2000);

    return;
  }

  // LOADING STATE
  syncBtn.disabled = true;
  syncBtn.innerText = "Syncing...";

  try {

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(logs)
    });

    const result = await response.text();

    if(result === "SUCCESS"){

      localStorage.removeItem("attendanceLogs");
      updateSyncCounter();

      // SUCCESS STATE
      syncBtn.innerText = "Success ✔";

    } else {

      syncBtn.innerText = "Failed ✖";
    }

  } catch(err){

    console.error("SYNC ERROR", err);

    syncBtn.innerText = "Error ✖";
  }

  // RESET BUTTON AFTER 2 SECONDS
  setTimeout(() => {

    syncBtn.disabled = false;
    syncBtn.innerText = "Sync";

  }, 2000);
}
function updateSyncCounter(){

  let logs = JSON.parse(localStorage.getItem("attendanceLogs") || "[]");

  const counter = document.getElementById("syncCounter");

  if(logs.length === 0){
    counter.innerText = "All data synced ✔";
  } else {
    counter.innerText = logs.length + " pending sync";
  }
}