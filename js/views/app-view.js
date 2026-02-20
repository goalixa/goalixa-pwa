/**
 * App View Module
 * Native PWA UI for all main app sections.
 */

import { appApi } from '../api.js';
import { getCurrentUser, logout } from '../auth.js';
import { showToast } from '../utils.js';
import { navigate } from '../router.js';

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview', icon: 'fa-chart-line' },
  { key: 'tasks', label: 'Tasks', icon: 'fa-list-check' },
  { key: 'projects', label: 'Projects', icon: 'fa-folder-tree' },
  { key: 'reports', label: 'Reports', icon: 'fa-chart-pie' },
  { key: 'timer', label: 'Timer', icon: 'fa-stopwatch' },
  { key: 'calendar', label: 'Calendar', icon: 'fa-calendar-days' },
  { key: 'goals', label: 'Goals', icon: 'fa-bullseye' },
  { key: 'long-term-goals', label: 'Long-term Goals', icon: 'fa-flag-checkered' },
  { key: 'weekly-goals', label: 'Weekly Goals', icon: 'fa-calendar-week' },
  { key: 'habits', label: 'Habits', icon: 'fa-repeat' },
  { key: 'planner', label: 'Planner', icon: 'fa-compass' },
  { key: 'reminders', label: 'Reminders', icon: 'fa-bell' },
  { key: 'labels', label: 'Labels', icon: 'fa-tags' },
  { key: 'account', label: 'Account', icon: 'fa-user-gear' }
];

let timerViewCleanup = null;
let tasksViewCleanup = null;

function resolveSection(path) {
  const subPath = path.replace('/app', '') || '/overview';
  const trimmed = subPath.startsWith('/') ? subPath.slice(1) : subPath;
  if (!trimmed) {
    return { section: 'overview', subPath: '/overview' };
  }
  const key = trimmed.split('/')[0];
  return { section: key, subPath: `/${trimmed}` };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDuration(seconds) {
  const total = Number(seconds || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0) {
    return `${m}m`;
  }
  return `${h}h ${m}m`;
}

function formatDurationClock(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds || 0)));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatDurationHm(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds || 0)));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatPomodoroClock(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds || 0)));
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

function formatDateTime(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
}

function badgeForGoalStatus(status) {
  const value = (status || 'active').toLowerCase();
  if (value === 'completed' || value === 'archived') return 'success';
  if (value === 'at_risk') return 'warning';
  return 'neutral';
}

function getNavMarkup(activeSection) {
  return NAV_ITEMS.map((item) => {
    const active = item.key === activeSection ? 'active' : '';
    return `
      <button class="app-nav-btn ${active}" data-route="/app/${item.key}" type="button">
        <i class="fas ${item.icon}"></i>
        <span>${item.label}</span>
      </button>
    `;
  }).join('');
}

function renderShell(container, section) {
  const user = getCurrentUser();
  const email = user && user.email ? user.email : 'Guest';

  container.innerHTML = `
    <div class="app-shell">
      <header class="app-shell-header">
        <div class="app-brand">
          <i class="fas fa-bullseye"></i>
          <div>
            <h2>Goalixa PWA</h2>
            <p>Unified frontend workspace</p>
          </div>
        </div>
        <div class="app-user-actions">
          <span class="app-user-email">${escapeHtml(email)}</span>
          <button class="btn btn-primary" data-action="logout" type="button">Logout</button>
        </div>
      </header>

      <div class="app-shell-main">
        <aside class="app-shell-nav">
          ${getNavMarkup(section)}
        </aside>
        <section class="app-shell-content" id="app-shell-content"></section>
      </div>
    </div>
  `;

  container.querySelectorAll('.app-nav-btn').forEach((button) => {
    button.addEventListener('click', () => {
      navigate(button.dataset.route);
    });
  });

  const logoutButton = container.querySelector('[data-action="logout"]');
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      await logout();
      navigate('/login');
    });
  }

}

function renderLoading(content, label) {
  content.innerHTML = `
    <div class="app-panel loading">
      <i class="fas fa-spinner fa-spin"></i>
      <p>Loading ${escapeHtml(label)}...</p>
    </div>
  `;
}

