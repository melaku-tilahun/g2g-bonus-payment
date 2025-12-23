document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const driverId = params.get('id');

    if (!driverId) {
        window.location.href = '/index.html';
        return;
    }

    const modal = new bootstrap.Modal(document.getElementById('verifyModal'));
    const payModal = new bootstrap.Modal(document.getElementById('paymentModal')); // We'll add this modal to HTML too

    // Initial Skeleton State
    showSkeletons();

    try {
        const driver = await api.get(`/drivers/${driverId}`);
        const bonuses = await api.get(`/bonuses/driver/${driverId}`);
        renderDriver(driver, bonuses);
    } catch (error) {
        ui.toast('Failed to load driver details', 'error');
        console.error(error);
    }

    // Mark as Verified Modal Logic
    document.getElementById('markVerifiedBtn').onclick = () => {
        document.getElementById('modalDriverName').textContent = document.getElementById('driverName').textContent;
        document.getElementById('modalTotalBonus').textContent = document.getElementById('totalBonus').textContent;
        document.getElementById('verificationDate').valueAsDate = new Date();
        modal.show();
    };

    document.getElementById('confirmVerifyBtn').onclick = async () => {
        const confirmValue = document.getElementById('confirmInput').value.trim().toLowerCase();
        const date = document.getElementById('verificationDate').value;
        
        if (confirmValue !== 'yes') {
            ui.toast('Please type "yes" to confirm', 'error');
            return;
        }

        const btn = document.getElementById('confirmVerifyBtn');
        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Verifying...';

            await api.put(`/drivers/${driverId}/verify`, { verificationDate: date });
            
            ui.toast('Driver verified successfully!', 'success');
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            modal.hide();
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            ui.toast(error.message || 'Verification failed', 'error');
            btn.disabled = false;
            btn.textContent = 'Confirm Verification';
        }
    };

    // Payment Logic
    document.getElementById('processPaymentBtn').onclick = () => {
        document.getElementById('payDriverName').textContent = document.getElementById('driverName').textContent;
        document.getElementById('payAmount').value = document.getElementById('totalBonus').textContent.replace(' ETB', '').replace(/,/g, '');
        document.getElementById('payDate').valueAsDate = new Date();
        payModal.show();
    };

    document.getElementById('confirmPayBtn').onclick = async () => {
        const amount = document.getElementById('payAmount').value;
        const method = document.getElementById('payMethod').value;
        const periodStart = document.getElementById('payPeriodStart').value;
        const periodEnd = document.getElementById('payPeriodEnd').value;
        const notes = document.getElementById('payNotes').value;

        const btn = document.getElementById('confirmPayBtn');
        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Recording...';

            await api.post('/payments', { 
                driver_id: driverId,
                total_amount: amount, 
                payment_method: method, 
                bonus_period_start: periodStart, 
                bonus_period_end: periodEnd, 
                notes: notes 
            });
            
            ui.toast('Payment recorded successfully!', 'success');
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            payModal.hide();
            // Reload page to show updated status
            setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
            ui.toast(error.message || 'Payment failed', 'error');
            btn.disabled = false;
            btn.textContent = 'Record Payment';
        }
    };
});

function showSkeletons() {
    document.getElementById('bonusHistoryList').innerHTML = `
        <div class="skeleton skeleton-text w-75 mb-4"></div>
        <div class="skeleton skeleton-text w-100 mb-2"></div>
        <div class="skeleton skeleton-text w-50 mb-2"></div>
        <div class="skeleton skeleton-text w-100 mb-4"></div>
    `;
}

function renderDriver(driver, bonuses) {
    document.getElementById('driverName').textContent = driver.full_name;
    document.getElementById('nameInitial').textContent = driver.full_name.charAt(0);
    document.getElementById('driverId').textContent = driver.driver_id;
    document.getElementById('driverPhone').textContent = driver.phone_number || 'No phone';
    document.getElementById('createdAt').textContent = new Date(driver.created_at).toLocaleDateString();
    
    const badge = document.getElementById('driverStatusBadge');
    badge.textContent = driver.verified ? 'Verified' : 'Unverified';
    badge.className = `badge-status ${driver.verified ? 'badge-verified' : 'badge-unverified'}`;

    if (driver.verified) {
        document.getElementById('markVerifiedBtn').classList.add('d-none');
        document.getElementById('processPaymentBtn').classList.remove('d-none');
        document.getElementById('verificationInfoSection').classList.remove('d-none');
        document.getElementById('verifiedDateText').textContent = new Date(driver.verified_date).toLocaleDateString();
        document.getElementById('summaryStatus').textContent = 'Verified for Payment';
    }

    const total = bonuses.reduce((sum, b) => sum + parseFloat(b.net_payout), 0);
    document.getElementById('totalBonus').textContent = `${total.toLocaleString()} ETB`;
    document.getElementById('weeksCount').textContent = bonuses.length;
    
    if (bonuses.length > 0) {
        const dates = bonuses.map(b => new Date(b.week_date)).sort((a,b) => a-b);
        document.getElementById('bonusPeriod').textContent = `${dates[0].toLocaleDateString('en-US', {month:'short', day:'numeric'})} - ${dates[dates.length-1].toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}`;
        
        renderBonusList(bonuses);
    } else {
        document.getElementById('bonusHistoryList').innerHTML = '';
        document.getElementById('emptyBonusState').classList.remove('d-none');
    }
}

function renderBonusList(bonuses) {
    const container = document.getElementById('bonusHistoryList');
    container.innerHTML = '';
    
    bonuses.sort((a,b) => new Date(b.week_date) - new Date(a.week_date)).forEach(b => {
        const div = document.createElement('div');
        div.className = 'card-premium mb-3 p-3 border-0 bg-light';
        div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <div class="small text-muted text-uppercase fw-bold mb-1">Week Ending</div>
                    <div class="fw-bold">${new Date(b.week_date).toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'})}</div>
                </div>
                <div class="text-end">
                    <div class="h5 fw-bold text-primary mb-0">${parseFloat(b.net_payout).toLocaleString()} ETB</div>
                    <div class="small text-muted">Ref: ${b.file_name || 'Manual Import'}</div>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}
