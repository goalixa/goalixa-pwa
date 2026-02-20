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
        <span class="app-nav-icon" aria-hidden="true">
          <i class="fas ${item.icon}"></i>
        </span>
        <span class="app-nav-text">${item.label}</span>
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
        <div class="app-brand" aria-label="Goalixa">
          <span class="app-brand-mark" aria-hidden="true">
            <i class="fas fa-bullseye"></i>
          </span>
        </div>
        <div class="app-user-actions">
          <span class="app-user-email">${escapeHtml(email)}</span>
          <button class="btn btn-light app-theme-toggle" data-action="toggle-theme" type="button"></button>
          <button class="btn btn-primary" data-action="logout" type="button">Logout</button>
        </div>
      </header>

      <div class="app-shell-main">
        <aside class="app-shell-nav">
          <div class="app-nav-head">
            <span>Navigation</span>
          </div>
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

function buildHabitsDemoPayload() {
  const today = new Date().toISOString().slice(0, 10);
  const goals = [
    {
      id: 'demo-goal-1',
      name: 'Unify frontend in PWA',
      subgoals: [
        { id: 'demo-subgoal-1', title: 'Migrate remaining app pages' },
        { id: 'demo-subgoal-2', title: 'Add demo fallback for validation' }
      ]
    },
    {
      id: 'demo-goal-2',
      name: 'Stabilize API routing',
      subgoals: [
        { id: 'demo-subgoal-3', title: 'BFF endpoint mapping' },
        { id: 'demo-subgoal-4', title: 'Ingress path cleanup' }
      ]
    }
  ];

  const habits = [
    {
      id: 'demo-habit-1',
      name: 'Daily architecture review',
      frequency: 'Daily',
      time_of_day: 'Morning',
      reminder: '09:00',
      notes: 'Check API edge-cases and write one note.',
      goal_name: 'Stabilize API routing',
      subgoal_name: 'BFF endpoint mapping',
      streak: 8,
      done: true
    },
    {
      id: 'demo-habit-2',
      name: 'Ship one visible UI improvement',
      frequency: 'Weekdays',
      time_of_day: 'Afternoon',
      reminder: '15:00',
      notes: '',
      goal_name: 'Unify frontend in PWA',
      subgoal_name: 'Migrate remaining app pages',
      streak: 5,
      done: false
    },
    {
      id: 'demo-habit-3',
      name: 'Evening retrospective',
      frequency: 'Daily',
      time_of_day: 'Evening',
      reminder: '21:30',
      notes: 'Write three wins and one blocker.',
      goal_name: '',
      subgoal_name: '',
      streak: 12,
      done: false
    }
  ];

  return {
    today,
    habits,
    goals,
    total_habits: habits.length,
    completed_habits: habits.filter((habit) => Boolean(habit.done)).length,
    best_streak: Math.max(0, ...habits.map((habit) => Number(habit.streak || 0))),
    focus_window: 'Evening close',
    habit_series: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      values: [1, 2, 2, 3, 2, 1, 2]
    },
    __demo: true
  };
}

function withHabitsDemoPayload(payload) {
  const safe = payload && typeof payload === 'object' ? payload : {};
  const hasHabits = Array.isArray(safe.habits) && safe.habits.length > 0;
  if (!isLocalhostRuntime() || hasHabits) {
    return safe;
  }

  const demo = buildHabitsDemoPayload();
  return {
    ...demo,
    ...safe,
    habits: hasHabits ? safe.habits : demo.habits,
    goals: Array.isArray(safe.goals) && safe.goals.length ? safe.goals : demo.goals,
    total_habits: Number.isFinite(Number(safe.total_habits)) ? Number(safe.total_habits) : demo.total_habits,
    completed_habits: Number.isFinite(Number(safe.completed_habits)) ? Number(safe.completed_habits) : demo.completed_habits,
    best_streak: Number.isFinite(Number(safe.best_streak)) ? Number(safe.best_streak) : demo.best_streak,
    focus_window: safe.focus_window || demo.focus_window,
    habit_series: safe.habit_series && typeof safe.habit_series === 'object' ? safe.habit_series : demo.habit_series,
    today: safe.today || demo.today,
    __demo: true
  };
}

function normalizeHabitMeta(habit) {
  if (habit && habit.meta) return String(habit.meta);
  const parts = [];
  if (habit && habit.frequency) parts.push(String(habit.frequency));
  if (habit && habit.time_of_day) parts.push(String(habit.time_of_day));
  if (habit && habit.reminder) parts.push(`Reminder ${habit.reminder}`);
  return parts.length ? parts.join(' • ') : 'No schedule';
}

function normalizeHabitSeries(habitSeries, habits) {
  const labels = Array.isArray(habitSeries?.labels) ? habitSeries.labels.map((item) => String(item)) : [];
  const values = Array.isArray(habitSeries?.values) ? habitSeries.values.map((item) => Number(item || 0)) : [];
  if (labels.length && labels.length === values.length) {
    return { labels: labels.slice(-14), values: values.slice(-14) };
  }

  const doneCount = Array.isArray(habits) ? habits.filter((habit) => Boolean(habit.done)).length : 0;
  const totalCount = Array.isArray(habits) ? habits.length : 0;
  const baseValue = Math.max(0, Math.min(7, doneCount || Math.ceil(totalCount * 0.5)));
  return {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    values: [baseValue - 1, baseValue, baseValue, baseValue + 1, baseValue, baseValue - 1, baseValue]
      .map((value) => Math.max(0, value))
  };
}

