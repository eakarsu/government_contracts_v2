/**
 * Main JavaScript file for Government Contract Indexer
 * Handles common functionality, utilities, and user interactions
 */

// Global utilities and state management
window.ContractIndexer = {
    // Configuration
    config: {
        apiBaseUrl: '/api',
        refreshInterval: 30000, // 30 seconds
        maxRetries: 3,
        retryDelay: 1000 // 1 second
    },
    
    // State management
    state: {
        currentUser: null,
        notifications: [],
        activeRequests: new Map()
    },
    
    // Utility functions
    utils: {},
    
    // API client
    api: {},
    
    // UI components
    ui: {},
    
    // Initialize the application
    init: function() {
        console.log('Initializing Contract Indexer...');
        
        // Initialize components
        this.ui.init();
        this.api.init();
        this.utils.init();
        
        // Set up global event listeners
        this.setupGlobalEventListeners();
        
        // Initialize page-specific functionality
        this.initPageSpecific();
        
        console.log('Contract Indexer initialized successfully');
    }
};

// Utility functions
ContractIndexer.utils = {
    init: function() {
        // Initialize utilities
        this.setupErrorHandling();
        this.setupLocalStorage();
    },
    
    // Format dates consistently
    formatDate: function(dateString, options = {}) {
        if (!dateString) return 'N/A';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            ...options
        };
        
        return date.toLocaleDateString('en-US', defaultOptions);
    },
    
    // Format date and time
    formatDateTime: function(dateString) {
        return this.formatDate(dateString, {
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    // Format numbers with commas
    formatNumber: function(num) {
        if (num === null || num === undefined) return 'N/A';
        return parseInt(num).toLocaleString();
    },
    
    // Format file sizes
    formatFileSize: function(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    },
    
    // Debounce function calls
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Throttle function calls
    throttle: function(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // Generate unique IDs
    generateId: function() {
        return 'id_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    },
    
    // Escape HTML to prevent XSS
    escapeHtml: function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    // Truncate text with ellipsis
    truncateText: function(text, maxLength = 100) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },
    
    // Copy text to clipboard
    copyToClipboard: async function(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Copied to clipboard', 'success');
            return true;
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            this.showToast('Failed to copy to clipboard', 'error');
            return false;
        }
    },
    
    // Show toast notification
    showToast: function(message, type = 'info', duration = 3000) {
        const toastContainer = this.getOrCreateToastContainer();
        const toast = this.createToastElement(message, type);
        
        toastContainer.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    },
    
    // Get or create toast container
    getOrCreateToastContainer: function() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container position-fixed top-0 end-0 p-3';
            container.style.zIndex = '9999';
            document.body.appendChild(container);
        }
        return container;
    },
    
    // Create toast element
    createToastElement: function(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'primary'} border-0`;
        toast.setAttribute('role', 'alert');
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${this.escapeHtml(message)}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.parentElement.parentElement.remove()"></button>
            </div>
        `;
        
        return toast;
    },
    
    // Set up global error handling
    setupErrorHandling: function() {
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.showToast('An unexpected error occurred', 'error');
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.showToast('An unexpected error occurred', 'error');
        });
    },
    
    // Set up localStorage helpers
    setupLocalStorage: function() {
        this.storage = {
            get: (key, defaultValue = null) => {
                try {
                    const item = localStorage.getItem(key);
                    return item ? JSON.parse(item) : defaultValue;
                } catch (e) {
                    console.error('Error reading from localStorage:', e);
                    return defaultValue;
                }
            },
            
            set: (key, value) => {
                try {
                    localStorage.setItem(key, JSON.stringify(value));
                    return true;
                } catch (e) {
                    console.error('Error writing to localStorage:', e);
                    return false;
                }
            },
            
            remove: (key) => {
                try {
                    localStorage.removeItem(key);
                    return true;
                } catch (e) {
                    console.error('Error removing from localStorage:', e);
                    return false;
                }
            }
        };
    }
};

