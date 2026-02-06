import { apiFetch } from "./auth.js";
import { branch_manager } from "./branch_manager.js"; 
import { websocketManager } from './websocket_manager.js';

class TasksManager {
    constructor() {
        this.current_date = new Date().toISOString().split('T')[0];
        this.init();
        this.setupWebSocketListeners();
    }

    async init() {
        
        branch_manager.add_observer((branch, date) => {
            this.loadAppointmentsForTasks(date || this.current_date);
        });

        
        this.loadAppointmentsForTasks(this.current_date);
        
        
        this.initCalendar();
    }

    initCalendar() {
        let now = new Date();
        this.createCalendar(document.getElementById("calendar"), now.getFullYear(), now.getMonth() + 1);
    }

    createCalendar(elem, year, month) {
        elem.innerHTML = "";

        let mon = month - 1;
        let d = new Date(year, mon);

        let header = document.createElement("div");
        header.className = "d-flex justify-content-between align-items-center mb-2";
        header.innerHTML = `
            <button class="btn btn-sm btn-light" id="prevMonth">&lt;</button>
            <strong>${
                d.toLocaleString("ru", { month: "long" }).charAt(0).toUpperCase() +
                d.toLocaleString("ru", { month: "long" }).slice(1)
            } ${year}</strong>
            <button class="btn btn-sm btn-light" id="nextMonth">&gt;</button>
        `;
        elem.appendChild(header);

        let table = document.createElement("table");
        table.className = "table table-sm text-center mb-0";
        table.innerHTML = `
            <thead><tr>
                <th>пн</th><th>вт</th><th>ср</th><th>чт</th>
                <th>пт</th><th>сб</th><th>вс</th>
            </tr></thead>
            <tbody></tbody>
        `;
        let tbody = table.querySelector("tbody");

        let firstDay = (d.getDay() + 6) % 7;
        let tr = document.createElement("tr");
        for (let i = 0; i < firstDay; i++) tr.appendChild(document.createElement("td"));

        while (d.getMonth() === mon) {
            let td = document.createElement("td");
            td.textContent = d.getDate();

            let today = new Date();
            if (
                d.getDate() === today.getDate() &&
                d.getMonth() === today.getMonth() &&
                d.getFullYear() === today.getFullYear()
            ) td.classList.add("bg-warning");

            let dayNum = d.getDate();
            
            
            td.addEventListener("click", () => {
                table.querySelectorAll("td").forEach(cell => cell.classList.remove("bg-warning"));
                td.classList.add("bg-warning");

                let selectedDate = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                this.current_date = selectedDate;
                branch_manager.set_date(selectedDate); 
            });

            tr.appendChild(td);
            if (tr.children.length === 7) {
                tbody.appendChild(tr);
                tr = document.createElement("tr");
            }

            d.setDate(d.getDate() + 1);
        }

        if (tr.children.length) while (tr.children.length < 7) tr.appendChild(document.createElement("td"));
        tbody.appendChild(tr);

        elem.appendChild(table);

        document.getElementById("prevMonth").onclick = () => {
            if (month === 1) { year--; month = 12; } else month--;
            this.createCalendar(elem, year, month);
        };
        document.getElementById("nextMonth").onclick = () => {
            if (month === 12) { year++; month = 1; } else month++;
            this.createCalendar(elem, year, month);
        };
    }

    
    async loadAppointmentsForTasks(dateStr) {
        const container = document.getElementById("appointmentsContainer");
        if (!container) return;

        container.innerHTML = `<div class="text-center p-3 text-muted">Загрузка...</div>`;

        try {
            
            const appointments = await branch_manager.fetch_with_branch_filter(`/appointments_by_date/${dateStr}`);
            
            if (appointments.length === 0) {
                container.innerHTML = `<div class="alert alert-info">Записей нет</div>`;
                return;
            }

            container.innerHTML = "";
            appointments.forEach(app => {
                const div = document.createElement("div");
                div.classList.add("card", "mb-2", "p-2");
                div.setAttribute("data-app-id", app.id);

                const created = new Date(app.date_of_creation).toLocaleString("ru-RU");
                const planned = new Date(app.date_of_appointment).toLocaleString("ru-RU");

                const clients = app.clients
                    ? `${app.clients.f_name || ""} ${app.clients.l_name || ""} (${app.clients.phone || ""})`
                    : "Клиент не указан";

                const user = app.user
                    ? `${app.user.f_name || ""} ${app.user.l_name || ""}`
                    : "Сотрудник не указан";

                div.innerHTML = `
                    <p><b>Создано:</b> ${created}</p>
                    <p><b>Запись на:</b> ${planned}</p>
                    <p><b>Клиент:</b> ${clients}</p>
                    <p><b>Специалист:</b> ${user}</p>
                    <button class="btn btn-primary btn-block mb-2 details-btn" data-bs-toggle="modal" data-bs-target="#appointmentDetailsModal">Детали</button>
                    <button class="btn btn-success btn-block finish-btn mb-2">Завершить</button>
                    <button class="btn btn-outline-danger btn-block delete-btn">Удалить</button>
                `;

                div.querySelector(".finish-btn").addEventListener("click", async () => {
                    const resp = await apiFetch(`/appointments/${app.id}/finish`, { method: "PUT" });
                    if (resp.ok) div.remove(); else alert("Ошибка при завершении");
                });

                div.querySelector(".delete-btn").addEventListener("click", async () => {
                    const resp = await apiFetch(`/appointments/${app.id}`, { method: "DELETE" });
                    if (resp.ok) div.remove(); else alert("Ошибка при удалении");
                });

                div.querySelector(".details-btn").addEventListener("click", () => {
                    document.getElementById("appointmentDetailsBody").innerHTML = `
                        <p><b>Создано:</b> ${created}</p>
                        <p><b>Запись на:</b> ${planned}</p>
                        <p><b>Клиент:</b> ${clients}</p>
                        <p><b>Специалист:</b> ${user}</p>
                        <hr>
                        <p><b>Цена:</b> ${app.price ?? "—"}</p>
                        <p><b>Курс:</b> ${app.course ?? "—"}</p>
                        <p><b>Скидка:</b> ${app.discount ?? "—"}</p>
                        <p><b>Тип оплаты:</b> ${app.type_of_payment ?? "—"}</p>
                        <p><b>Тип массажа:</b> ${app.type_of_massage ?? "—"}</p>
                        <p><b>Длительность:</b> ${app.duration ?? "—"}</p>
                        <p><b>Услуга:</b> ${app.service ?? "—"}</p>
                    `;
                    document.getElementById("deleteAppointmentBtn").dataset.id = app.id;
                    document.getElementById("finishAppointmentBtn").dataset.id = app.id;
                });

                container.appendChild(div);
            });
        } catch (err) {
            console.error(err);
            container.innerHTML = `<div class="alert alert-danger">Не удалось загрузить записи</div>`;
        }
    }
    setupWebSocketListeners() {
        websocketManager.on('appointment_updated', (data) => {
            if (this.shouldUpdateTasks(data)) {
                this.loadAppointmentsForTasks(this.current_date);
            }
        });

        websocketManager.on('task_completed', (data) => {
            
            this.updateTaskUI(data.taskId);
        });
    }

