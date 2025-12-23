document.addEventListener('DOMContentLoaded', () => {
    auth.checkAuth();
    const user = auth.getUser();
    const isAdmin = user && user.role === 'admin';
    const currentPath = window.location.pathname;

    // Modern Navigation HTML
    const navHtml = `
    <nav class="navbar navbar-expand-lg navbar-modern mb-5 sticky-top">
        <div class="container">
            <a class="navbar-brand d-flex align-items-center" href="/index.html">
                <span class="me-2">📊</span> BonusTracker
            </a>
            
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-lg-4 me-auto">
                    <li class="nav-item">
                        <a class="nav-link ${currentPath === '/index.html' || currentPath === '/' ? 'active' : ''}" href="/index.html">Dashboard</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${currentPath.includes('upload.html') ? 'active' : ''}" href="/pages/upload.html">Upload</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${currentPath.includes('payments.html') ? 'active' : ''}" href="/pages/payments.html">Payments</a>
                    </li>
                    ${isAdmin ? `
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" id="adminDropdown" role="button" data-bs-toggle="dropdown">Admin</a>
                        <ul class="dropdown-menu border-0 shadow-sm">
                            <li><a class="dropdown-item" href="/pages/users.html">User Management</a></li>
                            <li><a class="dropdown-item" href="/pages/audit-logs.html">Audit Trail</a></li>
                        </ul>
                    </li>
                    ` : ''}
                </ul>
                
                <div class="d-flex align-items-center">
                    <div class="user-profile-nav me-3 d-none d-md-flex">
                        <div class="avatar-circle bg-primary text-white d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; border-radius: 50%; font-weight: 700; font-size: 0.8rem;">
                            ${user ? user.full_name.charAt(0) : 'U'}
                        </div>
                        <span class="small fw-semibold text-dark">${user ? user.full_name : 'User'}</span>
                    </div>
                    <button class="btn btn-outline-danger btn-sm rounded-pill px-3" onclick="auth.logout()">Logout</button>
                </div>
            </div>
        </div>
    </nav>
    `;
    
    // Insert at the beginning of body
    document.body.insertAdjacentHTML('afterbegin', navHtml);
});
