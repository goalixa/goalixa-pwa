/**
 * Inline Editing (Notion-style)
 * Edit task fields directly without opening modals
 */

class InlineEditor {
  constructor() {
    this.activeEditor = null;
    this.originalValue = null;
    this.onSaveCallback = null;
    this.onCancelCallback = null;
  }

  /**
   * Initialize inline editing for task titles
   * @param {string} containerSelector - CSS selector for container
   * @param {function} onSave - Callback when save is triggered (element, newValue, oldValue)
   */
  init(containerSelector, onSave, onCancel = null) {
    this.onSaveCallback = onSave;
    this.onCancelCallback = onCancel;

    const container = document.querySelector(containerSelector);
    if (!container) {
      console.warn(`InlineEditor: Container ${containerSelector} not found`);
      return;
    }

    // Use event delegation for better performance
    container.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
  }

  /**
   * Handle double-click on editable elements
   * @param {Event} e
   */
  handleDoubleClick(e) {
    // Find the task title element
    const taskTitle = e.target.closest('.task-title');
    if (!taskTitle) return;

    // Don't start editing if already editing
    if (this.activeEditor) return;

    // Don't edit if clicking on a button or link
    if (e.target.closest('button, a')) return;

    this.startEditing(taskTitle);
  }

  /**
   * Start editing an element
   * @param {HTMLElement} element - The element to edit
   */
  startEditing(element) {
    // Store original value
    this.originalValue = element.textContent.trim();

    // Get task ID from the task item
    const taskItem = element.closest('.task-item');
    const taskId = this.getTaskId(taskItem);

    if (!taskId) {
      console.warn('InlineEditor: Could not find task ID');
      return;
    }

    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-edit-input';
    input.value = this.originalValue;
    input.dataset.taskId = taskId;

    // Replace element with input
    element.replaceWith(input);
    this.activeEditor = input;

    // Focus and select all text
    input.focus();
    input.select();

    // Add event listeners
    input.addEventListener('blur', () => this.handleBlur(input, element));
    input.addEventListener('keydown', (e) => this.handleKeydown(e, input, element));

    // Add editing class to task item for styling
    if (taskItem) {
      taskItem.classList.add('is-editing');
    }
  }

  /**
   * Handle blur event (auto-save)
   * @param {HTMLInputElement} input
   * @param {HTMLElement} originalElement
   */
  async handleBlur(input, originalElement) {
    // Debounce to prevent duplicate saves
    if (!this.activeEditor) return;

    // Small delay to allow click events to fire first
    setTimeout(async () => {
      if (!this.activeEditor) return;
      await this.save(input, originalElement);
    }, 100);
  }

  /**
   * Handle keydown events
   * @param {KeyboardEvent} e
   * @param {HTMLInputElement} input
   * @param {HTMLElement} originalElement
   */
  handleKeydown(e, input, originalElement) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.save(input, originalElement);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancel(input, originalElement);
    }
  }

  /**
   * Save the edited value
   * @param {HTMLInputElement} input
   * @param {HTMLElement} originalElement
   */
  async save(input, originalElement) {
    if (!this.activeEditor) return;

    const newValue = input.value.trim();
    const taskId = input.dataset.taskId;

    // Validate
    if (!newValue) {
      this.cancel(input, originalElement);
      return;
    }

    // No change
    if (newValue === this.originalValue) {
      this.cancel(input, originalElement);
      return;
    }

    // Show loading state
    input.disabled = true;
    input.classList.add('is-saving');

    try {
      // Call save callback
      if (this.onSaveCallback) {
        await this.onSaveCallback({
          taskId,
          field: 'name',
          newValue,
          oldValue: this.originalValue,
          input,
          originalElement
        });
      }

      // Restore element with new value
      originalElement.textContent = newValue;
      this.restoreElement(input, originalElement);
    } catch (error) {
      console.error('InlineEditor: Save failed', error);

      // Show error state
      input.classList.add('is-error');
      input.disabled = false;
      input.focus();
      input.select();

      // Optionally show error message
      if (error.message) {
        this.showError(input, error.message);
      }
    }
  }

  /**
   * Cancel editing and restore original value
   * @param {HTMLInputElement} input
   * @param {HTMLElement} originalElement
   */
  cancel(input, originalElement) {
    if (!this.activeEditor) return;

    // Restore original value
    originalElement.textContent = this.originalValue;
    this.restoreElement(input, originalElement);

    // Call cancel callback
    if (this.onCancelCallback) {
      this.onCancelCallback({
        oldValue: this.originalValue,
        input,
        originalElement
      });
    }
  }

  /**
   * Restore the original element
   * @param {HTMLInputElement} input
   * @param {HTMLElement} originalElement
   */
  restoreElement(input, originalElement) {
    // Replace input with original element
    input.replaceWith(originalElement);

    // Remove editing class
    const taskItem = originalElement.closest('.task-item');
    if (taskItem) {
      taskItem.classList.remove('is-editing');
    }

    // Clear active editor
    this.activeEditor = null;
    this.originalValue = null;

    // Remove any error messages
    this.clearError();
  }

  /**
   * Show error message
   * @param {HTMLInputElement} input
   * @param {string} message
   */
  showError(input, message) {
    // Remove existing error
    this.clearError();

    // Create error element
    const error = document.createElement('div');
    error.className = 'inline-edit-error';
    error.textContent = message;
    error.dataset.inlineEditError = 'true';

    // Insert after input
    input.parentNode.insertBefore(error, input.nextSibling);

    // Auto-hide after 3 seconds
    setTimeout(() => this.clearError(), 3000);
  }

  /**
   * Clear error message
   */
  clearError() {
    const error = document.querySelector('[data-inline-edit-error]');
    if (error) {
      error.remove();
    }
  }

  /**
   * Get task ID from task item element
   * @param {HTMLElement} taskItem
   * @returns {string|null}
   */
  getTaskId(taskItem) {
    if (!taskItem) return null;

    // Look for task ID in various possible locations
    const timeElement = taskItem.querySelector('.task-time[data-task-id]');
    if (timeElement) {
      return timeElement.getAttribute('data-task-id');
    }

    // Fallback: look in buttons
    const button = taskItem.querySelector('[data-task-id]');
    if (button) {
      return button.getAttribute('data-task-id');
    }

    return null;
  }

  /**
   * Programmatically start editing an element
   * @param {string} selector - CSS selector for element
   */
  edit(selector) {
    const element = document.querySelector(selector);
    if (element) {
      this.startEditing(element);
    }
  }

  /**
   * Check if currently editing
   * @returns {boolean}
   */
  isEditing() {
    return this.activeEditor !== null;
  }

  /**
   * Get current editing value
   * @returns {string|null}
   */
  getCurrentValue() {
    return this.activeEditor ? this.activeEditor.value : null;
  }

  /**
   * Destroy inline editor
   */
  destroy() {
    if (this.activeEditor) {
      const taskItem = this.activeEditor.closest('.task-item');
      const originalElement = document.createElement('span');
      originalElement.className = 'task-title';
      originalElement.textContent = this.originalValue;

      this.activeEditor.replaceWith(originalElement);

      if (taskItem) {
        taskItem.classList.remove('is-editing');
      }
    }

    this.activeEditor = null;
    this.originalValue = null;
    this.onSaveCallback = null;
    this.onCancelCallback = null;
    this.clearError();
  }
}

// Export singleton instance
export const inlineEditor = new InlineEditor();
export default InlineEditor;
