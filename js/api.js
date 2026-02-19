/**
 * API Client for Goalixa PWA
 * Handles communication with all microservices
 */

// API endpoints configuration
const API_CONFIG = {
  api: (typeof window !== 'undefined' && window.__GOALIXA_API_BASE__) || 'https://api.goalixa.com'
};

// Refresh state to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshSubscribers = [];

function buildUrl(path) {
  return `${API_CONFIG.api}${path}`;
}

/**
 * Add subscriber to be notified after token refresh
 */
function subscribeToRefresh(callback) {
  refreshSubscribers.push(callback);
}

/**
 * Notify all subscribers that refresh is complete
 */
function onRefreshed() {
  refreshSubscribers.forEach((callback) => callback());
  refreshSubscribers = [];
}

/**
 * API Request wrapper with automatic token refresh on 401
 */
async function apiRequest(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body = null,
    credentials = 'include',
    timeout = 30000
  } = options;

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

    // Handle non-JSON responses
    if (!contentType || !contentType.includes('application/json')) {
      if (!response.ok) {
        if (response.status === 401) {
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
      if (response.status === 401) {
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
  }
}

/**
 * Try multiple endpoints in order for compatibility during migration.
 */
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

/**
 * Handle 401 errors with automatic token refresh
 */
async function handle401Error(originalUrl, originalOptions) {
  if (isRefreshing) {
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

  isRefreshing = true;

  try {
    // Dynamically import auth to avoid circular dependency
    const { refreshToken } = await import('./auth.js');
    const refreshResult = await refreshToken();

    if (refreshResult.success) {
      onRefreshed();
      return apiRequest(originalUrl, originalOptions);
    }

    onRefreshed();
    throw new Error(refreshResult.error || 'Session expired');
  } catch (error) {
    onRefreshed();
    throw error;
  } finally {
    isRefreshing = false;
  }
}

/**
 * Landing Service API
 */
export const landingApi = {
  async getContent() {
    return apiRequest(buildUrl('/landing/content'));
  },

  async submitContact(formData) {
    return apiRequest(buildUrl('/landing/contact'), {
      method: 'POST',
      body: formData
    });
  },

  async getPricing() {
    return apiRequest(buildUrl('/landing/pricing'));
  }
};

/**
 * Auth Service API
 */
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
  }
};

/**
 * App Service API
 */
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

  // Backward-compatible aliases.
  async getReports(params = {}) {
    return this.getReportsSummary(params);
  },

  async getCalendarEvents(start, end) {
    return this.getTimerEntries({ start, end });
  }
};

/**
 * Health check for all services
 */
export async function healthCheck() {
  const results = {
    landing: false,
    auth: false,
    app: false
  };

  try {
    await apiRequest(buildUrl('/landing/health'), { timeout: 5000 });
    results.landing = true;
  } catch (err) {
    console.error('Landing service health check failed:', err);
  }

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
