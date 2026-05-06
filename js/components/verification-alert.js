/**
 * Verification Alert Component
 * Reusable email verification alert with resend functionality and cooldown timer
 */

import { authApi } from '../api.js';
import { showToast } from '../utils.js';

export class VerificationAlert {
  constructor(container, email, options = {}) {
    this.container = container;
    this.email = email;
    this.cooldownSeconds = options.cooldownSeconds || 60;
    this.onResendSuccess = options.onResendSuccess || null;
    this.cooldownTimer = null;
    this.alertElement = null;

    // Check for existing cooldown in sessionStorage
    this.checkExistingCooldown();
  }

  checkExistingCooldown() {
    const cooldownKey = `verification_cooldown_${this.email}`;
    const storedTimestamp = sessionStorage.getItem(cooldownKey);

    if (storedTimestamp) {
      const elapsed = Math.floor((Date.now() - parseInt(storedTimestamp, 10)) / 1000);
      const remaining = this.cooldownSeconds - elapsed;

      if (remaining > 0) {
        this.cooldownSeconds = remaining;
      } else {
        sessionStorage.removeItem(cooldownKey);
      }
    }
  }

  render() {
    const alertHTML = `
      <div class="verification-alert" role="alert">
        <div class="alert-icon">
          <i class="fas fa-envelope-circle-check"></i>
        </div>
        <div class="alert-content">
          <h3 class="alert-title">Verify Your Email</h3>
          <p class="alert-message">
            We sent a verification link to <strong class="user-email">${this.escapeHtml(this.email)}</strong>
          </p>
          <div class="alert-actions">
            <button class="btn btn-primary resend-button" data-action="resend">
              <span class="btn-text">Resend Email</span>
              <i class="fas fa-spinner fa-spin" style="display: none;"></i>
            </button>
            <span class="resend-timer" style="display: none;">
              Resend in <span class="countdown">${this.cooldownSeconds}</span>s
            </span>
            <span class="resend-success" style="display: none;">
              <i class="fas fa-check-circle"></i> Email sent! Check your inbox
            </span>
          </div>
        </div>
        <button class="alert-close" aria-label="Close alert">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    this.container.insertAdjacentHTML('beforeend', alertHTML);
    this.alertElement = this.container.querySelector('.verification-alert');

    this.attachEventListeners();

    // Start cooldown if active
    if (this.cooldownSeconds < 60) {
      this.startCooldown(this.cooldownSeconds);
    }
  }

  attachEventListeners() {
    const resendButton = this.alertElement.querySelector('[data-action="resend"]');
    const closeButton = this.alertElement.querySelector('.alert-close');

    resendButton.addEventListener('click', () => this.handleResend());
    closeButton.addEventListener('click', () => this.destroy());
  }

  async handleResend() {
    const button = this.alertElement.querySelector('.resend-button');
    const btnText = button.querySelector('.btn-text');
    const spinner = button.querySelector('.fa-spinner');

    // Disable button and show loading
    button.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'inline-block';

    try {
      const result = await authApi.resendVerification(this.email);

      if (result.success) {
        showToast(result.message || 'Verification email sent!', 'success');

        // Hide button, show success message
        button.style.display = 'none';
        const successMsg = this.alertElement.querySelector('.resend-success');
        successMsg.style.display = 'flex';

        // Start cooldown
        this.startCooldown(60);

        // Store cooldown timestamp
        const cooldownKey = `verification_cooldown_${this.email}`;
        sessionStorage.setItem(cooldownKey, Date.now().toString());

        // Call success callback if provided
        if (this.onResendSuccess) {
          this.onResendSuccess();
        }
      } else {
        showToast(result.error || 'Failed to resend email', 'error');
        button.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
      }
    } catch (error) {
      showToast('Failed to resend email. Please try again.', 'error');
      button.disabled = false;
      btnText.style.display = 'inline';
      spinner.style.display = 'none';
    }
  }

  startCooldown(seconds) {
    const button = this.alertElement.querySelector('.resend-button');
    const timer = this.alertElement.querySelector('.resend-timer');
    const countdown = timer.querySelector('.countdown');
    const successMsg = this.alertElement.querySelector('.resend-success');

    button.style.display = 'none';
    successMsg.style.display = 'none';
    timer.style.display = 'inline';

    let remaining = seconds;
    countdown.textContent = remaining;

    this.cooldownTimer = setInterval(() => {
      remaining--;
      countdown.textContent = remaining;

      if (remaining <= 0) {
        clearInterval(this.cooldownTimer);
        timer.style.display = 'none';
        button.style.display = 'inline-flex';
        button.disabled = false;

        // Clear sessionStorage cooldown
        const cooldownKey = `verification_cooldown_${this.email}`;
        sessionStorage.removeItem(cooldownKey);
      }
    }, 1000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy() {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
    }
    if (this.alertElement) {
      this.alertElement.remove();
    }
  }
}
