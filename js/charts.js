/**
 * Enhanced Charts Module for Goalixa PWA
 * Uses ApexCharts for beautiful, interactive visualizations
 */

// Chart instance storage for cleanup
const chartInstances = new Map();

/**
 * Get chart offset state from global (managed by app-view.js)
 */
function getOffsetEnabled() {
  return window.chartOffsetEnabled !== false;
}

/**
 * Update all offset button states
 */
function updateOffsetButtons() {
  const enabled = getOffsetEnabled();
  document.querySelectorAll('.chart-compare-btn').forEach(btn => {
    const icon = btn.querySelector('.chart-compare-icon');
    const text = btn.querySelector('.chart-compare-text');
    if (enabled) {
      btn.classList.add('active');
      btn.title = 'Hide comparison';
      if (icon) icon.className = 'chart-compare-icon bi bi-calendar-week';
      if (text) text.textContent = 'Last Week';
    } else {
      btn.classList.remove('active');
      btn.title = 'Compare with previous period';
      if (icon) icon.className = 'chart-compare-icon bi bi-calendar-week';
      if (text) text.textContent = 'Last Week';
    }
  });
}

/**
 * Create offset toggle button HTML
 */
function createOffsetButton() {
  const enabled = getOffsetEnabled();
  return `
    <button class="chart-compare-btn ${enabled ? 'active' : ''}"
            title="${enabled ? 'Hide comparison' : 'Compare with previous period'}"
            onclick="window.toggleChartOffset()">
      <i class="chart-compare-icon bi bi-calendar-week"></i>
      <span class="chart-compare-text">Last Week</span>
    </button>
  `;
}

/**
 * Toggle offset (wrapper for app-view.js function)
 */
function toggleOffset() {
  if (typeof window.toggleChartOffset === 'function') {
    window.toggleChartOffset();
  }
}

/**
 * Add 7-day offset to a date string
 * @param {string} dateString - ISO date string or label
 * @returns {string} - Offset date string
 */
function addDayOffset(dateString, offsetDays = 7) {
  // Try to parse as date
  const date = new Date(dateString);
  if (!isNaN(date.getTime())) {
    date.setDate(date.getDate() + offsetDays);
    return date.toISOString().split('T')[0];
  }
  // If not a date, return as-is
  return dateString;
}

/**
 * Format date label with optional offset
 * @param {string} label - Date label
 * @param {number} offsetDays - Days to offset (default: 7)
 * @returns {string} - Formatted date label
 */
function formatDateLabelWithOffset(label, offsetDays = 7) {
  const date = new Date(label);
  if (!isNaN(date.getTime())) {
    date.setDate(date.getDate() + offsetDays);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }
  return label;
}

/**
 * Get theme-specific colors for charts
 */
function getChartTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    isDark,
    textColor: isDark ? '#e2e8f0' : '#1e293b',
    gridColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
    tooltipBg: isDark ? '#1e293b' : '#ffffff',
    tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    // High contrast colors that work on both light and dark backgrounds
    colors: [
      '#4f46e5', // Indigo (dark purple) - very visible on all backgrounds
      '#0891b2', // Sky blue - highly visible
      '#059669', // Emerald green - excellent contrast
      '#d97706', // Amber - warm and visible
      '#dc2626', // Red - bold and visible
      '#7c3aed', // Violet - strong purple
      '#2563eb', // Blue - very visible
      '#db2777', // Pink - clear and visible
      '#16a34a', // Green - dark and readable
      '#9333ea', // Purple - strong visible
      '#ea580c', // Orange - warm contrast
    ]
  };
}

/**
 * Format seconds to human readable duration
 */
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

/**
 * Create overview trend chart (line or bar)
 * @param {string} containerId - CSS selector for chart container
 * @param {Array} currentData - Current week data
 * @param {string} mode - Chart mode ('line' or 'bar')
 * @param {Array} previousData - Optional previous week data for comparison
 */
