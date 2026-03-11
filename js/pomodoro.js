/**
 * Reusable Pomodoro controller for Goalixa.
 * Works with both the full timer page and compact overview widget.
 *
 * Expected markup (scoped inside `root`):
 *  - [data-pomodoro-display] (or #pomodoro-display)
 *  - [data-pomodoro-mode]
 *  - [data-pomodoro-task]
 *  - [data-pomodoro-meta]
 *  - [data-pomodoro-ring]
 *  - [data-session-dot]
 *  - [data-pomodoro-toggle]        Start/Pause
 *  - [data-pomodoro-reset]         Reset to work 25
 *  - [data-pomodoro-skip]          Skip to next mode
 *  - [data-pomodoro-done]          Mark task(s) done today
 *  - [data-pomodoro-mode="work|short|long"] preset buttons
 *  - (optional) task picker input/select  [data-pomodoro-task-picker]
 *  - (optional) task clear button        [data-pomodoro-task-clear]
 *  - (optional) task list + dropdown     [data-pomodoro-task-list], [data-pomodoro-task-dropdown]
 *  - (optional) bulk controls            [data-pomodoro-bulk-*]
 *  - (optional) quick add form           [data-pomodoro-quick-form] (+ name/project/priority/label fields)
 *
 * Options:
 *  - appApi (required): API client with start/stop/bulkTaskAction/setTaskDailyCheck/getTasks/createTask
 *  - showToast (required): notifier fn(message, type)
 *  - signal (optional): AbortSignal to auto-clean listeners
 *  - mode: 'full' | 'compact' (default 'full')
 *  - initialTasks: array of tasks to seed picker before fetch
 *  - getTasks: async fn to fetch tasks payload (falls back to initialTasks)
 */

