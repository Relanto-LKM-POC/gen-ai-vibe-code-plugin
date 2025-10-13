import * as vscode from 'vscode';
import { AWSService } from './awsService';
import { JiraService } from './jiraService';

export interface Task {
    Id: string;
    Name: string;
    Description__c?: string;
    Status__c?: string;
    Jira_Link__c?: string;
    Type__c?: string;
    Estimated_Effort_Hours__c?: number;
    Actual_Effort_Hours__c?: number;
    Resolution__c?: string;
    Deployment_Date__c?: string;
    Jira_Priority__c?: string;
}

export class TaskService {
    private context: vscode.ExtensionContext;
    private awsService: AWSService;
    private jiraService: JiraService;
    private salesforceBaseUrl = 'https://ciscolearningservices--secqa.sandbox.my.salesforce-setup.com';

    constructor(context: vscode.ExtensionContext, awsService: AWSService) {
        this.context = context;
        this.awsService = awsService;
        this.jiraService = new JiraService(context, awsService);
    }

    /**
     * Get Salesforce access token using the same method as other services
     */
    private async getAccessToken(): Promise<string> {
        // Check AWS connection status first
        const awsStatus = await this.awsService.getRealTimeConnectionStatus();
        if (!awsStatus.connected) {
            throw new Error('AWS connection is required. Please connect to AWS first.');
        }

        // Check if Salesforce credentials are available
        const salesforceCredentials = this.awsService.getSalesforceCredentials();
        if (!salesforceCredentials) {
            throw new Error('Salesforce credentials not available. Please ensure AWS is connected and credentials are configured.');
        }

        return await (this.jiraService as any).authenticateWithSalesforce();
    }

