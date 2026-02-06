import { apiFetch } from './auth.js';
import { websocketManager } from './websocket_manager.js';

class BranchManager {
    constructor() {
        this.current_branch = 'all';
        this.current_date = new Date().toISOString().split('T')[0];
        this.observers = []; 
        this.init();
        this.setupWebSocketListeners();
    }

    init() {
        this.setup_event_listeners();
        this.notify_observers();
    }

    
    add_observer(callback) {
        this.observers.push(callback);
    }

    
    notify_observers() {
        this.observers.forEach(callback => {
            try {
                callback(this.current_branch, this.current_date);
            } catch (error) {
                console.error('Error in branch observer:', error);
            }
        });
    }

    setup_event_listeners() {
    
    const branch_buttons = document.querySelectorAll('#branchSwitch button');
    branch_buttons.forEach(button => {
        button.addEventListener('click', (e) => {
            this.switch_branch(e.target.dataset.branch, e.target);
        });
    });

    
    const mobile_buttons = document.querySelectorAll('#branchSwitchMobile .dropdown-item');
    mobile_buttons.forEach(button => {
        button.addEventListener('click', (e) => {
            this.switch_branch(e.target.dataset.branch, e.target);
        });
    });
}

switch_branch(branch, target_element) {
    
    document.querySelectorAll('#branchSwitch button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    
    document.querySelectorAll('#branchSwitchMobile .dropdown-item').forEach(btn => {
        btn.classList.remove('active');
    });

    
    if (target_element) {
        target_element.classList.add('active');
    }

    
    const dropdown_button = document.querySelector('#branchSwitchMobile').closest('.dropdown').querySelector('.dropdown-toggle');
    if (dropdown_button && target_element) {
        dropdown_button.textContent = target_element.textContent;
    }

    this.current_branch = branch;
    this.notify_observers();
}

    
    async fetch_with_branch_filter(url, options = {}) {
        try {
            let final_url = url;
            
            
            if (this.current_branch !== 'all') {
                const separator = url.includes('?') ? '&' : '?';
                final_url = `${url}${separator}branch=${this.current_branch}`;
            }

            const resp = await apiFetch(final_url, options);
            
            if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
            
            return await resp.json();
        } catch (err) {
            console.error('Ошибка загрузки данных:', err);
            throw err;
        }
    }

    
    async load_appointments_for_current_branch() {
        try {
            let url = `/appointments_by_date/${this.current_date}`;
            const appointments = await this.fetch_with_branch_filter(url);
            const filtered_appointments = this.filter_appointments_by_branch(appointments);
            this.update_appointments_display(filtered_appointments);
        } catch (err) {
            console.error('Ошибка загрузки записей:', err);
        }
    }

    filter_appointments_by_branch(appointments) {
        if (this.current_branch === 'all') {
            return appointments;
        }

        return appointments.filter(appointment => {
            const user = appointment.user;
            if (!user) return false;

            if (this.current_branch === 'baitursynov') {
                return user.baitursynov === true;
            } else if (this.current_branch === 'gagarina') {
                return user.gagarina === true;
            }
            return false;
        });
    }

    update_appointments_display(appointments) {
        
        document.querySelectorAll(".quarter, .hour-row-2").forEach((el) => {
            el.classList.remove("booked");
            el.removeAttribute("title");
            let old_record = el.querySelector(".booking");
            if (old_record) old_record.remove();
        });

        let grouped = {};
        appointments.forEach((app) => {
            let time = new Date(app.date_of_appointment);
            let hours = time.getHours().toString().padStart(2, "0");
            let minutes = time.getMinutes().toString().padStart(2, "0");
            let slot = `${hours}:${minutes}`;

            let fname = app.user?.f_name ?? "";
            let lname = app.user?.l_name ?? "";
            let user_name = (fname + " " + lname).trim() || "Занято";

            if (!grouped[slot]) grouped[slot] = [];
            grouped[slot].push(user_name);
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

    set_date(date_str) {
        this.current_date = date_str;
        this.notify_observers();
    }

    get_current_branch() {
        return this.current_branch;
    }

    get_current_date() {
        return this.current_date;
    }

    setupWebSocketListeners() {
        websocketManager.on('appointment_updated', (data) => {
            if (this.shouldUpdate(data)) {
                this.load_appointments_for_current_branch();
            }
        });

        websocketManager.on('client_updated', () => {
        });

        websocketManager.on('task_updated', () => {
            if (window.location.pathname.includes('tasks.html')) {
                this.notify_observers();
            }
        });
    }

    shouldUpdate(data) {
        const currentBranch = this.get_current_branch();
        const currentDate = this.get_current_date();
        
        return (data.branch === 'all' || data.branch === currentBranch) &&
               data.date === currentDate;
    }
}

export const branch_manager = new BranchManager();