/**
 * Auth Monitor - Debug and monitor authentication state
 * This module helps track auth issues in development/production
 */

import { eventBus } from './utils.js';

class AuthMonitor {
  constructor() {
    this.events = [];
    this.maxEvents = 100;
    this.sessionStartTime = Date.now();
    this.refreshCount = 0;
    this.logoutCount = 0;
    this.errorCount = 0;
  }

  /**
   * Log an auth event
   */
  logEvent(type, data = {}) {
    const event = {
      type,
      timestamp: new Date().toISOString(),
      sessionTime: Date.now() - this.sessionStartTime,
      data
    };

    this.events.push(event);

    // Keep only last maxEvents
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Update counters
    switch (type) {
      case 'auth:refresh':
        this.refreshCount++;
        break;
      case 'auth:logout':
        this.logoutCount++;
        break;
      case 'auth:error':
        this.errorCount++;
        break;
    }

    // Log to console in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log(`[AuthMonitor] ${type}:`, data);
    }
  }

  /**
   * Get recent events
   */
  getRecentEvents(count = 20) {
    return this.events.slice(-count);
  }

  /**
   * Get events by type
   */
  getEventsByType(type) {
    return this.events.filter(e => e.type === type);
  }

  /**
   * Get auth statistics
   */
  getStats() {
    return {
      sessionDuration: Date.now() - this.sessionStartTime,
      refreshCount: this.refreshCount,
      logoutCount: this.logoutCount,
      errorCount: this.errorCount,
      totalEvents: this.events.length,
      recentEvents: this.getRecentEvents(10)
    };
  }

  /**
   * Clear all events
   */
  clear() {
    this.events = [];
    this.sessionStartTime = Date.now();
    this.refreshCount = 0;
    this.logoutCount = 0;
    this.errorCount = 0;
  }

  /**
   * Export events for debugging
   */
  export() {
    return {
      stats: this.getStats(),
      events: this.events,
      exportDate: new Date().toISOString()
    };
  }

  /**
   * Check for potential issues
   */
  checkForIssues() {
    const issues = [];
    const stats = this.getStats();

    // Check for excessive logouts
    if (stats.logoutCount > 3 && stats.sessionDuration < 60 * 60 * 1000) { // More than 3 logouts in an hour
      issues.push({
        severity: 'high',
        message: 'Excessive logouts detected',
        details: `${stats.logoutCount} logouts in ${Math.round(stats.sessionDuration / 60000)} minutes`
      });
    }

    // Check for excessive errors
    if (stats.errorCount > 5) {
      issues.push({
        severity: 'medium',
        message: 'Multiple auth errors detected',
        details: `${stats.errorCount} errors in current session`
      });
    }

    // Check for refresh failures
    const refreshErrors = this.getEventsByType('auth:refresh').filter(e => e.data.success === false);
    if (refreshErrors.length > 2) {
      issues.push({
        severity: 'high',
        message: 'Token refresh failures detected',
        details: `${refreshErrors.length} failed refresh attempts`
      });
    }

    return issues;
  }
}

// Create singleton instance
const authMonitor = new AuthMonitor();

// Export for use in auth.js and debugging
export { authMonitor };

// Listen to auth events from eventBus
eventBus.on('auth:login', (data) => authMonitor.logEvent('auth:login', data));
eventBus.on('auth:logout', (data) => authMonitor.logEvent('auth:logout', data));
eventBus.on('auth:refresh', (data) => authMonitor.logEvent('auth:refresh', data));
eventBus.on('auth:error', (data) => authMonitor.logEvent('auth:error', data));

// Expose to window for debugging (development only)
if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
  window.authMonitor = authMonitor;
  console.log('[AuthMonitor] Debug mode enabled. Access via window.authMonitor');
}