function renderError(content, message) {
  content.innerHTML = `
    <div class="app-panel app-error-state">
      <i class="fas fa-triangle-exclamation"></i>
      <h3>Could not load data</h3>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function lastSevenDaysRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

function renderOverview(content, overview, tasksPayload, goalsPayload, reportsPayload, habitsPayload, range) {
  const recentTasks = Array.isArray(tasksPayload.tasks) ? tasksPayload.tasks.slice(0, 6) : [];
  const goals = Array.isArray(goalsPayload.goals) ? goalsPayload.goals : [];
  const activeGoals = Number(goalsPayload.active_goals_count || 0);
  const totalGoals = goals.length;
  const goalsInProgress = goals
    .filter((goal) => {
      const status = String(goal.status || '').toLowerCase();
      return status === 'active' || status === 'at_risk' || status === '';
    })
    .slice(0, 3);

  const summary = Array.isArray(reportsPayload.summary) ? reportsPayload.summary : [];
  const distribution = Array.isArray(reportsPayload.distribution) ? reportsPayload.distribution.slice(0, 5) : [];
  const habits = Array.isArray(habitsPayload.habits) ? habitsPayload.habits : [];
  const activeDays = summary.filter((item) => Number(item.seconds || 0) > 0).length;
  const averageDailySeconds = summary.length > 0
    ? Math.round(summary.reduce((acc, item) => acc + Number(item.seconds || 0), 0) / summary.length)
    : 0;

  content.innerHTML = `
    <div class="overview-page">
      <section class="app-panel overview-time-card">
        <div class="overview-card-header">
          <div>
            <h3>Time Summary</h3>
            <p class="overview-subtitle">Last 7 days of focus tracking.</p>
          </div>
          <span class="task-state running">${escapeHtml(range.start)} → ${escapeHtml(range.end)}</span>
        </div>

        <div class="overview-time-metrics">
          <div class="overview-metric">
            <span class="overview-metric-label">Total focus</span>
            <span class="overview-metric-value">${formatDuration(reportsPayload.total_seconds || overview.total_tracked_seconds || 0)}</span>
            <span class="overview-metric-meta">Past 7 days</span>
          </div>
          <div class="overview-metric">
            <span class="overview-metric-label">Today</span>
            <span class="overview-metric-value">${formatDuration(overview.total_tracked_seconds || 0)}</span>
            <span class="overview-metric-meta">${overview.done_today_count} tasks done today</span>
          </div>
          <div class="overview-metric">
            <span class="overview-metric-label">Active days</span>
            <span class="overview-metric-value">${activeDays}</span>
            <span class="overview-metric-meta">Avg ${formatDuration(averageDailySeconds)} per day</span>
          </div>
        </div>

        <div class="overview-grid">
          ${summary.length === 0 ? '<p class="muted">No activity yet.</p>' : ''}
          ${summary.map((item) => `
            <article class="overview-module">
              <div class="overview-module-header">
                <h3>${escapeHtml(item.label || '-')}</h3>
                <span class="overview-inline-meta">${formatDuration(item.seconds || 0)}</span>
              </div>
            </article>
          `).join('')}
        </div>
      </section>

      <section class="app-panel goals-card">
        <div class="goals-header">
          <div>
            <p class="goals-label">Goals</p>
            <h3 class="goals-title">Outcome-driven overview</h3>
          </div>
        </div>

        <div class="goals-summary">
          <div class="goal-stat-card">
            <span class="goal-stat-label">Active goals</span>
            <span class="goal-stat-value">${activeGoals}</span>
            <span class="goal-stat-meta">Total goals: ${totalGoals}</span>
          </div>
          <div class="goal-stat-card">
            <span class="goal-stat-label">Focus this week</span>
            <span class="goal-stat-value">${formatDuration(goalsPayload.total_goal_seconds || 0)}</span>
            <span class="goal-stat-meta">Across all goals</span>
          </div>
          <div class="goal-stat-card">
            <span class="goal-stat-label">Upcoming deadlines</span>
            <span class="goal-stat-value">${Number(goalsPayload.targets_set || 0)}</span>
            <span class="goal-stat-meta">Targets set</span>
          </div>
        </div>

        <div class="goal-grid-lite">
          ${goalsInProgress.length === 0 ? '<p class="muted">No active goals yet.</p>' : ''}
          ${goalsInProgress.map((goal) => `
            <article class="goal-lite-card">
              <header>
                <h5>${escapeHtml(goal.name)}</h5>
                <span class="goal-status-lite ${badgeForGoalStatus(goal.status || 'active')}">${escapeHtml(String(goal.status || 'active').replace('_', ' '))}</span>
              </header>
              <p>${escapeHtml(goal.description || 'No description')}</p>
              <div class="overview-goal-progress">
                <span style="width: ${Number(goal.progress || 0)}%;"></span>
              </div>
              <div class="goal-metrics-lite">
                <span>${Number(goal.progress || 0)}% complete</span>
                <span>${Number(goal.projects_count || 0)} projects</span>
                <span>${Number(goal.tasks_count || 0)} tasks</span>
              </div>
            </article>
          `).join('')}
        </div>
      </section>

      <section class="overview-charts">
        <article class="app-panel overview-chart-card">
          <div class="overview-card-header">
            <div>
              <p class="goals-label">Projects</p>
              <h3 class="goals-title">Focus by project</h3>
            </div>
          </div>
          <ul class="overview-list">
            ${distribution.length === 0 ? '<p class="muted">No tracked time yet.</p>' : ''}
            ${distribution.map((row, index) => `
              <li class="overview-list-item">
                <span class="overview-list-title">
                  <span class="overview-dot" style="--dot-color: hsl(${(index * 47) % 360}, 78%, 45%);"></span>
                  ${escapeHtml(row.name || row.project || row.label || '-')}
                </span>
                <span class="overview-list-meta">${formatDuration(row.total_seconds || row.seconds || 0)}</span>
              </li>
            `).join('')}
          </ul>
        </article>

        <article class="app-panel overview-chart-card">
          <div class="overview-card-header">
            <div>
              <p class="goals-label">Habits</p>
              <h3 class="goals-title">Completion momentum</h3>
            </div>
          </div>
          <div class="overview-time-metrics">
            <div class="overview-metric">
              <span class="overview-metric-label">Completed today</span>
              <span class="overview-metric-value">${Number(habitsPayload.completed_habits || 0)}</span>
              <span class="overview-metric-meta">Out of ${Number(habitsPayload.total_habits || 0)}</span>
            </div>
            <div class="overview-metric">
              <span class="overview-metric-label">Best streak</span>
              <span class="overview-metric-value">${Number(habitsPayload.best_streak || 0)}d</span>
              <span class="overview-metric-meta">Consistency peak</span>
            </div>
            <div class="overview-metric">
              <span class="overview-metric-label">Focus window</span>
              <span class="overview-metric-value">${escapeHtml(habitsPayload.focus_window || 'Anytime')}</span>
              <span class="overview-metric-meta">${habits.length} habits configured</span>
            </div>
          </div>
        </article>
      </section>

      <section class="app-panel">
        <div class="app-panel-header">
          <h3>Recent Active Tasks</h3>
          <p>Quick status of tasks currently in progress.</p>
        </div>
        <div class="task-list-block">
          ${recentTasks.length === 0 ? '<p class="muted">No active tasks yet.</p>' : ''}
          ${recentTasks.map((task) => `
            <article class="task-item compact">
              <div>
                <h5>${escapeHtml(task.name)}</h5>
                <p>${escapeHtml(task.project_name || 'No project')} • ${formatDuration(task.today_seconds)}</p>
              </div>
              <span class="task-state ${task.is_running ? 'running' : 'idle'}">${task.is_running ? 'Running' : 'Idle'}</span>
            </article>
          `).join('')}
        </div>
      </section>
    </div>
  `;
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
  return details.join(' · ');
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

function renderTasks(content, payload, projects, goals, labelsPayload) {
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

async function bindTaskActions(container, currentPath, initialPayload = {}) {
  if (typeof tasksViewCleanup === 'function') {
    tasksViewCleanup();
    tasksViewCleanup = null;
  }

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

function renderProjects(content, projects) {
  const projectList = Array.isArray(projects.projects) ? projects.projects : [];

  content.innerHTML = `
    <div class="app-panel">
      <div class="app-panel-header">
        <h3>Projects</h3>
        <p>Manage projects and connected tags.</p>
      </div>

      <form class="project-create-form" id="project-create-form">
        <input type="text" id="project-name" placeholder="Project name" required />
        <button class="btn btn-primary" type="submit">Create Project</button>
      </form>

      <div class="project-list">
        ${projectList.length === 0 ? '<p class="muted">No projects yet.</p>' : ''}
        ${projectList.map((project) => `
          <article class="project-item">
            <div>
              <h5>${escapeHtml(project.name)}</h5>
              <p>${Array.isArray(project.labels) ? project.labels.length : 0} labels</p>
            </div>
            <button class="danger" data-action="delete-project" data-project-id="${project.id}" type="button">Delete</button>
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

async function bindProjectActions(container, currentPath) {
  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  const form = content.querySelector('#project-create-form');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const nameInput = content.querySelector('#project-name');
      const name = nameInput.value.trim();
      if (!name) return;

      try {
        await appApi.createProject(name);
        showToast('Project created', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to create project', 'error');
      }
    });
  }

  content.querySelectorAll('[data-action="delete-project"]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await appApi.deleteProject(button.dataset.projectId);
        showToast('Project deleted', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to delete project', 'error');
      }
    });
  });
}

function renderReports(content, report, range) {
  const distribution = Array.isArray(report.distribution) ? report.distribution.slice(0, 8) : [];

  content.innerHTML = `
    <div class="app-panel">
      <div class="app-panel-header">
        <h3>Reports</h3>
        <p>Summary for ${escapeHtml(range.start)} to ${escapeHtml(range.end)}.</p>
      </div>

      <div class="stats-grid reports">
        <article class="stat-card"><h4>Total Time</h4><p>${formatDuration(report.total_seconds)}</p></article>
        <article class="stat-card"><h4>Avg Daily</h4><p>${Number(report.avg_daily_hours || 0).toFixed(2)}h</p></article>
        <article class="stat-card"><h4>Active Projects</h4><p>${Number(report.active_projects || 0)}</p></article>
      </div>

      <div class="report-table-wrap">
        <h4>Top Distribution</h4>
        ${distribution.length === 0 ? '<p class="muted">No report data for this period.</p>' : ''}
        <table class="report-table">
          <thead>
            <tr><th>Name</th><th>Seconds</th><th>Duration</th></tr>
          </thead>
          <tbody>
            ${distribution.map((row) => `
              <tr>
                <td>${escapeHtml(row.name || row.label || row.project || row.task || '-')}</td>
                <td>${Number(row.total_seconds || row.seconds || 0)}</td>
                <td>${formatDuration(row.total_seconds || row.seconds || 0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function normalizeTaskIdValue(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return '';
  }
  return String(parsed);
}

function renderTimerTaskEntries(entries) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  return safeEntries.map((entry) => `
    <div class="timer-task-entry">
      <span class="timer-task-entry-time">${escapeHtml(entry.start_time || '-')} - ${escapeHtml(entry.end_time || '-')}</span>
      <span class="timer-task-entry-duration">${formatDurationClock(entry.duration_seconds || 0)}</span>
    </div>
  `).join('');
}

function renderTimer(content, payload) {
  const groups = Array.isArray(payload.timer_list_groups) ? payload.timer_list_groups : [];
  const groupsReversed = groups.slice().reverse();
  const weekDays = Array.isArray(payload.week_days) ? payload.week_days : [];
  const taskRows = Array.isArray(payload.task_rows) ? payload.task_rows : [];
  const projects = Array.isArray(payload.projects) ? payload.projects : [];
  const labels = Array.isArray(payload.labels) ? payload.labels : [];
  const todayTotalSeconds = Number(payload.today_total_seconds || 0);
  const todayTargetSeconds = Number(payload.today_target_seconds || 0);
  const targetReached = todayTargetSeconds > 0 && todayTotalSeconds >= todayTargetSeconds;
  const progress = todayTargetSeconds > 0 ? Math.min(100, (todayTotalSeconds / todayTargetSeconds) * 100) : 0;

  content.innerHTML = `
    <div class="app-panel timer-page-panel">
      <div
        class="timer-page"
        data-today-total-seconds="${todayTotalSeconds}"
        data-today-target-seconds="${todayTargetSeconds}"
        data-today-date="${escapeHtml(payload.today_date || '')}"
      >
        <header class="timer-hero">
          <div class="timer-controls">
            <div class="timer-select">
              <label class="timer-input-label" for="task-picker">Current task</label>
              <div class="timer-input-group">
                <input
                  id="task-picker"
                  type="text"
                  placeholder="What are you working on?"
                  autocomplete="off"
                  aria-expanded="false"
                  aria-controls="task-dropdown"
                />
                <button class="timer-clear" id="task-clear" type="button" aria-label="Clear selected task" disabled>
                  <i class="bi bi-x"></i>
                </button>
              </div>
              <div class="timer-dropdown" id="task-dropdown">
                <div class="timer-bulk-controls">
                  <span class="timer-bulk-count" id="timer-bulk-count">0 selected</span>
                  <button class="btn btn-outline-secondary btn-xs" id="timer-bulk-clear" type="button" disabled>
                    Clear
                  </button>
                  <button class="btn btn-outline-primary btn-xs" id="timer-bulk-apply" type="button" disabled>
                    Apply
                  </button>
                </div>
                <div class="timer-list" id="timer-search-list">
                  <div class="timer-empty-state">Loading tasks...</div>
                </div>
              </div>
            </div>
            <div class="daily-target-inline">
              <label class="timer-input-label" for="focus-compact-time">Today's Target</label>
              <div class="focus-compact">
                <div class="focus-time" id="focus-compact-time">
                  <span class="focus-segment is-active" data-segment="hours">00</span>
                  <span class="focus-separator">:</span>
                  <span class="focus-segment" data-segment="minutes">00</span>
                </div>
                <div class="focus-compact-actions">
                  <button class="btn btn-outline-secondary btn-xs" type="button" id="focus-compact-minus" aria-label="Decrease target">-</button>
                  <button class="btn btn-outline-secondary btn-xs" type="button" id="focus-compact-plus" aria-label="Increase target">+</button>
                  <button class="btn btn-outline-primary btn-sm" type="button" id="daily-target-set" aria-label="Save target">
                    <i class="bi bi-check2"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section class="timer-range-section">
          <div class="timer-range-card">
            <div class="timer-range-left">
              <div class="calendar-row">
                <input
                  class="calendar-input"
                  id="timer-range"
                  type="text"
                  readonly
                  data-start="${escapeHtml(payload.timer_range_start || '')}"
                  data-end="${escapeHtml(payload.timer_range_end || '')}"
                />
              </div>
            </div>
            <div class="timer-range-summary">
              <div class="timer-summary-item">
                <span class="timer-summary-label">TODAY</span>
                <span class="timer-summary-value">${formatDurationClock(todayTotalSeconds)}</span>
              </div>
              <div class="timer-summary-item">
                <span class="timer-summary-label">WEEK TOTAL</span>
                <span class="timer-summary-value">${formatDurationClock(payload.week_total_seconds || 0)}</span>
              </div>
            </div>
            <div class="timer-range-right">
              <div class="timer-view-toggle" role="tablist" aria-label="View options">
                <button class="timer-view-tab" data-view-button="calendar" role="tab" aria-selected="false" title="Calendar view">
                  <i class="bi bi-calendar-week"></i>
                  <span class="view-label">Calendar</span>
                </button>
                <button class="timer-view-tab" data-view-button="list" role="tab" aria-selected="false" title="List view">
                  <i class="bi bi-list-task"></i>
                  <span class="view-label">List</span>
                </button>
                <button class="timer-view-tab is-active" data-view-button="timesheet" role="tab" aria-selected="true" title="Timesheet view">
                  <i class="bi bi-clock-history"></i>
                  <span class="view-label">Timesheet</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section class="timer-range-section">
          <div class="card pomodoro-card" data-tour-id="pomodoro">
            <div class="focus-progress" aria-live="polite">
              <div class="focus-progress-bar" aria-label="Daily focus progress">
                <div class="focus-progress-fill" style="width: ${progress}%;"></div>
              </div>
            </div>
            <div class="pomodoro-header">
              <div class="pomodoro-copy">
                <p class="pomodoro-label">Pomodoro</p>
                <h2 class="pomodoro-mode" id="pomodoro-mode">Focus</h2>
                <div class="pomodoro-status">
                  <p class="pomodoro-task" id="pomodoro-task">No task selected</p>
                  <p class="pomodoro-meta" id="pomodoro-meta" aria-live="polite">Session 1 of 4</p>
                </div>
                <div class="pomodoro-dots" aria-hidden="true">
                  <span data-session-dot="1"></span>
                  <span data-session-dot="2"></span>
                  <span data-session-dot="3"></span>
                  <span data-session-dot="4"></span>
                </div>
              </div>
              <div class="pomodoro-clock">
                <div class="pomodoro-ring">
                  <div class="pomodoro-dial" id="pomodoro-display" role="timer" aria-live="polite">25:00</div>
                  <span class="pomodoro-caption">Remaining</span>
                </div>
              </div>
            </div>
            <div class="pomodoro-controls">
              <button class="btn btn-primary btn-sm" type="button" id="pomodoro-toggle">
                <i class="bi bi-play-fill" id="pomodoro-toggle-icon"></i>
                <span id="pomodoro-toggle-text">Start</span>
              </button>
              <button class="btn btn-outline-secondary btn-sm" type="button" id="pomodoro-reset">
                <i class="bi bi-arrow-counterclockwise"></i>
                <span class="btn-text">Reset</span>
              </button>
              <button class="btn btn-outline-secondary btn-sm" type="button" id="pomodoro-skip">
                <i class="bi bi-skip-forward-fill"></i>
                <span class="btn-text">Skip</span>
              </button>
              <button class="btn btn-outline-success btn-sm" type="button" id="pomodoro-done">
                <i class="bi bi-check2-circle"></i>
                <span class="btn-text">Done today</span>
              </button>
            </div>
            <div class="pomodoro-presets">
              <button class="btn btn-light btn-sm" type="button" data-pomodoro-mode="work">Focus 25</button>
              <button class="btn btn-light btn-sm" type="button" data-pomodoro-mode="short">Break 5</button>
              <button class="btn btn-light btn-sm" type="button" data-pomodoro-mode="long">Break 15</button>
            </div>
          </div>
        </section>

        <section class="timer-range-section timer-task-create-section">
          <div class="card timer-task-create-card">
            <div class="timer-task-create-header">
              <div>
                <p class="timer-input-label">Quick add</p>
                <h3 class="timer-task-create-title">Add task</h3>
              </div>
            </div>
            <form class="task-form timer-quick-task-form" id="timer-quick-task-form">
              <input id="timer-quick-task-name" type="text" name="name" placeholder="Task name" required />
              <select id="timer-quick-task-project" name="project_id">
                <option value="" selected>No project</option>
                ${projects.map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join('')}
              </select>
              <select id="timer-quick-task-priority" name="priority">
                <option value="low">Low priority</option>
                <option value="medium" selected>Medium priority</option>
                <option value="high">High priority</option>
              </select>
              <select id="timer-quick-task-label" name="label_ids">
                <option value="" selected>Label (optional)</option>
                ${labels.map((label) => `<option value="${label.id}">${escapeHtml(label.name)}</option>`).join('')}
              </select>
              <button class="btn btn-primary btn-sm" type="submit">
                <i class="bi bi-plus-lg"></i>
                Add task
              </button>
            </form>
            <p class="timer-quick-task-feedback" id="timer-quick-task-feedback" role="status" aria-live="polite" hidden></p>
          </div>
        </section>

        <section class="timer-calendar-section timer-view-panel" data-view-panel="calendar">
          <div class="card timer-calendar-card">
            <div class="calendar-week-board">
              <div class="calendar-week-grid calendar-week-header-row">
                <div class="calendar-weekday calendar-task-header">Tasks</div>
                ${weekDays.map((day) => `
                  <div class="calendar-weekday${day.is_today ? ' is-today' : ''}">
                    <span class="calendar-weekday-name">${escapeHtml(day.day || '')}</span>
                    <span class="calendar-weekday-date">${escapeHtml(day.date || '')}</span>
                  </div>
                `).join('')}
              </div>
              ${taskRows.length ? `
                <div class="calendar-week-body">
                  ${taskRows.map((task) => `
                    <div class="calendar-week-grid calendar-week-row" data-task-id="${task.id}">
                      <div class="calendar-task-cell">
                        <span class="calendar-task-name">${escapeHtml(task.name || '')}</span>
                        <span class="calendar-task-meta">${escapeHtml(task.project_name || 'No project')}</span>
                      </div>
                      ${weekDays.map((day, index) => {
                        const checked = Array.isArray(task.week_checks) ? Boolean(task.week_checks[index]) : false;
                        const checkClass = checked ? ' is-checked' : (day.is_future ? '' : ' is-missed');
                        return `
                          <div class="calendar-day-cell${day.is_today ? ' is-today' : ''}">
                            <span class="calendar-check${checkClass}" title="${escapeHtml(day.full || '')}"></span>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  `).join('')}
                </div>
              ` : '<p class="empty">No tasks yet.</p>'}
            </div>
          </div>
        </section>

        <section class="timer-calendar-section timer-view-panel" data-view-panel="list">
          <div class="card timer-list-card">
            ${groupsReversed.length ? groupsReversed.map((group) => `
              <div class="timer-list-group">
                <div class="timer-list-header">
                  <span class="timer-list-day">${escapeHtml(group.label || '')}</span>
                  <span class="timer-list-total">${formatDurationClock(group.total_seconds || 0)}</span>
                </div>
                ${(Array.isArray(group.tasks) ? group.tasks : []).map((task) => `
                  <div class="timer-list-item timer-task-item" data-task-id="${task.task_id}">
                    <div class="timer-list-row timer-task-toggle" role="button" tabindex="0" aria-expanded="false" data-task-toggle>
                      <div class="timer-list-left">
                        ${Array.isArray(task.labels) && task.labels.length ? `<span class="timer-list-label">${escapeHtml(task.labels.join(', '))}</span>` : ''}
                      </div>
                      <div class="timer-list-center">
                        <span class="timer-list-title">${escapeHtml(task.task_name || '')}</span>
                        <span class="timer-list-project">${escapeHtml(task.project_name || 'No project')}</span>
                      </div>
                      <div class="timer-list-right">
                        <span class="timer-list-duration">${formatDurationClock(task.total_seconds || 0)}</span>
                        <span class="timer-list-time">${Array.isArray(task.entries) ? task.entries.length : 0} sessions</span>
                        <div class="timer-list-actions">
                          ${task.is_running
                            ? `
                              <button class="btn btn-outline-warning btn-sm timer-list-action pause" type="button" aria-label="Pause task timer" data-action="stop" data-task-id="${task.task_id}">
                                <i class="bi bi-pause-fill"></i>
                              </button>
                            `
                            : `
                              <button class="btn btn-outline-primary btn-sm timer-list-action resume" type="button" aria-label="Start task timer" data-action="start" data-task-id="${task.task_id}">
                                <i class="bi bi-play-fill"></i>
                              </button>
                            `}
                        </div>
                      </div>
                    </div>
                    <div class="timer-task-details">
                      ${renderTimerTaskEntries(task.entries)}
                    </div>
                  </div>
                `).join('')}
              </div>
            `).join('') : '<div class="timer-empty-state">No entries yet.</div>'}
          </div>
        </section>

        <section class="timer-calendar-section timer-view-panel is-active" data-view-panel="timesheet">
          <div class="card timer-timesheet-card">
            ${groupsReversed.length ? `
              <div class="timesheet-header">
                <div>
                  <h3 class="timesheet-title">Timesheet</h3>
                  <p class="timesheet-subtitle">Grouped by day for the selected range.</p>
                  ${todayTargetSeconds > 0 ? `
                    <div class="timesheet-target-banner ${targetReached ? 'is-success' : ''}">
                      <span class="timesheet-target-label">
                        <i class="bi ${targetReached ? 'bi-emoji-smile' : 'bi-flag'}"></i>
                        Today's target: ${formatDurationClock(todayTargetSeconds)}
                      </span>
                      <span class="timesheet-target-progress">
                        ${formatDurationClock(todayTotalSeconds)} / ${formatDurationClock(todayTargetSeconds)}
                      </span>
                      ${targetReached ? '<span class="timesheet-target-congrats">Great job! You hit today\'s focus goal.</span>' : ''}
                    </div>
                  ` : ''}
                </div>
              </div>
              <div class="timesheet-table">
                ${groupsReversed.map((group) => `
                  <div class="timesheet-row">
                    <div class="timesheet-day">
                      <div class="timesheet-day-label">${escapeHtml(group.label || '')}</div>
                      <div class="timesheet-day-total">${formatDurationClock(group.total_seconds || 0)}</div>
                    </div>
                    <div class="timesheet-entries">
                      ${(Array.isArray(group.tasks) && group.tasks.length) ? group.tasks.map((task) => `
                        <div class="timesheet-task${task.status === 'completed' ? ' is-completed' : ''}" data-task-id="${task.task_id}">
                          <div class="timesheet-task-summary" role="button" tabindex="0" aria-expanded="false" data-task-toggle>
                            <div>
                              <div class="timesheet-task-title">${escapeHtml(task.task_name || '')}</div>
                              <div class="timesheet-task-meta">${escapeHtml(task.project_name || 'No project')}</div>
                            </div>
                            <div class="timesheet-task-right">
                              <div class="timesheet-task-duration">${formatDurationClock(task.total_seconds || 0)}</div>
                              <div class="timesheet-task-actions">
                                ${task.status === 'completed'
                                  ? `
                                    <span class="timesheet-task-state is-completed">
                                      <i class="bi bi-emoji-smile"></i>
                                      Completed
                                    </span>
                                  `
                                  : `
                                    <button
                                      class="btn btn-outline-success btn-sm timesheet-complete-btn"
                                      type="button"
                                      aria-label="Complete task"
                                      data-action="complete"
                                      data-task-id="${task.task_id}"
                                    >
                                      <i class="bi bi-check-lg"></i>
                                      Complete
                                    </button>
                                  `}
                              </div>
                            </div>
                          </div>
                          <div class="timesheet-task-details">
                            ${renderTimerTaskEntries(task.entries)}
                          </div>
                        </div>
                      `).join('') : '<div class="timer-empty-state">No entries for this day.</div>'}
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : '<div class="timer-empty-state">No timesheet data yet.</div>'}
          </div>
        </section>
      </div>
    </div>
  `;
}

async function ensureLitepickerAssets() {
  if (typeof window === 'undefined') {
    return false;
  }

  if (window.Litepicker) {
    return true;
  }

  let stylesheet = document.querySelector('link[data-goalixa-litepicker="1"]');
  if (!stylesheet) {
    stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/vendor/litepicker/litepicker.css';
    stylesheet.dataset.goalixaLitepicker = '1';
    document.head.appendChild(stylesheet);
  }

  let script = document.querySelector('script[data-goalixa-litepicker="1"]');
  if (!script) {
    script = document.createElement('script');
    script.src = '/vendor/litepicker/litepicker.js';
    script.async = true;
    script.dataset.goalixaLitepicker = '1';
    document.head.appendChild(script);
  }

  if (!window.Litepicker) {
    await new Promise((resolve) => {
      const onReady = () => resolve();
      script.addEventListener('load', onReady, { once: true });
      script.addEventListener('error', onReady, { once: true });
      setTimeout(onReady, 2000);
    });
  }

  return Boolean(window.Litepicker);
}

async function bindTimerActions(container, currentPath) {
  if (typeof timerViewCleanup === 'function') {
    timerViewCleanup();
    timerViewCleanup = null;
  }

  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  const timerPage = content.querySelector('.timer-page');
  if (!timerPage) return;

  const abortController = new AbortController();
  const { signal } = abortController;
  let intervalId = null;
  let pickerInstance = null;

  const stopInterval = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  timerViewCleanup = () => {
    stopInterval();
    if (pickerInstance && typeof pickerInstance.destroy === 'function') {
      pickerInstance.destroy();
    }
    abortController.abort();
  };

  const rangeInput = content.querySelector('#timer-range');
  const viewTabs = content.querySelectorAll('.timer-view-tab');
  const panels = content.querySelectorAll('[data-view-panel]');
  const taskPicker = content.querySelector('#task-picker');
  const taskDropdown = content.querySelector('#task-dropdown');
  const taskList = content.querySelector('#timer-search-list');
  const taskClear = content.querySelector('#task-clear');
  const timerBulkCount = content.querySelector('#timer-bulk-count');
  const timerBulkClear = content.querySelector('#timer-bulk-clear');
  const timerBulkApply = content.querySelector('#timer-bulk-apply');
  const timerQuickTaskForm = content.querySelector('#timer-quick-task-form');
  const timerQuickTaskName = content.querySelector('#timer-quick-task-name');
  const timerQuickTaskProject = content.querySelector('#timer-quick-task-project');
  const timerQuickTaskPriority = content.querySelector('#timer-quick-task-priority');
  const timerQuickTaskLabel = content.querySelector('#timer-quick-task-label');
  const timerQuickTaskFeedback = content.querySelector('#timer-quick-task-feedback');
  const focusTimeLabel = content.querySelector('#focus-compact-time');
  const focusProgressFill = content.querySelector('.focus-progress-fill');

  let todayTotalSeconds = Number(timerPage.dataset.todayTotalSeconds || 0);
  let targetSeconds = Math.max(0, Number(timerPage.dataset.todayTargetSeconds || 0));

  const setQuickTaskFeedback = (message, state = '') => {
    if (!timerQuickTaskFeedback) return;
    timerQuickTaskFeedback.textContent = message || '';
    timerQuickTaskFeedback.hidden = !message;
    timerQuickTaskFeedback.classList.toggle('is-success', state === 'success');
    timerQuickTaskFeedback.classList.toggle('is-error', state === 'error');
  };

  const setProgressFill = () => {
    if (!focusProgressFill) return;
    if (!targetSeconds) {
      focusProgressFill.style.width = '0%';
      return;
    }
    const percent = Math.min(100, (todayTotalSeconds / targetSeconds) * 100);
    focusProgressFill.style.width = `${percent}%`;
  };

  const setTimeDisplay = () => {
    if (!focusTimeLabel) return;
    const h = Math.floor(targetSeconds / 3600);
    const m = Math.floor((targetSeconds % 3600) / 60);
    const hoursEl = focusTimeLabel.querySelector('.focus-segment[data-segment="hours"]');
    const minutesEl = focusTimeLabel.querySelector('.focus-segment[data-segment="minutes"]');
    if (hoursEl) hoursEl.textContent = String(h).padStart(2, '0');
    if (minutesEl) minutesEl.textContent = String(m).padStart(2, '0');
  };

  setTimeDisplay();
  setProgressFill();

  let activeSegment = 'hours';
  const hoursEl = content.querySelector('.focus-segment[data-segment="hours"]');
  const minutesEl = content.querySelector('.focus-segment[data-segment="minutes"]');

  const setActiveSegment = (segment) => {
    activeSegment = segment;
    if (hoursEl) hoursEl.classList.toggle('is-active', segment === 'hours');
    if (minutesEl) minutesEl.classList.toggle('is-active', segment === 'minutes');
  };

  const adjustTarget = (delta) => {
    const step = activeSegment === 'hours' ? 3600 : 60;
    targetSeconds = Math.max(0, targetSeconds + delta * step);
    setTimeDisplay();
    setProgressFill();
  };

  hoursEl?.addEventListener('click', () => setActiveSegment('hours'), { signal });
  minutesEl?.addEventListener('click', () => setActiveSegment('minutes'), { signal });
  content.querySelector('#focus-compact-minus')?.addEventListener('click', () => adjustTarget(-1), { signal });
  content.querySelector('#focus-compact-plus')?.addEventListener('click', () => adjustTarget(1), { signal });

  content.querySelector('#daily-target-set')?.addEventListener('click', async () => {
    if (!targetSeconds) return;
    try {
      const result = await appApi.setDailyTarget(targetSeconds);
      targetSeconds = Math.max(0, Number(result.today_target_seconds || targetSeconds));
      timerPage.dataset.todayTargetSeconds = String(targetSeconds);
      setTimeDisplay();
      setProgressFill();
      showToast('Daily target updated', 'success');
    } catch (error) {
      showToast(error.message || 'Failed to update daily target', 'error');
    }
  }, { signal });

  if (rangeInput) {
    const hasLitepicker = await ensureLitepickerAssets();
    const startValue = rangeInput.dataset.start || '';
    const endValue = rangeInput.dataset.end || '';

    if (hasLitepicker && window.Litepicker) {
      const today = new Date();
      const startDate = startValue ? new Date(`${startValue}T00:00:00`) : new Date(today);
      const endDate = endValue ? new Date(`${endValue}T00:00:00`) : new Date(today);
      if (!startValue) {
        startDate.setDate(today.getDate() - 6);
      }

      pickerInstance = new window.Litepicker({
        element: rangeInput,
        singleMode: false,
        startDate,
        endDate,
        showTooltip: false,
        numberOfMonths: 1,
        numberOfColumns: 1,
        format: 'YYYY-MM-DD'
      });

      rangeInput.value = `${pickerInstance.getStartDate().format('YYYY-MM-DD')} → ${pickerInstance.getEndDate().format('YYYY-MM-DD')}`;
      pickerInstance.on('selected', (date1, date2) => {
        if (!date1 || !date2) return;
        navigate('/app/timer', {
          start: date1.format('YYYY-MM-DD'),
          end: date2.format('YYYY-MM-DD')
        });
      });
    } else {
      const fallbackStart = startValue || new Date(Date.now() - (6 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
      const fallbackEnd = endValue || new Date().toISOString().slice(0, 10);
      rangeInput.value = `${fallbackStart} → ${fallbackEnd}`;
      rangeInput.addEventListener('click', () => {
        const nextStart = window.prompt('Start date (YYYY-MM-DD)', fallbackStart);
        if (!nextStart) return;
        const nextEnd = window.prompt('End date (YYYY-MM-DD)', fallbackEnd);
        if (!nextEnd) return;
        navigate('/app/timer', { start: nextStart, end: nextEnd });
      }, { signal });
    }
  }

  viewTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetView = tab.dataset.viewButton;
      viewTabs.forEach((item) => {
        item.classList.toggle('is-active', item === tab);
        item.setAttribute('aria-selected', item === tab ? 'true' : 'false');
      });
      panels.forEach((panel) => {
        panel.classList.toggle('is-active', panel.dataset.viewPanel === targetView);
      });
    }, { signal });
  });

  const toggleTaskDetails = (toggleElement) => {
    const item = toggleElement.closest('.timer-task-item, .timesheet-task');
    if (!item) return;
    const isOpen = item.classList.toggle('is-open');
    toggleElement.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };

  content.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;
    const toggle = target.closest('[data-task-toggle]');
    if (!toggle) return;
    if (target.closest('.timer-list-actions') || target.closest('.timesheet-task-actions')) {
      return;
    }
    toggleTaskDetails(toggle);
  }, { signal });

  content.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;
    const toggle = target.closest('[data-task-toggle]');
    if (!toggle) return;
    event.preventDefault();
    toggleTaskDetails(toggle);
  }, { signal });

  const baseTitle = document.title;
  const presets = {
    work: 25 * 60,
    short: 5 * 60,
    long: 15 * 60
  };
  const storageKey = 'pomodoroState';
  let cachedTasks = [];
  let selectedTaskIds = new Set();
  let audioContext = null;

  const defaultState = {
    mode: 'work',
    remaining: presets.work,
    isRunning: false,
    completedWork: 0,
    lastTick: null,
    taskId: null,
    taskIds: [],
    taskNames: [],
    taskRunning: false
  };

  const pomodoroDisplay = content.querySelector('#pomodoro-display');
  const pomodoroMode = content.querySelector('#pomodoro-mode');
  const pomodoroTask = content.querySelector('#pomodoro-task');
  const pomodoroMeta = content.querySelector('#pomodoro-meta');
  const pomodoroRing = content.querySelector('.pomodoro-ring');
  const pomodoroDots = content.querySelectorAll('[data-session-dot]');
  const toggleButton = content.querySelector('#pomodoro-toggle');
  const toggleIcon = content.querySelector('#pomodoro-toggle-icon');
  const toggleText = content.querySelector('#pomodoro-toggle-text');
  const resetButton = content.querySelector('#pomodoro-reset');
  const skipButton = content.querySelector('#pomodoro-skip');
  const doneButton = content.querySelector('#pomodoro-done');
  const presetButtons = content.querySelectorAll('[data-pomodoro-mode]');

  const modeLabel = (mode) => {
    if (mode === 'short') return 'Short Break';
    if (mode === 'long') return 'Long Break';
    return 'Focus';
  };

  const loadState = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return { ...defaultState };
      return { ...defaultState, ...JSON.parse(raw) };
    } catch (_error) {
      return { ...defaultState };
    }
  };

  const saveState = (state) => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  };

  const normalizeStateTaskIds = (state) => {
    const ids = Array.isArray(state.taskIds)
      ? state.taskIds
      : state.taskId
        ? [state.taskId]
        : [];
    const normalized = [];
    const seen = new Set();
    ids.forEach((id) => {
      const parsed = Number.parseInt(String(id), 10);
      if (!Number.isFinite(parsed) || parsed <= 0 || seen.has(parsed)) return;
      seen.add(parsed);
      normalized.push(parsed);
    });
    state.taskIds = normalized;
    state.taskId = normalized.length ? normalized[0] : null;
    if (!Array.isArray(state.taskNames)) {
      state.taskNames = [];
    }
  };

  const setStateTasks = (state, tasks) => {
    const safeTasks = (tasks || []).filter((task) => task && task.id);
    state.taskIds = safeTasks.map((task) => Number(task.id));
    state.taskNames = safeTasks.map((task) => task.name || `Task #${task.id}`);
    state.taskId = state.taskIds.length ? state.taskIds[0] : null;
    state.taskName = state.taskNames.length ? state.taskNames[0] : null;
  };

  const updatePageTitle = (state) => {
    if (!state.isRunning) {
      document.title = baseTitle;
      return;
    }
    normalizeStateTaskIds(state);
    const time = formatPomodoroClock(state.remaining);
    const mode = modeLabel(state.mode);
    const taskLabel = state.taskIds.length > 1
      ? ` - ${state.taskIds.length} tasks`
      : state.taskName
        ? ` - ${state.taskName}`
        : '';
    document.title = `${time} · ${mode}${taskLabel}`;
  };

  const updatePomodoroUI = (state) => {
    if (!pomodoroDisplay || !pomodoroMode || !pomodoroMeta) return;
    normalizeStateTaskIds(state);
    pomodoroDisplay.textContent = formatPomodoroClock(state.remaining);
    pomodoroMode.textContent = modeLabel(state.mode);
    pomodoroMeta.textContent = `Session ${(state.completedWork % 4) + 1} of 4`;

    if (pomodoroTask) {
      if (!state.taskIds.length) {
        pomodoroTask.textContent = 'No task selected';
      } else if (state.taskIds.length === 1) {
        pomodoroTask.textContent = state.taskName ? `Task: ${state.taskName}` : 'Task selected';
      } else {
        const preview = (state.taskNames || []).slice(0, 2).join(', ');
        const extra = state.taskNames.length > 2 ? ` +${state.taskNames.length - 2}` : '';
        pomodoroTask.textContent = preview
          ? `Working simultaneously: ${preview}${extra}`
          : `Working simultaneously on ${state.taskIds.length} tasks`;
      }
    }

    if (pomodoroDots.length) {
      const completed = state.completedWork % 4;
      pomodoroDots.forEach((dot, index) => {
        dot.classList.toggle('is-active', index < completed);
        dot.classList.toggle('is-current', index === completed);
      });
    }

    if (pomodoroRing) {
      const total = presets[state.mode] || 0;
      const progressValue = total > 0 ? Math.min(1, Math.max(0, state.remaining / total)) : 0;
      pomodoroRing.style.setProperty('--pomodoro-progress', `${progressValue * 360}deg`);
    }

    const requiresTask = state.mode === 'work' && !state.taskIds.length;
    if (toggleButton) {
      toggleButton.disabled = requiresTask;
      if (state.isRunning) {
        if (toggleIcon) toggleIcon.className = 'bi bi-pause-fill';
        if (toggleText) toggleText.textContent = 'Pause';
        toggleButton.classList.remove('btn-primary');
        toggleButton.classList.add('btn-outline-warning');
      } else {
        if (toggleIcon) toggleIcon.className = 'bi bi-play-fill';
        if (toggleText) toggleText.textContent = requiresTask ? 'Select task' : 'Start';
        toggleButton.classList.add('btn-primary');
        toggleButton.classList.remove('btn-outline-warning');
      }
    }

    if (doneButton) doneButton.disabled = !state.taskIds.length;
    if (taskClear) taskClear.disabled = !state.taskIds.length;
    updatePageTitle(state);
  };

  const getNextMode = (state) => {
    if (state.mode === 'work') {
      const nextWork = state.completedWork + 1;
      return nextWork % 4 === 0 ? 'long' : 'short';
    }
    return 'work';
  };

  const applyMode = (state, mode) => {
    const duration = presets[mode];
    return {
      ...state,
      mode,
      remaining: duration,
      isRunning: false,
      lastTick: null,
      taskRunning: false
    };
  };

  const ensureAudioContext = () => {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
      }
    }
    return audioContext;
  };

  const playChime = () => {
    const context = ensureAudioContext();
    if (!context) return;
    const now = context.currentTime;
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now + index * 0.18);
      gain.gain.linearRampToValueAtTime(0.2, now + index * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.18 + 0.16);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + index * 0.18);
      oscillator.stop(now + index * 0.18 + 0.2);
    });
  };

  const notifyPomodoro = (completedMode) => {
    if (completedMode === 'work') {
      showToast('Focus complete. Time for a break.', 'success');
    } else {
      showToast('Break complete. Time to focus.', 'info');
    }
    playChime();
  };

  const applyElapsed = (state, elapsedSeconds) => {
    const startingRemaining = state.remaining;
    let remaining = state.remaining;
    let mode = state.mode;
    let completedWork = state.completedWork;
    let secondsLeft = elapsedSeconds;

    while (secondsLeft > 0) {
      if (remaining > secondsLeft) {
        remaining -= secondsLeft;
        secondsLeft = 0;
      } else {
        secondsLeft -= remaining;
        if (mode === 'work') {
          completedWork += 1;
        }
        notifyPomodoro(mode);
        mode = mode === 'work' ? (completedWork % 4 === 0 ? 'long' : 'short') : 'work';
        remaining = presets[mode];
      }
    }

    state.remaining = remaining;
    state.mode = mode;
    state.completedWork = completedWork;
    if (elapsedSeconds >= startingRemaining) {
      state.isRunning = false;
      state.lastTick = null;
      state.taskRunning = false;
    }
  };

  const startTaskTimer = async (state) => {
    normalizeStateTaskIds(state);
    if (!state.taskIds.length || state.taskRunning) return;
    state.taskRunning = true;
    saveState(state);
    try {
      await appApi.bulkTaskAction(state.taskIds, 'start');
    } catch (error) {
      state.taskRunning = false;
      saveState(state);
      console.error(error);
    }
  };

  const stopTaskTimer = async (state) => {
    normalizeStateTaskIds(state);
    if (!state.taskIds.length || !state.taskRunning) return;
    state.taskRunning = false;
    saveState(state);
    try {
      await appApi.bulkTaskAction(state.taskIds, 'stop');
    } catch (error) {
      console.error(error);
    }
  };

  const startInterval = (state) => {
    stopInterval();
    state.lastTick = Date.now();
    intervalId = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.max(1, Math.floor((now - (state.lastTick || now)) / 1000));
      state.lastTick = now;
      state.remaining -= elapsed;

      if (state.remaining <= 0) {
        if (state.mode === 'work') {
          stopTaskTimer(state);
        }
        notifyPomodoro(state.mode);
        state.remaining = 0;
        state.isRunning = false;
        if (state.mode === 'work') {
          state.completedWork += 1;
        }
        const nextMode = getNextMode(state);
        const nextState = applyMode(state, nextMode);
        state.mode = nextState.mode;
        state.remaining = nextState.remaining;
        state.lastTick = null;
        stopInterval();

        if (nextMode !== 'work') {
          state.isRunning = true;
          state.lastTick = Date.now();
          startInterval(state);
        }
      }

      saveState(state);
      updatePomodoroUI(state);
    }, 1000);
  };

  const mergeTaskPayload = (payload) => {
    const merged = [
      ...((payload && payload.tasks) || []),
      ...((payload && payload.done_today_tasks) || []),
      ...((payload && payload.completed_tasks) || [])
    ];
    const byId = new Map();
    merged.forEach((task) => {
      const taskId = normalizeTaskIdValue(task.id);
      if (taskId) byId.set(taskId, task);
    });
    return Array.from(byId.values()).sort((a, b) => (b.total_seconds || 0) - (a.total_seconds || 0));
  };

  const filterTasks = (tasks, query) => {
    const term = String(query || '').toLowerCase().trim();
    return tasks.filter((task) => {
      if ((task.status || 'active') === 'completed') return false;
      const name = String(task.name || '').toLowerCase();
      const project = String(task.project_name || '').toLowerCase();
      return !term || name.includes(term) || project.includes(term);
    });
  };

  const syncSelectedTaskIds = (tasks) => {
    const availableIds = new Set(
      (tasks || [])
        .filter((task) => (task.status || 'active') !== 'completed')
        .map((task) => normalizeTaskIdValue(task.id))
        .filter(Boolean)
    );
    selectedTaskIds = new Set(Array.from(selectedTaskIds).filter((id) => availableIds.has(id)));
  };

  const updateBulkControls = (visibleTasks = []) => {
    if (timerBulkCount) timerBulkCount.textContent = `${selectedTaskIds.size} selected`;
    if (timerBulkApply) timerBulkApply.disabled = selectedTaskIds.size === 0;
    if (timerBulkClear) timerBulkClear.disabled = selectedTaskIds.size === 0;
  };

  const renderTasks = (tasks, query) => {
    if (!taskList) return;
    syncSelectedTaskIds(tasks);
    const filtered = filterTasks(tasks, query);
    if (!filtered.length) {
      taskList.innerHTML = '<div class="timer-empty-state">No tasks found.</div>';
      updateBulkControls(filtered);
      return;
    }

    taskList.innerHTML = filtered.map((task) => {
      const taskId = normalizeTaskIdValue(task.id);
      const isSelected = selectedTaskIds.has(taskId);
      const isCompleted = (task.status || 'active') === 'completed';
      const project = task.project_name ? ` • ${escapeHtml(task.project_name)}` : '';
      return `
        <div class="timer-task-option${isSelected ? ' is-selected' : ''}">
          <label class="timer-task-check-wrap" aria-label="Select ${escapeHtml(task.name || '')}">
            <input class="timer-task-check" type="checkbox" data-task-check-id="${taskId}" ${isSelected ? 'checked' : ''} ${isCompleted ? 'disabled' : ''} />
          </label>
          <button type="button" class="timer-task-pick${isCompleted ? ' is-completed' : ''}" data-task-id="${taskId}" ${isCompleted ? 'disabled' : ''}>
            <span>${escapeHtml(task.name || '')}${project}</span>
            <span class="timer-task-meta">${isCompleted ? 'Completed' : 'Active'} · ${formatDurationClock(task.total_seconds || 0)}</span>
          </button>
        </div>
      `;
    }).join('');

    updateBulkControls(filtered);
  };

  const openDropdown = () => {
    taskDropdown?.classList.add('is-open');
    taskPicker?.setAttribute('aria-expanded', 'true');
  };

  const closeDropdown = () => {
    taskDropdown?.classList.remove('is-open');
    taskPicker?.setAttribute('aria-expanded', 'false');
  };

  const state = loadState();
  normalizeStateTaskIds(state);
  if (!state.taskNames.length && state.taskName) {
    state.taskNames = [state.taskName];
  }
  state.taskName = state.taskName || null;

  if (state.isRunning && state.lastTick) {
    const elapsed = Math.floor((Date.now() - state.lastTick) / 1000);
    if (elapsed > 0) {
      applyElapsed(state, elapsed);
    }
  }

  const startPomodoro = () => {
    normalizeStateTaskIds(state);
    if (state.mode === 'work' && !state.taskIds.length) {
      showToast('Select a task for this Pomodoro.', 'warning');
      return;
    }
    state.isRunning = true;
    state.lastTick = Date.now();
    if (state.mode === 'work') {
      startTaskTimer(state);
    }
    saveState(state);
    updatePomodoroUI(state);
    startInterval(state);
  };

  const pausePomodoro = () => {
    state.isRunning = false;
    state.lastTick = null;
    stopTaskTimer(state);
    saveState(state);
    updatePomodoroUI(state);
    stopInterval();
  };

  if (state.isRunning) {
    startInterval(state);
  }
  updatePomodoroUI(state);

  toggleButton?.addEventListener('click', () => {
    if (state.isRunning) {
      pausePomodoro();
    } else {
      startPomodoro();
    }
  }, { signal });

  resetButton?.addEventListener('click', () => {
    state.mode = 'work';
    state.remaining = presets.work;
    state.isRunning = false;
    state.completedWork = 0;
    state.lastTick = null;
    stopTaskTimer(state);
    saveState(state);
    updatePomodoroUI(state);
    stopInterval();
  }, { signal });

  skipButton?.addEventListener('click', () => {
    if (state.mode === 'work') {
      state.completedWork += 1;
    }
    stopTaskTimer(state);
    const nextMode = getNextMode(state);
    const nextState = applyMode(state, nextMode);
    state.mode = nextState.mode;
    state.remaining = nextState.remaining;
    state.isRunning = false;
    state.lastTick = null;
    saveState(state);
    updatePomodoroUI(state);
    stopInterval();
  }, { signal });

  doneButton?.addEventListener('click', async () => {
    normalizeStateTaskIds(state);
    if (!state.taskIds.length) {
      showToast('Select a task to mark it done today.', 'warning');
      return;
    }
    try {
      if (state.taskIds.length === 1) {
        await appApi.setTaskDailyCheck(state.taskIds[0]);
      } else {
        await appApi.bulkTaskAction(state.taskIds, 'daily-check');
      }
      showToast(`${state.taskIds.length} task(s) checked off for today.`, 'success');
    } catch (error) {
      showToast(error.message || 'Failed to mark task done', 'error');
    }
  }, { signal });

  presetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.pomodoroMode;
      if (!mode || !presets[mode]) return;
      stopTaskTimer(state);
      state.mode = mode;
      state.remaining = presets[mode];
      state.isRunning = false;
      state.lastTick = null;
      saveState(state);
      updatePomodoroUI(state);
      stopInterval();
    }, { signal });
  });

  taskClear?.addEventListener('click', () => {
    if (state.isRunning && state.mode === 'work') {
      pausePomodoro();
    }
    state.taskId = null;
    state.taskName = null;
    state.taskIds = [];
    state.taskNames = [];
    if (taskPicker) taskPicker.value = '';
    if (cachedTasks.length) renderTasks(cachedTasks, '');
    saveState(state);
    updatePomodoroUI(state);
  }, { signal });

  const selectTask = (selectedTask) => {
    if (!selectedTask) return;
    normalizeStateTaskIds(state);
    if (state.isRunning) {
      pausePomodoro();
    }
    setStateTasks(state, [selectedTask]);
    state.taskRunning = Boolean(selectedTask.is_running);
    if (taskPicker) {
      taskPicker.value = selectedTask.name || '';
    }
    if (state.mode !== 'work' || state.remaining !== presets.work) {
      state.mode = 'work';
      state.remaining = presets.work;
      state.isRunning = false;
      state.lastTick = null;
    }
    renderTasks(cachedTasks, '');
    closeDropdown();
    saveState(state);
    updatePomodoroUI(state);
  };

  const applyBulkAction = async () => {
    const taskIds = Array.from(selectedTaskIds);
    if (!taskIds.length) return;
    if (timerBulkApply) timerBulkApply.disabled = true;
    try {
      const payload = await appApi.bulkTaskAction(taskIds, 'start');
      cachedTasks = mergeTaskPayload(payload);
      selectedTaskIds.clear();
      const selectedTasks = taskIds
        .map((taskId) => cachedTasks.find((task) => String(task.id) === String(taskId)))
        .filter(Boolean);
      if (selectedTasks.length) {
        setStateTasks(state, selectedTasks);
        state.taskRunning = true;
        if (taskPicker) {
          taskPicker.value = selectedTasks.length === 1 ? (selectedTasks[0].name || '') : '';
        }
      }
      saveState(state);
      updatePomodoroUI(state);
      renderTasks(cachedTasks, taskPicker ? taskPicker.value : '');
      showToast(`Started ${taskIds.length} task timer(s).`, 'success');
    } catch (error) {
      showToast(error.message || 'Failed to apply bulk timer action', 'error');
    } finally {
      updateBulkControls(filterTasks(cachedTasks, taskPicker ? taskPicker.value : ''));
    }
  };

  try {
    const tasksPayload = await appApi.getTasks();
    cachedTasks = mergeTaskPayload(tasksPayload);
    const runningTask = cachedTasks.find(
      (task) => task.is_running && (task.status || 'active') !== 'completed'
    );
    if (runningTask && !state.taskIds.length && !state.taskId) {
      setStateTasks(state, [runningTask]);
      state.mode = 'work';
      state.isRunning = true;
      state.lastTick = Date.now();
      state.taskRunning = true;
      updatePomodoroUI(state);
      startInterval(state);
    }

    if (state.taskIds.length || state.taskId) {
      const preferredIds = state.taskIds.length ? state.taskIds : [state.taskId];
      const selectedTasks = preferredIds
        .map((taskId) => cachedTasks.find((task) => String(task.id) === String(taskId)))
        .filter(Boolean);
      if (selectedTasks.length) {
        setStateTasks(state, selectedTasks);
        state.taskRunning = selectedTasks.some((task) => task.is_running);
        if (taskPicker) {
          taskPicker.value = selectedTasks.length === 1 ? (selectedTasks[0].name || '') : '';
        }
        updatePomodoroUI(state);
      } else {
        state.isRunning = false;
        state.lastTick = null;
        state.taskId = null;
        state.taskName = null;
        state.taskIds = [];
        state.taskNames = [];
        state.taskRunning = false;
        stopInterval();
        if (taskPicker) taskPicker.value = '';
        saveState(state);
        updatePomodoroUI(state);
      }
    }
    renderTasks(cachedTasks, taskPicker ? taskPicker.value : '');
  } catch (error) {
    console.error(error);
    if (taskList) {
      taskList.innerHTML = '<div class="timer-empty-state">Failed to load tasks.</div>';
    }
  }

  timerQuickTaskForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = timerQuickTaskName ? timerQuickTaskName.value.trim() : '';
    if (!name) return;
    const submitButton = timerQuickTaskForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    setQuickTaskFeedback('');

    try {
      const selectedLabelId = timerQuickTaskLabel && timerQuickTaskLabel.value ? timerQuickTaskLabel.value : '';
      const payload = await appApi.createTask({
        name,
        project_id: timerQuickTaskProject && timerQuickTaskProject.value ? timerQuickTaskProject.value : null,
        priority: timerQuickTaskPriority && timerQuickTaskPriority.value ? timerQuickTaskPriority.value : 'medium',
        label_ids: selectedLabelId ? [selectedLabelId] : [],
        goal_id: null
      });
      cachedTasks = mergeTaskPayload(payload);
      selectedTaskIds.clear();
      renderTasks(cachedTasks, taskPicker ? taskPicker.value : '');
      if (timerQuickTaskName) {
        timerQuickTaskName.value = '';
        timerQuickTaskName.focus();
      }
      if (timerQuickTaskPriority) timerQuickTaskPriority.value = 'medium';
      if (timerQuickTaskLabel) timerQuickTaskLabel.value = '';
      setQuickTaskFeedback('Task added.', 'success');
    } catch (error) {
      console.error(error);
      setQuickTaskFeedback(error.message || 'Saving failed.', 'error');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }, { signal });

  taskPicker?.addEventListener('focus', openDropdown, { signal });
  taskPicker?.addEventListener('click', openDropdown, { signal });
  taskPicker?.addEventListener('input', () => {
    openDropdown();
    renderTasks(cachedTasks, taskPicker.value);
  }, { signal });
  taskPicker?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openDropdown();
      const firstButton = taskList?.querySelector('.timer-task-pick:not([disabled])');
      if (firstButton) firstButton.focus();
    }
    if (event.key === 'Enter') {
      const candidates = filterTasks(cachedTasks, taskPicker.value).filter(
        (task) => (task.status || 'active') !== 'completed'
      );
      if (candidates.length) {
        event.preventDefault();
        selectTask(candidates[0]);
      }
    }
    if (event.key === 'Escape') {
      closeDropdown();
    }
  }, { signal });

  taskList?.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;
    const button = target.closest('button.timer-task-pick[data-task-id]');
    if (!button || button.disabled) return;
    const selected = cachedTasks.find((task) => String(task.id) === String(button.dataset.taskId));
    selectTask(selected);
  }, { signal });

  taskList?.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.classList.contains('timer-task-check')) return;
    const taskId = normalizeTaskIdValue(target.dataset.taskCheckId || target.value);
    if (!taskId) return;
    if (target.checked) selectedTaskIds.add(taskId);
    else selectedTaskIds.delete(taskId);
    renderTasks(cachedTasks, taskPicker ? taskPicker.value : '');
  }, { signal });

  timerBulkClear?.addEventListener('click', () => {
    selectedTaskIds.clear();
    renderTasks(cachedTasks, taskPicker ? taskPicker.value : '');
  }, { signal });

  timerBulkApply?.addEventListener('click', () => {
    applyBulkAction();
  }, { signal });

  content.addEventListener('click', async (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;
    const actionButton = target.closest('button[data-action][data-task-id]');
    if (!actionButton) return;
    const taskId = actionButton.dataset.taskId;
    const action = actionButton.dataset.action;
    if (!taskId || !action) return;
    actionButton.disabled = true;
    try {
      if (action === 'start') await appApi.startTask(taskId);
      if (action === 'stop') await appApi.stopTask(taskId);
      if (action === 'complete') await appApi.completeTask(taskId);
      showToast('Timer task updated', 'success');
      await render(container, currentPath, {});
    } catch (error) {
      showToast(error.message || 'Failed to update timer task', 'error');
    } finally {
      actionButton.disabled = false;
    }
  }, { signal });

  document.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;
    if (!target.closest('.timer-select')) {
      closeDropdown();
    }
  }, { signal });
}

