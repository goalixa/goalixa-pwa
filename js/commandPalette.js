/**
 * Command Palette (Cmd+K)
 * Global search and quick actions for Goalixa PWA
 */

import { eventBus } from './utils.js';

class CommandPalette {
  constructor() {
    this.overlay = document.getElementById('command-palette-overlay');
    this.input = document.getElementById('command-palette-input');
    this.results = document.getElementById('command-palette-results');
    
    if (!this.overlay || !this.input || !this.results) {
      console.warn('[CommandPalette] Required DOM elements not found');
      return;
    }

    this.selectedIndex = 0;
    this.filteredItems = [];
    this.isOpen = false;

    // Listen for toggle event
    eventBus.on('command-palette-toggle', () => this.toggle());
    eventBus.on('command-palette-open', () => this.open());
    eventBus.on('command-palette-close', () => this.close());

    // Command registry
    this.commands = {
      actions: [
        {
          id: 'create-task',
          title: 'Create New Task',
          description: 'Add a new task to your list',
          icon: 'bi-plus-circle',
          keywords: ['create', 'new', 'task', 'add'],
          action: () => this.navigate('/app/tasks?action=create')
        },
        {
          id: 'create-project',
          title: 'Create New Project',
          description: 'Start a new project',
          icon: 'bi-folder-plus',
          keywords: ['create', 'new', 'project', 'add'],
          action: () => this.navigate('/app/projects?action=create')
        },
        {
          id: 'create-goal',
          title: 'Create New Goal',
          description: 'Set a new goal',
          icon: 'bi-trophy',
          keywords: ['create', 'new', 'goal', 'add'],
          action: () => this.navigate('/app/goals?action=create')
        },
        {
          id: 'start-timer',
          title: 'Start Pomodoro Timer',
          description: 'Begin a focused work session',
          icon: 'bi-stopwatch',
          keywords: ['start', 'timer', 'pomodoro', 'focus'],
          action: () => this.navigate('/app/timer')
        },
        {
          id: 'view-reports',
          title: 'View Reports',
          description: 'See your productivity analytics',
          icon: 'bi-graph-up',
          keywords: ['reports', 'analytics', 'stats', 'insights'],
          action: () => this.navigate('/app/reports')
        }
      ],
      navigation: [
        {
          id: 'nav-overview',
          title: 'Go to Overview',
          description: 'Dashboard and quick stats',
          icon: 'bi-house',
          keywords: ['overview', 'dashboard', 'home'],
          action: () => this.navigate('/app')
        },
        {
          id: 'nav-tasks',
          title: 'Go to Tasks',
          description: 'View and manage tasks',
          icon: 'bi-check-square',
          keywords: ['tasks', 'todo', 'list'],
          action: () => this.navigate('/app/tasks')
        },
        {
          id: 'nav-projects',
          title: 'Go to Projects',
          description: 'Browse your projects',
          icon: 'bi-folder',
          keywords: ['projects', 'folders'],
          action: () => this.navigate('/app/projects')
        },
        {
          id: 'nav-goals',
          title: 'Go to Goals',
          description: 'Track your goals',
          icon: 'bi-trophy',
          keywords: ['goals', 'objectives', 'targets'],
          action: () => this.navigate('/app/goals')
        },
        {
          id: 'nav-habits',
          title: 'Go to Habits',
          description: 'Build better habits',
          icon: 'bi-repeat',
          keywords: ['habits', 'routines', 'daily'],
          action: () => this.navigate('/app/habits')
        },
        {
          id: 'nav-planner',
          title: 'Go to Planner',
          description: 'Daily and weekly planning',
          icon: 'bi-calendar-check',
          keywords: ['planner', 'calendar', 'schedule'],
          action: () => this.navigate('/app/planner')
        },
        {
          id: 'nav-timer',
          title: 'Go to Timer',
          description: 'Pomodoro timer',
          icon: 'bi-stopwatch',
          keywords: ['timer', 'pomodoro', 'focus'],
          action: () => this.navigate('/app/timer')
        },
        {
          id: 'nav-sessions',
          title: 'Go to Sessions',
          description: 'Active login sessions',
          icon: 'bi-shield-check',
          keywords: ['sessions', 'security', 'devices'],
          action: () => this.navigate('/app/sessions')
        },
        {
          id: 'nav-account',
          title: 'Go to Account Settings',
          description: 'Manage your account',
          icon: 'bi-gear',
          keywords: ['settings', 'account', 'profile', 'preferences'],
          action: () => this.navigate('/app/account')
        }
      ]
    };

    this.init();
  }