function renderHabitSeriesChart(habitSeries, habits) {
  const series = normalizeHabitSeries(habitSeries, habits);
  const maxValue = Math.max(1, ...series.values);
  if (!series.labels.length) {
    return '<p class="muted">No completion data yet.</p>';
  }

  return `
    <div class="habit-series-chart" aria-label="Habit completion over time">
      ${series.labels.map((label, index) => {
        const value = Math.max(0, Number(series.values[index] || 0));
        const height = Math.max(6, Math.round((value / maxValue) * 100));
        return `
          <div class="habit-series-col">
            <div class="habit-series-track">
              <span class="habit-series-bar" style="height: ${height}%;"></span>
            </div>
            <span class="habit-series-value">${value}</span>
            <span class="habit-series-label">${escapeHtml(label)}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderGoalNameOptions(goals, selectedValue = '') {
  const safeGoals = Array.isArray(goals) ? goals : [];
  return `
    <option value="">No goal</option>
    ${safeGoals.map((goal) => `
      <option value="${escapeHtml(goal.name || '')}" ${String(goal.name || '') === String(selectedValue || '') ? 'selected' : ''}>
        ${escapeHtml(goal.name || '')}
      </option>
    `).join('')}
  `;
}

function renderSubgoalOptions(goals, selectedValue = '') {
  const safeGoals = Array.isArray(goals) ? goals : [];
  const groupsMarkup = safeGoals.map((goal) => {
    const subgoals = Array.isArray(goal.subgoals) ? goal.subgoals : [];
    if (!subgoals.length) return '';
    return `
      <optgroup label="${escapeHtml(goal.name || 'Goal')}">
        ${subgoals.map((subgoal) => {
          const title = String(subgoal.title || '');
          return `
            <option value="${escapeHtml(title)}" ${title === String(selectedValue || '') ? 'selected' : ''}>
              ${escapeHtml(title)}
            </option>
          `;
        }).join('')}
      </optgroup>
    `;
  }).join('');

  return `
    <option value="">No sub-goal</option>
    ${groupsMarkup}
  `;
}

function renderHabits(content, payload) {
  const habits = Array.isArray(payload.habits) ? payload.habits : [];
  const goals = Array.isArray(payload.goals) ? payload.goals : [];
  const today = payload.today || new Date().toISOString().slice(0, 10);

  const demoNote = payload.__demo
    ? `
      <div class="goals-demo-note">
        <i class="bi bi-flask"></i>
        <span>Demo data is enabled on localhost because API returned no habits yet.</span>
      </div>
    `
    : '';

  content.innerHTML = `
    <div class="habits-page" data-habits-today="${escapeHtml(today)}" data-habits-demo="${payload.__demo ? '1' : '0'}">
      ${demoNote}

      <section class="habits-hero">
        <article class="habit-stat-card">
          <span class="habit-stat-label">Completed today</span>
          <span class="habit-stat-value">${Number(payload.completed_habits || 0)}</span>
          <span class="habit-stat-meta">Out of ${Number(payload.total_habits || habits.length)}</span>
        </article>
        <article class="habit-stat-card">
          <span class="habit-stat-label">Best streak</span>
          <span class="habit-stat-value">${Number(payload.best_streak || 0)} days</span>
          <span class="habit-stat-meta">Current best chain</span>
        </article>
        <article class="habit-stat-card">
          <span class="habit-stat-label">Focus ritual</span>
          <span class="habit-stat-value">${escapeHtml(payload.focus_window || 'Night close')}</span>
          <span class="habit-stat-meta">Close your day with checklist</span>
        </article>
      </section>

      <section class="app-panel habits-card">
        <div class="habits-card-header">
          <div>
            <p class="goals-label">Tonight</p>
            <h3 class="goals-title">Daily checklist</h3>
          </div>
          <div class="habit-actions-inline">
            <button class="btn btn-outline-secondary btn-sm" type="button" data-action="habit-mark-all">Mark all complete</button>
          </div>
        </div>

        <form id="habit-create-form" class="habit-create-form">
          <input id="habit-name" type="text" placeholder="Habit name" required />
          <select id="habit-frequency">
            <option value="Daily">Daily</option>
            <option value="Weekdays">Weekdays</option>
            <option value="Weekends">Weekends</option>
            <option value="Custom">Custom</option>
          </select>
          <select id="habit-time">
            <option value="">Anytime</option>
            <option value="Morning">Morning</option>
            <option value="Afternoon">Afternoon</option>
            <option value="Evening">Evening</option>
          </select>
          <select id="habit-goal-name">
            ${renderGoalNameOptions(goals)}
          </select>
          <select id="habit-subgoal-name">
            ${renderSubgoalOptions(goals)}
          </select>
          <input id="habit-reminder" type="time" value="" />
          <button class="btn btn-primary btn-sm" type="submit">Add habit</button>
        </form>

        <div class="habit-list" id="habit-list">
          ${habits.length ? habits.map((habit) => `
            <article class="habit-item">
              <div class="habit-row ${habit.done ? 'is-done' : ''}">
                <div class="habit-left">
                  <label class="habit-checkbox">
                    <input
                      type="checkbox"
                      data-action="toggle-habit"
                      data-habit-id="${escapeHtml(String(habit.id || ''))}"
                      ${habit.done ? 'checked' : ''}
                    />
                    <span class="habit-checkmark"></span>
                  </label>
                  <div class="habit-text">
                    <span class="habit-name">${escapeHtml(habit.name || 'Untitled habit')}</span>
                    <span class="habit-meta">${escapeHtml(normalizeHabitMeta(habit))}</span>
                  </div>
                </div>
                <div class="habit-actions">
                  <span class="habit-streak">
                    <i class="bi bi-fire"></i>
                    ${Number(habit.streak || 0)} day streak
                  </span>
                  <button class="btn btn-outline-secondary btn-sm" type="button" data-action="edit-habit" data-habit-id="${escapeHtml(String(habit.id || ''))}">
                    Edit
                  </button>
                  <button class="btn btn-outline-danger btn-sm danger" type="button" data-action="delete-habit" data-habit-id="${escapeHtml(String(habit.id || ''))}">
                    Delete
                  </button>
                </div>
              </div>

              <form class="habit-edit-form" data-habit-edit-form data-habit-id="${escapeHtml(String(habit.id || ''))}">
                <div class="habit-edit-grid">
                  <label>
                    Habit name
                    <input type="text" name="name" value="${escapeHtml(habit.name || '')}" required />
                  </label>
                  <label>
                    Frequency
                    <select name="frequency">
                      <option value="Daily" ${habit.frequency === 'Daily' ? 'selected' : ''}>Daily</option>
                      <option value="Weekdays" ${habit.frequency === 'Weekdays' ? 'selected' : ''}>Weekdays</option>
                      <option value="Weekends" ${habit.frequency === 'Weekends' ? 'selected' : ''}>Weekends</option>
                      <option value="Custom" ${habit.frequency === 'Custom' ? 'selected' : ''}>Custom</option>
                    </select>
                  </label>
                  <label>
                    Time of day
                    <select name="time_of_day">
                      <option value="" ${habit.time_of_day ? '' : 'selected'}>Anytime</option>
                      <option value="Morning" ${habit.time_of_day === 'Morning' ? 'selected' : ''}>Morning</option>
                      <option value="Afternoon" ${habit.time_of_day === 'Afternoon' ? 'selected' : ''}>Afternoon</option>
                      <option value="Evening" ${habit.time_of_day === 'Evening' ? 'selected' : ''}>Evening</option>
                    </select>
                  </label>
                  <label>
                    Reminder
                    <input type="time" name="reminder" value="${escapeHtml(habit.reminder || '')}" />
                  </label>
                  <label>
                    Goal
                    <select name="goal_name">
                      ${renderGoalNameOptions(goals, habit.goal_name)}
                    </select>
                  </label>
                  <label>
                    Sub-goal
                    <select name="subgoal_name">
                      ${renderSubgoalOptions(goals, habit.subgoal_name)}
                    </select>
                  </label>
                </div>
                <label>
                  Notes
                  <textarea rows="2" name="notes">${escapeHtml(habit.notes || '')}</textarea>
                </label>
                <div class="habit-edit-actions">
                  <button class="btn btn-outline-secondary btn-sm" type="submit">Save changes</button>
                  <button class="btn btn-light btn-sm" type="button" data-action="cancel-habit-edit" data-habit-id="${escapeHtml(String(habit.id || ''))}">
                    Cancel
                  </button>
                </div>
              </form>
            </article>
          `).join('') : '<p class="muted">No habits yet.</p>'}
        </div>
      </section>

      <section class="app-panel habits-chart">
        <div class="habits-card-header">
          <div>
            <p class="goals-label">Progress</p>
            <h3 class="goals-title">Habit completion over time</h3>
          </div>
          <span class="habit-chart-note">Last 14 days</span>
        </div>
        ${renderHabitSeriesChart(payload.habit_series, habits)}
      </section>
    </div>
  `;
}

async function bindHabitActions(container, currentPath, payload) {
  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  const habitsRoot = content.querySelector('.habits-page');
  const today = habitsRoot?.dataset.habitsToday || payload.today || new Date().toISOString().slice(0, 10);
  const isDemo = habitsRoot?.dataset.habitsDemo === '1';

  const createForm = content.querySelector('#habit-create-form');
  if (createForm) {
    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const nameInput = content.querySelector('#habit-name');
      const frequencyInput = content.querySelector('#habit-frequency');
      const timeInput = content.querySelector('#habit-time');
      const goalInput = content.querySelector('#habit-goal-name');
      const subgoalInput = content.querySelector('#habit-subgoal-name');
      const reminderInput = content.querySelector('#habit-reminder');

      const name = nameInput instanceof HTMLInputElement ? nameInput.value.trim() : '';
      const frequency = frequencyInput instanceof HTMLSelectElement ? frequencyInput.value : 'Daily';
      const timeOfDay = timeInput instanceof HTMLSelectElement ? timeInput.value : '';
      const goalName = goalInput instanceof HTMLSelectElement ? goalInput.value : '';
      const subgoalName = subgoalInput instanceof HTMLSelectElement ? subgoalInput.value : '';
      const reminder = reminderInput instanceof HTMLInputElement ? reminderInput.value : '';

      if (!name) return;

      try {
        await appApi.createHabit({
          name,
          frequency,
          time_of_day: timeOfDay,
          reminder,
          notes: '',
          goal_name: goalName,
          subgoal_name: subgoalName
        });
        showToast('Habit created', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to create habit', 'error');
      }
    });
  }

  const closeAllEditForms = () => {
    content.querySelectorAll('[data-habit-edit-form].is-open').forEach((form) => {
      form.classList.remove('is-open');
    });
  };

  content.querySelectorAll('[data-action="edit-habit"]').forEach((button) => {
    button.addEventListener('click', () => {
      const habitId = button.dataset.habitId;
      if (!habitId) return;
      const targetForm = Array.from(content.querySelectorAll('[data-habit-edit-form]'))
        .find((form) => form.dataset.habitId === habitId);
      if (!targetForm) return;
      const shouldOpen = !targetForm.classList.contains('is-open');
      closeAllEditForms();
      if (shouldOpen) {
        targetForm.classList.add('is-open');
        const firstInput = targetForm.querySelector('input[name="name"]');
        if (firstInput instanceof HTMLInputElement) {
          firstInput.focus();
          firstInput.select();
        }
      }
    });
  });

  content.querySelectorAll('[data-action="cancel-habit-edit"]').forEach((button) => {
    button.addEventListener('click', () => {
      const habitId = button.dataset.habitId;
      if (!habitId) return;
      const targetForm = Array.from(content.querySelectorAll('[data-habit-edit-form]'))
        .find((form) => form.dataset.habitId === habitId);
      if (!targetForm) return;
      targetForm.classList.remove('is-open');
    });
  });

  content.querySelectorAll('[data-habit-edit-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const habitId = form.dataset.habitId;
      if (!habitId) return;

      if (isDemo && String(habitId).startsWith('demo-')) {
        showToast('Demo habit: connect API data to save changes.', 'info');
        return;
      }

      const name = form.querySelector('input[name="name"]')?.value?.trim() || '';
      const frequency = form.querySelector('select[name="frequency"]')?.value || 'Daily';
      const timeOfDay = form.querySelector('select[name="time_of_day"]')?.value || '';
      const reminder = form.querySelector('input[name="reminder"]')?.value || '';
      const notes = form.querySelector('textarea[name="notes"]')?.value || '';
      const goalName = form.querySelector('select[name="goal_name"]')?.value || '';
      const subgoalName = form.querySelector('select[name="subgoal_name"]')?.value || '';

      if (!name) return;

      try {
        await appApi.updateHabit(habitId, {
          name,
          frequency,
          time_of_day: timeOfDay,
          reminder,
          notes,
          goal_name: goalName,
          subgoal_name: subgoalName
        });
        showToast('Habit updated', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to update habit', 'error');
      }
    });
  });

  content.querySelectorAll('[data-action="toggle-habit"]').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      const habitId = checkbox.dataset.habitId;
      if (!habitId) return;

      if (isDemo && String(habitId).startsWith('demo-')) {
        showToast('Demo habit: connect API data to update this item.', 'info');
        checkbox.checked = !checkbox.checked;
        return;
      }

      try {
        await appApi.toggleHabit(habitId, { done: checkbox.checked, date: today });
        showToast('Habit updated', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to update habit', 'error');
      }
    });
  });

  content.querySelectorAll('[data-action="delete-habit"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const habitId = button.dataset.habitId;
      if (!habitId) return;

      if (isDemo && String(habitId).startsWith('demo-')) {
        showToast('Demo habit: connect API data to delete this item.', 'info');
        return;
      }

      try {
        await appApi.deleteHabit(habitId);
        showToast('Habit deleted', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to delete habit', 'error');
      }
    });
  });

  const markAllButton = content.querySelector('[data-action="habit-mark-all"]');
  if (markAllButton) {
    markAllButton.addEventListener('click', async () => {
      const pending = Array.from(content.querySelectorAll('[data-action="toggle-habit"]'))
        .filter((checkbox) => !checkbox.checked && Boolean(checkbox.dataset.habitId));
      if (!pending.length) {
        showToast('All habits are already complete.', 'info');
        return;
      }

      if (isDemo) {
        showToast('Demo mode: this action will work with live API habits.', 'info');
        return;
      }

      markAllButton.disabled = true;
      try {
        await Promise.all(
          pending.map((checkbox) => appApi.toggleHabit(checkbox.dataset.habitId, { done: true, date: today }))
        );
        showToast('All habits marked complete', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to update all habits', 'error');
      } finally {
        markAllButton.disabled = false;
      }
    });
  }

  content.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeAllEditForms();
  });
}

function buildPlannerDemoPayload() {
  const today = new Date().toISOString().slice(0, 10);
  const habits = [
    {
      id: 'demo-planner-habit-1',
      name: 'Morning architecture pass',
      meta: 'Daily • Morning',
      frequency: 'Daily',
      time_of_day: 'Morning',
      done: true,
      streak: 9
    },
    {
      id: 'demo-planner-habit-2',
      name: 'Ship one UI improvement',
      meta: 'Weekdays • Afternoon',
      frequency: 'Weekdays',
      time_of_day: 'Afternoon',
      done: false,
      streak: 6
    },
    {
      id: 'demo-planner-habit-3',
      name: 'Evening retrospective',
      meta: 'Daily • Evening',
      frequency: 'Daily',
      time_of_day: 'Evening',
      done: false,
      streak: 12
    }
  ];

  const todos = [
    { id: 'demo-planner-todo-1', name: 'Review API gateway path map' },
    { id: 'demo-planner-todo-2', name: 'Finalize BFF route list' }
  ];

  const doneTodos = [
    { id: 'demo-planner-done-1', name: 'Migrate weekly goals to PWA' }
  ];

  return {
    today,
    habits,
    habits_summary: {
      total: habits.length,
      completed: habits.filter((habit) => Boolean(habit.done)).length,
      best_streak: Math.max(0, ...habits.map((habit) => Number(habit.streak || 0)))
    },
    todos,
    done_todos: doneTodos,
    __demo: true
  };
}

