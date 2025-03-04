
/**
 * Scheduling page functionality
 */

// Global variables
let calendar = null;
let jobsData = [];
let workCentersData = {};
let operationsData = [];

// Load data on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log("📅 Initializing scheduling page...");
    loadSchedulingData();
    
    // Initialize save operation button
    const saveOperationBtn = document.getElementById('saveOperationBtn');
    if (saveOperationBtn) {
        saveOperationBtn.addEventListener('click', saveOperation);
    }
    
    // Initialize filter button
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFilters);
    }
});

// Load data from API
function loadSchedulingData() {
    console.log("🔄 Loading scheduling data...");

    Promise.all([
        fetch('/api/work_centers').then(res => res.json()),
        fetch('/api/jobs').then(res => res.json())
    ])
    .then(([workCenters, jobs]) => {
        console.log("✅ Data loaded:", {workCenters, jobs});

        workCentersData = workCenters;
        jobsData = jobs;
        operationsData = extractOperations(jobs);
        
        initWorkCenterFilter(workCenters);
        
        try {
            initCalendar(operationsData);
        } catch (error) {
            console.error("Error initializing calendar:", error);
        }
        
        displayScheduleTable(operationsData);
        displayUnscheduledOperations(operationsData);
    })
    .catch(error => {
        console.error("❌ Error loading scheduling data:", error);
        showAlert("Error loading scheduling data", "danger");
    });
}

// Initialize work center filter dropdown
function initWorkCenterFilter(workCenters) {
    const filter = document.getElementById('workCenterFilter');
    if (!filter) return;
    
    // Clear existing options except the "All" option
    const allOption = filter.querySelector('option[value="all"]');
    filter.innerHTML = '';
    if (allOption) {
        filter.appendChild(allOption);
    } else {
        const option = document.createElement('option');
        option.value = 'all';
        option.textContent = 'All Work Centers';
        filter.appendChild(option);
    }
    
    // Add work centers to filter
    if (workCenters && typeof workCenters === 'object') {
        Object.keys(workCenters).sort().forEach(workCenter => {
            const option = document.createElement('option');
            option.value = workCenter;
            option.textContent = workCenter;
            filter.appendChild(option);
        });
    }
}

// Initialize FullCalendar
function initCalendar(operations) {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;
    
    // Check if FullCalendar is loaded
    if (typeof FullCalendar === 'undefined' || typeof FullCalendar.Calendar === 'undefined') {
        console.error("FullCalendar library not loaded");
        showAlert("Calendar library not loaded", "danger");
        return;
    }
    
    
    // Prepare events for calendar
    const events = operations.map(op => {
        // Skip operations without scheduled date
        if (!op.scheduled_date) return null;
        
        // Determine color based on status
        let color = '#6c757d'; // default gray
        if (op.status === 'Completed') {
            color = '#28a745'; // green
        } else if (op.status === 'In Progress') {
            color = '#007bff'; // blue
        } else if (op.status === 'Delayed') {
            color = '#dc3545'; // red
        }
        
        return {
            id: op.id,
            title: `${op.job_number} - ${op.operation_number}`,
            start: op.scheduled_date,
            color: color,
            extendedProps: {
                workCenter: op.work_center,
                status: op.status,
                operation: op
            }
        };
    }).filter(event => event !== null);
    
    // Initialize calendar
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        events: events,
        eventClick: function(info) {
            showOperationDetails(info.event.extendedProps.operation);
        },
        eventDrop: function(info) {
            // Handle drag-and-drop scheduling
            const operation = info.event.extendedProps.operation;
            const newDate = info.event.start;
            
            // Update operation scheduled date
            updateScheduledDate(operation, newDate);
        }
    });
    
    calendar.render();
}

