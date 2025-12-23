document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('mainSearchInput');
    const statusFilter = document.getElementById('statusFilter');
    const sortFilter = document.getElementById('sortFilter');
    const resultsGrid = document.getElementById('searchResultsGrid');
    const loader = document.getElementById('searchLoader');
    const emptyState = document.getElementById('emptySearchState');

    let currentPage = 1;
    let currentLimit = 25;
    let debounceTimer;

    // Initial load
    loadDrivers(1);

    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => loadDrivers(1), 300);
    });

    statusFilter.addEventListener('change', () => loadDrivers(1));
    sortFilter.addEventListener('change', () => loadDrivers(1));

    async function loadDrivers(page = 1) {
        try {
            loader.classList.remove('d-none');
            resultsGrid.innerHTML = '';
            document.getElementById('paginationContainer').classList.add('d-none');
            
            const query = searchInput.value.trim();
            const status = statusFilter.value; // Note: specific status filter currently not supported by backend general search, but q works for name/id
            const sortParts = sortFilter.value.split('_'); // e.g., name_asc
            const sortBy = sortParts[0];
            const order = sortParts.length > 1 ? sortParts[1] : 'desc';

            // Build Query Params
            const params = new URLSearchParams({
                page: page,
                limit: currentLimit,
                q: query,
                sortBy: sortBy === 'bonus' ? 'amount' : (sortBy === 'newest' ? 'date' : 'driver'), // mapping to backend expectations
                order: sortBy === 'newest' ? 'desc' : order
            });

            // Using bonuses/pending for search to keep showing bonus amounts
            const response = await api.get(`/bonuses/pending?${params.toString()}`);
            const drivers = Array.isArray(response) ? response : (response.pending_drivers || []);
            const pagination = response.pagination || { page: 1, total_pages: 1 };

            // Client-side filtering for status if needed (since backend q covers name/id only)
            // Ideally backend adds status filter too, but for "search", standard is usually unverified pending
            // We will render what we get.
            
            renderCards(drivers);
            renderPagination(pagination);
            currentPage = page;

        } catch (error) {
            console.error(error);
            ui.toast('Failed to load drivers', 'error');
            emptyState.classList.remove('d-none');
        } finally {
            loader.classList.add('d-none');
        }
    }

    function renderCards(drivers) {
        resultsGrid.innerHTML = '';
        if (drivers.length === 0) {
            emptyState.classList.remove('d-none');
            return;
        }

        emptyState.classList.add('d-none');
        drivers.forEach(d => {
            const col = document.createElement('div');
            col.className = 'col-md-6 col-lg-4';
            col.innerHTML = `
                <div class="card-premium h-100 p-4 d-flex flex-column" onclick="window.location.href='/pages/driver-detail.html?id=${d.driver_id}'" style="cursor: pointer;">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div class="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center" style="width: 48px; height: 48px; font-weight: 700;">
                            ${(d.full_name || 'U').charAt(0)}
                        </div>
                        <span class="badge-status badge-unverified">
                            Unverified
                        </span>
                    </div>
                    <h5 class="fw-bold mb-1">${d.full_name}</h5>
                    <div class="small text-muted font-monospace mb-3">${(d.driver_id || '').substring(0, 16)}...</div>
                    
                    <div class="mt-auto pt-3 border-top">
                        <div class="row g-0 align-items-center">
                            <div class="col">
                                <div class="small text-muted text-uppercase fw-bold" style="font-size: 0.65rem;">Pending Bonus</div>
                                <div class="h5 fw-bold text-primary mb-0">${parseFloat(d.total_pending || 0).toLocaleString()} ETB</div>
                            </div>
                            <div class="col-auto">
                                <span class="badge bg-light text-dark border rounded-pill px-3">${d.weeks_pending || d.weeks_count || 1} wks</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            resultsGrid.appendChild(col);
        });
    }

    function renderPagination(pagination) {
        const container = document.getElementById('paginationContainer');
        if (pagination.total_pages <= 1) {
            container.classList.add('d-none');
            return;
        }

        container.classList.remove('d-none');
        container.innerHTML = `
            <nav>
                <ul class="pagination pagination-rounded">
                    <li class="page-item ${pagination.page <= 1 ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="event.preventDefault(); window.changePage(${pagination.page - 1})">Previous</a>
                    </li>
                    <li class="page-item active">
                        <a class="page-link" href="#">Page ${pagination.page} of ${pagination.total_pages}</a>
                    </li>
                    <li class="page-item ${pagination.page >= pagination.total_pages ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="event.preventDefault(); window.changePage(${pagination.page + 1})">Next</a>
                    </li>
                </ul>
            </nav>
        `;
    }

    // Expose changePage to global scope for inline onclick handler
    window.changePage = (page) => {
        loadDrivers(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
});
