// Export Utility Module
// Provides export functionality across the platform

const exportUtil = {
  /**
   * Export drivers to Excel
   * @param {object} filters - Optional filters
   */
  async exportDrivers(filters = {}) {
    try {
      ui.toast("Preparing export...", "info");

      const response = await fetch("/api/export/drivers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ filters }),
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `drivers_export_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      ui.toast("Drivers exported successfully", "success");
    } catch (error) {
      console.error("Export drivers error:", error);
      ui.toast("Export failed", "error");
    }
  },

  /**
   * Export payments to Excel
   * @param {object} filters - Optional filters
   */
  async exportPayments(filters = {}) {
    try {
      ui.toast("Preparing export...", "info");

      const response = await fetch("/api/export/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ filters }),
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payments_export_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      ui.toast("Payments exported successfully", "success");
    } catch (error) {
      console.error("Export payments error:", error);
      ui.toast("Export failed", "error");
    }
  },

  /**
   * Export audit logs to Excel
   * @param {object} filters - Optional filters
   */
  async exportAuditLogs(filters = {}) {
    try {
      ui.toast("Preparing export...", "info");

      const response = await fetch("/api/export/audit-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ filters }),
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit_logs_export_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      ui.toast("Audit logs exported successfully", "success");
    } catch (error) {
      console.error("Export audit logs error:", error);
      ui.toast("Export failed", "error");
    }
  },

  /**
   * Create database backup
   */
  async createBackup() {
    try {
      if (!confirm("Create a database backup? This may take a few moments.")) {
        return;
      }

      ui.toast("Creating backup...", "info");

      const response = await fetch("/api/export/backup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Backup failed");
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `database_backup_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      ui.toast("Backup created successfully", "success");
    } catch (error) {
      console.error("Create backup error:", error);
      ui.toast("Backup failed", "error");
    }
  },
};

// Make available globally
window.exportUtil = exportUtil;
