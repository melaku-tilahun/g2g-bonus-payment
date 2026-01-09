document.addEventListener("DOMContentLoaded", () => {
  auth.checkAuth();
  const user = auth.getUser();
  const isAdmin = user && user.role === "admin";
  const currentPath = window.location.pathname;

  // Modern Navigation HTML
  const navHtml = `
    <nav class="navbar navbar-expand-lg navbar-modern mb-5 sticky-top">
        <div class="container-fluid px-4">
            <a class="navbar-brand d-flex align-items-center" href="/index.html">
                 BonusTracker
            </a>
            
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-lg-4 me-auto">
                    <li class="nav-item">
                        <a class="nav-link ${
                          currentPath === "/index.html" || currentPath === "/"
                            ? "active"
                            : ""
                        }" href="/index.html">Dashboard</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${
                          currentPath.includes("pending-payments.html")
                            ? "active"
                            : ""
                        }" href="/pages/pending-payments.html">Pending</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${
                          currentPath.includes("verified-drivers.html")
                            ? "active"
                            : ""
                        }" href="/pages/verified-drivers.html">Verified</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${
                          currentPath.includes("unverified-drivers.html")
                            ? "active"
                            : ""
                        }" href="/pages/unverified-drivers.html">Unverified</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${
                          currentPath.includes("payments.html") ? "active" : ""
                        }" href="/pages/payments.html">Payment History</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${
                          currentPath.includes("upload.html") ? "active" : ""
                        }" href="/pages/upload.html">Upload</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${
                          currentPath.includes("search.html") ? "active" : ""
                        }" href="/pages/search.html">Search</a>
                    </li>
                   
                    ${
                      isAdmin
                        ? `
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" id="adminDropdown" role="button">Admin</a>
                        <ul class="dropdown-menu border-0 shadow-sm">
                            <li><a class="dropdown-item" href="/pages/users.html">User Management</a></li>
                            <li><a class="dropdown-item" href="/pages/audit-logs.html">Audit Trail</a></li>
                        </ul>
                    </li>
                    `
                        : ""
                    }
                </ul>
                
                <div class="d-flex align-items-center">
                    <div class="user-profile-nav me-3 d-none d-md-flex">
                        <div class="avatar-circle bg-primary text-white d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; border-radius: 50%; font-weight: 700; font-size: 0.8rem;">
                            ${user ? user.full_name.charAt(0) : "U"}
                        </div>
                        <span class="small fw-semibold text-dark">${
                          user ? user.full_name : "User"
                        }</span>
                    </div>
                    <button class="btn btn-outline-danger btn-sm rounded-pill px-3" onclick="auth.logout()">Logout</button>
                </div>
            </div>
        </div>
    </nav>
    `;

  // Insert at the beginning of body
  document.body.insertAdjacentHTML("afterbegin", navHtml);

  // Global Notification Container
  const toastContainer = document.createElement("div");
  toastContainer.id = "toast-container";
  document.body.appendChild(toastContainer);

  // Global Shortcuts
  document.addEventListener("keydown", (e) => {
    // Focus search with '/'
    if (
      e.key === "/" &&
      document.activeElement.tagName !== "INPUT" &&
      document.activeElement.tagName !== "TEXTAREA"
    ) {
      e.preventDefault();
      const searchInput = document.getElementById("driverSearchInput");
      if (searchInput) {
        searchInput.focus();
        // Smooth scroll to top if needed
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }

    // Close modals with Escape
    if (e.key === "Escape") {
      const modals = document.querySelectorAll(".modal.show");
      modals.forEach((m) => {
        const bModal = bootstrap.Modal.getInstance(m);
        if (bModal) bModal.hide();
      });
    }
  });
});

// Global UI Utilities
const ui = {
  toast: (message, type = "info") => {
    // ... (existing implementation)
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast-premium ${type}`;

    const icon =
      type === "success"
        ? "check-circle"
        : type === "error"
        ? "exclamation-circle"
        : "info-circle";

    toast.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-${icon} me-3"></i>
                <div class="small fw-semibold">${message}</div>
            </div>
            <button type="button" class="btn-close ms-3" style="font-size: 0.7rem;"></button>
        `;

    container.appendChild(toast);

    // Auto-dismiss
    const timer = setTimeout(() => {
      toast.style.animation = "fadeOut 0.3s ease-out forwards";
      setTimeout(() => toast.remove(), 300);
    }, 4000);

    toast.querySelector(".btn-close").onclick = () => {
      clearTimeout(timer);
      toast.remove();
    };
  },

  showLoading: (isLoading) => {
    let loader = document.getElementById("global-loader");
    if (!loader) {
      loader = document.createElement("div");
      loader.id = "global-loader";
      loader.className =
        "position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-white bg-opacity-75";
      loader.style.zIndex = "9999";
      loader.innerHTML =
        '<div class="spinner-border text-primary" role="status"></div>';
      document.body.appendChild(loader);
    }
    if (isLoading) {
      loader.style.display = "flex";
    } else {
      loader.remove(); // Force remove from DOM to prevent persistence
    }
  },
};
