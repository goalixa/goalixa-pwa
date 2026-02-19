/**
 * Auth View Module
 * Handles login and signup forms
 */

import { login, register, isAuthenticated, requestPasswordReset, resetPasswordWithToken } from '../auth.js';
import { showToast } from '../utils.js';
import { navigate, redirectAfterLogin } from '../router.js';

/**
 * Render auth view
 */
export async function render(container, path, params) {
  // Check if already authenticated
  if (isAuthenticated()) {
    redirectAfterLogin();
    return;
  }

  // Determine mode based on path
  let mode = 'login'; // login, signup, forgot-password, reset-password

  if (path === '/signup' || path === '/register') {
    mode = 'signup';
  } else if (path === '/forgot-password') {
    mode = 'forgot-password';
  } else if (path === '/reset-password') {
    mode = 'reset-password';
  }

  // Render HTML
  container.innerHTML = getAuthHTML(mode);

  // Initialize form handlers
  initAuthView(container, mode, params);
}

/**
 * Get auth HTML based on mode
 */
function getAuthHTML(mode) {
  const baseHTML = `
    <div class="auth-view">
      <div class="auth-background" id="particles-js"></div>
      <div class="auth-container">
        <div class="auth-box">
          <div class="auth-header">
            <div class="auth-logo">
              <i class="fas fa-bullseye"></i>
            </div>
            <h1 id="authTitle">${getTitle(mode)}</h1>
            <p id="authSubtitle">${getSubtitle(mode)}</p>
          </div>

          <div class="auth-content">
            ${getFormHTML(mode)}
          </div>

          <div class="auth-footer">
            ${getFooterHTML(mode)}
          </div>
        </div>
      </div>
    </div>
  `;

  return baseHTML;
}

/**
 * Get title based on mode
 */
function getTitle(mode) {
  switch (mode) {
    case 'signup': return 'Create Account';
    case 'forgot-password': return 'Reset Password';
    case 'reset-password': return 'Set New Password';
    default: return 'Welcome Back';
  }
}

/**
 * Get subtitle based on mode
 */
function getSubtitle(mode) {
  switch (mode) {
    case 'signup': return 'Start your productivity journey today';
    case 'forgot-password': return 'Enter your email to receive reset instructions';
    case 'reset-password': return 'Enter your new password below';
    default: return 'Sign in to access your goals and tasks';
  }
}

/**
 * Get form HTML based on mode
 */
function getFormHTML(mode) {
  switch (mode) {
    case 'signup':
      return `
        <form id="signupForm" class="auth-form">
          <div class="form-group">
            <label for="fullName">Full Name</label>
            <input type="text" id="fullName" name="fullName" placeholder="John Doe" required data-validation="name">
            <span class="error-message" id="fullNameError"></span>
          </div>
          <div class="form-group">
            <label for="signupEmail">Email</label>
            <input type="email" id="signupEmail" name="email" placeholder="john@example.com" required data-validation="email">
            <span class="error-message" id="signupEmailError"></span>
          </div>
          <div class="form-group">
            <label for="signupPassword">Password</label>
            <div class="password-input">
              <input type="password" id="signupPassword" name="password" placeholder="••••••••" required data-validation="password">
              <button type="button" class="password-toggle" tabindex="-1">
                <i class="fas fa-eye"></i>
              </button>
            </div>
            <span class="error-message" id="signupPasswordError"></span>
          </div>
          <div class="password-strength">
            <div class="strength-meter" id="strengthMeter">
              <div class="strength-segment" id="strength1"></div>
              <div class="strength-segment" id="strength2"></div>
              <div class="strength-segment" id="strength3"></div>
              <div class="strength-segment" id="strength4"></div>
            </div>
            <span class="strength-text" id="strengthText"></span>
          </div>
          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <div class="password-input">
              <input type="password" id="confirmPassword" name="confirmPassword" placeholder="••••••••" required data-validation="confirm">
              <button type="button" class="password-toggle" tabindex="-1">
                <i class="fas fa-eye"></i>
              </button>
            </div>
            <span class="error-message" id="confirmPasswordError"></span>
          </div>
          <button type="submit" class="btn btn-primary btn-block btn-large">
            <span class="btn-text">Create Account</span>
            <i class="fas fa-spinner fa-spin" style="display: none;"></i>
          </button>
        </form>
      `;

    case 'forgot-password':
      return `
        <form id="resetForm" class="auth-form">
          <div class="form-group">
            <label for="resetEmail">Email Address</label>
            <input type="email" id="resetEmail" name="email" placeholder="john@example.com" required data-validation="email">
            <span class="error-message" id="resetEmailError"></span>
          </div>
          <button type="submit" class="btn btn-primary btn-block btn-large">
            <span class="btn-text">Send Reset Link</span>
            <i class="fas fa-spinner fa-spin" style="display: none;"></i>
          </button>
        </form>
      `;

    case 'reset-password':
      return `
        <form id="newPasswordForm" class="auth-form">
          <div class="form-group">
            <label for="newPassword">New Password</label>
            <div class="password-input">
              <input type="password" id="newPassword" name="password" placeholder="••••••••" required>
              <button type="button" class="password-toggle" tabindex="-1">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>
          <div class="form-group">
            <label for="confirmNewPassword">Confirm New Password</label>
            <div class="password-input">
              <input type="password" id="confirmNewPassword" name="confirmPassword" placeholder="••••••••" required>
              <button type="button" class="password-toggle" tabindex="-1">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-block btn-large">
            <span class="btn-text">Reset Password</span>
            <i class="fas fa-spinner fa-spin" style="display: none;"></i>
          </button>
        </form>
      `;

    default: // login
      return `
        <form id="loginForm" class="auth-form">
          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" placeholder="john@example.com" required data-validation="email">
            <span class="error-message" id="emailError"></span>
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <div class="password-input">
              <input type="password" id="password" name="password" placeholder="••••••••" required data-validation="password">
              <button type="button" class="password-toggle" tabindex="-1">
                <i class="fas fa-eye"></i>
              </button>
            </div>
            <span class="error-message" id="passwordError"></span>
          </div>
          <div class="form-options">
            <label class="checkbox-label">
              <input type="checkbox" name="remember">
              <span>Remember me</span>
            </label>
            <a href="#/forgot-password" class="forgot-link">Forgot password?</a>
          </div>
          <button type="submit" class="btn btn-primary btn-block btn-large">
            <span class="btn-text">Sign In</span>
            <i class="fas fa-spinner fa-spin" style="display: none;"></i>
          </button>
        </form>
      `;
  }
}

