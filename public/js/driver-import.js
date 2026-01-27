document.addEventListener("DOMContentLoaded", function () {
    const importForm = document.getElementById("importForm");
    const excelFile = document.getElementById("excelFile");
    const dropZone = document.getElementById("dropZone");
    const fileSelectionInfo = document.getElementById("fileSelectionInfo");
    const selectedFileName = document.getElementById("selectedFileName");
    const selectedFileSize = document.getElementById("selectedFileSize");
    const removeFileBtn = document.getElementById("removeFileBtn");
    const importBtn = document.getElementById("importBtn");
    const importResults = document.getElementById("importResults");

    // Drag and Drop
    dropZone.addEventListener("click", () => excelFile.click());

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("bg-primary", "bg-opacity-10", "border-primary");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("bg-primary", "bg-opacity-10", "border-primary");
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("bg-primary", "bg-opacity-10", "border-primary");
        if (e.dataTransfer.files.length) {
            excelFile.files = e.dataTransfer.files;
            handleFileSelection();
        }
    });

    excelFile.addEventListener("change", handleFileSelection);

    function handleFileSelection() {
        if (excelFile.files.length) {
            const file = excelFile.files[0];
            selectedFileName.textContent = file.name;
            selectedFileSize.textContent = (file.size / (1024 * 1024)).toFixed(2) + " MB";
            
            fileSelectionInfo.classList.remove("d-none");
            dropZone.classList.add("d-none");
            importBtn.disabled = false;
        }
    }

    removeFileBtn.addEventListener("click", () => {
        excelFile.value = "";
        fileSelectionInfo.classList.add("d-none");
        dropZone.classList.remove("d-none");
        importBtn.disabled = true;
    });

    importForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        if (!excelFile.files.length) return;

        importBtn.disabled = true;
        importBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Importing...';

        const formData = new FormData();
        formData.append("file", excelFile.files[0]);

        try {
            const response = await api.post("/drivers/bulk-import", formData);
            
            if (response.success) {
                showResults(response);
            } else {
                alert("Import failed: " + (response.message || "Unknown error"));
                resetBtn();
            }
        } catch (error) {
            console.error("Import error:", error);
            alert("An error occurred during import.");
            resetBtn();
        }
    });

    function showResults(data) {
        importForm.closest(".row").classList.add("d-none");
        importResults.classList.remove("d-none");

        document.getElementById("resTotal").textContent = data.summary.total;
        document.getElementById("resSuccess").textContent = data.summary.success;
        document.getElementById("resErrors").textContent = data.summary.failed;

        if (data.errors && data.errors.length > 0) {
            const errorSection = document.getElementById("errorDetailsSection");
            const errorBody = document.getElementById("errorTableBody");
            errorSection.classList.remove("d-none");
            errorBody.innerHTML = data.errors.map(err => `
                <tr>
                    <td class="small text-danger fw-bold">${err.driver_id}</td>
                    <td class="small">${err.message}</td>
                </tr>
            `).join("");
        }
    }

    function resetBtn() {
        importBtn.disabled = false;
        importBtn.innerHTML = '<i class="fas fa-upload me-2"></i> Start Migration Import';
    }
});
