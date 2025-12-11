// Global State
let appData = { setup: {}, allocations: [], grid: {} };

// DOM Elements
const els = {
    viewMode: document.getElementById('viewModeSelector'),
    classSelect: document.getElementById('classSelector'),
    classControls: document.getElementById('classControls'),
    container: document.getElementById('gridContainer'),
    statusBar: document.getElementById('statusBar'),
    saveStatus: document.getElementById('saveStatus')
};

/* Theme helpers */
function applyTheme(theme) {
    if (theme === 'dark') document.documentElement.classList.add('dark-theme');
    else document.documentElement.classList.remove('dark-theme');
}

function updateThemeButton(theme) {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.innerText = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
}

function initTheme() {
    const saved = localStorage.getItem('ttheme') || 'light';
    applyTheme(saved);
    updateThemeButton(saved);

    const btn = document.getElementById('themeToggle');
    if (btn) {
        btn.addEventListener('click', () => {
            const current = document.documentElement.classList.contains('dark-theme') ? 'dark' : 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            applyTheme(next);
            updateThemeButton(next);
            localStorage.setItem('ttheme', next);
        });
    }
}

// --- INITIALIZATION ---
async function init() {
    try {
        const res = await fetch('/api/data');
        appData = await res.json();
        
        // Ensure grid structure exists
        if (!appData.grid || Object.keys(appData.grid).length === 0) {
            initGridStructure();
        }
        
        populateClassDropdown();
        render(); // Initial Render
        // Initialize theme toggle (reads localStorage)
        initTheme();
        
        // Event Listeners
        els.viewMode.addEventListener('change', render);
        els.classSelect.addEventListener('change', render);
        document.getElementById('btnCheck').addEventListener('click', checkCollisions);
        document.getElementById('btnAuto').addEventListener('click', autoFill);
        document.getElementById('btnReset').addEventListener('click', resetGrid);

    } catch (err) {
        console.error(err);
        els.container.innerHTML = "<p style='color:red'>Error connecting to server.</p>";
    }
}

function initGridStructure() {
    appData.grid = {};
    const { days, periods_per_day } = appData.setup;
    
    appData.allocations.forEach(alloc => {
        appData.grid[alloc.class_name] = {};
        days.forEach(day => {
            appData.grid[alloc.class_name][day] = new Array(periods_per_day).fill("");
        });
    });
    saveData();
}

// --- API OPS ---
async function saveData() {
    els.saveStatus.innerText = "Saving...";
    try {
        await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appData)
        });
        els.saveStatus.innerText = "All changes saved";
    } catch (e) {
        els.saveStatus.innerText = "Error saving!";
    }
}

// --- RENDERING ---
function populateClassDropdown() {
    els.classSelect.innerHTML = '';
    appData.allocations.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.class_name;
        opt.innerText = a.class_name;
        els.classSelect.appendChild(opt);
    });
}

function render() {
    const mode = els.viewMode.value;
    els.statusBar.className = "status-bar hidden"; // Hide messages on switch

    if (mode === 'class') {
        els.classControls.style.display = 'flex';
        renderClassView();
    } else {
        els.classControls.style.display = 'none';
        renderStaffView();
    }
}

function renderClassView() {
    const className = els.classSelect.value;
    const { days, periods_per_day } = appData.setup;
    
    // Get valid subjects
    const alloc = appData.allocations.find(a => a.class_name === className);
    let options = [''];
    if (alloc) alloc.subjects.forEach(s => options.push(`${s.subject} (${s.teacher})`));

    let html = `<table><thead><tr><th>Day</th>`;
    for(let i=1; i<=periods_per_day; i++) html += `<th>Period ${i}</th>`;
    html += `</tr></thead><tbody>`;

    days.forEach(day => {
        html += `<tr><td><strong>${day}</strong></td>`;
        for(let p=0; p<periods_per_day; p++) {
            const val = appData.grid[className]?.[day]?.[p] || "";
            
            let optsHtml = options.map(opt => 
                `<option value="${opt}" ${opt === val ? 'selected' : ''}>${opt || '--'}</option>`
            ).join('');
            
            // CHANGE: Passed 'this' to updateCell so we can revert the selection if invalid
            html += `<td><select onchange="updateCell(this, '${className}', '${day}', ${p})">${optsHtml}</select></td>`;
        }
        html += `</tr>`;
    });
    els.container.innerHTML = html + "</tbody></table>";

    // NEW: Render the progress circles
    renderProgress(className);
}

