/**
 * App View Module
 * Native PWA UI for all main app sections.
 */

import { appApi } from '../api.js';
import { getCurrentUser, logout } from '../auth.js';
import { showToast } from '../utils.js';
import { navigate } from '../router.js';
import { getTheme, toggleTheme } from '../theme.js';
import { bindTasksSection, clearTasksView, renderTasksSection } from './app/tasks-view.js';

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
let overviewViewCleanup = null;
let reportsViewCleanup = null;
let calendarViewCleanup = null;

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

function setThemeToggleState(button) {
  if (!button) return;
  const isDark = getTheme() === 'dark';
  button.innerHTML = `
    <i class="fas ${isDark ? 'fa-sun' : 'fa-moon'}"></i>
    <span>${isDark ? 'Light' : 'Dark'}</span>
  `;
  button.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
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
          <button class="btn btn-light app-theme-toggle" data-action="toggle-theme" type="button"></button>
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

  const themeButton = container.querySelector('[data-action="toggle-theme"]');
  if (themeButton) {
    setThemeToggleState(themeButton);
    themeButton.addEventListener('click', () => {
      toggleTheme();
      setThemeToggleState(themeButton);
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

function clearOverviewView() {
  if (typeof overviewViewCleanup === 'function') {
    overviewViewCleanup();
    overviewViewCleanup = null;
  }
}

function clearReportsView() {
  if (typeof reportsViewCleanup === 'function') {
    reportsViewCleanup();
    reportsViewCleanup = null;
  }
}

function clearCalendarView() {
  if (typeof calendarViewCleanup === 'function') {
    calendarViewCleanup();
    calendarViewCleanup = null;
  }
}

function isLocalhostRuntime() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function formatDurationAxis(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds || 0)));
  const hours = Math.floor(safe / 3600);
  if (hours > 0) {
    return `${hours}h`;
  }
  const minutes = Math.floor((safe % 3600) / 60);
  return `${minutes}m`;
}

function compactOverviewLabel(label, fallback) {
  const value = String(label || '').trim();
  if (!value) {
    return fallback;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.slice(5);
  }
  return value.length > 8 ? value.slice(0, 8) : value;
}

function normalizeOverviewSummary(summary) {
  const safe = Array.isArray(summary) ? summary : [];
  return safe.slice(0, 7).map((item, index) => {
    const seconds = Math.max(0, Number(item?.seconds || 0));
    const rawLabel = item?.label || item?.date || item?.day;
    return {
      seconds,
      label: compactOverviewLabel(rawLabel, `D${index + 1}`),
      fullLabel: String(rawLabel || `Day ${index + 1}`)
    };
  });
}

function renderOverviewTrendSvg(summary, mode = 'line') {
  const series = normalizeOverviewSummary(summary);
  if (!series.length) {
    return '<p class="muted">No activity yet.</p>';
  }

  const width = 760;
  const height = 220;
  const padLeft = 40;
  const padRight = 16;
  const padTop = 14;
  const padBottom = 34;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;
  const yMax = Math.max(1, ...series.map((point) => point.seconds));
  const baseY = padTop + chartHeight;

  const points = series.map((point, index) => {
    const ratioX = series.length > 1 ? index / (series.length - 1) : 0.5;
    const x = padLeft + (chartWidth * ratioX);
    const y = baseY - ((point.seconds / yMax) * chartHeight);
    return { ...point, x, y };
  });

  const gridRows = 4;
  const gridMarkup = Array.from({ length: gridRows + 1 }, (_, rowIndex) => {
    const ratio = rowIndex / gridRows;
    const y = padTop + (chartHeight * ratio);
    const value = yMax * (1 - ratio);
    return `
      <line class="trend-grid-line" x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}"></line>
      <text class="trend-grid-text" x="${padLeft - 8}" y="${y + 4}" text-anchor="end">${formatDurationAxis(value)}</text>
    `;
  }).join('');

  const xLabelsMarkup = points.map((point) => `
    <text class="trend-axis-label" x="${point.x}" y="${height - 10}" text-anchor="middle">${escapeHtml(point.label)}</text>
  `).join('');

  let seriesMarkup = '';
  if (mode === 'bar') {
    const barWidth = Math.max(14, Math.min(42, (chartWidth / points.length) * 0.56));
    seriesMarkup = points.map((point, index) => {
      const x = point.x - (barWidth / 2);
      const barHeight = Math.max(2, baseY - point.y);
      return `
        <rect class="trend-bar" x="${x}" y="${baseY - barHeight}" width="${barWidth}" height="${barHeight}">
          <title>${escapeHtml(series[index].fullLabel)}: ${formatDuration(point.seconds)}</title>
        </rect>
      `;
    }).join('');
  } else {
    const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`;
    const dotMarkup = points.map((point, index) => `
      <circle class="trend-dot" cx="${point.x}" cy="${point.y}" r="4">
        <title>${escapeHtml(series[index].fullLabel)}: ${formatDuration(point.seconds)}</title>
      </circle>
    `).join('');
    seriesMarkup = `
      <path class="trend-area" d="${areaPath}"></path>
      <path class="trend-line" d="${linePath}"></path>
      ${dotMarkup}
    `;
  }

  return `
    <svg class="overview-trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Focus trend chart">
      ${gridMarkup}
      ${seriesMarkup}
      ${xLabelsMarkup}
    </svg>
  `;
}

function getProjectDistributionRows(distribution) {
  const safe = Array.isArray(distribution) ? distribution : [];
  return safe
    .map((row, index) => ({
      name: String(row.name || row.project || row.label || '-'),
      seconds: Math.max(0, Number(row.total_seconds || row.seconds || 0)),
      color: `hsl(${(index * 47) % 360}, 78%, 45%)`
    }))
    .filter((row) => row.seconds > 0);
}

function renderProjectDonut(distribution) {
  const rows = getProjectDistributionRows(distribution);
  const total = rows.reduce((acc, row) => acc + row.seconds, 0);
  if (!rows.length || total <= 0) {
    return '<p class="muted">No tracked time yet.</p>';
  }

  let cursor = 0;
  const gradientStops = rows.map((row, index) => {
    const start = cursor;
    const ratio = (row.seconds / total) * 100;
    cursor += ratio;
    const end = index === rows.length - 1 ? 100 : cursor;
    return `${row.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });

  return `
    <div class="overview-donut-wrap">
      <div class="overview-donut-graph" style="background: conic-gradient(${gradientStops.join(', ')});">
        <div class="overview-donut-inner">${formatDuration(total)}</div>
      </div>
    </div>
  `;
}

function renderHabitStreakChart(habits) {
  const safe = Array.isArray(habits) ? habits : [];
  const ranked = safe
    .slice()
    .sort((left, right) => Number(right.streak || 0) - Number(left.streak || 0))
    .slice(0, 6);

  if (!ranked.length) {
    return '<p class="muted">No habits yet.</p>';
  }

  const maxStreak = Math.max(1, ...ranked.map((habit) => Number(habit.streak || 0)));
  return `
    <div class="overview-streak-chart" aria-label="Habit streak chart">
      ${ranked.map((habit) => {
        const streak = Math.max(0, Number(habit.streak || 0));
        const width = Math.min(100, (streak / maxStreak) * 100);
        return `
          <div class="overview-streak-row">
            <span class="overview-streak-label">${escapeHtml(habit.name || 'Habit')}</span>
            <div class="overview-streak-track">
              <span class="overview-streak-fill" style="width: ${width.toFixed(2)}%;"></span>
            </div>
            <span class="overview-streak-value">${streak}d</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function bindOverviewCharts(content, summary) {
  clearOverviewView();

  const trendHost = content.querySelector('[data-overview-trend-canvas]');
  const modeButtons = content.querySelectorAll('[data-overview-mode]');
  if (!trendHost) {
    return;
  }

  const abortController = new AbortController();
  const { signal } = abortController;
  let mode = 'line';

  const paintTrend = () => {
    trendHost.innerHTML = renderOverviewTrendSvg(summary, mode);
  };

  paintTrend();

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const requestedMode = button.dataset.overviewMode;
      if (!requestedMode || (requestedMode !== 'line' && requestedMode !== 'bar')) return;
      mode = requestedMode;
      modeButtons.forEach((candidate) => {
        candidate.classList.toggle('is-active', candidate === button);
      });
      paintTrend();
    }, { signal });
  });

  overviewViewCleanup = () => {
    abortController.abort();
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
  const projectRows = getProjectDistributionRows(distribution);
  const topProjectRows = projectRows.slice(0, 4);
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
          <div class="overview-chart-toolbar">
            <span class="task-state running">${escapeHtml(range.start)} → ${escapeHtml(range.end)}</span>
            <div class="mode-switch">
              <button class="mode-button" type="button" data-overview-mode="bar">Bar</button>
              <button class="mode-button is-active" type="button" data-overview-mode="line">Line</button>
            </div>
          </div>
        </div>

        <div class="overview-trend-panel">
          <div class="overview-trend-canvas" data-overview-trend-canvas>
            ${renderOverviewTrendSvg(summary, 'line')}
          </div>
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
          ${projectRows.length === 0 ? '<p class="muted">No tracked time yet.</p>' : ''}
          ${projectRows.length ? renderProjectDonut(projectRows) : ''}
          <ul class="overview-list">
            ${topProjectRows.map((row) => `
              <li class="overview-list-item">
                <span class="overview-list-title">
                  <span class="overview-dot" style="--dot-color: ${row.color};"></span>
                  ${escapeHtml(row.name)}
                </span>
                <span class="overview-list-meta">${formatDuration(row.seconds)}</span>
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
          ${renderHabitStreakChart(habits)}
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

  bindOverviewCharts(content, summary);
}

function normalizeProjectLabels(labels) {
  if (!Array.isArray(labels)) return [];
  return labels
    .map((label) => {
      if (typeof label === 'string') {
        return { id: '', name: label, color: '#64748b' };
      }
      return {
        id: label?.id || '',
        name: label?.name || '',
        color: label?.color || '#64748b'
      };
    })
    .filter((label) => label.name);
}

function buildProjectsDashboardData(payload) {
  const projects = Array.isArray(payload?.projects?.projects) ? payload.projects.projects : [];
  const labels = Array.isArray(payload?.labels?.labels) ? payload.labels.labels : [];
  const tasksPayload = payload?.tasks || {};
  const report = payload?.reports || {};
  const allTasks = [
    ...(Array.isArray(tasksPayload.tasks) ? tasksPayload.tasks : []),
    ...(Array.isArray(tasksPayload.done_today_tasks) ? tasksPayload.done_today_tasks : []),
    ...(Array.isArray(tasksPayload.completed_tasks) ? tasksPayload.completed_tasks : [])
  ];

  const activeTaskCount = allTasks.filter((task) => String(task?.status || 'active').toLowerCase() !== 'completed').length;
  const focusByName = new Map();
  (Array.isArray(report.distribution) ? report.distribution : []).forEach((row) => {
    const name = String(row?.name || row?.project || row?.label || '').trim();
    if (!name) return;
    const seconds = Math.max(0, Number(row?.total_seconds || row?.seconds || 0));
    focusByName.set(name.toLowerCase(), seconds);
  });

  const tasksByProjectName = new Map();
  allTasks.forEach((task) => {
    const projectName = String(task?.project_name || '').trim();
    if (!projectName) return;
    const key = projectName.toLowerCase();
    const prev = tasksByProjectName.get(key) || { total: 0, active: 0 };
    prev.total += 1;
    if (String(task?.status || 'active').toLowerCase() !== 'completed') {
      prev.active += 1;
    }
    tasksByProjectName.set(key, prev);
  });

  const rows = projects.map((project) => {
    const name = String(project?.name || 'Untitled');
    const key = name.toLowerCase();
    const taskStats = tasksByProjectName.get(key) || { total: 0, active: 0 };
    const projectLabels = normalizeProjectLabels(project?.labels);
    return {
      id: project?.id,
      name,
      labels: projectLabels,
      labelsCount: projectLabels.length,
      tasksCount: taskStats.total,
      activeTasksCount: taskStats.active,
      focusSeconds: Math.max(0, Number(focusByName.get(key) || 0))
    };
  });

  const focusTotal = Math.max(
    0,
    Number(report.total_seconds || rows.reduce((acc, row) => acc + row.focusSeconds, 0))
  );

  return {
    rows,
    labels: normalizeProjectLabels(labels),
    stats: {
      totalProjects: rows.length,
      activeTaskCount,
      totalFocusSeconds: focusTotal,
      labelCount: labels.length
    }
  };
}

function sortProjectRows(rows, mode) {
  const safe = Array.isArray(rows) ? rows.slice() : [];
  return safe.sort((left, right) => {
    if (mode === 'name-asc') {
      return String(left.name || '').localeCompare(String(right.name || ''));
    }
    if (mode === 'name-desc') {
      return String(right.name || '').localeCompare(String(left.name || ''));
    }
    if (mode === 'tasks-desc') {
      return Number(right.activeTasksCount || 0) - Number(left.activeTasksCount || 0);
    }
    return Number(right.focusSeconds || 0) - Number(left.focusSeconds || 0);
  });
}

function projectLabelChips(labels) {
  const safeLabels = normalizeProjectLabels(labels);
  if (!safeLabels.length) {
    return '<span class="project-label-empty">No labels</span>';
  }
  return safeLabels.map((label) => `
    <span class="project-label-chip">
      <span class="project-label-dot" style="background-color: ${escapeHtml(label.color)};"></span>
      ${escapeHtml(label.name)}
    </span>
  `).join('');
}

function projectRowMarkup(project) {
  return `
    <article class="project-row" data-project-id="${project.id}">
      <div class="project-row-top">
        <div class="project-row-head">
          <h4>${escapeHtml(project.name)}</h4>
          <span class="task-state ${project.activeTasksCount > 0 ? 'running' : 'idle'}">${project.activeTasksCount} active</span>
        </div>
        <div class="project-row-metrics">
          <span>${project.tasksCount} tasks</span>
          <span>${project.labelsCount} labels</span>
          <span>${formatDuration(project.focusSeconds)}</span>
        </div>
      </div>
      <div class="project-row-bottom">
        <div class="project-label-list">
          ${projectLabelChips(project.labels)}
        </div>
        <div class="project-row-actions">
          <button class="btn btn-outline-secondary btn-sm" data-action="project-open-tasks" data-project-id="${project.id}" type="button">Tasks</button>
          <button class="btn btn-outline-danger btn-sm danger" data-action="delete-project" data-project-id="${project.id}" type="button">Delete</button>
        </div>
      </div>
    </article>
  `;
}

function renderProjectList(rows, query, mode) {
  const term = String(query || '').trim().toLowerCase();
  const filtered = sortProjectRows(rows, mode).filter((project) => {
    if (!term) return true;
    const inName = String(project.name || '').toLowerCase().includes(term);
    const inLabels = project.labels.some((label) => String(label.name || '').toLowerCase().includes(term));
    return inName || inLabels;
  });

  if (!filtered.length) {
    return '<p class="muted">No matching projects.</p>';
  }
  return filtered.map((project) => projectRowMarkup(project)).join('');
}

function renderProjects(content, payload) {
  const data = buildProjectsDashboardData(payload);
  const rows = sortProjectRows(data.rows, 'focus-desc');

  content.innerHTML = `
    <div class="projects-page">
      <section class="projects-hero">
        <article class="project-stat-card">
          <span class="project-stat-label">Total projects</span>
          <span class="project-stat-value">${data.stats.totalProjects}</span>
          <span class="project-stat-meta">Active workstreams</span>
        </article>
        <article class="project-stat-card">
          <span class="project-stat-label">Open tasks</span>
          <span class="project-stat-value">${data.stats.activeTaskCount}</span>
          <span class="project-stat-meta">Across all projects</span>
        </article>
        <article class="project-stat-card">
          <span class="project-stat-label">Focus logged</span>
          <span class="project-stat-value">${formatDuration(data.stats.totalFocusSeconds)}</span>
          <span class="project-stat-meta">For selected report window</span>
        </article>
        <article class="project-stat-card">
          <span class="project-stat-label">Labels in use</span>
          <span class="project-stat-value">${data.stats.labelCount}</span>
          <span class="project-stat-meta">Available tags</span>
        </article>
      </section>

      <section class="app-panel projects-card">
        <div class="projects-card-header">
          <div>
            <p class="goals-label">Create</p>
            <h3 class="goals-title">New project</h3>
          </div>
        </div>
        <form class="project-form" id="project-create-form">
          <input type="text" id="project-name" placeholder="Project name" required />
          <select id="project-labels" multiple ${data.labels.length ? '' : 'disabled'}>
            ${data.labels.map((label) => `
              <option value="${label.id}">${escapeHtml(label.name)}</option>
            `).join('')}
          </select>
          <button class="btn btn-primary" type="submit">Create</button>
        </form>
      </section>

      <section class="app-panel projects-card">
        <div class="projects-card-header">
          <div>
            <p class="goals-label">Workspace</p>
            <h3 class="goals-title">Project list</h3>
          </div>
        </div>

        <div class="projects-toolbar">
          <input id="project-search" type="search" placeholder="Search projects or labels..." />
          <select id="project-sort">
            <option value="focus-desc" selected>Most focus time</option>
            <option value="tasks-desc">Most active tasks</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
          </select>
        </div>

        <div class="project-list-lite" id="project-list-lite">
          ${rows.length ? rows.map((project) => projectRowMarkup(project)).join('') : '<p class="muted">No projects yet.</p>'}
        </div>
      </section>
    </div>
  `;
}

async function bindProjectActions(container, currentPath, initialPayload) {
  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  const data = buildProjectsDashboardData(initialPayload);
  const projectList = content.querySelector('#project-list-lite');
  const searchInput = content.querySelector('#project-search');
  const sortInput = content.querySelector('#project-sort');

  const repaintProjectList = () => {
    if (!projectList) return;
    const query = searchInput ? searchInput.value : '';
    const mode = sortInput ? sortInput.value : 'focus-desc';
    projectList.innerHTML = renderProjectList(data.rows, query, mode);
  };

  searchInput?.addEventListener('input', repaintProjectList);
  sortInput?.addEventListener('change', repaintProjectList);

  const form = content.querySelector('#project-create-form');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const nameInput = content.querySelector('#project-name');
      const labelsInput = content.querySelector('#project-labels');
      const name = nameInput ? nameInput.value.trim() : '';
      if (!name) return;

      const labelIds = labelsInput instanceof HTMLSelectElement
        ? Array.from(labelsInput.selectedOptions).map((option) => option.value).filter(Boolean)
        : [];

      try {
        await appApi.createProject(name, labelIds);
        showToast('Project created', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to create project', 'error');
      }
    });
  }

  content.addEventListener('click', async (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;

    const actionButton = target.closest('button[data-action][data-project-id]');
    if (!actionButton) return;
    const action = actionButton.dataset.action;
    const projectId = actionButton.dataset.projectId;
    if (!action || !projectId) return;

    if (action === 'project-open-tasks') {
      navigate('/app/tasks');
      return;
    }

    if (action !== 'delete-project') return;

    if (!window.confirm('Delete this project?')) {
      return;
    }

    actionButton.disabled = true;
    try {
      await appApi.deleteProject(projectId);
      showToast('Project deleted', 'success');
      await render(container, currentPath, {});
    } catch (error) {
      showToast(error.message || 'Failed to delete project', 'error');
    } finally {
      actionButton.disabled = false;
    }
  });
}

function normalizeReportSummary(summary) {
  const safe = Array.isArray(summary) ? summary : [];
  return safe.slice(0, 14).map((item, index) => {
    const seconds = Math.max(0, Number(item?.seconds || 0));
    const rawLabel = item?.label || item?.date || item?.day;
    return {
      seconds,
      label: compactOverviewLabel(rawLabel, `D${index + 1}`),
      fullLabel: String(rawLabel || `Day ${index + 1}`)
    };
  });
}

function normalizeReportDistribution(distribution) {
  const safe = Array.isArray(distribution) ? distribution : [];
  return safe
    .map((row, index) => ({
      name: String(row?.name || row?.project || row?.label || row?.task || '-'),
      seconds: Math.max(0, Number(row?.total_seconds || row?.seconds || 0)),
      color: `hsl(${(index * 47) % 360}, 78%, 45%)`
    }))
    .filter((row) => row.seconds > 0);
}

function renderReportsTrendSvg(summaryRows, mode = 'line') {
  if (!summaryRows.length) {
    return '<p class="muted">No activity yet.</p>';
  }

  const width = 780;
  const height = 230;
  const padLeft = 40;
  const padRight = 16;
  const padTop = 14;
  const padBottom = 34;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;
  const yMax = Math.max(1, ...summaryRows.map((point) => point.seconds));
  const baseY = padTop + chartHeight;
  const points = summaryRows.map((point, index) => {
    const ratioX = summaryRows.length > 1 ? index / (summaryRows.length - 1) : 0.5;
    return {
      ...point,
      x: padLeft + (chartWidth * ratioX),
      y: baseY - ((point.seconds / yMax) * chartHeight)
    };
  });

  const gridMarkup = Array.from({ length: 5 }, (_, rowIndex) => {
    const ratio = rowIndex / 4;
    const y = padTop + (chartHeight * ratio);
    const value = yMax * (1 - ratio);
    return `
      <line class="reports-grid-line" x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}"></line>
      <text class="reports-grid-text" x="${padLeft - 8}" y="${y + 4}" text-anchor="end">${formatDurationAxis(value)}</text>
    `;
  }).join('');

  const xLabelsMarkup = points.map((point) => `
    <text class="reports-axis-label" x="${point.x}" y="${height - 10}" text-anchor="middle">${escapeHtml(point.label)}</text>
  `).join('');

  let seriesMarkup = '';
  if (mode === 'bar') {
    const barWidth = Math.max(12, Math.min(30, (chartWidth / points.length) * 0.58));
    seriesMarkup = points.map((point, index) => {
      const x = point.x - (barWidth / 2);
      const barHeight = Math.max(2, baseY - point.y);
      return `
        <rect class="reports-bar" x="${x}" y="${baseY - barHeight}" width="${barWidth}" height="${barHeight}">
          <title>${escapeHtml(summaryRows[index].fullLabel)}: ${formatDuration(point.seconds)}</title>
        </rect>
      `;
    }).join('');
  } else {
    const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`;
    const dots = points.map((point, index) => `
      <circle class="reports-dot" cx="${point.x}" cy="${point.y}" r="4">
        <title>${escapeHtml(summaryRows[index].fullLabel)}: ${formatDuration(point.seconds)}</title>
      </circle>
    `).join('');
    seriesMarkup = `
      <path class="reports-area" d="${areaPath}"></path>
      <path class="reports-line" d="${linePath}"></path>
      ${dots}
    `;
  }

  return `
    <svg class="reports-trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Reports trend chart">
      ${gridMarkup}
      ${seriesMarkup}
      ${xLabelsMarkup}
    </svg>
  `;
}

