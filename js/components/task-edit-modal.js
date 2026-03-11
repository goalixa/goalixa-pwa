/**
 * Task Edit Modal Component
 * Provides a reusable modal for editing tasks
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
 * Open a task edit modal
 * @param {Object} task - The task object to edit
 * @param {Object} options - Options for the modal
 * @param {Array} options.projects - List of available projects
 * @param {Array} options.goals - List of available goals
 * @param {Array} options.labels - List of available labels
 * @param {Function} options.onSave - Callback when task is saved
 * @param {Function} options.onCancel - Callback when modal is cancelled
 */
export function openTaskEditModal(task, options = {}) {
  const { projects = [], goals = [], labels = [], onSave, onCancel } = options;

  // Close any existing modal
  closeTaskEditModal();

  // Create abort controller for this modal
  currentAbortController = new AbortController();
  const { signal } = currentAbortController;

  // Create modal element
  const modal = document.createElement('div');
  modal.className = 'task-edit-modal-overlay';
  modal.id = 'task-edit-modal';

  const taskLabels = Array.isArray(task.labels) ? task.labels : [];
  const selectedLabelIds = new Set(taskLabels.map(l => l.id || l.label_id));

  modal.innerHTML = `
    <div class="task-edit-modal" role="dialog" aria-labelledby="task-edit-modal-title" aria-modal="true">
      <div class="task-edit-modal-header">
        <h2 id="task-edit-modal-title">Edit Task</h2>
        <button type="button" class="task-edit-modal-close" aria-label="Close modal">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <form class="task-edit-modal-form" id="task-edit-form">
        <div class="task-edit-modal-body">
          <div class="task-edit-field">
            <label for="edit-task-name" class="task-edit-field-label">Task name</label>
            <input
              type="text"
              id="edit-task-name"
              name="name"
              class="task-edit-input"
              value="${escapeHtml(task.name || '')}"
              required
              placeholder="Enter task name"
            />
          </div>

          <div class="task-edit-field">
            <label for="edit-task-project" class="task-edit-field-label">Project</label>
            <select id="edit-task-project" name="project_id" class="task-edit-select">
              <option value="">Unassigned</option>
              ${projects.map(p => `
                <option value="${p.id}" ${Number(p.id) === Number(task.project_id) ? 'selected' : ''}>
                  ${escapeHtml(p.name || '')}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="task-edit-field">
            <label for="edit-task-priority" class="task-edit-field-label">Priority</label>
            <select id="edit-task-priority" name="priority" class="task-edit-select">
              <option value="low" ${(task.priority || 'medium') === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${(task.priority || 'medium') === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="high" ${(task.priority || 'medium') === 'high' ? 'selected' : ''}>High</option>
            </select>
          </div>

          <div class="task-edit-field">
            <label for="edit-task-goal" class="task-edit-field-label">Goal (optional)</label>
            <select id="edit-task-goal" name="goal_id" class="task-edit-select">
              <option value="">None</option>
              ${goals.map(g => `
                <option value="${g.id}" ${Number(g.id) === Number(task.goal_id) ? 'selected' : ''}>
                  ${escapeHtml(g.name || '')}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="task-edit-field">
            <label class="task-edit-field-label">Labels</label>
            <div class="task-edit-labels-list">
              ${labels.length ? labels.map(l => `
                <label class="task-edit-label-item" for="edit-task-label-${l.id}">
                  <input
                    type="checkbox"
                    id="edit-task-label-${l.id}"
                    name="label_ids"
                    value="${l.id}"
                    ${selectedLabelIds.has(String(l.id)) || selectedLabelIds.has(Number(l.id)) ? 'checked' : ''}
                  />
                  <span class="task-edit-label-pill">
                    <span class="task-edit-label-swatch" style="background-color: ${escapeHtml(l.color || '#64748b')}"></span>
                    <span class="task-edit-label-name">${escapeHtml(l.name || '')}</span>
                  </span>
                </label>
              `).join('') : '<p class="task-edit-no-labels">No labels available</p>'}
            </div>
          </div>
        </div>

        <div class="task-edit-modal-footer">
          <button type="button" class="btn btn-outline-secondary task-edit-cancel-btn">Cancel</button>
          <button type="submit" class="btn btn-primary task-edit-save-btn">
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
  const form = modal.querySelector('#task-edit-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const taskData = {
      name: formData.get('name') || '',
      project_id: formData.get('project_id') || null,
      priority: formData.get('priority') || 'medium',
      goal_id: formData.get('goal_id') || null,
      label_ids: formData.getAll('label_ids').map(id => parseInt(id, 10)).filter(id => !isNaN(id))
    };

    const submitBtn = form.querySelector('.task-edit-save-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';

    try {
      const response = await appApi.updateTask(task.id, taskData);
      if (typeof onSave === 'function') {
        await onSave(response);
      }
      closeTaskEditModal();
    } catch (error) {
      console.error('Failed to update task:', error);
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bi bi-check-lg"></i> Save Changes';
      // Show error feedback
      const existingError = modal.querySelector('.task-edit-error');
      if (existingError) existingError.remove();

      const errorEl = document.createElement('div');
      errorEl.className = 'task-edit-error';
      errorEl.textContent = error.message || 'Failed to save task';
      form.insertBefore(errorEl, form.firstChild);
    }
  }, { signal });

  // Handle cancel button
  const cancelBtn = modal.querySelector('.task-edit-cancel-btn');
  cancelBtn.addEventListener('click', () => {
    if (typeof onCancel === 'function') {
      onCancel();
    }
    closeTaskEditModal();
  }, { signal });

  // Handle close button
  const closeBtn = modal.querySelector('.task-edit-modal-close');
  closeBtn.addEventListener('click', () => {
    if (typeof onCancel === 'function') {
      onCancel();
    }
    closeTaskEditModal();
  }, { signal });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (typeof onCancel === 'function') {
        onCancel();
      }
      closeTaskEditModal();
    }
  }, { signal });

  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      if (typeof onCancel === 'function') {
        onCancel();
      }
      closeTaskEditModal();
    }
  };
  document.addEventListener('keydown', handleEscape, { signal });
}

/**
 * Close the current task edit modal
 */
export function closeTaskEditModal() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  if (currentModal) {
    currentModal.remove();
    currentModal = null;
  }
}