// Exposed to global scope for HTML event handlers
window.updateCell = (selectElement, cls, day, p, val) => {
    const newValue = selectElement.value; // The value user just picked
    const oldValue = appData.grid[cls][day][p]; // The value that was there before

    // If clearing a cell, just do it
    if (newValue === "") {
        appData.grid[cls][day][p] = "";
        saveData();
        renderProgress(cls);
        return;
    }

    // VALIDATION: Check limits
    // 1. Parse the subject from "Subject (Teacher)"
    const newSubjectName = newValue.split('(')[0].trim();
    
    // 2. Find allocation limit
    const alloc = appData.allocations.find(a => a.class_name === cls);
    const subjectData = alloc.subjects.find(s => s.subject === newSubjectName);
    
    if (!subjectData) return; // Should not happen

    const maxLimit = subjectData.periods;

    // 3. Count how many times this subject is CURRENTLY used in the grid
    let currentCount = 0;
    const days = appData.setup.days;
    days.forEach(d => {
        appData.grid[cls][d].forEach(cellContent => {
            if (cellContent && cellContent.startsWith(newSubjectName + " (")) {
                currentCount++;
            }
        });
    });

    // Note: The grid hasn't updated yet. So 'currentCount' is the count BEFORE this change.
    // If we change "Math" to "English", Math count goes down, English goes up.
    // But here we are adding a NEW instance of 'newSubjectName'.

    if (currentCount >= maxLimit) {
        alert(`Limit Reached! \n${newSubjectName} allows only ${maxLimit} periods.`);
        selectElement.value = oldValue; // Revert the dropdown visual
        return; // Stop saving
    }

    // If valid, save
    appData.grid[cls][day][p] = newValue;
    saveData();
    renderProgress(cls); // Update circles immediately
};

function renderStaffView() {
    const { days, periods_per_day } = appData.setup;
    
    // Pivot Logic
    let staffMap = {}; 
    const teachers = new Set();
    appData.allocations.forEach(a => a.subjects.forEach(s => teachers.add(s.teacher)));
    
    Array.from(teachers).sort().forEach(t => {
        staffMap[t] = {};
        days.forEach(d => staffMap[t][d] = new Array(periods_per_day).fill([]));
    });

    Object.keys(appData.grid).forEach(cls => {
        days.forEach(d => {
            appData.grid[cls][d].forEach((val, p) => {
                if(val && val.includes('(')) {
                    const t = val.split('(')[1].replace(')', '').trim();
                    if(staffMap[t]) {
                        // Create a new array reference and push
                        let current = [...staffMap[t][d][p]];
                        current.push(cls);
                        staffMap[t][d][p] = current;
                    }
                }
            });
        });
    });

    let html = "";
    Object.keys(staffMap).forEach(t => {
        html += `<div style="margin-top:30px"><h3>👤 ${t}</h3><table><thead><tr><th>Day</th>`;
        for(let i=1; i<=periods_per_day; i++) html += `<th>Pd ${i}</th>`;
        html += `</tr></thead><tbody>`;
        
        days.forEach(d => {
            html += `<tr><td><strong>${d}</strong></td>`;
            for(let p=0; p<periods_per_day; p++) {
                const classes = staffMap[t][d][p];
                const text = classes.length ? classes.join(", ") : "--";
                const style = classes.length ? "occupied" : "free";
                html += `<td class="staff-cell ${style}">${text}</td>`;
            }
            html += `</tr>`;
        });
        html += `</tbody></table></div>`;
    });
    els.container.innerHTML = html;
}

// --- ALGORITHMS ---

function checkCollisions() {
    const collisions = [];
    const schedule = {}; // Teacher -> Day -> Period -> {subject, class}

    Object.keys(appData.grid).forEach(cls => {
        const days = appData.setup.days;
        days.forEach(d => {
            appData.grid[cls][d].forEach((val, p) => {
                if(!val) return;
                const [subj, teacherPart] = val.split('(');
                const teacher = teacherPart.replace(')', '').trim();
                const subject = subj.trim();

                if(!schedule[teacher]) schedule[teacher] = {};
                if(!schedule[teacher][d]) schedule[teacher][d] = {};

                if(schedule[teacher][d][p]) {
                    // Collision Rule: Same Teacher + Different Subject = BAD
                    const existing = schedule[teacher][d][p];
                    if(existing.subject !== subject) {
                        collisions.push(`${teacher}: ${existing.subject}(${existing.class}) vs ${subject}(${cls}) on ${d} Pd ${p+1}`);
                    }
                } else {
                    schedule[teacher][d][p] = { subject, class: cls };
                }
            });
        });
    });

    showStatus(collisions.length ? collisions.join('<br>') : "No collisions found!", collisions.length > 0);
}

