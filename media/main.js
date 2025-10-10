(function() {
    // Get the VS Code API
    const vscode = acquireVsCodeApi();

    // State management
    let currentState = {
        awsStatus: { connected: false, status: 'disconnected' },
        estimationData: null,
        jiraValidation: null,
        settings: {},
        parsedEstimation: null,
        allEpics: [], // Store all epics for filtering
        pagination: null, // Store pagination state
        currentTaskList: [], // Store current task list
        editingTask: null // Store currently editing task data
    };

    // Unit conversion function
    function convertToHours(value, unit) {
        if (!value || value <= 0) return 0;
        
        switch (unit) {
            case 'hours':
                return value;
            case 'days':
                return value * 8; // 8 hours per day
            case 'weeks':
                return value * 40; // 40 hours per week (5 days × 8 hours)
            case 'months':
                return value * 160; // 160 hours per month (4 weeks × 40 hours)
            default:
                return value; // Default to hours if unknown unit
        }
    }

    // Initialize the webview
    function initialize() {
        setupTabs();
        setupEventListeners();
        initializeUIState();
        loadInitialData();
    }

    // Initialize UI state to prevent glitches
    function initializeUIState() {
        // Initialize secret validation to disconnected state
        updateSecretValidationForDisconnected();
        // Initialize feedback form state
        updateFeedbackFormState();
    }

    // Tab functionality
    function setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');
                
                // Remove active class from all tabs and contents
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                button.classList.add('active');
                document.getElementById(targetTab).classList.add('active');
            });
        });
    }

    // Setup all event listeners
    function setupEventListeners() {
        // AWS Configuration Tab
        setupAWSEventListeners();
        
        // DEVSECOPS Hub Tab
        setupHubEventListeners();
        
        // Task List functionality
        setupTaskListEventListeners();
        
        // Features Tab
        setupFeedbackEventListeners();
        
        // Estimation Notification
        setupNotificationEventListeners();
    }

    function setupAWSEventListeners() {
        const connectBtn = document.getElementById('connect-aws-btn');
        const refreshBtn = document.getElementById('refresh-aws-btn');

        connectBtn.addEventListener('click', () => {
            updateAWSStatus({ status: 'connecting' });
            showLoadingSteps([
                'Loading AWS CLI credentials...',
                'Testing Secrets Manager access...',
                'Fetching Salesforce credentials...'
            ]);
            vscode.postMessage({ command: 'connectAWS' });
        });

        refreshBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'refreshAWSConnection' });
            vscode.postMessage({ command: 'getEnhancedAWSStatus' });
        });
    }

    function setupHubEventListeners() {
        const updateJiraBtn = document.getElementById('update-jira-btn');
        const jiraIdInput = document.getElementById('jira-issue-id');
        const estimationValueInput = document.getElementById('estimation-value');
        const estimationUnitSelect = document.getElementById('estimation-unit');

        jiraIdInput.addEventListener('input', () => {
            updatePrerequisites();
        });

        // Add estimation input handlers
        estimationValueInput?.addEventListener('input', () => {
            updatePrerequisites();
        });

        estimationUnitSelect?.addEventListener('change', () => {
            updatePrerequisites();
        });

        updateJiraBtn.addEventListener('click', () => {
            const jiraId = jiraIdInput.value.trim();
            const estimationValue = parseFloat(estimationValueInput?.value || '0');
            const estimationUnit = estimationUnitSelect?.value || 'hours';

            if (!jiraId) {
                showJiraUpdateResult({
                    success: false,
                    message: 'Please enter a DEVSECOPS ticket ID'
                });
                return;
            }

            // Convert estimation to hours
            const estimationInHours = convertToHours(estimationValue, estimationUnit);

            // Show loading state
            updateJiraBtn.disabled = true;
            updateJiraBtn.textContent = '🔄 Updating...';

            vscode.postMessage({ 
                command: 'updateJiraIssue', 
                data: {
                    jiraId,
                    additionalNotes: '',
                    updateOriginalEstimate: true,
                    addEstimationComment: true,
                    estimationData: currentState.estimationData,
                    manualHours: estimationInHours > 0 ? estimationInHours : undefined
                }
            });
        });
    }

    function setupTaskListEventListeners() {
        // Task navigation buttons
        const retrieveWipBtn = document.getElementById('retrieve-wip-btn');
        const runningTasksBtn = document.getElementById('running-tasks-btn');

        retrieveWipBtn?.addEventListener('click', () => {
            console.log('WIP tasks button clicked');
            setActiveTaskTab('wip');
            showSearchContainer(); // Enable search for WIP tasks too
            loadWipTasks();
        });

        runningTasksBtn?.addEventListener('click', () => {
            console.log('Running tasks button clicked');
            setActiveTaskTab('running');
            showSearchContainer();
            loadRunningTasks();
        });

        // Search functionality
        const searchInput = document.getElementById('task-search-input');
        const searchBtn = document.getElementById('task-search-btn');
        const clearSearchBtn = document.getElementById('task-clear-search-btn');

        searchBtn?.addEventListener('click', () => {
            const searchTerm = searchInput?.value.trim();
            if (searchTerm) {
                performSearch(searchTerm);
            } else {
                const activeTab = getActiveTaskTab();
                if (activeTab === 'wip') {
                    loadWipTasks();
                } else {
                    loadRunningTasks();
                }
            }
        });

        clearSearchBtn?.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            clearSearchBtn.style.display = 'none';
            const activeTab = getActiveTaskTab();
            if (activeTab === 'wip') {
                loadWipTasks();
            } else {
                loadRunningTasks();
            }
        });

        searchInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchBtn?.click();
            }
        });

        searchInput?.addEventListener('input', () => {
            const hasValue = searchInput.value.trim().length > 0;
            if (clearSearchBtn) {
                clearSearchBtn.style.display = hasValue ? 'inline-block' : 'none';
            }
        });

        // Pagination controls
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');

        prevBtn?.addEventListener('click', () => {
            if (currentState.pagination && currentState.pagination.currentOffset > 0) {
                const newOffset = Math.max(0, currentState.pagination.currentOffset - currentState.pagination.currentLimit);
                const activeTab = getActiveTaskTab();
                if (activeTab === 'wip') {
                    loadWipTasks(newOffset, currentState.pagination.searchTerm);
                } else {
                    loadRunningTasks(newOffset, currentState.pagination.searchTerm);
                }
            }
        });

        nextBtn?.addEventListener('click', () => {
            if (currentState.pagination && currentState.pagination.hasMore) {
                const newOffset = currentState.pagination.currentOffset + currentState.pagination.currentLimit;
                const activeTab = getActiveTaskTab();
                if (activeTab === 'wip') {
                    loadWipTasks(newOffset, currentState.pagination.searchTerm);
                } else {
                    loadRunningTasks(newOffset, currentState.pagination.searchTerm);
                }
            }
        });

        // Task edit modal
        setupTaskEditModal();

        // Don't auto-load tasks - let user click when ready
    }

    function setupFeedbackEventListeners() {
        const submitFeedbackBtn = document.getElementById('submit-feedback-btn');
        const loadDataBtn = document.getElementById('load-data-btn');
        const feedbackTypeSelect = document.getElementById('feedback-type');
        const acceptanceCriteriaGroup = document.getElementById('acceptance-criteria-group');

        // Handle feedback type change to show/hide acceptance criteria
        feedbackTypeSelect.addEventListener('change', () => {
            if (feedbackTypeSelect.value === 'Story') {
                acceptanceCriteriaGroup.style.display = 'block';
                document.getElementById('acceptance-criteria').required = true;
            } else {
                acceptanceCriteriaGroup.style.display = 'none';
                document.getElementById('acceptance-criteria').required = false;
                document.getElementById('acceptance-criteria').value = '';
            }
        });

        // Handle initiative change - just reset epic selection since all epics are already loaded
        const initiativeSelect = document.getElementById('initiative');
        initiativeSelect.addEventListener('change', () => {
            const epicSelect = document.getElementById('epic');
            epicSelect.value = ''; // Reset epic selection when initiative changes
        });

        // Handle form submission
        submitFeedbackBtn.addEventListener('click', () => {
            // Check AWS connection first
            if (!canSubmitFeedback()) {
                showFeedbackResult({
                    success: false,
                    message: 'AWS connection is required to submit features. Please connect to AWS first.',
                    error: 'AWS connection required'
                });
                return;
            }

            const feedbackData = {
                name: document.getElementById('feedback-name').value,
                feedbackType: document.getElementById('feedback-type').value,
                estimatedHours: parseFloat(document.getElementById('estimated-hours').value),
                initiativeId: document.getElementById('initiative').value,
                epicId: document.getElementById('epic').value,
                description: document.getElementById('feedback-description').value,
                acceptanceCriteria: document.getElementById('acceptance-criteria').value
            };

            // Basic validation
            if (!feedbackData.name || !feedbackData.feedbackType || !feedbackData.estimatedHours || 
                !feedbackData.initiativeId || !feedbackData.epicId || !feedbackData.description) {
                showFeedbackResult({
                    success: false,
                    message: 'Please fill in all required fields',
                    error: 'Validation failed'
                });
                return;
            }

            if (feedbackData.feedbackType === 'Story' && !feedbackData.acceptanceCriteria) {
                showFeedbackResult({
                    success: false,
                    message: 'Acceptance criteria is required for Story type',
                    error: 'Validation failed'
                });
                return;
            }

            vscode.postMessage({ 
                command: 'submitFeedback', 
                data: feedbackData 
            });
        });

        // Handle refresh dropdowns
        loadDataBtn.addEventListener('click', () => {
            loadFeedbackDropdowns();
        });
    }

    function loadFeedbackDropdowns() {
        // Check if AWS is connected before loading dropdowns
        if (!currentState.awsStatus || currentState.awsStatus.status !== 'connected') {
            console.log('AWS not connected, skipping feedback dropdown loading');
            populateInitiativesDropdown([]);
            populateEpicsDropdown([]);
            return;
        }

        // Load both initiatives and epics
        vscode.postMessage({ command: 'loadInitiatives' });
        vscode.postMessage({ command: 'loadEpics' });
    }

    function canSubmitFeedback() {
        return currentState.awsStatus && currentState.awsStatus.status === 'connected';
    }

    function updateFeedbackFormState() {
        const submitBtn = document.getElementById('submit-feedback-btn');
        const loadDataBtn = document.getElementById('load-data-btn');
        const epicSelect = document.getElementById('epic');
        
        if (canSubmitFeedback()) {
            submitBtn.disabled = false;
            loadDataBtn.disabled = false;
            submitBtn.textContent = 'Submit Feature';
        } else {
            submitBtn.disabled = true;
            loadDataBtn.disabled = true;
            submitBtn.textContent = 'Connect to AWS First';
            
            // Ensure epic dropdown is disabled when AWS is not connected
            if (epicSelect) {
                epicSelect.disabled = true;
                epicSelect.innerHTML = '<option value="">Connect to AWS first</option>';
            }
        }
    }



    function setupNotificationEventListeners() {
        // Notification elements removed - no event listeners needed
        console.log('Notification event listeners disabled - HTML elements removed');
    }

    // Load initial data
    function loadInitialData() {
        vscode.postMessage({ command: 'getAWSStatus' });
        // Only get enhanced status after AWS status is loaded to prevent premature display
        vscode.postMessage({ command: 'getEstimationData' });
    }



    // AWS Status Updates
    function updateAWSStatus(status) {
        currentState.awsStatus = status;
        const statusIndicator = document.getElementById('aws-status-indicator');
        const statusDot = statusIndicator.querySelector('.status-dot');
        const statusText = document.getElementById('aws-status-text');
        const connectBtn = document.getElementById('connect-aws-btn');
        const refreshBtn = document.getElementById('refresh-aws-btn');
        const connectionDetails = document.getElementById('aws-connection-details');
        const loading = document.getElementById('aws-loading');

        // Update status indicator
        statusDot.className = 'status-dot';
        switch (status.status) {
            case 'connected':
                statusDot.classList.add('status-connected');
                statusText.textContent = '🟢 Connected & Ready';
                connectBtn.style.display = 'none';
                refreshBtn.style.display = 'inline-block';
                connectionDetails.style.display = 'block';
                loading.style.display = 'none';
                updateConnectionDetails(status);
                updatePrerequisites();
                // Immediately show validating state for secret validation
                updateSecretValidationForValidating();
                // Load enhanced status after showing validating state
                vscode.postMessage({ command: 'getEnhancedAWSStatus' });
                // Load feedback dropdowns when AWS is connected
                loadFeedbackDropdowns();
                break;
            case 'connecting':
                statusDot.classList.add('status-connecting');
                statusText.textContent = '🟡 Connecting...';
                connectBtn.style.display = 'none';
                refreshBtn.style.display = 'none';
                connectionDetails.style.display = 'none';
                loading.style.display = 'block';
                // Update secret validation to show connecting state
                updateSecretValidationForConnecting();
                break;
            case 'error':
                statusDot.classList.add('status-disconnected');
                statusText.textContent = '🔴 Connection Failed';
                connectBtn.style.display = 'inline-block';
                refreshBtn.style.display = 'none';
                connectionDetails.style.display = 'none';
                loading.style.display = 'none';
                // Update secret validation to show error state
                updateSecretValidationForError();
                break;
            default:
                statusDot.classList.add('status-disconnected');
                statusText.textContent = '🔴 Not Connected';
                connectBtn.style.display = 'inline-block';
                refreshBtn.style.display = 'none';
                connectionDetails.style.display = 'none';
                loading.style.display = 'none';
                // Update secret validation to show disconnected state
                updateSecretValidationForDisconnected();
        }
        
        // Update feedback form state based on AWS connection
        updateFeedbackFormState();
    }

    function updateEnhancedAWSStatus(enhancedStatus) {
        // Update the secret validation card with new structure
        const secretIcon = document.getElementById('secret-validation-icon');
        const secretTitle = document.getElementById('secret-validation-title');
        const secretStatusValue = document.getElementById('secret-status-value');
        const secretMissingFields = document.getElementById('secret-missing-fields');
        const secretDetailsRow = document.getElementById('secret-details-row');
        const secretDetailsValue = document.getElementById('secret-details-value');
        
        // Always process enhanced status regardless of current connection state
        // This allows for proper error handling and status updates
        
        if (secretIcon && secretTitle && secretStatusValue && secretMissingFields) {
            switch (enhancedStatus.status) {
                case 'ready':
                    secretIcon.textContent = '✅';
                    secretTitle.textContent = 'Secret Validation Complete';
                    secretStatusValue.textContent = 'All required fields found';
                    secretMissingFields.textContent = 'none';
                    break;
                case 'secret-invalid':
                    secretIcon.textContent = '⚠️';
                    secretTitle.textContent = 'Secret Invalid';
                    secretStatusValue.textContent = 'Missing required fields';
                    secretMissingFields.textContent = enhancedStatus.missingFields ? enhancedStatus.missingFields.join(', ') : 'Unknown fields';
                    break;
                case 'secret-not-found':
                    secretIcon.textContent = '⚠️';
                    secretTitle.textContent = 'Secret Not Found';
                    secretStatusValue.textContent = 'Secret does not exist';
                    secretMissingFields.textContent = 'N/A';
                    break;
                case 'aws-not-configured':
                    secretIcon.textContent = '❌';
                    secretTitle.textContent = 'AWS Not Configured';
                    secretStatusValue.textContent = 'AWS CLI not configured';
                    secretMissingFields.textContent = 'N/A';
                    break;
                case 'error':
                    secretIcon.textContent = '❌';
                    secretTitle.textContent = 'Validation Error';
                    secretStatusValue.textContent = 'Failed to validate secret';
                    secretMissingFields.textContent = 'N/A';
                    break;
                default:
                    secretIcon.textContent = '🔍';
                    secretTitle.textContent = 'Checking Secret...';
                    secretStatusValue.textContent = 'Validation in progress';
                    secretMissingFields.textContent = 'Checking...';
            }
            
            // Show details if available
            if (enhancedStatus.details && secretDetailsRow && secretDetailsValue) {
                secretDetailsValue.textContent = enhancedStatus.details;
                secretDetailsRow.style.display = 'flex';
            } else if (secretDetailsRow) {
                secretDetailsRow.style.display = 'none';
            }
        }
        
        // Update prerequisites based on enhanced status
        updatePrerequisites();
    }

    function updateSecretValidationForConnecting() {
        const secretIcon = document.getElementById('secret-validation-icon');
        const secretTitle = document.getElementById('secret-validation-title');
        const secretStatusValue = document.getElementById('secret-status-value');
        const secretMissingFields = document.getElementById('secret-missing-fields');
        const secretDetailsRow = document.getElementById('secret-details-row');
        
        if (secretIcon) secretIcon.textContent = '🔄';
        if (secretTitle) secretTitle.textContent = 'Preparing Validation...';
        if (secretStatusValue) secretStatusValue.textContent = 'Establishing AWS connection';
        if (secretMissingFields) secretMissingFields.textContent = 'Pending...';
        if (secretDetailsRow) secretDetailsRow.style.display = 'none';
    }

    function updateSecretValidationForError() {
        const secretIcon = document.getElementById('secret-validation-icon');
        const secretTitle = document.getElementById('secret-validation-title');
        const secretStatusValue = document.getElementById('secret-status-value');
        const secretMissingFields = document.getElementById('secret-missing-fields');
        const secretDetailsRow = document.getElementById('secret-details-row');
        
        if (secretIcon) secretIcon.textContent = '❌';
        if (secretTitle) secretTitle.textContent = 'Connection Failed';
        if (secretStatusValue) secretStatusValue.textContent = 'Unable to connect to AWS';
        if (secretMissingFields) secretMissingFields.textContent = 'N/A';
        if (secretDetailsRow) secretDetailsRow.style.display = 'none';
    }

    function updateSecretValidationForDisconnected() {
        const secretIcon = document.getElementById('secret-validation-icon');
        const secretTitle = document.getElementById('secret-validation-title');
        const secretStatusValue = document.getElementById('secret-status-value');
        const secretMissingFields = document.getElementById('secret-missing-fields');
        const secretDetailsRow = document.getElementById('secret-details-row');
        
        if (secretIcon) secretIcon.textContent = '⏸️';
        if (secretTitle) secretTitle.textContent = 'Not Connected';
        if (secretStatusValue) secretStatusValue.textContent = 'Connect to AWS to validate';
        if (secretMissingFields) secretMissingFields.textContent = 'N/A';
        if (secretDetailsRow) secretDetailsRow.style.display = 'none';
    }

    function updateSecretValidationForValidating() {
        const secretIcon = document.getElementById('secret-validation-icon');
        const secretTitle = document.getElementById('secret-validation-title');
        const secretStatusValue = document.getElementById('secret-status-value');
        const secretMissingFields = document.getElementById('secret-missing-fields');
        const secretDetailsRow = document.getElementById('secret-details-row');
        
        if (secretIcon) secretIcon.textContent = '🔍';
        if (secretTitle) secretTitle.textContent = 'Validating Secret...';
        if (secretStatusValue) secretStatusValue.textContent = 'Checking Salesforce credentials';
        if (secretMissingFields) secretMissingFields.textContent = 'Validating...';
        if (secretDetailsRow) secretDetailsRow.style.display = 'none';
    }

    function updateConnectionDetails(status) {
        const detailsContent = document.getElementById('aws-details-content');
        const connectionTime = new Date().toLocaleTimeString();
        
        // Calculate session expiry display
        let sessionExpiryDisplay = 'Unknown';
        let timeRemaining = '';
        
        if (status.sessionExpiry) {
            const expiryDate = new Date(status.sessionExpiry);
            const now = new Date();
            const timeDiff = expiryDate.getTime() - now.getTime();
            
            if (timeDiff > 0) {
                const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                
                if (hours > 0) {
                    timeRemaining = `${hours}h ${minutes}m remaining`;
                } else if (minutes > 0) {
                    timeRemaining = `${minutes}m remaining`;
                } else {
                    timeRemaining = 'Expiring soon';
                }
                sessionExpiryDisplay = timeRemaining;
            } else {
                sessionExpiryDisplay = 'Session expired';
            }
        }
        
        detailsContent.innerHTML = `
            <div class="connection-status-card">
                <div class="connection-header">
                    <span class="connection-icon">🔗</span>
                    <span class="connection-title">AWS Connection Active</span>
                </div>
                <div class="connection-info">
                    <div class="info-row">
                        <span class="info-label">Connected at:</span>
                        <span class="info-value">${connectionTime}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Session status:</span>
                        <span class="info-value session-expiry">${sessionExpiryDisplay}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Services:</span>
                        <span class="info-value">${status.secretsManagerAccess ? '✅ Secrets Manager Ready' : '❌ Limited Access'}</span>
                    </div>
                </div>
            </div>
        `;
    }

    function showLoadingSteps(steps) {
        const loadingSteps = document.getElementById('loading-steps');
        let currentStep = 0;
        
        function updateStep() {
            if (currentStep < steps.length) {
                loadingSteps.innerHTML = `
                    ${steps.slice(0, currentStep).map(step => `<div>✅ ${step}</div>`).join('')}
                    ${currentStep < steps.length ? `<div>⏳ ${steps[currentStep]}</div>` : ''}
                    ${steps.slice(currentStep + 1).map(step => `<div>⏸️ ${step}</div>`).join('')}
                `;
                currentStep++;
                setTimeout(updateStep, 1000);
            }
        }
        
        updateStep();
    }

    // Prerequisites Updates
    function updatePrerequisites() {
        const awsConnected = currentState.awsStatus?.connected || false;
        
        // Update prerequisite status
        const awsStatus = document.getElementById('prereq-aws-status');
        const updateBtn = document.getElementById('update-jira-btn');
        
        if (awsStatus) {
            awsStatus.textContent = awsConnected ? '✅' : '❌';
        }
        
        // Enable/disable update button and section based on AWS connection only
        const jiraSection = document.getElementById('jira-config-section');
        
        if (jiraSection) {
            jiraSection.style.opacity = awsConnected ? '1' : '0.5';
            jiraSection.style.pointerEvents = awsConnected ? 'auto' : 'none';
        }
        
        if (updateBtn) {
            updateBtn.disabled = !awsConnected;
        }
    }

    // Estimation Data Updates
    function updateEstimationData(estimation) {
        currentState.estimationData = estimation;
        const estimationDetails = document.getElementById('estimation-details');
        const estimationContent = document.getElementById('estimation-content');

        if (estimation) {
            estimationDetails.style.display = 'block';
            estimationContent.innerHTML = `
                <div>├── Original Estimate: ${estimation.originalText || 'N/A'}</div>
                <div>├── Hours Equivalent: ${estimation.normalizedValue || 'N/A'} hours</div>
                <div>├── Confidence: ${estimation.confidence || 'Medium'}</div>
                <div>└── Source: ${estimation.source || 'GitHub Copilot'}</div>
            `;
        } else {
            estimationDetails.style.display = 'none';
        }

        updatePrerequisites();
        
        // Note: This function only updates the display data - it does NOT show notification popups
        // Notifications are only shown via the showEstimationNotification() function when explicitly triggered
    }



    // JIRA Update Results
    function showJiraUpdateResult(result) {
        const updateResult = document.getElementById('jira-update-result');
        const updateBtn = document.getElementById('update-jira-btn');
        
        // Reset button state
        if (updateBtn) {
            updateBtn.disabled = false;
            updateBtn.textContent = '📊 Update DEVSECOPS Ticket';
        }
        
        if (result.success) {
            updateResult.className = 'result-display success';
            updateResult.innerHTML = `
                <div class="result-header">
                    <span class="result-icon">✅</span>
                    <span class="result-title">DEVSECOPS Ticket Updated Successfully</span>
                </div>
                <div class="result-details">
                    <div class="result-item">
                        <span class="result-label">Ticket ID:</span>
                        <span class="result-value">${result.jiraId}</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Status:</span>
                        <span class="result-value">${result.message}</span>
                    </div>
                    ${result.epicId ? `
                    <div class="result-item">
                        <span class="result-label">Epic ID:</span>
                        <span class="result-value">${result.epicId}</span>
                    </div>` : ''}
                    ${result.recordUrl ? `
                    <div class="result-item">
                        <span class="result-label">URL:</span>
                        <span class="result-value"><a href="${result.recordUrl}" target="_blank">View in Salesforce</a></span>
                    </div>` : ''}
                </div>
            `;
        } else {
            updateResult.className = 'result-display error';
            updateResult.innerHTML = `
                <div class="result-header">
                    <span class="result-icon">❌</span>
                    <span class="result-title">Failed to Update DEVSECOPS Ticket</span>
                </div>
                <div class="result-details">
                    <div class="result-item">
                        <span class="result-label">Ticket ID:</span>
                        <span class="result-value">${result.jiraId}</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Message:</span>
                        <span class="result-value">${result.message}</span>
                    </div>
                    ${result.error ? `
                    <div class="result-item">
                        <span class="result-label">Error:</span>
                        <span class="result-value error-text">${result.error}</span>
                    </div>` : ''}
                </div>
            `;
        }
        
        updateResult.style.display = 'block';
    }

    // Feedback Results
    function showFeedbackResult(result) {
        const feedbackResult = document.getElementById('feedback-result');
        
        if (result.success) {
            feedbackResult.className = 'feedback-result success';
            feedbackResult.innerHTML = `
                <div class="result-header">
                    <span class="result-icon">✅</span>
                    <span class="result-title">Feature Submitted Successfully</span>
                </div>
                <div class="result-details">
                    <div class="result-item">
                        <span class="result-label">Ticket ID:</span>
                        <span class="result-value">${result.ticketId || 'N/A'}</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Status:</span>
                        <span class="result-value">${result.message}</span>
                    </div>
                    ${result.jiraUrl ? `
                    <div class="result-item">
                        <span class="result-label">JIRA Link:</span>
                        <span class="result-value"><a href="${result.jiraUrl}" target="_blank">View in JIRA</a></span>
                    </div>` : ''}
                </div>
            `;
        } else {
            feedbackResult.className = 'feedback-result error';
            feedbackResult.innerHTML = `
                <div class="result-header">
                    <span class="result-icon">❌</span>
                    <span class="result-title">Failed to Submit Feature</span>
                </div>
                <div class="result-details">
                    <div class="result-item">
                        <span class="result-label">Message:</span>
                        <span class="result-value">${result.message}</span>
                    </div>
                    ${result.error ? `
                    <div class="result-item">
                        <span class="result-label">Error:</span>
                        <span class="result-value error-text">${result.error}</span>
                    </div>` : ''}
                </div>
            `;
        }
        
        feedbackResult.style.display = 'block';
        // Remove the timeout - let the message stay persistent like JIRA updates
    }



    // Estimation Notification - DISABLED
    function showEstimationNotification(estimation) {
        // Function disabled - user doesn't want estimation popup notifications
        console.log('Estimation notification disabled by user request');
        return;
    }

    function hideEstimationNotification() {
        // Function disabled - HTML element removed
        console.log('Hide estimation notification disabled - element removed');
    }





    // Populate initiatives dropdown
    function populateInitiativesDropdown(initiatives) {
        const initiativeSelect = document.getElementById('initiative');
        
        if (!canSubmitFeedback()) {
            initiativeSelect.innerHTML = '<option value="">Connect to AWS to load initiatives</option>';
            initiativeSelect.disabled = true;
            return;
        }
        
        initiativeSelect.disabled = false;
        initiativeSelect.innerHTML = '<option value="">Select Initiative...</option>';
        
        if (initiatives && initiatives.length > 0) {
            initiatives.forEach(initiative => {
                const option = document.createElement('option');
                option.value = initiative.id;
                option.textContent = initiative.name;
                initiativeSelect.appendChild(option);
            });
        } else {
            initiativeSelect.innerHTML = '<option value="">No initiatives available</option>';
        }
    }

    // Populate epics dropdown
    function populateEpicsDropdown(epics) {
        // Store epics for reference
        currentState.allEpics = epics || [];
        
        const epicSelect = document.getElementById('epic');
        
        if (!canSubmitFeedback()) {
            epicSelect.innerHTML = '<option value="">Connect to AWS to load epics</option>';
            epicSelect.disabled = true;
            return;
        }
        
        epicSelect.disabled = false;
        epicSelect.innerHTML = '<option value="">Select Epic...</option>';
        
        if (epics && epics.length > 0) {
            // Show all epics - no filtering needed
            epics.forEach(epic => {
                const option = document.createElement('option');
                option.value = epic.id;
                option.textContent = `${epic.name}${epic.teamName ? ' (' + epic.teamName + ')' : ''}`;
                epicSelect.appendChild(option);
            });
        } else {
            epicSelect.innerHTML = '<option value="">No epics available</option>';
        }
    }


    // Task List Management Functions
    function setActiveTaskTab(tabType) {
        const retrieveWipBtn = document.getElementById('retrieve-wip-btn');
        const runningTasksBtn = document.getElementById('running-tasks-btn');
        const taskListTitle = document.getElementById('task-list-title');

        // Update button states
        if (tabType === 'wip') {
            retrieveWipBtn?.classList.add('active');
            runningTasksBtn?.classList.remove('active');
            if (taskListTitle) taskListTitle.textContent = 'My WIP List';
        } else {
            retrieveWipBtn?.classList.remove('active');
            runningTasksBtn?.classList.add('active');
            if (taskListTitle) taskListTitle.textContent = 'Running Task List';
        }
    }

    function showTaskLoading() {
        const taskLoading = document.getElementById('task-loading');
        const taskEmptyState = document.getElementById('task-empty-state');
        const taskList = document.getElementById('task-list');

        if (taskLoading) taskLoading.style.display = 'flex';
        if (taskEmptyState) taskEmptyState.style.display = 'none';
        if (taskList) taskList.style.display = 'none';
    }

    function hideTaskLoading() {
        const taskLoading = document.getElementById('task-loading');
        if (taskLoading) taskLoading.style.display = 'none';
    }

    // Helper functions for task management
    function showSearchContainer() {
        const searchContainer = document.getElementById('search-container');
        if (searchContainer) searchContainer.style.display = 'block';
    }

    function hideSearchContainer() {
        const searchContainer = document.getElementById('search-container');
        if (searchContainer) searchContainer.style.display = 'none';
    }

    function loadRunningTasks(offset = 0, searchTerm = '') {
        showTaskLoading();
        const options = { 
            limit: 20, 
            offset: offset,
            ...(searchTerm && { searchTerm })
        };
        vscode.postMessage({ 
            command: 'retrieveRunningTasks',
            data: options
        });
    }

    function loadWipTasks(offset = 0, searchTerm = '') {
        showTaskLoading();
        const options = { 
            limit: 20, 
            offset: offset,
            ...(searchTerm && { searchTerm })
        };
        vscode.postMessage({ 
            command: 'retrieveWipTasks',
            data: options
        });
    }

    function performSearch(searchTerm) {
        console.log('Performing search for:', searchTerm);
        const activeTab = getActiveTaskTab();
        if (activeTab === 'wip') {
            loadWipTasks(0, searchTerm);
        } else {
            loadRunningTasks(0, searchTerm);
        }
    }

    function getActiveTaskTab() {
        const wipBtn = document.getElementById('retrieve-wip-btn');
        const runningBtn = document.getElementById('running-tasks-btn');
        
        if (wipBtn?.classList.contains('active')) {
            return 'wip';
        } else if (runningBtn?.classList.contains('active')) {
            return 'running';
        }
        return 'running'; // default
    }

    function displayTaskList(tasks, taskType, pagination = null) {
        console.log(`Displaying ${tasks.length} ${taskType} tasks:`, tasks);
        hideTaskLoading();
        
        // Store current state
        currentState.currentTaskList = tasks;
        currentState.pagination = pagination;
        
        const taskCount = document.getElementById('task-count');
        const taskEmptyState = document.getElementById('task-empty-state');
        const taskList = document.getElementById('task-list');
        const paginationControls = document.getElementById('pagination-controls');

        // Update task count
        if (taskCount) {
            const totalText = pagination ? ` of ${pagination.totalCount}` : '';
            taskCount.textContent = `${tasks.length}${totalText} task${tasks.length !== 1 ? 's' : ''}`;
        }

        if (tasks.length === 0) {
            // Show empty state
            if (taskEmptyState) {
                const searchText = pagination?.searchTerm ? ` matching "${pagination.searchTerm}"` : '';
                taskEmptyState.innerHTML = `<p>No ${taskType === 'wip' ? 'WIP' : 'running'} tasks found${searchText}.</p>`;
                taskEmptyState.style.display = 'block';
            }
            if (taskList) taskList.style.display = 'none';
            if (paginationControls) paginationControls.style.display = 'none';
            return;
        }

        // Hide empty state and show task list
        if (taskEmptyState) taskEmptyState.style.display = 'none';
        if (taskList) {
            taskList.style.display = 'block';
            taskList.innerHTML = tasks.map(task => createTaskItemHTML(task)).join('');
            
            // Add event listeners to task action buttons
            addTaskActionListeners();
        }

        // Update pagination controls
        if (pagination && paginationControls) {
            updatePaginationControls(pagination);
            paginationControls.style.display = 'flex';
        } else if (paginationControls) {
            paginationControls.style.display = 'none';
        }
    }

    function updatePaginationControls(pagination) {
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');
        const paginationInfo = document.getElementById('pagination-info');

        if (prevBtn) {
            prevBtn.disabled = pagination.currentOffset === 0;
        }

        if (nextBtn) {
            nextBtn.disabled = !pagination.hasMore;
        }

        if (paginationInfo) {
            const currentPage = Math.floor(pagination.currentOffset / pagination.currentLimit) + 1;
            const totalPages = Math.ceil(pagination.totalCount / pagination.currentLimit);
            const searchText = pagination.searchTerm ? ` (filtered)` : '';
            paginationInfo.textContent = `Page ${currentPage} of ${totalPages}${searchText}`;
        }
    }

    function createTaskItemHTML(task) {
        const ticketNumber = extractTicketNumber(task.Jira_Link__c);
        const description = task.Description__c || 'No description available';
        const truncatedDescription = description.length > 100 ? description.substring(0, 100) + '...' : description;
        
        return `
            <div class="task-item" data-task-id="${task.Id}">
                <div class="task-main-content">
                    <div class="task-header">
                        <h4 class="task-name">${task.Name}</h4>
                        <span class="task-ticket">${ticketNumber}</span>
                    </div>
                    <p class="task-description">${truncatedDescription}</p>
                    <div class="task-meta">
                        <span class="task-status ${getStatusClass(task.Status__c)}">${task.Status__c || 'Unknown'}</span>
                        <span class="task-type ${getTypeClass(task.Type__c)}">${task.Type__c || 'Unknown'}</span>
                        ${task.Estimated_Effort_Hours__c ? `<span class="task-effort">${task.Estimated_Effort_Hours__c}h</span>` : ''}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="task-action-btn edit" data-action="edit" data-task-id="${task.Id}" data-task-name="${task.Name}" data-description="${description}">
                        Edit
                    </button>
                    <button class="task-action-btn delete" data-action="delete" data-task-id="${task.Id}" data-task-name="${task.Name}">
                        Delete
                    </button>
                    <button class="task-action-btn cleanup" data-action="cleanup" data-task-id="${task.Id}" data-task-name="${task.Name}">
                        Cleanup
                    </button>
                </div>
            </div>
        `;
    }

    function extractTicketNumber(jiraLink) {
        if (!jiraLink) return 'N/A';
        const match = jiraLink.match(/DEVSECOPS-(\d+)/);
        return match ? `DEVSECOPS-${match[1]}` : 'N/A';
    }

    function getStatusClass(status) {
        if (!status) return '';
        const statusLower = status.toLowerCase().replace(/\s+/g, '-');
        return statusLower;
    }

    function getTypeClass(type) {
        if (!type) return '';
        return type.toLowerCase();
    }

    function addTaskActionListeners() {
        const actionButtons = document.querySelectorAll('.task-action-btn');
        
        actionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const action = button.getAttribute('data-action');
                const taskId = button.getAttribute('data-task-id');
                const taskName = button.getAttribute('data-task-name');
                const description = button.getAttribute('data-description');
                
                const taskData = {
                    taskId,
                    taskName,
                    description
                };
                
                switch (action) {
                    case 'edit':
                        vscode.postMessage({ 
                            command: 'editTask', 
                            data: taskData 
                        });
                        break;
                    case 'delete':
                        vscode.postMessage({ 
                            command: 'deleteTask', 
                            data: taskData 
                        });
                        break;
                    case 'cleanup':
                        vscode.postMessage({ 
                            command: 'cleanupTask', 
                            data: taskData 
                        });
                        break;
                }
            });
        });
    }

    function handleTaskActionResult(result, action) {
        if (result.success) {
            // For cleanup action, remove the task from the UI immediately
            if (action === 'cleanup') {
                // Find and remove the task item from the UI
                const currentTaskItems = document.querySelectorAll('.task-item');
                currentTaskItems.forEach(item => {
                    const taskId = item.getAttribute('data-task-id');
                    if (taskId === result.taskId) {
                        item.remove();
                        // Update task count
                        const taskCount = document.getElementById('task-count');
                        const remainingTasks = document.querySelectorAll('.task-item').length;
                        if (taskCount) {
                            taskCount.textContent = `${remainingTasks} task${remainingTasks !== 1 ? 's' : ''}`;
                        }
                        
                        // Show empty state if no tasks remain
                        if (remainingTasks === 0) {
                            const taskEmptyState = document.getElementById('task-empty-state');
                            const taskList = document.getElementById('task-list');
                            if (taskEmptyState) {
                                taskEmptyState.innerHTML = '<p>No tasks remaining in the list.</p>';
                                taskEmptyState.style.display = 'block';
                            }
                            if (taskList) taskList.style.display = 'none';
                        }
                    }
                });
            } else if (action === 'delete') {
                // For delete action, reload the current task list
                const activeTab = document.querySelector('.task-nav-buttons .secondary-button.active');
                if (activeTab) {
                    activeTab.click();
                }
            }
        }
    }

    // Message handling from extension
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
            case 'updateAWSStatus':
                updateAWSStatus(message.data);
                break;
            case 'updateEnhancedAWSStatus':
                updateEnhancedAWSStatus(message.data);
                break;
            case 'updateEstimationData':
                updateEstimationData(message.data);
                break;
            case 'showEstimationNotification':
                // showEstimationNotification(message.data); // Disabled - user doesn't want popup
                break;
            case 'updateJiraStatus':
                showJiraUpdateResult(message.data);
                break;

            case 'awsStatusResponse':
                updateAWSStatus(message.data);
                break;
            case 'enhancedAWSStatusResponse':
                updateEnhancedAWSStatus(message.data);
                break;
            case 'estimationDataResponse':
                updateEstimationData(message.data);
                break;
            case 'feedbackResult':
                showFeedbackResult(message.data);
                break;
            case 'initiativesLoaded':
                populateInitiativesDropdown(message.data);
                break;
            case 'epicsLoaded':
                populateEpicsDropdown(message.data);
                break;
            
            // Task List Messages
            case 'taskListLoaded':
                console.log('Task list loaded message received:', message.data);
                displayTaskList(message.data.tasks, message.data.taskType, message.data.pagination);
                break;
            case 'taskActionResult':
                console.log('Task action result received:', message.data);
                handleTaskActionResult(message.data.result, message.data.action);
                break;
            case 'showTaskEditForm':
                console.log('Show task edit form message received:', message.data);
                showTaskEditModal(message.data);
                break;
        }
    });

    // Task Edit Modal Functions
    function setupTaskEditModal() {
        const modal = document.getElementById('task-edit-modal');
        const closeBtn = document.getElementById('close-edit-modal');
        const cancelBtn = document.getElementById('cancel-edit-btn');
        const saveBtn = document.getElementById('save-task-btn');

        closeBtn?.addEventListener('click', hideTaskEditModal);
        cancelBtn?.addEventListener('click', hideTaskEditModal);
        
        // Close modal when clicking outside
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideTaskEditModal();
            }
        });

        saveBtn?.addEventListener('click', saveTaskUpdates);
    }

    function showTaskEditModal(taskData) {
        console.log('Showing edit modal for task:', taskData);
        currentState.editingTask = taskData;
        
        // Populate form fields
        const fields = {
            'edit-task-id': taskData.taskId || taskData.Id,
            'edit-task-name': taskData.taskName || taskData.Name || '',
            'edit-task-description': taskData.description || taskData.Description__c || '',
            'edit-estimated-hours': taskData.Estimated_Effort_Hours__c || '',
            'edit-task-type': taskData.Type__c || 'Story',
            'edit-task-priority': taskData.Jira_Priority__c || 'Major-P3',
            'edit-task-status': taskData.Status__c || 'Backlog',
            'edit-acceptance-criteria': taskData.Jira_Acceptance_Criteria__c || '',
            'edit-actual-hours': taskData.Actual_Effort_Hours__c || '',
            'edit-resolution': taskData.Resolution__c || '',
            'edit-epic-id': taskData.Epic__c || ''
        };

        Object.entries(fields).forEach(([fieldId, value]) => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = value || '';
            }
        });

        const modal = document.getElementById('task-edit-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    function hideTaskEditModal() {
        const modal = document.getElementById('task-edit-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        currentState.editingTask = null;
    }

    function saveTaskUpdates() {
        const taskId = document.getElementById('edit-task-id')?.value;
        if (!taskId) {
            console.error('No task ID found');
            return;
        }

        const updates = {
            name: document.getElementById('edit-task-name')?.value,
            description: document.getElementById('edit-task-description')?.value,
            estimatedHours: parseFloat(document.getElementById('edit-estimated-hours')?.value) || undefined,
            type: document.getElementById('edit-task-type')?.value,
            priority: document.getElementById('edit-task-priority')?.value,
            status: document.getElementById('edit-task-status')?.value,
            acceptanceCriteria: document.getElementById('edit-acceptance-criteria')?.value,
            actualHours: parseFloat(document.getElementById('edit-actual-hours')?.value) || undefined,
            resolution: document.getElementById('edit-resolution')?.value,
            epicId: document.getElementById('edit-epic-id')?.value
        };

        // Remove undefined values
        Object.keys(updates).forEach(key => {
            if (updates[key] === undefined || updates[key] === '') {
                delete updates[key];
            }
        });

        console.log('Saving task updates:', taskId, updates);

        vscode.postMessage({
            command: 'saveTaskUpdates',
            data: { taskId, updates }
        });

        hideTaskEditModal();
    }

    // Initialize when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();