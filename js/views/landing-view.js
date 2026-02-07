/**
 * Landing View Module
 * Displays the main landing page with navigation and features
 */

import { isAuthenticated } from '../auth.js';
import { navigate } from '../router.js';

// HTML template for landing view
const landingHTML = `
  <div class="landing-view">
    <!-- Navigation -->
    <nav class="navbar">
      <div class="container">
        <div class="nav-brand">
          <i class="fas fa-bullseye"></i>
          <span class="brand-name">GOALIXA</span>
        </div>
        <div class="nav-menu">
          <div class="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#use-cases">Use Cases</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <a href="#contact">Contact</a>
          </div>
          <div class="nav-cta">
            <a href="#/login" class="btn btn-secondary btn-nav">Login</a>
            <a href="#/signup" class="btn btn-primary btn-nav">Sign In</a>
          </div>
        </div>
        <button class="menu-toggle">
          <i class="fas fa-bars"></i>
        </button>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="hero">
      <div class="container">
        <div class="hero-content">
          <h1>Turn Big <span class="highlight">Goals</span> into Clear Plans.</h1>
          <p class="hero-subtitle">Goalixa helps you break outcomes into projects, tasks, and weekly focus so you stay aligned and finish what matters.</p>
          <div class="hero-buttons">
            <a href="#/signup" class="btn btn-primary">
              <i class="fas fa-user-plus"></i> Create Free Account
            </a>
            <a href="#/login" class="btn btn-secondary">
              <i class="fas fa-right-to-bracket"></i> Log In
            </a>
          </div>
          <div class="hero-stats">
            <div class="stat">
              <h3>12K+</h3>
              <p>Goals Planned</p>
            </div>
            <div class="stat">
              <h3>1.4M+</h3>
              <p>Tasks Completed</p>
            </div>
            <div class="stat">
              <h3>350+</h3>
              <p>Teams & Solo Users</p>
            </div>
          </div>
        </div>
        <div class="hero-image">
          <div class="phone-mockup">
            <div class="phone-screen">
              <div class="app-screen">
                <div class="app-header">
                  <h4>Goalixa</h4>
                  <span>Today's Focus</span>
                </div>
                <div class="match-info">
                  <div class="team">
                    <div class="team-logo">Q4</div>
                    <span>Launch MVP</span>
                  </div>
                  <div class="score">
                    <span>68%</span>
                  </div>
                  <div class="team">
                    <div class="team-logo">WK</div>
                    <span>Grow Pipeline</span>
                  </div>
                </div>
                <div class="goal-tracker">
                  <h5>Key Tasks</h5>
                  <div class="goals-list">
                    <div class="goal-item">
                      <span class="player">Define success metrics</span>
                      <span class="assist">Owner: Product</span>
                    </div>
                    <div class="goal-item">
                      <span class="player">Ship onboarding flow</span>
                      <span class="assist">Due: Thu</span>
                    </div>
                    <div class="goal-item">
                      <span class="player">Interview 5 users</span>
                      <span class="assist">Status: Scheduled</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Trust Section -->
    <section class="trust">
      <div class="container">
        <p class="trust-title">Trusted by founders, teams, and focused individuals</p>
        <div class="trust-items">
          <span class="trust-item reveal">Northside Studio</span>
          <span class="trust-item reveal">Atlas Labs</span>
          <span class="trust-item reveal">Riverside Ops</span>
          <span class="trust-item reveal">Coastal Collective</span>
          <span class="trust-item reveal">City Builders</span>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="features">
      <div class="container">
        <div class="section-header">
          <span class="section-kicker">Why Goalixa</span>
          <h2>Powerful Planning Features</h2>
          <p>Everything you need to connect goals, projects, and daily execution in one clean view.</p>
        </div>
        <div class="features-grid">
          <div class="feature-card reveal">
            <div class="feature-icon">
              <i class="fas fa-bullseye"></i>
            </div>
            <h3>Goal Mapping</h3>
            <p>Turn long-term outcomes into measurable milestones with clear owners and timelines.</p>
          </div>
          <div class="feature-card reveal">
            <div class="feature-icon">
              <i class="fas fa-chart-line"></i>
            </div>
            <h3>Progress Analytics</h3>
            <p>Track completion rates, time spent, and momentum across goals and projects.</p>
          </div>
          <div class="feature-card reveal">
            <div class="feature-icon">
              <i class="fas fa-users"></i>
            </div>
            <h3>Project Collaboration</h3>
            <p>Assign tasks, sync priorities, and keep everyone aligned without status meetings.</p>
          </div>
          <div class="feature-card reveal">
            <div class="feature-icon">
              <i class="fas fa-share-alt"></i>
            </div>
            <h3>Share & Export</h3>
            <p>Share goal dashboards and export reports for reviews or stakeholder updates.</p>
          </div>
          <div class="feature-card reveal">
            <div class="feature-icon">
              <i class="fas fa-mobile-alt"></i>
            </div>
            <h3>Cross-Platform</h3>
            <p>Plan on desktop and check tasks on the go with a responsive layout.</p>
          </div>
          <div class="feature-card reveal">
            <div class="feature-icon">
              <i class="fas fa-cloud"></i>
            </div>
            <h3>Cloud Sync</h3>
            <p>Your goals, projects, and tasks stay synced across your devices.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works Section -->
    <section id="how-it-works" class="how-it-works">
      <div class="container">
        <div class="section-header">
          <span class="section-kicker">Simple workflow</span>
          <h2>How Goalixa Works</h2>
          <p>Simple steps to go from intention to execution</p>
        </div>
        <div class="steps">
          <div class="step reveal">
            <div class="step-number">1</div>
            <div class="step-content">
              <h3>Define Goals</h3>
              <p>Capture outcomes and set targets with due dates and priorities.</p>
            </div>
          </div>
          <div class="step reveal">
            <div class="step-number">2</div>
            <div class="step-content">
              <h3>Plan Projects</h3>
              <p>Break goals into projects and key deliverables.</p>
            </div>
          </div>
          <div class="step reveal">
            <div class="step-number">3</div>
            <div class="step-content">
              <h3>Execute Tasks</h3>
              <p>Stay focused with daily tasks and weekly plans.</p>
            </div>
          </div>
          <div class="step reveal">
            <div class="step-number">4</div>
            <div class="step-content">
              <h3>Review Progress</h3>
              <p>Reflect weekly, adjust priorities, and keep momentum.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta">
      <div class="container">
        <h2>Start planning in minutes</h2>
        <p>Join teams who save hours each week with clear priorities and fast execution.</p>
        <div class="cta-actions">
          <a href="#/signup" class="btn btn-primary btn-large">
            <i class="fas fa-bolt"></i> Create Free Account
          </a>
          <a href="#/login" class="btn btn-outline-light btn-large">
            <i class="fas fa-right-to-bracket"></i> Log In
          </a>
        </div>
        <p class="cta-note">No credit card required. Upgrade anytime.</p>
      </div>
    </section>

    <!-- Footer -->
    <footer id="contact">
      <div class="container">
        <div class="footer-content">
          <div class="footer-brand">
            <div class="nav-brand">
              <i class="fas fa-bullseye"></i>
              <span class="brand-name">GOALIXA</span>
            </div>
            <p>Plan. Execute. Improve. Your goals, projects, and tasks in one place.</p>
            <div class="social-links">
              <a href="https://github.com/AmirrezaRezaie/Goalixa" target="_blank" rel="noopener noreferrer"><i class="fab fa-github"></i></a>
              <a href="#"><i class="fab fa-twitter"></i></a>
              <a href="#"><i class="fab fa-instagram"></i></a>
            </div>
          </div>
          <div class="footer-links">
            <h4>Project</h4>
            <a href="https://github.com/AmirrezaRezaie/Goalixa" target="_blank" rel="noopener noreferrer">GitHub Repository</a>
            <a href="#">Documentation</a>
            <a href="#">Releases</a>
          </div>
          <div class="footer-links">
            <h4>Support</h4>
            <a href="#">Help Center</a>
            <a href="#">Contact Us</a>
            <a href="#">FAQ</a>
          </div>
          <div class="footer-links">
            <h4>Legal</h4>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Cookie Policy</a>
          </div>
        </div>
        <div class="footer-bottom">
          <p>&copy; 2025 Goalixa. Created by Amirreza Rezaie. All rights reserved.</p>
        </div>
      </div>
    </footer>
  </div>
`;

