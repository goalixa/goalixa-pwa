/**
 * App View Module
 * Progressive extraction of app UI into the PWA.
 *
 * Migrated sections render natively in PWA.
 * Non-migrated sections keep a legacy iframe fallback.
 */

import { appApi } from '../api.js';
import { getCurrentUser, logout } from '../auth.js';
import { showToast } from '../utils.js';
import { navigate } from '../router.js';

const MIGRATED_SECTIONS = new Set(['overview', 'tasks', 'projects', 'reports', 'timer', 'calendar']);

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview', icon: 'fa-chart-line', migrated: true },
  { key: 'tasks', label: 'Tasks', icon: 'fa-list-check', migrated: true },
  { key: 'projects', label: 'Projects', icon: 'fa-folder-tree', migrated: true },
  { key: 'reports', label: 'Reports', icon: 'fa-chart-pie', migrated: true },
  { key: 'timer', label: 'Timer', icon: 'fa-stopwatch', migrated: true },
  { key: 'calendar', label: 'Calendar', icon: 'fa-calendar-days', migrated: true },
  { key: 'goals', label: 'Goals', icon: 'fa-bullseye', migrated: false },
  { key: 'habits', label: 'Habits', icon: 'fa-repeat', migrated: false },
  { key: 'planner', label: 'Planner', icon: 'fa-compass', migrated: false },
  { key: 'account', label: 'Account', icon: 'fa-user-gear', migrated: false }
];

let appIframe = null;

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

function getNavMarkup(activeSection) {
  return NAV_ITEMS.map((item) => {
    const active = item.key === activeSection ? 'active' : '';
    const legacy = item.migrated ? '' : '<span class="legacy-chip">Legacy</span>';
    return `
      <button class="app-nav-btn ${active}" data-route="/app/${item.key}" type="button">
        <i class="fas ${item.icon}"></i>
        <span>${item.label}</span>
        ${legacy}
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
            <h2>Goalixa App</h2>
            <p>PWA-first workspace</p>
          </div>
        </div>
        <div class="app-user-actions">
          <span class="app-user-email">${escapeHtml(email)}</span>
          <button class="btn btn-secondary" data-action="open-legacy" type="button">
            Open Legacy App
          </button>
          <button class="btn btn-primary" data-action="logout" type="button">
            Logout
          </button>
        </div>
      </header>

      <div class="app-shell-main">
        <aside class="app-shell-nav">
          ${getNavMarkup(section)}
        </aside>
        <section class="app-shell-content" id="app-shell-content">
          <div class="app-panel loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading ${escapeHtml(section)}...</p>
          </div>
        </section>
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

  const openLegacyButton = container.querySelector('[data-action="open-legacy"]');
  if (openLegacyButton) {
    openLegacyButton.addEventListener('click', () => {
      window.open('https://app.goalixa.com/', '_blank', 'noopener,noreferrer');
    });
  }
}

function renderLegacyFallback(container, subPath) {
  container.innerHTML = `
    <div class="app-view legacy-fallback">
      <div class="legacy-banner">
        <i class="fas fa-circle-info"></i>
        <span>This section is still running on the legacy app and has not been migrated to PWA yet.</span>
      </div>
      <iframe
        id="app-iframe"
        src="https://app.goalixa.com${subPath}"
        frameborder="0"
        allow="clipboard-read; clipboard-write"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
      ></iframe>
    </div>
  `;
  appIframe = container.querySelector('#app-iframe');
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

function renderOverview(content, overview, tasksPayload) {
  const recentTasks = Array.isArray(tasksPayload.tasks) ? tasksPayload.tasks.slice(0, 8) : [];

  content.innerHTML = `
    <div class="app-panel">
      <div class="app-panel-header">
        <h3>Overview</h3>
        <p>Native PWA dashboard sourced from backend APIs.</p>
      </div>

      <div class="stats-grid">
        <article class="stat-card">
          <h4>Active Tasks</h4>
          <p>${overview.active_tasks_count}</p>
        </article>
        <article class="stat-card">
          <h4>Completed</h4>
          <p>${overview.completed_tasks_count}</p>
        </article>
        <article class="stat-card">
          <h4>Done Today</h4>
          <p>${overview.done_today_count}</p>
        </article>
        <article class="stat-card">
          <h4>Tracked Time</h4>
          <p>${formatDuration(overview.total_tracked_seconds)}</p>
        </article>
        <article class="stat-card">
          <h4>Projects</h4>
          <p>${overview.projects_count}</p>
        </article>
      </div>

      <div class="task-list-block">
        <h4>Recent Active Tasks</h4>
        ${recentTasks.length === 0 ? '<p class="muted">No active tasks yet.</p>' : ''}
        ${recentTasks.map((task) => `
          <article class="task-item compact">
            <div>
              <h5>${escapeHtml(task.name)}</h5>
              <p>${escapeHtml(task.project_name || 'No project')} • ${formatDuration(task.today_seconds)}</p>
            </div>
            <span class="task-state ${task.is_running ? 'running' : 'idle'}">
              ${task.is_running ? 'Running' : 'Idle'}
            </span>
          </article>
        `).join('')}
      </div>
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
          if (task.is_running) {
            actions.push(`<button data-action="stop" data-task-id="${task.id}" type="button">Stop</button>`);
          } else {
            actions.push(`<button data-action="start" data-task-id="${task.id}" type="button">Start</button>`);
          }
          actions.push(`<button data-action="done" data-task-id="${task.id}" type="button">Done</button>`);
          actions.push(`<button data-action="complete" data-task-id="${task.id}" type="button">Complete</button>`);
        } else if (groupKey === 'doneToday') {
          actions.push(`<button data-action="reopen" data-task-id="${task.id}" type="button">Reopen</button>`);
        } else if (groupKey === 'completed') {
          actions.push(`<button data-action="reopen" data-task-id="${task.id}" type="button">Reopen</button>`);
        }

        actions.push(`<button data-action="delete" data-task-id="${task.id}" class="danger" type="button">Delete</button>`);

        return `
          <article class="task-item">
            <div class="task-info">
              <h5>${escapeHtml(task.name)}</h5>
              <p>${escapeHtml(task.project_name || 'No project')} • Today ${formatDuration(task.today_seconds)} • Total ${formatDuration(task.total_seconds)}</p>
            </div>
            <div class="task-actions">
              ${actions.join('')}
            </div>
          </article>
        `;
      }).join('')}
    </section>
  `;
}

function renderTasks(content, payload, projects) {
  const activeTasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  const doneToday = Array.isArray(payload.done_today_tasks) ? payload.done_today_tasks : [];
  const completed = Array.isArray(payload.completed_tasks) ? payload.completed_tasks : [];
  const projectOptions = [{ id: '', name: 'No project' }].concat(Array.isArray(projects.projects) ? projects.projects : []);

  content.innerHTML = `
    <div class="app-panel">
      <div class="app-panel-header">
        <h3>Tasks</h3>
        <p>Core task workflows now run directly inside PWA.</p>
      </div>

      <form class="task-create-form" id="task-create-form">
        <input type="text" id="task-name" placeholder="Task name" required />
        <select id="task-project">
          ${projectOptions.map((project) => `
            <option value="${project.id}">${escapeHtml(project.name)}</option>
          `).join('')}
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

