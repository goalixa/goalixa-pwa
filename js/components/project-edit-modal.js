/**
 * Project Edit Modal Component
 * Provides a reusable modal for editing projects
 */

import { appApi } from '../api.js';

let currentModal = null;
let currentAbortController = null;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Open a project edit modal
 * @param {Object} project - The project object to edit
 * @param {Object} options - Options for the modal
 * @param {Array} options.labels - List of available labels
 * @param {Function} options.onSave - Callback when project is saved
 * @param {Function} options.onCancel - Callback when modal is cancelled
 */
export function openProjectEditModal(project, options = {}) {
  const { labels = [], onSave, onCancel } = options;

  // Close any existing modal
  closeProjectEditModal();

  // Create abort controller for this modal
  currentAbortController = new AbortController();
  const { signal } = currentAbortController;

  // Create modal element
  const modal = document.createElement('div');
  modal.className = 'project-edit-modal-overlay';
  modal.id = 'project-edit-modal';

  const projectLabels = Array.isArray(project.labels) ? project.labels : [];
  const selectedLabelIds = new Set(projectLabels.map(l => l.id || l.label_id));

  modal.innerHTML = `
    <div class="project-edit-modal" role="dialog" aria-labelledby="project-edit-modal-title" aria-modal="true">
      <div class="project-edit-modal-header">
        <h2 id="project-edit-modal-title">Edit Project</h2>
        <button type="button" class="project-edit-modal-close" aria-label="Close modal">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <form class="project-edit-modal-form" id="project-edit-form">
        <div class="project-edit-modal-body">
          <div class="project-edit-field">
            <label for="edit-project-name" class="project-edit-field-label">Project name</label>
            <input
              type="text"
              id="edit-project-name"
              name="name"
              class="project-edit-input"
              value="${escapeHtml(project.name || '')}"
              required
              placeholder="Enter project name"
            />
          </div>

          <div class="project-edit-field">
            <label class="project-edit-field-label">Labels</label>
            <div class="project-edit-labels-list">
              ${labels.length ? labels.map(l => `
                <label class="project-edit-label-item" for="edit-project-label-${l.id}">
                  <input
                    type="checkbox"
                    id="edit-project-label-${l.id}"
                    name="label_ids"
                    value="${l.id}"
                    ${selectedLabelIds.has(String(l.id)) || selectedLabelIds.has(Number(l.id)) ? 'checked' : ''}
                  />
                  <span class="project-edit-label-pill">
                    <span class="project-edit-label-swatch" style="background-color: ${escapeHtml(l.color || '#64748b')}"></span>
                    <span class="project-edit-label-name">${escapeHtml(l.name || '')}</span>
                  </span>
                </label>
              `).join('') : '<p class="project-edit-no-labels">No labels available</p>'}
            </div>
          </div>
        </div>

        <div class="project-edit-modal-footer">
          <button type="button" class="btn btn-outline-secondary project-edit-cancel-btn">Cancel</button>
          <button type="submit" class="btn btn-primary project-edit-save-btn">
            <i class="bi bi-check-lg"></i>
            Save Changes
          </button>
        </div>
      </form>
    </div>
  `;

  // Add to document
  document.body.appendChild(modal);
  currentModal = modal;

  // Trap focus in modal
  const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const trapFocus = (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  modal.addEventListener('keydown', trapFocus, { signal });
  firstElement?.focus();

  // Handle form submission
  const form = modal.querySelector('#project-edit-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const projectData = {
      name: formData.get('name') || '',
      label_ids: formData.getAll('label_ids').map(id => parseInt(id, 10)).filter(id => !isNaN(id))
    };

    const submitBtn = form.querySelector('.project-edit-save-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';

    try {
      const response = await appApi.updateProject(project.id, projectData);
      if (typeof onSave === 'function') {
        await onSave(response);
      }
      closeProjectEditModal();
    } catch (error) {
      console.error('Failed to update project:', error);
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bi bi-check-lg"></i> Save Changes';
      // Show error feedback
      const existingError = modal.querySelector('.project-edit-error');
      if (existingError) existingError.remove();

      const errorEl = document.createElement('div');
      errorEl.className = 'project-edit-error';
      errorEl.textContent = error.message || 'Failed to save project';
      form.insertBefore(errorEl, form.firstChild);
    }
  }, { signal });

  // Handle cancel button
  const cancelBtn = modal.querySelector('.project-edit-cancel-btn');
  cancelBtn.addEventListener('click', () => {
    if (typeof onCancel === 'function') {
      onCancel();
    }
    closeProjectEditModal();
  }, { signal });

  // Handle close button
  const closeBtn = modal.querySelector('.project-edit-modal-close');
  closeBtn.addEventListener('click', () => {
    if (typeof onCancel === 'function') {
      onCancel();
    }
    closeProjectEditModal();
  }, { signal });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (typeof onCancel === 'function') {
        onCancel();
      }
      closeProjectEditModal();
    }
  }, { signal });

  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      if (typeof onCancel === 'function') {
        onCancel();
      }
      closeProjectEditModal();
    }
  };
  document.addEventListener('keydown', handleEscape, { signal });
}

/**
 * Close the current project edit modal
 */
export function closeProjectEditModal() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  if (currentModal) {
    currentModal.remove();
    currentModal = null;
  }
}
