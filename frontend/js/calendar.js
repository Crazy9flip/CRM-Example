
import { apiFetch } from "./auth.js"
import { branch_manager } from "./branch_manager.js"
import { websocketManager } from "./websocket_manager.js"

function createCalendar(elem, year, month) {
    elem.innerHTML = ""

    let mon = month - 1
    let d = new Date(year, mon)

    let header = document.createElement("div")
    header.className = "d-flex justify-content-between align-items-center mb-2"
    header.innerHTML = `
    <button class="btn btn-sm btn-light" id="prevMonth">&lt;</button>
    <strong>${
        d.toLocaleString("ru", { month: "long" }).charAt(0).toUpperCase() +
        d.toLocaleString("ru", { month: "long" }).slice(1)
    } ${year}</strong>
    <button class="btn btn-sm btn-light" id="nextMonth">&gt;</button>
  `
    elem.appendChild(header)

    let table = document.createElement("table")
    table.className = "table table-sm text-center mb-0"
    table.innerHTML = `
    <thead><tr>
      <th>пн</th><th>вт</th><th>ср</th><th>чт</th>
      <th>пт</th><th>сб</th><th>вс</th>
    </tr></thead>
    <tbody></tbody>
  `
    let tbody = table.querySelector("tbody")

    let firstDay = (d.getDay() + 6) % 7
    let tr = document.createElement("tr")
    for (let i = 0; i < firstDay; i++) {
        tr.appendChild(document.createElement("td"))
    }

    while (d.getMonth() === mon) {
        let td = document.createElement("td")
        td.textContent = d.getDate()

        let today = new Date()
        if (
            d.getDate() === today.getDate() &&
            d.getMonth() === today.getMonth() &&
            d.getFullYear() === today.getFullYear()
        ) {
            td.classList.add("bg-warning")
        }
        let dayNum = d.getDate()

        td.addEventListener("click", () => {
            table
                .querySelectorAll("td")
                .forEach((cell) => cell.classList.remove("bg-warning"))

            td.classList.add("bg-warning")

            let selectedDate = `${year}-${String(month).padStart(
                2,
                "0"
            )}-${String(dayNum).padStart(2, "0")}`

            
            branch_manager.set_date(selectedDate)
        })

        tr.appendChild(td)

        if (tr.children.length === 7) {
            tbody.appendChild(tr)
            tr = document.createElement("tr")
        }

        d.setDate(d.getDate() + 1)
    }

    if (tr.children.length) {
        while (tr.children.length < 7) {
            tr.appendChild(document.createElement("td"))
        }
        tbody.appendChild(tr)
    }

    elem.appendChild(table)

    document.getElementById("prevMonth").onclick = () => {
        if (month === 1) {
            year--
            month = 12
        } else {
            month--
        }
        createCalendar(elem, year, month)
    }

    document.getElementById("nextMonth").onclick = () => {
        if (month === 12) {
            year++
            month = 1
        } else {
            month++
        }
        createCalendar(elem, year, month)
    }
}


function setupCalendarWebSocketListeners() {
    console.log('Setting up calendar WebSocket listeners...');
    
    
    websocketManager.on('appointment_created', (data) => {
        console.log('WebSocket: appointment_created received', data);
        if (shouldUpdateCalendar(data)) {
            console.log('Reloading appointments due to appointment_created');
            loadAppointments(branch_manager.get_current_date());
            showVisualNotification('Новая запись добавлена', 'success');
        } else {
            console.log('Skipping update - not relevant for current view', {
                dataDate: data.date,
                currentDate: branch_manager.get_current_date(),
                dataBranch: data.branch,
                currentBranch: branch_manager.get_current_branch()
            });
        }
    });

    
    websocketManager.on('appointment_deleted', (data) => {
        console.log('WebSocket: appointment_deleted received', data);
        if (shouldUpdateCalendar(data)) {
            console.log('Reloading appointments due to appointment_deleted');
            loadAppointments(branch_manager.get_current_date());
            showVisualNotification('Запись удалена', 'warning');
        }
    });

    
    websocketManager.on('appointment_completed', (data) => {
        console.log('WebSocket: appointment_completed received', data);
        if (shouldUpdateCalendar(data)) {
            console.log('Reloading appointments due to appointment_completed');
            loadAppointments(branch_manager.get_current_date());
            showVisualNotification('Запись завершена', 'success');
        }
    });
}


function shouldUpdateCalendar(data) {
    const currentBranch = branch_manager.get_current_branch();
    const currentDate = branch_manager.get_current_date();
    

    const shouldUpdate = (data.branch === 'all' || data.branch === currentBranch) &&
                       data.date === currentDate;
    
    console.log('Should update calendar:', shouldUpdate, { 
        data, 
        currentBranch, 
        currentDate,
        branchMatch: data.branch === 'all' || data.branch === currentBranch,
        dateMatch: data.date === currentDate
    });
    return shouldUpdate;
}


function showVisualNotification(message, type = 'info') {
    
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = `
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
    `;
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}


function updateCalendarUI(appointments) {
    console.log('Updating calendar UI with', appointments.length, 'appointments');
    
    
    document.querySelectorAll(".quarter, .hour-row-2").forEach((el) => {
        el.classList.remove("booked");
        el.removeAttribute("title");

        let oldRecord = el.querySelector(".booking");
        if (oldRecord) oldRecord.remove();
    });

    
    let grouped = {};
    appointments.forEach((app) => {
        let time = new Date(app.date_of_appointment);
        let hours = time.getHours().toString().padStart(2, "0");
        let minutes = time.getMinutes().toString().padStart(2, "0");
        let slot = `${hours}:${minutes}`;

        let fname = app.user?.f_name ?? "";
        let lname = app.user?.l_name ?? "";
        let userName = (fname + " " + lname).trim() || "Занято";

        if (!grouped[slot]) grouped[slot] = [];
        grouped[slot].push(userName);
    });

    
    Object.entries(grouped).forEach(([slot, users]) => {
        let el = document.querySelector(`[data-time="${slot}"]`);
        if (el) {
            el.classList.add("booked");

            let record = document.createElement("div");
            record.className = "booking";
            record.textContent = `${slot} — ${users.join(", ")}`;

            el.appendChild(record);
            el.setAttribute("title", record.textContent);
        }
    });
}


export async function loadAppointments(dateStr) {
    try {
        console.log('Loading appointments for date:', dateStr);
        
        const appointments = await branch_manager.fetch_with_branch_filter(`/appointments_by_date/${dateStr}`);
        console.log('Loaded appointments:', appointments.length);
        
        updateCalendarUI(appointments);
        
    } catch (err) {
        console.error('Error loading appointments:', err);
        showVisualNotification('Ошибка загрузки записей', 'danger');
    }
}


function initCalendar() {
    console.log('Initializing calendar...');
    
    let now = new Date();
    createCalendar(
        document.getElementById("calendar"),
        now.getFullYear(),
        now.getMonth() + 1
    );
    
    let todayStr = now.toISOString().split("T")[0];
    branch_manager.set_date(todayStr);
    
    
    setupCalendarWebSocketListeners();
    
    console.log('Calendar initialization complete');
}


branch_manager.add_observer((branch, date) => {
    console.log('Branch changed, loading appointments:', { branch, date });
    loadAppointments(date);
});


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCalendar);
} else {
    initCalendar();
}