function createOverviewTrendChart(containerId, currentData, mode = 'line', previousData = null) {
  const theme = getChartTheme();

  // Destroy existing chart if any
  destroyChart(containerId);

  const isOffsetEnabled = getOffsetEnabled();
  const isComparison = isOffsetEnabled && previousData && Array.isArray(previousData) && previousData.length > 0;

  // Build categories (x-axis labels)
  const categories = currentData.map(item => {
    const rawLabel = item?.label || item?.date || item?.day || '';
    // In comparison mode, use the current week labels without offset
    // The previous week data is shown on the same timeline for comparison
    return rawLabel.length > 8 ? rawLabel.substring(0, 6) + '..' : rawLabel;
  });

  // Build series data
  let chartSeries = [];
  let chartColors = [];

  if (isComparison) {
    // Comparison mode: show both current and previous week
    const currentSeries = currentData.map(item => Number(item.seconds || 0));
    const previousSeries = previousData.map(item => Number(item.seconds || 0));

    chartSeries = [
      {
        name: 'Previous Week',
        data: previousSeries
      },
      {
        name: 'Current Week',
        data: currentSeries
      }
    ];
    chartColors = [theme.colors[4], theme.colors[0]]; // Red for previous, Indigo for current
  } else {
    // Single series mode
    const series = currentData.map(item => Number(item.seconds || 0));
    chartSeries = [{
      name: 'Focus Time',
      data: series
    }];
    chartColors = [theme.colors[0]];
  }

  const options = {
    series: chartSeries,
    chart: {
      type: mode === 'bar' ? 'bar' : 'area',
      height: 250,
      fontFamily: 'Poppins, sans-serif',
      background: 'transparent',
      toolbar: {
        show: false
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800
      },
      events: {
        mounted: () => {
          // Animation complete callback if needed
        }
      }
    },
    colors: chartColors,
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: '60%',
        dataLabels: {
          position: 'top'
        }
      }
    },
    markers: {
      size: isComparison ? [4, 6] : 6,
      colors: chartColors,
      strokeColors: theme.isDark ? '#0f172a' : '#ffffff',
      strokeWidth: isComparison ? [1, 2] : 2,
      hover: {
        size: isComparison ? [5, 8] : 8
      }
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      curve: 'smooth',
      width: mode === 'bar' ? 0 : (isComparison ? [2, 3] : 3),
      dashArray: isComparison ? [5, 0] : 0,
      lineCap: 'round'
    },
    fill: {
      type: mode === 'bar' ? 'solid' : 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: isComparison ? [0.3, 0.6] : 0.6,
        opacityTo: isComparison ? [0.02, 0.1] : 0.1,
        stops: [0, 90, 100]
      }
    },
    grid: {
      borderColor: theme.gridColor,
      strokeDashArray: 4,
      yaxis: {
        lines: {
          show: true
        }
      },
      xaxis: {
        lines: {
          show: false
        }
      },
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 8
      }
    },
    xaxis: {
      categories: categories,
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      },
      labels: {
        style: {
          colors: theme.textColor,
          fontSize: '11px',
          fontFamily: 'Poppins, sans-serif'
        },
        rotate: -45,
        rotateAlways: false
      }
    },
    yaxis: {
      labels: {
        formatter: (value) => formatDuration(value),
        style: {
          colors: theme.textColor,
          fontSize: '11px',
          fontFamily: 'Poppins, sans-serif'
        }
      }
    },
    tooltip: {
      theme: theme.isDark ? 'dark' : 'light',
      style: {
        fontSize: '12px',
        fontFamily: 'Poppins, sans-serif'
      },
      y: {
        formatter: (value) => formatDuration(value)
      },
      x: {
        formatter: (value, { series, seriesIndex, dataPointIndex, w }) => {
          const fullLabel = currentData[dataPointIndex]?.label || currentData[dataPointIndex]?.date || currentData[dataPointIndex]?.day || value;
          return fullLabel;
        }
      }
    },
    responsive: [
      {
        breakpoint: 640,
        options: {
          chart: {
            height: 200
          },
          xaxis: {
            labels: {
              style: {
                fontSize: '10px'
              }
            }
          }
        }
      }
    ]
  };

  const chart = new ApexCharts(document.querySelector(containerId), options);
  chart.render();
  chartInstances.set(containerId, chart);

  return chart;
}

