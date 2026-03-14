/**
 * Auth View Module
 * Mirrors auth-service login/signup UI inside PWA routes.
 */

import {
  login,
  register,
  isAuthenticated,
  requestPasswordReset,
  resetPasswordWithToken,
  enableLocalDevBypass
} from '../auth.js';
import { showToast } from '../utils.js';
import { navigate, redirectAfterLogin } from '../router.js';

function isLocalhost() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

/**
 * Render auth view
 */
export async function render(container, path, params) {
  if (isAuthenticated()) {
    redirectAfterLogin();
    return;
  }

  let mode = 'login';

  if (path === '/signup' || path === '/register') {
    mode = 'signup';
  } else if (path === '/forgot-password') {
    mode = 'forgot-password';
  } else if (path === '/reset-password') {
    mode = 'reset-password';
  }

  container.innerHTML = getAuthHTML(mode);
  initAuthView(container, mode, params);
}

function getAuthHTML(mode) {
  return `
    <div class="auth-view auth-ui">
      <div class="auth-wrapper">
        <div class="auth-container">
          <div class="glass-container">
            <div class="auth-header">
              <div class="brand">
                <img class="brand-logo" src="/icons/goalixa-logo.png" alt="Goalixa" />
              </div>
              <h1>${getTitle(mode)}</h1>
              ${getSubtitle(mode) ? `<p>${getSubtitle(mode)}</p>` : ''}
            </div>

            ${getFormHTML(mode)}

            <div class="auth-footer">
              ${getFooterHTML(mode)}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getTitle(mode) {
  switch (mode) {
    case 'signup':
      return 'Create your account';
    case 'forgot-password':
      return 'Reset password';
    case 'reset-password':
      return 'Set a new password';
    default:
      return 'Welcome back';
  }
}

function getSubtitle(mode) {
  switch (mode) {
    case 'signup':
      return '';
    case 'forgot-password':
      return 'Enter your email to receive reset instructions.';
    case 'reset-password':
      return 'Choose a new password for your account.';
    default:
      return '';
  }
}

function getFormHTML(mode) {
  switch (mode) {
    case 'signup':
      return `
        <form class="auth-form" id="signupForm">
          <div class="form-group">
            <label class="form-label" for="fullName">Full name</label>
            <div class="input-wrapper">
              <input type="text" class="form-input" id="fullName" name="fullName" placeholder="John Doe" autocomplete="name" required>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="signupEmail">Email</label>
            <div class="input-wrapper">
              <input type="email" class="form-input" id="signupEmail" name="email" placeholder="you@example.com" autocomplete="email" required>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="signupPassword">Password</label>
            <div class="input-wrapper">
              <input type="password" class="form-input" id="signupPassword" name="password" placeholder="Create a strong password" autocomplete="new-password" required>
              <button type="button" class="password-toggle" data-password-toggle="signupPassword" aria-label="Toggle password visibility">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="confirmPassword">Confirm password</label>
            <div class="input-wrapper">
              <input type="password" class="form-input" id="confirmPassword" name="confirmPassword" placeholder="Confirm your password" autocomplete="new-password" required>
              <button type="button" class="password-toggle" data-password-toggle="confirmPassword" aria-label="Toggle password visibility">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="remember-me">
              <span class="checkbox-wrapper">
                <input type="checkbox" id="terms" required>
                <span class="checkbox-custom"></span>
              </span>
              <span>I agree to Terms and Privacy Policy</span>
            </label>
          </div>

          <button type="submit" class="auth-button" id="signupButton">
            <span class="btn-text">Create Account</span>
            <i class="fas fa-spinner fa-spin" style="display: none;"></i>
          </button>
        </form>
      `;

    case 'forgot-password':
      return `
        <form class="auth-form" id="resetForm">
          <div class="form-group">
            <label class="form-label" for="resetEmail">Email</label>
            <div class="input-wrapper">
              <input type="email" class="form-input" id="resetEmail" name="email" placeholder="you@example.com" autocomplete="email" required>
            </div>
          </div>

          <button type="submit" class="auth-button">
            <span class="btn-text">Send reset link</span>
            <i class="fas fa-spinner fa-spin" style="display: none;"></i>
          </button>
        </form>
      `;

    case 'reset-password':
      return `
        <form class="auth-form" id="newPasswordForm">
          <div class="form-group">
            <label class="form-label" for="newPassword">New password</label>
            <div class="input-wrapper">
              <input type="password" class="form-input" id="newPassword" name="password" placeholder="Enter new password" autocomplete="new-password" required>
              <button type="button" class="password-toggle" data-password-toggle="newPassword" aria-label="Toggle password visibility">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="confirmNewPassword">Confirm password</label>
            <div class="input-wrapper">
              <input type="password" class="form-input" id="confirmNewPassword" name="confirmPassword" placeholder="Confirm new password" autocomplete="new-password" required>
              <button type="button" class="password-toggle" data-password-toggle="confirmNewPassword" aria-label="Toggle password visibility">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>

          <button type="submit" class="auth-button">
            <span class="btn-text">Reset password</span>
            <i class="fas fa-spinner fa-spin" style="display: none;"></i>
          </button>
        </form>
      `;

    default:
      return `
        <form class="auth-form" id="loginForm">
          <div class="form-group">
            <label class="form-label" for="email">Email</label>
            <div class="input-wrapper">
              <input type="email" class="form-input" id="email" name="email" placeholder="you@example.com" autocomplete="email" required>
            </div>
          </div>

          <div class="form-group">
            <div class="form-options">
              <label class="form-label" for="password">Password</label>
              <a href="#/forgot-password" class="forgot-password">Forgot password?</a>
            </div>
            <div class="input-wrapper">
              <input type="password" class="form-input" id="password" name="password" placeholder="Enter your password" autocomplete="current-password" required>
              <button type="button" class="password-toggle" data-password-toggle="password" aria-label="Toggle password visibility">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="remember-me">
              <span class="checkbox-wrapper">
                <input type="checkbox" id="rememberMe" name="remember">
                <span class="checkbox-custom"></span>
              </span>
              <span>Remember me</span>
            </label>
          </div>

          <button type="submit" class="auth-button" id="loginButton">
            <span class="btn-text">Sign In</span>
            <i class="fas fa-spinner fa-spin" style="display: none;"></i>
          </button>

          ${isLocalhost() ? `
            <button type="button" class="social-button" id="localDevBypassButton">
              <i class="fas fa-flask"></i>
              Local Dev: Skip Login
            </button>
          ` : ''}
        </form>

        <div class="social-divider">
          <span>Or continue with</span>
        </div>

        <div class="social-buttons">
          <button type="button" class="social-button google" data-action="google-login">
            <i class="fab fa-google"></i>
            Continue with Google
          </button>
        </div>
      `;
  }
}

function getFooterHTML(mode) {
  if (mode === 'signup') {
    return `Already have an account? <a href="#/login">Sign in here</a>`;
  }

  if (mode === 'forgot-password' || mode === 'reset-password') {
    return `Remember your password? <a href="#/login">Sign in here</a>`;
  }

  return `Don't have an account? <a href="#/signup">Create one now</a>`;
}

