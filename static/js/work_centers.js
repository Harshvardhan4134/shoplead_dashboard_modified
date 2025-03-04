
/**
 * Work Centers page functionality
 */
function formatNumber(num) {
    if (isNaN(num) || num === null) {
        return '0.0';
    }
    return parseFloat(num).toFixed(1);
}


function showLoadingState(container, isLoading) {
    if (isLoading) {
        container.innerHTML = `<div class="text-center">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>`;
    } else {
        container.innerHTML = '';
    }
}


// Global variables
let workloadChart = null;
let efficiencyChart = null;

// Load data on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log("🏭 Initializing work centers page...");
    loadWorkCentersData();
    
    // Set up refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadWorkCentersData);
    }
});

// Load data from API
function loadWorkCentersData() {
    console.log("🔄 Loading work centers data...");
    showLoadingState('workCentersTable');
    
    Promise.all([
        fetch('/api/work_centers').then(res => res.json()),
        fetch('/api/jobs').then(res => res.json())
    ])
    .then(([workCenters, jobs]) => {
        console.log("✅ Work centers data loaded:", {workCenters, jobs});
        
        // Extract work center data from API response
        const workCenterData = workCenters.workCenters || workCenters;
        
        displayWorkCenters(workCenterData, jobs);
        createWorkloadChart(workCenterData);
        createEfficiencyChart(workCenterData);
        
        // Add click handlers for details buttons
        setupDetailButtons(workCenterData);
    })
    .catch(error => {
        console.error("❌ Error loading work centers data:", error);
        showErrorState('workCentersTable', error.message);
    });
}

// Display work centers in table
function displayWorkCenters(workCenters, jobsData) {
    showLoadingState('workCentersTable');
    
    const table = document.getElementById('workCentersTable');
    if (!table) return;
    
    try {
        table.innerHTML = '';
        
        if (!workCenters || Object.keys(workCenters).length === 0) {
            showErrorState('workCentersTable', 'No work centers data available');
            return;
        }
        
        Object.keys(workCenters).forEach(workCenter => {
            const data = workCenters[workCenter];
            const row = document.createElement('tr');
            
            const plannedHours = parseFloat(data.planned_hours) || 0;
            const actualHours = parseFloat(data.actual_hours) || 0;
            const efficiency = plannedHours > 0 ? Math.round((actualHours / plannedHours) * 100) : 0;
            
            row.innerHTML = `
                <td>${workCenter}</td>
                <td>${plannedHours.toFixed(1)}</td>
                <td>${actualHours.toFixed(1)}</td>
                <td>${efficiency}%</td>
                <td>${(data.capacity || 0).toFixed(1)}</td>
                <td><span class="badge bg-${getStatusColor(data.load_status || 'Normal')}">${data.load_status || 'Normal'}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary view-details-btn" data-work-center="${workCenter}">
                        <i class="fas fa-eye"></i> Details
                    </button>
                </td>
            `;
            
            table.appendChild(row);
        });
    } catch (error) {
        console.error('Error displaying work centers:', error);
        showErrorState('workCentersTable', 'Error displaying work centers data');
    }
}

// Create workload chart
function createWorkloadChart(workCenters) {
    const chartElement = document.getElementById('workloadChart');
    if (!chartElement) return;
    
    // Destroy existing chart if it exists
    if (workloadChart) {
        workloadChart.destroy();
    }
    
    try {
        const ctx = chartElement.getContext('2d');
        
        // Prepare data for chart
        const labels = Object.keys(workCenters);
        const plannedData = labels.map(wc => workCenters[wc].planned_hours || 0);
        const capacityData = labels.map(wc => workCenters[wc].capacity || 0);
        const backlogData = labels.map(wc => workCenters[wc].backlog || 0);
        
        workloadChart = new Chart(ctx, {
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
                        label: 'Capacity',
                        data: capacityData,
                        backgroundColor: 'rgba(40, 167, 69, 0.7)',
                        borderColor: 'rgba(40, 167, 69, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Backlog',
                        data: backlogData,
                        backgroundColor: 'rgba(220, 53, 69, 0.7)',
                        borderColor: 'rgba(220, 53, 69, 1)',
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
                        text: 'Work Center Workload Distribution'
                    }
                }
            }
        });
    } catch (error) {
        console.error("Error creating workload chart:", error);
    }
}

// Create efficiency chart
function createEfficiencyChart(workCenters) {
    const chartElement = document.getElementById('efficiencyChart');
    if (!chartElement) return;
    
    // Destroy existing chart if it exists
    if (efficiencyChart) {
        efficiencyChart.destroy();
    }
    
    try {
        const ctx = chartElement.getContext('2d');
        
        // Prepare data for chart
        const labels = Object.keys(workCenters);
        const efficiencyData = labels.map(wc => {
            const plannedHours = workCenters[wc].planned_hours || 0;
            const actualHours = workCenters[wc].actual_hours || 0;
            return plannedHours > 0 ? (actualHours / plannedHours) * 100 : 0;
        });
        
        efficiencyChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Efficiency (%)',
                        data: efficiencyData,
                        backgroundColor: 'rgba(59, 125, 221, 0.2)',
                        borderColor: 'rgba(59, 125, 221, 1)',
                        pointBackgroundColor: 'rgba(59, 125, 221, 1)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgba(59, 125, 221, 1)',
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    r: {
                        beginAtZero: true,
                        min: 0,
                        max: 120,
                        ticks: {
                            stepSize: 20
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Work Center Efficiency Comparison'
                    }
                }
            }
        });
    } catch (error) {
        console.error("Error creating efficiency chart:", error);
    }
}

