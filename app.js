/* =========================
   MINI HRIS DIRECT PWA APP
   WITH MANUAL EMPLOYEE ENTRY
========================= */

let trainingsCached = false;
let employeesCached = false;

let activeTraining = null;
let activeEmployee = null;

let trainings = [];
let employees = [];

/*
  MINI HRIS deployed /exec URL.
*/
const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzhvXobopivkX90wiTbbQ4I5RnzAL--EpMLzyocWDBh2LXcEoSfs9VHLt-uqU7ghF16/exec";


/* =========================
   SMALL HELPERS
========================= */

function cleanValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}


function cleanUpper(value) {
  return cleanValue(value).toUpperCase();
}


function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("JSON parse failed:", err, text);
    return fallback;
  }
}


function normalizeListResponse(json, key) {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json[key])) return json[key];
  return [];
}


function formatTrainingDate(dateValue) {
  if (!dateValue) return "";

  const parsed = new Date(dateValue);

  if (isNaN(parsed.getTime())) {
    return cleanValue(dateValue);
  }

  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric"
  });
}


/**
 * Used only for the PWA's local duplicate check.
 * The Mini HRIS backend remains the final duplicate guard.
 */
function normalizeDateForLocalKey(value) {
  if (!value) return "";

  const parsed = new Date(value);

  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");

    return year + "-" + month + "-" + day;
  }

  return cleanUpper(value).replace(/\s+/g, "");
}


function buildLocalAttendanceKey(record) {
  return [
    normalizeDateForLocalKey(record.trainingDate),
    cleanUpper(record.employeeId).replace(/\s+/g, ""),
    cleanUpper(record.trainingId).replace(/\s+/g, "")
  ].join("|");
}


/* =========================
   LOCAL ATTENDANCE STORAGE
========================= */

function getAttendanceLogs() {
  try {
    return JSON.parse(
      localStorage.getItem("attendanceLogs") || "[]"
    );
  } catch (err) {
    console.error("Unable to read attendance logs:", err);
    return [];
  }
}


function saveAttendanceLogs(logs) {
  localStorage.setItem(
    "attendanceLogs",
    JSON.stringify(logs || [])
  );
}


/* =========================
   MANUAL EMPLOYEE STORAGE
========================= */

function getManualEmployees() {
  try {
    return JSON.parse(
      localStorage.getItem("manualEmployees") || "[]"
    );
  } catch (err) {
    console.error("Unable to read manual employees:", err);
    return [];
  }
}


function saveManualEmployees(list) {
  localStorage.setItem(
    "manualEmployees",
    JSON.stringify(list || [])
  );
}


/**
 * Combines fetched employees and locally saved manual employees.
 * Server/fetched employee data takes priority when the same ID exists.
 */
function mergeEmployees(serverEmployees, manualEmployees) {
  const map = new Map();

  (manualEmployees || []).forEach(employee => {
    const id = cleanUpper(
      employee.id ||
      employee.employeeId ||
      employee.empId
    );

    if (!id) return;

    map.set(id, employee);
  });

  (serverEmployees || []).forEach(employee => {
    const id = cleanUpper(
      employee.id ||
      employee.employeeId ||
      employee.empId
    );

    if (!id) return;

    map.set(id, employee);
  });

  return Array.from(map.values());
}


/* =========================
   LOAD TRAININGS + EMPLOYEES
========================= */

