document.addEventListener("DOMContentLoaded", async () => {
  // Check auth
  if (!auth.isAuthenticated()) {
    window.location.href = "/";
    return;
  }

  const searchInput = document.getElementById("searchInput");
  const tableBody = document.getElementById("accumulatedTableBody");
  const emptyState = document.getElementById("emptyState");
  const paginationContainer = document.getElementById("paginationContainer");

  let currentPage = 1;
  const currentLimit = 25;
  let debounceTimer;

  // Load Data
  async function loadAccumulated(page = 1) {
    try {
      const query = searchInput.value.trim();
      const params = new URLSearchParams({
        page: page,
        limit: currentLimit,
        q: query,
      });

      const response = await api.get(
        `/payments/accumulated?${params.toString()}`
      );

      const drivers = response.accumulated_drivers || [];
      const pagination = response.pagination || { page: 1, total_pages: 1 };

      renderTable(drivers, pagination.page);
      renderPagination(pagination);
      currentPage = page;
    } catch (error) {
      console.error(error);
      ui.toast("Failed to load accumulated bonuses", "error");
      tableBody.innerHTML =
        '<tr><td colspan="7" class="text-center py-5 text-danger">Error loading data</td></tr>';
    }
  }

  // Search
  searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => loadAccumulated(1), 300);
  });

  function renderTable(drivers, page) {
    if (drivers.length === 0) {
      tableBody.innerHTML = "";
      tableBody.classList.add("d-none");
      emptyState.classList.remove("d-none");
      return;
    }

    tableBody.classList.remove("d-none");
    emptyState.classList.add("d-none");
    tableBody.innerHTML = "";

    drivers.forEach((d, index) => {
      const rowNumber = (page - 1) * currentLimit + index + 1;
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td class="ps-4 text-muted small">${rowNumber}</td>
                <td>
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
                    <a href="/pages/driver-detail?id=${
                      d.driver_id
                    }" class="btn btn-outline-primary btn-sm px-3 shadow-none">
                        View & Verify
                    </a>
                </td>
            `;
      tableBody.appendChild(tr);
    });
  }

  function renderPagination(pagination) {
    if (pagination.total_pages <= 1) {
      paginationContainer.classList.add("d-none");
      return;
    }

    paginationContainer.classList.remove("d-none");
    paginationContainer.innerHTML = `
            <nav>
                <ul class="pagination pagination-rounded shadow-sm">
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

  window.changePage = (page) => {
    loadAccumulated(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  loadAccumulated();
});