// API client
ContractIndexer.api = {
    init: function() {
        this.baseUrl = ContractIndexer.config.apiBaseUrl;
    },
    
    // Generic request handler with retry logic
    request: async function(url, options = {}) {
        const requestId = ContractIndexer.utils.generateId();
        const fullUrl = url.startsWith('http') ? url : this.baseUrl + url;
        
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Request-ID': requestId
            },
            ...options
        };
        
        // Track active request
        ContractIndexer.state.activeRequests.set(requestId, {
            url: fullUrl,
            startTime: Date.now(),
            options: defaultOptions
        });
        
        let lastError;
        
        for (let attempt = 1; attempt <= ContractIndexer.config.maxRetries; attempt++) {
            try {
                const response = await fetch(fullUrl, defaultOptions);
                
                // Remove from active requests
                ContractIndexer.state.activeRequests.delete(requestId);
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                return data;
                
            } catch (error) {
                lastError = error;
                console.error(`Request attempt ${attempt} failed:`, error);
                
                // Don't retry on certain errors
                if (error.message.includes('400') || error.message.includes('401') || error.message.includes('403') || error.message.includes('404')) {
                    break;
                }
                
                // Wait before retry (except last attempt)
                if (attempt < ContractIndexer.config.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, ContractIndexer.config.retryDelay * attempt));
                }
            }
        }
        
        // Remove from active requests
        ContractIndexer.state.activeRequests.delete(requestId);
        
        throw lastError;
    },
    
    // Specific API methods
    getStatus: function() {
        return this.request('/status');
    },
    
    fetchContracts: function(params = {}) {
        return this.request('/contracts/fetch', {
            method: 'POST',
            body: JSON.stringify(params)
        });
    },
    
    indexContracts: function(params = {}) {
        return this.request('/contracts/index', {
            method: 'POST',
            body: JSON.stringify(params)
        });
    },
    
    processDocuments: function(params = {}) {
        return this.request('/documents/process', {
            method: 'POST',
            body: JSON.stringify(params)
        });
    },
    
    searchContracts: function(query, options = {}) {
        return this.request('/search', {
            method: 'POST',
            body: JSON.stringify({
                query,
                ...options
            })
        });
    },
    
    analyzeContract: function(noticeId) {
        return this.request(`/contracts/${noticeId}/analyze`, {
            method: 'POST'
        });
    },
    
    getRecommendations: function(criteria) {
        return this.request('/recommendations', {
            method: 'POST',
            body: JSON.stringify(criteria)
        });
    },
    
    getJobStatus: function(jobId) {
        return this.request(`/jobs/${jobId}`);
    }
};

