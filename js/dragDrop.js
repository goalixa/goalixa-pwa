/**
 * Drag & Drop Task Reordering
 * Allows users to reorder tasks by dragging them
 */

import { logger } from './utils.js';

class TaskDragDrop {
  constructor() {
    this.draggedElement = null;
    this.draggedTaskId = null;
    this.dropZone = null;
    this.placeholder = null;
    this.onReorderCallback = null;
  }

  /**
   * Initialize drag & drop for a task list
   * @param {string} containerSelector - CSS selector for task list container
   * @param {function} onReorder - Callback when tasks are reordered (oldIndex, newIndex, taskId)
   */
  init(containerSelector, onReorder) {
    this.onReorderCallback = onReorder;
    const container = document.querySelector(containerSelector);

    if (!container) {
      logger.warn(`TaskDragDrop: Container ${containerSelector} not found`);
      return;
    }

    this.attachListeners(container);
  }

  /**
   * Enable drag & drop for all task items in a container
   * @param {HTMLElement} container - The task list container
   */
  attachListeners(container) {
    // Use event delegation for better performance
    container.addEventListener('dragstart', (e) => this.handleDragStart(e), false);
    container.addEventListener('dragend', (e) => this.handleDragEnd(e), false);
    container.addEventListener('dragover', (e) => this.handleDragOver(e), false);
    container.addEventListener('drop', (e) => this.handleDrop(e), false);
    container.addEventListener('dragenter', (e) => this.handleDragEnter(e), false);
    container.addEventListener('dragleave', (e) => this.handleDragLeave(e), false);

    // Make all task items draggable
    this.updateDraggableItems(container);
  }

  /**
   * Update draggable attribute on all task items
   * @param {HTMLElement} container - The task list container
   */
  updateDraggableItems(container) {
    const taskItems = container.querySelectorAll('.task-item');
    taskItems.forEach((item) => {
      item.setAttribute('draggable', 'true');
      item.classList.add('draggable-task');
    });
  }

  /**
   * Handle drag start event
   * @param {DragEvent} e
   */
  handleDragStart(e) {
    const taskItem = e.target.closest('.task-item');
    if (!taskItem) return;

    this.draggedElement = taskItem;
    this.draggedTaskId = this.getTaskId(taskItem);

    // Set drag image
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', taskItem.innerHTML);

    // Add dragging class with a slight delay for smooth animation
    setTimeout(() => {
      taskItem.classList.add('dragging');
    }, 0);

    // Create placeholder
    this.createPlaceholder(taskItem);
  }

  /**
   * Handle drag end event
   * @param {DragEvent} e
   */
  handleDragEnd(e) {
    const taskItem = e.target.closest('.task-item');
    if (!taskItem) return;

    taskItem.classList.remove('dragging');
    this.removePlaceholder();

    // Remove drag-over class from all items
    document.querySelectorAll('.task-item').forEach((item) => {
      item.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
    });

    this.draggedElement = null;
    this.draggedTaskId = null;
  }

