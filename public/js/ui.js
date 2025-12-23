document.addEventListener('DOMContentLoaded', () => {
    const headerContainer = document.body;
    const navElement = document.createElement('div');
    
    auth.checkAuth();
    const user = auth.getUser();
    const isAdmin = user && user.role === 'admin';
    const currentPath = window.location.pathname;

    const navHtml = `
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary mb-4">
        <div class="container">
            <a class="navbar-brand" href="/index.html">Bonus Tracker</a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav me-auto">
                    <li class="nav-item">
                        <a class="nav-link ${currentPath === '/index.html' || currentPath === '/' ? 'active' : ''}" href="/index.html">Dashboard</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${currentPath.includes('upload.html') ? 'active' : ''}" href="/pages/upload.html">Import</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${currentPath.includes('payments.html') ? 'active' : ''}" href="/pages/payments.html">Payments</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${currentPath.includes('help.html') ? 'active' : ''}" href="/pages/help.html">Help</a>
                    </li>
                    ${isAdmin ? `
                    <li class="nav-item">
                        <a class="nav-link ${currentPath.includes('audit-logs.html') ? 'active' : ''}" href="/pages/audit-logs.html">Audit Logs</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${currentPath.includes('users.html') ? 'active' : ''}" href="/pages/users.html">Users</a>
                    </li>
                    ` : ''}
                </ul>
                <div class="d-flex align-items-center">
                    <span class="text-white me-3">${user ? user.full_name : ''}</span>
                    <button class="btn btn-outline-light btn-sm" onclick="auth.logout()">Logout</button>
                </div>
            </div>
        </div>
    </nav>
    `;
    
    // Insert at the beginning of body
    headerContainer.insertAdjacentHTML('afterbegin', navHtml);
});