    /**
     * Retrieve WIP (Work In Progress) tasks with pagination and search
     */
    async retrieveWipTasks(options: { limit?: number; offset?: number; searchTerm?: string } = {}): Promise<{ tasks: Task[]; totalCount: number; hasMore: boolean }> {
        try {
            const token = await this.getAccessToken();
            const limit = options.limit || 20;
            const offset = options.offset || 0;

            // Build the WHERE clause with WIP conditions and optional search
            let baseWipConditions = 'Jira_Link__c != null AND Status__c != \'Done\'';
            let whereClause = '';
            
            if (options.searchTerm && options.searchTerm.trim()) {
                const searchTerm = options.searchTerm.trim().replace(/'/g, "\\'");
                console.log('WIP Search term received:', searchTerm);
                // Only search by DEVSECOPS ticket ID in Jira_Link__c field
                const devsecopsPattern = /^DEVSECOPS-\d+$/i;
                console.log('WIP Search: Testing pattern match for:', searchTerm, 'Pattern:', devsecopsPattern.toString());
                if (devsecopsPattern.test(searchTerm)) {
                    // Search for specific DEVSECOPS ID - ignore WIP conditions when searching
                    whereClause = `WHERE Jira_Link__c LIKE '%${searchTerm}%'`;
                    console.log('WIP Search: ✓ DEVSECOPS pattern matched, using search for:', searchTerm);
                } else {
                    // If not a valid DEVSECOPS ID format, return no results
                    whereClause = `WHERE 1=0`;
                    console.log('WIP Search: ✗ Invalid DEVSECOPS format, expected DEVSECOPS-NUMBER, got:', searchTerm);
                }
            } else {
                // Default WIP query when no search term
                whereClause = `WHERE ${baseWipConditions}`;
                console.log('WIP Search: Using default WIP conditions');
            }

            // Use the provided WIP query structure with pagination
            const query = encodeURIComponent(
                `SELECT Id,Delivery_Lifecycle__c,Epic__c,Name,Description__c,Estimated_Effort_Hours__c,Estimation_Completion_Date__c,Jira_Priority__c,Jira_Link__c,Type__c,Jira_Sprint_Details__c,Work_Type__c,Jira_Acceptance_Criteria__c,Initiative__c,Status__c FROM Feedback__c ${whereClause} ORDER BY CreatedDate DESC LIMIT ${limit} OFFSET ${offset}`
            );

            console.log('WIP Tasks - Final whereClause:', whereClause);
            console.log('WIP Tasks - Query with limit/offset:', limit, offset);
            console.log('WIP Tasks - Encoded Query:', query);

            const response = await fetch(`${this.salesforceBaseUrl}/services/data/v56.0/query/?q=${query}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('WIP Tasks - Response status:', response.status);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('WIP Tasks - API Error:', response.status, errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('WIP Tasks - Data received:', data.records?.length, 'records');
            
            // Get total count for pagination
            const countQuery = encodeURIComponent(
                `SELECT COUNT() FROM Feedback__c ${whereClause}`
            );
            
            let totalCount = data.records?.length || 0;
            try {
                const countResponse = await fetch(`${this.salesforceBaseUrl}/services/data/v56.0/query/?q=${countQuery}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (countResponse.ok) {
                    const countData = await countResponse.json();
                    totalCount = countData.totalSize || 0;
                }
            } catch (error) {
                console.warn('Failed to get WIP total count, using records length');
            }

            const recordsLength = data.records?.length || 0;
            const hasMore = (offset + limit) < totalCount;
            console.log(`WIP Tasks - Retrieved: ${recordsLength}, Total: ${totalCount}, Offset: ${offset}, Limit: ${limit}`);
            console.log(`WIP Tasks - HasMore calculation: (${offset} + ${limit}) < ${totalCount} = ${hasMore}`);

            return {
                tasks: data.records || [],
                totalCount,
                hasMore
            };
        } catch (error) {
            console.error('Error retrieving WIP tasks:', error);
            throw error;
        }
    }

    /**
     * Retrieve Running tasks (created via Manage Features) with pagination and search
     */
    async retrieveRunningTasks(options: { limit?: number; offset?: number; searchTerm?: string } = {}): Promise<{ tasks: Task[]; totalCount: number; hasMore: boolean }> {
        try {
            const token = await this.getAccessToken();
            const limit = options.limit || 20;
            const offset = options.offset || 0;

            // Build the WHERE clause for search
            let whereClause = '';
            if (options.searchTerm && options.searchTerm.trim()) {
                const searchTerm = options.searchTerm.trim().replace(/'/g, "\\'");
                console.log('Running Search term received:', searchTerm);
                // Only search by DEVSECOPS ticket ID in Jira_Link__c field
                const devsecopsPattern = /^DEVSECOPS-\d+$/i;
                console.log('Running Search: Testing pattern match for:', searchTerm, 'Pattern:', devsecopsPattern.toString());
                if (devsecopsPattern.test(searchTerm)) {
                    whereClause = `WHERE Jira_Link__c LIKE '%${searchTerm}%'`;
                    console.log('Running Search: ✓ DEVSECOPS pattern matched, using search for:', searchTerm);
                } else {
                    // If not a valid DEVSECOPS ID format, return no results
                    whereClause = `WHERE 1=0`;
                    console.log('Running Search: ✗ Invalid DEVSECOPS format, expected DEVSECOPS-NUMBER, got:', searchTerm);
                }
            } else {
                // No WHERE clause for running tasks when no search - show all
                whereClause = '';
                console.log('Running Search: No search term, showing all running tasks');
            }

            // Use the existing query structure with pagination
            const query = encodeURIComponent(
                `SELECT Id,Delivery_Lifecycle__c,Epic__c,Name,Description__c,Estimated_Effort_Hours__c,Estimation_Completion_Date__c,Jira_Priority__c,Jira_Link__c,Type__c,Jira_Sprint_Details__c,Work_Type__c,Jira_Acceptance_Criteria__c,Initiative__c,Deployment_Date__c,Status__c,Actual_Effort_Hours__c,Resolution__c FROM Feedback__c ${whereClause} ORDER BY CreatedDate DESC LIMIT ${limit} OFFSET ${offset}`
            );

            console.log('Running Tasks - Final whereClause:', whereClause);
            console.log('Running Tasks - Query with limit/offset:', limit, offset);
            console.log('Running Tasks - Encoded Query:', query);

            const response = await fetch(`${this.salesforceBaseUrl}/services/data/v56.0/query/?q=${query}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Running Tasks - Response status:', response.status);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Running Tasks - API Error:', response.status, errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('Running Tasks - Data received:', data.records?.length, 'records');
            
            // Get total count for pagination
            const countQuery = encodeURIComponent(
                `SELECT COUNT() FROM Feedback__c ${whereClause}`
            );
            
            let totalCount = data.records?.length || 0;
            try {
                const countResponse = await fetch(`${this.salesforceBaseUrl}/services/data/v56.0/query/?q=${countQuery}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (countResponse.ok) {
                    const countData = await countResponse.json();
                    totalCount = countData.totalSize || 0;
                }
            } catch (error) {
                console.warn('Failed to get total count, using records length');
            }

            const recordsLength = data.records?.length || 0;
            const hasMore = (offset + limit) < totalCount;
            console.log(`Running Tasks - Retrieved: ${recordsLength}, Total: ${totalCount}, Offset: ${offset}, Limit: ${limit}`);
            console.log(`Running Tasks - HasMore calculation: (${offset} + ${limit}) < ${totalCount} = ${hasMore}`);

            return {
                tasks: data.records || [],
                totalCount,
                hasMore
            };
        } catch (error) {
            console.error('Error retrieving running tasks:', error);
            throw error;
        }
    }

    /**
     * Update a task (Edit functionality) with comprehensive fields
     */
    async updateTask(taskId: string, updates: any): Promise<any> {
        try {
            const token = await this.getAccessToken();

            // Build the update payload with all possible fields
            const updatePayload: any = {};
            
            if (updates.estimatedHours !== undefined) {
                updatePayload.Estimated_Effort_Hours__c = updates.estimatedHours;
            }
            if (updates.epicId !== undefined) {
                updatePayload.Epic__c = updates.epicId;
            }
            if (updates.description !== undefined) {
                updatePayload.Description__c = updates.description;
            }
            if (updates.name !== undefined) {
                updatePayload.Name = updates.name;
            }
            if (updates.type !== undefined) {
                updatePayload.Type__c = updates.type;
            }
            if (updates.priority !== undefined) {
                updatePayload.Jira_Priority__c = updates.priority;
            }
            if (updates.acceptanceCriteria !== undefined) {
                updatePayload.Jira_Acceptance_Criteria__c = updates.acceptanceCriteria;
            }
            if (updates.status !== undefined) {
                updatePayload.Status__c = updates.status;
            }
            if (updates.workType !== undefined) {
                updatePayload.Work_Type__c = updates.workType;
            }
            if (updates.actualHours !== undefined) {
                updatePayload.Actual_Effort_Hours__c = updates.actualHours;
            }
            if (updates.resolution !== undefined) {
                updatePayload.Resolution__c = updates.resolution;
            }

            console.log('Updating task with payload:', updatePayload);

            const response = await fetch(`${this.salesforceBaseUrl}/services/data/v56.0/sobjects/Feedback__c/${taskId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatePayload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('PATCH request failed:', response.status, errorText);
                throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
            }

            return { success: true, message: 'Task updated successfully', taskId };
        } catch (error) {
            console.error('Error updating task:', error);
            throw error;
        }
    }

    /**
     * Get available epics for dropdown
     */
    async getAvailableEpics(): Promise<any[]> {
        try {
            const token = await this.getAccessToken();
            
            const query = encodeURIComponent(
                'SELECT Id, Name FROM Epic__c ORDER BY Name ASC'
            );

            const response = await fetch(`${this.salesforceBaseUrl}/services/data/v56.0/query/?q=${query}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.warn('Failed to fetch epics, using empty list');
                return [];
            }

            const data = await response.json();
            return data.records || [];
        } catch (error) {
            console.warn('Error fetching epics:', error);
            return [];
        }
    }

    /**
     * Delete a task (Remove from DevSecOps Hub)
     */
    async deleteTask(taskId: string): Promise<any> {
        try {
            const token = await this.getAccessToken();

            const response = await fetch(`${this.salesforceBaseUrl}/services/data/v56.0/sobjects/Feedback__c/${taskId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (response.status === 204) {
                return { success: true, message: 'Task deleted successfully' };
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            throw error;
        }
    }

    /**
     * Cleanup task (Remove from local list)
     */
    async cleanupTask(taskId: string): Promise<any> {
        try {
            // For cleanup, we just mark it as hidden locally
            // This doesn't call the API, just removes it from the UI
            return { success: true, message: 'Task removed from list' };
        } catch (error) {
            console.error('Error cleaning up task:', error);
            throw error;
        }
    }

    /**
     * Extract DEVSECOPS ticket number from Jira link
     */
    extractTicketNumber(jiraLink?: string): string {
        if (!jiraLink) {
            return 'N/A';
        }
        const match = jiraLink.match(/DEVSECOPS-(\d+)/);
        return match ? `DEVSECOPS-${match[1]}` : 'N/A';
    }
}