async function loadData() {
  console.log("LOAD DATA STARTED");
  console.log("API URL:", GOOGLE_SCRIPT_URL);

  const localManualEmployees = getManualEmployees();

  try {
    /* =========================
       TRAININGS
    ========================= */

    console.log("STEP 1: FETCH TRAININGS");

    const trainRes = await fetch(
      GOOGLE_SCRIPT_URL +
      "?action=trainings&cacheBust=" +
      Date.now()
    );

    if (!trainRes.ok) {
      throw new Error(
        "Training request failed with HTTP " +
        trainRes.status
      );
    }

    console.log(
      "STEP 2: TRAININGS STATUS =",
      trainRes.status
    );

    const trainText = await trainRes.text();

    console.log(
      "STEP 3: TRAININGS RAW =",
      trainText
    );

    const trainJson = safeJsonParse(trainText, []);
    trainings = normalizeListResponse(
      trainJson,
      "trainings"
    );

    localStorage.setItem(
      "cachedTrainings",
      JSON.stringify(trainings)
    );

    trainingsCached = trainings.length > 0;
    updateCacheStatus();

    console.log(
      "STEP 4: TRAININGS PARSED =",
      trainings
    );


    /* =========================
       EMPLOYEES
    ========================= */

    console.log("STEP 5: FETCH EMPLOYEES");

    const empRes = await fetch(
      GOOGLE_SCRIPT_URL +
      "?action=employees&cacheBust=" +
      Date.now()
    );

    if (!empRes.ok) {
      throw new Error(
        "Employee request failed with HTTP " +
        empRes.status
      );
    }

    console.log(
      "STEP 6: EMP STATUS =",
      empRes.status
    );

    const empText = await empRes.text();

    console.log(
      "STEP 7: EMP RAW =",
      empText
    );

    const empJson = safeJsonParse(empText, []);
    const fetchedEmployees = normalizeListResponse(
      empJson,
      "employees"
    );

    employees = mergeEmployees(
      fetchedEmployees,
      localManualEmployees
    );

    /*
      Cache the fetched and manual employee list together
      so both work while offline.
    */
    localStorage.setItem(
      "cachedEmployees",
      JSON.stringify(employees)
    );

    employeesCached = employees.length > 0;
    updateCacheStatus();

    console.log(
      "STEP 8: EMP PARSED =",
      employees
    );

  } catch (err) {
    console.error("LOAD DATA FAILED:", err);

    trainings = safeJsonParse(
      localStorage.getItem("cachedTrainings") || "[]",
      []
    );

    const cachedEmployees = safeJsonParse(
      localStorage.getItem("cachedEmployees") || "[]",
      []
    );

    employees = mergeEmployees(
      cachedEmployees,
      localManualEmployees
    );

    trainingsCached = trainings.length > 0;
    employeesCached = employees.length > 0;

    updateCacheStatus();

    const trainingMsg =
      document.getElementById("trainingMsg");

    if (trainingMsg) {
      trainingMsg.innerText =
        trainings.length > 0
          ? "Offline mode — cached training data loaded"
          : "Offline mode — no cached training data";
    }

    console.log("USING OFFLINE CACHE");
  }

  console.log("DATA LOADED SUCCESSFULLY");
}


/* =========================
   TRAINING VALIDATION
========================= */

function validateTraining() {
  const input =
    document.getElementById("trainingId");

  const msg =
    document.getElementById("trainingMsg");

  if (!input || !msg) return;

  if (!trainings || trainings.length === 0) {
    msg.innerText =
      "Training data is not available. Connect to the internet and reload.";
    return;
  }

  const trainingId = cleanUpper(input.value);

  if (!trainingId) {
    msg.innerText = "Enter Training ID";
    return;
  }

  msg.innerText = "Validating...";

  const found = trainings.find(training =>
    cleanUpper(
      training.id ||
      training.trainingId ||
      training.trainingCode ||
      training.code
    ) === trainingId
  );

  if (found) {
    activeTraining = {
      id: cleanValue(
        found.id ||
        found.trainingId ||
        found.trainingCode ||
        found.code
      ),

      title: cleanValue(
        found.title ||
        found.trainingTitle ||
        found.trainingName ||
        found.name
      ),

      date: cleanValue(
        found.date ||
        found.trainingDate ||
        found.schedule
      ),

      manhours: Number(
        found.manhours ||
        found.manHours ||
        found.durationHours ||
        found.tmh ||
        0
      )
    };

    msg.innerText = "Training Validated ✔";

    const formattedDate =
      formatTrainingDate(activeTraining.date);

    const trainingTitleDisplay =
      document.getElementById(
        "trainingTitleDisplay"
      );

    if (trainingTitleDisplay) {
      trainingTitleDisplay.innerHTML =
        escapeHtml(activeTraining.title) +
        (
          formattedDate
            ? '<span class="trainingDate"> — ' +
              escapeHtml(formattedDate) +
              "</span>"
            : ""
        );
    }

    const trainingSection =
      document.getElementById("trainingSection");

    const employeeSection =
      document.getElementById("employeeSection");

    if (trainingSection) {
      trainingSection.style.display = "none";
    }

    if (employeeSection) {
      employeeSection.style.display = "block";
    }

    resetEmployeeArea();

    const empInput =
      document.getElementById("empId");

    if (empInput) {
      empInput.focus();
    }

  } else {
    activeTraining = null;
    msg.innerText = "Training not found";
  }
}