// UI components and helpers
ContractIndexer.ui = {
    init: function() {
        this.setupCommonComponents();
        this.setupKeyboardShortcuts();
    },
    
    // Set up common UI components
    setupCommonComponents: function() {
        // Initialize tooltips
        this.initTooltips();
        
        // Initialize modals
        this.initModals();
        
        // Set up loading states
        this.setupLoadingStates();
    },
    
    // Initialize Bootstrap tooltips
    initTooltips: function() {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    },
    
    // Initialize modals
    initModals: function() {
        // Store modal instances for later use
        this.modals = {};
        const modalElements = document.querySelectorAll('.modal');
        modalElements.forEach(modalEl => {
            const modalId = modalEl.id;
            if (modalId) {
                this.modals[modalId] = new bootstrap.Modal(modalEl);
            }
        });
    },
    
    // Set up loading states for buttons and forms
    setupLoadingStates: function() {
        this.loadingStates = new Map();
    },
    
    // Show loading state on element
    showLoading: function(element, text = 'Loading...') {
        if (typeof element === 'string') {
            element = document.getElementById(element) || document.querySelector(element);
        }
        
        if (!element) return;
        
        // Store original content
        const originalContent = element.innerHTML;
        this.loadingStates.set(element, originalContent);
        
        // Show loading
        element.disabled = true;
        element.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            ${text}
        `;
    },
    
    // Hide loading state
    hideLoading: function(element) {
        if (typeof element === 'string') {
            element = document.getElementById(element) || document.querySelector(element);
        }
        
        if (!element) return;
        
        // Restore original content
        const originalContent = this.loadingStates.get(element);
        if (originalContent) {
            element.innerHTML = originalContent;
            element.disabled = false;
            this.loadingStates.delete(element);
        }
    },
    
    // Create and show a confirmation dialog
    showConfirmDialog: function(title, message, onConfirm, onCancel = null) {
        const modalHtml = `
            <div class="modal fade" id="confirmModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${ContractIndexer.utils.escapeHtml(title)}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>${ContractIndexer.utils.escapeHtml(message)}</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="confirmButton">Confirm</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal
        const existingModal = document.getElementById('confirmModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add new modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
        
        // Set up event listeners
        document.getElementById('confirmButton').addEventListener('click', function() {
            modal.hide();
            if (onConfirm) onConfirm();
        });
        
        document.getElementById('confirmModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
            if (onCancel) onCancel();
        });
        
        modal.show();
    },
    
    // Set up keyboard shortcuts
    setupKeyboardShortcuts: function() {
        document.addEventListener('keydown', (event) => {
            // Ctrl/Cmd + K for search
            if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
                event.preventDefault();
                const searchInput = document.querySelector('#search-query, input[type="search"]');
                if (searchInput) {
                    searchInput.focus();
                }
            }
            
            // Escape to close modals
            if (event.key === 'Escape') {
                const openModals = document.querySelectorAll('.modal.show');
                openModals.forEach(modal => {
                    const modalInstance = bootstrap.Modal.getInstance(modal);
                    if (modalInstance) {
                        modalInstance.hide();
                    }
                });
            }
        });
    },
    
    // Update page title with notification count
    updatePageTitle: function(count = 0) {
        const baseTitle = 'Government Contract Indexer';
        document.title = count > 0 ? `(${count}) ${baseTitle}` : baseTitle;
    },
    
    // Animate element
    animateElement: function(element, animation = 'fadeIn', duration = 300) {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        
        if (!element) return;
        
        element.style.animation = `${animation} ${duration}ms ease-in-out`;
        
        setTimeout(() => {
            element.style.animation = '';
        }, duration);
    }
};

// Page-specific initialization
ContractIndexer.initPageSpecific = function() {
    const path = window.location.pathname;
    
    if (path === '/' || path === '/index') {
        this.initDashboard();
    } else if (path === '/search') {
        this.initSearch();
    } else if (path.startsWith('/contracts')) {
        this.initContracts();
    } else if (path === '/jobs') {
        this.initJobs();
    }
};

// Dashboard-specific initialization
ContractIndexer.initDashboard = function() {
    // Auto-refresh dashboard stats
    const refreshStats = async () => {
        try {
            const status = await this.api.getStatus();
            this.updateDashboardStats(status);
        } catch (error) {
            console.error('Failed to refresh dashboard stats:', error);
        }
    };
    
    // Refresh every 30 seconds
    setInterval(refreshStats, this.config.refreshInterval);
};

// Search-specific initialization
ContractIndexer.initSearch = function() {
    // Set up search suggestions
    const searchInput = document.getElementById('search-query');
    if (searchInput) {
        // Save search history
        searchInput.addEventListener('change', () => {
            const query = searchInput.value.trim();
            if (query) {
                this.saveSearchHistory(query);
            }
        });
        
        // Set up search suggestions
        this.setupSearchSuggestions(searchInput);
    }
};

// Contracts-specific initialization
ContractIndexer.initContracts = function() {
    // Set up infinite scroll for contract lists
    this.setupInfiniteScroll();
};