  /**
   * Handle drag over event
   * @param {DragEvent} e
   */
  handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault(); // Allows drop
    }

    e.dataTransfer.dropEffect = 'move';

    const taskItem = e.target.closest('.task-item');
    if (!taskItem || taskItem === this.draggedElement) return;

    // Determine if we should insert before or after
    const rect = taskItem.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const insertBefore = e.clientY < midpoint;

    // Update visual feedback
    this.updateDropIndicator(taskItem, insertBefore);

    return false;
  }

  /**
   * Handle drop event
   * @param {DragEvent} e
   */
  handleDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation(); // Stops some browsers from redirecting
    }

    const targetItem = e.target.closest('.task-item');
    if (!targetItem || targetItem === this.draggedElement) return;

    // Determine drop position
    const rect = targetItem.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const insertBefore = e.clientY < midpoint;

    // Perform the reorder
    this.reorderTasks(this.draggedElement, targetItem, insertBefore);

    return false;
  }

  /**
   * Handle drag enter event
   * @param {DragEvent} e
   */
  handleDragEnter(e) {
    const taskItem = e.target.closest('.task-item');
    if (!taskItem || taskItem === this.draggedElement) return;

    taskItem.classList.add('drag-over');
  }

  /**
   * Handle drag leave event
   * @param {DragEvent} e
   */
  handleDragLeave(e) {
    const taskItem = e.target.closest('.task-item');
    if (!taskItem) return;

    // Only remove if we're actually leaving the element
    const rect = taskItem.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX >= rect.right ||
      e.clientY < rect.top ||
      e.clientY >= rect.bottom
    ) {
      taskItem.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
    }
  }

  /**
   * Create a placeholder element
   * @param {HTMLElement} sourceElement
   */
  createPlaceholder(sourceElement) {
    this.placeholder = document.createElement('li');
    this.placeholder.className = 'task-item task-placeholder';
    this.placeholder.style.height = `${sourceElement.offsetHeight}px`;
    sourceElement.parentNode.insertBefore(this.placeholder, sourceElement.nextSibling);
  }

  /**
   * Remove the placeholder element
   */
  removePlaceholder() {
    if (this.placeholder && this.placeholder.parentNode) {
      this.placeholder.parentNode.removeChild(this.placeholder);
    }
    this.placeholder = null;
  }

  /**
   * Update drop indicator visual feedback
   * @param {HTMLElement} targetItem
   * @param {boolean} insertBefore
   */
  updateDropIndicator(targetItem, insertBefore) {
    // Clear previous indicators
    document.querySelectorAll('.task-item').forEach((item) => {
      item.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    // Add indicator to target
    if (insertBefore) {
      targetItem.classList.add('drag-over-top');
    } else {
      targetItem.classList.add('drag-over-bottom');
    }
  }

  /**
   * Reorder tasks in the DOM and trigger callback
   * @param {HTMLElement} draggedItem
   * @param {HTMLElement} targetItem
   * @param {boolean} insertBefore
   */
  reorderTasks(draggedItem, targetItem, insertBefore) {
    const list = draggedItem.parentNode;

    // Get old index
    const allItems = Array.from(list.querySelectorAll('.task-item:not(.task-placeholder)'));
    const oldIndex = allItems.indexOf(draggedItem);

    // Perform DOM reorder
    if (insertBefore) {
      list.insertBefore(draggedItem, targetItem);
    } else {
      list.insertBefore(draggedItem, targetItem.nextSibling);
    }

    // Get new index
    const newItems = Array.from(list.querySelectorAll('.task-item:not(.task-placeholder)'));
    const newIndex = newItems.indexOf(draggedItem);

    // Trigger callback
    if (this.onReorderCallback && oldIndex !== newIndex) {
      this.onReorderCallback({
        taskId: this.draggedTaskId,
        oldIndex,
        newIndex,
        allTaskIds: newItems.map(item => this.getTaskId(item))
      });
    }

    // Animate the reorder
    this.animateReorder(draggedItem);
  }

  /**
   * Animate task after reordering
   * @param {HTMLElement} element
   */
  animateReorder(element) {
    element.classList.add('task-reordered');
    setTimeout(() => {
      element.classList.remove('task-reordered');
    }, 300);
  }

  /**
   * Get task ID from task item element
   * @param {HTMLElement} taskItem
   * @returns {string|null}
   */
  getTaskId(taskItem) {
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
   * Refresh drag & drop after DOM updates
   * @param {string} containerSelector
   */
  refresh(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (container) {
      this.updateDraggableItems(container);
    }
  }

  /**
   * Destroy drag & drop listeners
   */
  destroy() {
    this.draggedElement = null;
    this.draggedTaskId = null;
    this.dropZone = null;
    this.removePlaceholder();
  }
}

// Export singleton instance
export const taskDragDrop = new TaskDragDrop();
export default TaskDragDrop;
