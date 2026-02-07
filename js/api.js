/**
 * API Client for Goalixa PWA
 * Handles communication with all microservices
 */

// API endpoints configuration
const API_CONFIG = {
  landing: window.location.origin, // Same domain
  auth: 'https://auth.goalixa.com',
  app: 'https://app.goalixa.com'
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
    return apiRequest(`${API_CONFIG.landing}/api/content`);
  },

  /**
   * Submit contact form
   */
  async submitContact(formData) {
    return apiRequest(`${API_CONFIG.landing}/api/contact`, {
      method: 'POST',
      body: formData
    });
  },

  /**
   * Get pricing information
   */
  async getPricing() {
    return apiRequest(`${API_CONFIG.landing}/api/pricing`);
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
    return apiRequest(`${API_CONFIG.auth}/api/login`, {
      method: 'POST',
      body: { email, password }
    });
  },

  /**
   * Register new user
   */
  async register(userData) {
    return apiRequest(`${API_CONFIG.auth}/api/register`, {
      method: 'POST',
      body: userData
    });
  },

  /**
   * Logout user
   */
  async logout() {
    return apiRequest(`${API_CONFIG.auth}/api/logout`, {
      method: 'POST'
    });
  },

  /**
   * Get current user info
   */
  async getCurrentUser() {
    return apiRequest(`${API_CONFIG.auth}/api/me`);
  },

  /**
   * Request password reset
   */
  async requestPasswordReset(email) {
    return apiRequest(`${API_CONFIG.auth}/api/password-reset/request`, {
      method: 'POST',
      body: { email }
    });
  },

  /**
   * Reset password with token
   */
  async resetPassword(token, newPassword) {
    return apiRequest(`${API_CONFIG.auth}/api/password-reset/confirm`, {
      method: 'POST',
      body: { token, password: newPassword }
    });
  },

  /**
   * Refresh auth token
   */
  async refreshToken() {
    return apiRequest(`${API_CONFIG.auth}/api/refresh`, {
      method: 'POST'
    });
  },

  /**
   * Verify email
   */
  async verifyEmail(token) {
    return apiRequest(`${API_CONFIG.auth}/api/verify-email`, {
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
    return apiRequest(`${API_CONFIG.app}/api/tasks?${queryString}`);
  },

  /**
   * Create task
   */
  async createTask(taskData) {
    return apiRequest(`${API_CONFIG.app}/api/tasks`, {
      method: 'POST',
      body: taskData
    });
  },

  /**
   * Update task
   */
  async updateTask(taskId, taskData) {
    return apiRequest(`${API_CONFIG.app}/api/tasks/${taskId}`, {
      method: 'PUT',
      body: taskData
    });
  },

  /**
   * Delete task
   */
  async deleteTask(taskId) {
    return apiRequest(`${API_CONFIG.app}/api/tasks/${taskId}`, {
      method: 'DELETE'
    });
  },

  /**
   * Get goals
   */
  async getGoals() {
    return apiRequest(`${API_CONFIG.app}/api/goals`);
  },

  /**
   * Get habits
   */
  async getHabits() {
    return apiRequest(`${API_CONFIG.app}/api/habits`);
  },

  /**
   * Get timer sessions
   */
  async getTimerSessions(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`${API_CONFIG.app}/api/timer/sessions?${queryString}`);
  },

  /**
   * Start timer session
   */
  async startTimer(taskId, duration) {
    return apiRequest(`${API_CONFIG.app}/api/timer/start`, {
      method: 'POST',
      body: { task_id: taskId, duration }
    });
  },

  /**
   * Stop timer session
   */
  async stopTimer(sessionId) {
    return apiRequest(`${API_CONFIG.app}/api/timer/stop`, {
      method: 'POST',
      body: { session_id: sessionId }
    });
  },

  /**
   * Get overview/dashboard data
   */
  async getOverview() {
    return apiRequest(`${API_CONFIG.app}/api/overview`);
  },

  /**
   * Get reports
   */
  async getReports(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`${API_CONFIG.app}/api/reports?${queryString}`);
  },

  /**
   * Get projects
   */
  async getProjects() {
    return apiRequest(`${API_CONFIG.app}/api/projects`);
  },

  /**
   * Get calendar events
   */
  async getCalendarEvents(start, end) {
    return apiRequest(`${API_CONFIG.app}/api/calendar?start=${start}&end=${end}`);
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
    await apiRequest(`${API_CONFIG.landing}/api/health`, { timeout: 5000 });
    results.landing = true;
  } catch (err) {
    console.error('Landing service health check failed:', err);
  }

  try {
    await apiRequest(`${API_CONFIG.auth}/api/health`, { timeout: 5000 });
    results.auth = true;
  } catch (err) {
    console.error('Auth service health check failed:', err);
  }

  try {
    await apiRequest(`${API_CONFIG.app}/api/health`, { timeout: 5000 });
    results.app = true;
  } catch (err) {
    console.error('App service health check failed:', err);
  }

  return results;
}