// Jobs-specific initialization
ContractIndexer.initJobs = function() {
    // Auto-refresh job statuses
    const refreshJobs = () => {
        // Refresh job status indicators
        const jobElements = document.querySelectorAll('[data-job-id]');
        jobElements.forEach(async (element) => {
            const jobId = element.dataset.jobId;
            try {
                const job = await this.api.getJobStatus(jobId);
                this.updateJobStatus(element, job);
            } catch (error) {
                console.error(`Failed to refresh job ${jobId}:`, error);
            }
        });
    };
    
    // Refresh every 10 seconds for jobs page
    setInterval(refreshJobs, 10000);
};

// Helper methods for specific pages
ContractIndexer.updateDashboardStats = function(status) {
    // Update stats if elements exist
    const statsElements = {
        'contracts-count': status.database_stats?.contracts_in_db,
        'indexed-contracts-count': status.database_stats?.contracts_indexed,
        'indexed-documents-count': status.database_stats?.documents_indexed
    };
    
    Object.entries(statsElements).forEach(([elementId, value]) => {
        const element = document.getElementById(elementId);
        if (element && value !== undefined) {
            element.textContent = ContractIndexer.utils.formatNumber(value);
        }
    });
};

ContractIndexer.saveSearchHistory = function(query) {
    const history = this.utils.storage.get('searchHistory', []);
    
    // Remove duplicates and add to front
    const filteredHistory = history.filter(item => item !== query);
    filteredHistory.unshift(query);
    
    // Keep only last 10 searches
    const newHistory = filteredHistory.slice(0, 10);
    
    this.utils.storage.set('searchHistory', newHistory);
};

ContractIndexer.setupSearchSuggestions = function(input) {
    const history = this.utils.storage.get('searchHistory', []);
    
    if (history.length === 0) return;
    
    // Create datalist for suggestions
    const datalist = document.createElement('datalist');
    datalist.id = 'search-suggestions';
    
    history.forEach(query => {
        const option = document.createElement('option');
        option.value = query;
        datalist.appendChild(option);
    });
    
    document.body.appendChild(datalist);
    input.setAttribute('list', 'search-suggestions');
};

ContractIndexer.setupInfiniteScroll = function() {
    // Implementation for infinite scroll on contract lists
    let loading = false;
    let page = 1;
    
    window.addEventListener('scroll', ContractIndexer.utils.throttle(() => {
        if (loading) return;
        
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        
        if (scrollTop + clientHeight >= scrollHeight - 1000) { // 1000px from bottom
            loading = true;
            // Load more contracts
            // This would integrate with pagination in the templates
            setTimeout(() => { loading = false; }, 1000); // Reset after 1 second
        }
    }, 100));
};

ContractIndexer.updateJobStatus = function(element, job) {
    const statusBadge = element.querySelector('.job-status');
    if (statusBadge) {
        statusBadge.textContent = job.status;
        statusBadge.className = `badge bg-${job.status === 'completed' ? 'success' : job.status === 'failed' ? 'danger' : job.status === 'running' ? 'primary' : 'secondary'}`;
    }
    
    const recordsCount = element.querySelector('.records-count');
    if (recordsCount && job.records_processed !== undefined) {
        recordsCount.textContent = ContractIndexer.utils.formatNumber(job.records_processed);
    }
};

// Set up global event listeners
ContractIndexer.setupGlobalEventListeners = function() {
    // Handle network status
    window.addEventListener('online', () => {
        this.utils.showToast('Connection restored', 'success');
    });
    
    window.addEventListener('offline', () => {
        this.utils.showToast('Connection lost. Some features may not work.', 'warning', 5000);
    });
    
    // Handle before page unload
    window.addEventListener('beforeunload', (event) => {
        if (this.state.activeRequests.size > 0) {
            event.preventDefault();
            event.returnValue = 'You have active requests. Are you sure you want to leave?';
        }
    });
    
    // Handle clicks on external links
    document.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (link && link.hostname !== window.location.hostname) {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        }
    });
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        ContractIndexer.init();
    });
} else {
    ContractIndexer.init();
}

// Export for use in other scripts
window.ContractIndexer = ContractIndexer;
