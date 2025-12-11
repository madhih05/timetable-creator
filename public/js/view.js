// Global State
let appData = { setup: {}, allocations: [], grid: {} };

const els = {
    viewMode: document.getElementById('viewModeSelector'),
    filterBtn: document.getElementById('filterBtn'),
    filterMenu: document.getElementById('filterMenu'),
    container: document.getElementById('gridContainer')
};

/* Theme helpers for view page */
function applyThemeView(theme) {
    if (theme === 'dark') document.documentElement.classList.add('dark-theme');
    else document.documentElement.classList.remove('dark-theme');
}

function updateThemeButtonView(theme) {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.innerText = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
}

function initThemeView() {
    const saved = localStorage.getItem('ttheme') || 'light';
    applyThemeView(saved);
    updateThemeButtonView(saved);
    const btn = document.getElementById('themeToggle');
    if (btn) {
        btn.addEventListener('click', () => {
            const current = document.documentElement.classList.contains('dark-theme') ? 'dark' : 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            applyThemeView(next);
            updateThemeButtonView(next);
            localStorage.setItem('ttheme', next);
        });
    }
}

async function init() {
    try {
        const res = await fetch('/api/data');
        appData = await res.json();
        
        // Setup Event Listeners
        els.viewMode.addEventListener('change', switchMode);
        
        // Toggle Dropdown menu
        els.filterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            els.filterMenu.classList.toggle('show');
        });

        // Close dropdown if clicking outside
        window.addEventListener('click', (e) => {
            if (!e.target.matches('#filterBtn') && !els.filterMenu.contains(e.target)) {
                els.filterMenu.classList.remove('show');
            }
        });

        // Initialize theme before rendering so colors are correct
        initThemeView();

        // Initial Load
        switchMode(); 

    } catch (err) {
        console.error(err);
        els.container.innerHTML = "<p style='color:red'>Error loading data.</p>";
    }
}

function switchMode() {
    // 1. Determine if we are viewing Classes or Staff
    const mode = els.viewMode.value; // 'class' or 'staff'
    els.filterBtn.innerText = mode === 'class' ? "Select Classes ⬇" : "Select Staff ⬇";
    
    // 2. Generate the Checkboxes
    populateFilterMenu(mode);
    
    // 3. Render based on current selection (which defaults to none or all)
    // Let's default to selecting the first 3 items so the screen isn't empty
    const checkboxes = els.filterMenu.querySelectorAll('input');
    checkboxes.forEach((cb, index) => {
        if(index < 3) cb.checked = true;
    });

    render();
}

function populateFilterMenu(mode) {
    els.filterMenu.innerHTML = '';
    let items = [];

    if (mode === 'class') {
        // Sort Classes
        items = appData.allocations.map(a => a.class_name).sort();
    } else {
        // Get Unique Teachers
        const teachers = new Set();
        appData.allocations.forEach(a => a.subjects.forEach(s => teachers.add(s.teacher)));
        items = Array.from(teachers).sort();
    }

    items.forEach(item => {
        const label = document.createElement('label');
        label.className = 'checkbox-item';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = item;
        // Re-render immediately when a box is checked/unchecked
        input.addEventListener('change', render);

        label.appendChild(input);
        label.appendChild(document.createTextNode(item));
        els.filterMenu.appendChild(label);
    });
}

// Helpers for the "Select All" / "Clear" buttons
window.selectAll = () => {
    els.filterMenu.querySelectorAll('input').forEach(cb => cb.checked = true);
    render();
};
window.clearAll = () => {
    els.filterMenu.querySelectorAll('input').forEach(cb => cb.checked = false);
    render();
};

function render() {
    const mode = els.viewMode.value;
    // Get all checked values
    const checkedInputs = Array.from(els.filterMenu.querySelectorAll('input:checked'));
    const selectedItems = checkedInputs.map(input => input.value);

    els.container.innerHTML = ''; // Clear Screen

    if (selectedItems.length === 0) {
        els.container.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Select items from the filter menu to view timetables.</div>';
        return;
    }

    // Loop through every selected item and create a table for it
    let html = '';
    selectedItems.forEach(item => {
        if (mode === 'class') {
            html += generateClassTable(item);
        } else {
            html += generateStaffTable(item);
        }
    });
    
    els.container.innerHTML = html;
}

// --- HTML GENERATORS ---

function generateClassTable(className) {
    const { days, periods_per_day } = appData.setup;
    
    let html = `<div style="margin-bottom: 40px;">
                <h3 style="color:var(--primary); border-bottom:2px solid #e2e8f0; padding-bottom:5px;">${className}</h3>
                <table><thead><tr><th>Day</th>`;
    
    for(let i=1; i<=periods_per_day; i++) html += `<th>Pd ${i}</th>`;
    html += `</tr></thead><tbody>`;

    days.forEach(day => {
        html += `<tr><td><strong>${day}</strong></td>`;
        for(let p=0; p<periods_per_day; p++) {
            const val = appData.grid[className]?.[day]?.[p] || "";
            if (val) {
                const parts = val.split('(');
                const subject = parts[0].trim();
                const teacher = parts.length > 1 ? parts[1].replace(')', '').trim() : "";
                
                html += `<td style="background:#f8fafc; padding:10px;">
                            <div style="font-weight:bold; color:#2563eb; font-size:0.9rem;">${subject}</div>
                            <div style="font-size:0.75rem; color:#64748b;">${teacher}</div>
                         </td>`;
            } else {
                html += `<td style="color:#ccc; font-style:italic;">--</td>`;
            }
        }
        html += `</tr>`;
    });
    html += `</tbody></table></div>`;
    return html;
}

function generateStaffTable(teacherName) {
    const { days, periods_per_day } = appData.setup;

    // We calculate the staff schedule on the fly here
    let schedule = {}; // Day -> Period -> [Classes]
    days.forEach(d => schedule[d] = new Array(periods_per_day).fill([]));

    // Scan the grid to find this teacher
    Object.keys(appData.grid).forEach(cls => {
        days.forEach(d => {
            appData.grid[cls][d].forEach((val, p) => {
                if(val && val.includes('(')) {
                    const t = val.split('(')[1].replace(')', '').trim();
                    if(t === teacherName) {
                        // Create copy and push
                        let current = [...schedule[d][p]];
                        current.push(cls);
                        schedule[d][p] = current;
                    }
                }
            });
        });
    });

    let html = `<div style="margin-bottom: 40px;">
                <h3 style="color:#059669; border-bottom:2px solid #e2e8f0; padding-bottom:5px;">👤 ${teacherName}</h3>
                <table><thead><tr><th>Day</th>`;
    
    for(let i=1; i<=periods_per_day; i++) html += `<th>Pd ${i}</th>`;
    html += `</tr></thead><tbody>`;

    days.forEach(d => {
        html += `<tr><td><strong>${d}</strong></td>`;
        for(let p=0; p<periods_per_day; p++) {
            const classes = schedule[d][p];
            if (classes.length > 0) {
                 html += `<td style="background:#dcfce7; color:#166534; font-weight:500;">${classes.join(", ")}</td>`;
            } else {
                 html += `<td style="color:#ccc;">--</td>`;
            }
        }
        html += `</tr>`;
    });
    html += `</tbody></table></div>`;
    return html;
}

init();