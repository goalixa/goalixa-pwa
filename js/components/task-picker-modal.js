/**
 * Task Picker Modal Component
 * Allows users to select multiple tasks to add to Today's Focus
 */

import { escapeHtml, logger } from '../utils.js';

let currentModal = null;
let currentAbortController = null;
let selectedTaskIds = new Set();
let filteredTasks = [];

/**
 * Create and show a task picker modal
 * @param {Object} options - Configuration options
 * @param {Array} options.tasks - Array of task objects
 * @param {Array} options.existingTaskIds - Array of task IDs already in focus
 * @param {Function} options.onSelect - Callback with selected task IDs
 * @param {Function} options.onClose - Callback on close
 */
export function createTaskPickerModal(options = {}) {
  const {
    tasks = [],
    existingTaskIds = [],
    onSelect,
    onClose
  } = options;

  // Close any existing modal
  closeTaskPickerModal();

  // Create abort controller for this modal
  currentAbortController = new AbortController();
  const { signal } = currentAbortController;

  // Initialize selected tasks
  selectedTaskIds = new Set();

  // Filter available tasks (exclude completed and already selected)
  const availableTasks = tasks.filter(task =>
    task.status !== 'completed' && !existingTaskIds.includes(task.id)
  );

  filteredTasks = [...availableTasks];

  // Create modal element
  const modal = document.createElement('div');
  modal.className = 'task-picker-modal-overlay';
  modal.id = 'task-picker-modal';

  // Group tasks by project
  const groupedTasks = groupTasksByProject(filteredTasks);

  modal.innerHTML = `
    <div class="task-picker-modal" role="dialog" aria-labelledby="task-picker-modal-title" aria-modal="true">
      <div class="task-picker-modal-header">
        <h2 id="task-picker-modal-title">Add Tasks to Focus</h2>
        <button type="button" class="task-picker-modal-close" aria-label="Close modal">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <div class="task-picker-modal-filters">
        <div class="task-picker-search-wrapper">
          <i class="bi bi-search"></i>
          <input
            type="text"
            id="task-picker-search"
            class="task-picker-search"
            placeholder="Search tasks..."
            aria-label="Search tasks"
          />
        </div>

        <select id="task-picker-priority-filter" class="task-picker-select" aria-label="Filter by priority">
          <option value="">All Priorities</option>
          <option value="high">High Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="low">Low Priority</option>
        </select>
      </div>

      <div class="task-picker-modal-body">
        ${renderTaskGroups(groupedTasks)}
      </div>

      <div class="task-picker-modal-footer">
        <div class="task-picker-selection-info">
          <span id="task-picker-count">0 of ${availableTasks.length} selected</span>
        </div>
        <div class="task-picker-modal-actions">
          <button type="button" class="btn btn-outline-secondary task-picker-select-all-btn">
            Select All
          </button>
          <button type="button" class="btn btn-outline-secondary task-picker-clear-btn">
            Clear
          </button>
          <button type="button" class="btn btn-outline-secondary task-picker-cancel-btn">
            Cancel
          </button>
          <button type="button" class="btn btn-primary task-picker-confirm-btn">
            <i class="bi bi-plus-lg"></i>
            Add to Focus
          </button>
        </div>
      </div>
    </div>
  `;

  // Add to document
  document.body.appendChild(modal);
  currentModal = modal;

  // Setup event listeners
  setupEventListeners(modal, availableTasks, groupedTasks, signal, onSelect, onClose);

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
}

/**
 * Group tasks by project
 * @param {Array} tasks - Tasks to group
 * @returns {Object} Tasks grouped by project
 */
function groupTasksByProject(tasks) {
  const grouped = {};

  tasks.forEach(task => {
    const projectName = task.project_name || 'Unassigned';
    if (!grouped[projectName]) {
      grouped[projectName] = [];
    }
    grouped[projectName].push(task);
  });

  // Sort projects and tasks within each project
  const sortedGrouped = {};
  Object.keys(grouped)
    .sort()
    .forEach(projectName => {
      sortedGrouped[projectName] = grouped[projectName].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    });

  return sortedGrouped;
}

/**
 * Render task groups HTML
 * @param {Object} groupedTasks - Tasks grouped by project
 * @returns {string} HTML string
 */
