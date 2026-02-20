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

function taskGroupMarkup(title, tasks, groupKey) {
  return `
    <section class="task-group">
      <h4>${title} <span>(${tasks.length})</span></h4>
      ${tasks.length === 0 ? '<p class="muted">No tasks in this group.</p>' : ''}
      ${tasks.map((task) => {
        const actions = [];
        if (groupKey === 'active') {
          actions.push(task.is_running
            ? `<button data-action="stop" data-task-id="${task.id}" type="button">Stop</button>`
            : `<button data-action="start" data-task-id="${task.id}" type="button">Start</button>`);
          actions.push(`<button data-action="done" data-task-id="${task.id}" type="button">Done</button>`);
          actions.push(`<button data-action="complete" data-task-id="${task.id}" type="button">Complete</button>`);
        } else {
          actions.push(`<button data-action="reopen" data-task-id="${task.id}" type="button">Reopen</button>`);
        }
        actions.push(`<button data-action="delete" data-task-id="${task.id}" class="danger" type="button">Delete</button>`);

        return `
          <article class="task-item">
            <div class="task-info">
              <h5>${escapeHtml(task.name)}</h5>
              <p>${escapeHtml(task.project_name || 'No project')} • Today ${formatDuration(task.today_seconds)} • Total ${formatDuration(task.total_seconds)}</p>
            </div>
            <div class="task-actions">${actions.join('')}</div>
          </article>
        `;
      }).join('')}
    </section>
  `;
}

function renderTasks(content, payload, projects, goals) {
  const activeTasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  const doneToday = Array.isArray(payload.done_today_tasks) ? payload.done_today_tasks : [];
  const completed = Array.isArray(payload.completed_tasks) ? payload.completed_tasks : [];
  const projectOptions = [{ id: '', name: 'No project' }].concat(Array.isArray(projects.projects) ? projects.projects : []);
  const goalOptions = [{ id: '', name: 'No goal' }].concat(Array.isArray(goals.goals) ? goals.goals : []);

  content.innerHTML = `
    <div class="app-panel">
      <div class="app-panel-header">
        <h3>Tasks</h3>
        <p>Task workflows fully running in PWA.</p>
      </div>

      <form class="task-create-form" id="task-create-form">
        <input type="text" id="task-name" placeholder="Task name" required />
        <select id="task-project">
          ${projectOptions.map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join('')}
        </select>
        <select id="task-goal">
          ${goalOptions.map((goal) => `<option value="${goal.id}">${escapeHtml(goal.name)}</option>`).join('')}
        </select>
        <select id="task-priority">
          <option value="low">Low</option>
          <option value="medium" selected>Medium</option>
          <option value="high">High</option>
        </select>
        <button class="btn btn-primary" type="submit">Add Task</button>
      </form>

      ${taskGroupMarkup('Active Tasks', activeTasks, 'active')}
      ${taskGroupMarkup('Done Today', doneToday, 'doneToday')}
      ${taskGroupMarkup('Completed Tasks', completed, 'completed')}
    </div>
  `;
}

async function bindTaskActions(container, currentPath) {
  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  const form = content.querySelector('#task-create-form');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const nameInput = content.querySelector('#task-name');
      const projectInput = content.querySelector('#task-project');
      const goalInput = content.querySelector('#task-goal');
      const priorityInput = content.querySelector('#task-priority');

      const name = nameInput.value.trim();
      if (!name) return;

      try {
        await appApi.createTask({
          name,
          project_id: projectInput.value || null,
          label_ids: [],
          goal_id: goalInput.value || null,
          priority: priorityInput.value || 'medium'
        });
        showToast('Task created', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to create task', 'error');
      }
    });
  }

  content.querySelectorAll('[data-action][data-task-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const taskId = button.dataset.taskId;
      const action = button.dataset.action;
      try {
        if (action === 'start') await appApi.startTask(taskId);
        if (action === 'stop') await appApi.stopTask(taskId);
        if (action === 'done') await appApi.setTaskDailyCheck(taskId);
        if (action === 'complete') await appApi.completeTask(taskId);
        if (action === 'reopen') await appApi.reopenTask(taskId);
        if (action === 'delete') await appApi.deleteTask(taskId);
        showToast('Task updated', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to update task', 'error');
      }
    });
  });
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