function formatNumber(num) {
    return num ? parseFloat(num).toFixed(2) : '0.00';
}
// Display schedule in table view
function displayScheduleTable(operations) {
    const table = document.getElementById('scheduleTable');
    if (!table) return;
    
    table.innerHTML = '';
    
    if (!operations || operations.length === 0) {
        table.innerHTML = '<tr><td colspan="8" class="text-center">No operations found</td></tr>';
        console.warn("⚠️ No operations found");
        return;
    }
    
    // Sort operations by scheduled date
    const sortedOperations = [...operations].sort((a, b) => {
        if (!a.scheduled_date) return 1;
        if (!b.scheduled_date) return -1;
        return new Date(a.scheduled_date) - new Date(b.scheduled_date);
    });
    
    sortedOperations.forEach(op => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${op.job_number}</td>
            <td>${op.work_order_number}</td>
            <td>${op.operation_number}</td>
            <td>${op.work_center}</td>
            <td>${formatDate(op.scheduled_date)}</td>
            <td>${formatNumber(op.planned_hours)}</td>
            <td>${createStatusBadge(op.status)}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary edit-op-btn" data-op-id="${op.id}">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        `;
        
        table.appendChild(row);
    });
    
    // Add event listeners for edit buttons
    const editButtons = document.querySelectorAll('.edit-op-btn');
    editButtons.forEach(button => {
        button.addEventListener('click', function() {
            const opId = this.getAttribute('data-op-id');
            const operation = operationsData.find(op => op.id === opId);
            if (operation) {
                showOperationDetails(operation);
            }
        });
    });
    
    
}

// Display unscheduled operations
function displayUnscheduledOperations(operations) {
    const list = document.getElementById('unscheduledList');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (!operations || operations.length === 0) {
        list.innerHTML = '<div class="list-group-item text-center">No operations found</div>';
        return;
    }
    
    // Filter unscheduled operations
    const unscheduled = operations.filter(op => !op.scheduled_date);
    
    if (unscheduled.length === 0) {
        list.innerHTML = '<div class="list-group-item text-center">No unscheduled operations</div>';
        return;
    }
    
    unscheduled.forEach(op => {
        const item = document.createElement('div');
        item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        item.setAttribute('data-op-id', op.id);
        item.draggable = true;
        
        item.innerHTML = `
            <div>
                <strong>${op.job_number}</strong> - ${op.operation_number}<br>
                <small>${op.work_center}</small>
            </div>
            <span class="badge bg-${getStatusColor(op.status)}">${op.status}</span>
        `;
        
        // Add event listener for clicking on unscheduled operation
        item.addEventListener('click', function() {
            const opId = this.getAttribute('data-op-id');
            const operation = operationsData.find(op => op.id === opId);
            if (operation) {
                showOperationDetails(operation);
            }
        });
        
        list.appendChild(item);
    });
}

// Show operation details in modal
function showOperationDetails(operation) {
    const modal = document.getElementById('operationModal');
    if (!modal) return;
    
    // Set operation details in form
    document.getElementById('operationId').value = operation.id;
    document.getElementById('jobNumber').value = operation.job_number;
    document.getElementById('workOrderNumber').value = operation.work_order_number;
    document.getElementById('operationNumber').value = operation.operation_number;
    document.getElementById('workCenter').value = operation.work_center;
    
    if (operation.scheduled_date) {
        // Format date for input field (YYYY-MM-DD)
        const date = new Date(operation.scheduled_date);
        const formattedDate = date.toISOString().split('T')[0];
        document.getElementById('scheduledDate').value = formattedDate;
    } else {
        document.getElementById('scheduledDate').value = '';
    }
    
    document.getElementById('plannedHours').value = operation.planned_hours;
    document.getElementById('actualHours').value = operation.actual_hours;
    document.getElementById('status').value = operation.status;
    
    // Show modal
    try {
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
    } catch (error) {
        console.error("Error showing modal:", error);
        modal.style.display = 'block';
    }
}