function renderCalendar(content, payload) {
  const weekDays = Array.isArray(payload.week_days) ? payload.week_days : [];
  const taskRows = Array.isArray(payload.task_rows) ? payload.task_rows : [];
  const habitRows = Array.isArray(payload.habit_rows) ? payload.habit_rows : [];

  const renderRow = (label, checks) => {
    const cells = checks.map((checked) => `<span class="calendar-dot ${checked ? 'checked' : ''}"></span>`).join('');
    return `
      <article class="calendar-row-lite">
        <h5>${escapeHtml(label)}</h5>
        <div class="calendar-dot-row">${cells}</div>
      </article>
    `;
  };

  content.innerHTML = `
    <div class="app-panel">
      <div class="app-panel-header">
        <h3>Calendar</h3>
        <p>${escapeHtml(payload.week_label || 'Current week')}</p>
      </div>

      <div class="calendar-week-days">
        ${weekDays.map((day) => `<span class="calendar-day-pill ${day.is_today ? 'today' : ''}">${escapeHtml(day.day)} ${escapeHtml(day.date)}</span>`).join('')}
      </div>

      <div class="calendar-section-block">
        <h4>Tasks</h4>
        ${taskRows.length === 0 ? '<p class="muted">No task rows.</p>' : ''}
        ${taskRows.map((task) => renderRow(task.name, task.week_checks || [])).join('')}
      </div>

      <div class="calendar-section-block">
        <h4>Habits</h4>
        ${habitRows.length === 0 ? '<p class="muted">No habit rows.</p>' : ''}
        ${habitRows.map((habit) => renderRow(habit.name, habit.week_checks || [])).join('')}
      </div>
    </div>
  `;
}

