
document.addEventListener('DOMContentLoaded', function() {
    // Fetch purchase data
    fetch('/api/purchase')
        .then(response => response.json())
        .then(data => {
            updateDashboardMetrics(data);
            createCharts(data);
            populateTable(data.purchase_orders);
        });
});

function updateDashboardMetrics(data) {
    document.getElementById('openPOCount').textContent = data.metrics.open_pos;
    document.getElementById('totalValue').textContent = `$${data.metrics.total_value.toLocaleString()}`;
    document.getElementById('pendingDeliveries').textContent = data.metrics.pending_deliveries;
    document.getElementById('lateDeliveries').textContent = data.metrics.late_deliveries;
}

function createCharts(data) {
    // PO Status Chart
    const statusCtx = document.getElementById('poStatusChart').getContext('2d');
    new Chart(statusCtx, {
        type: 'pie',
        data: {
            labels: ['Open', 'In Transit', 'Delivered', 'Delayed'],
            datasets: [{
                data: data.metrics.status_distribution,
                backgroundColor: [
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(255, 99, 132, 0.8)'
                ]
            }]
        }
    });

    // Delivery Timeline Chart
    const timelineCtx = document.getElementById('deliveryTimelineChart').getContext('2d');
    new Chart(timelineCtx, {
        type: 'bar',
        data: {
            labels: data.timeline.dates,
            datasets: [{
                label: 'Expected Deliveries',
                data: data.timeline.quantities,
                backgroundColor: 'rgba(54, 162, 235, 0.5)'
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function populateTable(purchaseOrders) {
    const tableBody = document.getElementById('purchaseOrdersTable');
    tableBody.innerHTML = '';
    
    purchaseOrders.forEach(po => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${po.po_number}</td>
            <td>${po.material}</td>
            <td>${po.quantity}</td>
            <td>${po.delivery_date}</td>
            <td><span class="badge bg-${getStatusBadgeColor(po.status)}">${po.status}</span></td>
            <td>$${po.value.toLocaleString()}</td>
        `;
        tableBody.appendChild(row);
    });
}

function getStatusBadgeColor(status) {
    const colors = {
        'Open': 'primary',
        'In Transit': 'info',
        'Delivered': 'success',
        'Delayed': 'danger'
    };
    return colors[status] || 'secondary';
}