function initAuthView(container, mode, params) {
  // Initialize form validation helpers
  initFormValidation(container, mode);

  container.querySelectorAll('[data-password-toggle]').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const input = container.querySelector(`#${toggle.dataset.passwordToggle}`);
      const icon = toggle.querySelector('i');
      if (!input || !icon) return;

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

  const googleButton = container.querySelector('[data-action="google-login"]');
  if (googleButton) {
    googleButton.addEventListener('click', () => {
      showToast('Google login is not configured in PWA yet.', 'warning');
    });
  }

  const loginForm = container.querySelector('#loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFormErrors(container);

      const emailInput = container.querySelector('#email');
      const passwordInput = container.querySelector('#password');
      const email = emailInput?.value || '';
      const password = passwordInput?.value || '';
      const button = loginForm.querySelector('button[type="submit"]');

      // Client-side validation
      let hasError = false;
      if (!email) {
        showFieldError(emailInput, 'Email is required');
        hasError = true;
      } else if (!isValidEmail(email)) {
        showFieldError(emailInput, 'Please enter a valid email address');
        hasError = true;
      }
      if (!password) {
        showFieldError(passwordInput, 'Password is required');
        hasError = true;
      }
      if (hasError) return;

      setButtonLoading(button, true);
      const result = await login(email, password);
      setButtonLoading(button, false);

      if (result.success) {
        showToast('Welcome back!', 'success');
        redirectAfterLogin();
      } else {
        showToast(result.error || 'Login failed', 'error');
      }
    });
  }

  const bypassButton = container.querySelector('#localDevBypassButton');
  if (bypassButton) {
    bypassButton.addEventListener('click', () => {
      const enabled = enableLocalDevBypass();
      if (!enabled) {
        showToast('Bypass is available only on localhost.', 'error');
        return;
      }
      showToast('Local bypass enabled. Redirecting...', 'success');
      redirectAfterLogin();
    });
  }

  const signupForm = container.querySelector('#signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFormErrors(container);

      const fullNameInput = container.querySelector('#fullName');
      const emailInput = container.querySelector('#signupEmail');
      const passwordInput = container.querySelector('#signupPassword');
      const confirmPasswordInput = container.querySelector('#confirmPassword');
      const termsInput = container.querySelector('#terms');

      const fullName = fullNameInput?.value || '';
      const email = emailInput?.value || '';
      const password = passwordInput?.value || '';
      const confirmPassword = confirmPasswordInput?.value || '';
      const termsChecked = Boolean(termsInput?.checked);

      // Client-side validation
      let hasError = false;
      if (!fullName || fullName.trim().length < 2) {
        showFieldError(fullNameInput, 'Please enter your full name');
        hasError = true;
      }
      if (!email) {
        showFieldError(emailInput, 'Email is required');
        hasError = true;
      } else if (!isValidEmail(email)) {
        showFieldError(emailInput, 'Please enter a valid email address');
        hasError = true;
      }
      if (!password) {
        showFieldError(passwordInput, 'Password is required');
        hasError = true;
      } else if (password.length < 8) {
        showFieldError(passwordInput, 'Password must be at least 8 characters');
        hasError = true;
      }
      if (password !== confirmPassword) {
        showFieldError(confirmPasswordInput, 'Passwords do not match');
        hasError = true;
      }
      if (!termsChecked) {
        showToast('You must agree to Terms and Privacy Policy.', 'error');
        hasError = true;
      }
      if (hasError) return;

      const button = signupForm.querySelector('button[type="submit"]');
      setButtonLoading(button, true);

      const result = await register({
        fullName,
        email,
        password
      });

      setButtonLoading(button, false);

      if (result.success) {
        showToast('Account created successfully!', 'success');
        redirectAfterLogin();
      } else {
        showToast(result.error || 'Signup failed', 'error');
      }
    });
  }

  const resetForm = container.querySelector('#resetForm');
  if (resetForm) {
    resetForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFormErrors(container);

      const emailInput = container.querySelector('#resetEmail');
      const email = emailInput?.value || '';
      const button = resetForm.querySelector('button[type="submit"]');

      let hasError = false;
      if (!email) {
        showFieldError(emailInput, 'Email is required');
        hasError = true;
      } else if (!isValidEmail(email)) {
        showFieldError(emailInput, 'Please enter a valid email address');
        hasError = true;
      }
      if (hasError) return;

      setButtonLoading(button, true);
      const result = await requestPasswordReset(email);
      setButtonLoading(button, false);

      if (result.success) {
        showToast(result.message || 'Reset instructions sent.', 'success');
      } else {
        showToast(result.error || 'Unable to request password reset.', 'error');
      }

      navigate('/login');
    });
  }

  const newPasswordForm = container.querySelector('#newPasswordForm');
  if (newPasswordForm) {
    newPasswordForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFormErrors(container);

      const passwordInput = container.querySelector('#newPassword');
      const confirmPasswordInput = container.querySelector('#confirmNewPassword');

      const password = passwordInput?.value || '';
      const confirmPassword = confirmPasswordInput?.value || '';

      let hasError = false;
      if (!password) {
        showFieldError(passwordInput, 'Password is required');
        hasError = true;
      } else if (password.length < 8) {
        showFieldError(passwordInput, 'Password must be at least 8 characters');
        hasError = true;
      }
      if (password !== confirmPassword) {
        showFieldError(confirmPasswordInput, 'Passwords do not match');
        hasError = true;
      }
      if (hasError) return;

      const token = params.token || params.t;
      if (!token) {
        showToast('Reset token is missing.', 'error');
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
        showToast(result.error || 'Password reset failed.', 'error');
      }
    });
  }
}