/* =========================
   EMPLOYEE VALIDATION
========================= */

function validateEmployee() {
  const input =
    document.getElementById("empId");

  const msg =
    document.getElementById("employeeMsg");

  if (!input || !msg) return;

  const empId = cleanUpper(input.value);

  if (!empId) {
    msg.innerText = "Enter Employee ID";
    return;
  }

  msg.innerText = "Searching...";

  const found = employees.find(employee =>
    cleanUpper(
      employee.id ||
      employee.employeeId ||
      employee.empId
    ) === empId
  );

  if (found) {
    activeEmployee = {
      id: cleanValue(
        found.id ||
        found.employeeId ||
        found.empId
      ),

      name: cleanValue(
        found.name ||
        found.fullName ||
        found.fullname ||
        found.employeeName
      ),

      department: cleanValue(
        found.department ||
        found.branch ||
        found.company ||
        found.depBranch
      ),

      position: cleanValue(
        found.position ||
        found.jobTitle
      ),

      buBranch: cleanValue(
        found.buBranch ||
        found.branch ||
        found.businessUnit ||
        found.department
      ),

      manualEntry:
        found.manualEntry === true
    };

    hideManualEntry();
    showEmployeeCard(activeEmployee);

    msg.innerText =
      activeEmployee.manualEntry
        ? "Locally saved manual employee found ✔"
        : "";

  } else {
    activeEmployee = null;

    hideEmployeeCard();

    msg.innerText =
      "Employee ID not found. Enter the employee details manually.";

    showManualEntry(empId);
  }
}


/* =========================
   MANUAL EMPLOYEE ENTRY
========================= */

function showManualEntry(employeeId) {
  const manualEntry =
    document.getElementById("manualEntry");

  const manualEmpId =
    document.getElementById("manualEmpId");

  const manualEmpName =
    document.getElementById("manualEmpName");

  const manualEmpDept =
    document.getElementById("manualEmpDept");

  if (manualEntry) {
    manualEntry.style.display = "block";
  }

  if (manualEmpId) {
    manualEmpId.value = cleanUpper(employeeId);
  }

  if (manualEmpName) {
    manualEmpName.value = "";
  }

  if (manualEmpDept) {
    manualEmpDept.value = "";
  }

  if (manualEmpName) {
    manualEmpName.focus();
  }
}


function hideManualEntry() {
  const manualEntry =
    document.getElementById("manualEntry");

  if (manualEntry) {
    manualEntry.style.display = "none";
  }
}


function saveManualEmployee() {
  const idInput =
    document.getElementById("manualEmpId");

  const nameInput =
    document.getElementById("manualEmpName");

  const deptInput =
    document.getElementById("manualEmpDept");

  const msg =
    document.getElementById("employeeMsg");

  const id = cleanUpper(
    idInput ? idInput.value : ""
  );

  const name = cleanValue(
    nameInput ? nameInput.value : ""
  );

  const department = cleanValue(
    deptInput ? deptInput.value : ""
  );

  if (!id || !name || !department) {
    if (msg) {
      msg.innerText =
        "Employee ID, full name, and department are required.";
    }

    return;
  }

  activeEmployee = {
    id: id,
    employeeId: id,
    empId: id,

    name: name,
    employeeName: name,
    fullName: name,

    department: department,
    branch: department,
    buBranch: department,

    position: "Manual Entry",
    manualEntry: true
  };

  /*
    Save the employee in a separate local list so they
    can still be searched while offline later.
  */
  let manualEmployees = getManualEmployees();

  const existingIndex =
    manualEmployees.findIndex(employee =>
      cleanUpper(
        employee.id ||
        employee.employeeId ||
        employee.empId
      ) === id
    );

  if (existingIndex >= 0) {
    manualEmployees[existingIndex] =
      activeEmployee;
  } else {
    manualEmployees.push(activeEmployee);
  }

  saveManualEmployees(manualEmployees);

  /*
    Add/update the employee in the active employee list.
  */
  const employeeIndex =
    employees.findIndex(employee =>
      cleanUpper(
        employee.id ||
        employee.employeeId ||
        employee.empId
      ) === id
    );

  if (employeeIndex >= 0) {
    employees[employeeIndex] =
      activeEmployee;
  } else {
    employees.push(activeEmployee);
  }

  localStorage.setItem(
    "cachedEmployees",
    JSON.stringify(employees)
  );

  employeesCached = employees.length > 0;
  updateCacheStatus();

  hideManualEntry();
  showEmployeeCard(activeEmployee);

  if (msg) {
    msg.innerText =
      "Manual employee details accepted ✔";
  }
}