/**
 * Create distribution donut chart
 */
function createDistributionDonut(containerId, distribution, totalSeconds = 0) {
  const theme = getChartTheme();

  // Destroy existing chart if any
  destroyChart(containerId);

  const series = distribution.map(item => Number(item.seconds || item.total_seconds || 0));
  const labels = distribution.map(item => String(item.name || item.project || item.label || '-'));

  // Filter out zero values
  const nonZeroData = distribution
    .map((item, index) => ({
      ...item,
      value: series[index],
      label: labels[index]
    }))
    .filter(item => item.value > 0);

  if (nonZeroData.length === 0) {
    const container = document.querySelector(containerId);
    if (container) {
      container.innerHTML = '<p class="muted">No tracked time yet.</p>';
    }
    return null;
  }

  const filteredSeries = nonZeroData.map(item => item.value);
  const filteredLabels = nonZeroData.map(item => item.label);

  const options = {
    series: filteredSeries,
    chart: {
      type: 'donut',
      height: 280,
      fontFamily: 'Poppins, sans-serif',
      background: 'transparent',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800
      }
    },
    colors: theme.colors.slice(0, filteredSeries.length),
    labels: filteredLabels,
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '14px',
              fontFamily: 'Poppins, sans-serif',
              color: theme.textColor,
              offsetY: -10
            },
            value: {
              show: true,
              fontSize: '24px',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              color: theme.textColor,
              offsetY: 10,
              formatter: (value) => formatDuration(value)
            },
            total: {
              show: true,
              showAlways: true,
              label: 'Total',
              fontSize: '14px',
              fontFamily: 'Poppins, sans-serif',
              color: theme.textColor,
              formatter: (w) => {
                const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                return formatDuration(total);
              }
            }
          }
        }
      }
    },
    stroke: {
      show: true,
      colors: theme.isDark ? ['#0f172a'] : ['#ffffff'],
      width: 2
    },
    dataLabels: {
      enabled: false
    },
    legend: {
      show: false
    },
    tooltip: {
      theme: theme.isDark ? 'dark' : 'light',
      style: {
        fontSize: '12px',
        fontFamily: 'Poppins, sans-serif'
      },
      y: {
        formatter: (value) => {
          const total = filteredSeries.reduce((a, b) => a + b, 0);
          const percentage = ((value / total) * 100).toFixed(1);
          return `${formatDuration(value)} (${percentage}%)`;
        }
      }
    },
    responsive: [
      {
        breakpoint: 640,
        options: {
          chart: {
            height: 240
          },
          plotOptions: {
            pie: {
              donut: {
                size: '65%'
              }
            }
          }
        }
      }
    ]
  };

  const chart = new ApexCharts(document.querySelector(containerId), options);
  chart.render();
  chartInstances.set(containerId, chart);

  return chart;
}

/**
 * Create reports trend chart
 * @param {string} containerId - CSS selector for chart container
 * @param {Array} currentData - Current period data
 * @param {string} mode - Chart mode ('line' or 'bar')
 * @param {Array} previousData - Optional previous period data for comparison
 */
