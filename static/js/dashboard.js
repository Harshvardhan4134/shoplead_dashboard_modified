
document.addEventListener('DOMContentLoaded', function() {
    // Add script for helpers if not already added
    if (!document.querySelector('script[src*="helpers.js"]')) {
        const helperScript = document.createElement('script');
        helperScript.src = '/static/js/helpers.js';
        document.head.appendChild(helperScript);
    }

    let workCenterChart = null;
    let isLoading = false; // Prevent multiple requests

    // File upload handling
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const formData = new FormData();
            const fileInput = document.getElementById('sapdata'); 

            if (!fileInput.files.length) {
                if (typeof showAlert === 'function') {
                    showAlert('Please select a file first', 'warning');
                } else {
                    alert('❌ Please select a file first');
                }
                return;
            }

            formData.append('file', fileInput.files[0]);

            // Show loading indicator
            const uploadStatus = document.getElementById('uploadStatus');
            if (uploadStatus) uploadStatus.style.display = 'block';
            
            const uploadButton = document.getElementById('uploadButton');
            if (uploadButton) uploadButton.disabled = true;

            fetch('/upload', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (uploadStatus) uploadStatus.style.display = 'none';
                if (uploadButton) uploadButton.disabled = false;

                if (data.status === "success") {
                    if (typeof showAlert === 'function') {
                        showAlert('File uploaded and processed successfully!', 'success');
                    } else {
                        alert('✅ File uploaded and processed successfully!');
                    }
                    loadDashboardData(); // Refresh dashboard data after successful upload
                } else {
                    if (typeof showAlert === 'function') {
                        showAlert('Error: ' + (data.error || 'Upload failed'), 'danger');
                    } else {
                        alert('❌ Error: ' + (data.error || 'Upload failed'));
                    }
                }
            })
            .catch(error => {
                if (uploadStatus) uploadStatus.style.display = 'none';
                if (uploadButton) uploadButton.disabled = false;
                console.error('❌ Upload Error:', error);
                
                if (typeof showAlert === 'function') {
                    showAlert('Upload failed: ' + error.message, 'danger');
                } else {
                    alert('❌ Upload failed: ' + error.message);
                }
            });
        });
    }

    function loadDashboardData() {
        if (isLoading) return; // Prevent duplicate calls
        isLoading = true;

        const uploadStatus = document.getElementById('uploadStatus');
        if (uploadStatus) uploadStatus.style.display = 'block';

        Promise.all([
            fetch('/api/work_centers').then(res => res.json()),
            fetch('/api/jobs').then(res => res.json())
        ])
        .then(([workCenterData, jobsData]) => {
            console.log("🚀 Received work centers:", Object.keys(workCenterData).length);
            console.log("🚀 Received jobs:", jobsData.length);

            updateWorkCenterChart(workCenterData);
            updateEfficiencyMetrics(workCenterData);
            updateActiveJobs(jobsData);
            updateStatusCards(jobsData, workCenterData);
            updateUpcomingDeadlines(jobsData);
        })
        .finally(() => {
            if (uploadStatus) uploadStatus.style.display = 'none';
            isLoading = false; // Allow next request
            setTimeout(loadDashboardData, 300000); // Wait 5 minutes before calling again
        })
        .catch(error => {
            console.error('❌ Error loading dashboard data:', error);
            if (uploadStatus) uploadStatus.style.display = 'none';
            isLoading = false;
            
            if (typeof showAlert === 'function') {
                showAlert('Failed to load dashboard data. Please try refreshing the page.', 'danger');
            }
        });
    }

    function updateWorkCenterChart(data) {
        const chartElement = document.getElementById('workCenterChart');
        if (!chartElement) {
            console.error("Work center chart element not found");
            return;
        }
        
        const ctx = chartElement.getContext('2d');
        const labels = Object.keys(data);
        const availableWork = labels.map(wc => data[wc].available_work);
        const backlog = labels.map(wc => data[wc].backlog);

        if (workCenterChart) {
            workCenterChart.destroy();
        }

        workCenterChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Available Work',
                        data: availableWork,
                        backgroundColor: 'rgba(54, 162, 235, 0.5)'
                    },
                    {
                        label: 'Backlog',
                        data: backlog,
                        backgroundColor: 'rgba(255, 99, 132, 0.5)'
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    function updateStatusCards(jobs, workCenterData) {
        const activeJobsElement = document.getElementById('activeJobs');
        if (activeJobsElement) activeJobsElement.textContent = jobs.length;

        const today = new Date().toISOString().split('T')[0];
        const completedToday = jobs.reduce((count, job) => {
            return count + (job.work_orders || []).flatMap(wo =>
                (wo.operations || []).filter(op => op.status === 'Completed' && op.completed_at?.startsWith(today))
            ).length;
        }, 0);
        
        const completedTodayElement = document.getElementById('completedToday');
        if (completedTodayElement) completedTodayElement.textContent = completedToday;

        const overloadedCenters = Object.values(workCenterData).filter(
            data => (data.available_work + data.backlog) > 10
        ).length;
        
        const overloadedCentersElement = document.getElementById('overloadedCenters');
        if (overloadedCentersElement) overloadedCentersElement.textContent = overloadedCenters;

        const pendingJobs = jobs.reduce((count, job) => {
            return count + (job.work_orders || []).flatMap(wo =>
                (wo.operations || []).filter(op =>
                    op.status !== 'Completed' && op.due_date &&
                    new Date(op.due_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                )
            ).length;
        }, 0);
        
        const pendingJobsElement = document.getElementById('pendingJobs');
        if (pendingJobsElement) pendingJobsElement.textContent = pendingJobs;
    }

    function updateUpcomingDeadlines(jobs) {
        const tableBody = document.getElementById('upcomingDeadlinesTable');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
    
        const deadlines = jobs.flatMap(job => 
            (job.work_orders || []).flatMap(wo =>
                (wo.operations || []).map(op => ({
                    job_number: job.job_number,
                    work_order: wo.work_order_number,
                    due_date: op.completed_at || op.scheduled_date, // Use either completed_at or scheduled_date
                    status: op.status,
                    priority: getDueDatePriority(op.completed_at || op.scheduled_date)
                }))
            )
        ).filter(item => item.due_date) // Filter out items without dates
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    
        deadlines.slice(0, 10).forEach(item => {
            tableBody.innerHTML += `
                <tr>
                    <td>${item.job_number}</td>
                    <td>${item.work_order}</td>
                    <td>${new Date(item.due_date).toLocaleDateString()}</td>
                    <td><span class="badge bg-${item.status === 'Completed' ? 'success' : 'warning'}">${item.status}</span></td>
                    <td><span class="badge bg-${item.priority.color}">${item.priority.label}</span></td>
                </tr>
            `;
        });
    }
    
    function getDueDatePriority(date) {
        if (!date) return { label: 'Unknown', color: 'secondary' };
        
        const dueDate = new Date(date);
        const today = new Date();
        const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return { label: 'Overdue', color: 'danger' };
        if (diffDays <= 3) return { label: 'Critical', color: 'danger' };
        if (diffDays <= 7) return { label: 'High', color: 'warning' };
        return { label: 'Normal', color: 'success' };
    }
    


    function updateEfficiencyMetrics(data) {
        const metricsDiv = document.getElementById('efficiencyMetrics');
        if (!metricsDiv) {
            console.log("Efficiency metrics div not found");
            return;
        }
        
        metricsDiv.innerHTML = '';

        Object.entries(data).forEach(([workCenter, metrics]) => {
            const efficiency = parseInt(metrics.efficiency);
            const color = efficiency >= 80 ? 'success' : efficiency >= 60 ? 'warning' : 'danger';

            metricsDiv.innerHTML += `
                <div class="mb-3">
                    <label class="form-label">${workCenter}</label>
                    <div class="progress">
                        <div class="progress-bar bg-${color}"
                             role="progressbar"
                             style="width: ${efficiency}%"
                             aria-valuenow="${efficiency}"
                             aria-valuemin="0"
                             aria-valuemax="100">
                            ${efficiency}%
                        </div>
                    </div>
                </div>
            `;
        });
    }

    function updateActiveJobs(jobs) {
        const tableBody = document.getElementById('activeJobsTable');
        if (!tableBody) {
            console.error("Active jobs table not found");
            return;
        }
        
        tableBody.innerHTML = '';

        jobs.slice(0, 50).forEach(job => { // Only process 50 jobs
            (job.work_orders || []).forEach(wo => {
                (wo.operations || []).forEach(op => {
                    const progress = op.planned_hours ? (op.actual_hours / op.planned_hours) * 100 : 0;
                    tableBody.innerHTML += `
                        <tr>
                            <td>${job.job_number}</td>
                            <td>${wo.work_order_number}</td>
                            <td>${op.operation_number}</td>
                            <td>${op.work_center}</td>
                            <td><span class="badge bg-${op.status === 'Completed' ? 'success' : 'warning'}">${op.status}</span></td>
                            <td>
                                <div class="progress">
                                    <div class="progress-bar" role="progressbar"
                                         style="width: ${progress}%"
                                         aria-valuenow="${progress}"
                                         aria-valuemin="0"
                                         aria-valuemax="100">
                                        ${Math.round(progress)}%
                                    </div>
                                </div>
                            </td>
                        </tr>
                    `;
                });
            });
        });
    }

    // Add chat overlay
    function addChatOverlay() {
        // Check if overlay already exists
        if (document.getElementById('chatOverlay')) return;
        
        const overlay = document.createElement('div');
        overlay.id = 'chatOverlay';
        overlay.className = 'chat-overlay';
        overlay.innerHTML = `
            <div class="chat-header">
                <h5>Support Chat</h5>
                <button type="button" class="btn-close" onclick="toggleChatOverlay()"></button>
            </div>
            <div class="chat-body" id="chatMessages">
                <div class="system-message">Welcome to the support chat. How can we help you today?</div>
            </div>
            <div class="chat-footer">
                <input type="text" class="form-control" id="chatInput" placeholder="Type your message...">
                <button class="btn btn-primary" onclick="sendChatMessage()">Send</button>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .chat-overlay {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 350px;
                height: 450px;
                background: white;
                border-radius: 10px;
                box-shadow: 0 0 10px rgba(0,0,0,0.2);
                display: flex;
                flex-direction: column;
                z-index: 1050;
                display: none;
            }
            .chat-overlay.active {
                display: flex;
            }
            .chat-header {
                padding: 10px 15px;
                background: #f8f9fa;
                border-radius: 10px 10px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .chat-body {
                flex: 1;
                padding: 15px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .chat-footer {
                padding: 10px 15px;
                display: flex;
                gap: 10px;
            }
            .system-message {
                background: #f8f9fa;
                padding: 10px;
                border-radius: 10px;
                align-self: flex-start;
                max-width: 80%;
            }
            .user-message {
                background: #007bff;
                color: white;
                padding: 10px;
                border-radius: 10px;
                align-self: flex-end;
                max-width: 80%;
            }
            .chat-toggle {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: #007bff;
                color: white;
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 24px;
                cursor: pointer;
                box-shadow: 0 0 10px rgba(0,0,0,0.2);
                z-index: 1049;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(overlay);
        
        // Add chat toggle button
        const toggleButton = document.createElement('div');
        toggleButton.className = 'chat-toggle';
        toggleButton.innerHTML = '<i class="fas fa-comments"></i>';
        toggleButton.onclick = function() {
            toggleChatOverlay();
        };
        
        document.body.appendChild(toggleButton);
        
        // Add chat functions to window scope
        window.toggleChatOverlay = function() {
            const overlay = document.getElementById('chatOverlay');
            overlay.classList.toggle('active');
        };
        
        window.sendChatMessage = function() {
            const input = document.getElementById('chatInput');
            const message = input.value.trim();
            
            if (!message) return;
            
            const chatMessages = document.getElementById('chatMessages');
            const userMessage = document.createElement('div');
            userMessage.className = 'user-message';
            userMessage.textContent = message;
            chatMessages.appendChild(userMessage);
            
            // Clear input
            input.value = '';
            
            // Simulate response (in a real app, this would call an API)
            setTimeout(() => {
                const systemMessage = document.createElement('div');
                systemMessage.className = 'system-message';
                systemMessage.textContent = 'Thank you for your message. Our team will get back to you soon.';
                chatMessages.appendChild(systemMessage);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 1000);
            
            chatMessages.scrollTop = chatMessages.scrollHeight;
        };
        
        // Allow pressing Enter to send
        document.getElementById('chatInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                window.sendChatMessage();
            }
        });
    }
    
    // Add edit overlay
    function addEditOverlay() {
        // Check if overlay already exists
        if (document.getElementById('editOverlay')) return;
        
        const overlay = document.createElement('div');
        overlay.id = 'editOverlay';
        overlay.className = 'edit-overlay';
        overlay.innerHTML = `
            <div class="edit-header">
                <h5>Edit Item</h5>
                <button type="button" class="btn-close" onclick="toggleEditOverlay()"></button>
            </div>
            <div class="edit-body">
                <form id="editForm">
                    <div class="mb-3">
                        <label for="editItemId" class="form-label">Item ID</label>
                        <input type="text" class="form-control" id="editItemId" readonly>
                    </div>
                    <div class="mb-3">
                        <label for="editItemName" class="form-label">Name</label>
                        <input type="text" class="form-control" id="editItemName">
                    </div>
                    <div class="mb-3">
                        <label for="editItemStatus" class="form-label">Status</label>
                        <select class="form-select" id="editItemStatus">
                            <option value="Planned">Planned</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="Delayed">Delayed</option>
                            <option value="On Hold">On Hold</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label for="editItemNotes" class="form-label">Notes</label>
                        <textarea class="form-control" id="editItemNotes" rows="3"></textarea>
                    </div>
                    <button type="button" class="btn btn-primary" onclick="saveEditedItem()">Save Changes</button>
                </form>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .edit-overlay {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 500px;
                background: white;
                border-radius: 10px;
                box-shadow: 0 0 10px rgba(0,0,0,0.2);
                display: none;
                z-index: 1060;
            }
            .edit-overlay.active {
                display: block;
            }
            .edit-header {
                padding: 15px 20px;
                background: #f8f9fa;
                border-radius: 10px 10px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .edit-body {
                padding: 20px;
            }
            .edit-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 1050;
                display: none;
            }
            .edit-backdrop.active {
                display: block;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(overlay);
        
        // Add backdrop
        const backdrop = document.createElement('div');
        backdrop.id = 'editBackdrop';
        backdrop.className = 'edit-backdrop';
        document.body.appendChild(backdrop);
        
        // Add edit functions to window scope
        window.toggleEditOverlay = function() {
            const overlay = document.getElementById('editOverlay');
            const backdrop = document.getElementById('editBackdrop');
            overlay.classList.toggle('active');
            backdrop.classList.toggle('active');
        };
        
        window.openEditForm = function(id, name, status, notes) {
            document.getElementById('editItemId').value = id;
            document.getElementById('editItemName').value = name;
            document.getElementById('editItemStatus').value = status;
            document.getElementById('editItemNotes').value = notes || '';
            
            toggleEditOverlay();
        };
        
        window.saveEditedItem = function() {
            const id = document.getElementById('editItemId').value;
            const name = document.getElementById('editItemName').value;
            const status = document.getElementById('editItemStatus').value;
            const notes = document.getElementById('editItemNotes').value;
            
            console.log('Saving edited item:', { id, name, status, notes });
            
            // In a real app, this would call an API
            if (typeof showAlert === 'function') {
                showAlert('Changes saved successfully', 'success');
            }
            
            toggleEditOverlay();
        };
    }
    
    // Add Font Awesome if not already added
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fontAwesome = document.createElement('link');
        fontAwesome.rel = 'stylesheet';
        fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
        document.head.appendChild(fontAwesome);
    }
    
    // Add overlays
    addChatOverlay();
    addEditOverlay();

    // Initial load
    loadDashboardData();
});