function cancelManualEntry() {
  activeEmployee = null;
  hideManualEntry();
  hideEmployeeCard();

  const msg =
    document.getElementById("employeeMsg");

  if (msg) {
    msg.innerText = "";
  }
}


/* =========================
   EMPLOYEE CARD HELPERS
========================= */

function showEmployeeCard(employee) {
  const employeeCard =
    document.getElementById("employeeCard");

  const submitBtn =
    document.getElementById("submitBtn");

  const empName =
    document.getElementById("empName");

  const empDept =
    document.getElementById("empDept");

  const empPos =
    document.getElementById("empPos");

  const manualBadge =
    document.getElementById("manualEmployeeBadge");

  if (employeeCard) {
    employeeCard.style.display = "block";
  }

  if (submitBtn) {
    submitBtn.style.display = "block";
  }

  if (empName) {
    empName.innerText = employee.name || "";
  }

  if (empDept) {
    empDept.innerText =
      employee.department || "";
  }

  if (empPos) {
    empPos.innerText =
      employee.position === "Manual Entry"
        ? ""
        : employee.position || "";
  }

  if (manualBadge) {
    manualBadge.style.display =
      employee.manualEntry
        ? "inline-block"
        : "none";
  }
}


function hideEmployeeCard() {
  const employeeCard =
    document.getElementById("employeeCard");

  const submitBtn =
    document.getElementById("submitBtn");

  if (employeeCard) {
    employeeCard.style.display = "none";
  }

  if (submitBtn) {
    submitBtn.style.display = "none";
  }
}


function resetEmployeeArea() {
  activeEmployee = null;

  const empInput =
    document.getElementById("empId");

  const employeeMsg =
    document.getElementById("employeeMsg");

  if (empInput) {
    empInput.value = "";
  }

  if (employeeMsg) {
    employeeMsg.innerText = "";
  }

  hideEmployeeCard();
  hideManualEntry();
}


/* =========================
   SUBMIT ATTENDANCE
   Saves locally first.
   Auto-syncs if online.
========================= */

function submitAttendance() {
  const msg =
    document.getElementById("employeeMsg");

  if (!msg) return;

  if (!activeTraining || !activeEmployee) {
    msg.innerText = "Missing data";
    return;
  }

  msg.innerText = "Recording attendance...";

  let logs = getAttendanceLogs();

  const record = {
    trainingId: activeTraining.id,
    trainingCode: activeTraining.id,

    title: activeTraining.title,
    trainingTitle: activeTraining.title,
    trainingName: activeTraining.title,

    trainingDate:
      activeTraining.date ||
      new Date().toISOString(),

    employeeId: activeEmployee.id,
    empId: activeEmployee.id,

    name: activeEmployee.name,
    employeeName: activeEmployee.name,

    department:
      activeEmployee.department || "",

    position:
      activeEmployee.position || "",

    buBranch:
      activeEmployee.buBranch ||
      activeEmployee.department ||
      "",

    manhours:
      Number(activeTraining.manhours || 0),

    timestamp:
      new Date().toISOString(),

    source:
      activeEmployee.manualEntry
        ? "Offline PWA Manual Employee"
        : "Offline PWA Direct",

    manualEmployee:
      activeEmployee.manualEntry === true
  };

  const incomingKey =
    buildLocalAttendanceKey(record);

  const duplicate = logs.some(log =>
    buildLocalAttendanceKey(log) === incomingKey
  );

  if (duplicate) {
    msg.innerText =
      "Already recorded for this training and date";
    return;
  }

  logs.push(record);
  saveAttendanceLogs(logs);

  updateSyncCounter();

  msg.innerText =
    navigator.onLine
      ? "Attendance saved. Syncing..."
      : "Attendance saved offline. It will sync when online.";

  resetEmployeeAfterSubmission();

  /*
    Direct sync when online.
    If sync fails, the record remains in localStorage.
  */
  if (navigator.onLine) {
    syncToGoogleSheets(true);
  }
}


