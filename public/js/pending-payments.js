document.addEventListener("DOMContentLoaded", () => {
  let pendingData = [];
  const tableBody = document.getElementById("pendingTableBody");
  const searchInput = document.getElementById("pendingSearchInput");
  const exportBtn = document.getElementById("exportExcelBtn");

  async function loadPendingPayments() {
    try {
      pendingData = await api.get("/payments/pending");
      renderTable(pendingData);
    } catch (error) {
      console.error("Error loading pending payments:", error);
      tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5 text-danger">
                        <i class="fas fa-exclamation-circle fa-2x mb-2"></i>
                        <div>Failed to load pending payments. Please try again.</div>
                    </td>
                </tr>
            `;
    }
  }

  function renderTable(data) {
    if (!data || data.length === 0) {
      tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5 text-muted">
                        <i class="fas fa-check-circle fa-2x mb-2 text-success"></i>
                        <div>No pending payments found. All verified drivers are paid up!</div>
                    </td>
                </tr>
            `;
      return;
    }

    tableBody.innerHTML = data
      .map(
        (item) => `
            <tr>
                <td class="px-4">
                    <div class="fw-bold text-dark">${item.full_name}</div>
                    <div class="small text-muted">${
                      item.phone_number || "No phone"
                    }</div>
                </td>
                <td><span class="badge bg-light text-dark font-monospace">${
                  item.driver_id
                }</span></td>
                <td class="text-center">
                    <span class="badge rounded-pill bg-primary bg-opacity-10 text-primary px-3">
                        ${item.pending_weeks} Weeks
                    </span>
                </td>
                <td class="small">
                    <div>From: ${new Date(
                      item.earliest_bonus_date
                    ).toLocaleDateString()}</div>
                    <div>To: ${new Date(
                      item.latest_bonus_date
                    ).toLocaleDateString()}</div>
                </td>
                <td class="text-end fw-bold text-dark">
                    ${parseFloat(
                      item.total_pending_amount
                    ).toLocaleString()} <span class="small text-muted fw-normal">ETB</span>
                </td>
                <td class="text-center px-4">
                    <a href="/pages/driver-detail.html?id=${
                      item.driver_id
                    }" class="btn btn-sm btn-outline-primary rounded-pill px-3">
                        View Details
                    </a>
                </td>
            </tr>
        `
      )
      .join("");
  }

  // Search functionality
  searchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = pendingData.filter(
      (item) =>
        item.full_name.toLowerCase().includes(term) ||
        item.driver_id.toLowerCase().includes(term)
    );
    renderTable(filtered);
  });

  // Export functionality
  exportBtn.addEventListener("click", () => {
    const token = localStorage.getItem("token");
    // We use window.location.href for downloads to work with browser response headers
    // But we need to include the token for authentication
    // Alternatively, we can use a fetch/blob approach if simple link doesn't work with auth
    window.location.href = `/api/payments/export-pending?token=${token}`;
  });

  loadPendingPayments();
});
