document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    const excelFile = document.getElementById('excelFile');
    const dropZone = document.getElementById('dropZone');
    const uploadBtn = document.getElementById('uploadBtn');
    const checklistItems = document.querySelectorAll('#validationChecklist .list-group-item');

    // Drag and Drop
    dropZone.onclick = () => excelFile.click();
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('border-primary'); };
    dropZone.ondragleave = () => dropZone.classList.remove('border-primary');
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-primary');
        if (e.dataTransfer.files.length) {
            excelFile.files = e.dataTransfer.files;
            handleFileSelect();
        }
    };

    excelFile.onchange = handleFileSelect;

    async function handleFileSelect() {
        const file = excelFile.files[0];
        if (!file) return;

        document.getElementById('fileSelectionInfo').classList.remove('d-none');
        document.getElementById('selectedFileName').textContent = file.name;
        document.getElementById('selectedFileSize').textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
        dropZone.classList.add('d-none');

        // Start Auto-Validation
        validateFile(file);
    }

    async function validateFile(file) {
        // Reset checklist
        checklistItems.forEach(item => {
            item.classList.add('opacity-50');
            item.querySelector('i').className = 'far fa-circle text-muted';
        });

        const updateItem = (name, status) => {
            const item = Array.from(checklistItems).find(i => i.dataset.item === name);
            if (!item) return;
            item.classList.remove('opacity-50');
            item.querySelector('i').className = status ? 'fas fa-check-circle text-success' : 'fas fa-times-circle text-danger';
        };

        try {
            const formData = new FormData();
            formData.append('file', file);

            // Fetch validation from backend
            const response = await api.post('/uploads/validate', formData);
            const stats = response.validation_results;
            
            updateItem('readable', stats.file_readable);
            updateItem('sheet', stats.single_sheet);
            updateItem('columns', stats.columns_valid);
            updateItem('data', stats.has_data);

            if (response.ready_for_import) {
                uploadBtn.disabled = false;
                ui.toast('File validated successfully!', 'success');
            } else {
                uploadBtn.disabled = true;
                let msg = 'Validation failed.';
                if (stats.suggestions && stats.suggestions.length > 0) {
                     msg += ' ' + stats.suggestions[0];
                }
                ui.toast(msg, 'error');
            }
        } catch (error) {
            console.error(error);
            ui.toast('Error validating file', 'error');
        }
    }

    uploadForm.onsubmit = async (e) => {
        e.preventDefault();
        const file = excelFile.files[0];
        const weekDate = document.getElementById('weekDate').value;

        if (!file || !weekDate) return;
        
        // Append time to date to ensure timezone consistency if needed, 
        // but input type="date" value is YYYY-MM-DD. 
        // Backend parses new Date(week_date).

        try {
            uploadBtn.disabled = true;
            uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Processing...';

            const formData = new FormData();
            formData.append('week_date', weekDate); // Backend expects week_date (snake_case)
            formData.append('file', file);

            // Progress Bar simulation (real progress requires XHR)
            const result = await api.post('/uploads/excel', formData);

            showResults(result);
        } catch (error) {
            ui.toast(error.message || 'Upload failed', 'error');
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-cloud-upload-alt me-2"></i> Start Import Process';
        }
    };

    function showResults(data) {
        document.querySelector('.row.g-4').classList.add('d-none');
        document.getElementById('importResults').classList.remove('d-none');
        
        document.getElementById('resTotal').textContent = data.total_records;
        document.getElementById('resSuccess').textContent = data.success_count;
        document.getElementById('resSkipped').textContent = data.skipped_count;
        document.getElementById('resErrors').textContent = data.error_count;

        if (data.errors && data.errors.length > 0) {
            document.getElementById('errorDetailsSection').classList.remove('d-none');
            const tbody = document.getElementById('errorTableBody');
            tbody.innerHTML = '';
            data.errors.forEach(err => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td class="small">${err.row}</td><td class="small text-danger">${err.message}</td>`;
                tbody.appendChild(tr);
            });
        }
    }

    window.downloadReport = () => {
        const total = document.getElementById('resTotal').textContent;
        const success = document.getElementById('resSuccess').textContent;
        const skipped = document.getElementById('resSkipped').textContent;
        const errors = document.getElementById('resErrors').textContent;
        const fileName = document.getElementById('selectedFileName').textContent;

        const content = `Import Report - ${new Date().toLocaleString()}
File: ${fileName}
-----------------------------------
Total Records Found: ${total}
Successfully Imported: ${success}
Skipped (Verified): ${skipped}
Errors: ${errors}

Generated by G2G Bonus Tracking System
`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `import_report_${new Date().getTime()}.txt`;
        a.click();
        window.URL.revokeObjectURL(url);
        ui.toast('Report downloaded', 'success');
    };

    // Load History
    loadHistory();
});

async function loadHistory() {
    try {
        const history = await api.get('/uploads/history');
        const tbody = document.getElementById('historyTableBody');
        tbody.innerHTML = '';
        
        if (!history.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No upload history found</td></tr>';
            return;
        }

        history.forEach(h => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="ps-4">${new Date(h.imported_at).toLocaleDateString()}</td>
                <td class="fw-semibold">
                    ${h.file_path ? `<a href="/uploads/${h.file_path}" target="_blank" class="text-decoration-none"><i class="fas fa-download me-1"></i> ${h.file_name}</a>` : h.file_name}
                </td>
                <td>${new Date(h.week_date).toLocaleDateString()}</td>
                <td class="text-center"><span class="badge bg-light text-dark border">${h.total_records}</span></td>
                <td class="text-center"><span class="badge bg-success bg-opacity-10 text-success">${h.success_count}</span></td>
                <td class="text-center"><span class="badge bg-warning bg-opacity-10 text-warning">${h.skipped_count}</span></td>
                <td class="text-center"><span class="badge bg-danger bg-opacity-10 text-danger">${h.error_count}</span></td>
                <td><span class="small text-muted">${h.imported_by_name || 'Admin'}</span></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
    }
}