function resetEmployeeAfterSubmission() {
  const empInput =
    document.getElementById("empId");

  hideEmployeeCard();
  hideManualEntry();

  activeEmployee = null;

  if (empInput) {
    empInput.value = "";
    empInput.focus();
  }
}


/* =========================
   SYNC LOCAL STORAGE
   DIRECTLY TO MINI HRIS
========================= */

async function syncToGoogleSheets(isAutoSync = false) {
  const logs = getAttendanceLogs();

  const syncBtn =
    document.getElementById("syncBtn");

  if (logs.length === 0) {
    if (syncBtn) {
      syncBtn.innerText = "No Data";

      setTimeout(() => {
        syncBtn.innerText = "SYNC TO SHEETS";
      }, 2000);
    }

    return;
  }

  if (!navigator.onLine) {
    if (syncBtn) {
      syncBtn.innerText = "Offline";
    }

    const msg =
      document.getElementById("employeeMsg");

    if (msg && !isAutoSync) {
      msg.innerText =
        "You are offline. Attendance remains pending.";
    }

    setTimeout(() => {
      if (syncBtn) {
        syncBtn.innerText = "SYNC TO SHEETS";
      }
    }, 2000);

    return;
  }

  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.innerText = "Syncing...";
  }

  console.log(
    "SYNC TARGET URL:",
    GOOGLE_SCRIPT_URL
  );

  console.log(
    "SYNC PAYLOAD:",
    logs
  );

  try {
    const response = await fetch(
      GOOGLE_SCRIPT_URL +
      "?directPwa=" +
      Date.now(),
      {
        method: "POST",

        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },

        body: JSON.stringify({
          records: logs
        })
      }
    );

    const resultText =
      await response.text();

    console.log(
      "SYNC RESPONSE STATUS:",
      response.status
    );

    console.log(
      "SYNC RESPONSE TEXT:",
      resultText
    );

    let success = false;
    let resultJson = null;

    try {
      resultJson = JSON.parse(resultText);
      success = resultJson.success === true;
    } catch (err) {
      success =
        resultText.trim() === "SUCCESS";
    }

    if (success) {
      /*
        The Mini HRIS processed the batch.
        This includes accepted records and duplicates
        that the backend intentionally skipped.
      */
      localStorage.removeItem("attendanceLogs");

      updateSyncCounter();

      if (syncBtn) {
        syncBtn.innerText = "Success ✔";
      }

      const employeeMsg =
        document.getElementById("employeeMsg");

      if (employeeMsg) {
        const appended =
          resultJson &&
          Number.isFinite(
            Number(resultJson.appended)
          )
            ? Number(resultJson.appended)
            : null;

        const skipped =
          resultJson &&
          Number.isFinite(
            Number(resultJson.skipped)
          )
            ? Number(resultJson.skipped)
            : null;

        if (
          appended !== null &&
          skipped !== null
        ) {
          employeeMsg.innerText =
            "Sync complete: " +
            appended +
            " added, " +
            skipped +
            " duplicate/invalid record(s) skipped.";
        } else {
          employeeMsg.innerText =
            "Attendance synced to Mini HRIS ✔";
        }
      }

    } else {
      if (syncBtn) {
        syncBtn.innerText = "Failed ✖";
      }

      if (!isAutoSync) {
        alert(
          "Sync failed. Response: " +
          resultText
        );
      }
    }

  } catch (err) {
    console.error("SYNC ERROR", err);

    if (syncBtn) {
      syncBtn.innerText = "Error ✖";
    }

    const employeeMsg =
      document.getElementById("employeeMsg");

    if (employeeMsg) {
      employeeMsg.innerText =
        "Sync failed. Attendance remains pending.";
    }

    if (!isAutoSync) {
      alert(
        "Sync error: " +
        err.message
      );
    }
  }

  setTimeout(() => {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.innerText = "SYNC TO SHEETS";
    }
  }, 2500);
}


/* =========================
   AUTO-SYNC WHEN ONLINE AGAIN
========================= */

window.addEventListener("online", () => {
  updateConnectionStatus();

  if (getAttendanceLogs().length > 0) {
    syncToGoogleSheets(true);
  }
});


window.addEventListener("offline", () => {
  updateConnectionStatus();
});


function updateConnectionStatus() {
  const connectionStatus =
    document.getElementById("connectionStatus");

  if (!connectionStatus) return;

  if (navigator.onLine) {
    connectionStatus.innerText = "ONLINE";
    connectionStatus.className = "online";
  } else {
    connectionStatus.innerText = "OFFLINE";
    connectionStatus.className = "offline";
  }
}


