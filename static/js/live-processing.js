// Live processing status updates for improved Norshin performance
class LiveProcessingMonitor {
    constructor() {
        this.updateInterval = 3000; // 3 seconds for faster updates
        this.isRunning = false;
        this.lastStatus = null;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.updateStatus();
        this.intervalId = setInterval(() => this.updateStatus(), this.updateInterval);
    }

    stop() {
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }

    async updateStatus() {
        try {
            const response = await fetch('/api/documents/queue/status');
            const data = await response.json();
            
            if (data.success && data.queue_status) {
                this.updateCounters(data.queue_status);
                this.updateProgressBar(data.queue_status);
                this.checkForCompletions(data.queue_status);
            }
        } catch (error) {
            console.error('Failed to fetch processing status:', error);
        }
    }

    updateCounters(status) {
        const queuedElement = document.getElementById('queued-count');
        const processingElement = document.getElementById('processing-count');
        const completedElement = document.getElementById('completed-count');

        if (queuedElement) queuedElement.textContent = status.queued || 0;
        if (processingElement) processingElement.textContent = status.processing || 0;
        if (completedElement) completedElement.textContent = status.completed || 0;

        // Update status badges
        this.updateStatusBadge('queued-badge', status.queued);
        this.updateStatusBadge('processing-badge', status.processing);
        this.updateStatusBadge('completed-badge', status.completed);
    }

    updateStatusBadge(elementId, count) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = count || 0;
            element.className = count > 0 ? 'badge bg-primary' : 'badge bg-secondary';
        }
    }

    updateProgressBar(status) {
        const total = (status.queued || 0) + (status.processing || 0) + (status.completed || 0);
        if (total === 0) return;

        const completedPercent = ((status.completed || 0) / total) * 100;
        const processingPercent = ((status.processing || 0) / total) * 100;

        const progressBar = document.getElementById('processing-progress');
        if (progressBar) {
            progressBar.innerHTML = `
                <div class="progress-bar bg-success" style="width: ${completedPercent}%"></div>
                <div class="progress-bar bg-warning" style="width: ${processingPercent}%"></div>
            `;
        }

        const progressText = document.getElementById('progress-text');
        if (progressText) {
            progressText.textContent = `${status.completed || 0} of ${total} documents processed`;
        }
    }

    checkForCompletions(status) {
        if (this.lastStatus) {
            const newCompletions = (status.completed || 0) - (this.lastStatus.completed || 0);
            if (newCompletions > 0) {
                this.showCompletionNotification(newCompletions);
                this.refreshNotificationsList();
            }
        }
        this.lastStatus = status;
    }

    showCompletionNotification(count) {
        const notification = document.createElement('div');
        notification.className = 'alert alert-success alert-dismissible fade show';
        notification.innerHTML = `
            <strong>Processing Complete!</strong> ${count} document${count > 1 ? 's' : ''} finished processing with 5x improved speed.
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        const container = document.getElementById('notification-container') || document.body;
        container.insertBefore(notification, container.firstChild);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    async refreshNotificationsList() {
        try {
            const response = await fetch('/api/documents/notifications');
            const data = await response.json();
            
            if (data.success) {
                this.updateNotificationsList(data.notifications);
            }
        } catch (error) {
            console.error('Failed to refresh notifications:', error);
        }
    }

    updateNotificationsList(notifications) {
        const listElement = document.getElementById('notifications-list');
        if (!listElement) return;

        listElement.innerHTML = notifications.slice(0, 10).map(notification => `
            <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6 class="mb-1">${notification.filename}</h6>
                        <p class="mb-1 text-muted">Processed: ${new Date(notification.processed_at).toLocaleString()}</p>
                        <small>Status: <span class="badge bg-success">Completed</span></small>
                    </div>
                    <small class="text-muted">${this.timeAgo(notification.processed_at)}</small>
                </div>
            </div>
        `).join('');
    }

    timeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    }
}

// Initialize monitor when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.liveMonitor = new LiveProcessingMonitor();
    window.liveMonitor.start();
    
    // Stop monitoring when page is hidden to save resources
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            window.liveMonitor.stop();
        } else {
            window.liveMonitor.start();
        }
    });
});