/**
 * Get footer HTML based on mode
 */
function getFooterHTML(mode) {
  if (mode === 'signup') {
    return `
      <p>Already have an account? <a href="#/login">Sign in</a></p>
    `;
  } else if (mode === 'forgot-password' || mode === 'reset-password') {
    return `
      <p>Remember your password? <a href="#/login">Sign in</a></p>
    `;
  }
  return `
    <p>Don't have an account? <a href="#/signup">Create one</a></p>
  `;
}

/**
 * Initialize auth view handlers
 */
function initAuthView(container, mode, params) {
  // Initialize password toggles
  container.querySelectorAll('.password-toggle').forEach(toggle => {
    toggle.addEventListener('click', function () {
      const input = this.previousElementSibling;
      const icon = this.querySelector('i');

      if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    });
  });

  // Handle login form
  const loginForm = container.querySelector('#loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      const button = loginForm.querySelector('button[type="submit"]');
      setButtonLoading(button, true);

      const result = await login(email, password);

      setButtonLoading(button, false);

      if (result.success) {
        showToast('Welcome back!', 'success');
        redirectAfterLogin();
      } else {
        showToast(result.error, 'error');
      }
    });
  }

  // Handle signup form
  const signupForm = container.querySelector('#signupForm');
  if (signupForm) {
    let passwordStrengthChecker = null;

    // Initialize password strength checker if available
    const passwordInput = document.getElementById('signupPassword');
    if (passwordInput) {
      passwordInput.addEventListener('input', () => {
        checkPasswordStrength(passwordInput.value);
      });
    }

    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const password = document.getElementById('signupPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
      }

      const userData = {
        fullName: document.getElementById('fullName').value,
        email: document.getElementById('signupEmail').value,
        password: password
      };

      const button = signupForm.querySelector('button[type="submit"]');
      setButtonLoading(button, true);

      const result = await register(userData);

      setButtonLoading(button, false);

      if (result.success) {
        showToast('Account created successfully!', 'success');
        redirectAfterLogin();
      } else {
        showToast(result.error, 'error');
      }
    });
  }

  // Handle reset form
  const resetForm = container.querySelector('#resetForm');
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('resetEmail').value;

      const button = resetForm.querySelector('button[type="submit"]');
      setButtonLoading(button, true);

      const result = await requestPasswordReset(email);
      if (result.success) {
        showToast(result.message || 'If an account exists, you will receive reset instructions', 'success');
      } else {
        showToast(result.error || 'Unable to request password reset', 'error');
      }

      setButtonLoading(button, false);
      navigate('/login');
    });
  }

  // Handle set new password form
  const newPasswordForm = container.querySelector('#newPasswordForm');
  if (newPasswordForm) {
    newPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const token = params.token || params.t;
      if (!token) {
        showToast('Reset token is missing. Please use the link from your email.', 'error');
        return;
      }

      const password = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmNewPassword').value;

      if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
      }

      const button = newPasswordForm.querySelector('button[type="submit"]');
      setButtonLoading(button, true);

      const result = await resetPasswordWithToken(token, password);

      setButtonLoading(button, false);

      if (result.success) {
        showToast('Password reset successful. Please sign in.', 'success');
        navigate('/login');
      } else {
        showToast(result.error || 'Password reset failed', 'error');
      }
    });
  }
}

/**
 * Set button loading state
 */
function setButtonLoading(button, isLoading) {
  const text = button.querySelector('.btn-text');
  const spinner = button.querySelector('.fa-spinner');

  if (isLoading) {
    text.style.display = 'none';
    spinner.style.display = 'inline-block';
    button.disabled = true;
  } else {
    text.style.display = 'inline';
    spinner.style.display = 'none';
    button.disabled = false;
  }
}

/**
 * Check password strength
 */
function checkPasswordStrength(password) {
  let strength = 0;

  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;

  strength = Math.min(strength, 4);

  // Update UI
  for (let i = 1; i <= 4; i++) {
    const segment = document.getElementById(`strength${i}`);
    if (segment) {
      segment.classList.remove('active', 'danger', 'warning');
      if (i <= strength) {
        segment.classList.add('active');
        if (strength <= 2) {
          segment.classList.add('danger');
        } else if (strength === 3) {
          segment.classList.add('warning');
        }
      }
    }
  }

  const strengthText = document.getElementById('strengthText');
  if (strengthText) {
    const texts = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
    strengthText.textContent = texts[strength];
  }
}

// Export as default
export default {
  render,
  name: 'auth'
};