function renderGoals(content, payload, viewMode = 'overview') {
  const goals = Array.isArray(payload.goals) ? payload.goals : [];
  const labels = Array.isArray(payload.labels) ? payload.labels : [];
  const projects = Array.isArray(payload.projects) ? payload.projects : [];
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];

  const visibleGoals = viewMode === 'long-term'
    ? goals
    : goals;

  content.innerHTML = `
    <div class="app-panel">
      <div class="app-panel-header">
        <h3>${viewMode === 'long-term' ? 'Long-term Goals' : 'Goals'}</h3>
        <p>Manage outcome goals and sub-goals directly in PWA.</p>
      </div>

      <div class="stats-grid">
        <article class="stat-card"><h4>Active Goals</h4><p>${Number(payload.active_goals_count || 0)}</p></article>
        <article class="stat-card"><h4>Total Goals</h4><p>${goals.length}</p></article>
        <article class="stat-card"><h4>Targets Set</h4><p>${Number(payload.targets_set || 0)}</p></article>
        <article class="stat-card"><h4>Tracked Time</h4><p>${formatDuration(payload.total_goal_seconds || 0)}</p></article>
      </div>

      <form id="goal-create-form" class="goals-create-form">
        <input id="goal-name" type="text" placeholder="Goal name" required />
        <input id="goal-target-date" type="date" />
        <input id="goal-target-hours" type="number" min="0" step="0.5" placeholder="Target hours" />
        <select id="goal-label" required>
          <option value="">Select label</option>
          ${labels.map((label) => `<option value="${label.id}">${escapeHtml(label.name)}</option>`).join('')}
        </select>
        <select id="goal-project">
          <option value="">Project (optional)</option>
          ${projects.map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join('')}
        </select>
        <select id="goal-task">
          <option value="">Task (optional)</option>
          ${tasks.map((task) => `<option value="${task.id}">${escapeHtml(task.name)}</option>`).join('')}
        </select>
        <button class="btn btn-primary" type="submit">Create Goal</button>
      </form>

      <div class="goal-grid-lite">
        ${visibleGoals.length === 0 ? '<p class="muted">No goals yet.</p>' : ''}
        ${visibleGoals.map((goal) => `
          <article class="goal-lite-card">
            <header>
              <h5>${escapeHtml(goal.name)}</h5>
              <span class="goal-status-lite ${badgeForGoalStatus(goal.display_status || goal.status)}">${escapeHtml((goal.display_status || goal.status || 'active').replace('_', ' '))}</span>
            </header>
            <p>${escapeHtml(goal.description || 'No description')}</p>
            <div class="goal-metrics-lite">
              <span>Progress ${Number(goal.progress || 0)}%</span>
              <span>Tasks ${Number(goal.tasks_count || 0)}</span>
              <span>Projects ${Number(goal.projects_count || 0)}</span>
            </div>
            <div class="goal-actions-lite">
              <button data-action="delete-goal" data-goal-id="${goal.id}" class="danger" type="button">Delete</button>
            </div>
            <div class="subgoal-list-lite">
              ${(Array.isArray(goal.subgoals) ? goal.subgoals : []).slice(0, 6).map((subgoal) => `
                <label>
                  <input type="checkbox" data-action="toggle-subgoal" data-subgoal-id="${subgoal.id}" ${subgoal.status === 'completed' ? 'checked' : ''} />
                  <span>${escapeHtml(subgoal.title)}</span>
                </label>
              `).join('')}
              <form class="subgoal-add-form-lite" data-goal-id="${goal.id}">
                <input type="text" placeholder="Add sub-goal" name="title" required />
                <button class="btn btn-secondary" type="submit">Add</button>
              </form>
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

