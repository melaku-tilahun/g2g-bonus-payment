// ============ DRIVER NOTES FUNCTIONALITY ============
document.addEventListener("DOMContentLoaded", () => {
  const notesBtn = document.getElementById("notesBtn");
  const notesModal = document.getElementById("notesModal")
    ? new bootstrap.Modal(document.getElementById("notesModal"))
    : null;
  const notesList = document.getElementById("notesList");
  const noteTextarea = document.getElementById("noteTextarea");
  const charCount = document.getElementById("charCount");
  const saveNoteBtn = document.getElementById("saveNoteBtn");

  let currentDriverId = null;
  let currentNotes = [];

  // Get driver ID from URL
  const params = new URLSearchParams(window.location.search);
  currentDriverId = params.get("id");

  // Character counter
  if (noteTextarea) {
    noteTextarea.addEventListener("input", () => {
      charCount.textContent = noteTextarea.value.length;
    });
  }

  // Open Notes Modal
  if (notesBtn && notesModal) {
    notesBtn.addEventListener("click", async () => {
      try {
        // Fetch latest driver data to get notes
        const driver = await api.get(`/drivers/${currentDriverId}`);
        currentNotes = driver.notes || [];
        renderNotes(currentNotes);
        notesModal.show();
      } catch (error) {
        console.error("Failed to load notes:", error);
        ui.showError("Failed to load notes");
      }
    });
  }

  // Render notes list
  function renderNotes(notes) {
    if (!notesList) return;

    if (!notes || notes.length === 0) {
      notesList.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="fas fa-clipboard fa-2x mb-2 opacity-25"></i>
          <div class="small">No notes yet</div>
        </div>
      `;
      return;
    }

    // Sort by newest first
    const sortedNotes = [...notes].reverse();

    notesList.innerHTML = sortedNotes
      .map((note, index) => {
        const date = new Date(note.created_at);
        const formattedDate = date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        return `
        <div class="p-3 ${index < sortedNotes.length - 1 ? "border-bottom" : ""}">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div class="fw-bold text-dark small">${note.created_by_name || "Unknown"}</div>
            <div class="text-muted small">${formattedDate}</div>
          </div>
          <div class="text-dark">${escapeHtml(note.text)}</div>
        </div>
      `;
      })
      .join("");
  }

  // Save Note
  if (saveNoteBtn) {
    saveNoteBtn.addEventListener("click", async () => {
      const noteText = noteTextarea.value.trim();

      if (!noteText) {
        ui.showError("Note text cannot be empty");
        return;
      }

      try {
        saveNoteBtn.disabled = true;
        saveNoteBtn.innerHTML =
          '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

        const response = await api.post(`/drivers/${currentDriverId}/notes`, {
          note: noteText,
        });

        currentNotes = response.notes;
        renderNotes(currentNotes);
        noteTextarea.value = "";
        charCount.textContent = "0";
        ui.showSuccess("Note added successfully");
      } catch (error) {
        console.error("Failed to add note:", error);
        ui.showError(error.message || "Failed to add note");
      } finally {
        saveNoteBtn.disabled = false;
        saveNoteBtn.innerHTML = '<i class="fas fa-save me-2"></i> Save Note';
      }
    });
  }

  // Helper function to escape HTML
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
});