/**
 * Initialize form validation helpers
 */
function initFormValidation(container, mode) {
  // Clear errors on input
  container.querySelectorAll('.form-input').forEach(input => {
    input.addEventListener('input', () => {
      clearFieldError(input);
    });

    // Real-time email validation
    if (input.type === 'email' && input.id !== 'resetEmail') {
      input.addEventListener('blur', () => {
        if (input.value && !isValidEmail(input.value)) {
          showFieldError(input, 'Please enter a valid email address');
        }
      });
    }

    // Real-time password strength for signup
    if (mode === 'signup' && input.id === 'signupPassword') {
      input.addEventListener('blur', () => {
        if (input.value && input.value.length < 8) {
          showFieldError(input, 'Password must be at least 8 characters');
        }
      });
    }

    // Real-time confirm password validation
    if (input.id === 'confirmPassword' || input.id === 'confirmNewPassword') {
      input.addEventListener('blur', () => {
        const passwordField = container.querySelector(
          input.id === 'confirmPassword' ? '#signupPassword' : '#newPassword'
        );
        if (input.value && passwordField && input.value !== passwordField.value) {
          showFieldError(input, 'Passwords do not match');
        }
      });
    }
  });
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Show field-level error
 */
function showFieldError(input, message) {
  if (!input) return;

  // Remove existing error
  clearFieldError(input);

  // Add error class to input
  input.classList.add('is-invalid');

  // Create error message element
  const wrapper = input.closest('.input-wrapper');
  if (wrapper) {
    const error = document.createElement('div');
    error.className = 'field-error';
    error.textContent = message;
    wrapper.style.position = 'relative';
    wrapper.appendChild(error);
  }
}

/**
 * Clear field-level error
 */
function clearFieldError(input) {
  if (!input) return;

  input.classList.remove('is-invalid');

  const wrapper = input.closest('.input-wrapper');
  if (wrapper) {
    const error = wrapper.querySelector('.field-error');
    if (error) error.remove();
  }
}

/**
 * Clear all form errors
 */
function clearFormErrors(container) {
  container.querySelectorAll('.form-input').forEach(input => {
    clearFieldError(input);
  });
}

function setButtonLoading(button, isLoading) {
  if (!button) return;
  const text = button.querySelector('.btn-text');
  const spinner = button.querySelector('.fa-spinner');

  if (isLoading) {
    if (text) text.style.display = 'none';
    if (spinner) spinner.style.display = 'inline-block';
    button.disabled = true;
  } else {
    if (text) text.style.display = 'inline';
    if (spinner) spinner.style.display = 'none';
    button.disabled = false;
  }
}

export default {
  render,
  name: 'auth'
};
