/**
 * API Client for Goalixa PWA
 * Handles communication with API gateway and backend services.
 */

function getRuntimeApiBase() {
  // Production: Always use relative /bff path for same-domain requests
  if (typeof window !== 'undefined') {
    return window.location.origin + '/bff';
  }
  return 'https://app.goalixa.com/bff';
}

const API_CONFIG = {
  api: getRuntimeApiBase()
};

let isRefreshing = false;
let refreshSubscribers = [];
let refreshPromise = null; // Shared promise for concurrent refresh attempts

// Track failed retries to prevent infinite loops
const failedRefreshUrls = new Map(); // url -> timestamp of last failure
const FAILED_RETRY_COOLDOWN = 60000; // 1 minute cooldown after failed retry

// Track in-flight requests for deduplication
const pendingRequests = new Map(); // request_key -> promise

// Generate a unique key for a request based on URL and options
function getRequestKey(url, options = {}) {
  const { method = 'GET', body } = options;
  // For GET requests, URL is sufficient
  if (method === 'GET' || !method) {
    return url;
  }
  // For POST/PUT/DELETE, include method and body in the key
  return `${url}:${method}:${JSON.stringify(body || '')}`;
}

function buildUrl(path) {
  if (!API_CONFIG.api) {
    return path;
  }
  return `${API_CONFIG.api}${path}`;
}

function subscribeToRefresh(callback) {
  refreshSubscribers.push(callback);
}

function onRefreshed() {
  refreshSubscribers.forEach((callback) => callback());
  refreshSubscribers = [];
}

