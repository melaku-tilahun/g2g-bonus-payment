const auth = {
  async login(email, password) {
    try {
      const data = await api.post("/auth/login", { email, password });
      this.setSession(data.token, data.user);
      window.location.href = "/index.html";
    } catch (error) {
      throw error;
    }
  },

  setSession(token, user) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/pages/login.html";
  },

  getUser() {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  },

  isAuthenticated() {
    return !!localStorage.getItem("token");
  },

  checkAuth() {
    if (
      !this.isAuthenticated() &&
      !window.location.pathname.includes("/login.html")
    ) {
      window.location.href = "/pages/login.html";
    }
  },
};

// Auto-run auth check
auth.checkAuth();