/* =========================
   UI STATUS
========================= */

function updateSyncCounter() {
  const counter =
    document.getElementById("syncCounter");

  if (!counter) return;

  const logs = getAttendanceLogs();
  const count = logs.length;

  if (count > 0) {
    counter.innerText =
      "Pending Sync: " + count;
  } else {
    counter.innerText =
      "✔ All synced";
  }
}


function updateCacheStatus() {
  const status =
    document.getElementById("cacheStatus");

  if (!status) return;

  const trainingText =
    trainingsCached
      ? "✔ Trainings cached"
      : "⏳ Trainings not cached";

  const employeeText =
    employeesCached
      ? "✔ Employees cached"
      : "⏳ Employees not cached";

  status.innerHTML =
    trainingText +
    "<br>" +
    employeeText;
}


/* =========================
   HTML ESCAPING
========================= */

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =========================
   INIT
========================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    updateSyncCounter();
    updateCacheStatus();
    updateConnectionStatus();

    loadData().then(() => {
      updateSyncCounter();
      updateCacheStatus();
    });
  }
);


/* =========================
   SERVICE WORKER
========================= */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(registration => {
        console.log(
          "Service Worker Registered",
          registration
        );
      })
      .catch(err => {
        console.error(
          "Service Worker failed",
          err
        );
      });
  });
}

/* =========================================================
   RETURN TO TRAINING SELECTION
   ========================================================= */

function goBackHome() {
  /*
    This resets only the current visible kiosk session.

    It does NOT delete:
    - cached training records
    - cached employee records
    - offline attendance records
    - pending sync records
    - localStorage data
    - IndexedDB data
    - service-worker caches
  */

  const trainingSection =
    document.getElementById("trainingSection");

  const trainingInput =
    document.getElementById("trainingId");

  const trainingButton =
    document.getElementById("trainingBtn");

  const trainingMessage =
    document.getElementById("trainingMsg");

  const trainingTitle =
    document.getElementById("trainingTitleDisplay");

  const employeeSection =
    document.getElementById("employeeSection");

  const employeeInput =
    document.getElementById("empId");

  const employeeButton =
    document.getElementById("empBtn");

  const employeeMessage =
    document.getElementById("employeeMsg");

  const manualEntry =
    document.getElementById("manualEntry");

  const manualEmployeeId =
    document.getElementById("manualEmpId");

  const manualEmployeeName =
    document.getElementById("manualEmpName");

  const manualEmployeeDepartment =
    document.getElementById("manualEmpDept");

  const employeeCard =
    document.getElementById("employeeCard");

  const employeeName =
    document.getElementById("empName");

  const employeeDepartment =
    document.getElementById("empDept");

  const employeePosition =
    document.getElementById("empPos");

  const manualEmployeeBadge =
    document.getElementById("manualEmployeeBadge");

  const submitButton =
    document.getElementById("submitBtn");


  /* Show the training selection section */

  if (trainingSection) {
    trainingSection.style.display = "";
  }


  /* Reset the training input */

  if (trainingInput) {
    trainingInput.value = "";
    trainingInput.disabled = false;
    trainingInput.readOnly = false;
  }

  if (trainingButton) {
    trainingButton.disabled = false;
    trainingButton.textContent = "VALIDATE";
  }

  if (trainingMessage) {
    trainingMessage.textContent = "";
    trainingMessage.innerHTML = "";
    trainingMessage.className = "";
  }

  if (trainingTitle) {
    trainingTitle.textContent = "";
    trainingTitle.innerHTML = "";
  }


  /* Hide the employee section */

  if (employeeSection) {
    employeeSection.style.display = "none";
  }


  /* Reset the employee search */

  if (employeeInput) {
    employeeInput.value = "";
    employeeInput.disabled = false;
    employeeInput.readOnly = false;
  }

  if (employeeButton) {
    employeeButton.disabled = false;
    employeeButton.textContent = "SEARCH";
  }

  if (employeeMessage) {
    employeeMessage.textContent = "";
    employeeMessage.innerHTML = "";
    employeeMessage.className = "";
  }


  /* Hide and clear manual employee entry */

  if (manualEntry) {
    manualEntry.style.display = "none";
  }

  if (manualEmployeeId) {
    manualEmployeeId.value = "";
  }

  if (manualEmployeeName) {
    manualEmployeeName.value = "";
  }

  if (manualEmployeeDepartment) {
    manualEmployeeDepartment.value = "";
  }


  /* Hide and clear employee information */

  if (employeeCard) {
    employeeCard.style.display = "none";
  }

  if (employeeName) {
    employeeName.textContent = "";
  }

  if (employeeDepartment) {
    employeeDepartment.textContent = "";
  }

  if (employeePosition) {
    employeePosition.textContent = "";
  }

  if (manualEmployeeBadge) {
    manualEmployeeBadge.style.display = "none";
  }


  /* Hide the attendance confirmation button */

  if (submitButton) {
    submitButton.style.display = "none";
    submitButton.disabled = false;
    submitButton.textContent = "CONFIRM ATTENDANCE";
  }


  /*
    Reset common current-session variables only.

    These do not affect the cached training or employee lists.
  */

  if (typeof selectedTraining !== "undefined") {
    selectedTraining = null;
  }

  if (typeof currentTraining !== "undefined") {
    currentTraining = null;
  }

  if (typeof activeTraining !== "undefined") {
    activeTraining = null;
  }

  if (typeof selectedEmployee !== "undefined") {
    selectedEmployee = null;
  }

  if (typeof currentEmployee !== "undefined") {
    currentEmployee = null;
  }


  /* Return to the top without refreshing */

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  /* Focus the training ID field */

  window.setTimeout(() => {
    if (trainingInput) {
      trainingInput.focus();
    }
  }, 200);

  console.log(
    "Returned to training selection. Offline caches preserved."
  );
}

