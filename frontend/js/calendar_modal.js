const dateInput = document.getElementById("dateInput")
const miniCalendar = document.getElementById("miniCalendar")
const timeInput = document.getElementById("timeInput")

if (dateInput && miniCalendar) {
    let today = new Date();
    dateInput.value = today.toLocaleDateString("ru-RU");

    dateInput.addEventListener("click", (e) => {
        e.stopPropagation();
        miniCalendar.classList.toggle("d-none");
    });

    document.addEventListener("click", (e) => {
        const datePickerWrap = document.getElementById("datePickerWrap");
        if (datePickerWrap && !datePickerWrap.contains(e.target)) {
            miniCalendar.classList.add("d-none");
        }
    });

    function createMiniCalendar(elem, year, month) {
        if (!elem) return;
        
        elem.innerHTML = "";
        let d = new Date(year, month - 1);
    }

    createMiniCalendar(miniCalendar, today.getFullYear(), today.getMonth() + 1);
}

if (timeInput) {
    timeInput.addEventListener("blur", () => {
        let val = timeInput.value.replace(/\D/g, "");
        if (val.length === 2) {
            timeInput.value = val + ":00";
        } else if (val.length === 4) {
            timeInput.value = val.slice(0, 2) + ":" + val.slice(2);
        }
    });
}

let today = new Date()
dateInput.value = today.toLocaleDateString("ru-RU")

dateInput.addEventListener("click", (e) => {
    e.stopPropagation()
    miniCalendar.classList.toggle("d-none")
})

document.addEventListener("click", (e) => {
    if (!document.getElementById("datePickerWrap").contains(e.target)) {
        miniCalendar.classList.add("d-none")
    }
})

function createMiniCalendar(elem, year, month) {
    elem.innerHTML = ""
    let d = new Date(year, month - 1)

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
    for (let i = 0; i < firstDay; i++)
        tr.appendChild(document.createElement("td"))

    while (d.getMonth() === month - 1) {
        let td = document.createElement("td")
        td.textContent = d.getDate()

        td.addEventListener("click", () => {
            const selectedDate = d.toISOString().split('T')[0]; 
            dateInput.value = d.toLocaleDateString("ru-RU")
            miniCalendar.classList.add("d-none")
            
            branch_manager.set_date(selectedDate);
        })

        tr.appendChild(td)
        if (tr.children.length === 7) {
            tbody.appendChild(tr)
            tr = document.createElement("tr")
        }
        d.setDate(d.getDate() + 1)
    }
    if (tr.children.length) tbody.appendChild(tr)
    elem.appendChild(table)
}

createMiniCalendar(miniCalendar, today.getFullYear(), today.getMonth() + 1)

timeInput.addEventListener("blur", () => {
    let val = timeInput.value.replace(/\D/g, "")
    if (val.length === 2) {
        timeInput.value = val + ":00"
    } else if (val.length === 4) {
        timeInput.value = val.slice(0, 2) + ":" + val.slice(2)
    }
})