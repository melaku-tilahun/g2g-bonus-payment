document.addEventListener("DOMContentLoaded", () => {
  auth.checkAuth();
  const user = auth.getUser();
  const isAdmin = user && user.role === "admin";
  const currentPath = window.location.pathname;

  // Modern Navigation HTML
  const navHtml = `
    <nav class="navbar navbar-expand-lg navbar-modern mb-3 sticky-top">
        <div class="container-fluid px-4">
            <a class="navbar-brand d-flex align-items-center" href="/">
                 <img src="/assets/shuufare%20logo.png" alt="Shuufare Logo" height="35" style="border-radius: 8px;">
            </a>
            
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-lg-4 me-auto">
                    <li class="nav-item">
                        <a class="nav-link ${
                          currentPath === "/index" || currentPath === "/"
                            ? "active"
                            : ""
                        }" href="/">Dashboard</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${
                          currentPath.includes("/pending-payments")
                            ? "active"
                            : ""
                        }" href="/pages/pending-payments">Pending</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${
                          currentPath.includes("/verified-drivers")
                            ? "active"
                            : ""
                        }" href="/pages/verified-drivers">Verified</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${
                          currentPath.includes("/unverified-drivers")
                            ? "active"
                            : ""
                        }" href="/pages/unverified-drivers">Unverified</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${
                          currentPath.includes("/payments") ? "active" : ""
                        }" href="/pages/payments">Payment History</a>
                    </li>
                    ${
                      user && user.role !== "auditor"
                        ? `<li class="nav-item">
                            <a class="nav-link ${
                              currentPath.includes("/import") ? "active" : ""
                            }" href="/pages/import">Import</a>
                        </li>`
                        : ""
                    }
                    <li class="nav-item">
                        <a class="nav-link ${
                          currentPath.includes("/search") ? "active" : ""
                        }" href="/pages/search">Search</a>
                    </li>
                   
                    ${(() => {
                      const role = user ? user.role : "";
                      const canViewSystemHealth = role === "admin";
                      const canViewUserMgmt = ["admin", "director"].includes(
                        role
                      );
                      const canViewReports = [
                        "admin",
                        "director",
                        "auditor",
                      ].includes(role); // Compliance & Schedules
                      const canViewDebt = [
                        "admin",
                        "director",
                        "manager",
                      ].includes(role);
                      const canViewFinancials = [
                        "admin",
                        "director",
                        "manager",
                      ].includes(role); // Analytics & Batches
                      const canViewAudit = ["admin", "director"].includes(role);
                      const canViewAdvancedSearch = [
                        "admin",
                        "director",
                        "manager",
                        "auditor",
                      ].includes(role);

                      const hasManagementAccess =
                        canViewSystemHealth ||
                        canViewUserMgmt ||
                        canViewReports ||
                        canViewDebt ||
                        canViewFinancials ||
                        canViewAdvancedSearch;

                      if (hasManagementAccess) {
                        return `
                            <li class="nav-item dropdown">
                                <a class="nav-link dropdown-toggle" href="#" id="adminDropdown" role="button">
                                    ${
                                      role.charAt(0).toUpperCase() +
                                      role.slice(1)
                                    }
                                </a>
                                <ul class="dropdown-menu border-0 shadow-sm">
                                    ${
                                      canViewFinancials
                                        ? `
                                        <li><h6 class="dropdown-header">Analytics & Reporting</h6></li>
                                        <li><a class="dropdown-item" href="/pages/analytics-dashboard">Financial Analytics</a></li>
                                    `
                                        : ""
                                    }
                                    ${
                                      canViewAudit
                                        ? `<li><a class="dropdown-item" href="/pages/user-activity">Audit Trail & Activity</a></li>`
                                        : ""
                                    }
                                    ${
                                      canViewDebt
                                        ? `<li><a class="dropdown-item" href="/pages/debt-analytics">Debt Analytics</a></li>`
                                        : ""
                                    }
                                    ${
                                      canViewReports
                                        ? `
                                        <li><a class="dropdown-item" href="/pages/compliance-reports">Compliance Reports</a></li>
                                        <li><a class="dropdown-item" href="/pages/scheduled-reports">Scheduled Reports</a></li>
                                    `
                                        : ""
                                    }
                                    
                                    ${
                                      canViewFinancials || canViewReports
                                        ? `<li><hr class="dropdown-divider"></li>`
                                        : ""
                                    }
                                    
                                    ${
                                      canViewAdvancedSearch
                                        ? `
                                        <li><h6 class="dropdown-header">Search & Data</h6></li>
                                        <li><a class="dropdown-item" href="/pages/advanced-search">Advanced Search</a></li>
                                    `
                                        : ""
                                    }
                                    
                                    ${
                                      canViewUserMgmt || canViewSystemHealth
                                        ? `
                                        <li><hr class="dropdown-divider"></li>
                                        <li><h6 class="dropdown-header">System Management</h6></li>
                                    `
                                        : ""
                                    }
                                    
                                    ${
                                      canViewUserMgmt
                                        ? `<li><a class="dropdown-item" href="/pages/users">User Management</a></li>
                                           <li><a class="dropdown-item" href="/pages/driver-management">Driver Management</a></li>`
                                        : ""
                                    }
                                    ${
                                      canViewFinancials
                                        ? `<li><a class="dropdown-item" href="/pages/batch-management">Batch Management</a></li>`
                                        : ""
                                    }
                                    ${
                                      canViewSystemHealth
                                        ? `<li><a class="dropdown-item" href="/pages/system-health">System Health</a></li>`
                                        : ""
                                    }
                                </ul>
                            </li>`;
                      }
                      return "";
                    })()}
                </ul>
                
                <div class="d-flex align-items-center gap-2">
                    <div class="notification-nav position-relative">
                        <a href="javascript:void(0)" class="text-dark p-2 rounded-circle hover-bg-light" id="notificationBtn" onclick="ui.toggleNotifications()">
                            <i class="fas fa-bell fs-5"></i>
                            <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger d-none" id="notificationBadge" style="margin-left: -5px; margin-top: 5px;">0</span>
                        </a>
                        <div class="dropdown-menu dropdown-menu-end border-0 shadow-lg p-0" id="notificationDropdown" style="width: 300px; max-height: 400px; overflow-y: auto;">
                            <!-- Notifications will be loaded here -->
                        </div>
                    </div>
                    
                    <div class="dropdown d-none d-md-block">
                        <button class="btn btn-link text-decoration-none dropdown-toggle user-profile-nav d-flex align-items-center gap-2 p-1 pe-3" type="button" id="userDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                            <div class="avatar-circle bg-primary text-white d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; border-radius: 50%; font-weight: 700; font-size: 0.8rem;">
                                ${user ? user.full_name.charAt(0) : "U"}
                            </div>
                            <span class="small fw-semibold text-dark">${user ? user.full_name : "User"}</span>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end border-0 shadow-lg mt-2 py-2" aria-labelledby="userDropdown" style="min-width: 200px;">
                            <li>
                                <div class="px-3 py-2 border-bottom mb-2">
                                    <div class="fw-bold small text-dark">${user ? user.full_name : "User"}</div>
                                    <div class="text-muted" style="font-size: 0.7rem;">${user ? user.role : ""}</div>
                                </div>
                            </li>
                            <li>
                                <a class="dropdown-item d-flex align-items-center py-2" href="/pages/profile">
                                    <i class="fas fa-user-circle me-2 text-muted"></i>
                                    <span>My Profile</span>
                                </a>
                            </li>
                            <li>
                                <a class="dropdown-item d-flex align-items-center py-2 text-danger" href="javascript:void(0)" onclick="auth.logout()">
                                    <i class="fas fa-sign-out-alt me-2"></i>
                                    <span>Logout</span>
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </nav>
    `;

  // Insert at the beginning of body
  document.body.insertAdjacentHTML("afterbegin", navHtml);

  // Load initial notifications
  if (auth.isAuthenticated()) {
    ui.loadNotificationCount();
    setInterval(() => ui.loadNotificationCount(), 60000); // Refresh every minute
  }

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
    const container = document.getElementById("toast-container");
    if (!container) {
      const newContainer = document.createElement("div");
      newContainer.id = "toast-container";
      document.body.appendChild(newContainer);
    }

    const toast = document.createElement("div");
    toast.className = `toast-premium ${type} shadow-lg`;

    // Auto-scroll-top for errors to ensure they are seen
    if (type === "error") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    const icon =
      type === "success"
        ? "check-circle"
        : type === "error"
        ? "exclamation-triangle"
        : "info-circle";

    const displayMessage =
      typeof message === "string"
        ? message
        : message.message || "An unexpected error occurred";

    toast.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="toast-icon-wrapper me-3">
                    <i class="fas fa-${icon}"></i>
                </div>
                <div class="toast-body-content">
                    <div class="small fw-bold text-uppercase opacity-75 mb-1">${type}</div>
                    <div class="small fw-semibold msg-content">${displayMessage}</div>
                </div>
            </div>
            <button type="button" class="btn-close ms-3" aria-label="Close"></button>
        `;

    document.getElementById("toast-container").appendChild(toast);

    // Auto-dismiss
    const duration = type === "error" ? 6000 : 4000;
    const timer = setTimeout(() => {
      toast.classList.add("fadeOut");
      setTimeout(() => toast.remove(), 300);
    }, duration);

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

  loadNotificationCount: async () => {
    try {
      const data = await api.get("/notifications/unread-count");
      const badge = document.getElementById("notificationBadge");
      if (data.success && data.count > 0) {
        badge.textContent = data.count;
        badge.classList.remove("d-none");
      } else {
        badge.classList.add("d-none");
      }
    } catch (e) {
      console.error("Notification count error:", e);
    }
  },

  toggleNotifications: async () => {
    const dropdown = document.getElementById("notificationDropdown");
    dropdown.classList.toggle("show");

    if (dropdown.classList.contains("show")) {
      dropdown.innerHTML =
        '<div class="p-3 text-center"><div class="spinner-border spinner-border-sm text-primary"></div></div>';
      try {
        const data = await api.get("/notifications?limit=5");
        if (data.success && data.notifications.length > 0) {
          let html =
            '<div class="p-3 border-bottom d-flex justify-content-between align-items-center"><h6 class="mb-0">Notifications</h6><a href="javascript:void(0)" class="small" onclick="ui.markAllNotificationsRead()">Mark all as read</a></div>';
          html += '<div class="list-group list-group-flush">';
          data.notifications.forEach((n) => {
            html += `
                    <div class="list-group-item list-group-item-action border-0 ${
                      n.read_at ? "" : "bg-light"
                    }">
                        <div class="small fw-bold">${n.title}</div>
                        <div class="small text-muted">${n.message}</div>
                        <div class="text-end" style="font-size: 0.7rem;">${new Date(
                          n.created_at
                        ).toLocaleTimeString()}</div>
                    </div>
                `;
          });
          html += "</div>";
          dropdown.innerHTML = html;
        } else {
          dropdown.innerHTML =
            '<div class="p-4 text-center text-muted"><p class="mb-0">No notifications</p></div>';
        }
      } catch (e) {
        dropdown.innerHTML =
          '<div class="p-3 text-center text-danger">Failed to load</div>';
      }
    }
  },

  markAllNotificationsRead: async () => {
    try {
      await api.put("/notifications/read-all");
      ui.loadNotificationCount();
      // Keep dropdown open but refresh count
      const dropdown = document.getElementById("notificationDropdown");
      dropdown.classList.remove("show");
    } catch (e) {
      console.error("Mark all read error:", e);
    }
  },
};