function createReportsTrendChart(containerId, currentData, mode = 'line', previousData = null) {
  const theme = getChartTheme();

  // Destroy existing chart if any
  destroyChart(containerId);

  const isOffsetEnabled = getOffsetEnabled();
  const isComparison = isOffsetEnabled && previousData && Array.isArray(previousData) && previousData.length > 0;

  // Build categories (x-axis labels)
  const categories = currentData.map(item => {
    const rawLabel = item?.label || item?.date || item?.day || '';
    // In comparison mode, use the current period labels without offset
    return rawLabel.length > 10 ? rawLabel.substring(0, 8) + '..' : rawLabel;
  });

  // Build series data
  let chartSeries = [];
  let chartColors = [];

  if (isComparison) {
    // Comparison mode: show both current and previous period
    const currentSeries = currentData.map(item => Number(item.seconds || 0));
    const previousSeries = previousData.map(item => Number(item.seconds || 0));

    chartSeries = [
      {
        name: 'Previous Period',
        data: previousSeries
      },
      {
        name: 'Current Period',
        data: currentSeries
      }
    ];
    chartColors = [theme.colors[4], theme.colors[1]]; // Red for previous, Sky blue for current
  } else {
    // Single series mode
    const series = currentData.map(item => Number(item.seconds || 0));
    chartSeries = [{
      name: 'Focus Time',
      data: series
    }];
    chartColors = [theme.colors[1]];
  }

  const options = {
    series: chartSeries,
    chart: {
      type: mode === 'bar' ? 'bar' : 'area',
      height: 300,
      fontFamily: 'Poppins, sans-serif',
      background: 'transparent',
      toolbar: {
        show: false
      },
      zoom: {
        enabled: false
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800
      }
    },
    colors: chartColors,
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: '55%',
        dataLabels: {
          position: 'top'
        }
      }
    },
    markers: {
      size: isComparison ? [4, 6] : 6,
      colors: chartColors,
      strokeColors: theme.isDark ? '#0f172a' : '#ffffff',
      strokeWidth: isComparison ? [1, 2] : 2,
      hover: {
        size: isComparison ? [5, 8] : 8
      }
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      curve: 'smooth',
      width: mode === 'bar' ? 0 : (isComparison ? [2, 3] : 3),
      dashArray: isComparison ? [5, 0] : 0,
      lineCap: 'round'
    },
    fill: {
      type: mode === 'bar' ? 'solid' : 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: isComparison ? [0.3, 0.5] : 0.5,
        opacityTo: isComparison ? [0.02, 0.05] : 0.05,
        stops: [0, 90, 100]
      }
    },
    grid: {
      borderColor: theme.gridColor,
      strokeDashArray: 4,
      yaxis: {
        lines: {
          show: true
        }
      },
      xaxis: {
        lines: {
          show: false
        }
      },
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 10
      }
    },
    xaxis: {
      categories: categories,
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      },
      labels: {
        style: {
          colors: theme.textColor,
          fontSize: '11px',
          fontFamily: 'Poppins, sans-serif'
        },
        rotate: -45,
        rotateAlways: false,
        trim: true,
        maxHeight: 60
      }
    },
    yaxis: {
      labels: {
        formatter: (value) => formatDuration(value),
        style: {
          colors: theme.textColor,
          fontSize: '11px',
          fontFamily: 'Poppins, sans-serif'
        }
      },
      tickAmount: 5,
      min: 0
    },
    tooltip: {
      theme: theme.isDark ? 'dark' : 'light',
      style: {
        fontSize: '12px',
        fontFamily: 'Poppins, sans-serif'
      },
      y: {
        formatter: (value) => formatDuration(value)
      },
      x: {
        formatter: (value, { series, seriesIndex, dataPointIndex, w }) => {
          const fullLabel = currentData[dataPointIndex]?.label || currentData[dataPointIndex]?.date || currentData[dataPointIndex]?.day || value;
          return fullLabel;
        }
      }
    },
    responsive: [
      {
        breakpoint: 768,
        options: {
          chart: {
            height: 250
          }
        }
      },
      {
        breakpoint: 480,
        options: {
          chart: {
            height: 200
          },
          xaxis: {
            labels: {
              style: {
                fontSize: '10px'
              },
              rotate: -90,
              rotateAlways: true
            }
          }
        }
      }
    ]
  };

  const chart = new ApexCharts(document.querySelector(containerId), options);
  chart.render();
  chartInstances.set(containerId, chart);

  return chart;
}

/**
 * Create habit streak chart
 */
