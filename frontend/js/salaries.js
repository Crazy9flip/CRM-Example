import { apiFetch } from "./auth.js";

async function loadSalaries(startDate, endDate) {
  try {
    let url = "/salaries";
    if (startDate && endDate) {
      url += `?start_date=${startDate}&end_date=${endDate}`;
    }

    const response = await apiFetch(url);
    if (!response.ok) throw new Error("Ошибка загрузки зарплат");

    const salaries = await response.json();
    const tbody = document.getElementById("salariesTableBody");
    tbody.innerHTML = "";

    salaries.forEach((s) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${s.id}</td>
        <td>${s.f_name ?? ""}</td>
        <td>${s.l_name ?? ""}</td>
        <td>${s.m_name ?? ""}</td>
        <td>${s.salary ?? 0}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error("Ошибка:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadSalaries();

  document.getElementById("filterBtn").addEventListener("click", () => {
    const start = document.getElementById("startDate").value;
    const end = document.getElementById("endDate").value;
    loadSalaries(start, end);
  });
});