async function autoFill() {
    // 1. Calculate Requirements (Grouped by Teacher+Subject for Combined Classes)
    let tasks = [];
    let reqs = {}; // Key: "Teacher|Subject" -> { "10A": 5, "10B": 5 }

    appData.allocations.forEach(alloc => {
        alloc.subjects.forEach(sub => {
            const key = `${sub.teacher}|${sub.subject}`;
            if(!reqs[key]) reqs[key] = {};
            
            // Count existing
            let count = 0;
            appData.setup.days.forEach(d => {
                appData.grid[alloc.class_name][d].forEach(v => {
                    if(v === `${sub.subject} (${sub.teacher})`) count++;
                });
            });
            reqs[key][alloc.class_name] = sub.periods - count;
        });
    });

    // 2. Build Task List
    Object.keys(reqs).forEach(key => {
        const [teacher, subject] = key.split('|');
        const classNeeds = reqs[key];
        const maxNeeded = Math.max(...Object.values(classNeeds));

        for(let i=0; i<maxNeeded; i++) {
            let participants = [];
            Object.keys(classNeeds).forEach(c => {
                if(classNeeds[c] > 0) { participants.push(c); classNeeds[c]--; }
            });
            if(participants.length) tasks.push({ teacher, subject, classes: participants });
        }
    });

    if(tasks.length === 0) return showStatus("Schedule is already full!", false);

    // 3. Solver (Randomized Greedy)
    const MAX_ATTEMPTS = 100;
    for(let attempt=0; attempt<MAX_ATTEMPTS; attempt++) {
        let tempGrid = JSON.parse(JSON.stringify(appData.grid));
        let success = true;
        
        // Build Busy Map
        let busy = {}; // teacher -> day -> set(periods)
        Object.keys(tempGrid).forEach(c => {
            Object.keys(tempGrid[c]).forEach(d => {
                tempGrid[c][d].forEach((val, p) => {
                    if(val) {
                        let t = val.split('(')[1].replace(')', '').trim();
                        if(!busy[t]) busy[t] = {};
                        if(!busy[t][d]) busy[t][d] = new Set();
                        busy[t][d].add(p);
                    }
                });
            });
        });

        // Shuffle Tasks
        tasks.sort(() => Math.random() - 0.5);

        for(let task of tasks) {
            let placed = false;
            let slots = [];
            appData.setup.days.forEach(d => {
                for(let p=0; p<appData.setup.periods_per_day; p++) slots.push({d, p});
            });
            slots.sort(() => Math.random() - 0.5);

            for(let {d, p} of slots) {
                // Check Teacher Availability
                if(busy[task.teacher]?.[d]?.has(p)) continue;
                
                // Check Class Availability (All participants must be free)
                let classesFree = task.classes.every(c => tempGrid[c][d][p] === "");
                if(!classesFree) continue;

                // Place
                const entry = `${task.subject} (${task.teacher})`;
                task.classes.forEach(c => tempGrid[c][d][p] = entry);
                
                if(!busy[task.teacher]) busy[task.teacher] = {};
                if(!busy[task.teacher][d]) busy[task.teacher][d] = new Set();
                busy[task.teacher][d].add(p);
                
                placed = true;
                break;
            }

            if(!placed) { success = false; break; }
        }

        if(success) {
            appData.grid = tempGrid;
            await saveData();
            render();
            return showStatus(`Auto-filled successfully (Attempt ${attempt+1})`, false);
        }
    }

    showStatus("Could not auto-fill without conflicts. Try clearing some slots.", true);
}

function showStatus(msg, isError) {
    els.statusBar.innerHTML = msg;
    els.statusBar.className = isError ? "status-bar status-error" : "status-bar status-success";
    els.statusBar.style.display = 'block';
}

function resetGrid() {
    if(confirm("Clear all timetables?")) {
        initGridStructure();
        render();
    }
}

function downloadFinalJSON() {
    // 1. Convert the current data to a string
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
    
    // 2. Create a fake download link and click it
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "final_timetable.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}
function renderProgress(className) {
    const section = document.getElementById('progressSection');
    section.innerHTML = ''; // Clear previous

    const alloc = appData.allocations.find(a => a.class_name === className);
    if (!alloc) return;

    alloc.subjects.forEach(sub => {
        // 1. Count actual usage
        let count = 0;
        appData.setup.days.forEach(d => {
            appData.grid[className][d].forEach(cell => {
                if (cell.includes(`${sub.subject} (${sub.teacher})`)) count++;
            });
        });

        // 2. Calculate Percentage
        const percentage = Math.min((count / sub.periods) * 100, 100);
        
        // 3. Determine Color (Blue for progress, Green for Done)
        let colorVar = 'var(--primary)';
        let textColorClass = '';
        
        if (count >= sub.periods) {
            colorVar = 'var(--success)';
            textColorClass = 'text-complete';
        }

        // 4. Create HTML
        const card = document.createElement('div');
        card.className = 'progress-card';
        
        // CSS Trick: conic-gradient for the ring
        const gradient = `conic-gradient(${colorVar} ${percentage}%, #e2e8f0 ${percentage}% 100%)`;

        card.innerHTML = `
            <div class="progress-ring" style="background: ${gradient}">
                <span class="progress-text ${textColorClass}">${count}/${sub.periods}</span>
            </div>
            <div class="subject-name">${sub.subject}</div>
        `;

        section.appendChild(card);
    });
}
// Start
init();