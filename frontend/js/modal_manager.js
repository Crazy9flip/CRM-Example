
import { apiFetch } from "./auth.js";
import { loadAppointments } from "./calendar.js";
import { websocketManager } from './websocket_manager.js';
import { branch_manager } from './branch_manager.js';

class ModalManager {
    constructor() {
        this.currentDate = null;
        this.currentTime = null;
        this.existingAppointments = [];
        
        this.initEventListeners();
    }

    initEventListeners() {
        document.querySelectorAll('.quarter, .hour-row-2').forEach(el => {
            el.addEventListener('click', (e) => {
                this.openModal(e.target);
            });
        });

        document.getElementById('appointmentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createAppointment();
        });
    }

    async openModal(timeElement) {
        const time = timeElement.getAttribute('data-time');
        const date = this.getSelectedDate();
        
        this.currentDate = date;
        this.currentTime = time;

        document.getElementById('selectedTime').textContent = `${time}`;
        
        document.getElementById('dateInput').value = this.formatDateForDisplay(date);
        document.getElementById('timeInput').value = time;

        await this.loadExistingAppointments(date, time);

        this.toggleSections();

        await this.loadFormData();

        const modal = new bootstrap.Modal(document.getElementById('timeModal'));
        modal.show();
    }

    getSelectedDate() {
        const selectedDay = document.querySelector('.bg-warning');
        if (selectedDay) {
            const day = selectedDay.textContent;
            const monthText = document.querySelector('#calendar strong').textContent.split(' ')[0];
            const year = document.querySelector('#calendar strong').textContent.split(' ')[1];
            
            const monthNumber = this.getMonthNumber(monthText);
            return `${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
        
        const today = new Date();
        return today.toISOString().split('T')[0];
    }

    getMonthNumber(monthName) {
        const months = {
            'январь': 1, 'февраль': 2, 'март': 3, 'апрель': 4,
            'май': 5, 'июнь': 6, 'июль': 7, 'август': 8,
            'сентябрь': 9, 'октябрь': 10, 'ноябрь': 11, 'декабрь': 12
        };
        return months[monthName.toLowerCase()];
    }

    formatDateForDisplay(dateStr) {
        const [year, month, day] = dateStr.split('-');
        return `${day}.${month}.${year}`;
    }

    async loadExistingAppointments(date, time) {
        try {
            console.log('Загрузка записей для:', date, time);
            
            const response = await apiFetch(`/appointments_by_timeslot/${date}/${time}`);
            console.log('Статус ответа:', response.status);
            
            if (response.ok) {
                this.existingAppointments = await response.json();
                console.log('Найдено записей:', this.existingAppointments.length);
                this.renderAppointmentsList();
            } else {
                console.log('Ошибка ответа:', await response.text());
                this.existingAppointments = [];
                this.renderAppointmentsList();
            }
        } catch (error) {
            console.error('Ошибка загрузки записей:', error);
            this.existingAppointments = [];
            this.renderAppointmentsList();
        }
    }

    renderAppointmentsList() {
        const container = document.getElementById('appointmentsList');
        container.innerHTML = '';

        if (this.existingAppointments.length === 0) {
            container.innerHTML = '<div class="alert alert-info">Записей нет</div>';
            return;
        }

        this.existingAppointments.forEach(appointment => {
            const card = this.createAppointmentCard(appointment);
            container.appendChild(card);
        });
    }

    createAppointmentCard(appointment) {
        const card = document.createElement('div');
        card.className = 'card mb-2';
        
        const clientName = appointment.user ? 
            `${appointment.user.f_name || ''} ${appointment.user.l_name || ''}`.trim() : 
            'Неизвестный клиент';

        card.innerHTML = `
            <div class="card-body">
                <h6 class="card-title">${clientName}</h6>
                <div class="card-text">
                    <small class="text-muted">
                        <strong>Время:</strong> ${new Date(appointment.date_of_appointment).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}<br>
                        <strong>Создано:</strong> ${new Date(appointment.date_of_creation).toLocaleDateString('ru-RU')}
                    </small>
                </div>
                <div class="mt-2">
                    <button class="btn btn-sm btn-outline-danger" onclick="modalManager.cancelAppointment(${appointment.id})">
                        Отменить
                    </button>
                </div>
            </div>
        `;

        return card;
    }

    toggleSections() {
        const createSection = document.getElementById('createAppointmentSection');
        const existingSection = document.getElementById('existingAppointmentsSection');
        const modalDialog = document.querySelector('.modal-dialog');

        if (this.existingAppointments.length > 0) {
            createSection.className = 'col-md-6';
            existingSection.className = 'col-md-6';
            existingSection.style.display = 'block';
            modalDialog.classList.add('modal-lg');
        } else {
            createSection.className = 'col-12'; 
            existingSection.style.display = 'none';
            modalDialog.classList.remove('modal-lg');
        }
    }

    async loadFormData() {
        await this.loadSelectOptions('/clients', 'clientSelect', 'f_name', 'l_name');
        await this.loadSelectOptions('/specialists', 'specialistSelect', 'f_name', 'l_name');
    }

    async loadSelectOptions(endpoint, selectId, ...fields) {
        try {
            const response = await apiFetch(endpoint);  
            if (response.ok) {
                const data = await response.json();
                const select = document.getElementById(selectId);

                while (select.options.length > 1) {
                    select.remove(1);
                }

                data.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.id;

                    const textParts = fields.map(field => item[field] || '');
                    const displayText = textParts.filter(Boolean).join(' ');
                    option.textContent = displayText || `ID: ${item.id}`;

                    select.appendChild(option);
                });

                console.log(`Загружены данные для ${selectId}:`, data);
            }
        } catch (error) {
            console.error(`Ошибка загрузки данных для ${selectId}:`, error);
        }
    }

    async createAppointment() {
        const clientSelect = document.getElementById('clientSelect');
        const specialistSelect = document.getElementById('specialistSelect');
        
        if (!clientSelect.value || !specialistSelect.value) {
            alert('Пожалуйста, выберите клиента и специалиста');
            return;
        }

        const formData = {
            user_id: parseInt(specialistSelect.value, 10),     
            client_id: parseInt(clientSelect.value, 10),       
            date_of_appointment: `${this.currentDate}T${this.currentTime}:00`,
            price: document.getElementById('priceInput').value ? parseInt(document.getElementById('priceInput').value, 10) : null,
            course: document.getElementById('courseInput').value || null,
            discount: document.getElementById('discountInput').value ? parseInt(document.getElementById('discountInput').value, 10) : null,
            type_of_payment: document.getElementById('paymentInput').value || null,
            type_of_massage: document.getElementById('massageInput').value || null,
            duration: document.getElementById('durationInput').value ? parseInt(document.getElementById('durationInput').value, 10) : null,
            service: document.getElementById('serviceInput').value || null
        };

        console.log('Отправка данных:', formData);

        try {
            const response = await apiFetch('/appointments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Успешный ответ:', result);
                alert('Запись успешно создана!');
                
                
                websocketManager.send('appointment_created', {
                    date: this.currentDate,
                    branch: branch_manager.get_current_branch(),
                    appointment: formData
                }).then(success => {
                    console.log('WebSocket message sent:', success);
                }).catch(error => {
                    console.warn('Failed to send WebSocket message:', error);
                });

                const modalEl = document.getElementById('timeModal');
                bootstrap.Modal.getInstance(modalEl).hide();

                setTimeout(() => {
                    const backdrop = document.querySelector('.modal-backdrop');
                    if (backdrop) backdrop.remove();
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = 'auto';
                }, 200);

                await loadAppointments(this.currentDate);
            } else {
                const error = await response.json();
                console.log('Ошибка ответа:', error);
                alert(`Ошибка при создании записи: ${error.detail || 'Неизвестная ошибка'}`);
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при создании записи');
        }
    }

    async cancelAppointment(appointmentId) {
        if (!confirm('Вы уверены, что хотите отменить запись?')) return;

        try {
            const response = await apiFetch(`/appointments/${appointmentId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                
                websocketManager.send('appointment_deleted', {
                    date: this.currentDate,
                    branch: branch_manager.get_current_branch(),
                    appointmentId: appointmentId
                }).then(success => {
                    console.log('WebSocket deletion message sent:', success);
                }).catch(error => {
                    console.warn('Failed to send WebSocket deletion message:', error);
                });

                await this.loadExistingAppointments(this.currentDate, this.currentTime);
                this.toggleSections();
                
                await loadAppointments(this.currentDate);
            } else {
                alert('Ошибка при отмене записи');
            }
        } catch (error) {
            console.error('Ошибка отмены записи:', error);
            alert('Ошибка при отмене записи');
        }
    }
}

const modalManager = new ModalManager();
window.modalManager = modalManager;