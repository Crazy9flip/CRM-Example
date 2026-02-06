
const isLocalhost = location.hostname === "127.0.0.1" || location.hostname === "localhost";

const API_URL = isLocalhost
  ? "http://127.0.0.1:8000"
  : "http://api.example.com"; 


export async function apiFetch(endpoint, options = {}) {
    const opts = {
        credentials: "include", 
        ...options,
    };

    const res = await fetch(`${API_URL}${endpoint}`, opts);

    if (res.status === 401) {
        const refreshed = await refreshToken();
        if (refreshed) {
            return apiFetch(endpoint, options);
        } else {
            window.location.href = "/login.html"; 
        }
    }

    return res;
}

async function refreshToken() {
    try {
        const res = await fetch(`${API_URL}/refresh`, {
            method: "POST",
            credentials: "include",
        });
        return res.ok;
    } catch {
        return false;
    }
}

export async function checkAuth() {
    const res = await apiFetch("/protected");
    return res.ok;
}

export async function logout() {
    await fetch(`${API_URL}/logout`, {
        method: "POST",
        credentials: "include"
    });
    window.location.href = "/login.html"; 
}