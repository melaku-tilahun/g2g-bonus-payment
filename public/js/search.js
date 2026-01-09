document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("mainSearchInput");
  const statusFilter = document.getElementById("statusFilter");
  const sortFilter = document.getElementById("sortFilter");
  const resultsGrid = document.getElementById("searchResultsGrid");
  const loader = document.getElementById("searchLoader");
  const emptyState = document.getElementById("emptySearchState");
  const tabs = document.querySelectorAll("#searchTabs .nav-link");

  let currentPage = 1;
  let currentLimit = 25;
  let debounceTimer;
  let currentTab = "drivers"; // drivers, payments, debts

  // Initial load
  loadData(1);

  // Tab Switching Logic
  tabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      // Update UI
      tabs.forEach((t) => {
        t.classList.remove("active", "bg-primary", "text-white");
        t.classList.add("bg-white");
      });
      e.currentTarget.classList.add("active", "bg-primary", "text-white");
      e.currentTarget.classList.remove("bg-white");

      // Update State
      currentTab = e.currentTarget.getAttribute("data-tab");
      currentPage = 1;

      // Reset filters to defaults for the new tab
      updateFiltersForTab(currentTab);

      // Load Data
      loadData(1);
    });
  });

  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => loadData(1), 300);
  });

  statusFilter.addEventListener("change", () => loadData(1));
  sortFilter.addEventListener("change", () => loadData(1));

  function updateFiltersForTab(tab) {
    // Reset Status Filter
    statusFilter.innerHTML = '<option value="all">All Statuses</option>';
    if (tab === "drivers") {
      statusFilter.innerHTML += `
        <option value="verified">Verified</option>
        <option value="unverified">Unverified</option>
        <option value="blocked">Blocked</option>
      `;
    } else if (tab === "payments") {
      statusFilter.innerHTML += `
        <option value="paid">Paid</option>
        <option value="processing">Processing</option>
        <option value="pending">Pending</option>
      `;
    } else if (tab === "debts") {
      statusFilter.innerHTML += `
        <option value="active">Active</option>
        <option value="paid">Paid</option>
      `;
    }

    // Reset Sort Filter (Simplified for now, can be expanded)
    sortFilter.value = "newest";
  }

  async function loadData(page = 1) {
    try {
      loader.classList.remove("d-none");
      resultsGrid.innerHTML = "";
      document.getElementById("paginationContainer").classList.add("d-none");
      emptyState.classList.add("d-none");

      const query = searchInput.value.trim();
      const status = statusFilter.value;
      const sortValue = sortFilter.value;

      // Build Query Params
      const params = new URLSearchParams({
        page: page,
        limit: currentLimit,
        q: query,
        status: status === "all" ? "" : status,
        sortBy: "newest", // Defaulting for simple implementation
      });

      let endpoint = "";
      if (currentTab === "drivers") endpoint = "/drivers/search";
      else if (currentTab === "payments") endpoint = "/payments/search";
      else if (currentTab === "debts") endpoint = "/debts/search";

      const response = await api.get(`${endpoint}?${params.toString()}`);

      let items = [];
      let pagination = { page: 1, total_pages: 1 };

      if (currentTab === "drivers") {
        items = response.drivers || [];
        pagination = response.pagination || pagination;
      } else if (currentTab === "payments") {
        items = response.payments || [];
        pagination = response.pagination || pagination;
      } else if (currentTab === "debts") {
        items = response.debts || [];
        pagination = response.pagination || pagination;
      }

      if (items.length === 0) {
        emptyState.classList.remove("d-none");
      } else {
        if (currentTab === "drivers") renderDriverCards(items);
        else if (currentTab === "payments") renderPaymentCards(items);
        else if (currentTab === "debts") renderDebtCards(items);

        renderPagination(pagination);
      }

      currentPage = page;
    } catch (error) {
      console.error(error);
      ui.toast(`Failed to load ${currentTab}`, "error");
      emptyState.classList.remove("d-none");
    } finally {
      loader.classList.add("d-none");
    }
  }

  function renderDriverCards(drivers) {
    drivers.forEach((d) => {
      const isVerified = d.verified === 1 || d.verified === true;
      const isBlocked = d.is_blocked === 1 || d.is_blocked === true;

      let badgeClass = isVerified ? "badge-verified" : "badge-unverified";
      let badgeText = isVerified ? "Verified" : "Unverified";

      if (isBlocked) {
        badgeClass = "bg-danger text-white border-0 py-1 px-3 rounded-pill";
        badgeText = "Blocked";
      }

      const col = document.createElement("div");
      col.className = "col-md-6 col-lg-4";
      col.innerHTML = `
                <div class="card-premium h-100 p-4 d-flex flex-column" onclick="window.location.href='/pages/driver-detail.html?id=${
                  d.driver_id
                }'" style="cursor: pointer;">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div class="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center" style="width: 48px; height: 48px; font-weight: 700;">
                            ${(d.full_name || "U").charAt(0)}
                        </div>
                        <span class="badge-status ${badgeClass}">
                            ${badgeText}
                        </span>
                    </div>
                    <h5 class="fw-bold mb-1">${d.full_name}</h5>
                    <div class="small text-muted font-monospace mb-3">${(
                      d.driver_id || ""
                    ).substring(0, 16)}...</div>
                    <div class="small text-muted mb-2"><i class="fas fa-phone me-1"></i> ${
                      d.phone_number || "N/A"
                    }</div>
                    
                    <div class="mt-auto pt-3 border-top">
                        <div class="row g-0 align-items-center">
                            <div class="col">
                                <div class="small text-muted text-uppercase fw-bold" style="font-size: 0.65rem;">Pending Bonus</div>
                                <div class="h5 fw-bold text-primary mb-0">${parseFloat(
                                  d.total_pending || 0
                                ).toLocaleString()} <small class="text-xs fw-normal">ETB</small></div>
                            </div>
                            <div class="col-auto">
                                <span class="badge bg-light text-dark border rounded-pill px-3">${
                                  d.weeks_pending || 0
                                } wks</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
      resultsGrid.appendChild(col);
    });
  }

  function renderPaymentCards(payments) {
    payments.forEach((p) => {
      const col = document.createElement("div");
      col.className = "col-md-6 col-lg-4";

      let statusBadge = `<span class="badge bg-secondary">Unknown</span>`;
      if (p.status === "paid")
        statusBadge = `<span class="badge bg-success bg-opacity-10 text-success rounded-pill px-3">Paid</span>`;
      else if (p.status === "processing")
        statusBadge = `<span class="badge bg-info bg-opacity-10 text-info rounded-pill px-3">Processing</span>`;
      else if (p.status === "pending")
        statusBadge = `<span class="badge bg-warning bg-opacity-10 text-warning rounded-pill px-3">Pending</span>`;

      col.innerHTML = `
            <div class="card-premium h-100 p-4 d-flex flex-column" onclick="window.location.href='/pages/driver-detail.html?id=${
              p.driver_ref_id
            }'" style="cursor: pointer;">
                <div class="d-flex justify-content-between align-items-center mb-3">
                     <span class="text-muted small fw-bold text-uppercase">Payment #${
                       p.id
                     }</span>
                     ${statusBadge}
                </div>
                <h5 class="fw-bold mb-1">${p.full_name || "Unknown Driver"}</h5>
                <div class="small text-muted font-monospace mb-3">${
                  p.driver_ref_id || "N/A"
                }</div>

                 <div class="mt-auto pt-3 border-top">
                    <div class="row g-0 align-items-center">
                        <div class="col">
                            <div class="small text-muted text-uppercase fw-bold" style="font-size: 0.65rem;">Total Paid</div>
                            <div class="h5 fw-bold text-dark mb-0">${parseFloat(
                              p.total_amount || 0
                            ).toLocaleString()} <small class="text-xs fw-normal">ETB</small></div>
                        </div>
                        <div class="col-auto text-end">
                             <div class="small text-muted">${new Date(
                               p.payment_date
                             ).toLocaleDateString()}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
      resultsGrid.appendChild(col);
    });
  }

  function renderDebtCards(debts) {
    debts.forEach((d) => {
      const col = document.createElement("div");
      col.className = "col-md-6 col-lg-4";

      let statusBadge = `<span class="badge bg-warning bg-opacity-10 text-warning rounded-pill px-3">Active</span>`;
      if (d.status === "paid")
        statusBadge = `<span class="badge bg-success bg-opacity-10 text-success rounded-pill px-3">Paid</span>`;

      col.innerHTML = `
            <div class="card-premium h-100 p-4 d-flex flex-column" onclick="window.location.href='/pages/driver-detail.html?id=${
              d.driver_ref_id
            }'" style="cursor: pointer;">
                 <div class="d-flex justify-content-between align-items-center mb-3">
                     <span class="text-muted small fw-bold text-uppercase">${
                       d.reason
                     }</span>
                     ${statusBadge}
                </div>
                <h5 class="fw-bold mb-1">${d.full_name || "Unknown Driver"}</h5>
                <div class="small text-muted font-monospace mb-3">${
                  d.driver_ref_id || "N/A"
                }</div>

                <div class="mt-auto pt-3 border-top">
                    <div class="d-flex justify-content-between align-items-end">
                        <div>
                             <div class="small text-muted text-uppercase fw-bold" style="font-size: 0.65rem;">Original Amount</div>
                             <div class="fw-bold text-dark">${parseFloat(
                               d.amount
                             ).toLocaleString()} ETB</div>
                        </div>
                         <div class="text-end">
                             <div class="small text-muted text-uppercase fw-bold" style="font-size: 0.65rem;">Remaining</div>
                             <div class="h5 fw-bold text-danger mb-0">${parseFloat(
                               d.remaining_amount
                             ).toLocaleString()}</div>
                        </div>
                    </div>
                     <div class="small text-muted mt-2 text-end">Created: ${new Date(
                       d.created_at
                     ).toLocaleDateString()}</div>
                </div>
            </div>
        `;
      resultsGrid.appendChild(col);
    });
  }

  function renderPagination(pagination) {
    const container = document.getElementById("paginationContainer");
    if (pagination.total_pages <= 1) {
      container.classList.add("d-none");
      return;
    }

    container.classList.remove("d-none");
    container.innerHTML = `
            <nav>
                <ul class="pagination pagination-rounded">
                    <li class="page-item ${
                      pagination.page <= 1 ? "disabled" : ""
                    }">
                        <a class="page-link" href="#" onclick="event.preventDefault(); window.changePage(${
                          pagination.page - 1
                        })">Previous</a>
                    </li>
                    <li class="page-item active">
                        <a class="page-link" href="#">Page ${
                          pagination.page
                        } of ${pagination.total_pages}</a>
                    </li>
                    <li class="page-item ${
                      pagination.page >= pagination.total_pages
                        ? "disabled"
                        : ""
                    }">
                        <a class="page-link" href="#" onclick="event.preventDefault(); window.changePage(${
                          pagination.page + 1
                        })">Next</a>
                    </li>
                </ul>
            </nav>
        `;
  }

  // Expose changePage to global scope for inline onclick handler
  window.changePage = (page) => {
    loadData(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
});