// Setup detail button event handlers
function setupDetailButtons(workCenterData) {
    const detailButtons = document.querySelectorAll('.view-details-btn');
    
    detailButtons.forEach(button => {
        button.addEventListener('click', function() {
            const workCenter = this.getAttribute('data-work-center');
            showWorkCenterDetails(workCenter, workCenterData[workCenter]);
        });
    });
}

// Show work center details in modal
function showWorkCenterDetails(workCenterName, workCenterData) {
    console.log("Showing details for work center:", workCenterData);
    
    const modal = document.getElementById('workCenterModal');
    if (!modal) return;
    
    // Update modal title
    document.getElementById('modalWorkCenterName').textContent = workCenterName;
    
    // Update metrics
    document.getElementById('modalPlannedHours').textContent = formatNumber(workCenterData.planned_hours || 0);
    document.getElementById('modalActualHours').textContent = formatNumber(workCenterData.actual_hours || 0);
    
    const efficiency = calculateEfficiency(workCenterData.actual_hours || 0, workCenterData.planned_hours || 0);
    document.getElementById('modalEfficiency').textContent = `${efficiency}%`;
    
    document.getElementById('modalCapacity').textContent = formatNumber(workCenterData.capacity || 0);
    document.getElementById('modalBacklog').textContent = formatNumber(workCenterData.backlog || 0);
    
    // Create weekly performance chart
    createWeeklyPerformanceChart(workCenterData);
    
    // Display operations
    displayWorkCenterOperations(workCenterName);
    
    // Show modal
    try {
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
    } catch (error) {
        console.error("Error showing modal:", error);
        modal.style.display = 'block';
    }
}

// Create weekly performance chart
function createWeeklyPerformanceChart(workCenterData) {
    const chartElement = document.getElementById('weeklyPerformanceChart');
    if (!chartElement) return;
    
    // Generate some sample weekly data
    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    const weeklyPlanned = weeks.map(() => Math.round((workCenterData.planned_hours || 40) * (0.8 + Math.random() * 0.4)));
    const weeklyActual = weeklyPlanned.map(planned => Math.round(planned * (0.8 + Math.random() * 0.4)));
    
    try {
        const ctx = chartElement.getContext('2d');
        
        // Destroy existing chart
        const existingChart = Chart.getChart(chartElement);
        if (existingChart) {
            existingChart.destroy();
        }
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: weeks,
                datasets: [
                    {
                        label: 'Planned',
                        data: weeklyPlanned,
                        borderColor: 'rgba(59, 125, 221, 1)',
                        backgroundColor: 'rgba(59, 125, 221, 0.1)',
                        borderWidth: 2,
                        fill: false
                    },
                    {
                        label: 'Actual',
                        data: weeklyActual,
                        borderColor: 'rgba(40, 167, 69, 1)',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        borderWidth: 2,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    } catch (error) {
        console.error("Error creating weekly performance chart:", error);
    }
}

// Display operations for a work center
function displayWorkCenterOperations(workCenterName) {
    const tableBody = document.getElementById('modalOperationsTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    // Fetch operations for this work center from API
    fetch('/api/jobs')
        .then(res => res.json())
        .then(jobs => {
            const operations = [];
            
            // Extract operations for this work center
            jobs.forEach(job => {
                if (!job.work_orders) return;
                
                job.work_orders.forEach(workOrder => {
                    if (!workOrder.operations) return;
                    
                    workOrder.operations.forEach(operation => {
                        if (operation.work_center === workCenterName) {
                            operations.push({
                                job_number: job.job_number,
                                operation_number: operation.operation_number,
                                planned_hours: operation.planned_hours || 0,
                                actual_hours: operation.actual_hours || 0,
                                status: operation.status || 'Not Started'
                            });
                        }
                    });
                });
            });
            
            // Display operations
            if (operations.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No operations found for this work center</td></tr>';
                return;
            }
            
            operations.forEach(op => {
                const progress = op.planned_hours > 0 ? (op.actual_hours / op.planned_hours) * 100 : 0;
                
                tableBody.innerHTML += `
                    <tr>
                        <td>${op.job_number}</td>
                        <td>${op.operation_number}</td>
                        <td>${formatNumber(op.planned_hours)}</td>
                        <td>${formatNumber(op.actual_hours)}</td>
                        <td>${createProgressBar(progress)}</td>
                        <td>${createStatusBadge(op.status)}</td>
                    </tr>
                `;
            });
        })
        .catch(error => {
            console.error("Error fetching operations:", error);
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Error loading operations data</td></tr>';
        });
}


function createStatusBadge(status) {
    let colorClass = 'bg-secondary'; // Default color

    switch (status) {
        case 'Completed':
            colorClass = 'bg-success'; // Green
            break;
        case 'In Progress':
            colorClass = 'bg-primary'; // Blue
            break;
        case 'Delayed':
            colorClass = 'bg-danger'; // Red
            break;
        case 'Not Started':
            colorClass = 'bg-warning'; // Yellow
            break;
    }

    return `<span class="badge ${colorClass}">${status}</span>`;
}

