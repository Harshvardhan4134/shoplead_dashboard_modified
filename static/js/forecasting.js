
/**
 * Forecasting page functionality
 */
function formatNumber(num) {
    if (isNaN(num) || num === null) {
        return '0.0';
    }
    return parseFloat(num).toFixed(1);
}

// Global variables
let forecastChart = null;
let efficiencyChart = null;
let completionChart = null;
let workCentersData = {};
let jobsData = [];

// Load data on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log("📊 Initializing forecasting page...");
    loadForecastingData();
    
    // Set up generate forecast button
    const generateForecastBtn = document.getElementById('generateForecastBtn');
    if (generateForecastBtn) {
        generateForecastBtn.addEventListener('click', generateForecast);
    }
});

// Load data from API
function loadForecastingData() {
    console.log("🔄 Loading forecasting data...");
    
    // Fetch data
    Promise.all([
        fetch('/api/work_centers').then(res => res.json()),
        fetch('/api/jobs').then(res => res.json()),
        fetch('/api/forecast').then(res => res.json())
    ])
    .then(([workCenters, jobs, forecast]) => {
        console.log("✅ Forecast data loaded:", forecast);
        
        workCentersData = workCenters;
        jobsData = jobs;
        
        // Initialize UI components
        initWorkCenterSelect(workCenters);
        initForecastChart(forecast);
        initEfficiencyChart(forecast);
        initCompletionChart(forecast);
        displayForecastTable(forecast);
    })
    .catch(error => {
        console.error("❌ Error loading forecast data:", error);
        showAlert("Error loading forecasting data", "danger");
    });
}

// Initialize work center select dropdown
function initWorkCenterSelect(workCenters) {
    const select = document.getElementById('workCenterSelect');
    if (!select) return;
    
    // Clear existing options except the "All" option
    const allOption = select.querySelector('option[value="all"]');
    select.innerHTML = '';
    if (allOption) {
        select.appendChild(allOption);
    } else {
        const option = document.createElement('option');
        option.value = 'all';
        option.textContent = 'All Work Centers';
        select.appendChild(option);
    }
    
    // Add work centers to select
    if (workCenters && typeof workCenters === 'object') {
        Object.keys(workCenters).sort().forEach(workCenter => {
            const option = document.createElement('option');
            option.value = workCenter;
            option.textContent = workCenter;
            select.appendChild(option);
        });
    }
}

// Initialize forecast chart
function initForecastChart(forecast) {
    const chartElement = document.getElementById('forecastChart');
    if (!chartElement) return;
    
    // Destroy existing chart if it exists
    if (forecastChart) {
        forecastChart.destroy();
    }
    
    try {
        const ctx = chartElement.getContext('2d');
        
        // Generate forecast data for next 8 weeks
        const labels = [];
        const currentDate = new Date();
        
        for (let i = 0; i < 8; i++) {
            const date = new Date(currentDate);
            date.setDate(date.getDate() + i * 7);
            labels.push(`Week ${i + 1}`);
        }
        
        // Generate data series for each work center
        const datasets = [];
        const colors = [
            'rgba(59, 125, 221, 0.7)',
            'rgba(40, 167, 69, 0.7)',
            'rgba(255, 193, 7, 0.7)',
            'rgba(220, 53, 69, 0.7)',
            'rgba(111, 66, 193, 0.7)'
        ];
        
        Object.keys(forecast).forEach((workCenter, index) => {
            // Base forecast on projected hours
            const projectedHours = forecast[workCenter].projected_hours || 100;
            
            // Generate projected weekly hours with some variation
            const weeklyData = labels.map((_, i) => {
                const base = projectedHours * (0.8 + Math.random() * 0.4);
                const trend = i * (Math.random() * 0.05);
                return base * (1 + trend);
            });
            
            datasets.push({
                label: workCenter,
                data: weeklyData,
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length].replace('0.7', '0.1'),
                borderWidth: 2,
                fill: false,
                tension: 0.1
            });
        });
        
        forecastChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Projected Hours'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Workload Forecast'
                    }
                }
            }
        });
    } catch (error) {
        console.error("Error creating forecast chart:", error);
    }
}

// Initialize efficiency chart
function initEfficiencyChart(forecast) {
    const chartElement = document.getElementById('efficiencyChart');
    if (!chartElement) return;
    
    // Destroy existing chart if it exists
    if (efficiencyChart) {
        efficiencyChart.destroy();
    }
    
    try {
        const ctx = chartElement.getContext('2d');
        
        // Calculate efficiency for each work center
        const labels = Object.keys(forecast);
        const efficiencyData = labels.map(workCenter => {
            return forecast[workCenter].efficiency_trend || Math.floor(Math.random() * 30) + 70;
        });
        
        efficiencyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Efficiency (%)',
                    data: efficiencyData,
                    backgroundColor: 'rgba(59, 125, 221, 0.7)',
                    borderColor: 'rgba(59, 125, 221, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 120,
                        title: {
                            display: true,
                            text: 'Efficiency (%)'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Production Efficiency by Work Center'
                    }
                }
            }
        });
    } catch (error) {
        console.error("Error creating efficiency chart:", error);
    }
}

