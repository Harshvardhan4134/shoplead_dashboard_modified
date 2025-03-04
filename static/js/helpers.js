// Common utility functions for the dashboard

function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    const container = document.querySelector('.container');
    container.insertBefore(alertDiv, container.firstChild);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function calculateEfficiency(planned, actual) {
    if (planned === 0) return 0;
    return Math.min(100, (actual / planned) * 100);
}

function getStatusColor(status) {
    const colors = {
        'Not Started': 'secondary',
        'In Progress': 'primary',
        'Completed': 'success',
        'Delayed': 'danger',
        'On Hold': 'warning'
    };
    return colors[status] || 'secondary';
}

function getPriorityLabel(dueDate) {
    const today = new Date();
    const due = new Date(dueDate);
    const daysUntilDue = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) return 'Critical';
    if (daysUntilDue <= 7) return 'High';
    if (daysUntilDue <= 14) return 'Medium';
    return 'Low';
}

function createProgressBar(percentage) {
    const color = percentage >= 100 ? 'success' : 
                 percentage >= 75 ? 'info' :
                 percentage >= 50 ? 'warning' : 'danger';
    
    return `
        <div class="progress">
            <div class="progress-bar bg-${color}" 
                 role="progressbar" 
                 style="width: ${Math.min(100, percentage)}%" 
                 aria-valuenow="${percentage}" 
                 aria-valuemin="0" 
                 aria-valuemax="100">
                ${percentage.toFixed(0)}%
            </div>
        </div>
    `;
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showAlert,
        formatDate,
        calculateEfficiency,
        getStatusColor,
        getPriorityLabel,
        createProgressBar
    };
}
function showAlert(message, type = 'info', duration = 3000) {
    const alertContainer = document.getElementById('alertContainer') || createAlertContainer();
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    alertContainer.appendChild(alertDiv);
    
    // Auto dismiss
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 300);
    }, duration);
}

function createAlertContainer() {
    const container = document.createElement('div');
    container.id = 'alertContainer';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '1050';
    container.style.maxWidth = '350px';
    document.body.appendChild(container);
    return container;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function calculateEfficiency(actual, planned) {
    if (!planned || planned === 0) return 0;
    return Math.min(100, Math.round((actual / planned) * 100));
}

function getStatusColor(status) {
    const statusMap = {
        'Completed': 'success',
        'In Progress': 'primary',
        'Planned': 'info',
        'Delayed': 'warning',
        'On Hold': 'secondary',
        'Critical': 'danger'
    };
    return statusMap[status] || 'secondary';
}

function getPriorityLabel(dueDate) {
    if (!dueDate) return { text: 'No Due Date', class: 'secondary' };
    
    const today = new Date();
    const due = new Date(dueDate);
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: 'Overdue', class: 'danger' };
    if (diffDays <= 3) return { text: 'High', class: 'danger' };
    if (diffDays <= 7) return { text: 'Medium', class: 'warning' };
    return { text: 'Low', class: 'success' };
}

function createProgressBar(percentage) {
    const color = percentage >= 100 ? 'success' : 
                 percentage >= 75 ? 'info' :
                 percentage >= 50 ? 'warning' : 'danger';
    
    return `
        <div class="progress">
            <div class="progress-bar bg-${color}" 
                 role="progressbar" 
                 style="width: ${Math.min(100, percentage)}%" 
                 aria-valuenow="${percentage}" 
                 aria-valuemin="0" 
                 aria-valuemax="100">
                ${percentage.toFixed(0)}%
            </div>
        </div>
    `;
}
