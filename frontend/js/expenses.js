import { apiFetch } from "./auth.js"


async function loadExpenses() {
    try {
        const response = await apiFetch("/expenses")
        if (!response.ok) throw new Error("Ошибка загрузки расходов")

        const expenses = await response.json()
        const tbody = document.getElementById("expensesTableBody")
        tbody.innerHTML = ""

        expenses.forEach((exp) => {
            const row = document.createElement("tr")
            row.innerHTML = `
                <td>${exp.id}</td>
                <td>${exp.name ?? ""}</td>
                <td>${exp.expense ?? 0}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-danger delete-expense-btn" data-id="${exp.id}">
                        <i class="bi bi-dash-lg"></i> Удалить
                    </button>
                </td>
            `
            tbody.appendChild(row)
        })

        
        tbody.querySelectorAll(".delete-expense-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.id
                deleteExpense(id)
            })
        })
    } catch (err) {
        console.error("Ошибка:", err)
    }
}


async function addExpense(e) {
    e.preventDefault()

    const name = document.getElementById("name").value.trim()
    const expense = parseInt(document.getElementById("expense").value.trim())

    if (!name || isNaN(expense)) {
        alert("Введите название и сумму")
        return
    }

    try {
        const response = await apiFetch("/expenses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, expense })
        })

        if (!response.ok) throw new Error("Ошибка добавления расхода")

        
        const modalEl = document.getElementById("expenseModal")
        bootstrap.Modal.getInstance(modalEl).hide()

        
        document.getElementById("expenseForm").reset()

        await loadExpenses()
    } catch (err) {
        console.error("Ошибка:", err)
        alert("Ошибка добавления расхода")
    }
}


async function deleteExpense(id) {
    if (!confirm("Удалить расход?")) return

    try {
        const response = await apiFetch(`/expenses/${id}`, {
            method: "DELETE"
        })

        if (!response.ok) throw new Error("Ошибка удаления")

        await loadExpenses()
    } catch (err) {
        console.error("Ошибка:", err)
        alert("Ошибка при удалении расхода")
    }
}


document.addEventListener("DOMContentLoaded", () => {
    loadExpenses()

    
    document.getElementById("addExpenseBtn").addEventListener("click", () => {
        const modal = new bootstrap.Modal(
            document.getElementById("expenseModal")
        )
        modal.show()
    })

    
    document.getElementById("expenseForm").addEventListener("submit", addExpense)
})