/* =========================================================
   MANUALLY SYNC ALL PENDING ATTENDANCE
========================================================= */

/* =========================================================
   MANUALLY SYNC ALL PENDING ATTENDANCE
========================================================= */

async function syncAllPendingAttendance() {
  const syncButton =
    document.getElementById("syncPendingBtn");

  const syncCounter =
    document.getElementById("syncCounter");


  if (!navigator.onLine) {
    if (syncCounter) {
      syncCounter.textContent =
        "⚠ Pending — offline";
    }

    console.warn(
      "The device is offline. Pending records were preserved."
    );

    return;
  }


  if (syncButton) {
    syncButton.disabled = true;
    syncButton.textContent = "↻ SYNCING";
  }


  try {
    if (
      typeof syncToGoogleSheets !== "function"
    ) {
      throw new Error(
        "syncToGoogleSheets() was not found in app.js."
      );
    }

    /*
      This uses your kiosk's existing pending-sync process.
      It does not delete cached trainings or employees.
    */
    await syncToGoogleSheets(false);

    console.log(
      "Manual pending synchronization completed."
    );

  } catch (error) {
    console.error(
      "Manual synchronization failed:",
      error
    );

    if (syncCounter) {
      syncCounter.textContent =
        "⚠ Sync failed";
    }

  } finally {
    if (syncButton) {
      syncButton.disabled = false;
      syncButton.textContent = "↻ SYNC NOW";
    }
  }
}

/* =========================================================
   SYNC BUTTON CONNECTION STATUS
========================================================= */

function updateManualSyncButton() {
  const syncButton =
    document.getElementById("syncPendingBtn");

  if (!syncButton) {
    return;
  }

  if (navigator.onLine) {
    syncButton.disabled = false;
    syncButton.title =
      "Sync all pending attendance records";
  } else {
    syncButton.disabled = false;

    /*
      Keep it clickable so the user receives the clear
      offline message when they press it.
    */
    syncButton.title =
      "You are offline. Pending records are preserved.";
  }
}

window.addEventListener(
  "online",
  updateManualSyncButton
);

window.addEventListener(
  "offline",
  updateManualSyncButton
);

window.addEventListener(
  "load",
  updateManualSyncButton
);


/* =========================================================
   TOP TOOLBAR BUTTON CONNECTIONS
========================================================= */

function initializeKioskToolbar() {
  const homeButton =
    document.getElementById("homeBtn");

  const syncButton =
    document.getElementById("syncPendingBtn");


  if (homeButton) {
    homeButton.addEventListener(
      "click",
      goBackHome
    );
  }


  if (syncButton) {
    syncButton.addEventListener(
      "click",
      syncAllPendingAttendance
    );
  }
}


if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeKioskToolbar
  );
} else {
  initializeKioskToolbar();
}
