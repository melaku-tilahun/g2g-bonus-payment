document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('mainSearchInput');
    const sortFilter = document.getElementById('sortFilter');
    const tableBody = document.getElementById('driversTableBody'); // Changed from grid
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

    sortFilter.addEventListener('change', () => loadDrivers(1));

    async function loadDrivers(page = 1) {
        try {
            loader.classList.remove('d-none');
            tableBody.innerHTML = '';
            document.getElementById('paginationContainer').classList.add('d-none');
            emptyState.classList.add('d-none');
            
            const query = searchInput.value.trim();
            const sortParts = sortFilter.value.split('_'); // e.g., name_asc
            const sortBy = sortParts[0];
            const order = sortParts.length > 1 ? sortParts[1] : 'desc';

            // Build Query Params with status=verified
            const params = new URLSearchParams({
                page: page,
                limit: currentLimit,
                q: query,
                status: 'verified',
                sortBy: sortBy === 'bonus' ? 'amount' : (sortBy === 'newest' ? 'date' : 'driver'),
                order: sortBy === 'newest' ? 'desc' : order
            });

            const response = await api.get(`/drivers/search?${params.toString()}`);
            const drivers = Array.isArray(response) ? response : (response.drivers || []);
            const pagination = response.pagination || { page: 1, total_pages: 1 };

            renderRows(drivers);
            renderPagination(pagination);
            currentPage = page;

        } catch (error) {
            console.error(error);
            ui.toast('Failed to load verified drivers', 'error');
            loader.classList.add('d-none'); // Ensure loader is hidden on error
        } finally {
            loader.classList.add('d-none');
        }
    }

    function renderRows(drivers) {
        tableBody.innerHTML = '';
        if (drivers.length === 0) {
            emptyState.classList.remove('d-none');
            return;
        }

        emptyState.classList.add('d-none');
        drivers.forEach(d => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.onclick = () => window.location.href = `/pages/driver-detail.html?id=${d.driver_id}`;
            
            tr.innerHTML = `
                <td class="px-4 py-3">
                    <div class="d-flex align-items-center">
                        <div class="bg-success bg-opacity-10 text-success rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px; font-weight: 700;">
                            ${(d.full_name || 'U').charAt(0)}
                        </div>
                        <div>
                            <div class="fw-bold text-dark">${d.full_name}</div>
                            <div class="small text-muted font-monospace">${(d.driver_id || '').substring(0, 16)}...</div>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3">
                    <div class="d-flex align-items-center text-muted">
                        <i class="fas fa-phone me-2 text-muted opacity-50"></i> ${d.phone_number || 'N/A'}
                    </div>
                </td>
                <td class="px-4 py-3">
                    <div class="text-muted">
                        ${d.verified_date ? new Date(d.verified_date).toLocaleDateString() : '<span class="text-muted">-</span>'}
                    </div>
                </td>
                <td class="px-4 py-3">
                    ${d.total_pending && d.total_pending > 0 ? `
                        <div>
                            <div class="fw-bold text-primary">${parseFloat(d.total_pending).toLocaleString()} ETB</div>
                            <div class="small text-muted">${d.weeks_pending} weeks pending</div>
                        </div>
                    ` : `
                        <span class="badge bg-light text-muted border">None</span>
                    `}
                </td>
                <td class="px-4 py-3 text-end">
                    <a href="/pages/driver-detail.html?id=${d.driver_id}" class="btn btn-sm btn-light border text-muted">
                        View
                    </a>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    function renderPagination(pagination) {
        const container = document.getElementById('paginationContainer');
        container.innerHTML = '';
        
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

    window.changePage = (page) => {
        loadDrivers(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
});