async function bindGoalActions(container, currentPath) {
  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  const createForm = content.querySelector('#goal-create-form');
  if (createForm) {
    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = content.querySelector('#goal-name').value.trim();
      const targetDate = content.querySelector('#goal-target-date').value;
      const targetHours = content.querySelector('#goal-target-hours').value;
      const labelId = content.querySelector('#goal-label').value;
      const projectId = content.querySelector('#goal-project').value;
      const taskId = content.querySelector('#goal-task').value;

      if (!name || !labelId) return;

      try {
        await appApi.createGoal({
          name,
          description: '',
          status: 'active',
          priority: 'medium',
          target_date: targetDate,
          target_hours: targetHours,
          label_id: labelId,
          subgoals: '',
          project_ids: projectId ? [projectId] : [],
          task_ids: taskId ? [taskId] : []
        });
        showToast('Goal created', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to create goal', 'error');
      }
    });
  }

  content.querySelectorAll('[data-action="delete-goal"]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await appApi.deleteGoal(button.dataset.goalId);
        showToast('Goal deleted', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to delete goal', 'error');
      }
    });
  });

  content.querySelectorAll('[data-action="toggle-subgoal"]').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      try {
        await appApi.toggleGoalSubgoal(checkbox.dataset.subgoalId, checkbox.checked);
        showToast('Sub-goal updated', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to update sub-goal', 'error');
      }
    });
  });

  content.querySelectorAll('.subgoal-add-form-lite').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const titleInput = form.querySelector('input[name="title"]');
      const title = titleInput.value.trim();
      if (!title) return;

      try {
        await appApi.addGoalSubgoal(form.dataset.goalId, {
          title,
          label: '',
          target_date: '',
          project_id: ''
        });
        showToast('Sub-goal created', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to create sub-goal', 'error');
      }
    });
  });
}

