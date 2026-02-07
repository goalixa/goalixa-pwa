/**
 * API Client for Goalixa PWA
 * Handles communication with all microservices
 */

// API endpoints configuration
const API_CONFIG = {
  api: 'https://api.goalixa.com'
};

/**
 * API Request wrapper
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
    'Accept': 'application/json'
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

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return response;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
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
 * Landing Service API
 */
export const landingApi = {
  /**
   * Get landing page content
   */
  async getContent() {
    return apiRequest(`${API_CONFIG.api}/landing/content`);
  },

  /**
   * Submit contact form
   */
  async submitContact(formData) {
    return apiRequest(`${API_CONFIG.api}/landing/contact`, {
      method: 'POST',
      body: formData
    });
  },

  /**
   * Get pricing information
   */
  async getPricing() {
    return apiRequest(`${API_CONFIG.api}/landing/pricing`);
  }
};

/**
 * Auth Service API
 */
export const authApi = {
  /**
   * Login user
   */
  async login(email, password) {
    return apiRequest(`${API_CONFIG.api}/auth/login`, {
      method: 'POST',
      body: { email, password }
    });
  },

  /**
   * Register new user
   */
  async register(userData) {
    return apiRequest(`${API_CONFIG.api}/auth/register`, {
      method: 'POST',
      body: userData
    });
  },

  /**
   * Logout user
   */
  async logout() {
    return apiRequest(`${API_CONFIG.api}/auth/logout`, {
      method: 'POST'
    });
  },

  /**
   * Get current user info
   */
  async getCurrentUser() {
    return apiRequest(`${API_CONFIG.api}/auth/me`);
  },

  /**
   * Request password reset
   */
  async requestPasswordReset(email) {
    return apiRequest(`${API_CONFIG.api}/auth/password-reset/request`, {
      method: 'POST',
      body: { email }
    });
  },

  /**
   * Reset password with token
   */
  async resetPassword(token, newPassword) {
    return apiRequest(`${API_CONFIG.api}/auth/password-reset/confirm`, {
      method: 'POST',
      body: { token, password: newPassword }
    });
  },

  /**
   * Refresh auth token
   */
  async refreshToken() {
    return apiRequest(`${API_CONFIG.api}/auth/refresh`, {
      method: 'POST'
    });
  },

  /**
   * Verify email
   */
  async verifyEmail(token) {
    return apiRequest(`${API_CONFIG.api}/auth/verify-email`, {
      method: 'POST',
      body: { token }
    });
  }
};

/**
 * App Service API
 */
export const appApi = {
  /**
   * Get user's tasks
   */
  async getTasks(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`${API_CONFIG.api}/app/tasks?${queryString}`);
  },

  /**
   * Create task
   */
  async createTask(taskData) {
    return apiRequest(`${API_CONFIG.api}/app/tasks`, {
      method: 'POST',
      body: taskData
    });
  },

  /**
   * Update task
   */
  async updateTask(taskId, taskData) {
    return apiRequest(`${API_CONFIG.api}/app/tasks/${taskId}`, {
      method: 'PUT',
      body: taskData
    });
  },

  /**
   * Delete task
   */
  async deleteTask(taskId) {
    return apiRequest(`${API_CONFIG.api}/app/tasks/${taskId}`, {
      method: 'DELETE'
    });
  },

  /**
   * Get goals
   */
  async getGoals() {
    return apiRequest(`${API_CONFIG.api}/app/goals`);
  },

  /**
   * Get habits
   */
  async getHabits() {
    return apiRequest(`${API_CONFIG.api}/app/habits`);
  },

  /**
   * Get timer sessions
   */
  async getTimerSessions(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`${API_CONFIG.api}/app/timer/sessions?${queryString}`);
  },

  /**
   * Start timer session
   */
  async startTimer(taskId, duration) {
    return apiRequest(`${API_CONFIG.api}/app/timer/start`, {
      method: 'POST',
      body: { task_id: taskId, duration }
    });
  },

  /**
   * Stop timer session
   */
  async stopTimer(sessionId) {
    return apiRequest(`${API_CONFIG.api}/app/timer/stop`, {
      method: 'POST',
      body: { session_id: sessionId }
    });
  },

  /**
   * Get overview/dashboard data
   */
  async getOverview() {
    return apiRequest(`${API_CONFIG.api}/app/overview`);
  },

  /**
   * Get reports
   */
  async getReports(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`${API_CONFIG.api}/app/reports?${queryString}`);
  },

  /**
   * Get projects
   */
  async getProjects() {
    return apiRequest(`${API_CONFIG.api}/app/projects`);
  },

  /**
   * Get calendar events
   */
  async getCalendarEvents(start, end) {
    return apiRequest(`${API_CONFIG.api}/app/calendar?start=${start}&end=${end}`);
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
    await apiRequest(`${API_CONFIG.api}/landing/health`, { timeout: 5000 });
    results.landing = true;
  } catch (err) {
    console.error('Landing service health check failed:', err);
  }

  try {
    await apiRequest(`${API_CONFIG.api}/auth/health`, { timeout: 5000 });
    results.auth = true;
  } catch (err) {
    console.error('Auth service health check failed:', err);
  }

  try {
    await apiRequest(`${API_CONFIG.api}/app/health`, { timeout: 5000 });
    results.app = true;
  } catch (err) {
    console.error('App service health check failed:', err);
  }

  return results;
}
