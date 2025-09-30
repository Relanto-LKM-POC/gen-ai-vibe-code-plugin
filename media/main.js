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
        
        // Get configuration from window object (injected by extension)
        const config = window.vibeConfig || { 
            hoursPerDay: 8, 
            hoursPerWeek: 40, 
            hoursPerMonth: 160 
        };
        
        switch (unit) {
            case 'hours':
                return value;
            case 'days':
                return value * config.hoursPerDay;
            case 'weeks':
                return value * config.hoursPerWeek;
            case 'months':
                return value * config.hoursPerMonth;
            default:
                return value; // Default to hours if unknown unit
        }
    }

    // Initialize the webview
    function initialize() {
        setupTabs();
        setupEventListeners();
        setInitialLoadingState();
        loadInitialData();
    }

    // Set initial loading state to prevent jarring UI changes
    function setInitialLoadingState() {
        // Show loading state for AWS instead of "Not Connected"
        const statusDot = document.querySelector('#aws-status-indicator .status-dot');
        const statusText = document.getElementById('aws-status-text');
        
        if (statusDot && statusText) {
            statusDot.className = 'status-dot status-connecting';
            statusText.textContent = '🔄 Checking Connection...';
        }
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
                    estimationData: currentState.estimationData,
                    manualHours: estimationInHours > 0 ? estimationInHours : undefined
                }
            });
        });


    }

    function setupFeedbackEventListeners() {
        const submitFeedbackBtn = document.getElementById('submit-feedback-btn');

        // Check GitHub integration status on load
        checkGitHubStatus();

        submitFeedbackBtn.addEventListener('click', () => {
            const feedbackData = {
                issueType: document.getElementById('issue-type').value,
                priority: document.getElementById('priority').value,
                component: document.getElementById('component').value,
                description: document.getElementById('feedback-description').value,
                includeSystemInfo: document.getElementById('include-system-info').checked,
                includeAWSDetails: document.getElementById('include-aws-details').checked,
                contactEmail: document.getElementById('contact-email').value
            };

            vscode.postMessage({ 
                command: 'submitFeedback', 
                data: feedbackData 
            });
        });
    }

    function checkGitHubStatus() {
        // Request GitHub token status from extension
        vscode.postMessage({ 
            command: 'checkGitHubStatus' 
        });
    }

    function updateGitHubStatus(hasToken) {
        const statusElement = document.getElementById('github-status');
        const statusIcon = statusElement.querySelector('.status-icon');
        const statusText = statusElement.querySelector('.status-text');
        const setupInstructions = document.getElementById('github-setup');

        if (hasToken) {
            statusIcon.textContent = '✅';
            statusText.textContent = 'GitHub integration configured';
            statusElement.parentElement.classList.add('connected');
            setupInstructions.style.display = 'none';
        } else {
            statusIcon.textContent = '⚠️';
            statusText.textContent = 'GitHub integration not configured';
            statusElement.parentElement.classList.remove('connected');
            setupInstructions.style.display = 'block';
        }
    }



    function setupNotificationEventListeners() {
        // Notification elements removed - no event listeners needed
        console.log('Notification event listeners disabled - HTML elements removed');
    }

    // Load initial data
    function loadInitialData() {
        vscode.postMessage({ command: 'getAWSStatus' });
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
                break;
            case 'connecting':
                statusDot.classList.add('status-connecting');
                statusText.textContent = '🟡 Connecting...';
                connectBtn.style.display = 'none';
                refreshBtn.style.display = 'none';
                connectionDetails.style.display = 'none';
                loading.style.display = 'block';
                break;
            case 'error':
                statusDot.classList.add('status-disconnected');
                statusText.textContent = '🔴 Connection Failed';
                connectBtn.style.display = 'inline-block';
                refreshBtn.style.display = 'none';
                connectionDetails.style.display = 'none';
                loading.style.display = 'none';
                break;
            default:
                statusDot.classList.add('status-disconnected');
                statusText.textContent = '🔴 Not Connected';
                connectBtn.style.display = 'inline-block';
                refreshBtn.style.display = 'none';
                connectionDetails.style.display = 'none';
                loading.style.display = 'none';
        }
    }

    function updateConnectionDetails(status) {
        const connectionDetails = document.getElementById('aws-connection-details');
        const sessionExpiry = status.sessionExpiry || 'Unknown';
        const isConnected = status.connected !== false; // Use success for connected, error only for actual errors
        
        connectionDetails.innerHTML = `
            <div class="connection-display ${isConnected ? 'success' : 'error'}">
                <div class="result-header">
                    <span class="result-icon">🔒</span>
                    <span class="result-title">AWS Session Status</span>
                </div>
                <div class="result-details">
                    <div class="result-item">
                        <span class="result-label">Session Expires:</span>
                        <span class="result-value">${sessionExpiry}</span>
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
            case 'estimationDataResponse':
                updateEstimationData(message.data);
                break;
            case 'feedbackResult':
                showFeedbackResult(message.data.message, message.data.type);
                break;
            case 'githubStatusResponse':
                updateGitHubStatus(message.data.hasToken);
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