    shouldUpdateTasks(data) {
        return data.date === this.current_date;
    }

    updateTaskUI(taskId) {
        
        const taskElement = document.querySelector(`[data-app-id="${taskId}"]`);
        if (taskElement) {
            taskElement.classList.add('completed');
            
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
    new TasksManager();
});


const modalEl = document.getElementById("appointmentDetailsModal");
const deleteBtn = document.getElementById("deleteAppointmentBtn");
const finishBtn = document.getElementById("finishAppointmentBtn");

deleteBtn.addEventListener("click", async () => {
    const appId = deleteBtn.dataset.id;
    if (!appId) return;
    const resp = await apiFetch(`/appointments/${appId}`, { method: "DELETE" });
    if (resp.ok) {
        document.querySelector(`[data-app-id="${appId}"]`)?.remove();
        bootstrap.Modal.getInstance(modalEl).hide();
    } else {
        alert("Ошибка при удалении");
    }
});

finishBtn.addEventListener("click", async () => {
    const appId = finishBtn.dataset.id;
    if (!appId) return;
    const resp = await apiFetch(`/appointments/${appId}/finish`, { method: "PUT" });
    if (resp.ok) {
        document.querySelector(`[data-app-id="${appId}"]`)?.remove();
        bootstrap.Modal.getInstance(modalEl).hide();
    } else {
        alert("Ошибка при завершении");
    }
});