function renderTaskGroups(groupedTasks) {
  const projects = Object.keys(groupedTasks);

  if (projects.length === 0) {
    return `
      <div class="task-picker-empty-state">
        <i class="bi bi-inbox"></i>
        <p>No available tasks to add</p>
        <small>All tasks are either completed or already in your focus</small>
      </div>
    `;
  }

  return projects.map(projectName => {
    const projectTasks = groupedTasks[projectName];
    return `
      <div class="task-picker-project-group">
        <div class="task-picker-project-header">
          <h3 class="task-picker-project-name">${escapeHtml(projectName)}</h3>
          <span class="task-picker-project-count">${projectTasks.length}</span>
        </div>
        <div class="task-picker-tasks-list">
          ${projectTasks.map(task => renderTaskItem(task)).join('')}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render a single task item
 * @param {Object} task - Task object
 * @returns {string} HTML string
 */
function renderTaskItem(task) {
  const priorityIcon = getPriorityIcon(task.priority);
  const isSelected = selectedTaskIds.has(task.id);

  return `
    <label class="task-picker-task-item ${isSelected ? 'selected' : ''}" for="task-picker-${task.id}">
      <input
        type="checkbox"
        id="task-picker-${task.id}"
        class="task-picker-checkbox"
        value="${task.id}"
        data-task-id="${task.id}"
        ${isSelected ? 'checked' : ''}
      />
      <div class="task-picker-task-content">
        <span class="task-picker-task-name">${escapeHtml(task.name || '')}</span>
        <div class="task-picker-task-meta">
          ${priorityIcon}
          <span class="task-picker-task-priority">${task.priority || 'medium'}</span>
        </div>
      </div>
    </label>
  `;
}

/**
 * Get priority icon based on priority level
 * @param {string} priority - Priority level (high, medium, low)
 * @returns {string} HTML icon string
 */
function getPriorityIcon(priority) {
  const icons = {
    high: '<i class="bi bi-exclamation-circle-fill" style="color: var(--danger);"></i>',
    medium: '<i class="bi bi-dash-circle" style="color: var(--warning);"></i>',
    low: '<i class="bi bi-info-circle" style="color: var(--info);"></i>'
  };
  return icons[priority] || icons.medium;
}

/**
 * Setup event listeners for the modal
 * @param {HTMLElement} modal - Modal element
 * @param {Array} availableTasks - Available tasks
 * @param {Object} groupedTasks - Tasks grouped by project
 * @param {AbortSignal} signal - Abort signal
 * @param {Function} onSelect - Callback for selection
 * @param {Function} onClose - Callback for close
 */
function setupEventListeners(modal, availableTasks, groupedTasks, signal, onSelect, onClose) {
  // Search input
  const searchInput = modal.querySelector('#task-picker-search');
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    filterAndRenderTasks(modal, availableTasks, searchTerm, null);
  }, { signal });

  // Priority filter
  const priorityFilter = modal.querySelector('#task-picker-priority-filter');
  priorityFilter.addEventListener('change', (e) => {
    const searchTerm = searchInput.value.toLowerCase();
    filterAndRenderTasks(modal, availableTasks, searchTerm, e.target.value);
  }, { signal });

  // Checkbox listeners
  const checkboxes = modal.querySelectorAll('.task-picker-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const taskId = parseInt(e.target.dataset.taskId, 10);
      if (e.target.checked) {
        selectedTaskIds.add(taskId);
      } else {
        selectedTaskIds.delete(taskId);
      }
      updateSelectionCount(modal, availableTasks);
      updateSelectAllButton(modal, availableTasks);
    }, { signal });
  });

  // Select All button
  const selectAllBtn = modal.querySelector('.task-picker-select-all-btn');
  selectAllBtn.addEventListener('click', () => {
    const visibleCheckboxes = modal.querySelectorAll('.task-picker-checkbox:not([style*="display: none"])');
    visibleCheckboxes.forEach(checkbox => {
      if (!checkbox.checked) {
        checkbox.checked = true;
        selectedTaskIds.add(parseInt(checkbox.dataset.taskId, 10));
      }
    });
    updateSelectionCount(modal, availableTasks);
    updateSelectAllButton(modal, availableTasks);
  }, { signal });

  // Clear button
  const clearBtn = modal.querySelector('.task-picker-clear-btn');
  clearBtn.addEventListener('click', () => {
    const checkboxes = modal.querySelectorAll('.task-picker-checkbox:checked');
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
      selectedTaskIds.delete(parseInt(checkbox.dataset.taskId, 10));
    });
    updateSelectionCount(modal, availableTasks);
    updateSelectAllButton(modal, availableTasks);
  }, { signal });

  // Cancel button
  const cancelBtn = modal.querySelector('.task-picker-cancel-btn');
  cancelBtn.addEventListener('click', () => {
    if (typeof onClose === 'function') {
      onClose();
    }
    closeTaskPickerModal();
  }, { signal });

  // Confirm button
  const confirmBtn = modal.querySelector('.task-picker-confirm-btn');
  confirmBtn.addEventListener('click', () => {
    const selectedIds = Array.from(selectedTaskIds);
    if (typeof onSelect === 'function') {
      onSelect(selectedIds);
    }
    closeTaskPickerModal();
  }, { signal });

  // Close button
  const closeBtn = modal.querySelector('.task-picker-modal-close');
  closeBtn.addEventListener('click', () => {
    if (typeof onClose === 'function') {
      onClose();
    }
    closeTaskPickerModal();
  }, { signal });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (typeof onClose === 'function') {
        onClose();
      }
      closeTaskPickerModal();
    }
  }, { signal });

  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      if (typeof onClose === 'function') {
        onClose();
      }
      closeTaskPickerModal();
    }
  };
  document.addEventListener('keydown', handleEscape, { signal });

  // Initial count update
  updateSelectionCount(modal, availableTasks);
  updateSelectAllButton(modal, availableTasks);
}

/**
 * Filter and render tasks based on search term and priority
 * @param {HTMLElement} modal - Modal element
 * @param {Array} availableTasks - Available tasks
 * @param {string} searchTerm - Search term
 * @param {string} priorityFilter - Priority filter
 */
function filterAndRenderTasks(modal, availableTasks, searchTerm, priorityFilter) {
  // Filter tasks
  const filtered = availableTasks.filter(task => {
    const matchesSearch = searchTerm === '' ||
      task.name.toLowerCase().includes(searchTerm);
    const matchesPriority = priorityFilter === '' || priorityFilter === null ||
      task.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  filteredTasks = filtered;

  // Group and render
  const grouped = groupTasksByProject(filtered);
  const body = modal.querySelector('.task-picker-modal-body');
  body.innerHTML = renderTaskGroups(grouped);

  // Re-attach checkbox listeners
  const checkboxes = modal.querySelectorAll('.task-picker-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const taskId = parseInt(e.target.dataset.taskId, 10);
      if (e.target.checked) {
        selectedTaskIds.add(taskId);
      } else {
        selectedTaskIds.delete(taskId);
      }
      updateSelectionCount(modal, availableTasks);
      updateSelectAllButton(modal, availableTasks);
    });
  });

  // Re-check selected items
  filteredTasks.forEach(task => {
    if (selectedTaskIds.has(task.id)) {
      const checkbox = modal.querySelector(`#task-picker-${task.id}`);
      if (checkbox) {
        checkbox.checked = true;
      }
    }
  });

  updateSelectionCount(modal, availableTasks);
  updateSelectAllButton(modal, availableTasks);
}

/**
 * Update the selection count display
 * @param {HTMLElement} modal - Modal element
 * @param {Array} availableTasks - Available tasks
 */
function updateSelectionCount(modal, availableTasks) {
  const countEl = modal.querySelector('#task-picker-count');
  if (countEl) {
    countEl.textContent = `${selectedTaskIds.size} of ${availableTasks.length} selected`;
  }
}

/**
 * Update Select All button state
 * @param {HTMLElement} modal - Modal element
 * @param {Array} availableTasks - Available tasks
 */
function updateSelectAllButton(modal, availableTasks) {
  const selectAllBtn = modal.querySelector('.task-picker-select-all-btn');
  if (selectAllBtn) {
    const visibleCheckboxes = modal.querySelectorAll('.task-picker-checkbox:not([style*="display: none"])');
    const allVisible = visibleCheckboxes.length > 0 &&
      Array.from(visibleCheckboxes).every(cb => cb.checked);
    selectAllBtn.disabled = allVisible && visibleCheckboxes.length > 0;
  }
}

/**
 * Close the task picker modal
 */
export function closeTaskPickerModal() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  if (currentModal) {
    currentModal.remove();
    currentModal = null;
  }
  selectedTaskIds = new Set();
  filteredTasks = [];
}