function renderTimer(content, payload) {
  const groups = Array.isArray(payload.timer_list_groups) ? payload.timer_list_groups : [];

  content.innerHTML = `
    <div class="app-panel">
      <div class="app-panel-header">
        <h3>Timer</h3>
        <p>Focus tracking, daily target, and recent sessions.</p>
      </div>

      <div class="stats-grid">
        <article class="stat-card"><h4>Today</h4><p>${formatDuration(payload.today_total_seconds)}</p></article>
        <article class="stat-card"><h4>Target</h4><p>${formatDuration(payload.today_target_seconds)}</p></article>
        <article class="stat-card"><h4>Week</h4><p>${formatDuration(payload.week_total_seconds)}</p></article>
        <article class="stat-card"><h4>Range</h4><p>${escapeHtml(payload.timer_range_start)} → ${escapeHtml(payload.timer_range_end)}</p></article>
      </div>

      <form id="daily-target-form" class="inline-actions-form">
        <input id="daily-target-seconds" type="number" min="1" step="300" placeholder="Target seconds" value="${Number(payload.today_target_seconds || 0)}" required />
        <button class="btn btn-secondary" type="submit">Save Daily Target</button>
      </form>

      <form id="timer-quick-task-form" class="task-create-form">
        <input id="timer-task-name" type="text" placeholder="Quick task" required />
        <select id="timer-task-project">
          <option value="">No project</option>
          ${(Array.isArray(payload.projects) ? payload.projects : []).map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join('')}
        </select>
        <select id="timer-task-priority">
          <option value="low">Low</option>
          <option value="medium" selected>Medium</option>
          <option value="high">High</option>
        </select>
        <button class="btn btn-primary" type="submit">Add Task</button>
      </form>

      <div class="event-list">
        ${groups.length === 0 ? '<p class="muted">No timer entries in this range.</p>' : ''}
        ${groups.map((group) => `
          <article class="group-card">
            <header class="group-card-header">
              <h5>${escapeHtml(group.label)}</h5>
              <span>${formatDuration(group.total_seconds)}</span>
            </header>
            ${(Array.isArray(group.tasks) ? group.tasks : []).map((task) => `
              <div class="event-item">
                <div>
                  <h5>${escapeHtml(task.task_name)}</h5>
                  <p>${escapeHtml(task.project_name || 'No project')} • ${formatDuration(task.total_seconds)} • ${(Array.isArray(task.entries) ? task.entries.length : 0)} sessions</p>
                </div>
                <div class="task-actions">
                  ${task.is_running
                    ? `<button data-action="stop" data-task-id="${task.task_id}" type="button">Stop</button>`
                    : `<button data-action="start" data-task-id="${task.task_id}" type="button">Start</button>`}
                </div>
              </div>
            `).join('')}
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

async function bindTimerActions(container, currentPath) {
  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  const targetForm = content.querySelector('#daily-target-form');
  if (targetForm) {
    targetForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const value = Number(content.querySelector('#daily-target-seconds').value || 0);
      if (!value) return;
      try {
        await appApi.setDailyTarget(value);
        showToast('Daily target updated', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to update target', 'error');
      }
    });
  }

  const quickForm = content.querySelector('#timer-quick-task-form');
  if (quickForm) {
    quickForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = content.querySelector('#timer-task-name').value.trim();
      const projectId = content.querySelector('#timer-task-project').value || null;
      const priority = content.querySelector('#timer-task-priority').value || 'medium';
      if (!name) return;

      try {
        await appApi.createTask({ name, project_id: projectId, label_ids: [], goal_id: null, priority });
        showToast('Task created', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to create task', 'error');
      }
    });
  }

  content.querySelectorAll('[data-action][data-task-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const taskId = button.dataset.taskId;
      try {
        if (button.dataset.action === 'start') await appApi.startTask(taskId);
        if (button.dataset.action === 'stop') await appApi.stopTask(taskId);
        showToast('Timer task updated', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to update timer task', 'error');
      }
    });
  });
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
      const [tasks, projects, goals] = await Promise.all([
        appApi.getTasks(),
        appApi.getProjects().catch(() => ({ projects: [] })),
        appApi.getGoals().catch(() => ({ goals: [] }))
      ]);
      renderTasks(content, tasks, projects, goals);
      await bindTaskActions(container, currentPath);
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
      const payload = await appApi.getTimerDashboard();
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