function withPlannerDemoPayload(payload) {
  const safe = payload && typeof payload === 'object' ? payload : {};
  const hasHabits = Array.isArray(safe.habits) && safe.habits.length > 0;
  const hasTodos = Array.isArray(safe.todos) && safe.todos.length > 0;
  const hasDoneTodos = Array.isArray(safe.done_todos) && safe.done_todos.length > 0;

  if (!isLocalhostRuntime() || hasHabits || hasTodos || hasDoneTodos) {
    return safe;
  }

  const demo = buildPlannerDemoPayload();
  return {
    ...demo,
    ...safe,
    habits: hasHabits ? safe.habits : demo.habits,
    todos: hasTodos ? safe.todos : demo.todos,
    done_todos: hasDoneTodos ? safe.done_todos : demo.done_todos,
    habits_summary: safe.habits_summary && typeof safe.habits_summary === 'object'
      ? safe.habits_summary
      : demo.habits_summary,
    today: safe.today || demo.today,
    __demo: true
  };
}

function normalizePlannerHabitMeta(habit) {
  if (habit && habit.meta) return String(habit.meta);
  const parts = [];
  if (habit && habit.frequency) parts.push(String(habit.frequency));
  if (habit && habit.time_of_day) parts.push(String(habit.time_of_day));
  return parts.length ? parts.join(' • ') : 'Anytime';
}

function renderPlanner(content, payload) {
  const habits = Array.isArray(payload.habits) ? payload.habits : [];
  const todos = Array.isArray(payload.todos) ? payload.todos : [];
  const doneTodos = Array.isArray(payload.done_todos) ? payload.done_todos : [];
  const habitsSummary = payload.habits_summary && typeof payload.habits_summary === 'object'
    ? payload.habits_summary
    : {
      total: habits.length,
      completed: habits.filter((habit) => Boolean(habit.done)).length,
      best_streak: Math.max(0, ...habits.map((habit) => Number(habit.streak || 0)))
    };

  const demoNote = payload.__demo
    ? `
      <div class="goals-demo-note">
        <i class="bi bi-flask"></i>
        <span>Demo data is enabled on localhost because API returned no planner data yet.</span>
      </div>
    `
    : '';

  content.innerHTML = `
    <div class="planner-page" data-planner-today="${escapeHtml(payload.today || '')}" data-planner-demo="${payload.__demo ? '1' : '0'}">
      ${demoNote}

      <section class="planner-hero">
        <article class="planner-stat-card">
          <span class="planner-stat-label">Habits done</span>
          <span class="planner-stat-value">${Number(habitsSummary.completed || 0)}</span>
          <span class="planner-stat-meta">Out of ${Number(habitsSummary.total || habits.length)}</span>
        </article>
        <article class="planner-stat-card">
          <span class="planner-stat-label">To-do items</span>
          <span class="planner-stat-value">${todos.length}</span>
          <span class="planner-stat-meta">${doneTodos.length} done today</span>
        </article>
        <article class="planner-stat-card">
          <span class="planner-stat-label">Best habit streak</span>
          <span class="planner-stat-value">${Number(habitsSummary.best_streak || 0)} days</span>
          <span class="planner-stat-meta">Keep the chain strong</span>
        </article>
      </section>

      <section class="app-panel planner-headline">
        <div class="planner-headline-row">
          <div>
            <p class="goals-label">Planner</p>
            <h3 class="goals-title">Habits and to-dos in one focused view</h3>
          </div>
          <div class="planner-toggle" role="group" aria-label="Planner view toggle">
            <button class="planner-toggle-btn is-active" type="button" data-planner-panel="habits" aria-pressed="true">Habits</button>
            <button class="planner-toggle-btn" type="button" data-planner-panel="todos" aria-pressed="false">To-dos</button>
          </div>
        </div>
      </section>

      <section class="planner-grid">
        <article class="app-panel planner-card is-active" data-planner-section="habits">
          <div class="planner-card-header">
            <div>
              <p class="goals-label">Habits</p>
              <h3 class="goals-title">Always-on routines</h3>
            </div>
            <span class="planner-panel-meta">${Number(habitsSummary.completed || 0)} / ${Number(habitsSummary.total || habits.length)}</span>
          </div>

          <form id="planner-habit-form" class="planner-form">
            <input id="planner-habit-name" type="text" placeholder="New habit" required />
            <select id="planner-habit-frequency">
              <option value="Daily">Daily</option>
              <option value="Weekdays">Weekdays</option>
              <option value="Weekends">Weekends</option>
            </select>
            <select id="planner-habit-time">
              <option value="">Anytime</option>
              <option value="Morning">Morning</option>
              <option value="Afternoon">Afternoon</option>
              <option value="Evening">Evening</option>
            </select>
            <button class="btn btn-primary btn-sm" type="submit">Add habit</button>
          </form>

          <div class="planner-habit-list">
            ${habits.length ? habits.map((habit) => `
              <article class="planner-habit-row ${habit.done ? 'is-done' : ''}">
                <label class="planner-habit-left">
                  <input type="checkbox" data-action="planner-toggle-habit" data-habit-id="${escapeHtml(String(habit.id || ''))}" ${habit.done ? 'checked' : ''} />
                  <span class="planner-habit-text">
                    <span class="planner-habit-name">${escapeHtml(habit.name || 'Untitled habit')}</span>
                    <span class="planner-habit-meta">${escapeHtml(normalizePlannerHabitMeta(habit))}</span>
                  </span>
                </label>
                <span class="planner-badge">
                  <i class="bi bi-fire"></i>
                  ${Number(habit.streak || 0)}d
                </span>
              </article>
            `).join('') : '<p class="muted">No habits yet. Add one to build your rhythm.</p>'}
          </div>
        </article>

        <article class="app-panel planner-card" data-planner-section="todos">
          <div class="planner-card-header">
            <div>
              <p class="goals-label">To-do</p>
              <h3 class="goals-title">Daily execution list</h3>
            </div>
            <span class="planner-panel-meta">${doneTodos.length} done today</span>
          </div>

          <form id="todo-create-form" class="planner-form planner-task-form">
            <input id="todo-name" type="text" placeholder="New to-do" required />
            <button class="btn btn-primary btn-sm" type="submit">Add</button>
          </form>

          <div class="planner-todo">
            <h4>To do now</h4>
            ${todos.length ? `
              <ul class="planner-task-list">
                ${todos.map((todo) => `
                  <li class="planner-task-item">
                    <div class="planner-task-info">
                      <span class="planner-task-title">${escapeHtml(todo.name || 'Untitled task')}</span>
                      <span class="planner-task-meta">Today</span>
                    </div>
                    <div class="planner-task-actions">
                      <button class="btn btn-outline-success btn-sm" data-action="todo-done" data-todo-id="${escapeHtml(String(todo.id || ''))}" type="button">
                        Done
                      </button>
                      <button class="btn btn-outline-danger btn-sm danger" data-action="todo-delete" data-todo-id="${escapeHtml(String(todo.id || ''))}" type="button">
                        Delete
                      </button>
                    </div>
                  </li>
                `).join('')}
              </ul>
            ` : '<p class="muted">All clear. Add a to-do or plan tomorrow.</p>'}
          </div>

          <div class="planner-todo planner-todo-done">
            <h4>Done today</h4>
            ${doneTodos.length ? `
              <ul class="planner-task-list">
                ${doneTodos.map((todo) => `
                  <li class="planner-task-item is-done">
                    <div class="planner-task-info">
                      <span class="planner-task-title">${escapeHtml(todo.name || 'Untitled task')}</span>
                      <span class="planner-task-meta">Done</span>
                    </div>
                    <div class="planner-task-actions">
                      <button class="btn btn-outline-secondary btn-sm" data-action="todo-reopen" data-todo-id="${escapeHtml(String(todo.id || ''))}" type="button">
                        Reopen
                      </button>
                      <button class="btn btn-outline-danger btn-sm danger" data-action="todo-delete" data-todo-id="${escapeHtml(String(todo.id || ''))}" type="button">
                        Delete
                      </button>
                    </div>
                  </li>
                `).join('')}
              </ul>
            ` : '<p class="muted">Nothing checked off yet.</p>'}
          </div>
        </article>
      </section>
    </div>
  `;
}

async function bindPlannerActions(container, currentPath, payload) {
  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  const plannerPage = content.querySelector('.planner-page');
  const today = plannerPage?.dataset.plannerToday || payload.today || new Date().toISOString().slice(0, 10);
  const isDemo = plannerPage?.dataset.plannerDemo === '1';

  const activatePlannerPanel = (target) => {
    const safeTarget = target === 'todos' ? 'todos' : 'habits';
    content.querySelectorAll('[data-planner-panel]').forEach((button) => {
      const isActive = button.dataset.plannerPanel === safeTarget;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    content.querySelectorAll('[data-planner-section]').forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.plannerSection === safeTarget);
    });
  };

  content.querySelectorAll('[data-planner-panel]').forEach((button) => {
    button.addEventListener('click', () => {
      activatePlannerPanel(button.dataset.plannerPanel);
    });
  });

  activatePlannerPanel('habits');

  const habitForm = content.querySelector('#planner-habit-form');
  if (habitForm) {
    habitForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const nameInput = content.querySelector('#planner-habit-name');
      const frequencyInput = content.querySelector('#planner-habit-frequency');
      const timeInput = content.querySelector('#planner-habit-time');
      const name = nameInput instanceof HTMLInputElement ? nameInput.value.trim() : '';
      const frequency = frequencyInput instanceof HTMLSelectElement ? frequencyInput.value : 'Daily';
      const timeOfDay = timeInput instanceof HTMLSelectElement ? timeInput.value : '';
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

  content.querySelectorAll('[data-action="planner-toggle-habit"]').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      const habitId = checkbox.dataset.habitId;
      if (!habitId) return;

      if (isDemo && String(habitId).startsWith('demo-')) {
        showToast('Demo habit: connect API data to update this item.', 'info');
        checkbox.checked = !checkbox.checked;
        return;
      }

      try {
        await appApi.toggleHabit(habitId, { done: checkbox.checked, date: today });
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
      const nameInput = content.querySelector('#todo-name');
      const name = nameInput instanceof HTMLInputElement ? nameInput.value.trim() : '';
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
      const todoId = button.dataset.todoId;
      if (!todoId) return;
      if (isDemo && String(todoId).startsWith('demo-')) {
        showToast('Demo to-do: connect API data to update this item.', 'info');
        return;
      }
      try {
        await appApi.toggleTodo(todoId, true);
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to complete to-do', 'error');
      }
    });
  });

  content.querySelectorAll('[data-action="todo-reopen"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const todoId = button.dataset.todoId;
      if (!todoId) return;
      if (isDemo && String(todoId).startsWith('demo-')) {
        showToast('Demo to-do: connect API data to update this item.', 'info');
        return;
      }
      try {
        await appApi.toggleTodo(todoId, false);
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to reopen to-do', 'error');
      }
    });
  });

  content.querySelectorAll('[data-action="todo-delete"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const todoId = button.dataset.todoId;
      if (!todoId) return;
      if (isDemo && String(todoId).startsWith('demo-')) {
        showToast('Demo to-do: connect API data to delete this item.', 'info');
        return;
      }
      try {
        await appApi.deleteTodo(todoId);
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to delete to-do', 'error');
      }
    });
  });
}

