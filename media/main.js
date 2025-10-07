(function() {
    // Get the VS Code API
    const vscode = acquireVsCodeApi();

    // State management
    let currentState = {
        awsStatus: { connected: false, status: 'disconnected' },
        estimationData: null,
        jiraValidation: null,
        settings: {},
        parsedEstimation: null
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
        
        // Feedback Tab
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

    function setupFeedbackEventListeners() {
        const submitDevSecOpsBtn = document.getElementById('submit-devsecops-feedback-btn');
        const clearFormBtn = document.getElementById('clear-feedback-form-btn');

        // Submit DEVSECOPS Hub feedback
        if (submitDevSecOpsBtn) {
            submitDevSecOpsBtn.addEventListener('click', () => {
                const feedbackData = {
                    name: document.getElementById('feedback-name').value.trim(),
                    description: document.getElementById('feedback-description').value.trim(),
                    estimatedEffortHours: parseFloat(document.getElementById('estimated-effort-hours').value) || 0,
                    type: document.getElementById('feedback-type').value,
                    acceptanceCriteria: document.getElementById('acceptance-criteria').value.trim(),
                    epicId: document.getElementById('epic-id').value.trim(),
                    initiativeId: document.getElementById('initiative-id').value.trim(),
                    completionDate: document.getElementById('completion-date').value,
                    contactEmail: document.getElementById('contact-email').value.trim(),
                    includeSystemInfo: document.getElementById('include-system-info').checked,
                    includeAWSDetails: document.getElementById('include-aws-details').checked
                };

                // Validate required fields
                if (!feedbackData.name || !feedbackData.description || !feedbackData.type || 
                    !feedbackData.acceptanceCriteria || !feedbackData.epicId || !feedbackData.initiativeId ||
                    feedbackData.estimatedEffortHours <= 0) {
                    showDEVSECOPSFeedbackResult({
                        success: false,
                        message: 'Please fill in all required fields marked with *',
                        error: 'Missing required fields'
                    });
                    return;
                }

                // Validate Salesforce ID format (15 or 18 characters, alphanumeric)
                const salesforceIdPattern = /^[a-zA-Z0-9]{15,18}$/;
                if (!salesforceIdPattern.test(feedbackData.epicId)) {
                    showDEVSECOPSFeedbackResult({
                        success: false,
                        message: 'Epic ID must be a valid Salesforce ID (15-18 alphanumeric characters)',
                        error: 'Invalid Epic ID format'
                    });
                    return;
                }

                if (!salesforceIdPattern.test(feedbackData.initiativeId)) {
                    showDEVSECOPSFeedbackResult({
                        success: false,
                        message: 'Initiative ID must be a valid Salesforce ID (15-18 alphanumeric characters)',
                        error: 'Invalid Initiative ID format'
                    });
                    return;
                }

                // Disable button and show loading
                submitDevSecOpsBtn.disabled = true;
                submitDevSecOpsBtn.textContent = '🔄 Creating Feedback...';

                vscode.postMessage({ 
                    command: 'submitDEVSECOPSFeedback', 
                    data: feedbackData 
                });
            });
        }



        // Clear form
        if (clearFormBtn) {
            clearFormBtn.addEventListener('click', () => {
                document.getElementById('feedback-name').value = '';
                document.getElementById('feedback-description').value = '';
                document.getElementById('estimated-effort-hours').value = '';
                document.getElementById('feedback-type').value = '';
                document.getElementById('acceptance-criteria').value = '';
                document.getElementById('epic-id').value = '';
                document.getElementById('initiative-id').value = '';
                document.getElementById('completion-date').value = '';
                document.getElementById('contact-email').value = '';
                document.getElementById('include-system-info').checked = true;
                document.getElementById('include-aws-details').checked = false;
                
                showDEVSECOPSFeedbackResult({
                    success: true,
                    message: 'Form cleared successfully!'
                });
            });
        }

        // No refresh buttons needed for manual entry form
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
    function showFeedbackResult(message, type) {
        const feedbackResult = document.getElementById('feedback-result');
        feedbackResult.className = `feedback-result ${type}`;
        feedbackResult.textContent = message;
        feedbackResult.style.display = 'block';
        
        setTimeout(() => {
            feedbackResult.style.display = 'none';
        }, 5000);
    }

    // DEVSECOPS Hub Feedback Functions
    function showDEVSECOPSFeedbackResult(result) {
        const resultDiv = document.getElementById('devsecops-feedback-result');
        const submitBtn = document.getElementById('submit-devsecops-feedback-btn');
        
        // Reset button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '🚀 Create Feedback In DEVSECOPS Hub';
        }
        
        if (resultDiv) {
            if (result.success) {
                resultDiv.className = 'feedback-result success';
                resultDiv.innerHTML = `
                    <div class="result-header">
                        <span class="result-icon">✅</span>
                        <span class="result-title">Success!</span>
                    </div>
                    <div class="result-details">
                        <div class="result-item">
                            <span class="result-label">Message:</span>
                            <span class="result-value">${result.message}</span>
                        </div>
                        ${result.ticketId ? `
                        <div class="result-item">
                            <span class="result-label">Ticket ID:</span>
                            <span class="result-value">${result.ticketId}</span>
                        </div>
                        ` : ''}
                    </div>
                `;
            } else {
                resultDiv.className = 'feedback-result error';
                resultDiv.innerHTML = `
                    <div class="result-header">
                        <span class="result-icon">❌</span>
                        <span class="result-title">Submission Failed</span>
                    </div>
                    <div class="result-details">
                        <div class="result-item">
                            <span class="result-label">Error:</span>
                            <span class="result-value">${result.error || result.message}</span>
                        </div>
                    </div>
                `;
            }
            
            resultDiv.style.display = 'block';
            setTimeout(() => {
                resultDiv.style.display = 'none';
            }, 10000);
        }
    }

    // Dropdown population functions removed - using manual entry instead



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
            case 'devsecopssFeedbackResult':
                showDEVSECOPSFeedbackResult(message.data);
                break;
            case 'feedbackResult':
                showFeedbackResult(message.data.message, message.data.type);
                break;
        }
    });

    // Initialize when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();