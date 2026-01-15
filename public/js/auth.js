const auth = {
  async login(email, password) {
    try {
      const data = await api.post("/auth/login", { email, password });
      return data; // Return data so login.html can check otpRequired
    } catch (error) {
      throw error;
    }
  },

  async verifyOTP(email, otp) {
    try {
      const data = await api.post("/auth/verify-otp", { email, otp });
      this.setSession(data.token, data.user);
      return data;
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
    window.location.href = "/pages/login";
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
      !window.location.pathname.includes("/login")
    ) {
      window.location.href = "/pages/login";
    }
  },
};

// Auto-run auth check
auth.checkAuth();