const DEFAULT_REMINDER_WEEKDAY_OPTIONS = [
  { value: '0', label: 'Mon' },
  { value: '1', label: 'Tue' },
  { value: '2', label: 'Wed' },
  { value: '3', label: 'Thu' },
  { value: '4', label: 'Fri' },
  { value: '5', label: 'Sat' },
  { value: '6', label: 'Sun' }
];

function normalizeReminderWeekdayOptions(options) {
  if (!Array.isArray(options) || !options.length) {
    return DEFAULT_REMINDER_WEEKDAY_OPTIONS;
  }
  const normalized = options.map((item, index) => {
    const fallback = DEFAULT_REMINDER_WEEKDAY_OPTIONS[index % DEFAULT_REMINDER_WEEKDAY_OPTIONS.length];
    const value = item && item.value !== undefined ? String(item.value) : fallback.value;
    const label = item && item.label ? String(item.label) : fallback.label;
    return { value, label };
  }).filter((item) => item.value !== '');

  return normalized.length ? normalized : DEFAULT_REMINDER_WEEKDAY_OPTIONS;
}

function normalizeReminderRepeatDays(reminder) {
  if (Array.isArray(reminder?.repeat_days_list) && reminder.repeat_days_list.length) {
    return reminder.repeat_days_list.map((day) => String(day));
  }
  if (Array.isArray(reminder?.repeat_days) && reminder.repeat_days.length) {
    return reminder.repeat_days.map((day) => String(day));
  }
  if (typeof reminder?.repeat_days === 'string' && reminder.repeat_days.trim()) {
    return reminder.repeat_days.split(',').map((day) => day.trim()).filter(Boolean);
  }
  return [];
}

function reminderPriorityClass(priority) {
  const safe = String(priority || 'normal').toLowerCase();
  if (safe === 'low') return 'priority-low';
  if (safe === 'high') return 'priority-high';
  return 'priority-normal';
}

function reminderPriorityLabel(priority) {
  const safe = String(priority || 'normal').toLowerCase();
  if (safe === 'low') return 'Low';
  if (safe === 'high') return 'High';
  return 'Normal';
}

function reminderStatusInfo(reminder) {
  const status = String(reminder?.status || '').toLowerCase();
  if (status === 'paused') return { label: 'Paused', className: 'status-muted' };
  if (status === 'overdue') return { label: 'Overdue', className: 'status-warning' };
  if (status === 'unscheduled') return { label: 'Unscheduled', className: 'status-muted' };
  return { label: 'Upcoming', className: 'status-ok' };
}

