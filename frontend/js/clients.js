import { apiFetch } from "./auth.js"


async function loadClients() {
    try {
        const response = await apiFetch("/clients")
        if (!response.ok) throw new Error("Ошибка загрузки клиентов")

        const clients = await response.json()
        const tbody = document.getElementById("clientsTableBody")
        tbody.innerHTML = ""

        clients.forEach((client) => {
            const row = document.createElement("tr")
            row.innerHTML = `
  <td>${client.id}</td>
  <td>${client.f_name ?? ""}</td>
  <td>${client.l_name ?? ""}</td>
  <td>${client.m_name ?? ""}</td>
  <td>${client.phone ?? ""}</td>
  <td>${client.email ?? ""}</td>
  <td class="text-center">
    <button class="btn btn-sm btn-outline-danger delete-client-btn" data-id="${
        client.id
    }">
      <i class="bi bi-dash-lg"></i> Удалить
    </button>
  </td>
`

            tbody.appendChild(row)
        })

        
        tbody.querySelectorAll(".delete-client-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.id
                deleteClient(id)
            })
        })
    } catch (err) {
        console.error("Ошибка:", err)
    }
}


async function addClient(e) {
    e.preventDefault()

    const f_name = document.getElementById("f_name").value.trim()
    const l_name = document.getElementById("l_name").value.trim()
    const m_name = document.getElementById("m_name").value.trim()
    const phone = document.getElementById("phone").value.trim()
    const email = document.getElementById("email").value.trim()

    if (!f_name || !l_name) {
        alert("Имя и фамилия обязательны")
        return
    }

    try {
        const response = await apiFetch("/clients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ f_name, l_name, m_name, phone, email })
        })

        if (!response.ok) throw new Error("Ошибка добавления клиента")

        
        const modalEl = document.getElementById("clientModal")
        bootstrap.Modal.getInstance(modalEl).hide()

        
        document.getElementById("clientForm").reset()

        await loadClients()
    } catch (err) {
        console.error("Ошибка:", err)
        alert("Ошибка добавления клиента")
    }
}


async function deleteClient(id) {
    if (!confirm("Удалить клиента?")) return

    try {
        const response = await apiFetch(`/clients/${id}`, {
            method: "DELETE"
        })

        if (!response.ok) throw new Error("Ошибка удаления")

        await loadClients()
    } catch (err) {
        console.error("Ошибка:", err)
        alert("Ошибка при удалении клиента")
    }
}


document.addEventListener("DOMContentLoaded", () => {
    loadClients()

    
    document.getElementById("addClientBtn").addEventListener("click", () => {
        const modal = new bootstrap.Modal(
            document.getElementById("clientModal")
        )
        modal.show()
    })

    
    document.getElementById("clientForm").addEventListener("submit", addClient)
})