function renderReportsDonut(rows, totalSeconds) {
  if (!rows.length) {
    return '<p class="muted">No distribution data.</p>';
  }

  const total = Math.max(
    0,
    Number(totalSeconds || rows.reduce((acc, row) => acc + Number(row.seconds || 0), 0))
  );
  if (!total) {
    return '<p class="muted">No distribution data.</p>';
  }

  let cursor = 0;
  const gradientStops = rows.map((row, index) => {
    const start = cursor;
    const ratio = (row.seconds / total) * 100;
    cursor += ratio;
    const end = index === rows.length - 1 ? 100 : cursor;
    return `${row.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });

  return `
    <div class="reports-donut-wrap">
      <div class="reports-donut-graph" style="background: conic-gradient(${gradientStops.join(', ')});">
        <div class="reports-donut-inner">${formatDuration(total)}</div>
      </div>
    </div>
  `;
}

function renderReportsDistributionList(rows) {
  if (!rows.length) {
    return '<p class="muted">No distribution data.</p>';
  }
  return rows.slice(0, 6).map((row) => `
    <li class="overview-list-item">
      <span class="overview-list-title">
        <span class="overview-dot" style="--dot-color: ${row.color};"></span>
        ${escapeHtml(row.name)}
      </span>
      <span class="overview-list-meta">${formatDuration(row.seconds)}</span>
    </li>
  `).join('');
}

function renderReportsDistributionTable(rows) {
  if (!rows.length) {
    return '<p class="muted">No report data for this period.</p>';
  }

  return `
    <table class="report-table">
      <thead>
        <tr><th>Name</th><th>Seconds</th><th>Duration</th></tr>
      </thead>
      <tbody>
        ${rows.slice(0, 12).map((row) => `
          <tr>
            <td>${escapeHtml(row.name)}</td>
            <td>${row.seconds}</td>
            <td>${formatDuration(row.seconds)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function paintReportsView(content, state) {
  const summaryRows = normalizeReportSummary(state.report?.summary);
  const distributionRows = normalizeReportDistribution(state.report?.distribution);
  const totalFromSummary = summaryRows.reduce((acc, row) => acc + row.seconds, 0);
  const totalSeconds = Math.max(0, Number(state.report?.total_seconds || totalFromSummary));
  const avgDailySeconds = summaryRows.length
    ? Math.round(totalSeconds / summaryRows.length)
    : 0;
  const topCategory = distributionRows[0] || null;
  const busiestDay = summaryRows.length
    ? summaryRows.slice().sort((left, right) => right.seconds - left.seconds)[0]
    : null;

  const trendHost = content.querySelector('[data-reports-trend]');
  const donutHost = content.querySelector('[data-reports-donut]');
  const listHost = content.querySelector('[data-reports-list]');
  const tableHost = content.querySelector('[data-reports-table]');

  if (trendHost) {
    trendHost.innerHTML = renderReportsTrendSvg(summaryRows, state.mode);
  }
  if (donutHost) {
    donutHost.innerHTML = renderReportsDonut(distributionRows, totalSeconds);
  }
  if (listHost) {
    listHost.innerHTML = renderReportsDistributionList(distributionRows);
  }
  if (tableHost) {
    tableHost.innerHTML = renderReportsDistributionTable(distributionRows);
  }

  const totalEl = content.querySelector('#reports-total-focus');
  if (totalEl) totalEl.textContent = formatDuration(totalSeconds);
  const avgEl = content.querySelector('#reports-avg-daily');
  if (avgEl) avgEl.textContent = formatDuration(avgDailySeconds);
  const categoriesEl = content.querySelector('#reports-categories');
  if (categoriesEl) categoriesEl.textContent = String(distributionRows.length);
  const topEl = content.querySelector('#reports-top');
  if (topEl) topEl.textContent = topCategory ? topCategory.name : '-';
  const busiestEl = content.querySelector('#reports-busiest-day');
  if (busiestEl) busiestEl.textContent = busiestDay ? `${busiestDay.fullLabel} (${formatDuration(busiestDay.seconds)})` : '-';
  const topCategoryEl = content.querySelector('#reports-top-category');
  if (topCategoryEl) topCategoryEl.textContent = topCategory ? `${topCategory.name} (${formatDuration(topCategory.seconds)})` : '-';
}

function renderReports(content, report, range) {
  content.innerHTML = `
    <div class="reports-page">
      <section class="reports-metrics">
        <article class="project-stat-card">
          <span class="project-stat-label">Total focus</span>
          <span class="project-stat-value" id="reports-total-focus">0m</span>
          <span class="project-stat-meta">For selected range</span>
        </article>
        <article class="project-stat-card">
          <span class="project-stat-label">Average daily</span>
          <span class="project-stat-value" id="reports-avg-daily">0m</span>
          <span class="project-stat-meta">Based on summary points</span>
        </article>
        <article class="project-stat-card">
          <span class="project-stat-label">Categories</span>
          <span class="project-stat-value" id="reports-categories">0</span>
          <span class="project-stat-meta">Tracked entries</span>
        </article>
        <article class="project-stat-card">
          <span class="project-stat-label">Top category</span>
          <span class="project-stat-value" id="reports-top">-</span>
          <span class="project-stat-meta">${escapeHtml(range.start)} - ${escapeHtml(range.end)}</span>
        </article>
      </section>

      <section class="reports-duo">
        <article class="app-panel reports-chart-card">
          <div class="overview-card-header">
            <div>
              <p class="goals-label">Summary</p>
              <h3 class="goals-title">Time overview</h3>
            </div>
            <div class="mode-switch">
              <button class="mode-button" type="button" data-reports-mode="bar">Bar</button>
              <button class="mode-button is-active" type="button" data-reports-mode="line">Line</button>
            </div>
          </div>
          <div class="reports-trend-host" data-reports-trend></div>
        </article>

        <article class="app-panel reports-distribution-card">
          <div class="overview-card-header">
            <div>
              <p class="goals-label">Distribution</p>
              <h3 class="goals-title">Breakdown</h3>
            </div>
            <select id="reports-group-select">
              <option value="projects" selected>Projects</option>
              <option value="labels">Labels</option>
              <option value="tasks">Tasks</option>
            </select>
          </div>
          <div data-reports-donut></div>
          <ul class="overview-list reports-distribution-list" data-reports-list></ul>
        </article>
      </section>

      <section class="reports-insights-grid">
        <article class="app-panel reports-insight-card">
          <h3>Busiest day</h3>
          <p class="reports-insight-text" id="reports-busiest-day">-</p>
        </article>
        <article class="app-panel reports-insight-card">
          <h3>Top category details</h3>
          <p class="reports-insight-text" id="reports-top-category">-</p>
        </article>
      </section>

      <section class="app-panel report-table-wrap">
        <div class="app-panel-header">
          <h3>Top distribution</h3>
          <p>Grouped totals for current filter.</p>
        </div>
        <div data-reports-table></div>
      </section>
    </div>
  `;

  paintReportsView(content, {
    report,
    mode: 'line'
  });
}

async function bindReportsActions(container, range, initialReport) {
  clearReportsView();

  const content = container.querySelector('#app-shell-content');
  if (!content) return;
  const root = content.querySelector('.reports-page');
  if (!root) return;

  const abortController = new AbortController();
  const { signal } = abortController;
  let requestToken = 0;
  const state = {
    mode: 'line',
    group: 'projects',
    report: initialReport || { summary: [], distribution: [], total_seconds: 0 }
  };

  const modeButtons = content.querySelectorAll('[data-reports-mode]');
  const groupSelect = content.querySelector('#reports-group-select');

  const repaint = () => {
    paintReportsView(content, state);
  };

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextMode = button.dataset.reportsMode;
      if (!nextMode || (nextMode !== 'line' && nextMode !== 'bar')) return;
      state.mode = nextMode;
      modeButtons.forEach((candidate) => {
        candidate.classList.toggle('is-active', candidate === button);
      });
      repaint();
    }, { signal });
  });

  if (groupSelect) {
    groupSelect.addEventListener('change', async () => {
      const requestedGroup = groupSelect.value || 'projects';
      const previousGroup = state.group;
      const token = ++requestToken;
      state.group = requestedGroup;
      groupSelect.disabled = true;
      try {
        const report = await appApi.getReportsSummary({
          start: range.start,
          end: range.end,
          group: requestedGroup
        });
        if (signal.aborted || token !== requestToken) return;
        state.report = report;
        repaint();
      } catch (error) {
        if (!signal.aborted) {
          showToast(error.message || 'Failed to load grouped report', 'error');
          state.group = previousGroup;
          groupSelect.value = previousGroup;
        }
      } finally {
        if (!signal.aborted) {
          groupSelect.disabled = false;
        }
      }
    }, { signal });
  }

  reportsViewCleanup = () => {
    abortController.abort();
  };
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

function buildCalendarDemoPayload() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mondayOffset = (today.getDay() + 6) % 7;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - mondayOffset);

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + index);
    const dayShort = dayDate.toLocaleDateString(undefined, { weekday: 'short' });
    const dateShort = dayDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const full = dayDate.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const dayStamp = dayDate.toDateString();
    return {
      day: dayShort,
      date: dateShort,
      full,
      is_today: dayStamp === today.toDateString(),
      is_future: dayDate.getTime() > today.getTime()
    };
  });

  return {
    week_days: weekDays,
    task_rows: [
      {
        id: 'demo-task-1',
        name: 'Ship PWA auth hardening',
        project_id: 'proj-foundation',
        project_name: 'Foundation',
        week_checks: [true, true, false, true, false, false, false]
      },
      {
        id: 'demo-task-2',
        name: 'Migrate dashboard widgets',
        project_id: 'proj-frontend',
        project_name: 'Frontend',
        week_checks: [true, false, true, false, false, false, false]
      },
      {
        id: 'demo-task-3',
        name: 'BFF API contract review',
        project_id: 'proj-platform',
        project_name: 'Platform',
        week_checks: [false, true, true, false, false, false, false]
      }
    ],
    habit_rows: [
      {
        id: 'demo-habit-1',
        name: 'Daily planning',
        frequency: 'Daily',
        week_checks: [true, true, true, false, false, false, false]
      },
      {
        id: 'demo-habit-2',
        name: 'Review focus score',
        frequency: 'Daily',
        week_checks: [true, false, true, true, false, false, false]
      }
    ],
    projects: [
      { id: 'proj-foundation', name: 'Foundation' },
      { id: 'proj-frontend', name: 'Frontend' },
      { id: 'proj-platform', name: 'Platform' }
    ],
    week_label: `${weekDays[0].date} - ${weekDays[6].date}`,
    __demo: true
  };
}

function withCalendarDemoPayload(payload) {
  const safe = payload && typeof payload === 'object' ? payload : {};
  const hasTasks = Array.isArray(safe.task_rows) && safe.task_rows.length > 0;
  const hasHabits = Array.isArray(safe.habit_rows) && safe.habit_rows.length > 0;
  if (!isLocalhostRuntime() || hasTasks || hasHabits) {
    return safe;
  }
  const demo = buildCalendarDemoPayload();
  return {
    ...demo,
    ...safe,
    week_days: Array.isArray(safe.week_days) && safe.week_days.length ? safe.week_days : demo.week_days,
    task_rows: hasTasks ? safe.task_rows : demo.task_rows,
    habit_rows: hasHabits ? safe.habit_rows : demo.habit_rows,
    projects: Array.isArray(safe.projects) && safe.projects.length ? safe.projects : demo.projects,
    week_label: safe.week_label || demo.week_label,
    __demo: true
  };
}

function renderCalendar(content, payload) {
  const weekDays = Array.isArray(payload.week_days) ? payload.week_days : [];
  const taskRows = Array.isArray(payload.task_rows) ? payload.task_rows : [];
  const habitRows = Array.isArray(payload.habit_rows) ? payload.habit_rows : [];
  const projects = Array.isArray(payload.projects) ? payload.projects : [];
  const demoNotice = payload.__demo
    ? '<p class="calendar-demo-note">Demo data is enabled on localhost (no calendar rows from API yet).</p>'
    : '';

  const renderWeekHeader = (title) => `
    <div class="calendar-week-grid calendar-week-header-row" data-calendar-section="${title.toLowerCase()}">
      <div class="calendar-weekday calendar-task-header">${title}</div>
      ${weekDays.map((day) => `
        <div class="calendar-weekday${day.is_today ? ' is-today' : ''}">
          <span class="calendar-weekday-name">${escapeHtml(day.day || '')}</span>
          <span class="calendar-weekday-date">${escapeHtml(day.date || '')}</span>
        </div>
      `).join('')}
    </div>
  `;

  const renderTaskRows = () => {
    if (!taskRows.length) {
      return '<p class="empty" data-calendar-section="tasks">No tasks yet.</p>';
    }
    return `
      <div class="calendar-week-body" data-calendar-section="tasks">
        ${taskRows.map((task) => `
          <div class="calendar-week-grid calendar-week-row" data-calendar-row data-project-id="${task.project_id || ''}">
            <div class="calendar-task-cell">
              <span class="calendar-task-name">${escapeHtml(task.name || '')}</span>
              <span class="calendar-task-meta">${escapeHtml(task.project_name || 'No project')}</span>
            </div>
            ${weekDays.map((day, index) => {
              const checked = Array.isArray(task.week_checks) ? Boolean(task.week_checks[index]) : false;
              const statusClass = checked ? ' is-checked' : (day.is_future ? '' : ' is-missed');
              return `
                <div class="calendar-day-cell${day.is_today ? ' is-today' : ''}">
                  <span class="calendar-check${statusClass}" title="${escapeHtml(day.full || '')}"></span>
                </div>
              `;
            }).join('')}
          </div>
        `).join('')}
      </div>
      <p class="empty" id="calendar-empty-filter" hidden>No tasks match this filter.</p>
    `;
  };

  const renderHabitRows = () => {
    if (!habitRows.length) {
      return '<p class="empty" data-calendar-section="habits">No habits yet.</p>';
    }
    return `
      <div class="calendar-week-body" data-calendar-section="habits">
        ${habitRows.map((habit) => `
          <div class="calendar-week-grid calendar-week-row">
            <div class="calendar-task-cell">
              <span class="calendar-task-name">${escapeHtml(habit.name || '')}</span>
              <span class="calendar-task-meta">${escapeHtml(habit.frequency || 'Habit')}</span>
            </div>
            ${weekDays.map((day, index) => {
              const checked = Array.isArray(habit.week_checks) ? Boolean(habit.week_checks[index]) : false;
              const statusClass = checked ? ' is-checked' : (day.is_future ? '' : ' is-missed');
              return `
                <div class="calendar-day-cell${day.is_today ? ' is-today' : ''}">
                  <span class="calendar-check${statusClass}" title="${escapeHtml(day.full || '')}"></span>
                </div>
              `;
            }).join('')}
          </div>
        `).join('')}
      </div>
    `;
  };

  content.innerHTML = `
    <div class="calendar-lite-page">
      <section class="app-panel">
        <div class="calendar-lite-toolbar">
          <div class="calendar-lite-filters">
            <div class="calendar-toggle">
              <button class="btn btn-outline-primary btn-sm is-active" type="button" data-calendar-toggle="tasks">Tasks</button>
              <button class="btn btn-outline-primary btn-sm" type="button" data-calendar-toggle="habits">Habits</button>
            </div>
            <div class="calendar-filter" data-calendar-filter-wrap>
              <label for="calendar-project-filter">Project</label>
              <select id="calendar-project-filter" ${projects.length ? '' : 'disabled'}>
                <option value="">All projects</option>
                ${projects.map((project) => `
                  <option value="${project.id}">${escapeHtml(project.name || '')}</option>
                `).join('')}
              </select>
            </div>
          </div>
          <div class="calendar-week-meta-pill">${escapeHtml(payload.week_label || 'Current week')}</div>
        </div>
        ${demoNotice}
      </section>

      <section class="app-panel calendar-board-panel">
        ${renderWeekHeader('Tasks')}
        ${renderTaskRows()}
        ${renderWeekHeader('Habits')}
        ${renderHabitRows()}
      </section>
    </div>
  `;
}

async function bindCalendarActions(container) {
  clearCalendarView();

  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  const root = content.querySelector('.calendar-lite-page');
  if (!root) return;

  const rows = content.querySelectorAll('[data-calendar-row]');
  const projectFilter = content.querySelector('#calendar-project-filter');
  const emptyState = content.querySelector('#calendar-empty-filter');
  const toggleButtons = content.querySelectorAll('[data-calendar-toggle]');
  const sections = content.querySelectorAll('[data-calendar-section]');
  const projectFilterWrap = content.querySelector('[data-calendar-filter-wrap]');

  const abortController = new AbortController();
  const { signal } = abortController;

  const applyFilter = () => {
    if (!rows.length || !projectFilter) return;
    const selected = projectFilter.value;
    let visibleCount = 0;

    rows.forEach((row) => {
      const rowProjectId = row.dataset.projectId || '';
      const isVisible = !selected || rowProjectId === selected;
      row.hidden = !isVisible;
      if (isVisible) {
        visibleCount += 1;
      }
    });

    if (emptyState) {
      emptyState.hidden = visibleCount !== 0;
    }
  };

  const setActiveSection = (requestedSection) => {
    const target = requestedSection === 'habits' ? 'habits' : 'tasks';

    sections.forEach((section) => {
      const visible = section.dataset.calendarSection === target;
      section.hidden = !visible;
    });

    toggleButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.calendarToggle === target);
    });

    const showTasks = target === 'tasks';
    if (projectFilterWrap) projectFilterWrap.hidden = !showTasks;
    if (projectFilter) projectFilter.disabled = !showTasks;
    if (!showTasks && emptyState) emptyState.hidden = true;
  };

  if (projectFilter) {
    projectFilter.addEventListener('change', applyFilter, { signal });
    applyFilter();
  }

  toggleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setActiveSection(button.dataset.calendarToggle);
      if (button.dataset.calendarToggle === 'tasks') {
        applyFilter();
      }
    }, { signal });
  });

  setActiveSection('tasks');

  calendarViewCleanup = () => {
    abortController.abort();
  };
}

function buildGoalsDemoPayload() {
  const offsetDate = (days) => {
    const value = new Date();
    value.setDate(value.getDate() + days);
    return value.toISOString().slice(0, 10);
  };

  const labels = [
    { id: 'label-impact', name: 'High Impact', color: '#1f6feb' },
    { id: 'label-health', name: 'Health', color: '#22c55e' },
    { id: 'label-growth', name: 'Growth', color: '#f59e0b' }
  ];

  const projects = [
    { id: 'project-platform', name: 'Platform' },
    { id: 'project-focus', name: 'Focus Engine' },
    { id: 'project-content', name: 'Content' }
  ];

  const tasks = [
    { id: 'task-api-gateway', name: 'API gateway contract draft' },
    { id: 'task-pwa-goals', name: 'Goals UI migration in PWA' },
    { id: 'task-metrics', name: 'Weekly analytics baseline' }
  ];

  const goals = [
    {
      id: 'goal-pwa-unification',
      name: 'Unify frontend in PWA',
      description: 'Move all user-facing views from app/auth into the PWA shell.',
      status: 'active',
      display_status: 'active',
      priority: 'high',
      progress: 68,
      target_date: offsetDate(21),
      total_seconds: 54400,
      label_id: 'label-impact',
      label: labels[0],
      projects_count: 2,
      tasks_count: 2,
      project_ids: ['project-platform', 'project-focus'],
      task_ids: ['task-api-gateway', 'task-pwa-goals'],
      subgoals_count: 4,
      subgoals_completed: 2,
      subgoals: [
        { id: 'subgoal-nav', title: 'Migrate navigation shell', status: 'completed' },
        { id: 'subgoal-auth', title: 'Reuse auth screens in PWA', status: 'completed' },
        { id: 'subgoal-timer', title: 'Timer and pomodoro parity', status: 'active' },
        { id: 'subgoal-goals', title: 'Goals and weekly goals parity', status: 'active' }
      ]
    },
    {
      id: 'goal-operations',
      name: 'Stabilize API routing',
      description: 'Apply clean API gateway path strategy and isolate UI traffic.',
      status: 'at_risk',
      display_status: 'at_risk',
      priority: 'medium',
      progress: 42,
      target_date: offsetDate(30),
      total_seconds: 28100,
      label_id: 'label-growth',
      label: labels[2],
      projects_count: 1,
      tasks_count: 1,
      project_ids: ['project-platform'],
      task_ids: ['task-api-gateway'],
      subgoals_count: 3,
      subgoals_completed: 1,
      subgoals: [
        { id: 'subgoal-ingress', title: 'Ingress path design review', status: 'completed' },
        { id: 'subgoal-bff', title: 'BFF scope definition', status: 'active' },
        { id: 'subgoal-observability', title: 'API metrics baseline', status: 'active' }
      ]
    },
    {
      id: 'goal-health',
      name: 'Protect focus health',
      description: 'Sustain consistent deep-work routine with realistic weekly limits.',
      status: 'active',
      display_status: 'active',
      priority: 'low',
      progress: 80,
      target_date: offsetDate(14),
      total_seconds: 19600,
      label_id: 'label-health',
      label: labels[1],
      projects_count: 1,
      tasks_count: 1,
      project_ids: ['project-focus'],
      task_ids: ['task-metrics'],
      subgoals_count: 2,
      subgoals_completed: 2,
      subgoals: [
        { id: 'subgoal-sleep', title: 'Sleep before midnight 5 days/week', status: 'completed' },
        { id: 'subgoal-review', title: 'Weekly review every Friday', status: 'completed' }
      ]
    }
  ];

  return {
    goals,
    labels,
    projects,
    tasks,
    active_goals_count: goals.filter((goal) => !['completed', 'archived'].includes(String(goal.display_status || goal.status || '').toLowerCase())).length,
    targets_set: goals.filter((goal) => Boolean(goal.target_date)).length,
    total_goal_seconds: goals.reduce((sum, goal) => sum + Number(goal.total_seconds || 0), 0),
    __demo: true
  };
}

function withGoalsDemoPayload(payload) {
  const safe = payload && typeof payload === 'object' ? payload : {};
  const hasGoals = Array.isArray(safe.goals) && safe.goals.length > 0;
  if (!isLocalhostRuntime() || hasGoals) {
    return safe;
  }

  const demo = buildGoalsDemoPayload();
  return {
    ...demo,
    ...safe,
    goals: hasGoals ? safe.goals : demo.goals,
    labels: Array.isArray(safe.labels) && safe.labels.length ? safe.labels : demo.labels,
    projects: Array.isArray(safe.projects) && safe.projects.length ? safe.projects : demo.projects,
    tasks: Array.isArray(safe.tasks) && safe.tasks.length ? safe.tasks : demo.tasks,
    active_goals_count: Number.isFinite(Number(safe.active_goals_count))
      ? Number(safe.active_goals_count)
      : demo.active_goals_count,
    targets_set: Number.isFinite(Number(safe.targets_set))
      ? Number(safe.targets_set)
      : demo.targets_set,
    total_goal_seconds: Number.isFinite(Number(safe.total_goal_seconds))
      ? Number(safe.total_goal_seconds)
      : demo.total_goal_seconds,
    __demo: true
  };
}

function goalStatusTone(status) {
  const value = String(status || 'active').toLowerCase();
  if (value === 'completed' || value === 'archived') return 'completed';
  if (value === 'at_risk') return 'paused';
  return 'active';
}

function goalStatusLabel(status) {
  return String(status || 'active').replace(/_/g, ' ');
}

function normalizeGoalPercent(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function formatGoalDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function resolveGoalLabel(goal, labels) {
  const embedded = goal && goal.label && typeof goal.label === 'object' ? goal.label : null;
  if (embedded && embedded.name) {
    return {
      name: String(embedded.name),
      color: String(embedded.color || '#64748b')
    };
  }
  const goalLabelId = goal && goal.label_id ? String(goal.label_id) : '';
  if (!goalLabelId) return null;
  const safeLabels = Array.isArray(labels) ? labels : [];
  const matched = safeLabels.find((item) => String(item.id) === goalLabelId);
  if (!matched) return null;
  return {
    name: String(matched.name || ''),
    color: String(matched.color || '#64748b')
  };
}

function renderGoalMomentumChart(goals) {
  const rows = (Array.isArray(goals) ? goals : [])
    .slice()
    .sort((left, right) => normalizeGoalPercent(right.progress) - normalizeGoalPercent(left.progress))
    .slice(0, 6)
    .map((goal) => ({
      name: String(goal.name || 'Untitled goal'),
      progress: normalizeGoalPercent(goal.progress)
    }));

  if (!rows.length) {
    return '<p class="muted">No goal momentum yet.</p>';
  }

  return `
    <div class="goal-momentum-chart">
      ${rows.map((row) => `
        <div class="goal-momentum-row">
          <span class="goal-momentum-name">${escapeHtml(row.name)}</span>
          <div class="goal-momentum-track">
            <span class="goal-momentum-fill" style="width: ${row.progress}%;"></span>
          </div>
          <span class="goal-momentum-value">${row.progress}%</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderGoalCards(goals, labels, viewMode = 'overview') {
  const safeGoals = Array.isArray(goals) ? goals : [];
  const subgoalLimit = viewMode === 'long-term' ? 8 : 4;

  return safeGoals.map((goal) => {
    const progress = normalizeGoalPercent(goal.progress);
    const statusRaw = goal.display_status || goal.status || 'active';
    const statusTone = goalStatusTone(statusRaw);
    const statusText = goalStatusLabel(statusRaw);
    const subgoals = Array.isArray(goal.subgoals) ? goal.subgoals : [];
    const subgoalsCompleted = Number.isFinite(Number(goal.subgoals_completed))
      ? Number(goal.subgoals_completed)
      : subgoals.filter((subgoal) => String(subgoal.status || '').toLowerCase() === 'completed').length;
    const subgoalsCount = Number.isFinite(Number(goal.subgoals_count))
      ? Number(goal.subgoals_count)
      : subgoals.length;
    const projectCount = Number.isFinite(Number(goal.projects_count))
      ? Number(goal.projects_count)
      : (Array.isArray(goal.project_ids) ? goal.project_ids.length : 0);
    const taskCount = Number.isFinite(Number(goal.tasks_count))
      ? Number(goal.tasks_count)
      : (Array.isArray(goal.task_ids) ? goal.task_ids.length : 0);
    const labelMeta = resolveGoalLabel(goal, labels);
    const shownSubgoals = subgoals.slice(0, subgoalLimit);
    const goalId = escapeHtml(String(goal.id || ''));

    return `
      <article class="goal-card">
        <div class="goal-top">
          <span class="goal-status ${statusTone}">${escapeHtml(statusText)}</span>
          <div class="goal-deadline">
            <div class="deadline-ring" style="--progress: ${progress};" title="Progress ${progress}%">
              <span>${progress}%</span>
            </div>
            <span class="deadline-date">${goal.target_date ? `Target ${escapeHtml(formatGoalDate(goal.target_date))}` : 'No target date'}</span>
          </div>
        </div>

        <div class="goal-card-header">
          <h4 class="goal-name">${escapeHtml(goal.name || 'Untitled goal')}</h4>
        </div>

        <p class="goal-desc">${escapeHtml(goal.description || 'No description yet.')}</p>

        <div class="goal-relations">
          <span class="goal-relation-pill">
            <i class="bi bi-folder2-open"></i>
            ${projectCount} projects
          </span>
          <span class="goal-relation-pill">
            <i class="bi bi-list-task"></i>
            ${taskCount} tasks
          </span>
          ${labelMeta ? `
            <span class="goal-label-chip">
              <span class="goal-label-dot" style="background-color: ${escapeHtml(labelMeta.color)};"></span>
              ${escapeHtml(labelMeta.name)}
            </span>
          ` : ''}
        </div>

        <div class="goal-progress">
          <div class="goal-progress-bar">
            <span style="width: ${progress}%;"></span>
          </div>
          <span class="goal-progress-text">
            ${subgoalsCount ? `${subgoalsCompleted} / ${subgoalsCount} sub-goals` : `${progress}% complete`}
          </span>
        </div>

        <div class="goal-subgoal-items">
          ${shownSubgoals.map((subgoal) => `
            <label class="goal-subgoal-item ${String(subgoal.status || '').toLowerCase() === 'completed' ? 'is-done' : ''}">
              <input
                type="checkbox"
                data-action="toggle-subgoal"
                data-subgoal-id="${escapeHtml(String(subgoal.id || ''))}"
                ${String(subgoal.status || '').toLowerCase() === 'completed' ? 'checked' : ''}
              />
              <span>${escapeHtml(subgoal.title || 'Untitled sub-goal')}</span>
            </label>
          `).join('')}
          ${shownSubgoals.length ? '' : '<p class="goal-subgoal-empty">No sub-goals yet.</p>'}
        </div>

        <form class="subgoal-add-form-lite goal-subgoal-add-form" data-goal-id="${goalId}">
          <input type="text" placeholder="Add sub-goal" name="title" required />
          <button class="btn btn-outline-primary btn-sm" type="submit">Add</button>
        </form>

        <div class="goal-card-actions">
          <button class="btn btn-outline-danger btn-sm danger" data-action="delete-goal" data-goal-id="${goalId}" type="button">
            Delete
          </button>
        </div>
      </article>
    `;
  }).join('');
}

function renderGoals(content, payload, viewMode = 'overview') {
  const goals = Array.isArray(payload.goals) ? payload.goals : [];
  const labels = Array.isArray(payload.labels) ? payload.labels : [];
  const projects = Array.isArray(payload.projects) ? payload.projects : [];
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  const longTermMode = viewMode === 'long-term';
  const activeGoalsCount = Number.isFinite(Number(payload.active_goals_count))
    ? Number(payload.active_goals_count)
    : goals.filter((goal) => goalStatusTone(goal.display_status || goal.status) !== 'completed').length;
  const targetsSet = Number.isFinite(Number(payload.targets_set))
    ? Number(payload.targets_set)
    : goals.filter((goal) => Boolean(goal.target_date)).length;
  const totalGoalSeconds = Number.isFinite(Number(payload.total_goal_seconds))
    ? Number(payload.total_goal_seconds)
    : goals.reduce((sum, goal) => sum + Number(goal.total_seconds || 0), 0);
  const linkedProjectsTotal = goals.reduce((sum, goal) => (
    sum + (
      Number.isFinite(Number(goal.projects_count))
        ? Number(goal.projects_count)
        : (Array.isArray(goal.project_ids) ? goal.project_ids.length : 0)
    )
  ), 0);
  const linkedTasksTotal = goals.reduce((sum, goal) => (
    sum + (
      Number.isFinite(Number(goal.tasks_count))
        ? Number(goal.tasks_count)
        : (Array.isArray(goal.task_ids) ? goal.task_ids.length : 0)
    )
  ), 0);

  const visibleGoals = longTermMode
    ? goals
    : goals.slice().sort((left, right) => normalizeGoalPercent(right.progress) - normalizeGoalPercent(left.progress)).slice(0, 6);

  const goalsWithSubgoals = goals.filter((goal) => Array.isArray(goal.subgoals) && goal.subgoals.length > 0);
  const hasLabels = labels.length > 0;
  const demoNote = payload.__demo
    ? `
      <div class="goals-demo-note">
        <i class="bi bi-flask"></i>
        <span>Demo data is enabled on localhost because API returned no goals yet.</span>
      </div>
    `
    : '';

  content.innerHTML = `
    <div class="goals-page ${longTermMode ? 'is-long-term' : ''}">
      ${demoNote}

      ${longTermMode ? `
        <section class="app-panel goals-compact-header">
          <div class="goals-header">
            <div>
              <p class="goals-label">Long-term goals</p>
              <h3 class="goals-title">Plan outcomes and track progress</h3>
            </div>
            <button class="btn btn-outline-secondary btn-sm" type="button" data-route="/app/goals">
              Overview
            </button>
          </div>
        </section>
      ` : `
        <section class="goals-hero">
          <a class="goal-hub-card" href="/app/weekly-goals" data-route="/app/weekly-goals">
            <div>
              <p class="goals-label">Weekly goals</p>
              <h2>Weekly Focus</h2>
              <p class="goal-hub-meta">Define this week's execution target</p>
            </div>
            <span class="goal-hub-arrow"><i class="bi bi-arrow-up-right"></i></span>
          </a>

          <a class="goal-hub-card" href="/app/long-term-goals" data-route="/app/long-term-goals">
            <div>
              <p class="goals-label">Long-term goals</p>
              <h2>Outcome Pipeline</h2>
              <p class="goal-hub-meta">${goals.length} goals in total</p>
            </div>
            <span class="goal-hub-arrow"><i class="bi bi-arrow-up-right"></i></span>
          </a>
        </section>

        <section class="app-panel goals-overview-card">
          <div class="goals-header">
            <div>
              <p class="goals-label">Overview</p>
              <h3 class="goals-title">Goal momentum</h3>
            </div>
          </div>
          <div class="goals-overview-grid">
            <div class="goals-overview-chart">
              ${renderGoalMomentumChart(goals)}
            </div>
            <div class="goals-summary">
              <article class="goal-stat-card">
                <span class="goal-stat-label">Active goals</span>
                <span class="goal-stat-value">${activeGoalsCount}</span>
                <span class="goal-stat-meta">Total goals: ${goals.length}</span>
              </article>
              <article class="goal-stat-card">
                <span class="goal-stat-label">Focus tracked</span>
                <span class="goal-stat-value">${formatDuration(totalGoalSeconds)}</span>
                <span class="goal-stat-meta">Across all goals</span>
              </article>
              <article class="goal-stat-card">
                <span class="goal-stat-label">Targets set</span>
                <span class="goal-stat-value">${targetsSet}</span>
                <span class="goal-stat-meta">Upcoming deadlines</span>
              </article>
              <article class="goal-stat-card">
                <span class="goal-stat-label">Linked scope</span>
                <span class="goal-stat-value">${linkedProjectsTotal} projects</span>
                <span class="goal-stat-meta">${linkedTasksTotal} linked tasks</span>
              </article>
            </div>
          </div>
        </section>
      `}

      <section class="app-panel goals-create-card">
        <div class="goals-header">
          <div>
            <p class="goals-label">Create</p>
            <h3 class="goals-title">New long-term goal</h3>
          </div>
        </div>

        <form id="goal-create-form" class="goals-create-form">
          <input id="goal-name" type="text" placeholder="Goal name" required />
          <input id="goal-description" type="text" placeholder="Description (optional)" />
          <input id="goal-target-date" type="date" />
          <input id="goal-target-hours" type="number" min="0" step="0.5" placeholder="Target hours" />
          <select id="goal-label" ${hasLabels ? 'required' : 'disabled'}>
            ${hasLabels
              ? '<option value="">Select label</option>'
              : '<option value="">Create a label first</option>'}
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
      </section>

      <section class="app-panel goals-card goals-pipeline-card">
        <div class="goals-header">
          <div>
            <p class="goals-label">Pipeline</p>
            <h3 class="goals-title">${longTermMode ? 'Goals in progress' : 'Top goals this week'}</h3>
          </div>
          ${longTermMode ? '' : `
            <button class="btn btn-outline-secondary btn-sm" type="button" data-route="/app/long-term-goals">
              Open long-term
            </button>
          `}
        </div>

        <div class="goals-grid">
          ${visibleGoals.length ? renderGoalCards(visibleGoals, labels, longTermMode ? 'long-term' : 'overview') : '<p class="muted">No goals yet.</p>'}
        </div>
      </section>

      ${longTermMode ? `
        <section class="app-panel subgoals-card">
          <div class="goals-header">
            <div>
              <p class="goals-label">Breakdown</p>
              <h3 class="goals-title">Sub-goals</h3>
            </div>
          </div>

          <div class="subgoals-grid">
            ${goalsWithSubgoals.length ? goalsWithSubgoals.map((goal) => {
              const subgoals = Array.isArray(goal.subgoals) ? goal.subgoals : [];
              const progress = normalizeGoalPercent(goal.progress);
              const statusRaw = goal.display_status || goal.status || 'active';
              const statusTone = goalStatusTone(statusRaw);
              const statusText = goalStatusLabel(statusRaw);
              const completed = Number.isFinite(Number(goal.subgoals_completed))
                ? Number(goal.subgoals_completed)
                : subgoals.filter((subgoal) => String(subgoal.status || '').toLowerCase() === 'completed').length;
              const total = Number.isFinite(Number(goal.subgoals_count))
                ? Number(goal.subgoals_count)
                : subgoals.length;
              const goalId = escapeHtml(String(goal.id || ''));
              return `
                <article class="subgoal-group">
                  <div class="subgoal-group-header">
                    <div>
                      <h4>${escapeHtml(goal.name || 'Untitled goal')}</h4>
                      <p class="subgoal-group-meta">${completed} / ${total} completed</p>
                    </div>
                    <div class="subgoal-progress">
                      <div class="deadline-ring" style="--progress: ${progress};" title="Progress ${progress}%">
                        <span>${progress}%</span>
                      </div>
                      <span class="goal-status ${statusTone}">${escapeHtml(statusText)}</span>
                    </div>
                  </div>

                  <div class="goal-subgoal-items">
                    ${subgoals.map((subgoal) => `
                      <label class="goal-subgoal-item ${String(subgoal.status || '').toLowerCase() === 'completed' ? 'is-done' : ''}">
                        <input
                          type="checkbox"
                          data-action="toggle-subgoal"
                          data-subgoal-id="${escapeHtml(String(subgoal.id || ''))}"
                          ${String(subgoal.status || '').toLowerCase() === 'completed' ? 'checked' : ''}
                        />
                        <span>${escapeHtml(subgoal.title || 'Untitled sub-goal')}</span>
                      </label>
                    `).join('')}
                  </div>

                  <form class="subgoal-add-form-lite goal-subgoal-add-form" data-goal-id="${goalId}">
                    <input type="text" placeholder="Add sub-goal" name="title" required />
                    <button class="btn btn-outline-primary btn-sm" type="submit">Add</button>
                  </form>
                </article>
              `;
            }).join('') : '<p class="muted">No sub-goals yet.</p>'}
          </div>
        </section>
      ` : ''}
    </div>
  `;
}

async function bindGoalActions(container, currentPath) {
  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  content.querySelectorAll('[data-route]').forEach((item) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      const route = item.dataset.route;
      if (!route) return;
      navigate(route);
    });
  });

  const createForm = content.querySelector('#goal-create-form');
  if (createForm) {
    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const nameInput = content.querySelector('#goal-name');
      const descriptionInput = content.querySelector('#goal-description');
      const targetDateInput = content.querySelector('#goal-target-date');
      const targetHoursInput = content.querySelector('#goal-target-hours');
      const labelInput = content.querySelector('#goal-label');
      const projectInput = content.querySelector('#goal-project');
      const taskInput = content.querySelector('#goal-task');

      const name = nameInput instanceof HTMLInputElement ? nameInput.value.trim() : '';
      const description = descriptionInput instanceof HTMLInputElement ? descriptionInput.value.trim() : '';
      const targetDate = targetDateInput instanceof HTMLInputElement ? targetDateInput.value : '';
      const targetHoursRaw = targetHoursInput instanceof HTMLInputElement ? targetHoursInput.value : '';
      const labelId = labelInput instanceof HTMLSelectElement ? labelInput.value : '';
      const projectId = projectInput instanceof HTMLSelectElement ? projectInput.value : '';
      const taskId = taskInput instanceof HTMLSelectElement ? taskInput.value : '';

      if (!name) return;
      if (!labelId) {
        showToast('Please choose a label first', 'warning');
        return;
      }

      const targetHours = targetHoursRaw ? Number(targetHoursRaw) : null;

      try {
        await appApi.createGoal({
          name,
          description,
          status: 'active',
          priority: 'medium',
          target_date: targetDate || '',
          target_hours: Number.isFinite(targetHours) ? targetHours : '',
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
      const goalId = button.dataset.goalId;
      if (!goalId) return;
      try {
        await appApi.deleteGoal(goalId);
        showToast('Goal deleted', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to delete goal', 'error');
      }
    });
  });

  content.querySelectorAll('[data-action="toggle-subgoal"]').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      const subgoalId = checkbox.dataset.subgoalId;
      if (!subgoalId) return;
      try {
        await appApi.toggleGoalSubgoal(subgoalId, checkbox.checked);
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
      if (!(titleInput instanceof HTMLInputElement)) return;
      const title = titleInput.value.trim();
      const goalId = form.dataset.goalId;
      if (!title || !goalId) return;

      try {
        await appApi.addGoalSubgoal(goalId, {
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

function currentWeekRangePayload() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mondayOffset = (today.getDay() + 6) % 7;
  const weekStartDate = new Date(today);
  weekStartDate.setDate(today.getDate() - mondayOffset);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);
  const formatIso = (value) => value.toISOString().slice(0, 10);
  const label = `${weekStartDate.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })} - ${weekEndDate.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })}`;
  return {
    week_start: formatIso(weekStartDate),
    week_end: formatIso(weekEndDate),
    weekly_range_label: label
  };
}

function buildWeeklyGoalsDemoPayload() {
  const base = currentWeekRangePayload();
  const baseStart = new Date(`${base.week_start}T00:00:00`);

  const labels = [
    { id: 'weekly-label-impact', name: 'High Impact', color: '#1f6feb' },
    { id: 'weekly-label-focus', name: 'Deep Work', color: '#22c55e' },
    { id: 'weekly-label-maintenance', name: 'Maintenance', color: '#f59e0b' }
  ];

  const longTermGoals = [
    { id: 'weekly-goal-front', name: 'Unify frontend in PWA' },
    { id: 'weekly-goal-api', name: 'Stabilize API routing' },
    { id: 'weekly-goal-health', name: 'Protect focus health' }
  ];

  const rangeForWeeksAgo = (weeksAgo) => {
    const start = new Date(baseStart);
    start.setDate(baseStart.getDate() - (weeksAgo * 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      week_start: start.toISOString().slice(0, 10),
      week_end: end.toISOString().slice(0, 10),
      week_label: `${start.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })}`
    };
  };

  const currentRange = rangeForWeeksAgo(0);
  const previousRange = rangeForWeeksAgo(1);
  const twoWeeksAgoRange = rangeForWeeksAgo(2);

  const weekly_goals_current = [
    {
      id: 'demo-weekly-1',
      title: 'Finish weekly-goals page migration',
      target_seconds: 36000,
      progress_seconds: 22800,
      progress_percent: 63,
      status: 'active',
      long_term_goal_name: 'Unify frontend in PWA',
      label: labels[0],
      week_start: currentRange.week_start,
      week_end: currentRange.week_end,
      week_label: currentRange.week_label
    },
    {
      id: 'demo-weekly-2',
      title: 'Run architecture review and write notes',
      target_seconds: 18000,
      progress_seconds: 18000,
      progress_percent: 100,
      status: 'completed',
      long_term_goal_name: 'Stabilize API routing',
      label: labels[2],
      week_start: currentRange.week_start,
      week_end: currentRange.week_end,
      week_label: currentRange.week_label
    }
  ];

  const weekly_goals_all = [
    ...weekly_goals_current,
    {
      id: 'demo-weekly-3',
      title: 'Prepare BFF endpoint matrix',
      target_seconds: 25200,
      progress_seconds: 19000,
      progress_percent: 75,
      status: 'completed',
      long_term_goal_name: 'Stabilize API routing',
      label: labels[1],
      week_start: previousRange.week_start,
      week_end: previousRange.week_end,
      week_label: previousRange.week_label
    },
    {
      id: 'demo-weekly-4',
      title: 'Refine reports and chart interactions',
      target_seconds: 21600,
      progress_seconds: 12600,
      progress_percent: 58,
      status: 'active',
      long_term_goal_name: 'Unify frontend in PWA',
      label: labels[0],
      week_start: previousRange.week_start,
      week_end: previousRange.week_end,
      week_label: previousRange.week_label
    },
    {
      id: 'demo-weekly-5',
      title: 'Stabilize timer edge cases',
      target_seconds: 28800,
      progress_seconds: 28800,
      progress_percent: 100,
      status: 'completed',
      long_term_goal_name: 'Protect focus health',
      label: labels[2],
      week_start: twoWeeksAgoRange.week_start,
      week_end: twoWeeksAgoRange.week_end,
      week_label: twoWeeksAgoRange.week_label
    }
  ];

  return {
    ...base,
    weekly_goals_current,
    weekly_goals_all,
    long_term_goals: longTermGoals,
    labels,
    __demo: true
  };
}

function withWeeklyGoalsDemoPayload(payload) {
  const safe = payload && typeof payload === 'object' ? payload : {};
  const hasCurrent = Array.isArray(safe.weekly_goals_current) && safe.weekly_goals_current.length > 0;
  const hasAll = Array.isArray(safe.weekly_goals_all) && safe.weekly_goals_all.length > 0;
  if (!isLocalhostRuntime() || hasCurrent || hasAll) {
    return safe;
  }
  const demo = buildWeeklyGoalsDemoPayload();
  return {
    ...demo,
    ...safe,
    weekly_goals_current: hasCurrent ? safe.weekly_goals_current : demo.weekly_goals_current,
    weekly_goals_all: hasAll ? safe.weekly_goals_all : demo.weekly_goals_all,
    long_term_goals: Array.isArray(safe.long_term_goals) && safe.long_term_goals.length ? safe.long_term_goals : demo.long_term_goals,
    labels: Array.isArray(safe.labels) && safe.labels.length ? safe.labels : demo.labels,
    weekly_range_label: safe.weekly_range_label || demo.weekly_range_label,
    week_start: safe.week_start || demo.week_start,
    week_end: safe.week_end || demo.week_end,
    __demo: true
  };
}

function formatWeeklyTargetHours(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  const hours = safe / 3600;
  if (!Number.isFinite(hours) || hours <= 0) return '0';
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function normalizeWeeklyGoal(goal) {
  const targetSeconds = Math.max(0, Number(goal?.target_seconds || 0));
  const progressSeconds = Math.max(0, Number(goal?.progress_seconds || 0));
  const explicitPercent = Number(goal?.progress_percent);
  const progressPercent = Number.isFinite(explicitPercent)
    ? Math.max(0, Math.min(100, Math.round(explicitPercent)))
    : (targetSeconds > 0 ? Math.max(0, Math.min(100, Math.round((progressSeconds / targetSeconds) * 100))) : 0);
  return {
    ...goal,
    target_seconds: targetSeconds,
    progress_seconds: progressSeconds,
    progress_percent: progressPercent
  };
}

function groupWeeklyGoalsByWeek(weeklyGoals) {
  const safe = Array.isArray(weeklyGoals) ? weeklyGoals : [];
  const groups = new Map();

  safe.forEach((goal) => {
    const key = String(goal.week_start || goal.week_label || 'unknown-week');
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: goal.week_label || key,
        goals: []
      });
    }
    groups.get(key).goals.push(goal);
  });

  return Array.from(groups.values())
    .sort((left, right) => String(right.key).localeCompare(String(left.key)))
    .map((group) => ({
      ...group,
      goals: group.goals.slice().sort((left, right) => String(left.title || '').localeCompare(String(right.title || '')))
    }));
}

function renderWeeklyGoalCard(goal) {
  const statusRaw = String(goal.status || 'active').toLowerCase();
  const statusText = goalStatusLabel(statusRaw);
  const toggleStatus = statusRaw === 'completed' ? 'active' : 'completed';
  const toggleText = statusRaw === 'completed' ? 'Reopen' : 'Done';

  return `
    <article class="weekly-goal-item">
      <div class="weekly-goal-info">
        <div>
          <h3>${escapeHtml(goal.title || 'Untitled weekly goal')}</h3>
          <p>
            ${formatDuration(goal.progress_seconds)} logged ·
            Target ${formatWeeklyTargetHours(goal.target_seconds)}h
            ${goal.long_term_goal_name ? ` · Long-term: ${escapeHtml(goal.long_term_goal_name)}` : ''}
            ${goal.label && goal.label.name ? ` · Label: ${escapeHtml(goal.label.name)}` : ''}
          </p>
        </div>
        <div class="weekly-goal-actions">
          <button
            class="btn ${statusRaw === 'completed' ? 'btn-outline-secondary' : 'btn-outline-success'} btn-sm"
            data-action="toggle-weekly"
            data-goal-id="${escapeHtml(String(goal.id || ''))}"
            data-status="${toggleStatus}"
            type="button"
          >
            ${toggleText}
          </button>
          <button
            class="btn btn-outline-danger btn-sm danger"
            data-action="delete-weekly"
            data-goal-id="${escapeHtml(String(goal.id || ''))}"
            type="button"
          >
            Delete
          </button>
        </div>
      </div>
      <div class="weekly-goal-progress">
        <div class="weekly-goal-bar">
          <span style="width: ${goal.progress_percent}%;"></span>
        </div>
        <span>${goal.progress_percent}%</span>
      </div>
      <div class="weekly-goal-status-row">
        <span class="goal-status ${goalStatusTone(statusRaw)}">${escapeHtml(statusText)}</span>
      </div>
    </article>
  `;
}

function renderWeeklyGoals(content, payload) {
  const current = (Array.isArray(payload.weekly_goals_current) ? payload.weekly_goals_current : [])
    .map((goal) => normalizeWeeklyGoal(goal));
  const all = (Array.isArray(payload.weekly_goals_all) ? payload.weekly_goals_all : [])
    .map((goal) => normalizeWeeklyGoal(goal));
  const longTermGoals = Array.isArray(payload.long_term_goals) ? payload.long_term_goals : [];
  const labels = Array.isArray(payload.labels) ? payload.labels : [];
  const hasLabels = labels.length > 0;
  const historyGroups = groupWeeklyGoalsByWeek(all);

  const demoNote = payload.__demo
    ? `
      <div class="goals-demo-note">
        <i class="bi bi-flask"></i>
        <span>Demo data is enabled on localhost because API returned no weekly goals yet.</span>
      </div>
    `
    : '';

  content.innerHTML = `
    <div class="weekly-goals-page">
      ${demoNote}

      <section class="app-panel weekly-goals-header-panel">
        <div class="goals-header">
          <div>
            <p class="goals-label">Weekly goals</p>
            <h3 class="goals-title">${escapeHtml(payload.weekly_range_label || 'Current week')}</h3>
          </div>
          <button class="btn btn-outline-secondary btn-sm" type="button" data-route="/app/goals">
            Back to goals
          </button>
        </div>
      </section>

      <section class="app-panel weekly-goals-card">
        <div class="goals-header">
          <div>
            <p class="goals-label">This week</p>
            <h3 class="goals-title">Focus targets</h3>
          </div>
        </div>

        <form id="weekly-goal-create-form" class="weekly-goal-form">
          <input id="weekly-goal-title" type="text" placeholder="Goal title" required />
          <input id="weekly-goal-hours" type="number" min="0" step="0.5" placeholder="Target hours" />
          <select id="weekly-goal-long-term">
            <option value="">No long-term goal</option>
            ${longTermGoals.map((goal) => `<option value="${goal.id}">${escapeHtml(goal.name)}</option>`).join('')}
          </select>
          <select id="weekly-goal-label" ${hasLabels ? 'required' : 'disabled'}>
            ${hasLabels
              ? '<option value="">Select label</option>'
              : '<option value="">Create a label first</option>'}
            ${labels.map((label) => `<option value="${label.id}">${escapeHtml(label.name)}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" type="submit">Add weekly goal</button>
        </form>

        <div class="weekly-goals-list">
          ${current.length ? current.map((goal) => renderWeeklyGoalCard(goal)).join('') : '<p class="muted">No weekly goals yet.</p>'}
        </div>
      </section>

      <section class="app-panel weekly-goals-history">
        <div class="goals-header">
          <div>
            <p class="goals-label">History</p>
            <h3 class="goals-title">Previous weeks</h3>
          </div>
        </div>

        <div class="weekly-history-list">
          ${historyGroups.length ? historyGroups.map((group) => `
            <article class="weekly-history-group">
              <div class="weekly-history-header">
                <h4>${escapeHtml(group.label || 'Week')}</h4>
                <span>${group.goals.length} goals</span>
              </div>
              <div class="weekly-goals-list">
                ${group.goals.map((goal) => renderWeeklyGoalCard(goal)).join('')}
              </div>
            </article>
          `).join('') : '<p class="muted">No weekly history yet.</p>'}
        </div>
      </section>
    </div>
  `;
}

async function bindWeeklyGoalActions(container, currentPath, payload) {
  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  content.querySelectorAll('[data-route]').forEach((item) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      const route = item.dataset.route;
      if (!route) return;
      navigate(route);
    });
  });

  const form = content.querySelector('#weekly-goal-create-form');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const titleInput = content.querySelector('#weekly-goal-title');
      const targetHoursInput = content.querySelector('#weekly-goal-hours');
      const longTermInput = content.querySelector('#weekly-goal-long-term');
      const labelInput = content.querySelector('#weekly-goal-label');

      const title = titleInput instanceof HTMLInputElement ? titleInput.value.trim() : '';
      const targetHours = targetHoursInput instanceof HTMLInputElement ? targetHoursInput.value : '';
      const longTermGoalId = longTermInput instanceof HTMLSelectElement ? longTermInput.value : '';
      const labelId = labelInput instanceof HTMLSelectElement ? labelInput.value : '';
      const fallbackRange = currentWeekRangePayload();
      const weekStart = payload.week_start || fallbackRange.week_start;
      const weekEnd = payload.week_end || fallbackRange.week_end;

      if (!title) return;
      if (!labelId) {
        showToast('Please choose a label first', 'warning');
        return;
      }

      try {
        await appApi.createWeeklyGoal({
          title,
          target_hours: targetHours || '',
          week_start: weekStart,
          week_end: weekEnd,
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
      const goalId = button.dataset.goalId;
      const status = button.dataset.status;
      if (!goalId || !status) return;

      if (payload.__demo && String(goalId).startsWith('demo-')) {
        showToast('Demo goal: connect API data to update this item.', 'info');
        return;
      }

      try {
        await appApi.toggleWeeklyGoal(goalId, status);
        showToast('Weekly goal updated', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to update weekly goal', 'error');
      }
    });
  });

  content.querySelectorAll('[data-action="delete-weekly"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const goalId = button.dataset.goalId;
      if (!goalId) return;

      if (payload.__demo && String(goalId).startsWith('demo-')) {
        showToast('Demo goal: connect API data to delete this item.', 'info');
        return;
      }

      try {
        await appApi.deleteWeeklyGoal(goalId);
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

  if (section !== 'overview') {
    clearOverviewView();
  }

  if (section !== 'reports') {
    clearReportsView();
  }

  if (section !== 'calendar') {
    clearCalendarView();
  }

  if (section !== 'tasks') {
    clearTasksView();
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
      renderTasksSection(content, tasks, projects, goals, labels);
      await bindTasksSection(container, tasks);
      return;
    }

    if (section === 'projects') {
      const range = lastSevenDaysRange();
      const [projects, labels, tasks, reports] = await Promise.all([
        appApi.getProjects(),
        appApi.getLabels().catch(() => ({ labels: [] })),
        appApi.getTasks().catch(() => ({ tasks: [], done_today_tasks: [], completed_tasks: [] })),
        appApi.getReportsSummary({ start: range.start, end: range.end, group: 'projects' }).catch(() => ({
          distribution: [],
          total_seconds: 0
        }))
      ]);
      const payload = { projects, labels, tasks, reports };
      renderProjects(content, payload);
      await bindProjectActions(container, currentPath, payload);
      return;
    }

    if (section === 'reports') {
      const range = lastSevenDaysRange();
      const report = await appApi.getReportsSummary({ start: range.start, end: range.end, group: 'projects' });
      renderReports(content, report, range);
      await bindReportsActions(container, range, report);
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
      let payload;
      try {
        payload = await appApi.getCalendarBoard();
      } catch (error) {
        if (!isLocalhostRuntime()) throw error;
        payload = {};
      }
      payload = withCalendarDemoPayload(payload);
      renderCalendar(content, payload);
      await bindCalendarActions(container);
      return;
    }

    if (section === 'goals' || section === 'long-term-goals') {
      let payload;
      try {
        payload = await appApi.getGoals();
      } catch (error) {
        if (!isLocalhostRuntime()) throw error;
        payload = {};
      }
      payload = withGoalsDemoPayload(payload);
      renderGoals(content, payload, section === 'long-term-goals' ? 'long-term' : 'overview');
      await bindGoalActions(container, currentPath);
      return;
    }

    if (section === 'weekly-goals') {
      let payload;
      try {
        payload = await appApi.getWeeklyGoals();
      } catch (error) {
        if (!isLocalhostRuntime()) throw error;
        payload = {};
      }
      payload = withWeeklyGoalsDemoPayload(payload);
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