function createHabitStreakChart(containerId, habits) {
  const theme = getChartTheme();

  // Destroy existing chart if any
  destroyChart(containerId);

  if (!habits || habits.length === 0) {
    const container = document.querySelector(containerId);
    if (container) {
      container.innerHTML = '<p class="muted">No habits yet.</p>';
    }
    return null;
  }

  const series = habits.map(habit => Number(habit.streak || 0));
  const categories = habits.map(habit => {
    const name = habit.name || 'Habit';
    return name.length > 15 ? name.substring(0, 12) + '..' : name;
  });

  const options = {
    series: [{
      name: 'Day Streak',
      data: series
    }],
    chart: {
      type: 'bar',
      height: habits.length * 50 + 40,
      fontFamily: 'Poppins, sans-serif',
      background: 'transparent',
      toolbar: {
        show: false
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 600
      }
    },
    colors: [theme.colors[3]],
    plotOptions: {
      bar: {
        borderRadius: 4,
        horizontal: true,
        barHeight: '60%',
        dataLabels: {
          position: 'top'
        }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: (value) => `${value}d`,
      style: {
        fontSize: '12px',
        fontFamily: 'Poppins, sans-serif',
        colors: [theme.textColor]
      },
      offsetX: 30
    },
    grid: {
      borderColor: theme.gridColor,
      strokeDashArray: 4,
      xaxis: {
        lines: {
          show: true
        }
      },
      yaxis: {
        lines: {
          show: false
        }
      },
      padding: {
        top: 0,
        right: 40,
        bottom: 0,
        left: 0
      }
    },
    xaxis: {
      categories: categories,
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      },
      labels: {
        style: {
          colors: theme.textColor,
          fontSize: '12px',
          fontFamily: 'Poppins, sans-serif'
        }
      }
    },
    yaxis: {
      labels: {
        style: {
          colors: theme.textColor,
          fontSize: '12px',
          fontFamily: 'Poppins, sans-serif'
        }
      }
    },
    tooltip: {
      theme: theme.isDark ? 'dark' : 'light',
      style: {
        fontSize: '12px',
        fontFamily: 'Poppins, sans-serif'
      },
      y: {
        formatter: (value) => `${value} day streak`
      },
      x: {
        formatter: (value, { series, seriesIndex, dataPointIndex, w }) => {
          const habit = habits[dataPointIndex];
          return habit?.name || value;
        }
      }
    }
  };

  const chart = new ApexCharts(document.querySelector(containerId), options);
  chart.render();
  chartInstances.set(containerId, chart);

  return chart;
}

/**
 * Create habit series chart (completion over time)
 */
function createHabitSeriesChart(containerId, habitSeries, habits) {
  const theme = getChartTheme();

  // Destroy existing chart if any
  destroyChart(containerId);

  if (!habitSeries || !habitSeries.labels || habitSeries.labels.length === 0) {
    const container = document.querySelector(containerId);
    if (container) {
      container.innerHTML = '<p class="muted">No habit data yet.</p>';
    }
    return null;
  }

  // Create series for each habit
  const seriesData = habitSeries.series || [{ name: 'Completion', data: habitSeries.values || [] }];

  const categories = habitSeries.labels.map(label => {
    const date = new Date(label);
    // Apply offset only if enabled
    if (getOffsetEnabled()) {
      date.setDate(date.getDate() + 7);
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  const isOffsetEnabled = getOffsetEnabled();

  const options = {
    series: seriesData.map(s => ({
      name: s.name || 'Completion',
      data: s.data || []
    })),
    chart: {
      type: 'line',
      height: 250,
      fontFamily: 'Poppins, sans-serif',
      background: 'transparent',
      toolbar: {
        show: false
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800
      }
    },
    colors: theme.colors.slice(0, seriesData.length),
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: '50%'
      }
    },
    markers: {
      size: 5,
      colors: theme.colors.slice(0, seriesData.length),
      strokeColors: theme.isDark ? '#0f172a' : '#ffffff',
      strokeWidth: 2,
      hover: {
        size: 7
      }
    },
    stroke: {
      curve: 'smooth',
      width: 3,
      lineCap: 'round'
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.05,
        stops: [0, 90, 100]
      }
    },
    grid: {
      borderColor: theme.gridColor,
      strokeDashArray: 4,
      yaxis: {
        lines: {
          show: true
        }
      },
      xaxis: {
        lines: {
          show: false
        }
      },
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 8
      }
    },
    xaxis: {
      categories: categories,
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      },
      labels: {
        style: {
          colors: theme.textColor,
          fontSize: '10px',
          fontFamily: 'Poppins, sans-serif'
        },
        rotate: -45,
        rotateAlways: false
      }
    },
    yaxis: {
      min: 0,
      max: 100,
      labels: {
        formatter: (value) => `${Math.round(value)}%`,
        style: {
          colors: theme.textColor,
          fontSize: '11px',
          fontFamily: 'Poppins, sans-serif'
        }
      },
      tickAmount: 5
    },
    tooltip: {
      theme: theme.isDark ? 'dark' : 'light',
      style: {
        fontSize: '12px',
        fontFamily: 'Poppins, sans-serif'
      },
      y: {
        formatter: (value) => `${Math.round(value)}%`
      }
    },
    legend: {
      show: seriesData.length > 1,
      position: 'top',
      horizontalAlign: 'left',
      fontFamily: 'Poppins, sans-serif',
      labels: {
        colors: theme.textColor
      }
    },
    responsive: [
      {
        breakpoint: 640,
        options: {
          chart: {
            height: 200
          },
          xaxis: {
            labels: {
              style: {
                fontSize: '9px'
              }
            }
          }
        }
      }
    ]
  };

  const chart = new ApexCharts(document.querySelector(containerId), options);
  chart.render();
  chartInstances.set(containerId, chart);

  return chart;
}