// Initialize completion time chart
function initCompletionChart(forecast) {
    const chartElement = document.getElementById('completionChart');
    if (!chartElement) return;
    
    // Destroy existing chart if it exists
    if (completionChart) {
        completionChart.destroy();
    }
    
    try {
        const ctx = chartElement.getContext('2d');
        
        // Calculate projected completion for each work center
        const labels = Object.keys(forecast);
        const projectedData = labels.map(workCenter => forecast[workCenter].projected_hours || 0);
        const plannedData = labels.map(workCenter => {
            const workCenterData = workCentersData[workCenter] || {};
            return workCenterData.planned_hours || 0;
        });
        
        completionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Planned Hours',
                        data: plannedData,
                        backgroundColor: 'rgba(59, 125, 221, 0.7)',
                        borderColor: 'rgba(59, 125, 221, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Projected Hours',
                        data: projectedData,
                        backgroundColor: 'rgba(255, 193, 7, 0.7)',
                        borderColor: 'rgba(255, 193, 7, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Hours'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Planned vs. Projected Hours'
                    }
                }
            }
        });
    } catch (error) {
        console.error("Error creating completion chart:", error);
    }
}

// Display forecast table
function displayForecastTable(forecast) {
    const table = document.getElementById('forecastTable');
    if (!table) return;
    
    table.innerHTML = '';
    
    if (Object.keys(forecast).length === 0) {
        table.innerHTML = '<tr><td colspan="6" class="text-center">No forecast data available</td></tr>';
        return;
    }
    
    Object.keys(forecast).forEach(workCenter => {
        const data = forecast[workCenter];
        const row = document.createElement('tr');
        
        const workCenterData = workCentersData[workCenter] || {};
        const plannedHours = workCenterData.planned_hours || 0;
        const projectedHours = data.projected_hours || 0;
        const variance = projectedHours - plannedHours;
        const efficiency = data.efficiency_trend || 0;
        
        // Calculate projected completion date
        const today = new Date();
        const daysToComplete = plannedHours > 0 ? Math.ceil(projectedHours / 8) : 0; // Assuming 8-hour workdays
        const projectedDate = new Date(today);
        projectedDate.setDate(projectedDate.getDate() + daysToComplete);
        
        row.innerHTML = `
            <td>${workCenter}</td>
            <td>${formatNumber(plannedHours)}</td>
            <td>${formatNumber(projectedHours)}</td>
            <td class="${variance > 0 ? 'text-danger' : 'text-success'}">${variance > 0 ? '+' : ''}${formatNumber(variance)}</td>
            <td>${formatNumber(efficiency)}%</td>
            <td>${daysToComplete > 0 ? projectedDate.toLocaleDateString() : 'N/A'}</td>
        `;
        
        table.appendChild(row);
    });
}

// Generate forecast based on user inputs
function generateForecast() {
    const workCenter = document.getElementById('workCenterSelect').value;
    const period = document.getElementById('forecastPeriod').value;
    
    showAlert("Generating forecast for " + (workCenter === 'all' ? 'all work centers' : workCenter), "info");
    
    // In a real app, you would send a request to the server to generate the forecast
    // For demo purposes, we'll just simulate generating a new forecast
    
    setTimeout(() => {
        // If the user has selected a specific work center, filter the forecast
        let filteredForecast = {};
        const forecast = {};
        
        if (workCenter === 'all') {
            // Use all work centers
            Object.keys(workCentersData).forEach(wc => {
                const workCenterData = workCentersData[wc] || {};
                const plannedHours = workCenterData.planned_hours || 0;
                const actualHours = workCenterData.actual_hours || 0;
                
                forecast[wc] = {
                    efficiency_trend: actualHours > 0 ? Math.min(100, Math.round((actualHours / plannedHours) * 100)) : 0,
                    projected_hours: plannedHours * 1.1, // Assume 10% more time than planned
                    completion_rate: 90 // Assume 90% completion rate
                };
            });
            filteredForecast = forecast;
        } else {
            // Filter for specific work center
            const workCenterData = workCentersData[workCenter] || {};
            const plannedHours = workCenterData.planned_hours || 0;
            const actualHours = workCenterData.actual_hours || 0;
            
            filteredForecast[workCenter] = {
                efficiency_trend: actualHours > 0 ? Math.min(100, Math.round((actualHours / plannedHours) * 100)) : 0,
                projected_hours: plannedHours * 1.1, // Assume 10% more time than planned
                completion_rate: 90 // Assume 90% completion rate
            };
        }
        
        // Adjust forecast period
        let periodMultiplier = 1;
        if (period === 'month') {
            periodMultiplier = 4; // 4 weeks
        } else if (period === 'quarter') {
            periodMultiplier = 12; // 12 weeks
        }
        
        // Apply period multiplier to projected hours
        Object.keys(filteredForecast).forEach(wc => {
            filteredForecast[wc].projected_hours *= periodMultiplier;
        });
        
        // Refresh charts with filtered data
        initForecastChart(filteredForecast);
        initEfficiencyChart(filteredForecast);
        initCompletionChart(filteredForecast);
        displayForecastTable(filteredForecast);
        
        showAlert("Forecast generated successfully", "success");
    }, 1000);
}
