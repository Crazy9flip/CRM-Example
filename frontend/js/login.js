import { apiFetch } from "./auth.js";


const isLocalhost = location.hostname === "127.0.0.1" || location.hostname === "localhost";

const API_URL = isLocalhost
  ? "http://127.0.0.1:8000"
  : "http://api.example.com"; 

const loginForm = document.getElementById("loginForm");
const testBtn = document.getElementById("testBtn");
const output = document.getElementById("output");

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email_label").value;
    const password = document.getElementById("password_label").value;

    // const res = await fetch("http://127.0.0.1:8000/login", {
    const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: email, password }),
        credentials: "include",
    });

    if (res.ok) {
        window.location.href = "/index.html";
    } else {
        output.innerText = "Ошибка входа";
    }
});