function renderProjects(content, projects) {
  const projectList = Array.isArray(projects.projects) ? projects.projects : [];

  content.innerHTML = `
    <div class="app-panel">
      <div class="app-panel-header">
        <h3>Projects</h3>
        <p>Manage project list from PWA.</p>
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

function renderTimerEntries(content, entries, title) {
  const events = Array.isArray(entries.events) ? entries.events : [];

  content.innerHTML = `
    <div class="app-panel">
      <div class="app-panel-header">
        <h3>${escapeHtml(title)}</h3>
        <p>Recent time entries from app backend.</p>
      </div>

      <div class="event-list">
        ${events.length === 0 ? '<p class="muted">No entries available for selected range.</p>' : ''}
        ${events.map((event) => `
          <article class="event-item">
            <h5>${escapeHtml(event.title || event.name || 'Time Entry')}</h5>
            <p>${formatDateTime(event.start)} → ${formatDateTime(event.end)}</p>
          </article>
        `).join('')}
      </div>
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

async function bindTaskActions(container) {
  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  const form = content.querySelector('#task-create-form');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const nameInput = content.querySelector('#task-name');
      const projectInput = content.querySelector('#task-project');
      const priorityInput = content.querySelector('#task-priority');

      const name = nameInput.value.trim();
      if (!name) return;

      try {
        await appApi.createTask({
          name,
          project_id: projectInput.value || null,
          label_ids: [],
          goal_id: null,
          priority: priorityInput.value || 'medium'
        });
        showToast('Task created', 'success');
        await render(container, '/app/tasks', {});
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
        await render(container, '/app/tasks', {});
      } catch (error) {
        showToast(error.message || 'Failed to update task', 'error');
      }
    });
  });
}

async function bindProjectActions(container) {
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
        await render(container, '/app/projects', {});
      } catch (error) {
        showToast(error.message || 'Failed to create project', 'error');
      }
    });
  }

  content.querySelectorAll('[data-action="delete-project"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const projectId = button.dataset.projectId;
      try {
        await appApi.deleteProject(projectId);
        showToast('Project deleted', 'success');
        await render(container, '/app/projects', {});
      } catch (error) {
        showToast(error.message || 'Failed to delete project', 'error');
      }
    });
  });
}

/**
 * Render app view
 */
export async function render(container, path, params) {
  const { section, subPath } = resolveSection(path);

  if (!MIGRATED_SECTIONS.has(section)) {
    renderLegacyFallback(container, subPath);
    return;
  }

  renderShell(container, section);
  const content = container.querySelector('#app-shell-content');

  if (!content) return;

  try {
    if (section === 'overview') {
      const [overview, tasks] = await Promise.all([appApi.getOverview(), appApi.getTasks()]);
      renderOverview(content, overview, tasks);
      return;
    }

    if (section === 'tasks') {
      const [tasks, projects] = await Promise.all([
        appApi.getTasks(),
        appApi.getProjects().catch(() => ({ projects: [] }))
      ]);
      renderTasks(content, tasks, projects);
      await bindTaskActions(container);
      return;
    }

    if (section === 'projects') {
      const projects = await appApi.getProjects();
      renderProjects(content, projects);
      await bindProjectActions(container);
      return;
    }

    if (section === 'reports') {
      const range = lastSevenDaysRange();
      const report = await appApi.getReportsSummary({ start: range.start, end: range.end, group: 'projects' });
      renderReports(content, report, range);
      return;
    }

    if (section === 'timer' || section === 'calendar') {
      const range = lastSevenDaysRange();
      const entries = await appApi.getTimerEntries({ start: range.startIso, end: range.endIso });
      renderTimerEntries(content, entries, section === 'calendar' ? 'Calendar Entries' : 'Timer Entries');
      return;
    }
  } catch (error) {
    renderError(content, error.message || 'Unknown error');
  }
}

/**
 * Send message to legacy iframe (if present)
 */
export function sendToIframe(type, data = {}) {
  if (appIframe && appIframe.contentWindow) {
    appIframe.contentWindow.postMessage({ type, data }, '*');
  }
}

export default {
  render,
  send: sendToIframe,
  name: 'app'
};