function renderWeeklyGoals(content, payload) {
  const current = Array.isArray(payload.weekly_goals_current) ? payload.weekly_goals_current : [];
  const all = Array.isArray(payload.weekly_goals_all) ? payload.weekly_goals_all : [];
  const longTermGoals = Array.isArray(payload.long_term_goals) ? payload.long_term_goals : [];
  const labels = Array.isArray(payload.labels) ? payload.labels : [];

  content.innerHTML = `
    <div class="app-panel">
      <div class="app-panel-header">
        <h3>Weekly Goals</h3>
        <p>${escapeHtml(payload.weekly_range_label || 'Current week')}</p>
      </div>

      <form id="weekly-goal-create-form" class="weekly-goal-form-lite">
        <input id="weekly-goal-title" type="text" placeholder="Goal title" required />
        <input id="weekly-goal-hours" type="number" min="0" step="0.5" placeholder="Target hours" />
        <select id="weekly-goal-long-term">
          <option value="">No long-term goal</option>
          ${longTermGoals.map((goal) => `<option value="${goal.id}">${escapeHtml(goal.name)}</option>`).join('')}
        </select>
        <select id="weekly-goal-label" required>
          <option value="">Select label</option>
          ${labels.map((label) => `<option value="${label.id}">${escapeHtml(label.name)}</option>`).join('')}
        </select>
        <button class="btn btn-primary" type="submit">Add Weekly Goal</button>
      </form>

      <div class="goal-list-section">
        <h4>This Week</h4>
        ${current.length === 0 ? '<p class="muted">No weekly goals in current week.</p>' : ''}
        ${current.map((goal) => `
          <article class="goal-row-lite">
            <div>
              <h5>${escapeHtml(goal.title)}</h5>
              <p>${formatDuration(goal.progress_seconds)} logged • Target ${Number(goal.target_seconds || 0) / 3600}h</p>
            </div>
            <div class="task-actions">
              <span class="task-state ${goal.status === 'completed' ? 'running' : 'idle'}">${escapeHtml(goal.status || 'active')}</span>
              <button data-action="toggle-weekly" data-goal-id="${goal.id}" data-status="${goal.status === 'completed' ? 'active' : 'completed'}" type="button">${goal.status === 'completed' ? 'Reopen' : 'Done'}</button>
              <button data-action="delete-weekly" data-goal-id="${goal.id}" class="danger" type="button">Delete</button>
            </div>
          </article>
        `).join('')}
      </div>

      <div class="goal-list-section">
        <h4>History</h4>
        ${all.length === 0 ? '<p class="muted">No weekly history yet.</p>' : ''}
        ${all.slice(0, 18).map((goal) => `
          <article class="goal-row-lite secondary">
            <div>
              <h5>${escapeHtml(goal.title)}</h5>
              <p>${escapeHtml(goal.week_label || '')} • ${formatDuration(goal.progress_seconds)} / ${formatDuration(goal.target_seconds)}</p>
            </div>
            <span class="task-state ${goal.status === 'completed' ? 'running' : 'idle'}">${escapeHtml(goal.status || 'active')}</span>
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

async function bindWeeklyGoalActions(container, currentPath, payload) {
  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  const form = content.querySelector('#weekly-goal-create-form');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const title = content.querySelector('#weekly-goal-title').value.trim();
      const targetHours = content.querySelector('#weekly-goal-hours').value;
      const longTermGoalId = content.querySelector('#weekly-goal-long-term').value;
      const labelId = content.querySelector('#weekly-goal-label').value;
      if (!title || !labelId) return;

      try {
        await appApi.createWeeklyGoal({
          title,
          target_hours: targetHours,
          week_start: payload.week_start,
          week_end: payload.week_end,
          long_term_goal_id: longTermGoalId || null,
          label_id: labelId
        });
        showToast('Weekly goal created', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to create weekly goal', 'error');
      }
    });
  }

  content.querySelectorAll('[data-action="toggle-weekly"]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await appApi.toggleWeeklyGoal(button.dataset.goalId, button.dataset.status);
        showToast('Weekly goal updated', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to update weekly goal', 'error');
      }
    });
  });

  content.querySelectorAll('[data-action="delete-weekly"]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await appApi.deleteWeeklyGoal(button.dataset.goalId);
        showToast('Weekly goal deleted', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to delete weekly goal', 'error');
      }
    });
  });
}