// Save operation changes
function saveOperation() {
    try {
        const operationId = document.getElementById('operationId').value;
        const scheduledDate = document.getElementById('scheduledDate').value;
        const plannedHours = parseFloat(document.getElementById('plannedHours').value);
        const actualHours = parseFloat(document.getElementById('actualHours').value);
        const status = document.getElementById('status').value;
        
        // Find operation in data
        const operation = operationsData.find(op => op.id === operationId);
        if (!operation) {
            showAlert("Operation not found", "danger");
            return;
        }
        
        // Update operation data
        operation.scheduled_date = scheduledDate ? new Date(scheduledDate).toISOString() : null;
        operation.planned_hours = plannedHours;
        operation.actual_hours = actualHours;
        operation.status = status;
        
        // In a real app, you would send the updated data to the server here
        // For demo purposes, we'll just update the UI
        
        // Refresh calendar and table
        initCalendar(operationsData);
        displayScheduleTable(operationsData);
        displayUnscheduledOperations(operationsData);
        
        // Close modal
        const modal = document.getElementById('operationModal');
        try {
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modalInstance) {
                modalInstance.hide();
            } else {
                modal.style.display = 'none';
            }
        } catch (error) {
            console.error("Error hiding modal:", error);
            modal.style.display = 'none';
        }
        
        showAlert("Operation updated successfully", "success");
    } catch (error) {
        console.error("Error saving operation:", error);
        showAlert("Error saving operation", "danger");
    }
}

// Update operation scheduled date
function updateScheduledDate(operation, newDate) {
    // Find operation in data
    const op = operationsData.find(o => o.id === operation.id);
    if (!op) return;
    
    // Update scheduled date
    op.scheduled_date = newDate.toISOString();
    
    // In a real app, you would send the updated data to the server here
    // For demo purposes, we'll just update the UI
    
    // Refresh table
    displayScheduleTable(operationsData);
    displayUnscheduledOperations(operationsData);
    
    showAlert("Operation rescheduled successfully", "success");
}

// Apply filters to calendar and table
function applyFilters() {
    const workCenterFilter = document.getElementById('workCenterFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    // Filter operations
    let filteredOperations = [...operationsData];
    
    if (workCenterFilter !== 'all') {
        filteredOperations = filteredOperations.filter(op => op.work_center === workCenterFilter);
    }
    
    if (statusFilter !== 'all') {
        filteredOperations = filteredOperations.filter(op => op.status === statusFilter);
    }
    
    // Refresh calendar with filtered data
    initCalendar(filteredOperations);
    
    // Refresh table with filtered data
    displayScheduleTable(filteredOperations);
    
    // Update unscheduled list with filtered data
    displayUnscheduledOperations(filteredOperations);
}

// Extract operations from jobs data
function extractOperations(jobs) {
    const operations = [];
    let id = 1;
    
    if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
        console.warn("⚠️ No operations found");
        return [];
    }
    
    jobs.forEach(job => {
        if (!job.work_orders) return;
        
        job.work_orders.forEach(workOrder => {
            if (!workOrder.operations) return;
            
            workOrder.operations.forEach(operation => {
                operations.push({
                    id: id.toString(),
                    job_number: job.job_number,
                    work_order_number: workOrder.work_order_number,
                    operation_number: operation.operation_number,
                    work_center: operation.work_center,
                    planned_hours: operation.planned_hours || 0,
                    actual_hours: operation.actual_hours || 0,
                    status: operation.status || 'Not Started',
                    scheduled_date: operation.scheduled_date ? new Date(operation.scheduled_date) : null
                });
                id++;
            });
        });
    });
    
    return operations;
}
function createStatusBadge(status) {
    let colorClass = 'secondary'; // Default color

    switch (status) {
        case 'Completed':
            colorClass = 'success'; // Green
            break;
        case 'In Progress':
            colorClass = 'primary'; // Blue
            break;
        case 'Delayed':
            colorClass = 'danger'; // Red
            break;
        case 'Not Started':
            colorClass = 'warning'; // Yellow
            break;
    }

    return `<span class="badge bg-${colorClass}">${status}</span>`;
}