async function apiRequest(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body = null,
    credentials = 'include',
    timeout = 30000
  } = options;

  // Check if this request is already in flight (deduplication)
  const requestKey = getRequestKey(url, { method, body });

  // Skip deduplication for mutations (POST, PUT, DELETE, PATCH)
  const isMutation = method && method !== 'GET';

  if (!isMutation && pendingRequests.has(requestKey)) {
    console.log(`[API] Deduplicating request: ${requestKey}`);
    return pendingRequests.get(requestKey);
  }

  // Create the request promise
  const requestPromise = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const defaultHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };

    try {
      const response = await fetch(url, {
        method,
        headers: { ...defaultHeaders, ...headers },
        body: body ? JSON.stringify(body) : null,
        credentials,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        if (!response.ok) {
          // Don't trigger refresh for login, register, or refresh endpoints
          if (response.status === 401 &&
              !url.includes('/auth/refresh') &&
              !url.includes('/auth/login') &&
              !url.includes('/auth/register')) {
            return handle401Error(url, options);
          }
          const nonJsonError = new Error(`HTTP ${response.status}`);
          nonJsonError.status = response.status;
          throw nonJsonError;
        }
        return response;
      }

      const data = await response.json();

      if (!response.ok) {
        // Don't trigger refresh for login, register, or refresh endpoints
        if (response.status === 401 &&
            !url.includes('/auth/refresh') &&
            !url.includes('/auth/login') &&
            !url.includes('/auth/register')) {
          return handle401Error(url, options);
        }
        const error = new Error(data.message || data.error || `HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    } finally {
      // Remove from pending requests map when done (only for GET requests)
      if (!isMutation && pendingRequests.has(requestKey)) {
        pendingRequests.delete(requestKey);
      }
    }
  })();

  // Store the promise for deduplication (only for GET requests)
  if (!isMutation) {
    pendingRequests.set(requestKey, requestPromise);
  }

  return requestPromise;
}

async function apiRequestWithFallback(urls, options = {}) {
  let lastError = null;

  for (const url of urls) {
    try {
      return await apiRequest(url, options);
    } catch (error) {
      lastError = error;
      const status = error && typeof error.status === 'number' ? error.status : 0;
      if (status !== 404 && status !== 405) {
        throw error;
      }
    }
  }

  throw lastError || new Error('All fallback API endpoints failed');
}

async function handle401Error(originalUrl, originalOptions) {
  // Check if this URL is in cooldown (previously failed after refresh)
  const lastFailure = failedRefreshUrls.get(originalUrl);
  if (lastFailure && Date.now() - lastFailure < FAILED_RETRY_COOLDOWN) {
    console.warn(`[Auth] URL ${originalUrl} is in cooldown after failed refresh retry`);
    const error = new Error('Authentication failed. Please refresh the page.');
    error.status = 401;
    throw error;
  }

  // If a refresh is already in progress, return the existing promise
  // This prevents race conditions when multiple 401s occur simultaneously
  if (refreshPromise) {
    console.log(`[Auth] Refresh already in progress, queuing request for ${originalUrl}`);
    return new Promise((resolve, reject) => {
      subscribeToRefresh(async () => {
        try {
          const result = await apiRequest(originalUrl, originalOptions);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  // Start a new refresh and store the promise
  isRefreshing = true;
  console.log(`[Auth] Starting token refresh for 401 at ${originalUrl}`);

  refreshPromise = (async () => {
    try {
      const { refreshToken, report401AfterRefresh } = await import('./auth.js');
      const refreshResult = await refreshToken();

      if (refreshResult.success) {
        onRefreshed();
        console.log(`[Auth] Token refreshed successfully, retrying ${originalUrl}`);

        // Add a small delay to ensure cookies are properly set
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
          const result = await apiRequest(originalUrl, originalOptions);

          // Clear the cooldown if the retry succeeded
          failedRefreshUrls.delete(originalUrl);
          console.log(`[Auth] Retry succeeded for ${originalUrl}`);

          return result;
        } catch (retryError) {
          // If the retry fails with 401, add this URL to cooldown
          // and report it to auth module for tracking
          if (retryError.status === 401) {
            console.error(`[Auth] Retry after refresh still returned 401 for ${originalUrl}. Adding to cooldown.`);
            failedRefreshUrls.set(originalUrl, Date.now());

            // Report this to the auth module - if too many occur, it will logout
            const authStillValid = report401AfterRefresh();
            if (!authStillValid) {
              // User was logged out due to too many failed retries
              console.error('[Auth] Too many 401s after refresh, logging out');
              const logoutError = new Error('Session expired. Please login again.');
              logoutError.status = 401;
              throw logoutError;
            }
          }
          throw retryError;
        }
      }

      onRefreshed();
      console.error('[Auth] Token refresh failed:', refreshResult.error);
      throw new Error(refreshResult.error || 'Session expired');
    } catch (error) {
      onRefreshed();
      throw error;
    } finally {
      isRefreshing = false;
      refreshPromise = null; // Clear the promise so new refreshes can start
    }
  })();

  return refreshPromise;
}

export const authApi = {
  async login(email, password) {
    return apiRequest(buildUrl('/auth/login'), {
      method: 'POST',
      body: { email, password }
    });
  },

  async register(userData) {
    return apiRequest(buildUrl('/auth/register'), {
      method: 'POST',
      body: userData
    });
  },

  async logout() {
    return apiRequest(buildUrl('/auth/logout'), {
      method: 'POST'
    });
  },

  async getCurrentUser() {
    return apiRequest(buildUrl('/auth/me'));
  },

  async requestPasswordReset(email) {
    return apiRequestWithFallback(
      [buildUrl('/auth/password-reset/request'), buildUrl('/auth/forgot')],
      {
        method: 'POST',
        body: { email }
      }
    );
  },

  async resetPassword(token, newPassword) {
    return apiRequestWithFallback(
      [buildUrl('/auth/password-reset/confirm'), buildUrl('/auth/reset')],
      {
        method: 'POST',
        body: { token, password: newPassword }
      }
    );
  },

  async refreshToken() {
    return apiRequest(buildUrl('/auth/refresh'), {
      method: 'POST'
    });
  },

  async verifyEmail(token) {
    return apiRequest(buildUrl('/auth/verify-email'), {
      method: 'POST',
      body: { token }
    });
  },

  async getSessions() {
    return apiRequest(buildUrl('/auth/sessions'));
  },

  async revokeSession(tokenId) {
    return apiRequest(buildUrl(`/auth/sessions/${tokenId}/revoke`), {
      method: 'POST'
    });
  },

  async revokeAllSessions() {
    return apiRequest(buildUrl('/auth/sessions/revoke-all'), {
      method: 'POST'
    });
  }
};

export const appApi = {
  async getTasks(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const suffix = queryString ? `?${queryString}` : '';
    return apiRequest(buildUrl(`/app/tasks${suffix}`));
  },

  async createTask(taskData) {
    return apiRequest(buildUrl('/app/tasks'), {
      method: 'POST',
      body: taskData
    });
  },

  async startTask(taskId) {
    return apiRequest(buildUrl(`/app/tasks/${taskId}/start`), {
      method: 'POST'
    });
  },

  async stopTask(taskId) {
    return apiRequest(buildUrl(`/app/tasks/${taskId}/stop`), {
      method: 'POST'
    });
  },

  async completeTask(taskId) {
    return apiRequest(buildUrl(`/app/tasks/${taskId}/complete`), {
      method: 'POST'
    });
  },

  async bulkTaskAction(taskIds = [], action = '') {
    return apiRequest(buildUrl('/app/tasks/bulk'), {
      method: 'POST',
      body: {
        task_ids: taskIds,
        action
      }
    });
  },

  async reopenTask(taskId) {
    return apiRequest(buildUrl(`/app/tasks/${taskId}/reopen`), {
      method: 'POST'
    });
  },

  async setTaskDailyCheck(taskId) {
    return apiRequest(buildUrl(`/app/tasks/${taskId}/daily-check`), {
      method: 'POST'
    });
  },

  async deleteTask(taskId) {
    return apiRequest(buildUrl(`/app/tasks/${taskId}/delete`), {
      method: 'POST'
    });
  },

  async updateTask(taskId, taskData) {
    return apiRequest(buildUrl(`/app/tasks/${taskId}/edit`), {
      method: 'POST',
      body: taskData
    });
  },

  async getProjects() {
    return apiRequest(buildUrl('/app/projects'));
  },

  async createProject(name, labelIds = []) {
    return apiRequest(buildUrl('/app/projects'), {
      method: 'POST',
      body: { name, label_ids: labelIds }
    });
  },

  async deleteProject(projectId) {
    return apiRequest(buildUrl(`/app/projects/${projectId}/delete`), {
      method: 'POST'
    });
  },

  async updateProject(projectId, projectData) {
    return apiRequest(buildUrl(`/app/projects/${projectId}/update`), {
      method: 'POST',
      body: projectData
    });
  },

  async getReportsSummary(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const suffix = queryString ? `?${queryString}` : '';
    return apiRequest(buildUrl(`/app/reports/summary${suffix}`));
  },

  async getTimerEntries(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const suffix = queryString ? `?${queryString}` : '';
    return apiRequest(buildUrl(`/app/timer/entries${suffix}`));
  },

  async getTimerDashboard(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const suffix = queryString ? `?${queryString}` : '';
    return apiRequest(buildUrl(`/aggregate/timer-dashboard${suffix}`));
  },

  async getCalendarBoard() {
    return apiRequest(buildUrl('/app/calendar/board'));
  },

  async setDailyTarget(targetSeconds) {
    return apiRequest(buildUrl('/app/daily-target'), {
      method: 'POST',
      body: { target_seconds: targetSeconds }
    });
  },

  async getPlanner() {
    return apiRequest(buildUrl('/app/planner'));
  },

  async getTodos() {
    return apiRequest(buildUrl('/app/todos'));
  },

  async createTodo(name) {
    return apiRequest(buildUrl('/app/todos'), {
      method: 'POST',
      body: { name }
    });
  },

  async toggleTodo(todoId, done) {
    return apiRequest(buildUrl(`/app/todos/${todoId}/toggle`), {
      method: 'POST',
      body: { done }
    });
  },

  async deleteTodo(todoId) {
    return apiRequest(buildUrl(`/app/todos/${todoId}/delete`), {
      method: 'POST'
    });
  },

  async getHabits() {
    return apiRequest(buildUrl('/app/habits'));
  },

  async createHabit(habitData) {
    return apiRequest(buildUrl('/app/habits'), {
      method: 'POST',
      body: habitData
    });
  },

  async toggleHabit(habitId, payload) {
    return apiRequest(buildUrl(`/app/habits/${habitId}/toggle`), {
      method: 'POST',
      body: payload
    });
  },

  async updateHabit(habitId, habitData) {
    return apiRequest(buildUrl(`/app/habits/${habitId}/update`), {
      method: 'POST',
      body: habitData
    });
  },

  async deleteHabit(habitId) {
    return apiRequest(buildUrl(`/app/habits/${habitId}/delete`), {
      method: 'POST'
    });
  },

  async getGoals() {
    return apiRequest(buildUrl('/app/goals'));
  },

  async getGoal(goalId) {
    return apiRequest(buildUrl(`/app/goals/${goalId}`));
  },

  async createGoal(goalData) {
    return apiRequest(buildUrl('/app/goals'), {
      method: 'POST',
      body: goalData
    });
  },

  async updateGoal(goalId, goalData) {
    return apiRequest(buildUrl(`/app/goals/${goalId}/edit`), {
      method: 'POST',
      body: goalData
    });
  },

  async deleteGoal(goalId) {
    return apiRequest(buildUrl(`/app/goals/${goalId}/delete`), {
      method: 'POST'
    });
  },

  async toggleGoalSubgoal(subgoalId, done) {
    return apiRequest(buildUrl(`/app/goals/subgoals/${subgoalId}/toggle`), {
      method: 'POST',
      body: { done }
    });
  },

  async addGoalSubgoal(goalId, subgoalData) {
    return apiRequest(buildUrl(`/app/goals/${goalId}/subgoals`), {
      method: 'POST',
      body: subgoalData
    });
  },

  async getWeeklyGoals(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const suffix = queryString ? `?${queryString}` : '';
    return apiRequest(buildUrl(`/app/weekly-goals${suffix}`));
  },

  async createWeeklyGoal(goalData) {
    return apiRequest(buildUrl('/app/weekly-goals'), {
      method: 'POST',
      body: goalData
    });
  },

  async toggleWeeklyGoal(goalId, status) {
    return apiRequest(buildUrl(`/app/weekly-goals/${goalId}/toggle`), {
      method: 'POST',
      body: { status }
    });
  },

  async deleteWeeklyGoal(goalId) {
    return apiRequest(buildUrl(`/app/weekly-goals/${goalId}/delete`), {
      method: 'POST'
    });
  },

  async getReminders() {
    return apiRequest(buildUrl('/app/reminders'));
  },

  async createReminder(reminderData) {
    return apiRequest(buildUrl('/app/reminders'), {
      method: 'POST',
      body: reminderData
    });
  },

  async updateReminder(reminderId, reminderData) {
    return apiRequest(buildUrl(`/app/reminders/${reminderId}/update`), {
      method: 'POST',
      body: reminderData
    });
  },

  async toggleReminder(reminderId, isActive) {
    return apiRequest(buildUrl(`/app/reminders/${reminderId}/toggle`), {
      method: 'POST',
      body: { is_active: isActive }
    });
  },

  async deleteReminder(reminderId) {
    return apiRequest(buildUrl(`/app/reminders/${reminderId}/delete`), {
      method: 'POST'
    });
  },

  async getLabels() {
    return apiRequest(buildUrl('/app/labels'));
  },

  async createLabel(name, color) {
    return apiRequest(buildUrl('/app/labels'), {
      method: 'POST',
      body: { name, color }
    });
  },

  async updateLabel(labelId, name, color) {
    return apiRequest(buildUrl(`/app/labels/${labelId}/edit`), {
      method: 'POST',
      body: { name, color }
    });
  },

  async deleteLabel(labelId) {
    return apiRequest(buildUrl(`/app/labels/${labelId}/delete`), {
      method: 'POST'
    });
  },

  async getAccount() {
    return apiRequest(buildUrl('/app/account'));
  },

  async updateProfile(profileData) {
    return apiRequest(buildUrl('/app/settings/profile'), {
      method: 'POST',
      body: profileData
    });
  },

  async updateTimezone(timezone) {
    return apiRequest(buildUrl('/app/settings/timezone'), {
      method: 'POST',
      body: { timezone }
    });
  },

  async getNotificationSettings() {
    return apiRequest(buildUrl('/app/settings/notifications'));
  },

  async updateNotificationSettings(settingsData) {
    return apiRequest(buildUrl('/app/settings/notifications'), {
      method: 'POST',
      body: settingsData
    });
  },

  async getOverview() {
    const [tasks, projects] = await Promise.all([
      this.getTasks(),
      this.getProjects().catch(() => ({ projects: [] }))
    ]);

    const activeTasks = Array.isArray(tasks.tasks) ? tasks.tasks : [];
    const completedTasks = Array.isArray(tasks.completed_tasks) ? tasks.completed_tasks : [];
    const doneTodayTasks = Array.isArray(tasks.done_today_tasks) ? tasks.done_today_tasks : [];
    const totalTrackedSeconds = activeTasks.reduce((sum, task) => sum + Number(task.total_seconds || 0), 0);

    return {
      active_tasks_count: activeTasks.length,
      completed_tasks_count: completedTasks.length,
      done_today_count: doneTodayTasks.length,
      total_tracked_seconds: totalTrackedSeconds,
      projects_count: Array.isArray(projects.projects) ? projects.projects.length : 0
    };
  },

  async getReports(params = {}) {
    return this.getReportsSummary(params);
  },

  async getCalendarEvents(start, end) {
    return this.getTimerEntries({ start, end });
  }
};

export async function healthCheck() {
  const results = {
    auth: false,
    app: false
  };

  try {
    await apiRequest(buildUrl('/auth/health'), { timeout: 5000 });
    results.auth = true;
  } catch (err) {
    console.error('Auth service health check failed:', err);
  }

  try {
    await apiRequest(buildUrl('/app/health'), { timeout: 5000 });
    results.app = true;
  } catch (err) {
    console.error('App service health check failed:', err);
  }

  return results;
}