function renderHabits(content, payload) {
  const habits = Array.isArray(payload.habits) ? payload.habits : [];

  content.innerHTML = `
    <div class="app-panel">
      <div class="app-panel-header">
        <h3>Habits</h3>
        <p>Daily routines with streak and completion tracking.</p>
      </div>

      <div class="stats-grid">
        <article class="stat-card"><h4>Completed Today</h4><p>${Number(payload.completed_habits || 0)}</p></article>
        <article class="stat-card"><h4>Total Habits</h4><p>${Number(payload.total_habits || 0)}</p></article>
        <article class="stat-card"><h4>Best Streak</h4><p>${Number(payload.best_streak || 0)}d</p></article>
        <article class="stat-card"><h4>Focus Window</h4><p>${escapeHtml(payload.focus_window || 'Anytime')}</p></article>
      </div>

      <form id="habit-create-form" class="inline-actions-form">
        <input id="habit-name" type="text" placeholder="Habit name" required />
        <select id="habit-frequency">
          <option value="Daily">Daily</option>
          <option value="Weekdays">Weekdays</option>
          <option value="Weekends">Weekends</option>
        </select>
        <select id="habit-time">
          <option value="">Anytime</option>
          <option value="Morning">Morning</option>
          <option value="Afternoon">Afternoon</option>
          <option value="Evening">Evening</option>
        </select>
        <button class="btn btn-primary" type="submit">Add Habit</button>
      </form>

      <div class="habit-list-lite">
        ${habits.length === 0 ? '<p class="muted">No habits yet.</p>' : ''}
        ${habits.map((habit) => `
          <article class="habit-row-lite ${habit.done ? 'is-done' : ''}">
            <label>
              <input type="checkbox" data-action="toggle-habit" data-habit-id="${habit.id}" ${habit.done ? 'checked' : ''} />
              <span>${escapeHtml(habit.name)}</span>
            </label>
            <div class="task-actions">
              <span class="task-state ${habit.done ? 'running' : 'idle'}">${habit.streak}d streak</span>
              <button data-action="delete-habit" data-habit-id="${habit.id}" class="danger" type="button">Delete</button>
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

async function bindHabitActions(container, currentPath, today) {
  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  const form = content.querySelector('#habit-create-form');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = content.querySelector('#habit-name').value.trim();
      const frequency = content.querySelector('#habit-frequency').value;
      const timeOfDay = content.querySelector('#habit-time').value;
      if (!name) return;

      try {
        await appApi.createHabit({
          name,
          frequency,
          time_of_day: timeOfDay,
          reminder: '',
          notes: '',
          goal_name: '',
          subgoal_name: ''
        });
        showToast('Habit created', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to create habit', 'error');
      }
    });
  }

  content.querySelectorAll('[data-action="toggle-habit"]').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      try {
        await appApi.toggleHabit(checkbox.dataset.habitId, { done: checkbox.checked, date: today });
        showToast('Habit updated', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to update habit', 'error');
      }
    });
  });

  content.querySelectorAll('[data-action="delete-habit"]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await appApi.deleteHabit(button.dataset.habitId);
        showToast('Habit deleted', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to delete habit', 'error');
      }
    });
  });
}

function renderPlanner(content, payload) {
  const habits = Array.isArray(payload.habits) ? payload.habits : [];
  const todos = Array.isArray(payload.todos) ? payload.todos : [];
  const doneTodos = Array.isArray(payload.done_todos) ? payload.done_todos : [];

  content.innerHTML = `
    <div class="app-panel">
      <div class="app-panel-header">
        <h3>Planner</h3>
        <p>Habits and to-dos in one board.</p>
      </div>

      <div class="planner-columns-lite">
        <section>
          <h4>Habits</h4>
          <form id="planner-habit-form" class="inline-actions-form">
            <input id="planner-habit-name" type="text" placeholder="New habit" required />
            <button class="btn btn-primary" type="submit">Add Habit</button>
          </form>
          ${habits.length === 0 ? '<p class="muted">No habits.</p>' : ''}
          ${habits.map((habit) => `
            <article class="habit-row-lite ${habit.done ? 'is-done' : ''}">
              <label>
                <input type="checkbox" data-action="planner-toggle-habit" data-habit-id="${habit.id}" ${habit.done ? 'checked' : ''} />
                <span>${escapeHtml(habit.name)}</span>
              </label>
              <span class="task-state ${habit.done ? 'running' : 'idle'}">${habit.streak}d</span>
            </article>
          `).join('')}
        </section>

        <section>
          <h4>To-dos</h4>
          <form id="todo-create-form" class="inline-actions-form">
            <input id="todo-name" type="text" placeholder="New to-do" required />
            <button class="btn btn-primary" type="submit">Add To-do</button>
          </form>

          <div class="todo-group-lite">
            <h5>Open</h5>
            ${todos.length === 0 ? '<p class="muted">No open to-dos.</p>' : ''}
            ${todos.map((todo) => `
              <article class="todo-row-lite">
                <span>${escapeHtml(todo.name)}</span>
                <div class="task-actions">
                  <button data-action="todo-done" data-todo-id="${todo.id}" type="button">Done</button>
                  <button data-action="todo-delete" data-todo-id="${todo.id}" class="danger" type="button">Delete</button>
                </div>
              </article>
            `).join('')}
          </div>

          <div class="todo-group-lite">
            <h5>Done Today</h5>
            ${doneTodos.length === 0 ? '<p class="muted">Nothing completed yet.</p>' : ''}
            ${doneTodos.map((todo) => `
              <article class="todo-row-lite done">
                <span>${escapeHtml(todo.name)}</span>
                <div class="task-actions">
                  <button data-action="todo-reopen" data-todo-id="${todo.id}" type="button">Reopen</button>
                  <button data-action="todo-delete" data-todo-id="${todo.id}" class="danger" type="button">Delete</button>
                </div>
              </article>
            `).join('')}
          </div>
        </section>
      </div>
    </div>
  `;
}

async function bindPlannerActions(container, currentPath, today) {
  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  const habitForm = content.querySelector('#planner-habit-form');
  if (habitForm) {
    habitForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = content.querySelector('#planner-habit-name').value.trim();
      if (!name) return;

      try {
        await appApi.createHabit({
          name,
          frequency: 'Daily',
          time_of_day: '',
          reminder: '',
          notes: '',
          goal_name: '',
          subgoal_name: ''
        });
        showToast('Habit created', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to create habit', 'error');
      }
    });
  }

  content.querySelectorAll('[data-action="planner-toggle-habit"]').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      try {
        await appApi.toggleHabit(checkbox.dataset.habitId, { done: checkbox.checked, date: today });
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to update habit', 'error');
      }
    });
  });

  const todoForm = content.querySelector('#todo-create-form');
  if (todoForm) {
    todoForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = content.querySelector('#todo-name').value.trim();
      if (!name) return;
      try {
        await appApi.createTodo(name);
        showToast('To-do created', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to create to-do', 'error');
      }
    });
  }

  content.querySelectorAll('[data-action="todo-done"]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await appApi.toggleTodo(button.dataset.todoId, true);
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to complete to-do', 'error');
      }
    });
  });

  content.querySelectorAll('[data-action="todo-reopen"]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await appApi.toggleTodo(button.dataset.todoId, false);
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to reopen to-do', 'error');
      }
    });
  });

  content.querySelectorAll('[data-action="todo-delete"]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await appApi.deleteTodo(button.dataset.todoId);
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to delete to-do', 'error');
      }
    });
  });
}

function renderReminders(content, payload) {
  const reminders = Array.isArray(payload.reminders) ? payload.reminders : [];

  content.innerHTML = `
    <div class="app-panel">
      <div class="app-panel-header">
        <h3>Reminders</h3>
        <p>One-time and recurring reminders.</p>
      </div>

      <div class="stats-grid">
        <article class="stat-card"><h4>Total</h4><p>${Number(payload.reminders_summary?.total || 0)}</p></article>
        <article class="stat-card"><h4>Active</h4><p>${Number(payload.reminders_summary?.active || 0)}</p></article>
        <article class="stat-card"><h4>Overdue</h4><p>${Number(payload.reminders_summary?.overdue || 0)}</p></article>
        <article class="stat-card"><h4>Next Up</h4><p>${escapeHtml(payload.reminders_summary?.next_label || '-')}</p></article>
      </div>

      <form id="reminder-create-form" class="reminder-form-lite">
        <input id="reminder-title" type="text" placeholder="Reminder title" required />
        <input id="reminder-date" type="date" value="${escapeHtml(payload.today || '')}" required />
        <input id="reminder-time" type="time" value="09:00" required />
        <select id="reminder-repeat">
          <option value="none">One-time</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <select id="reminder-priority">
          <option value="low">Low</option>
          <option value="normal" selected>Normal</option>
          <option value="high">High</option>
        </select>
        <button class="btn btn-primary" type="submit">Add Reminder</button>
      </form>

      <div class="reminder-list-lite">
        ${reminders.length === 0 ? '<p class="muted">No reminders yet.</p>' : ''}
        ${reminders.map((reminder) => `
          <article class="reminder-row-lite ${reminder.status === 'overdue' ? 'overdue' : ''}">
            <div>
              <h5>${escapeHtml(reminder.title)}</h5>
              <p>${escapeHtml(reminder.next_label || '-')} • ${escapeHtml(reminder.repeat_label || 'One-time')}</p>
            </div>
            <div class="task-actions">
              <button data-action="toggle-reminder" data-reminder-id="${reminder.id}" data-is-active="${reminder.is_active ? '0' : '1'}" type="button">${reminder.is_active ? 'Pause' : 'Resume'}</button>
              <button data-action="delete-reminder" data-reminder-id="${reminder.id}" class="danger" type="button">Delete</button>
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

async function bindReminderActions(container, currentPath) {
  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  const createForm = content.querySelector('#reminder-create-form');
  if (createForm) {
    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const title = content.querySelector('#reminder-title').value.trim();
      const remindDate = content.querySelector('#reminder-date').value;
      const remindTime = content.querySelector('#reminder-time').value;
      const repeatInterval = content.querySelector('#reminder-repeat').value;
      const priority = content.querySelector('#reminder-priority').value;

      if (!title || !remindDate || !remindTime) return;

      try {
        await appApi.createReminder({
          title,
          remind_date: remindDate,
          remind_time: remindTime,
          repeat_interval: repeatInterval,
          repeat_days: [],
          priority,
          notes: '',
          is_active: true,
          channel_toast: true,
          channel_system: false,
          play_sound: false
        });
        showToast('Reminder created', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to create reminder', 'error');
      }
    });
  }

  content.querySelectorAll('[data-action="toggle-reminder"]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await appApi.toggleReminder(button.dataset.reminderId, button.dataset.isActive === '1');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to update reminder', 'error');
      }
    });
  });

  content.querySelectorAll('[data-action="delete-reminder"]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await appApi.deleteReminder(button.dataset.reminderId);
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to delete reminder', 'error');
      }
    });
  });
}

