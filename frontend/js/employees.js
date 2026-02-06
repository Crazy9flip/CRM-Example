import { apiFetch } from "./auth.js";

async function loadUsers() {
  try {
    const response = await apiFetch("/users");
    if (!response.ok) throw new Error("Ошибка загрузки сотрудников");

    const users = await response.json();
    const tbody = document.getElementById("usersTableBody");
    tbody.innerHTML = "";

    users.forEach((user) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${user.id}</td>
        <td>${user.f_name ?? ""}</td>
        <td>${user.l_name ?? ""}</td>
        <td>${user.m_name ?? ""}</td>
        <td>${user.email ?? ""}</td>
        <td>${user.position ?? ""}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error("Ошибка:", err);
  }
}

document.addEventListener("DOMContentLoaded", loadUsers);
