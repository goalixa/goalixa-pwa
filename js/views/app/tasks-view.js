import { appApi } from '../../api.js';
import { showToast } from '../../utils.js';

let tasksViewCleanup = null;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDurationClock(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds || 0)));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function normalizeTaskCollections(payload) {
  return {
    tasks: Array.isArray(payload?.tasks) ? payload.tasks : [],
    doneTodayTasks: Array.isArray(payload?.done_today_tasks) ? payload.done_today_tasks : [],
    completedTasks: Array.isArray(payload?.completed_tasks) ? payload.completed_tasks : []
  };
}

function formatTaskPriorityLabel(priority) {
  const value = String(priority || 'medium').toLowerCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function taskPriorityRank(priority) {
  const value = String(priority || 'medium').toLowerCase();
  if (value === 'high') return 3;
  if (value === 'low') return 1;
  return 2;
}

function sortTasksByMode(tasks, mode) {
  const safe = Array.isArray(tasks) ? tasks.slice() : [];
  return safe.sort((left, right) => {
    if (mode === 'priority-desc') {
      return taskPriorityRank(right.priority) - taskPriorityRank(left.priority);
    }
    if (mode === 'priority-asc') {
      return taskPriorityRank(left.priority) - taskPriorityRank(right.priority);
    }
    if (mode === 'name-asc') {
      return String(left.name || '').localeCompare(String(right.name || ''));
    }
    if (mode === 'name-desc') {
      return String(right.name || '').localeCompare(String(left.name || ''));
    }
    if (mode === 'oldest') {
      return Number(left.id || 0) - Number(right.id || 0);
    }
    return Number(right.id || 0) - Number(left.id || 0);
  });
}

function normalizeTaskLabels(labels) {
  if (!Array.isArray(labels)) return [];
  return labels
    .map((label) => {
      if (typeof label === 'string') {
        return { name: label, color: '#64748b' };
      }
      return {
        name: label?.name || label?.label || '',
        color: label?.color || '#64748b'
      };
    })
    .filter((label) => label.name);
}

function taskTooltip(task, labels) {
  const details = [
    task.name || 'Task',
    task.project_name || 'Unassigned',
    task.goal_name || 'No goal'
  ];
  if (labels.length) {
    details.push(labels.map((label) => label.name).join(', '));
  }
  return details.join(' - ');
}

function taskLabelsMarkup(labels) {
  if (!labels.length) {
    return '<span class="meta-pill meta-label-empty"><i class="bi bi-tag"></i>No labels</span>';
  }
  return `
    <div class="task-labels" aria-label="Labels">
      ${labels.map((label) => `<span class="meta-pill meta-label"><i class="bi bi-tag"></i>${escapeHtml(label.name)}</span>`).join('')}
    </div>
  `;
}

function taskActionsMarkup(task, group) {
  const taskId = Number(task.id);
  if (group === 'completed') {
    return `
      <button class="btn btn-outline-secondary btn-sm menu-item" type="button" data-task-action="reopen" data-task-id="${taskId}">
        <i class="bi bi-arrow-counterclockwise"></i>
        Reopen
      </button>
      <button class="btn btn-outline-danger btn-sm menu-item danger" type="button" data-task-action="delete" data-task-id="${taskId}">
        <i class="bi bi-trash"></i>
        Delete task
      </button>
    `;
  }

  const startStopAction = task.is_running ? 'stop' : 'start';
  const startStopIcon = task.is_running ? 'pause-fill' : 'play-fill';
  const startStopClass = task.is_running ? 'btn-outline-warning' : 'btn-outline-primary';
  const dailyCheckAction = group === 'active'
    ? `
      <button class="btn btn-outline-success btn-sm menu-item" type="button" aria-label="Done today" data-task-action="daily-check" data-task-id="${taskId}">
        <i class="bi bi-check2-circle"></i>
      </button>
    `
    : '';

  return `
    ${dailyCheckAction}
    <button class="btn ${startStopClass} btn-sm menu-item" type="button" data-task-action="${startStopAction}" data-task-id="${taskId}">
      <i class="bi bi-${startStopIcon}"></i>
    </button>
    <button class="btn btn-outline-success btn-sm menu-item complete-btn" type="button" aria-label="Complete" title="Complete task" data-task-action="complete" data-task-id="${taskId}">
      <i class="bi bi-check-lg"></i>
    </button>
    <button class="btn btn-outline-danger btn-sm menu-item danger" type="button" aria-label="Delete task" data-task-action="delete" data-task-id="${taskId}">
      <i class="bi bi-trash"></i>
    </button>
  `;
}

function taskItemMarkup(task, group) {
  const labels = normalizeTaskLabels(task.labels);
  const priority = String(task.priority || 'medium').toLowerCase();
  const doneCount = Number(task.daily_checks || 0);
  const taskTime = group === 'completed'
    ? formatDurationClock(task.total_seconds || 0)
    : formatDurationClock(task.today_seconds || 0);

  return `
    <li class="task-item${group === 'done' ? ' is-done-today' : ''}${group === 'completed' ? ' is-completed' : ''}" data-priority="${priority}">
      <div class="task-content">
        <div class="task-header">
          <div class="task-title-row">
            <span class="task-title" title="${escapeHtml(taskTooltip(task, labels))}">${escapeHtml(task.name || '')}</span>
            <span class="priority-badge priority-${priority}">${formatTaskPriorityLabel(priority)}</span>
          </div>
          <span class="task-time"${group === 'completed' ? '' : ` data-task-id="${Number(task.id)}"`}>${taskTime}</span>
        </div>
        <div class="task-meta-row">
          <span class="meta-pill meta-goal"><i class="bi bi-bullseye"></i>${escapeHtml(task.goal_name || 'No goal')}</span>
          <span class="meta-pill meta-project"><i class="bi bi-folder2-open"></i>${escapeHtml(task.project_name || 'Unassigned')}</span>
          <span class="task-done-count" title="Times marked done"><i class="bi bi-check2-circle"></i>${doneCount}</span>
          ${taskLabelsMarkup(labels)}
        </div>
      </div>
      <div class="task-actions">
        ${taskActionsMarkup(task, group)}
      </div>
    </li>
  `;
}

function taskColumnMarkup(title, tasks, group) {
  if (!tasks.length) {
    if (group === 'done') {
      return `<h3>${title}</h3><p class="empty">No tasks done today.</p>`;
    }
    if (group === 'completed') {
      return '<p class="empty">No completed tasks yet.</p>';
    }
    return `<h3>${title}</h3><p class="empty">No tasks yet.</p>`;
  }
  const items = tasks.map((task) => taskItemMarkup(task, group)).join('');
  if (group === 'completed') {
    return `<ul class="task-list task-board-list">${items}</ul>`;
  }
  return `<h3>${title}</h3><ul class="task-list task-board-list">${items}</ul>`;
}

export function renderTasksSection(content, payload, projects, goals, labelsPayload) {
  const projectOptions = Array.isArray(projects?.projects) ? projects.projects : [];
  const goalOptions = Array.isArray(goals?.goals) ? goals.goals : [];
  const labels = Array.isArray(labelsPayload?.labels) ? labelsPayload.labels : [];
  const tasks = normalizeTaskCollections(payload);

  content.innerHTML = `
    <div class="tasks-page">
      <section class="app-panel tasks-create-card">
        <form class="task-form" id="task-form-pwa">
          <input type="text" id="task-name" name="name" placeholder="Task name" required />
          <select id="task-project" name="project_id" ${projectOptions.length ? 'required' : 'disabled'}>
            <option value="" disabled ${projectOptions.length ? '' : 'selected'}>Select project</option>
            ${projectOptions.map((project, index) => `<option value="${project.id}" ${index === 0 ? 'selected' : ''}>${escapeHtml(project.name)}</option>`).join('')}
          </select>
          <select id="task-goal" name="goal_id">
            <option value="" selected>Select goal (optional)</option>
            ${goalOptions.map((goal) => `<option value="${goal.id}">${escapeHtml(goal.name)}</option>`).join('')}
          </select>
          <select id="task-priority" name="priority">
            <option value="low">Low Priority</option>
            <option value="medium" selected>Medium Priority</option>
            <option value="high">High Priority</option>
          </select>

          <div class="label-picker-wrap">
            <button class="btn btn-light btn-sm label-toggle icon-button" id="create-label-toggle" type="button" aria-label="Labels">
              <i class="bi bi-tags"></i>
            </button>
            <div class="label-picker" id="create-label-picker">
              <div class="label-picker-header">
                <span class="label-picker-title">Task tags</span>
                <span class="label-picker-hint">Pick any</span>
              </div>
              <div class="label-options">
                ${labels.length
                  ? labels.map((label) => `
                    <label class="label-option" for="create-task-label-${label.id}">
                      <input id="create-task-label-${label.id}" type="checkbox" name="label_ids" value="${label.id}" />
                      <span class="label-pill">
                        <span class="label-swatch" style="background-color: ${escapeHtml(label.color || '#64748b')}"></span>
                        <span class="label-name">${escapeHtml(label.name || '')}</span>
                      </span>
                    </label>
                  `).join('')
                  : '<p class="label-empty">No tags yet.</p>'}
              </div>
            </div>
          </div>

          <button class="btn btn-primary btn-sm" type="submit">
            <i class="bi bi-plus-lg"></i>
            Add
          </button>
        </form>
      </section>

      <section class="app-panel tasks-board-card">
        <div class="section-header">
          <h2>Tasks</h2>
          <div class="task-controls">
            <select id="task-sort" data-task-sort>
              <option value="priority-desc">Priority (High to Low)</option>
              <option value="priority-asc">Priority (Low to High)</option>
              <option value="newest" selected>Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
            </select>
          </div>
        </div>
        <div class="task-columns">
          <div id="task-list" class="task-column">${taskColumnMarkup('In progress', tasks.tasks, 'active')}</div>
          <div id="done-today-list" class="task-column">${taskColumnMarkup('Done today', tasks.doneTodayTasks, 'done')}</div>
        </div>
      </section>

      <section class="app-panel tasks-completed-card">
        <h2>Completed</h2>
        <div id="completed-task-list">
          ${taskColumnMarkup('Completed', tasks.completedTasks, 'completed')}
        </div>
      </section>
    </div>
  `;
}

export function clearTasksView() {
  if (typeof tasksViewCleanup === 'function') {
    tasksViewCleanup();
    tasksViewCleanup = null;
  }
}

export async function bindTasksSection(container, initialPayload = {}) {
  clearTasksView();

  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  const root = content.querySelector('.tasks-page');
  if (!root) return;

  const abortController = new AbortController();
  const { signal } = abortController;
  let liveTimerId = null;

  const stopLiveTimer = () => {
    if (liveTimerId) {
      clearInterval(liveTimerId);
      liveTimerId = null;
    }
  };

  tasksViewCleanup = () => {
    stopLiveTimer();
    abortController.abort();
  };

  let tasksPayload = normalizeTaskCollections(initialPayload);
  let currentSort = 'newest';
  let taskTimeState = new Map();

  const taskListContainer = content.querySelector('#task-list');
  const doneTodayContainer = content.querySelector('#done-today-list');
  const completedContainer = content.querySelector('#completed-task-list');
  const taskSort = content.querySelector('#task-sort');

  const refreshTaskTimeState = (tasks) => {
    taskTimeState = new Map(
      tasks.map((task) => [
        String(task.id),
        {
          todaySeconds: Number(task.today_seconds || 0),
          isRunning: Boolean(task.is_running)
        }
      ])
    );
  };

  const updateTaskTimeDisplay = (taskId, seconds) => {
    const el = content.querySelector(`.task-time[data-task-id="${taskId}"]`);
    if (el) {
      el.textContent = formatDurationClock(seconds);
    }
  };

  const paintTaskBoards = () => {
    const sortedActive = sortTasksByMode(tasksPayload.tasks, currentSort);
    const sortedDoneToday = sortTasksByMode(tasksPayload.doneTodayTasks, currentSort);
    const sortedCompleted = sortTasksByMode(tasksPayload.completedTasks, currentSort);

    if (taskListContainer) {
      taskListContainer.innerHTML = taskColumnMarkup('In progress', sortedActive, 'active');
    }
    if (doneTodayContainer) {
      doneTodayContainer.innerHTML = taskColumnMarkup('Done today', sortedDoneToday, 'done');
    }
    if (completedContainer) {
      completedContainer.innerHTML = taskColumnMarkup('Completed', sortedCompleted, 'completed');
    }

    refreshTaskTimeState(sortedActive.concat(sortedDoneToday));
  };

  paintTaskBoards();

  liveTimerId = setInterval(() => {
    for (const [taskId, state] of taskTimeState.entries()) {
      if (!state.isRunning) continue;
      state.todaySeconds = Math.min(86400, state.todaySeconds + 1);
      updateTaskTimeDisplay(taskId, state.todaySeconds);
    }
  }, 1000);

  if (taskSort) {
    taskSort.addEventListener('change', () => {
      currentSort = taskSort.value || 'newest';
      paintTaskBoards();
    }, { signal });
  }

  const createLabelToggle = content.querySelector('#create-label-toggle');
  const createLabelPicker = content.querySelector('#create-label-picker');
  if (createLabelToggle && createLabelPicker) {
    createLabelToggle.addEventListener('click', () => {
      createLabelPicker.classList.toggle('is-open');
    }, { signal });

    createLabelPicker.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.matches('input[type="checkbox"]')) {
        setTimeout(() => {
          createLabelPicker.classList.remove('is-open');
        }, 150);
      }
    }, { signal });

    document.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;
      if (!target.closest('.label-picker-wrap')) {
        createLabelPicker.classList.remove('is-open');
      }
    }, { signal });
  }

  const createForm = content.querySelector('#task-form-pwa');
  if (createForm) {
    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const nameInput = content.querySelector('#task-name');
      const projectInput = content.querySelector('#task-project');
      const goalInput = content.querySelector('#task-goal');
      const priorityInput = content.querySelector('#task-priority');
      const name = (nameInput?.value || '').trim();
      const projectId = projectInput?.value || '';
      const goalId = goalInput?.value || '';
      const priority = priorityInput?.value || 'medium';
      const labelIds = Array.from(createForm.querySelectorAll('input[name="label_ids"]:checked'))
        .map((input) => input.value)
        .filter(Boolean);

      if (!name) return;
      if (!projectId) {
        showToast('Select a project first', 'warning');
        return;
      }

      try {
        const response = await appApi.createTask({
          name,
          project_id: projectId,
          label_ids: labelIds,
          goal_id: goalId || null,
          priority
        });
        tasksPayload = normalizeTaskCollections(response);
        paintTaskBoards();
        if (nameInput) {
          nameInput.value = '';
          nameInput.focus();
        }
        if (goalInput) goalInput.value = '';
        if (priorityInput) priorityInput.value = 'medium';
        createForm.querySelectorAll('input[name="label_ids"]:checked').forEach((input) => {
          input.checked = false;
        });
        if (createLabelPicker) createLabelPicker.classList.remove('is-open');
        showToast('Task created', 'success');
      } catch (error) {
        showToast(error.message || 'Failed to create task', 'error');
      }
    }, { signal });
  }

  content.addEventListener('click', async (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;
    const actionButton = target.closest('button[data-task-action][data-task-id]');
    if (!actionButton) return;

    const action = actionButton.dataset.taskAction;
    const taskId = actionButton.dataset.taskId;
    if (!action || !taskId) return;

    if (action === 'delete' && !window.confirm('Delete this task?')) {
      return;
    }

    actionButton.disabled = true;
    try {
      let response;
      if (action === 'start') response = await appApi.startTask(taskId);
      if (action === 'stop') response = await appApi.stopTask(taskId);
      if (action === 'daily-check') response = await appApi.setTaskDailyCheck(taskId);
      if (action === 'complete') response = await appApi.completeTask(taskId);
      if (action === 'reopen') response = await appApi.reopenTask(taskId);
      if (action === 'delete') response = await appApi.deleteTask(taskId);
      if (response) {
        tasksPayload = normalizeTaskCollections(response);
        paintTaskBoards();
      }
      showToast('Task updated', 'success');
    } catch (error) {
      showToast(error.message || 'Failed to update task', 'error');
    } finally {
      actionButton.disabled = false;
    }
  }, { signal });
}
