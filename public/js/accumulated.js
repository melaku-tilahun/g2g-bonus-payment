document.addEventListener("DOMContentLoaded", async () => {
  // Check auth
  if (!auth.isAuthenticated()) {
    window.location.href = "/login.html";
    return;
  }

  const searchInput = document.getElementById("searchInput");
  let allDrivers = [];

  // Load Data
  try {
    // We reuse the pending payments endpoint logic but we need a new endpoint or filter for UNVERIFIED specifically.
    // Currently getPendingPayments fetches WHERE d.verified = TRUE.
    // We need a similar endpoint for Unverified.
    // For now, let's assume we'll create /payments/accumulated endpoint.
    const drivers = await api.get("/payments/accumulated");
    allDrivers = drivers;
    renderTable(drivers);
  } catch (error) {
    console.error(error);
    ui.toast("Failed to load accumulated bonuses", "error");
    document.getElementById("accumulatedTableBody").innerHTML =
      '<tr><td colspan="6" class="text-center py-5 text-danger">Error loading data</td></tr>';
  }

  // Search
  searchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allDrivers.filter(
      (d) =>
        d.full_name.toLowerCase().includes(term) ||
        (d.phone_number && d.phone_number.includes(term)) ||
        d.driver_id.toLowerCase().includes(term)
    );
    renderTable(filtered);
  });

  function renderTable(drivers) {
    const tbody = document.getElementById("accumulatedTableBody");
    const emptyState = document.getElementById("emptyState");

    if (drivers.length === 0) {
      tbody.classList.add("d-none");
      emptyState.classList.remove("d-none");
      return;
    }

    tbody.classList.remove("d-none");
    emptyState.classList.add("d-none");
    tbody.innerHTML = "";

    drivers.forEach((d) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td class="ps-4">
                    <div class="fw-bold text-dark">${d.full_name}</div>
                    <div class="small text-muted font-monospace">${
                      d.driver_id
                    }</div>
                </td>
                <td>${d.phone_number || "-"}</td>
                <td><span class="badge bg-light text-dark border">${
                  d.pending_weeks
                } weeks</span></td>
                <td class="fw-bold text-dark">${parseFloat(
                  d.total_pending_amount
                ).toLocaleString()} ETB</td>
                <td><span class="badge bg-warning bg-opacity-10 text-warning rounded-pill px-3">Unverified</span></td>
                <td class="text-end pe-4">
                    <a href="/pages/driver-detail.html?id=${
                      d.driver_id
                    }" class="btn btn-outline-primary btn-sm px-3 shadow-none">
                        View & Verify
                    </a>
                </td>
            `;
      tbody.appendChild(tr);
    });
  }
});
