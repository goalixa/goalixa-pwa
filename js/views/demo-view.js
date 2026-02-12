/**
 * Demo View - Interactive product tour without authentication
 */

export async function render(container) {
  container.innerHTML = `
    <div class="demo-view">
      <!-- Demo Header -->
      <header class="demo-header">
        <div class="logo">Goalixa</div>
        <nav class="demo-nav">
          <a href="/" class="nav-link">Back to Home</a>
          <a href="/signup" class="btn btn-primary">Get Started Free</a>
        </nav>
      </header>

      <!-- Demo Slides Container -->
      <div class="demo-container">
        <div class="demo-slides" id="demoSlides">
          <!-- Slide 1: Welcome -->
          <div class="demo-slide active" data-slide="0">
            <div class="slide-content">
              <h1>Welcome to Goalixa</h1>
              <p class="slide-description">
                Your all-in-one platform for goals, habits, projects, and tasks.
                Let's take a quick tour!
              </p>
              <div class="slide-image">
                <div class="mockup dashboard-mockup">
                  <div class="mockup-header">
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                  </div>
                  <div class="mockup-body">
                    <div class="sidebar">Goals<br>Habits<br>Projects<br>Tasks</div>
                    <div class="main-content">
                      <div class="card">Today's Progress</div>
                      <div class="card">Active Projects</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Slide 2: Goals -->
          <div class="demo-slide" data-slide="1">
            <div class="slide-content">
              <h1>Set & Track Goals</h1>
              <p class="slide-description">
                Define your long-term objectives and break them down into actionable plans.
                Track progress with visual indicators.
              </p>
              <div class="slide-image">
                <div class="mockup goals-mockup">
                  <div class="goal-item">
                    <div class="goal-progress" style="width: 75%"></div>
                    <span>Learn a Language - 75%</span>
                  </div>
                  <div class="goal-item">
                    <div class="goal-progress" style="width: 40%"></div>
                    <span>Get in Shape - 40%</span>
                  </div>
                  <div class="goal-item">
                    <div class="goal-progress" style="width: 90%"></div>
                    <span>Launch Startup - 90%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Slide 3: Habits -->
          <div class="demo-slide" data-slide="2">
            <div class="slide-content">
              <h1>Build Better Habits</h1>
              <p class="slide-description">
                Create daily routines that stick. Track your streaks and celebrate consistency.
              </p>
              <div class="slide-image">
                <div class="mockup habits-mockup">
                  <div class="habit-item">
                    <span class="habit-name">Morning Meditation</span>
                    <span class="habit-streak">🔥 14 days</span>
                  </div>
                  <div class="habit-item">
                    <span class="habit-name">Read 30 min</span>
                    <span class="habit-streak">🔥 7 days</span>
                  </div>
                  <div class="habit-item">
                    <span class="habit-name">Exercise</span>
                    <span class="habit-streak">🔥 21 days</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Slide 4: Timer -->
          <div class="demo-slide" data-slide="3">
            <div class="slide-content">
              <h1>Focus with Timer</h1>
              <p class="slide-description">
                Use the Pomodoro technique or custom timers to stay focused and productive.
                Track your focused time across all activities.
              </p>
              <div class="slide-image">
                <div class="mockup timer-mockup">
                  <div class="timer-display">25:00</div>
                  <div class="timer-controls">
                    <button class="btn-timer">▶ Start</button>
                  </div>
                  <div class="timer-stats">
                    <span>🎯 4 sessions completed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Slide 5: Projects & Tasks -->
          <div class="demo-slide" data-slide="4">
            <div class="slide-content">
              <h1>Manage Projects & Tasks</h1>
              <p class="slide-description">
                Organize your work into projects, break them into tasks,
                and track everything in one place.
              </p>
              <div class="slide-image">
                <div class="mockup projects-mockup">
                  <div class="project-card">
                    <h4>Website Redesign</h4>
                    <div class="task-list">
                      <label class="task-item"><input type="checkbox" checked> Design mockups</label>
                      <label class="task-item"><input type="checkbox" checked> Create prototype</label>
                      <label class="task-item"><input type="checkbox"> Frontend development</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Slide 6: Reports -->
          <div class="demo-slide" data-slide="5">
            <div class="slide-content">
              <h1>Track Your Progress</h1>
              <p class="slide-description">
                Get insights into your productivity with detailed reports and analytics.
                See how you improve over time.
              </p>
              <div class="slide-image">
                <div class="mockup reports-mockup">
                  <div class="chart-bars">
                    <div class="bar" style="height: 60%"></div>
                    <div class="bar" style="height: 80%"></div>
                    <div class="bar" style="height: 45%"></div>
                    <div class="bar" style="height: 90%"></div>
                    <div class="bar" style="height: 70%"></div>
                    <div class="bar" style="height: 85%"></div>
                    <div class="bar" style="height: 95%"></div>
                  </div>
                  <div class="chart-label">Weekly Productivity</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Navigation -->
        <div class="demo-navigation">
          <button class="nav-btn prev-btn" id="prevBtn" disabled>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15,18 9,12 15,6"></polyline>
            </svg>
            Previous
          </button>

          <div class="slide-indicators">
            <span class="indicator active" data-slide="0"></span>
            <span class="indicator" data-slide="1"></span>
            <span class="indicator" data-slide="2"></span>
            <span class="indicator" data-slide="3"></span>
            <span class="indicator" data-slide="4"></span>
            <span class="indicator" data-slide="5"></span>
          </div>

          <button class="nav-btn next-btn" id="nextBtn">
            Next
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9,18 15,12 9,6"></polyline>
            </svg>
          </button>
        </div>

        <!-- Progress Bar -->
        <div class="demo-progress">
          <div class="progress-bar" id="progressBar" style="width: 16.66%"></div>
        </div>
      </div>

      <!-- CTA Footer -->
      <footer class="demo-footer">
        <p>Ready to boost your productivity?</p>
        <a href="/signup" class="btn btn-primary btn-large">Start Your Free Trial</a>
      </footer>
    </div>
  `;

  // Initialize demo interactivity
  initDemo();
}

function initDemo() {
  let currentSlide = 0;
  const totalSlides = 6;

  const slides = document.querySelectorAll('.demo-slide');
  const indicators = document.querySelectorAll('.indicator');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const progressBar = document.getElementById('progressBar');

  function goToSlide(index) {
    // Update current slide
    currentSlide = index;

    // Update slides
    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === index);
    });

    // Update indicators
    indicators.forEach((indicator, i) => {
      indicator.classList.toggle('active', i === index);
    });

    // Update progress bar
    const progress = ((index + 1) / totalSlides) * 100;
    progressBar.style.width = `${progress}%`;

    // Update buttons
    prevBtn.disabled = index === 0;
    nextBtn.innerHTML = index === totalSlides - 1
      ? 'Get Started <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"></polyline></svg>'
      : 'Next <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"></polyline></svg>';
  }

  prevBtn.addEventListener('click', () => {
    if (currentSlide > 0) {
      goToSlide(currentSlide - 1);
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentSlide < totalSlides - 1) {
      goToSlide(currentSlide + 1);
    } else {
      // On last slide, navigate to signup
      window.location.href = '/signup';
    }
  });

  indicators.forEach((indicator) => {
    indicator.addEventListener('click', () => {
      const slideIndex = parseInt(indicator.dataset.slide);
      goToSlide(slideIndex);
    });
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' && currentSlide > 0) {
      goToSlide(currentSlide - 1);
    } else if (e.key === 'ArrowRight' && currentSlide < totalSlides - 1) {
      goToSlide(currentSlide + 1);
    }
  });
}

export default { render };