export function createPomodoroController(options = {}) {
  const {
    root,
    appApi,
    showToast,
    signal,
    mode = 'full',
    initialTasks = [],
    getTasks
  } = options;

  if (!root || !appApi || !showToast) {
    return () => {};
  }

  const presets = {
    work: 25 * 60,
    short: 5 * 60,
    long: 15 * 60
  };

  const storageKey = 'pomodoroState';
  const abortController = signal ? null : new AbortController();
  const localSignal = signal || abortController.signal;
  const baseTitle = document.title;
  let intervalId = null;

  const ui = selectElements(root);

  const defaultState = {
    mode: 'work',
    remaining: presets.work,
    isRunning: false,
    completedWork: 0,
    lastTick: null,
    taskId: null,
    taskIds: [],
    taskNames: [],
    taskName: null,
    taskRunning: false
  };

  const modeLabel = (value) => {
    if (value === 'short') return 'Short Break';
    if (value === 'long') return 'Long Break';
    return 'Focus';
  };

  const formatPomodoroClock = (seconds) => {
    const safe = Math.max(0, Math.floor(Number(seconds || 0)));
    const minutes = Math.floor(safe / 60);
    const remaining = safe % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
  };

  const normalizeTaskIdValue = (value) => {
    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return '';
    return String(parsed);
  };

  const loadState = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return { ...defaultState };
      return { ...defaultState, ...JSON.parse(raw) };
    } catch (_err) {
      return { ...defaultState };
    }
  };

  const saveState = (state) => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  };

  const normalizeStateTaskIds = (state) => {
    const ids = Array.isArray(state.taskIds)
      ? state.taskIds
      : state.taskId
        ? [state.taskId]
        : [];
    const normalized = [];
    const seen = new Set();
    ids.forEach((id) => {
      const parsed = Number.parseInt(String(id), 10);
      if (!Number.isFinite(parsed) || parsed <= 0 || seen.has(parsed)) return;
      seen.add(parsed);
      normalized.push(parsed);
    });
    state.taskIds = normalized;
    state.taskId = normalized.length ? normalized[0] : null;
    if (!Array.isArray(state.taskNames)) {
      state.taskNames = [];
    }
  };

  const setStateTasks = (state, tasks) => {
    const safeTasks = (tasks || []).filter((task) => task && task.id);
    state.taskIds = safeTasks.map((task) => Number(task.id));
    state.taskNames = safeTasks.map((task) => task.name || `Task #${task.id}`);
    state.taskId = state.taskIds.length ? state.taskIds[0] : null;
    state.taskName = state.taskNames.length ? state.taskNames[0] : null;
  };

  const updatePageTitle = (state) => {
    if (!state.isRunning || mode === 'compact') {
      document.title = baseTitle;
      return;
    }
    normalizeStateTaskIds(state);
    const time = formatPomodoroClock(state.remaining);
    const m = modeLabel(state.mode);
    const taskLabel = state.taskIds.length > 1
      ? ` - ${state.taskIds.length} tasks`
      : state.taskName
        ? ` - ${state.taskName}`
        : '';
    document.title = `${time} · ${m}${taskLabel}`;
  };

  const updateDots = (state) => {
    if (!ui.dots.length) return;
    const completed = state.completedWork % 4;
    ui.dots.forEach((dot, index) => {
      dot.classList.toggle('is-active', index < completed);
      dot.classList.toggle('is-current', index === completed);
    });
  };

  const updateRing = (state) => {
    if (!ui.ring) return;
    const total = presets[state.mode] || 0;
    const progressValue = total > 0 ? Math.min(1, Math.max(0, state.remaining / total)) : 0;
    ui.ring.style.setProperty('--pomodoro-progress', `${progressValue * 360}deg`);
  };

  const updatePomodoroUI = (state) => {
    normalizeStateTaskIds(state);
    if (ui.display) ui.display.textContent = formatPomodoroClock(state.remaining);
    if (ui.modeText) ui.modeText.textContent = modeLabel(state.mode);
    if (ui.meta) ui.meta.textContent = `Session ${(state.completedWork % 4) + 1} of 4`;

    if (ui.taskText) {
      if (!state.taskIds.length) {
        ui.taskText.textContent = 'No task selected';
      } else if (state.taskIds.length === 1) {
        ui.taskText.textContent = state.taskName ? `Task: ${state.taskName}` : 'Task selected';
      } else {
        const preview = (state.taskNames || []).slice(0, 2).join(', ');
        const extra = state.taskNames.length > 2 ? ` +${state.taskNames.length - 2}` : '';
        ui.taskText.textContent = preview
          ? `Working on: ${preview}${extra}`
          : `Working on ${state.taskIds.length} tasks`;
      }
    }

    updateDots(state);
    updateRing(state);

    const requiresTask = state.mode === 'work' && !state.taskIds.length;
    if (ui.toggleBtn) {
      ui.toggleBtn.disabled = requiresTask;
      if (state.isRunning) {
        if (ui.toggleIcon) ui.toggleIcon.className = 'bi bi-pause-fill';
        if (ui.toggleText) ui.toggleText.textContent = 'Pause';
        ui.toggleBtn.classList.remove('btn-primary');
        ui.toggleBtn.classList.add('btn-outline-warning');
      } else {
        if (ui.toggleIcon) ui.toggleIcon.className = 'bi bi-play-fill';
        if (ui.toggleText) ui.toggleText.textContent = requiresTask ? 'Select task' : 'Start';
        ui.toggleBtn.classList.add('btn-primary');
        ui.toggleBtn.classList.remove('btn-outline-warning');
      }
    }

    if (ui.doneBtn) ui.doneBtn.disabled = !state.taskIds.length;
    if (ui.taskClear) ui.taskClear.disabled = !state.taskIds.length;
    updatePageTitle(state);
  };

  const getNextMode = (state) => {
    if (state.mode === 'work') {
      const nextWork = state.completedWork + 1;
      return nextWork % 4 === 0 ? 'long' : 'short';
    }
    return 'work';
  };

  const applyMode = (state, nextMode) => {
    const duration = presets[nextMode];
    return {
      ...state,
      mode: nextMode,
      remaining: duration,
      isRunning: false,
      lastTick: null,
      taskRunning: false
    };
  };

  let audioContext = null;
  const ensureAudioContext = () => {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioContext = new AudioCtx();
    }
    return audioContext;
  };

  const playChime = () => {
    const context = ensureAudioContext();
    if (!context) return;
    const now = context.currentTime;
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now + index * 0.18);
      gain.gain.linearRampToValueAtTime(0.2, now + index * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.18 + 0.16);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + index * 0.18);
      oscillator.stop(now + index * 0.18 + 0.2);
    });
  };

  const notifyPomodoro = (completedMode) => {
    if (completedMode === 'work') {
      showToast('Focus complete. Time for a break.', 'success');
    } else {
      showToast('Break complete. Time to focus.', 'info');
    }
    playChime();
  };

  const stopInterval = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const applyElapsed = (state, elapsedSeconds) => {
    const startingRemaining = state.remaining;
    let remaining = state.remaining;
    let pomodoroMode = state.mode;
    let completedWork = state.completedWork;
    let secondsLeft = elapsedSeconds;

    while (secondsLeft > 0) {
      if (remaining > secondsLeft) {
        remaining -= secondsLeft;
        secondsLeft = 0;
      } else {
        secondsLeft -= remaining;
        if (pomodoroMode === 'work') {
          completedWork += 1;
        }
        notifyPomodoro(pomodoroMode);
        pomodoroMode = pomodoroMode === 'work'
          ? (completedWork % 4 === 0 ? 'long' : 'short')
          : 'work';
        remaining = presets[pomodoroMode];
      }
    }

    state.remaining = remaining;
    state.mode = pomodoroMode;
    state.completedWork = completedWork;
    if (elapsedSeconds >= startingRemaining) {
      state.isRunning = false;
      state.lastTick = null;
      state.taskRunning = false;
    }
  };

  const startTaskTimer = async (state) => {
    normalizeStateTaskIds(state);
    if (!state.taskIds.length || state.taskRunning) return;
    state.taskRunning = true;
    saveState(state);
    try {
      await appApi.bulkTaskAction(state.taskIds, 'start');
    } catch (error) {
      state.taskRunning = false;
      saveState(state);
      console.error(error);
    }
  };

  const stopTaskTimer = async (state) => {
    normalizeStateTaskIds(state);
    if (!state.taskIds.length || !state.taskRunning) return;
    state.taskRunning = false;
    saveState(state);
    try {
      await appApi.bulkTaskAction(state.taskIds, 'stop');
    } catch (error) {
      console.error(error);
    }
  };

  const startInterval = (state) => {
    stopInterval();
    state.lastTick = Date.now();
    intervalId = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.max(1, Math.floor((now - (state.lastTick || now)) / 1000));
      state.lastTick = now;
      state.remaining -= elapsed;

      if (state.remaining <= 0) {
        if (state.mode === 'work') {
          stopTaskTimer(state);
        }
        notifyPomodoro(state.mode);
        state.remaining = 0;
        state.isRunning = false;
        if (state.mode === 'work') {
          state.completedWork += 1;
        }
        const nextMode = getNextMode(state);
        const nextState = applyMode(state, nextMode);
        state.mode = nextState.mode;
        state.remaining = nextState.remaining;
        state.lastTick = null;
        stopInterval();

        if (nextMode !== 'work') {
          state.isRunning = true;
          state.lastTick = Date.now();
          startInterval(state);
        }
      }

      saveState(state);
      updatePomodoroUI(state);
    }, 1000);
  };

  const mergeTaskPayload = (payload) => {
    const merged = Array.isArray(payload)
      ? payload
      : [
        ...((payload && payload.tasks) || []),
        ...((payload && payload.done_today_tasks) || []),
        ...((payload && payload.completed_tasks) || [])
      ];
    const byId = new Map();
    merged.forEach((task) => {
      const taskId = normalizeTaskIdValue(task.id);
      if (taskId) byId.set(taskId, task);
    });
    return Array.from(byId.values()).sort((a, b) => (b.total_seconds || 0) - (a.total_seconds || 0));
  };

  const filterTasks = (tasks, query) => {
    const term = String(query || '').toLowerCase().trim();
    return tasks.filter((task) => {
      if ((task.status || 'active') === 'completed') return false;
      const name = String(task.name || '').toLowerCase();
      const project = String(task.project_name || '').toLowerCase();
      return !term || name.includes(term) || project.includes(term);
    });
  };

  let cachedTasks = mergeTaskPayload(initialTasks);
  let selectedTaskIds = new Set();

  const syncSelectedTaskIds = (tasks) => {
    const availableIds = new Set(
      (tasks || [])
        .filter((task) => (task.status || 'active') !== 'completed')
        .map((task) => normalizeTaskIdValue(task.id))
        .filter(Boolean)
    );
    selectedTaskIds = new Set(Array.from(selectedTaskIds).filter((id) => availableIds.has(id)));
  };

  const updateBulkControls = (visibleTasks = []) => {
    if (ui.bulkCount) ui.bulkCount.textContent = `${selectedTaskIds.size} selected`;
    if (ui.bulkApply) ui.bulkApply.disabled = selectedTaskIds.size === 0;
    if (ui.bulkClear) ui.bulkClear.disabled = selectedTaskIds.size === 0;
    if (visibleTasks.length === 0 && ui.taskList) {
      ui.taskList.innerHTML = '<div class="timer-empty-state">No tasks found.</div>';
    }
  };

  const renderTasks = (tasks, query) => {
    if (!ui.taskList) return;
    syncSelectedTaskIds(tasks);
    const filtered = filterTasks(tasks, query);
    if (!filtered.length) {
      ui.taskList.innerHTML = '<div class="timer-empty-state">No tasks found.</div>';
      updateBulkControls(filtered);
      return;
    }

    ui.taskList.innerHTML = filtered.map((task) => {
      const taskId = normalizeTaskIdValue(task.id);
      const isSelected = selectedTaskIds.has(taskId);
      const isCompleted = (task.status || 'active') === 'completed';
      const project = task.project_name ? ` • ${escapeHtml(task.project_name)}` : '';
      return `
        <div class="timer-task-option${isSelected ? ' is-selected' : ''}">
          <label class="timer-task-check-wrap" aria-label="Select ${escapeHtml(task.name || '')}">
            <input class="timer-task-check" type="checkbox" data-task-check-id="${taskId}" ${isSelected ? 'checked' : ''} ${isCompleted ? 'disabled' : ''} />
          </label>
          <button type="button" class="timer-task-pick${isCompleted ? ' is-completed' : ''}" data-task-id="${taskId}" ${isCompleted ? 'disabled' : ''}>
            <span>${escapeHtml(task.name || '')}${project}</span>
            <span class="timer-task-meta">${isCompleted ? 'Completed' : 'Active'} · ${formatPomodoroClock(task.total_seconds || 0)}</span>
          </button>
        </div>
      `;
    }).join('');

    updateBulkControls(filtered);
  };

  const closeDropdown = () => {
    ui.taskDropdown?.classList.remove('is-open');
    ui.taskPicker?.setAttribute('aria-expanded', 'false');
  };

  const state = loadState();
  normalizeStateTaskIds(state);
  if (!state.taskNames.length && state.taskName) {
    state.taskNames = [state.taskName];
  }
  state.taskName = state.taskName || null;

  if (state.isRunning && state.lastTick) {
    const elapsed = Math.floor((Date.now() - state.lastTick) / 1000);
    if (elapsed > 0) {
      applyElapsed(state, elapsed);
    }
  }

  const startPomodoro = () => {
    normalizeStateTaskIds(state);
    if (state.mode === 'work' && !state.taskIds.length) {
      showToast('Select a task for this Pomodoro.', 'warning');
      return;
    }
    state.isRunning = true;
    state.lastTick = Date.now();
    if (state.mode === 'work') {
      startTaskTimer(state);
    }
    saveState(state);
    updatePomodoroUI(state);
    startInterval(state);
  };

  const pausePomodoro = () => {
    state.isRunning = false;
    state.lastTick = null;
    stopTaskTimer(state);
    saveState(state);
    updatePomodoroUI(state);
    stopInterval();
  };

  if (state.isRunning) {
    startInterval(state);
  }
  updatePomodoroUI(state);

  ui.toggleBtn?.addEventListener('click', () => {
    if (state.isRunning) {
      pausePomodoro();
    } else {
      startPomodoro();
    }
  }, { signal: localSignal });

  ui.resetBtn?.addEventListener('click', () => {
    state.mode = 'work';
    state.remaining = presets.work;
    state.isRunning = false;
    state.completedWork = 0;
    state.lastTick = null;
    stopTaskTimer(state);
    saveState(state);
    updatePomodoroUI(state);
    stopInterval();
  }, { signal: localSignal });

  ui.skipBtn?.addEventListener('click', () => {
    if (state.mode === 'work') {
      state.completedWork += 1;
    }
    stopTaskTimer(state);
    const nextMode = getNextMode(state);
    const nextState = applyMode(state, nextMode);
    state.mode = nextState.mode;
    state.remaining = nextState.remaining;
    state.isRunning = false;
    state.lastTick = null;
    saveState(state);
    updatePomodoroUI(state);
    stopInterval();
  }, { signal: localSignal });

  ui.doneBtn?.addEventListener('click', async () => {
    normalizeStateTaskIds(state);
    if (!state.taskIds.length) {
      showToast('Select a task to mark it done today.', 'warning');
      return;
    }
    try {
      if (state.taskIds.length === 1) {
        await appApi.setTaskDailyCheck(state.taskIds[0]);
      } else {
        await appApi.bulkTaskAction(state.taskIds, 'daily-check');
      }
      showToast(`${state.taskIds.length} task(s) checked off for today.`, 'success');
    } catch (error) {
      showToast(error.message || 'Failed to mark task done', 'error');
    }
  }, { signal: localSignal });

  ui.presets.forEach((button) => {
    button.addEventListener('click', () => {
      const modeValue = button.dataset.pomodoroMode;
      if (!modeValue || !presets[modeValue]) return;
      stopTaskTimer(state);
      state.mode = modeValue;
      state.remaining = presets[modeValue];
      state.isRunning = false;
      state.lastTick = null;
      saveState(state);
      updatePomodoroUI(state);
      stopInterval();
    }, { signal: localSignal });
  });

  ui.taskClear?.addEventListener('click', () => {
    if (state.isRunning && state.mode === 'work') {
      pausePomodoro();
    }
    state.taskId = null;
    state.taskName = null;
    state.taskIds = [];
    state.taskNames = [];
    if (ui.taskPicker) {
      if (ui.taskPicker.tagName === 'SELECT') ui.taskPicker.value = '';
      else ui.taskPicker.value = '';
    }
    if (cachedTasks.length) renderTasks(cachedTasks, '');
    saveState(state);
    updatePomodoroUI(state);
  }, { signal: localSignal });

  const selectTask = (selectedTask) => {
    if (!selectedTask) return;
    normalizeStateTaskIds(state);
    if (state.isRunning) {
      pausePomodoro();
    }
    setStateTasks(state, [selectedTask]);
    state.taskRunning = Boolean(selectedTask.is_running);
    if (ui.taskPicker) {
      if (ui.taskPicker.tagName === 'SELECT') {
        ui.taskPicker.value = String(selectedTask.id);
      } else {
        ui.taskPicker.value = selectedTask.name || '';
      }
    }
    if (state.mode !== 'work' || state.remaining !== presets.work) {
      state.mode = 'work';
      state.remaining = presets.work;
      state.isRunning = false;
      state.lastTick = null;
    }
    if (cachedTasks.length) renderTasks(cachedTasks, '');
    closeDropdown();
    saveState(state);
    updatePomodoroUI(state);
  };

  const applyBulkAction = async () => {
    const taskIds = Array.from(selectedTaskIds);
    if (!taskIds.length) return;
    if (ui.bulkApply) ui.bulkApply.disabled = true;
    try {
      const payload = await appApi.bulkTaskAction(taskIds, 'start');
      cachedTasks = mergeTaskPayload(payload);
      selectedTaskIds.clear();
      const selectedTasks = taskIds
        .map((taskId) => cachedTasks.find((task) => String(task.id) === String(taskId)))
        .filter(Boolean);
      if (selectedTasks.length) {
        setStateTasks(state, selectedTasks);
        state.taskRunning = true;
        if (ui.taskPicker) {
          if (ui.taskPicker.tagName === 'SELECT') {
            ui.taskPicker.value = selectedTasks.length === 1 ? String(selectedTasks[0].id) : '';
          } else {
            ui.taskPicker.value = selectedTasks.length === 1 ? (selectedTasks[0].name || '') : '';
          }
        }
      }
      saveState(state);
      updatePomodoroUI(state);
      renderTasks(cachedTasks, ui.taskPicker ? ui.taskPicker.value : '');
      showToast(`Started ${taskIds.length} task timer(s).`, 'success');
    } catch (error) {
      showToast(error.message || 'Failed to apply bulk timer action', 'error');
    } finally {
      updateBulkControls(filterTasks(cachedTasks, ui.taskPicker ? ui.taskPicker.value : ''));
    }
  };

  const setQuickTaskFeedback = (message, stateName = '') => {
    if (!ui.quickFeedback) return;
    ui.quickFeedback.textContent = message || '';
    ui.quickFeedback.hidden = !message;
    ui.quickFeedback.classList.toggle('is-success', stateName === 'success');
    ui.quickFeedback.classList.toggle('is-error', stateName === 'error');
  };

  const hydrateFromTasks = (tasksPayload) => {
    cachedTasks = mergeTaskPayload(tasksPayload);
    const runningTask = cachedTasks.find(
      (task) => task.is_running && (task.status || 'active') !== 'completed'
    );
    if (runningTask && !state.taskIds.length && !state.taskId) {
      setStateTasks(state, [runningTask]);
      state.mode = 'work';
      state.isRunning = true;
      state.lastTick = Date.now();
      state.taskRunning = true;
      updatePomodoroUI(state);
      startInterval(state);
    }

    if (state.taskIds.length || state.taskId) {
      const preferredIds = state.taskIds.length ? state.taskIds : [state.taskId];
      const selectedTasks = preferredIds
        .map((taskId) => cachedTasks.find((task) => String(task.id) === String(taskId)))
        .filter(Boolean);
      if (selectedTasks.length) {
        setStateTasks(state, selectedTasks);
        state.taskRunning = selectedTasks.some((task) => task.is_running);
        if (ui.taskPicker) {
          if (ui.taskPicker.tagName === 'SELECT') {
            ui.taskPicker.value = selectedTasks.length === 1 ? String(selectedTasks[0].id) : '';
          } else {
            ui.taskPicker.value = selectedTasks.length === 1 ? (selectedTasks[0].name || '') : '';
          }
        }
        updatePomodoroUI(state);
      } else {
        state.isRunning = false;
        state.lastTick = null;
        state.taskId = null;
        state.taskName = null;
        state.taskIds = [];
        state.taskNames = [];
        state.taskRunning = false;
        stopInterval();
        if (ui.taskPicker) {
          if (ui.taskPicker.tagName === 'SELECT') ui.taskPicker.value = '';
          else ui.taskPicker.value = '';
        }
        saveState(state);
        updatePomodoroUI(state);
      }
    }
    renderTasks(cachedTasks, ui.taskPicker ? ui.taskPicker.value : '');
  };

  // Attach picker events
  if (ui.taskPicker) {
    if (ui.taskPicker.tagName === 'SELECT') {
      ui.taskPicker.addEventListener('change', () => {
        const taskId = normalizeTaskIdValue(ui.taskPicker.value);
        const selected = cachedTasks.find((task) => String(task.id) === taskId);
        if (taskId && selected) {
          selectTask(selected);
        } else {
          state.taskId = null;
          state.taskIds = [];
          state.taskNames = [];
          state.taskName = null;
          saveState(state);
          updatePomodoroUI(state);
        }
      }, { signal: localSignal });
    } else {
      ui.taskPicker.addEventListener('focus', () => {
        ui.taskDropdown?.classList.add('is-open');
        ui.taskPicker?.setAttribute('aria-expanded', 'true');
      }, { signal: localSignal });
      ui.taskPicker.addEventListener('click', () => {
        ui.taskDropdown?.classList.add('is-open');
        ui.taskPicker?.setAttribute('aria-expanded', 'true');
      }, { signal: localSignal });
      ui.taskPicker.addEventListener('input', () => {
        ui.taskDropdown?.classList.add('is-open');
        renderTasks(cachedTasks, ui.taskPicker.value);
      }, { signal: localSignal });
      ui.taskPicker.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          ui.taskDropdown?.classList.add('is-open');
          const firstButton = ui.taskList?.querySelector('.timer-task-pick:not([disabled])');
          if (firstButton) firstButton.focus();
        }
        if (event.key === 'Enter') {
          const candidates = filterTasks(cachedTasks, ui.taskPicker.value).filter(
            (task) => (task.status || 'active') !== 'completed'
          );
          if (candidates.length) {
            event.preventDefault();
            selectTask(candidates[0]);
          }
        }
        if (event.key === 'Escape') {
          closeDropdown();
        }
      }, { signal: localSignal });
    }
  }

  ui.taskList?.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;
    const button = target.closest('button.timer-task-pick[data-task-id]');
    if (!button || button.disabled) return;
    const selected = cachedTasks.find((task) => String(task.id) === String(button.dataset.taskId));
    selectTask(selected);
  }, { signal: localSignal });

  ui.taskList?.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.classList.contains('timer-task-check')) return;
    const taskId = normalizeTaskIdValue(target.dataset.taskCheckId || target.value);
    if (!taskId) return;
    if (target.checked) selectedTaskIds.add(taskId);
    else selectedTaskIds.delete(taskId);
    renderTasks(cachedTasks, ui.taskPicker ? ui.taskPicker.value : '');
  }, { signal: localSignal });

  ui.bulkClear?.addEventListener('click', () => {
    selectedTaskIds.clear();
    renderTasks(cachedTasks, ui.taskPicker ? ui.taskPicker.value : '');
  }, { signal: localSignal });

  ui.bulkApply?.addEventListener('click', () => {
    applyBulkAction();
  }, { signal: localSignal });

  ui.quickForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = ui.quickName ? ui.quickName.value.trim() : '';
    if (!name) return;
    const submitButton = ui.quickForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    setQuickTaskFeedback('');

    try {
      const selectedLabelId = ui.quickLabel && ui.quickLabel.value ? ui.quickLabel.value : '';
      const payload = await appApi.createTask({
        name,
        project_id: ui.quickProject && ui.quickProject.value ? ui.quickProject.value : null,
        priority: ui.quickPriority && ui.quickPriority.value ? ui.quickPriority.value : 'medium',
        label_ids: selectedLabelId ? [selectedLabelId] : [],
        goal_id: null
      });
      cachedTasks = mergeTaskPayload(payload);
      selectedTaskIds.clear();
      renderTasks(cachedTasks, ui.taskPicker ? ui.taskPicker.value : '');
      if (ui.quickName) {
        ui.quickName.value = '';
        ui.quickName.focus();
      }
      if (ui.quickPriority) ui.quickPriority.value = 'medium';
      if (ui.quickLabel) ui.quickLabel.value = '';
      setQuickTaskFeedback('Task added.', 'success');
    } catch (error) {
      console.error(error);
      setQuickTaskFeedback(error.message || 'Saving failed.', 'error');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }, { signal: localSignal });

  if (ui.taskDropdown) {
    document.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;
      if (!target.closest('.timer-select')) {
        closeDropdown();
      }
    }, { signal: localSignal });
  }

  (async () => {
    try {
      const tasksPayload = getTasks ? await getTasks() : initialTasks;
      hydrateFromTasks(tasksPayload);
    } catch (error) {
      console.error(error);
      if (ui.taskList) {
        ui.taskList.innerHTML = '<div class="timer-empty-state">Failed to load tasks.</div>';
      }
    }
  })();

  localSignal.addEventListener('abort', () => {
    stopInterval();
    document.title = baseTitle;
  });

  const cleanup = () => {
    stopInterval();
    if (!signal) {
      abortController?.abort();
    }
    document.title = baseTitle;
  };

  return cleanup;
}