/**
 * Destroy a specific chart instance
 */
function destroyChart(containerId) {
  const existingChart = chartInstances.get(containerId);
  if (existingChart) {
    existingChart.destroy();
    chartInstances.delete(containerId);
  }
}

/**
 * Destroy all chart instances
 */
function destroyAllCharts() {
  chartInstances.forEach((chart, containerId) => {
    chart.destroy();
  });
  chartInstances.clear();
}

/**
 * Update charts when theme changes
 */
function updateChartsTheme() {
  chartInstances.forEach((chart) => {
    const theme = getChartTheme();
    chart.updateOptions({
      theme: { mode: theme.isDark ? 'dark' : 'light' },
      grid: {
        borderColor: theme.gridColor
      },
      xaxis: {
        labels: {
          style: {
            colors: theme.textColor
          }
        }
      },
      yaxis: {
        labels: {
          style: {
            colors: theme.textColor
          }
        }
      },
      tooltip: {
        theme: theme.isDark ? 'dark' : 'light'
      }
    }, false, true);
  });
}

/**
 * Create goal momentum chart
 */
function createGoalMomentumChart(containerId, goals) {
  const theme = getChartTheme();

  // Destroy existing chart if any
  destroyChart(containerId);

  if (!goals || goals.length === 0) {
    const container = document.querySelector(containerId);
    if (container) {
      container.innerHTML = '<p class="muted">No goals yet.</p>';
    }
    return null;
  }

  const series = goals.map(goal => {
    const progress = Number(goal.progress || 0);
    return Math.min(100, Math.max(0, progress));
  });
  const categories = goals.map(goal => {
    const title = goal.title || goal.name || 'Goal';
    return title.length > 20 ? title.substring(0, 17) + '..' : title;
  });

  const options = {
    series: [{
      name: 'Progress',
      data: series
    }],
    chart: {
      type: 'bar',
      height: goals.length * 40 + 60,
      fontFamily: 'Poppins, sans-serif',
      background: 'transparent',
      toolbar: {
        show: false
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 600
      }
    },
    colors: theme.colors.slice(0, series.length),
    plotOptions: {
      bar: {
        borderRadius: 6,
        horizontal: true,
        barHeight: '50%',
        distributed: true,
        dataLabels: {
          position: 'top'
        }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: (value) => `${Math.round(value)}%`,
      style: {
        fontSize: '11px',
        fontFamily: 'Poppins, sans-serif',
        colors: [theme.textColor],
        fontWeight: 600
      },
      offsetX: 30
    },
    grid: {
      borderColor: theme.gridColor,
      strokeDashArray: 4,
      xaxis: {
        lines: {
          show: true,
          style: {
            dashArray: 4
          }
        }
      },
      yaxis: {
        lines: {
          show: false
        }
      },
      padding: {
        top: 10,
        right: 50,
        bottom: 0,
        left: 0
      }
    },
    xaxis: {
      categories: categories,
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      },
      labels: {
        style: {
          colors: theme.textColor,
          fontSize: '11px',
          fontFamily: 'Poppins, sans-serif'
        },
        formatter: (value) => `${value}%`
      },
      max: 100,
      tickAmount: 5
    },
    yaxis: {
      labels: {
        style: {
          colors: theme.textColor,
          fontSize: '11px',
          fontFamily: 'Poppins, sans-serif'
        },
        maxWidth: 150
      }
    },
    tooltip: {
      theme: theme.isDark ? 'dark' : 'light',
      style: {
        fontSize: '12px',
        fontFamily: 'Poppins, sans-serif'
      },
      y: {
        formatter: (value) => `${Math.round(value)}% complete`
      },
      x: {
        formatter: (value, { series, seriesIndex, dataPointIndex, w }) => {
          const goal = goals[dataPointIndex];
          return goal?.title || goal?.name || value;
        }
      }
    },
    legend: {
      show: false
    }
  };

  const chart = new ApexCharts(document.querySelector(containerId), options);
  chart.render();
  chartInstances.set(containerId, chart);

  return chart;
}

