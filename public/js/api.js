const API_URL = "/api";

const api = {
  baseURL: API_URL,
  async request(endpoint, options = {}) {
    const token = localStorage.getItem("token");

    const headers = { ...options.headers };

    // Set default Content-Type to JSON unless it's FormData (browser sets boundary) or already set
    if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // Handle unauthorized/token expired
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        if (window.location.pathname !== "/pages/login.html") {
          window.location.href = "/pages/login.html";
        }
      }
      throw new Error(data.message || "Something went wrong");
    }

    return data;
  },

  get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  },

  post(endpoint, body) {
    const isFormData = body instanceof FormData;
    return this.request(endpoint, {
      method: "POST",
      body: isFormData ? body : JSON.stringify(body),
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  },
};