function selectElements(root) {
  const query = (selector) => root.querySelector(selector);
  return {
    display: query('[data-pomodoro-display], #pomodoro-display'),
    modeText: query('[data-pomodoro-mode], #pomodoro-mode'),
    taskText: query('[data-pomodoro-task], #pomodoro-task'),
    meta: query('[data-pomodoro-meta], #pomodoro-meta'),
    ring: query('[data-pomodoro-ring], .pomodoro-ring'),
    dots: root.querySelectorAll('[data-session-dot]'),
    toggleBtn: query('[data-pomodoro-toggle], #pomodoro-toggle'),
    toggleIcon: query('[data-pomodoro-toggle-icon], #pomodoro-toggle-icon'),
    toggleText: query('[data-pomodoro-toggle-text], #pomodoro-toggle-text'),
    resetBtn: query('[data-pomodoro-reset], #pomodoro-reset'),
    skipBtn: query('[data-pomodoro-skip], #pomodoro-skip'),
    doneBtn: query('[data-pomodoro-done], #pomodoro-done'),
    presets: root.querySelectorAll('[data-pomodoro-mode]'),
    taskPicker: query('[data-pomodoro-task-picker], #task-picker'),
    taskDropdown: query('[data-pomodoro-task-dropdown], #task-dropdown'),
    taskList: query('[data-pomodoro-task-list], #timer-search-list'),
    taskClear: query('[data-pomodoro-task-clear], #task-clear'),
    bulkCount: query('[data-pomodoro-bulk-count], #timer-bulk-count'),
    bulkClear: query('[data-pomodoro-bulk-clear], #timer-bulk-clear'),
    bulkApply: query('[data-pomodoro-bulk-apply], #timer-bulk-apply'),
    quickForm: query('[data-pomodoro-quick-form], #timer-quick-task-form'),
    quickName: query('[data-pomodoro-quick-name], #timer-quick-task-name'),
    quickProject: query('[data-pomodoro-quick-project], #timer-quick-task-project'),
    quickPriority: query('[data-pomodoro-quick-priority], #timer-quick-task-priority'),
    quickLabel: query('[data-pomodoro-quick-label], #timer-quick-task-label'),
    quickFeedback: query('[data-pomodoro-quick-feedback], #timer-quick-task-feedback')
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