/**
 * Render landing view
 */
export async function render(container, path, params) {
  // Check if already authenticated
  if (isAuthenticated()) {
    navigate('/app');
    return;
  }

  // Render HTML
  container.innerHTML = landingHTML;

  // Initialize interactions
  initLandingView(container);
}

/**
 * Initialize landing view interactions
 */
function initLandingView(container) {
  // Mobile menu toggle
  const menuToggle = container.querySelector('.menu-toggle');
  const navMenu = container.querySelector('.nav-menu');

  if (menuToggle) {
    menuToggle.addEventListener('click', function () {
      navMenu.classList.toggle('active');
      const icon = this.querySelector('i');
      if (navMenu.classList.contains('active')) {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-times');
      } else {
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
      }
    });
  }

  // Close menu when clicking outside
  document.addEventListener('click', function (event) {
    if (!event.target.closest('.navbar .container')) {
      navMenu?.classList.remove('active');
      const icon = menuToggle?.querySelector('i');
      if (icon) {
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
      }
    }
  });

  // Smooth scrolling for anchor links
  container.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href.startsWith('#/')) return; // Skip router links
      if (href === '#') return;

      e.preventDefault();
      const targetElement = container.querySelector(href);
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 80,
          behavior: 'smooth'
        });
      }
    });
  });

  // Animate elements on scroll
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate');
      }
    });
  }, observerOptions);

  container.querySelectorAll('.reveal').forEach(el => {
    observer.observe(el);
  });

  // Add scroll effect to navbar
  window.addEventListener('scroll', function () {
    const navbar = container.querySelector('.navbar');
    if (window.scrollY > 50) {
      navbar.style.boxShadow = '0 5px 20px rgba(0, 0, 0, 0.1)';
      navbar.style.backgroundColor = 'rgba(255, 255, 255, 0.98)';
    } else {
      navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.05)';
      navbar.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    }
  });
}

// Export as default for module imports
export default {
  render,
  name: 'landing'
};