function renderReminderDayChips(weekdayOptions, selectedDays, idPrefix) {
  const selected = new Set((Array.isArray(selectedDays) ? selectedDays : []).map((day) => String(day)));
  return weekdayOptions.map((day, index) => {
    const value = String(day.value ?? index);
    const label = String(day.label ?? value);
    const inputId = `${idPrefix}-${index}-${value}`;
    return `
      <label class="day-chip" for="${escapeHtml(inputId)}">
        <input type="checkbox" id="${escapeHtml(inputId)}" name="repeat_days" value="${escapeHtml(value)}" ${selected.has(value) ? 'checked' : ''} />
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }).join('');
}

function buildRemindersDemoPayload() {
  const todayDate = new Date();
  const today = todayDate.toISOString().slice(0, 10);
  const yesterday = new Date(todayDate.getTime() - 86400000).toISOString().slice(0, 10);

  const reminders = [
    {
      id: 'demo-reminder-1',
      title: 'Evening architecture check',
      remind_date: today,
      remind_time: '21:00',
      repeat_interval: 'daily',
      repeat_days: '',
      repeat_days_list: [],
      priority: 'normal',
      notes: 'Review API gateway route map before shutting down the day.',
      is_active: true,
      channel_toast: true,
      channel_system: false,
      play_sound: false,
      status: 'upcoming',
      next_label: 'Today at 21:00',
      repeat_label: 'Daily',
      channels_label: 'In-app',
      timezone_name: 'Local'
    },
    {
      id: 'demo-reminder-2',
      title: 'Weekly BFF checkpoint',
      remind_date: today,
      remind_time: '10:00',
      repeat_interval: 'weekly',
      repeat_days: '1,3',
      repeat_days_list: [1, 3],
      priority: 'high',
      notes: 'Validate API contracts and path-level routing changes.',
      is_active: true,
      channel_toast: true,
      channel_system: true,
      play_sound: true,
      status: 'upcoming',
      next_label: 'Tomorrow at 10:00',
      repeat_label: 'Weekly · Tue, Thu',
      channels_label: 'In-app · System · Sound',
      timezone_name: 'Local'
    },
    {
      id: 'demo-reminder-3',
      title: 'Upload deployment notes',
      remind_date: yesterday,
      remind_time: '18:30',
      repeat_interval: 'none',
      repeat_days: '',
      repeat_days_list: [],
      priority: 'low',
      notes: '',
      is_active: false,
      channel_toast: true,
      channel_system: false,
      play_sound: false,
      status: 'paused',
      next_label: 'Paused',
      repeat_label: 'One-time',
      channels_label: 'In-app',
      timezone_name: 'Local'
    }
  ];

  const active = reminders.filter((reminder) => Boolean(reminder.is_active));
  const overdue = reminders.filter((reminder) => reminder.status === 'overdue');

  return {
    reminders,
    reminders_summary: {
      total: reminders.length,
      active: active.length,
      overdue: overdue.length,
      next_label: 'Today at 21:00'
    },
    notification_settings: {
      enabled: true,
      interval_minutes: 10,
      show_toast: true,
      show_system: false,
      play_sound: false,
      title: 'Tracking reminder',
      message: 'Start a Pomodoro to keep tracking your focus.'
    },
    weekday_options: DEFAULT_REMINDER_WEEKDAY_OPTIONS,
    today,
    __demo: true
  };
}

function withRemindersDemoPayload(payload) {
  const safe = payload && typeof payload === 'object' ? payload : {};
  const hasReminders = Array.isArray(safe.reminders) && safe.reminders.length > 0;
  if (!isLocalhostRuntime() || hasReminders) {
    return safe;
  }

  const demo = buildRemindersDemoPayload();
  return {
    ...demo,
    ...safe,
    reminders: hasReminders ? safe.reminders : demo.reminders,
    reminders_summary: safe.reminders_summary && typeof safe.reminders_summary === 'object'
      ? safe.reminders_summary
      : demo.reminders_summary,
    notification_settings: safe.notification_settings && typeof safe.notification_settings === 'object'
      ? safe.notification_settings
      : demo.notification_settings,
    weekday_options: Array.isArray(safe.weekday_options) && safe.weekday_options.length
      ? safe.weekday_options
      : demo.weekday_options,
    today: safe.today || demo.today,
    __demo: true
  };
}

function renderReminders(content, payload) {
  const reminders = Array.isArray(payload.reminders) ? payload.reminders : [];
  const weekdayOptions = normalizeReminderWeekdayOptions(payload.weekday_options);
  const today = payload.today || new Date().toISOString().slice(0, 10);
  const summary = payload.reminders_summary && typeof payload.reminders_summary === 'object'
    ? payload.reminders_summary
    : {
      total: reminders.length,
      active: reminders.filter((reminder) => Boolean(reminder.is_active)).length,
      overdue: reminders.filter((reminder) => reminder.status === 'overdue').length,
      next_label: '-'
    };
  const notificationSettings = payload.notification_settings && typeof payload.notification_settings === 'object'
    ? payload.notification_settings
    : {
      enabled: false,
      interval_minutes: 30,
      show_toast: true,
      show_system: true,
      play_sound: false,
      title: 'Tracking reminder',
      message: 'Start a Pomodoro to keep tracking your focus.'
    };
  const intervalOptions = [1, 5, 10, 15, 20, 30];

  const demoNote = payload.__demo
    ? `
      <div class="goals-demo-note">
        <i class="bi bi-flask"></i>
        <span>Demo data is enabled on localhost because API returned no reminders yet.</span>
      </div>
    `
    : '';

  content.innerHTML = `
    <div class="reminders-page" data-reminders-today="${escapeHtml(today)}" data-reminders-demo="${payload.__demo ? '1' : '0'}">
      ${demoNote}

      <section class="reminders-hero">
        <article class="reminder-stat-card">
          <span class="reminder-stat-label">Total reminders</span>
          <span class="reminder-stat-value">${Number(summary.total || 0)}</span>
          <span class="reminder-stat-meta">Across all schedules</span>
        </article>
        <article class="reminder-stat-card">
          <span class="reminder-stat-label">Active now</span>
          <span class="reminder-stat-value">${Number(summary.active || 0)}</span>
          <span class="reminder-stat-meta">Currently running</span>
        </article>
        <article class="reminder-stat-card">
          <span class="reminder-stat-label">Overdue</span>
          <span class="reminder-stat-value">${Number(summary.overdue || 0)}</span>
          <span class="reminder-stat-meta">Need attention</span>
        </article>
        <article class="reminder-stat-card">
          <span class="reminder-stat-label">Next up</span>
          <span class="reminder-stat-value">${escapeHtml(summary.next_label || '-')}</span>
          <span class="reminder-stat-meta">Local timezone</span>
        </article>
      </section>

      <section class="reminders-grid">
        <div class="reminders-main">
          <section class="app-panel reminders-card">
            <div class="reminders-card-header">
              <div>
                <p class="goals-label">Create</p>
                <h3 class="goals-title">New reminder</h3>
              </div>
            </div>

            <form id="reminder-create-form" class="reminder-form">
              <div class="reminder-form-grid">
                <label class="reminder-field">
                  Title
                  <input type="text" name="title" placeholder="Focus check-in, standup, call mom" required />
                </label>
                <label class="reminder-field">
                  Date
                  <input type="date" name="remind_date" value="${escapeHtml(today)}" required />
                </label>
                <label class="reminder-field">
                  Time
                  <input type="time" name="remind_time" value="09:00" required />
                </label>
                <label class="reminder-field">
                  Repeat
                  <select name="repeat_interval" data-reminder-repeat-select>
                    <option value="none">One-time</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>
              </div>

              <div class="repeat-days is-hidden" data-repeat-days>
                ${renderReminderDayChips(weekdayOptions, [], 'reminder-create-day')}
              </div>

              <div class="reminder-form-grid">
                <label class="reminder-field">
                  Priority
                  <select name="priority">
                    <option value="low">Low</option>
                    <option value="normal" selected>Normal</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <label class="reminder-field">
                  Notes
                  <textarea name="notes" rows="3" placeholder="Context, links, or a short prep list."></textarea>
                </label>
              </div>

              <div class="reminder-options">
                <label class="reminder-switch">
                  <input type="checkbox" name="is_active" checked />
                  <span>Active</span>
                </label>
                <label class="reminder-switch">
                  <input type="checkbox" name="channel_toast" checked />
                  <span>In-app popup</span>
                </label>
                <label class="reminder-switch">
                  <input type="checkbox" name="channel_system" />
                  <span>System notification</span>
                </label>
                <label class="reminder-switch">
                  <input type="checkbox" name="play_sound" />
                  <span>Play sound</span>
                </label>
              </div>

              <div class="reminder-actions">
                <button class="btn btn-primary btn-sm" type="submit">
                  <i class="bi bi-plus-lg"></i>
                  Add reminder
                </button>
              </div>
            </form>
          </section>

          <section class="app-panel reminders-card">
            <div class="reminders-card-header">
              <div>
                <p class="goals-label">Schedule</p>
                <h3 class="goals-title">Your reminders</h3>
              </div>
            </div>

            ${reminders.length ? `
              <div class="reminder-list">
                ${reminders.map((reminder, index) => {
                  const reminderId = String(reminder.id || '');
                  const repeatInterval = String(reminder.repeat_interval || 'none').toLowerCase();
                  const selectedDays = normalizeReminderRepeatDays(reminder);
                  const status = reminderStatusInfo(reminder);
                  return `
                    <article class="reminder-item ${reminder.status === 'overdue' ? 'is-overdue' : ''} ${reminder.status === 'paused' ? 'is-paused' : ''}">
                      <div class="reminder-item-header">
                        <div>
                          <h3>${escapeHtml(reminder.title || 'Untitled reminder')}</h3>
                          <p class="reminder-subtitle">${escapeHtml(reminder.next_label || '-')}</p>
                        </div>
                        <div class="reminder-badges">
                          <span class="reminder-pill ${reminderPriorityClass(reminder.priority)}">${reminderPriorityLabel(reminder.priority)}</span>
                          <span class="reminder-pill ${status.className}">${status.label}</span>
                        </div>
                      </div>

                      <div class="reminder-meta">
                        <span><i class="bi bi-repeat"></i> ${escapeHtml(reminder.repeat_label || 'One-time')}</span>
                        <span><i class="bi bi-bell"></i> ${escapeHtml(reminder.channels_label || 'No alerts')}</span>
                        <span><i class="bi bi-globe"></i> ${escapeHtml(reminder.timezone_name || '-')}</span>
                      </div>

                      ${reminder.notes ? `<p class="reminder-notes">${escapeHtml(reminder.notes)}</p>` : ''}

                      <div class="reminder-actions-row">
                        <button class="btn btn-outline-secondary btn-sm" type="button" data-action="edit-reminder" data-reminder-id="${escapeHtml(reminderId)}">
                          <i class="bi bi-pencil"></i>
                          Edit
                        </button>
                        <button class="btn btn-outline-primary btn-sm" type="button" data-action="toggle-reminder" data-reminder-id="${escapeHtml(reminderId)}" data-is-active="${reminder.is_active ? '0' : '1'}">
                          <i class="bi bi-power"></i>
                          ${reminder.is_active ? 'Pause' : 'Resume'}
                        </button>
                        <button class="btn btn-outline-danger btn-sm danger" type="button" data-action="delete-reminder" data-reminder-id="${escapeHtml(reminderId)}">
                          <i class="bi bi-trash"></i>
                          Delete
                        </button>
                      </div>

                      <form class="reminder-edit-form" data-reminder-edit-form data-reminder-id="${escapeHtml(reminderId)}">
                        <div class="reminder-form-grid">
                          <label class="reminder-field">
                            Title
                            <input type="text" name="title" value="${escapeHtml(reminder.title || '')}" required />
                          </label>
                          <label class="reminder-field">
                            Date
                            <input type="date" name="remind_date" value="${escapeHtml(reminder.remind_date || today)}" required />
                          </label>
                          <label class="reminder-field">
                            Time
                            <input type="time" name="remind_time" value="${escapeHtml(reminder.remind_time || '09:00')}" required />
                          </label>
                          <label class="reminder-field">
                            Repeat
                            <select name="repeat_interval" data-reminder-repeat-select>
                              <option value="none" ${repeatInterval === 'none' ? 'selected' : ''}>One-time</option>
                              <option value="daily" ${repeatInterval === 'daily' ? 'selected' : ''}>Daily</option>
                              <option value="weekly" ${repeatInterval === 'weekly' ? 'selected' : ''}>Weekly</option>
                              <option value="monthly" ${repeatInterval === 'monthly' ? 'selected' : ''}>Monthly</option>
                            </select>
                          </label>
                        </div>

                        <div class="repeat-days ${repeatInterval === 'weekly' ? '' : 'is-hidden'}" data-repeat-days>
                          ${renderReminderDayChips(weekdayOptions, selectedDays, `reminder-edit-${index}`)}
                        </div>

                        <div class="reminder-form-grid">
                          <label class="reminder-field">
                            Priority
                            <select name="priority">
                              <option value="low" ${String(reminder.priority || '').toLowerCase() === 'low' ? 'selected' : ''}>Low</option>
                              <option value="normal" ${String(reminder.priority || 'normal').toLowerCase() === 'normal' ? 'selected' : ''}>Normal</option>
                              <option value="high" ${String(reminder.priority || '').toLowerCase() === 'high' ? 'selected' : ''}>High</option>
                            </select>
                          </label>
                          <label class="reminder-field">
                            Notes
                            <textarea name="notes" rows="3">${escapeHtml(reminder.notes || '')}</textarea>
                          </label>
                        </div>

                        <div class="reminder-options">
                          <label class="reminder-switch">
                            <input type="checkbox" name="is_active" ${reminder.is_active ? 'checked' : ''} />
                            <span>Active</span>
                          </label>
                          <label class="reminder-switch">
                            <input type="checkbox" name="channel_toast" ${reminder.channel_toast ? 'checked' : ''} />
                            <span>In-app popup</span>
                          </label>
                          <label class="reminder-switch">
                            <input type="checkbox" name="channel_system" ${reminder.channel_system ? 'checked' : ''} />
                            <span>System notification</span>
                          </label>
                          <label class="reminder-switch">
                            <input type="checkbox" name="play_sound" ${reminder.play_sound ? 'checked' : ''} />
                            <span>Play sound</span>
                          </label>
                        </div>

                        <div class="reminder-actions-row">
                          <button class="btn btn-outline-primary btn-sm" type="submit">
                            <i class="bi bi-check2"></i>
                            Save changes
                          </button>
                          <button class="btn btn-light btn-sm" type="button" data-action="cancel-reminder-edit" data-reminder-id="${escapeHtml(reminderId)}">
                            Cancel
                          </button>
                        </div>
                      </form>
                    </article>
                  `;
                }).join('')}
              </div>
            ` : `
              <div class="reminder-empty">
                <p class="muted">No reminders yet. Create one to keep yourself on track.</p>
              </div>
            `}
          </section>
        </div>

        <aside class="app-panel reminders-card reminders-settings">
          <div class="reminders-card-header">
            <div>
              <p class="goals-label">Focus nudges</p>
              <h3 class="goals-title">Tracking reminder</h3>
            </div>
          </div>

          <form id="reminder-notification-form" class="reminder-form reminder-notification-form">
            <label class="reminder-switch">
              <input type="checkbox" name="notifications_enabled" ${notificationSettings.enabled ? 'checked' : ''} />
              <span>Remind me when Pomodoro is off</span>
            </label>

            <label class="reminder-field">
              Reminder interval (minutes)
              <select name="notifications_interval_minutes">
                ${intervalOptions.map((minutes) => `
                  <option value="${minutes}" ${Number(notificationSettings.interval_minutes || 30) === minutes ? 'selected' : ''}>
                    ${minutes} minute${minutes === 1 ? '' : 's'}
                  </option>
                `).join('')}
              </select>
            </label>

            <div class="reminder-options">
              <label class="reminder-switch">
                <input type="checkbox" name="notifications_show_toast" ${notificationSettings.show_toast ? 'checked' : ''} />
                <span>In-app popup</span>
              </label>
              <label class="reminder-switch">
                <input type="checkbox" name="notifications_show_system" ${notificationSettings.show_system ? 'checked' : ''} />
                <span>System notification</span>
              </label>
              <label class="reminder-switch">
                <input type="checkbox" name="notifications_play_sound" ${notificationSettings.play_sound ? 'checked' : ''} />
                <span>Play sound</span>
              </label>
            </div>

            <label class="reminder-field">
              Popup title
              <input type="text" name="notifications_title" value="${escapeHtml(notificationSettings.title || '')}" />
            </label>
            <label class="reminder-field">
              Popup message
              <textarea name="notifications_message" rows="3">${escapeHtml(notificationSettings.message || '')}</textarea>
            </label>

            <div class="reminder-actions-row">
              <button class="btn btn-outline-primary btn-sm" type="submit">
                <i class="bi bi-check2-circle"></i>
                Save settings
              </button>
              <button class="btn btn-outline-secondary btn-sm" type="button" data-action="test-reminder-notification">
                <i class="bi bi-bell"></i>
                Test notification
              </button>
            </div>
          </form>
        </aside>
      </section>
    </div>
  `;
}

async function bindReminderActions(container, currentPath, payload) {
  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  const remindersRoot = content.querySelector('.reminders-page');
  const isDemo = remindersRoot?.dataset.remindersDemo === '1';

  const closeAllEditForms = () => {
    content.querySelectorAll('[data-reminder-edit-form].is-open').forEach((form) => {
      form.classList.remove('is-open');
    });
  };

  const updateRepeatDaysVisibility = (form) => {
    const repeatSelect = form.querySelector('[data-reminder-repeat-select]');
    const daysPanel = form.querySelector('[data-repeat-days]');
    if (!(repeatSelect instanceof HTMLSelectElement) || !(daysPanel instanceof HTMLElement)) return;
    const isWeekly = repeatSelect.value === 'weekly';
    daysPanel.classList.toggle('is-hidden', !isWeekly);
  };

  content.querySelectorAll('form').forEach((form) => {
    const repeatSelect = form.querySelector('[data-reminder-repeat-select]');
    if (!(repeatSelect instanceof HTMLSelectElement)) return;
    updateRepeatDaysVisibility(form);
    repeatSelect.addEventListener('change', () => updateRepeatDaysVisibility(form));
  });

  const collectReminderFormPayload = (form) => {
    const titleInput = form.querySelector('input[name="title"]');
    const dateInput = form.querySelector('input[name="remind_date"]');
    const timeInput = form.querySelector('input[name="remind_time"]');
    const repeatInput = form.querySelector('select[name="repeat_interval"]');
    const priorityInput = form.querySelector('select[name="priority"]');
    const notesInput = form.querySelector('textarea[name="notes"]');
    const activeInput = form.querySelector('input[name="is_active"]');
    const toastInput = form.querySelector('input[name="channel_toast"]');
    const systemInput = form.querySelector('input[name="channel_system"]');
    const soundInput = form.querySelector('input[name="play_sound"]');

    const title = titleInput instanceof HTMLInputElement ? titleInput.value.trim() : '';
    const remindDate = dateInput instanceof HTMLInputElement ? dateInput.value : '';
    const remindTime = timeInput instanceof HTMLInputElement ? timeInput.value : '';
    const repeatInterval = repeatInput instanceof HTMLSelectElement ? repeatInput.value : 'none';
    const repeatDays = Array.from(form.querySelectorAll('input[name="repeat_days"]:checked'))
      .map((input) => input instanceof HTMLInputElement ? input.value : '')
      .filter(Boolean);
    const priority = priorityInput instanceof HTMLSelectElement ? priorityInput.value : 'normal';
    const notes = notesInput instanceof HTMLTextAreaElement ? notesInput.value.trim() : '';

    return {
      title,
      remind_date: remindDate,
      remind_time: remindTime,
      repeat_interval: repeatInterval,
      repeat_days: repeatInterval === 'weekly' ? repeatDays : [],
      priority,
      notes,
      is_active: activeInput instanceof HTMLInputElement ? activeInput.checked : true,
      channel_toast: toastInput instanceof HTMLInputElement ? toastInput.checked : true,
      channel_system: systemInput instanceof HTMLInputElement ? systemInput.checked : false,
      play_sound: soundInput instanceof HTMLInputElement ? soundInput.checked : false
    };
  };

  const createForm = content.querySelector('#reminder-create-form');
  if (createForm) {
    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formPayload = collectReminderFormPayload(createForm);
      if (!formPayload.title || !formPayload.remind_date || !formPayload.remind_time) return;

      try {
        await appApi.createReminder(formPayload);
        showToast('Reminder created', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to create reminder', 'error');
      }
    });
  }

  content.querySelectorAll('[data-action="edit-reminder"]').forEach((button) => {
    button.addEventListener('click', () => {
      const reminderId = button.dataset.reminderId;
      if (!reminderId) return;
      const targetForm = Array.from(content.querySelectorAll('[data-reminder-edit-form]'))
        .find((form) => form.dataset.reminderId === reminderId);
      if (!targetForm) return;
      const shouldOpen = !targetForm.classList.contains('is-open');
      closeAllEditForms();
      if (shouldOpen) {
        targetForm.classList.add('is-open');
        const firstInput = targetForm.querySelector('input[name="title"]');
        if (firstInput instanceof HTMLInputElement) {
          firstInput.focus();
          firstInput.select();
        }
      }
    });
  });

  content.querySelectorAll('[data-action="cancel-reminder-edit"]').forEach((button) => {
    button.addEventListener('click', () => {
      const reminderId = button.dataset.reminderId;
      if (!reminderId) return;
      const targetForm = Array.from(content.querySelectorAll('[data-reminder-edit-form]'))
        .find((form) => form.dataset.reminderId === reminderId);
      if (!targetForm) return;
      targetForm.classList.remove('is-open');
    });
  });

  content.querySelectorAll('[data-reminder-edit-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const reminderId = form.dataset.reminderId;
      if (!reminderId) return;

      if (isDemo && String(reminderId).startsWith('demo-')) {
        showToast('Demo reminder: connect API data to save changes.', 'info');
        return;
      }

      const formPayload = collectReminderFormPayload(form);
      if (!formPayload.title || !formPayload.remind_date || !formPayload.remind_time) return;

      try {
        await appApi.updateReminder(reminderId, formPayload);
        showToast('Reminder updated', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to update reminder', 'error');
      }
    });
  });

  content.querySelectorAll('[data-action="toggle-reminder"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const reminderId = button.dataset.reminderId;
      if (!reminderId) return;
      if (isDemo && String(reminderId).startsWith('demo-')) {
        showToast('Demo reminder: connect API data to update this item.', 'info');
        return;
      }

      try {
        await appApi.toggleReminder(reminderId, button.dataset.isActive === '1');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to update reminder', 'error');
      }
    });
  });

  content.querySelectorAll('[data-action="delete-reminder"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const reminderId = button.dataset.reminderId;
      if (!reminderId) return;
      if (isDemo && String(reminderId).startsWith('demo-')) {
        showToast('Demo reminder: connect API data to delete this item.', 'info');
        return;
      }

      try {
        await appApi.deleteReminder(reminderId);
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to delete reminder', 'error');
      }
    });
  });

  const notificationForm = content.querySelector('#reminder-notification-form');
  if (notificationForm) {
    notificationForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await appApi.updateNotificationSettings({
          notifications_enabled: Boolean(notificationForm.querySelector('input[name="notifications_enabled"]')?.checked),
          notifications_show_toast: Boolean(notificationForm.querySelector('input[name="notifications_show_toast"]')?.checked),
          notifications_show_system: Boolean(notificationForm.querySelector('input[name="notifications_show_system"]')?.checked),
          notifications_play_sound: Boolean(notificationForm.querySelector('input[name="notifications_play_sound"]')?.checked),
          notifications_interval_minutes: Number(notificationForm.querySelector('select[name="notifications_interval_minutes"]')?.value || 30),
          notifications_title: notificationForm.querySelector('input[name="notifications_title"]')?.value || '',
          notifications_message: notificationForm.querySelector('textarea[name="notifications_message"]')?.value || ''
        });
        showToast('Notification settings updated', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to update notification settings', 'error');
      }
    });
  }

  const testNotificationButton = content.querySelector('[data-action="test-reminder-notification"]');
  if (testNotificationButton) {
    testNotificationButton.addEventListener('click', () => {
      showToast('Test reminder sent. Check your active channels.', 'info');
    });
  }

  content.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeAllEditForms();
  });
}

const LABEL_PRESET_COLORS = ['#e85d75', '#1f6feb', '#f2a900', '#22c55e', '#a855f7', '#0ea5e9'];

function normalizeLabelColor(value, fallback = '#1f6feb') {
  const candidate = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(candidate) || /^#[0-9a-fA-F]{3}$/.test(candidate)) {
    return candidate;
  }
  return fallback;
}

function normalizeLabelsPayload(payload) {
  const labels = Array.isArray(payload?.labels) ? payload.labels : [];
  return labels.map((label, index) => {
    const color = normalizeLabelColor(label?.color, LABEL_PRESET_COLORS[index % LABEL_PRESET_COLORS.length]);
    const createdAt = label?.created_at || label?.createdAt || '';
    return {
      id: label?.id ?? `label-${index + 1}`,
      name: String(label?.name || `Label ${index + 1}`),
      color,
      created_at: createdAt
    };
  });
}

function buildLabelsDemoPayload() {
  const now = Date.now();
  const labels = [
    { id: 'demo-label-1', name: 'Frontend', color: '#1f6feb', created_at: new Date(now - 1000 * 60 * 3).toISOString() },
    { id: 'demo-label-2', name: 'BFF', color: '#e85d75', created_at: new Date(now - 1000 * 60 * 9).toISOString() },
    { id: 'demo-label-3', name: 'Infra', color: '#f2a900', created_at: new Date(now - 1000 * 60 * 15).toISOString() },
    { id: 'demo-label-4', name: 'UX', color: '#22c55e', created_at: new Date(now - 1000 * 60 * 21).toISOString() },
    { id: 'demo-label-5', name: 'API', color: '#a855f7', created_at: new Date(now - 1000 * 60 * 27).toISOString() }
  ];
  return {
    labels,
    __demo: true
  };
}

function withLabelsDemoPayload(payload) {
  const safe = payload && typeof payload === 'object' ? payload : {};
  const hasLabels = Array.isArray(safe.labels) && safe.labels.length > 0;
  if (!isLocalhostRuntime() || hasLabels) {
    return safe;
  }

  const demo = buildLabelsDemoPayload();
  return {
    ...demo,
    ...safe,
    labels: hasLabels ? safe.labels : demo.labels,
    __demo: true
  };
}

function renderLabels(content, payload) {
  const labels = normalizeLabelsPayload(payload);
  const labelsByNewest = [...labels].sort((a, b) => {
    const aTime = Date.parse(a.created_at || '') || 0;
    const bTime = Date.parse(b.created_at || '') || 0;
    return bTime - aTime;
  });
  const newestLabel = labelsByNewest[0] || null;
  const palettePreview = labelsByNewest.slice(0, 6);

  const demoNote = payload.__demo
    ? `
      <div class="goals-demo-note">
        <i class="bi bi-flask"></i>
        <span>Demo data is enabled on localhost because API returned no labels yet.</span>
      </div>
    `
    : '';

  content.innerHTML = `
    <div class="labels-page" data-labels-demo="${payload.__demo ? '1' : '0'}">
      ${demoNote}

      <section class="labels-hero">
        <article class="label-stat-card">
          <span class="label-stat-label">Total labels</span>
          <span class="label-stat-value">${labels.length}</span>
          <span class="label-stat-meta">Ready to tag</span>
        </article>
        <article class="label-stat-card">
          <span class="label-stat-label">Newest label</span>
          <span class="label-stat-value">${escapeHtml(newestLabel?.name || 'N/A')}</span>
          <span class="label-stat-meta">${newestLabel ? 'Just added' : 'Create your first label'}</span>
        </article>
        <article class="label-stat-card">
          <span class="label-stat-label">Palette preview</span>
          <div class="label-palette">
            ${palettePreview.length
      ? palettePreview.map((label) => `<span class="label-swatch" style="background-color: ${escapeHtml(label.color)}" title="${escapeHtml(label.name)}"></span>`).join('')
      : '<span class="label-palette-empty">Add colors</span>'}
          </div>
          <span class="label-stat-meta">Keep tones consistent</span>
        </article>
      </section>

      <section class="app-panel labels-card" id="label-create">
        <div class="labels-card-header">
          <div>
            <p class="goals-label">Create</p>
            <h3 class="goals-title">New label</h3>
          </div>
          <span class="labels-tip">Pick a name, then choose a color for fast scanning.</span>
        </div>

        <form id="label-create-form" class="label-create-form">
          <label class="label-field">
            <span>Label name</span>
            <input type="text" name="name" placeholder="Design, Admin, Urgent..." required />
          </label>

          <div class="label-color-group">
            <span class="label-field-title">Color</span>
            <div class="label-color-picker" role="radiogroup" aria-label="Label colors">
              ${LABEL_PRESET_COLORS.slice(0, 5).map((color, index) => `
                <label class="color-option" for="label-color-${index}">
                  <input type="radio" id="label-color-${index}" name="color" value="${color}" ${index === 0 ? 'checked' : ''} />
                  <span class="color-dot" style="background-color: ${color}"></span>
                </label>
              `).join('')}

              <label class="color-option color-option-custom" for="label-color-custom-radio">
                <input type="radio" id="label-color-custom-radio" name="color" value="${LABEL_PRESET_COLORS[5]}" data-custom-radio />
                <span class="color-dot" style="background-color: ${LABEL_PRESET_COLORS[5]}"></span>
                <span class="color-custom">
                  <input type="color" value="${LABEL_PRESET_COLORS[5]}" aria-label="Custom color" data-custom-color />
                  <span>Custom</span>
                </span>
              </label>
            </div>
          </div>

          <div class="label-actions">
            <button class="btn btn-primary btn-sm" type="submit">
              <i class="bi bi-plus-lg"></i>
              Add label
            </button>
          </div>
        </form>
      </section>

      <section class="app-panel labels-card" id="label-list">
        <div class="labels-card-header">
          <div>
            <p class="goals-label">Library</p>
            <h3 class="goals-title">Label list</h3>
            <span class="labels-count" data-label-count>Showing ${labels.length} label${labels.length === 1 ? '' : 's'}</span>
          </div>
          <div class="labels-controls">
            <div class="labels-search">
              <i class="bi bi-search"></i>
              <input type="search" placeholder="Search labels" aria-label="Search labels" data-label-search />
              <button class="labels-clear" type="button" aria-label="Clear search" data-label-clear hidden>
                <i class="bi bi-x-lg"></i>
              </button>
            </div>
            <div class="labels-sort">
              <select aria-label="Sort labels" data-label-sort>
                <option value="newest">Newest first</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
              </select>
            </div>
          </div>
        </div>

        ${labels.length ? `
          <div class="label-list" data-label-list>
            ${labelsByNewest.map((label) => `
              <article class="label-item" data-label-item data-label-id="${escapeHtml(String(label.id))}" data-label-name="${escapeHtml(label.name.toLowerCase())}" data-label-created="${escapeHtml(label.created_at || '')}">
                <div class="label-item-main">
                  <div class="label-item-top">
                    <span class="label-chip" style="background-color: ${escapeHtml(label.color)}">${escapeHtml(label.name)}</span>
                    <span class="label-hex">${escapeHtml(label.color.toUpperCase())}</span>
                  </div>
                  <form class="label-edit-form" data-label-edit-form data-label-id="${escapeHtml(String(label.id))}">
                    <input name="name" type="text" value="${escapeHtml(label.name)}" required />
                    <input name="color" type="color" value="${escapeHtml(label.color)}" />
                    <button class="btn btn-outline-primary btn-sm" type="submit">
                      <i class="bi bi-check2"></i>
                      Save
                    </button>
                    <button class="btn btn-light btn-sm" type="button" data-action="cancel-label-edit" data-label-id="${escapeHtml(String(label.id))}">
                      Cancel
                    </button>
                  </form>
                </div>
                <div class="label-item-actions">
                  <button class="btn btn-outline-secondary btn-sm" type="button" data-action="edit-label" data-label-id="${escapeHtml(String(label.id))}">
                    <i class="bi bi-pencil"></i>
                    Edit
                  </button>
                  <button class="btn btn-outline-danger btn-sm danger" type="button" data-action="delete-label" data-label-id="${escapeHtml(String(label.id))}">
                    <i class="bi bi-trash"></i>
                    Delete
                  </button>
                </div>
              </article>
            `).join('')}
          </div>
          <p class="muted labels-empty-search" data-label-empty hidden>No labels match your search.</p>
        ` : `
          <p class="muted">No labels yet.</p>
        `}
      </section>
    </div>
  `;
}

async function bindLabelActions(container, currentPath) {
  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  const labelsRoot = content.querySelector('.labels-page');
  const isDemo = labelsRoot?.dataset.labelsDemo === '1';
  const defaultColor = LABEL_PRESET_COLORS[0];

  const closeAllEditForms = () => {
    content.querySelectorAll('[data-label-edit-form].is-open').forEach((form) => {
      form.classList.remove('is-open');
    });
  };

  const createForm = content.querySelector('#label-create-form');
  if (createForm) {
    const customRadio = createForm.querySelector('[data-custom-radio]');
    const customColorInput = createForm.querySelector('[data-custom-color]');

    if (customRadio instanceof HTMLInputElement && customColorInput instanceof HTMLInputElement) {
      customColorInput.addEventListener('input', () => {
        customRadio.value = customColorInput.value;
        customRadio.checked = true;
      });
    }

    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const nameInput = createForm.querySelector('input[name="name"]');
      const colorInput = createForm.querySelector('input[name="color"]:checked');
      const name = nameInput instanceof HTMLInputElement ? nameInput.value.trim() : '';
      const color = normalizeLabelColor(colorInput instanceof HTMLInputElement ? colorInput.value : defaultColor, defaultColor);
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

  const labelList = content.querySelector('[data-label-list]');
  const searchInput = content.querySelector('[data-label-search]');
  const sortSelect = content.querySelector('[data-label-sort]');
  const clearButton = content.querySelector('[data-label-clear]');
  const labelCount = content.querySelector('[data-label-count]');
  const emptyResult = content.querySelector('[data-label-empty]');

  const parseCreated = (value) => {
    const timestamp = Date.parse(value || '');
    return Number.isNaN(timestamp) ? 0 : timestamp;
  };

  const applySearchAndSort = () => {
    if (!labelList) return;
    const query = searchInput instanceof HTMLInputElement ? searchInput.value.trim().toLowerCase() : '';
    const sortMode = sortSelect instanceof HTMLSelectElement ? sortSelect.value : 'newest';
    const items = Array.from(labelList.querySelectorAll('[data-label-item]'));

    items.sort((a, b) => {
      const aName = String(a.dataset.labelName || '');
      const bName = String(b.dataset.labelName || '');
      if (sortMode === 'name-asc') return aName.localeCompare(bName);
      if (sortMode === 'name-desc') return bName.localeCompare(aName);
      return parseCreated(b.dataset.labelCreated) - parseCreated(a.dataset.labelCreated);
    });

    items.forEach((item) => labelList.appendChild(item));

    let visibleCount = 0;
    items.forEach((item) => {
      const name = String(item.dataset.labelName || '').toLowerCase();
      const matches = !query || name.includes(query);
      item.hidden = !matches;
      if (matches) visibleCount += 1;
    });

    if (labelCount) {
      labelCount.textContent = `Showing ${visibleCount} label${visibleCount === 1 ? '' : 's'}`;
    }
    if (clearButton) {
      clearButton.hidden = !query;
    }
    if (emptyResult) {
      emptyResult.hidden = visibleCount > 0;
    }
  };

  if (searchInput instanceof HTMLInputElement) {
    searchInput.addEventListener('input', applySearchAndSort);
  }
  if (sortSelect instanceof HTMLSelectElement) {
    sortSelect.addEventListener('change', applySearchAndSort);
  }
  if (clearButton instanceof HTMLButtonElement && searchInput instanceof HTMLInputElement) {
    clearButton.addEventListener('click', () => {
      searchInput.value = '';
      applySearchAndSort();
      searchInput.focus();
    });
  }
  applySearchAndSort();

  content.querySelectorAll('[data-action="edit-label"]').forEach((button) => {
    button.addEventListener('click', () => {
      const labelId = button.dataset.labelId;
      if (!labelId) return;
      const targetForm = Array.from(content.querySelectorAll('[data-label-edit-form]'))
        .find((form) => form.dataset.labelId === labelId);
      if (!targetForm) return;
      const shouldOpen = !targetForm.classList.contains('is-open');
      closeAllEditForms();
      if (shouldOpen) {
        targetForm.classList.add('is-open');
        const firstInput = targetForm.querySelector('input[name="name"]');
        if (firstInput instanceof HTMLInputElement) {
          firstInput.focus();
          firstInput.select();
        }
      }
    });
  });

  content.querySelectorAll('[data-action="cancel-label-edit"]').forEach((button) => {
    button.addEventListener('click', () => {
      const labelId = button.dataset.labelId;
      if (!labelId) return;
      const targetForm = Array.from(content.querySelectorAll('[data-label-edit-form]'))
        .find((form) => form.dataset.labelId === labelId);
      if (!targetForm) return;
      targetForm.classList.remove('is-open');
    });
  });

  content.querySelectorAll('[data-label-edit-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const labelId = form.dataset.labelId;
      if (!labelId) return;
      if (isDemo && String(labelId).startsWith('demo-')) {
        showToast('Demo label: connect API data to save changes.', 'info');
        return;
      }

      const nameInput = form.querySelector('input[name="name"]');
      const colorInput = form.querySelector('input[name="color"]');
      const name = nameInput instanceof HTMLInputElement ? nameInput.value.trim() : '';
      const color = normalizeLabelColor(colorInput instanceof HTMLInputElement ? colorInput.value : '#1f6feb');
      if (!name || !color) return;

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
      const labelId = button.dataset.labelId;
      if (!labelId) return;
      if (isDemo && String(labelId).startsWith('demo-')) {
        showToast('Demo label: connect API data to delete this item.', 'info');
        return;
      }

      try {
        await appApi.deleteLabel(labelId);
        showToast('Label deleted', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to delete label', 'error');
      }
    });
  });

  content.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeAllEditForms();
  });
}

const ACCOUNT_TIMEZONE_OPTIONS = [
  'UTC',
  'Asia/Tehran',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Tokyo'
];

function buildAccountDemoPayload() {
  return {
    user: {
      id: 'demo-user-1',
      email: 'demo@goalixa.local'
    },
    profile: {
      full_name: 'Demo Product Owner',
      phone: '+1 555 0147',
      bio: 'Focused on shipping the PWA-first Goalixa architecture.',
      user_id: 'demo-user-1'
    },
    timezone_name: 'America/Los_Angeles',
    timezone_options: ACCOUNT_TIMEZONE_OPTIONS,
    notification_settings: {
      enabled: true,
      interval_minutes: 10,
      show_toast: true,
      show_system: false,
      play_sound: false,
      title: 'Tracking reminder',
      message: 'Start a Pomodoro to keep tracking your focus.'
    },
    __demo: true
  };
}

function withAccountDemoPayload(payload) {
  const safe = payload && typeof payload === 'object' ? payload : {};
  const hasUser = safe.user && typeof safe.user === 'object' && (safe.user.email || safe.user.id);
  if (!isLocalhostRuntime() || hasUser) {
    return safe;
  }

  const demo = buildAccountDemoPayload();
  return {
    ...demo,
    ...safe,
    user: safe.user && typeof safe.user === 'object' ? { ...demo.user, ...safe.user } : demo.user,
    profile: safe.profile && typeof safe.profile === 'object' ? { ...demo.profile, ...safe.profile } : demo.profile,
    notification_settings: safe.notification_settings && typeof safe.notification_settings === 'object'
      ? { ...demo.notification_settings, ...safe.notification_settings }
      : demo.notification_settings,
    timezone_name: safe.timezone_name || demo.timezone_name,
    timezone_options: Array.isArray(safe.timezone_options) && safe.timezone_options.length
      ? safe.timezone_options
      : demo.timezone_options,
    __demo: true
  };
}

function renderAccount(content, payload) {
  const user = payload.user && typeof payload.user === 'object' ? payload.user : {};
  const profile = payload.profile && typeof payload.profile === 'object' ? payload.profile : {};
  const settings = payload.notification_settings && typeof payload.notification_settings === 'object'
    ? payload.notification_settings
    : {};
  const timezoneName = payload.timezone_name || 'UTC';
  const timezoneOptions = Array.isArray(payload.timezone_options) ? payload.timezone_options : ACCOUNT_TIMEZONE_OPTIONS;
  const mergedTimezoneOptions = Array.from(new Set([...timezoneOptions, timezoneName].filter(Boolean)));
  const nameFromEmail = String(user.email || '').split('@')[0] || 'Goalixa User';
  const displayName = profile.full_name || nameFromEmail;
  const avatarText = (displayName || 'U').trim().charAt(0).toUpperCase();

  const demoNote = payload.__demo
    ? `
      <div class="goals-demo-note">
        <i class="bi bi-flask"></i>
        <span>Demo data is enabled on localhost because API returned no account payload yet.</span>
      </div>
    `
    : '';

  content.innerHTML = `
    <div class="account-page" data-account-demo="${payload.__demo ? '1' : '0'}">
      ${demoNote}

      <section class="app-panel profile-card-lg">
        <div class="profile-card-lg-head">
          <div class="profile-avatar lg" aria-hidden="true">${escapeHtml(avatarText)}</div>
          <div class="profile-main">
            <div class="profile-name-row">
              <h3>${escapeHtml(displayName)}</h3>
              <span class="profile-badge">Member</span>
            </div>
            <p class="profile-email">${escapeHtml(user.email || '-')}</p>
            ${profile.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : ''}

            <div class="profile-meta-grid">
              <div>
                <p class="meta-label">User ID</p>
                <p class="meta-value">${escapeHtml(profile.user_id || user.id || '-')}</p>
              </div>
              <div>
                <p class="meta-label">Phone</p>
                <p class="meta-value">${escapeHtml(profile.phone || 'Not set')}</p>
              </div>
              <div>
                <p class="meta-label">Timezone</p>
                <p class="meta-value">${escapeHtml(timezoneName)}</p>
              </div>
            </div>
          </div>

          <div class="profile-actions-vertical">
            <button class="btn btn-outline-primary btn-sm" type="button" data-action="account-change-password">
              <i class="bi bi-shield-lock"></i>
              Change password
            </button>
            <button class="btn btn-primary btn-sm" type="button" data-action="account-logout">
              <i class="bi bi-box-arrow-right"></i>
              Log out
            </button>
          </div>
        </div>

        <form id="profile-form" class="profile-form">
          <div class="profile-form-actions top">
            <button class="btn btn-outline-secondary btn-sm" type="button" id="profile-edit" data-action="profile-edit">
              <i class="bi bi-pencil"></i>
              Edit profile
            </button>
            <button class="btn btn-outline-primary btn-sm" type="submit" id="profile-save" hidden>
              <i class="bi bi-check2-circle"></i>
              Save changes
            </button>
          </div>

          <div class="profile-form-grid">
            <label class="profile-field-card">
              Full name
              <input data-profile-field type="text" name="full_name" value="${escapeHtml(profile.full_name || '')}" placeholder="e.g. Sara Ahmadi" minlength="2" maxlength="80" disabled />
              <span class="profile-hint">Use your real name so teammates recognize you.</span>
            </label>
            <label class="profile-field-card">
              Phone
              <input data-profile-field type="tel" name="phone" value="${escapeHtml(profile.phone || '')}" placeholder="+1 555 123 4567" inputmode="tel" disabled />
              <span class="profile-hint">Include country code for notification SMS or calls.</span>
            </label>
          </div>

          <label class="profile-field-card">
            Bio
            <textarea data-profile-field name="bio" rows="3" maxlength="160" placeholder="Short bio or role" disabled>${escapeHtml(profile.bio || '')}</textarea>
            <span class="profile-hint">Max 160 characters. Share your role, focus area, or motto.</span>
          </label>
        </form>
      </section>

      <section class="account-grid">
        <section class="app-panel account-card">
          <div class="account-card-header">
            <div>
              <p class="goals-label">App settings</p>
              <h3 class="goals-title">Timezone</h3>
            </div>
          </div>

          <form id="timezone-form" class="account-form-grid">
            <label class="profile-field-card">
              Timezone
              <select id="timezone-select" name="timezone">
                ${mergedTimezoneOptions.map((timezone) => `<option value="${escapeHtml(timezone)}" ${timezone === timezoneName ? 'selected' : ''}>${escapeHtml(timezone)}</option>`).join('')}
              </select>
            </label>

            <div class="account-form-actions">
              <button class="btn btn-outline-primary btn-sm" type="submit">
                <i class="bi bi-check2-circle"></i>
                Save settings
              </button>
            </div>
          </form>
        </section>

        <section class="app-panel account-card">
          <div class="account-card-header">
            <div>
              <p class="goals-label">Notifications</p>
              <h3 class="goals-title">Focus reminder channels</h3>
            </div>
          </div>

          <form id="notifications-form" class="account-form-grid">
            <label class="profile-switch">
              <input type="checkbox" id="notif-enabled" ${settings.enabled ? 'checked' : ''} />
              <span>Remind me to track focus when Pomodoro is off</span>
            </label>

            <label class="profile-field-card">
              Reminder interval (minutes)
              <select id="notif-interval" name="notifications_interval_minutes">
                ${[1, 5, 10, 15, 20, 30].map((minutes) => `
                  <option value="${minutes}" ${Number(settings.interval_minutes || 30) === minutes ? 'selected' : ''}>
                    ${minutes} minute${minutes === 1 ? '' : 's'}
                  </option>
                `).join('')}
              </select>
            </label>

            <div class="profile-switch-grid">
              <label class="profile-switch">
                <input type="checkbox" id="notif-toast" ${settings.show_toast ? 'checked' : ''} />
                <span>Show in-page popup</span>
              </label>
              <label class="profile-switch">
                <input type="checkbox" id="notif-system" ${settings.show_system ? 'checked' : ''} />
                <span>Send system notification</span>
              </label>
              <label class="profile-switch">
                <input type="checkbox" id="notif-sound" ${settings.play_sound ? 'checked' : ''} />
                <span>Play sound</span>
              </label>
            </div>

            <label class="profile-field-card">
              Popup title
              <input id="notif-title" type="text" value="${escapeHtml(settings.title || '')}" placeholder="Tracking reminder" />
            </label>
            <label class="profile-field-card">
              Popup message
              <textarea id="notif-message" rows="3" placeholder="Reminder message">${escapeHtml(settings.message || '')}</textarea>
            </label>

            <div class="account-form-actions">
              <button class="btn btn-outline-primary btn-sm" type="submit">
                <i class="bi bi-check2-circle"></i>
                Save notification settings
              </button>
              <button class="btn btn-outline-secondary btn-sm" type="button" data-action="test-account-notification">
                <i class="bi bi-bell"></i>
                Test notification
              </button>
            </div>
          </form>
        </section>
      </section>
    </div>
  `;
}

async function bindAccountActions(container, currentPath) {
  const content = container.querySelector('#app-shell-content');
  if (!content) return;

  const profileForm = content.querySelector('#profile-form');
  const profileEditButton = content.querySelector('[data-action="profile-edit"]');
  const profileSaveButton = content.querySelector('#profile-save');
  const profileFields = Array.from(content.querySelectorAll('[data-profile-field]'));

  const setProfileEditable = (editable) => {
    profileFields.forEach((field) => {
      field.disabled = !editable;
    });
    if (profileSaveButton instanceof HTMLButtonElement) {
      profileSaveButton.hidden = !editable;
    }
    if (profileEditButton instanceof HTMLButtonElement) {
      profileEditButton.hidden = editable;
    }
  };

  setProfileEditable(false);

  if (profileEditButton instanceof HTMLButtonElement) {
    profileEditButton.addEventListener('click', () => {
      setProfileEditable(true);
      const firstField = profileFields[0];
      if (firstField instanceof HTMLInputElement || firstField instanceof HTMLTextAreaElement) {
        firstField.focus();
        firstField.select?.();
      }
    });
  }

  if (profileForm) {
    profileForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await appApi.updateProfile({
          full_name: profileForm.querySelector('input[name="full_name"]')?.value || '',
          phone: profileForm.querySelector('input[name="phone"]')?.value || '',
          bio: profileForm.querySelector('textarea[name="bio"]')?.value || ''
        });
        showToast('Profile updated', 'success');
        await render(container, currentPath, {});
      } catch (error) {
        showToast(error.message || 'Failed to update profile', 'error');
        setProfileEditable(true);
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

  const changePasswordButton = content.querySelector('[data-action="account-change-password"]');
  if (changePasswordButton) {
    changePasswordButton.addEventListener('click', () => {
      navigate('/forgot-password');
    });
  }

  const logoutButton = content.querySelector('[data-action="account-logout"]');
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      await logout();
      navigate('/login');
    });
  }

  const testNotificationButton = content.querySelector('[data-action="test-account-notification"]');
  if (testNotificationButton) {
    testNotificationButton.addEventListener('click', () => {
      showToast('Test notification sent. Check enabled channels.', 'info');
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
      let payload;
      try {
        payload = await appApi.getHabits();
      } catch (error) {
        if (!isLocalhostRuntime()) throw error;
        payload = {};
      }
      payload = withHabitsDemoPayload(payload);
      renderHabits(content, payload);
      await bindHabitActions(container, currentPath, payload);
      return;
    }

    if (section === 'planner') {
      let payload;
      try {
        payload = await appApi.getPlanner();
      } catch (error) {
        if (!isLocalhostRuntime()) throw error;
        payload = {};
      }
      payload = withPlannerDemoPayload(payload);
      renderPlanner(content, payload);
      await bindPlannerActions(container, currentPath, payload);
      return;
    }

    if (section === 'reminders') {
      let payload;
      try {
        payload = await appApi.getReminders();
      } catch (error) {
        if (!isLocalhostRuntime()) throw error;
        payload = {};
      }
      payload = withRemindersDemoPayload(payload);
      renderReminders(content, payload);
      await bindReminderActions(container, currentPath, payload);
      return;
    }

    if (section === 'labels') {
      let payload;
      try {
        payload = await appApi.getLabels();
      } catch (error) {
        if (!isLocalhostRuntime()) throw error;
        payload = {};
      }
      payload = withLabelsDemoPayload(payload);
      renderLabels(content, payload);
      await bindLabelActions(container, currentPath);
      return;
    }

    if (section === 'account') {
      let payload;
      try {
        payload = await appApi.getAccount();
      } catch (error) {
        if (!isLocalhostRuntime()) throw error;
        payload = {};
      }
      payload = withAccountDemoPayload(payload);
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