/**
 * Create burnup chart (planned vs logged cumulative)
 */
function createBurnupChart(containerId, plannedSeries, actualSeries, categories) {
  const theme = getChartTheme();

  destroyChart(containerId);

  const options = {
    series: [
      {
        name: 'Planned',
        data: plannedSeries
      },
      {
        name: 'Logged',
        data: actualSeries
      }
    ],
    chart: {
      type: 'line',
      height: 280,
      fontFamily: 'Poppins, sans-serif',
      background: 'transparent',
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 700
      }
    },
    colors: [theme.colors[3], theme.colors[1]],
    stroke: {
      curve: 'smooth',
      width: [2.5, 3.5],
      dashArray: [8, 0],
      lineCap: 'round'
    },
    markers: {
      size: 4,
      strokeWidth: 2,
      colors: [theme.colors[3], theme.colors[1]],
      strokeColors: theme.isDark ? '#0f172a' : '#ffffff'
    },
    dataLabels: {
      enabled: false
    },
    grid: {
      borderColor: theme.gridColor,
      strokeDashArray: 4,
      yaxis: { lines: { show: true } },
      padding: { left: 10, right: 0, top: 0, bottom: 0 }
    },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          colors: theme.textColor,
          fontSize: '11px',
          fontFamily: 'Poppins, sans-serif'
        },
        rotate: -45,
        rotateAlways: false
      }
    },
    yaxis: {
      labels: {
        formatter: (value) => formatDuration(value),
        style: {
          colors: theme.textColor,
          fontSize: '11px',
          fontFamily: 'Poppins, sans-serif'
        }
      },
      min: 0
    },
    tooltip: {
      theme: theme.isDark ? 'dark' : 'light',
      style: {
        fontSize: '12px',
        fontFamily: 'Poppins, sans-serif'
      },
      y: {
        formatter: (value) => formatDuration(value)
      }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'left',
      labels: {
        colors: theme.textColor
      }
    }
  };

  const chart = new ApexCharts(document.querySelector(containerId), options);
  chart.render();
  chartInstances.set(containerId, chart);
  return chart;
}

// Export functions for use in other modules
window.GoalixaCharts = {
  createOverviewTrendChart,
  createDistributionDonut,
  createReportsTrendChart,
  createHabitStreakChart,
  createHabitSeriesChart,
  createGoalMomentumChart,
  createBurnupChart,
  destroyChart,
  destroyAllCharts,
  updateChartsTheme,
  getChartTheme,
  formatDuration,
  getOffsetEnabled,
  toggleOffset,
  updateOffsetButtons,
  createOffsetButton
};

// Make theme update available globally
window.addEventListener('theme-changed', () => {
  updateChartsTheme();
});

console.log('[GoalixaCharts] Enhanced charts module loaded');