function renderLabels(content, payload) {
  const labels = Array.isArray(payload.labels) ? payload.labels : [];

  content.innerHTML = `
    <div class="app-panel">
      <div class="app-panel-header">
        <h3>Labels</h3>
        <p>Centralized label palette for tasks and projects.</p>
      </div>

      <form id="label-create-form" class="inline-actions-form">
        <input id="label-name" type="text" placeholder="Label name" required />
        <input id="label-color" type="color" value="#1f6feb" />
        <button class="btn btn-primary" type="submit">Add Label</button>
      </form>

      <div class="label-list-lite">
        ${labels.length === 0 ? '<p class="muted">No labels yet.</p>' : ''}
        ${labels.map((label) => `
          <article class="label-row-lite">
            <span class="label-chip" style="background-color: ${escapeHtml(label.color)}">${escapeHtml(label.name)}</span>
            <form class="inline-edit-form" data-label-id="${label.id}">
              <input name="name" type="text" value="${escapeHtml(label.name)}" required />
              <input name="color" type="color" value="${escapeHtml(label.color)}" />
              <button class="btn btn-secondary" type="submit">Save</button>
              <button data-action="delete-label" data-label-id="${label.id}" class="danger" type="button">Delete</button>
            </form>
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

async function bindLabelActions(container, currentPath) {
  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  const createForm = content.querySelector('#label-create-form');
  if (createForm) {
    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = content.querySelector('#label-name').value.trim();
      const color = content.querySelector('#label-color').value;
      if (!name || !color) return;

      try {
        await appApi.createLabel(name, color);
        showToast('Label created', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to create label', 'error');
      }
    });
  }

  content.querySelectorAll('.inline-edit-form[data-label-id]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const labelId = form.dataset.labelId;
      const name = form.querySelector('input[name="name"]').value.trim();
      const color = form.querySelector('input[name="color"]').value;
      try {
        await appApi.updateLabel(labelId, name, color);
        showToast('Label updated', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to update label', 'error');
      }
    });
  });

  content.querySelectorAll('[data-action="delete-label"]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await appApi.deleteLabel(button.dataset.labelId);
        showToast('Label deleted', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to delete label', 'error');
      }
    });
  });
}

function renderAccount(content, payload) {
  const user = payload.user || {};
  const profile = payload.profile || {};
  const settings = payload.notification_settings || {};
  const timezones = Array.isArray(payload.timezone_options) ? payload.timezone_options : [];

  content.innerHTML = `
    <div class="app-panel">
      <div class="app-panel-header">
        <h3>Account</h3>
        <p>Profile, timezone, and notification settings.</p>
      </div>

      <div class="account-summary-lite">
        <article class="stat-card"><h4>Email</h4><p>${escapeHtml(user.email || '-')}</p></article>
        <article class="stat-card"><h4>User ID</h4><p>${escapeHtml(user.id || '-')}</p></article>
        <article class="stat-card"><h4>Timezone</h4><p>${escapeHtml(payload.timezone_name || 'UTC')}</p></article>
      </div>

      <form id="profile-form" class="account-form-lite">
        <h4>Profile</h4>
        <input id="profile-full-name" type="text" placeholder="Full name" value="${escapeHtml(profile.full_name || '')}" />
        <input id="profile-phone" type="tel" placeholder="Phone" value="${escapeHtml(profile.phone || '')}" />
        <textarea id="profile-bio" rows="3" placeholder="Bio">${escapeHtml(profile.bio || '')}</textarea>
        <button class="btn btn-primary" type="submit">Save Profile</button>
      </form>

      <form id="timezone-form" class="account-form-lite compact">
        <h4>Timezone</h4>
        <select id="timezone-select">
          ${timezones.map((timezone) => `<option value="${escapeHtml(timezone)}" ${timezone === payload.timezone_name ? 'selected' : ''}>${escapeHtml(timezone)}</option>`).join('')}
        </select>
        <button class="btn btn-secondary" type="submit">Save Timezone</button>
      </form>

      <form id="notifications-form" class="account-form-lite">
        <h4>Notifications</h4>
        <label><input type="checkbox" id="notif-enabled" ${settings.enabled ? 'checked' : ''} /> Enabled</label>
        <label><input type="checkbox" id="notif-toast" ${settings.show_toast ? 'checked' : ''} /> In-app popup</label>
        <label><input type="checkbox" id="notif-system" ${settings.show_system ? 'checked' : ''} /> System notification</label>
        <label><input type="checkbox" id="notif-sound" ${settings.play_sound ? 'checked' : ''} /> Play sound</label>
        <input id="notif-interval" type="number" min="1" max="240" value="${Number(settings.interval_minutes || 30)}" />
        <input id="notif-title" type="text" value="${escapeHtml(settings.title || '')}" placeholder="Notification title" />
        <textarea id="notif-message" rows="2" placeholder="Notification message">${escapeHtml(settings.message || '')}</textarea>
        <button class="btn btn-primary" type="submit">Save Notification Settings</button>
      </form>
    </div>
  `;
}

async function bindAccountActions(container, currentPath) {
  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  const profileForm = content.querySelector('#profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await appApi.updateProfile({
          full_name: content.querySelector('#profile-full-name').value,
          phone: content.querySelector('#profile-phone').value,
          bio: content.querySelector('#profile-bio').value
        });
        showToast('Profile updated', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to update profile', 'error');
      }
    });
  }

  const timezoneForm = content.querySelector('#timezone-form');
  if (timezoneForm) {
    timezoneForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await appApi.updateTimezone(content.querySelector('#timezone-select').value);
        showToast('Timezone updated', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to update timezone', 'error');
      }
    });
  }

  const notificationsForm = content.querySelector('#notifications-form');
  if (notificationsForm) {
    notificationsForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await appApi.updateNotificationSettings({
          notifications_enabled: content.querySelector('#notif-enabled').checked,
          notifications_show_toast: content.querySelector('#notif-toast').checked,
          notifications_show_system: content.querySelector('#notif-system').checked,
          notifications_play_sound: content.querySelector('#notif-sound').checked,
          notifications_interval_minutes: Number(content.querySelector('#notif-interval').value || 30),
          notifications_title: content.querySelector('#notif-title').value,
          notifications_message: content.querySelector('#notif-message').value
        });
        showToast('Notification settings updated', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to update notification settings', 'error');
      }
    });
  }
}

async function renderSection(container, section, currentPath) {
  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  if (section !== 'tasks' && typeof tasksViewCleanup === 'function') {
    tasksViewCleanup();
    tasksViewCleanup = null;
  }

  if (section !== 'timer' && typeof timerViewCleanup === 'function') {
    timerViewCleanup();
    timerViewCleanup = null;
  }

  renderLoading(content, section);

  try {
    if (section === 'overview') {
      const range = lastSevenDaysRange();
      const [overview, tasks, goals, reports, habits] = await Promise.all([
        appApi.getOverview(),
        appApi.getTasks(),
        appApi.getGoals().catch(() => ({
          goals: [],
          active_goals_count: 0,
          total_goal_seconds: 0,
          targets_set: 0
        })),
        appApi.getReportsSummary({ start: range.start, end: range.end }).catch(() => ({
          summary: [],
          distribution: [],
          total_seconds: 0
        })),
        appApi.getHabits().catch(() => ({
          habits: [],
          total_habits: 0,
          completed_habits: 0,
          best_streak: 0,
          focus_window: 'Anytime'
        }))
      ]);
      renderOverview(content, overview, tasks, goals, reports, habits, range);
      return;
    }

    if (section === 'tasks') {
      const [tasks, projects, goals, labels] = await Promise.all([
        appApi.getTasks(),
        appApi.getProjects().catch(() => ({ projects: [] })),
        appApi.getGoals().catch(() => ({ goals: [] })),
        appApi.getLabels().catch(() => ({ labels: [] }))
      ]);
      renderTasks(content, tasks, projects, goals, labels);
      await bindTaskActions(container, currentPath, tasks);
      return;
    }

    if (section === 'projects') {
      const projects = await appApi.getProjects();
      renderProjects(content, projects);
      await bindProjectActions(container, currentPath);
      return;
    }

    if (section === 'reports') {
      const range = lastSevenDaysRange();
      const report = await appApi.getReportsSummary({ start: range.start, end: range.end, group: 'projects' });
      renderReports(content, report, range);
      return;
    }

    if (section === 'timer') {
      const search = new URLSearchParams(window.location.search || '');
      const start = search.get('start');
      const end = search.get('end');
      const params = {};
      if (start) params.start = start;
      if (end) params.end = end;
      const payload = await appApi.getTimerDashboard(params);
      renderTimer(content, payload);
      await bindTimerActions(container, currentPath);
      return;
    }

    if (section === 'calendar') {
      const payload = await appApi.getCalendarBoard();
      renderCalendar(content, payload);
      return;
    }

    if (section === 'goals' || section === 'long-term-goals') {
      const payload = await appApi.getGoals();
      renderGoals(content, payload, section === 'long-term-goals' ? 'long-term' : 'overview');
      await bindGoalActions(container, currentPath);
      return;
    }

    if (section === 'weekly-goals') {
      const payload = await appApi.getWeeklyGoals();
      renderWeeklyGoals(content, payload);
      await bindWeeklyGoalActions(container, currentPath, payload);
      return;
    }

    if (section === 'habits') {
      const payload = await appApi.getHabits();
      renderHabits(content, payload);
      await bindHabitActions(container, currentPath, payload.today);
      return;
    }

    if (section === 'planner') {
      const payload = await appApi.getPlanner();
      renderPlanner(content, payload);
      await bindPlannerActions(container, currentPath, payload.today);
      return;
    }

    if (section === 'reminders') {
      const payload = await appApi.getReminders();
      renderReminders(content, payload);
      await bindReminderActions(container, currentPath);
      return;
    }

    if (section === 'labels') {
      const payload = await appApi.getLabels();
      renderLabels(content, payload);
      await bindLabelActions(container, currentPath);
      return;
    }

    if (section === 'account') {
      const payload = await appApi.getAccount();
      renderAccount(content, payload);
      await bindAccountActions(container, currentPath);
      return;
    }

    content.innerHTML = `
      <div class="app-panel app-error-state">
        <i class="fas fa-circle-info"></i>
        <h3>Section Not Found</h3>
        <p>This section does not exist yet.</p>
      </div>
    `;
  } catch (error) {
    renderError(content, error.message || 'Unknown error');
  }
}

/**
 * Render app view
 */
export async function render(container, path, params) {
  const { section } = resolveSection(path);
  renderShell(container, section);
  await renderSection(container, section, path);
}

export function sendToIframe() {
  // Legacy no-op kept for compatibility with existing calls.
}

export default {
  render,
  send: sendToIframe,
  name: 'app'
};