  init() {
    // Keyboard shortcut: Cmd+K / Ctrl+K
    document.addEventListener('keydown', (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifierKey = isMac ? e.metaKey : e.ctrlKey;

      if (modifierKey && e.key === 'k') {
        e.preventDefault();
        this.toggle();
      }

      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Event delegation for result item clicks
    this.results.addEventListener('click', (e) => {
      const item = e.target.closest('.command-palette-item');
      if (item) {
        const commandId = item.dataset.commandId;
        const allCommands = [
          ...this.commands.actions,
          ...this.commands.navigation
        ];
        
        // Find in filtered items first, then in all commands
        const command = this.filteredItems.length > 0
          ? this.filteredItems.find(c => c.id === commandId)
          : allCommands.find(c => c.id === commandId);

        if (command) {
          this.execute(command);
        }
      }
    });

    // Input event
    this.input.addEventListener('input', () => this.handleSearch());

    // Keyboard navigation
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
  }

  open() {
    if (this.isOpen) return;

    this.isOpen = true;
    this.overlay.style.display = 'flex';
    this.overlay.classList.add('is-open');
    this.input.value = '';
    this.renderResults();
    
    // Focus after a short delay to ensure visibility
    setTimeout(() => this.input.focus(), 10);
  }

  close() {
    this.isOpen = false;
    this.overlay.style.display = 'none';
    this.overlay.classList.remove('is-open');
    this.input.value = '';
    this.selectedIndex = 0;
    this.filteredItems = [];
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  handleSearch() {
    const query = this.input.value.trim().toLowerCase();

    if (!query) {
      this.filteredItems = [];
      this.renderResults();
      return;
    }

    // Fuzzy search across all commands
    const allCommands = [
      ...this.commands.actions.map(cmd => ({ ...cmd, type: 'action' })),
      ...this.commands.navigation.map(cmd => ({ ...cmd, type: 'navigation' }))
    ];

    this.filteredItems = allCommands
      .map(cmd => ({
        ...cmd,
        score: this.fuzzyMatch(query, cmd)
      }))
      .filter(cmd => cmd.score > 0)
      .sort((a, b) => b.score - a.score);

    this.selectedIndex = 0;
    this.renderResults();
  }

  fuzzyMatch(query, command) {
    const searchText = `${command.title} ${command.description} ${command.keywords.join(' ')}`.toLowerCase();

    // Exact match gets highest score
    if (searchText.includes(query)) {
      return 100;
    }

    // Check if all query characters appear in order
    let queryIndex = 0;
    for (let i = 0; i < searchText.length && queryIndex < query.length; i++) {
      if (searchText[i] === query[queryIndex]) {
        queryIndex++;
      }
    }

    if (queryIndex === query.length) {
      // All characters found in order
      return 50 + (queryIndex / searchText.length) * 50;
    }

    return 0;
  }

  handleKeydown(e) {
    const totalItems = this.filteredItems.length || 
                      ([...this.commands.actions, ...this.commands.navigation].length);

    if (totalItems === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % totalItems;
        this.renderResults();
        this.scrollToSelected();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = this.selectedIndex === 0
          ? totalItems - 1
          : this.selectedIndex - 1;
        this.renderResults();
        this.scrollToSelected();
        break;

      case 'Enter':
        e.preventDefault();
        const allCommands = [...this.commands.actions, ...this.commands.navigation];
        const command = this.filteredItems.length > 0
          ? this.filteredItems[this.selectedIndex]
          : allCommands[this.selectedIndex];
          
        if (command) {
          this.execute(command);
        }
        break;
    }
  }

  scrollToSelected() {
    const selectedEl = this.results.querySelector('.command-palette-item.selected');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  execute(command) {
    this.close();
    if (command.action) {
      command.action();
    }
  }

  navigate(path) {
    // Remove hash prefix if present and emit navigate event
    const cleanPath = path.startsWith('#') ? path.substring(1) : path;
    eventBus.emit('navigate', cleanPath);
  }

  renderResults() {
    const query = this.input.value.trim();
    let globalIndex = 0;

    if (!query) {
      // Show all commands grouped
      this.results.innerHTML = `
        <div class="command-palette-section">
          <div class="command-palette-section-label">Quick Actions</div>
          ${this.commands.actions.map(cmd => this.renderCommand({ ...cmd, type: 'action' }, globalIndex++)).join('')}
        </div>
        <div class="command-palette-section">
          <div class="command-palette-section-label">Navigation</div>
          ${this.commands.navigation.map(cmd => this.renderCommand({ ...cmd, type: 'navigation' }, globalIndex++)).join('')}
        </div>
      `;
    } else if (this.filteredItems.length > 0) {
      // Show filtered results
      this.results.innerHTML = `
        <div class="command-palette-section">
          <div class="command-palette-section-label">
            ${this.filteredItems.length} result${this.filteredItems.length !== 1 ? 's' : ''}
          </div>
          ${this.filteredItems.map((cmd, index) => this.renderCommand(cmd, index)).join('')}
        </div>
      `;
    } else {
      // No results
      this.results.innerHTML = `
        <div class="command-palette-empty">
          <div class="command-palette-empty-icon">
            <i class="bi bi-search"></i>
          </div>
          <div class="command-palette-empty-title">No results found</div>
          <div class="command-palette-empty-description">Try a different search term</div>
        </div>
      `;
    }
  }

  renderCommand(command, index) {
    const isSelected = index === this.selectedIndex;
    const iconClass = command.type === 'action' ? 'action-icon' : 'nav-icon';

    return `
      <div
        class="command-palette-item ${isSelected ? 'selected' : ''}"
        data-command-id="${command.id}"
      >
        <div class="command-palette-icon ${iconClass}">
          <i class="${command.icon}"></i>
        </div>
        <div class="command-palette-content">
          <div class="command-palette-title">${command.title}</div>
          ${command.description ? `<div class="command-palette-description">${command.description}</div>` : ''}
        </div>
        <div class="command-palette-meta">
          ${command.type === 'action' ? '<kbd class="command-palette-kbd">↵</kbd>' : ''}
        </div>
      </div>
    `;
  }
}

// Initialize command palette when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.commandPalette = new CommandPalette();
  });
} else {
  window.commandPalette = new CommandPalette();
}

export default CommandPalette;
