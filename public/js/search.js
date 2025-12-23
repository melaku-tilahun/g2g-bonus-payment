document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('mainSearchInput');
    const statusFilter = document.getElementById('statusFilter');
    const sortFilter = document.getElementById('sortFilter');
    const resultsGrid = document.getElementById('searchResultsGrid');
    const loader = document.getElementById('searchLoader');
    const emptyState = document.getElementById('emptySearchState');

    let allDrivers = [];

    // Initial load
    loadDrivers();

    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => filterAndRender(), 300);
    });

    statusFilter.addEventListener('change', filterAndRender);
    sortFilter.addEventListener('change', filterAndRender);

    async function loadDrivers() {
        try {
            loader.classList.remove('d-none');
            resultsGrid.innerHTML = '';
            
            // Get all drivers with pending bonuses
            const pending = await api.get('/bonuses/pending');
            allDrivers = pending;
            
            filterAndRender();
        } catch (error) {
            console.error(error);
            ui.toast('Failed to load drivers', 'error');
        } finally {
            loader.classList.add('d-none');
        }
    }

    function filterAndRender() {
        const query = searchInput.value.toLowerCase();
        const status = statusFilter.value;
        const sort = sortFilter.value;

        let filtered = allDrivers.filter(d => {
            const matchesQuery = d.full_name.toLowerCase().includes(query) || d.driver_id.toLowerCase().includes(query);
            const matchesStatus = status === 'all' || (status === 'verified' && d.verified) || (status === 'unverified' && !d.verified);
            return matchesQuery && matchesStatus;
        });

        // Sort logic
        if (sort === 'name_asc') filtered.sort((a,b) => a.full_name.localeCompare(b.full_name));
        else if (sort === 'name_desc') filtered.sort((a,b) => b.full_name.localeCompare(a.full_name));
        else if (sort === 'bonus_desc') filtered.sort((a,b) => b.total_bonus - a.total_bonus);
        else if (sort === 'newest') filtered.sort((a,b) => new Date(b.latest_bonus_date) - new Date(a.latest_bonus_date));

        renderCards(filtered);
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
                            ${d.full_name.charAt(0)}
                        </div>
                        <span class="badge-status ${d.verified ? 'badge-verified' : 'badge-unverified'}">
                            ${d.verified ? 'Verified' : 'Unverified'}
                        </span>
                    </div>
                    <h5 class="fw-bold mb-1">${d.full_name}</h5>
                    <div class="small text-muted font-monospace mb-3">${d.driver_id.substring(0, 16)}...</div>
                    
                    <div class="mt-auto pt-3 border-top">
                        <div class="row g-0 align-items-center">
                            <div class="col">
                                <div class="small text-muted text-uppercase fw-bold" style="font-size: 0.65rem;">Pending Bonus</div>
                                <div class="h5 fw-bold text-primary mb-0">${parseFloat(d.total_bonus).toLocaleString()} ETB</div>
                            </div>
                            <div class="col-auto">
                                <span class="badge bg-light text-dark border rounded-pill px-3">${d.weeks_count || 1} wks</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            resultsGrid.appendChild(col);
        });
    }
});
