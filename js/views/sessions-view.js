/**
 * Sessions View Module
 * Displays and manages active user sessions
 */

import {
  getActiveSessions,
  revokeSession,
  revokeAllOtherSessions,
  isAuthenticated
} from '../auth.js';
import { showToast } from '../utils.js';
import { navigate } from '../router.js';

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString();
}

function getDeviceIcon(deviceType) {
  const icons = {
    'desktop': '<i class="fas fa-desktop"></i>',
    'mobile': '<i class="fas fa-mobile-alt"></i>',
    'tablet': '<i class="fas fa-tablet-alt"></i>',
  };
  return icons[deviceType] || '<i class="fas fa-desktop"></i>';
}

/**
 * Render sessions view
 */
export async function render(container, path, params) {
  if (!isAuthenticated()) {
    navigate('/login');
    return;
  }

  container.innerHTML = `
    <div class="sessions-view">
      <div class="view-header">
        <h1>Active Sessions</h1>
        <p class="subtitle">Manage your active sessions across all devices</p>
      </div>

      <div class="sessions-loading" id="sessionsLoading">
        <div class="spinner"></div>
        <p>Loading sessions...</p>
      </div>

      <div class="sessions-content" id="sessionsContent" style="display: none;">
        <div class="sessions-list" id="sessionsList"></div>

        <div class="sessions-actions">
          <button class="btn btn-danger" id="revokeAllBtn">
            <i class="fas fa-sign-out-alt"></i>
            Sign Out All Other Devices
          </button>
        </div>
      </div>

      <div class="sessions-error" id="sessionsError" style="display: none;">
        <i class="fas fa-exclamation-circle"></i>
        <p>Failed to load sessions</p>
        <button class="btn btn-secondary" id="retryBtn">Retry</button>
      </div>
    </div>
  `;

  initSessionsView(container);
  await loadSessions(container);
}

function initSessionsView(container) {
  const revokeAllBtn = container.querySelector('#revokeAllBtn');
  const retryBtn = container.querySelector('#retryBtn');

  if (revokeAllBtn) {
    revokeAllBtn.addEventListener('click', async () => {
      const confirmed = confirm(
        'Are you sure you want to sign out from all other devices? ' +
        'This will not sign you out from this device.'
      );

      if (confirmed) {
        revokeAllBtn.disabled = true;
        revokeAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing out...';

        const result = await revokeAllOtherSessions();

        revokeAllBtn.disabled = false;
        revokeAllBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sign Out All Other Devices';

        if (result.success) {
          showToast(
            result.message || `Signed out from ${result.revokedCount || 0} other device(s)`,
            'success'
          );
          await loadSessions(container);
        } else {
          showToast(result.error || 'Failed to revoke sessions', 'error');
        }
      }
    });
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      loadSessions(container);
    });
  }
}

async function loadSessions(container) {
  const loadingEl = container.querySelector('#sessionsLoading');
  const contentEl = container.querySelector('#sessionsContent');
  const errorEl = container.querySelector('#sessionsError');
  const listEl = container.querySelector('#sessionsList');

  // Show loading
  if (loadingEl) loadingEl.style.display = 'flex';
  if (contentEl) contentEl.style.display = 'none';
  if (errorEl) errorEl.style.display = 'none';

  const result = await getActiveSessions();

  // Hide loading
  if (loadingEl) loadingEl.style.display = 'none';

  if (result.success && result.sessions) {
    if (contentEl) contentEl.style.display = 'block';

    if (result.sessions.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-laptop"></i>
          <p>No active sessions found</p>
        </div>
      `;
    } else {
      listEl.innerHTML = result.sessions.map(session => createSessionCard(session)).join('');
      attachSessionListeners(container, listEl);
    }
  } else {
    if (errorEl) errorEl.style.display = 'flex';
  }
}

function createSessionCard(session) {
  const isCurrent = session.is_current;
  const deviceIcon = getDeviceIcon(session.device_type);
  const lastSeen = formatTimestamp(session.last_seen_at);
  const createdAt = formatTimestamp(session.created_at);

  return `
    <div class="session-card ${isCurrent ? 'current' : ''}" data-token-id="${session.id}">
      <div class="session-icon">
        ${deviceIcon}
      </div>

      <div class="session-info">
        <div class="session-header">
          <h3>${session.device || 'Unknown Device'}</h3>
          ${isCurrent ? '<span class="current-badge">Current</span>' : ''}
        </div>

        <div class="session-details">
          <div class="session-detail">
            <i class="fas fa-clock"></i>
            <span>Last seen: ${lastSeen}</span>
          </div>
          <div class="session-detail">
            <i class="fas fa-calendar"></i>
            <span>Created: ${createdAt}</span>
          </div>
        </div>
      </div>

      ${!isCurrent ? `
        <div class="session-actions">
          <button class="btn btn-sm btn-danger revoke-btn" data-token-id="${session.id}">
            <i class="fas fa-times"></i>
            Revoke
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function attachSessionListeners(container, listEl) {
  const revokeButtons = listEl.querySelectorAll('.revoke-btn');

  revokeButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const tokenId = e.currentTarget.dataset.tokenId;
      const card = e.currentTarget.closest('.session-card');

      const confirmed = confirm('Are you sure you want to revoke this session?');

      if (confirmed) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const result = await revokeSession(parseInt(tokenId));

        if (result.success) {
          showToast('Session revoked successfully', 'success');

          // Animate card removal
          card.style.opacity = '0';
          card.style.transform = 'translateX(100px)';

          setTimeout(() => {
            card.remove();

            // Check if no sessions left
            const remainingCards = listEl.querySelectorAll('.session-card');
            if (remainingCards.length === 0) {
              listEl.innerHTML = `
                <div class="empty-state">
                  <i class="fas fa-laptop"></i>
                  <p>No other active sessions</p>
                </div>
              `;
            }
          }, 300);
        } else {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-times"></i> Revoke';
          showToast(result.error || 'Failed to revoke session', 'error');
        }
      }
    });
  });
}

export default {
  render,
  name: 'sessions'
};
