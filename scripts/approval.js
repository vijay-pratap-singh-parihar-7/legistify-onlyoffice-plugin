// Approval Feature Module - Matches MS Editor ClauseApproval.js Exactly
(function(window) {
    'use strict';

    // State management
    let clauseApprovalsList = [];
    let selectedClause = null;
    let loading = false;
    let loading2 = false;
    let loaderFor = { startApprovalLoading: false, isReminderLoading: false, downloadFileLoading: false };
    let showNewApprovalForm = false;
    let contractFollowers = null;
    let errors = {};
    let generatingSummary = false;
    let clauseApprovalsList1 = false;
    let timerRef = null;
    let errorMessage = '';

    let form = {
        contractId: '',
        clauseNo: '',
        clause: '',
        summary: '',
        standPosition: '',
        levels: [{ levelName: "Level-1", orgUsers: [], fullName: '' }],
        approvalId: '',
        reminderDays: ''
    };

    // Initialize approval view
    window.initApprovalView = function() {
        const approvalView = document.getElementById('approval-view');
        if (!approvalView) return;

        const pluginData = window.getPluginData();
        form.contractId = pluginData.contractId;

        // Render approval view structure
        renderApprovalView();
        
        // Fetch clause approvals list
        getClauseApprovalsList();
    };

    // Render approval view - matches MS Editor
    function renderApprovalView() {
        const approvalView = document.getElementById('approval-view');
        if (!approvalView) return;

        approvalView.innerHTML = `
            <div class="clause-approval-container" style="position: relative; height: 100vh; overflow: hidden; margin-top: -10px; display: flex; flex-direction: column;">
                <div class="feature-header">
                    <div style="width: 100%; display: flex; justify-content: space-between;">
                        <div class="header-box">
                            <svg class="back-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" onclick="handleApprovalBack()" style="cursor: pointer;">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                            <p class="summary-text">Clause Approval</p>
                        </div>
                        ${!selectedClause ? `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${showRemindAction() ? `
                                    <div title="Send Reminder" class="start-clause-button" onclick="sendApprovalsReminder()" style="padding: 4px 5px; cursor: pointer; border-radius: 5px; background-color: #0f6cbd; color: white; display: flex; align-items: center;">
                                        ${loaderFor.isReminderLoading ? '<div class="loading-spinner-small"></div>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"></path></svg>'}
                                    </div>
                                ` : ''}
                                ${showDownloadReportAction() ? `
                                    <div title="Download Report" class="start-clause-button" onclick="downloadApprovalMatrix()" style="padding: 4px 5px; cursor: pointer; border-radius: 5px; background-color: #0f6cbd; color: white; display: flex; align-items: center;">
                                        ${loaderFor.downloadFileLoading ? '<div class="loading-spinner-small"></div>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>'}
                                    </div>
                                ` : ''}
                                ${showStartClauseAction() ? `
                                    <div title="Start Clause Approvals" class="start-clause-button" onclick="startClauseApprovals()" style="padding: 4px 5px; cursor: pointer; border-radius: 5px; background-color: #0f6cbd; color: white; display: flex; align-items: center;">
                                        ${loaderFor.startApprovalLoading ? '<div class="loading-spinner-small"></div>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'}
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                    ${selectedClause ? `
                        <div style="display: flex; gap: 8px; align-items: center;">
                            ${getStatus(selectedClause[0]?.approvalWorkflowStatus) === 'Rejected' ? `
                                <div class="edit-clause-button" onclick="handleEditClause()" style="padding: 4px 5px; cursor: pointer; border-radius: 5px; background-color: #0f6cbd; color: white; display: flex; align-items: center;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </div>
                            ` : ''}
                            <span class="status-badge ${getStatusClass(selectedClause[0]?.approvalWorkflowStatus)}">
                                ${getStatus(selectedClause[0]?.approvalWorkflowStatus)}
                            </span>
                        </div>
                    ` : ''}
                </div>
                <div id="approval-content" style="flex: 1; overflow-y: auto; padding: 16px;"></div>
            </div>
        `;

        updateApprovalContent();
    }

    // Update approval content
    function updateApprovalContent() {
        const content = document.getElementById('approval-content');
        if (!content) return;

        if (loading) {
            content.innerHTML = '<div class="loading-container" style="margin-top: 100px;"><div class="loading-spinner"></div></div>';
            return;
        }

        if (showNewApprovalForm) {
            content.innerHTML = renderForm();
            return;
        }

        if (selectedClause) {
            content.innerHTML = renderClauseDetails();
            return;
        }

        // Render list view
        content.innerHTML = `
            <button class="new-approval-button" onclick="showNewApprovalFormHandler()" style="margin-bottom: 16px; width: 100%; padding: 10px; background: #2667ff; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
                +New Approval
            </button>
            <div id="approval-list-container"></div>
        `;

        renderApprovalList();
    }

    // Render approval list
    function renderApprovalList() {
        const container = document.getElementById('approval-list-container');
        if (!container) return;

        if (!Array.isArray(clauseApprovalsList) || clauseApprovalsList.length === 0) {
            container.innerHTML = '<div style="margin-top: 16px; color: #666;">No existing clause approvals found.</div>';
            return;
        }

        const listHTML = clauseApprovalsList.map((clause) => {
            const clauseNo = clause.approvalActivityLogs?.length 
                ? clause.approvalActivityLogs[clause.approvalActivityLogs.length - 1].newClauseNo 
                : clause.clauseNo;
            const isNotActive = clause?.currentLevelStatus === 'notActive';
            
            return `
                <div class="${isNotActive ? 'not-active-clause' : 'approval-card'}" onclick="getClauseApprovals('${clause._id}')" style="padding: 10px 15px; margin: 10px 0; border: 1px solid #ddd; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: ${isNotActive ? 'not-allowed' : 'pointer'}; background-color: ${isNotActive ? '#f5f5f5' : '#fff'};">
                    <div style="flex: 1;">
                        <strong>Clause No - ${escapeHtml(clauseNo)} Approval</strong>
                    </div>
                    <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                        <span class="status-badge ${getStatusClass(clause.approvalWorkflowStatus, clause?.currentLevelStatus)}">
                            ${getStatus(clause.approvalWorkflowStatus, clause?.currentLevelStatus)}
                        </span>
                        ${!isNotActive ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>' : ''}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = listHTML;
    }

    // Get clause approvals list
    async function getClauseApprovalsList() {
        try {
            loading = true;
            updateApprovalContent();

            const pluginData = window.getPluginData();
            const backendUrl = window.getBackendUrl();
            const accessToken = window.getAccessToken();

            if (!accessToken) {
                throw new Error('Access token not available');
            }

            const url = `${backendUrl}/clause-approval/clause-approvals-list?contractId=${pluginData.contractId}`;
            const response = await fetch(url, {
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch clause approvals');
            }

            const data = await response.json();
            if (data?.status && data?.data?.length > 0) {
                clauseApprovalsList = data.data;
            } else {
                clauseApprovalsList = [];
            }
        } catch (err) {
            console.error('Error fetching clause approvals:', err);
            errorMessage = "Something went wrong.";
        } finally {
            loading = false;
            updateApprovalContent();
        }
    }

    // Get clause approvals details
    window.getClauseApprovals = async function(approvalId) {
        const clause = clauseApprovalsList.find(c => c._id === approvalId);
        if (!clause || clause?.currentLevelStatus === 'notActive') return null;

        try {
            loading = true;
            updateApprovalContent();

            const pluginData = window.getPluginData();
            const backendUrl = window.getBackendUrl();
            const accessToken = window.getAccessToken();

            if (!accessToken) {
                throw new Error('Access token not available');
            }

            const url = `${backendUrl}/clause-approval/clause-approval-details?contractId=${pluginData.contractId}&approvalId=${approvalId}`;
            const response = await fetch(url, {
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch clause approval details');
            }

            const data = await response.json();
            if (data?.status && data?.data?.clauseApprovalDetails?.length > 0) {
                selectedClause = data.data.clauseApprovalDetails;
            } else {
                errorMessage = data.msg || 'Failed to load details';
            }
        } catch (err) {
            console.error('Error fetching clause approval details:', err);
            errorMessage = "Something went wrong.";
        } finally {
            loading = false;
            renderApprovalView();
            updateApprovalContent();
        }
    };

    // Render clause details
    function renderClauseDetails() {
        if (!selectedClause || !selectedClause[0]) return '';

        const data = selectedClause[0]?.approvalActivityLogs?.length 
            ? getRefindApprovals() 
            : { activeApproval: selectedClause[0] };

        const hasActivityLogs = selectedClause[0]?.approvalActivityLogs?.length > 0;

        let detailsHTML = '';

        if (hasActivityLogs) {
            detailsHTML = `
                <div style="margin-bottom: -6px; font-size: 14px;"><strong>New Workflow:</strong></div><br />
                <div style="margin-bottom: -6px; font-size: 13px;"><strong>Clause No:</strong> ${escapeHtml(data?.activeApproval.newClauseNo)}</div><br />
                <div style="margin-bottom: -6px; font-size: 13px;"><strong>Clause:</strong> ${escapeHtml(data?.activeApproval.newClause)}</div><br />
                <div style="margin-bottom: -6px; font-size: 13px;"><strong>Summary:</strong> ${escapeHtml(data?.activeApproval.newSummary)}</div><br />
                <div style="margin-bottom: 12px; font-size: 13px;"><strong>Implications of Deviation:</strong> ${escapeHtml(data?.activeApproval.newStandPosition)}</div>
                ${renderLevels(data?.activeApproval.newLevels || [])}
                <div style="margin-bottom: -6px; font-size: 14px; color: grey;"><strong>Rejected Workflow:</strong></div><br />
                ${renderRejectedWorkflows(data?.rejectedApprovals || [])}
            `;
    } else {
            detailsHTML = `
                <div style="margin-bottom: -6px; font-size: 13px;"><strong>Clause No:</strong> ${escapeHtml(selectedClause[0].clauseNo)}</div><br />
                <div style="margin-bottom: -6px; font-size: 13px;"><strong>Clause:</strong> ${escapeHtml(selectedClause[0].clause)}</div><br />
                <div style="margin-bottom: -6px; font-size: 13px;"><strong>Summary:</strong> ${escapeHtml(selectedClause[0].summary)}</div><br />
                <div style="margin-bottom: 12px; font-size: 13px;"><strong>Implications of Deviation:</strong> ${escapeHtml(selectedClause[0].standPosition)}</div>
                ${renderLevels(selectedClause[0]?.levels || [])}
            `;
        }

        return detailsHTML;
    }

    // Render levels
    function renderLevels(levels) {
        return levels.map((level, index) => {
            if (!level.orgUsers?.length) return '';
            
            const status = getStatus(level?.approvalStatus);
            const statusClass = getStatusClass(level?.approvalStatus);
            const fullName = level.orgUsers[0]?.fullName || level.fullName;
            const lastComment = level.activityLogs?.[level.activityLogs.length - 1]?.commentText || '';

            return `
                <div class="clause-details-card" style="border: 1px solid #ccc; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                    <div class="level-title" style="color: #0078D4; font-weight: 600; margin-bottom: 12px; font-size: 16px; display: flex; justify-content: flex-start; align-items: center; gap: 8px;">
                        Level ${index + 1}
                        <span class="status-badge ${statusClass}">${status}</span>
                    </div>
                    <div style="display: flex; justify-content: flex-start; align-items: center; margin-bottom: 12px;">
                        <strong>${escapeHtml(fullName)}</strong>
                    </div>
                    ${(status === 'Completed' || status === 'Rejected') ? `
                        <div style="font-size: 13px;">
                            <b>Remark:</b> ${escapeHtml(lastComment)}
                            <div class="approval-trail" style="margin-top: 8px; font-size: 13px;">
                                <div><strong>Approval Trail</strong></div>
                                <ul style="margin-left: 20px; padding-left: 0;">
                                    <li>${status === 'Completed' ? 'Approved' : 'Rejected'} ${formatTimestamp(status === 'Completed' ? level?.approvedTimestamp : level?.rejectedTimestamp)}</li>
                                    <li>Sent for approval ${formatTimestamp(level?.approvalRequestSentTimestamp)}</li>
                                </ul>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    // Render rejected workflows
    function renderRejectedWorkflows(rejectedApprovals) {
        // Simplified version - would need accordion implementation
        return rejectedApprovals.map((level, index) => `
            <div style="padding: 8px; border-bottom: 1px solid #ebe9f1;">
                <div style="font-size: 13px;">Clause No: ${escapeHtml(level?.newClauseNo || level?.clauseNo)}</div>
            </div>
        `).join('');
    }

    // Get refind approvals
    function getRefindApprovals() {
        const activityLog = selectedClause[0]?.approvalActivityLogs?.length 
            ? [...selectedClause[0]?.approvalActivityLogs] 
            : [];
        const activeApproval = activityLog?.length ? activityLog.pop() : selectedClause[0];
        const extractRejectedApproval = activityLog?.length ? activityLog : [];
        const rejectedApprovals = [selectedClause[0], ...extractRejectedApproval];

        return { activeApproval: activeApproval, rejectedApprovals: rejectedApprovals };
    }

    // Get status
    function getStatus(status, levelStatus) {
        const statusValue = levelStatus === 'notActive' ? 'notActive' : status;
        switch (statusValue) {
            case "approved": return "Completed";
            case "rejected": return "Rejected";
            case "pending": return "Pending";
            case "notActive": return "Not Started";
            default: return "Pending";
        }
    }

    // Get status class
    function getStatusClass(status, levelStatus) {
        const statusValue = levelStatus === 'notActive' ? 'notActive' : status;
        switch (statusValue) {
            case "approved": return "approved";
            case "rejected": return "rejected";
            case "pending": return "pending";
            case "notActive": return "pending";
            default: return "pending";
        }
    }

    // Show actions
    function showStartClauseAction() {
        return clauseApprovalsList?.some(val => val?.currentLevelStatus === 'notActive' && !showNewApprovalForm);
    }

    function showRemindAction() {
        return clauseApprovalsList?.some(val => (val?.approvalWorkflowStatus === 'pending' && val?.currentLevelStatus !== 'notActive') && !showNewApprovalForm);
    }

    function showDownloadReportAction() {
        return clauseApprovalsList?.every(val => val?.approvalWorkflowStatus === 'approved' && !showNewApprovalForm);
    }

    // Format timestamp
    function formatTimestamp(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const options = { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
        const formatted = date.toLocaleString('en-US', options);
        const [monthDay, year, time] = formatted.split(', ');
        const [month, day] = monthDay.split(' ');
        return `(${day} ${month}, ${year} @ ${time.toLowerCase()})`;
    }

    // Render form (simplified - full implementation would need AsyncSelect component)
    function renderForm() {
        return `
            <div class="form-container" style="flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; gap: 10px; justify-content: flex-start; align-items: center; width: 100%;">
                    <div style="flex: 1; width: 50%;">
                        <input type="text" placeholder="Clause No" value="${form.clauseNo}" onchange="handleFormInputChange('clauseNo', this.value)" style="width: 100%; padding: 8px; border: 1px solid ${errors.clauseNo ? 'red' : 'rgb(153 153 153 / 64%)'}; border-radius: 4px;" />
                        ${errors.clauseNo ? `<div style="color: red; margin: -5px 0; font-size: 12px;">${errors.clauseNo}</div>` : ''}
                    </div>
                    <div style="flex: 1; width: 50%;">
                        <select value="${form.reminderDays}" onchange="handleFormInputChange('reminderDays', this.value)" style="width: 100%; padding: 8px; border: 1px solid ${errors.reminderDays ? 'red' : 'rgb(153 153 153 / 64%)'}; border-radius: 4px;">
                            <option value="">Reminder</option>
                            ${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
                        </select>
                        ${errors.reminderDays ? `<div style="color: red; margin: -5px 0; font-size: 12px;">${errors.reminderDays}</div>` : ''}
                    </div>
                </div>
                <textarea placeholder="Clause" value="${form.clause}" onchange="handleFormInputChange('clause', this.value)" style="width: 100%; padding: 8px; border: 1px solid ${errors.clause ? 'red' : 'rgb(153 153 153 / 64%)'}; border-radius: 4px; height: 120px; resize: vertical;">${form.clause}</textarea>
                ${errors.clause ? `<div style="color: red; margin: -5px 0; font-size: 12px;">${errors.clause}</div>` : ''}
                <div style="width: 100%; margin-bottom: 8px; position: relative;">
                    <textarea placeholder="Summary" value="${form.summary}" onchange="handleFormInputChange('summary', this.value)" style="width: 100%; padding: 8px; border: 1px solid ${errors.summary ? 'red' : 'rgb(153 153 153 / 64%)'}; border-radius: 4px; height: 120px; resize: vertical;">${form.summary}</textarea>
                    ${errors.summary ? `<div style="color: red; margin: -5px 0; font-size: 12px;">${errors.summary}</div>` : ''}
                    <div style="display: flex; justify-content: flex-end; margin-top: 6px;">
                        <button onclick="handleGenerateSummary()" disabled="${generatingSummary || !form.clause}" style="padding: 6px 12px; font-size: 13px; color: ${(generatingSummary || !form.clause) ? 'black' : 'white'}; border: none; border-radius: 6px; cursor: ${generatingSummary ? 'not-allowed' : !form.clause ? 'not-allowed' : 'pointer'}; opacity: ${generatingSummary ? 0.6 : 1}; background: ${(generatingSummary || !form.clause) ? '#ccc' : '#2667ff'}; margin-bottom: -8px;">
                            ${generatingSummary ? 'Generating...' : 'Auto Summarize'}
                        </button>
                    </div>
                </div>
                <textarea placeholder="Implications of Deviation" value="${form.standPosition}" onchange="handleFormInputChange('standPosition', this.value)" style="width: 100%; padding: 8px; border: 1px solid ${errors.standPosition ? 'red' : 'rgb(153 153 153 / 64%)'}; border-radius: 4px; height: 120px; resize: vertical;">${form.standPosition}</textarea>
                ${errors.standPosition ? `<div style="color: red; margin: -5px 0; font-size: 12px;">${errors.standPosition}</div>` : ''}
                ${form.levels.map((level, index) => `
                    <div style="margin-bottom: 8px; width: 100%; display: flex; gap: 10px;">
                        <div style="width: 90%;">
                            <input type="text" placeholder="Search team members" value="${level.fullName || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
                        </div>
                        <div onclick="handleLevelDelete(${index})" style="padding: 8px; cursor: pointer; border-radius: 5px; background-color: rgb(223 20 20); color: white; display: flex; align-items: center;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </div>
                    </div>
                `).join('')}
                ${errors.level ? `<div style="color: red; margin: 0; font-size: 12px;">${errors.level}</div>` : ''}
                <button onclick="handleAddLevel()" style="width: 100%; margin-top: 8px; min-height: 40px; font-size: 14px; font-weight: 500; padding: 10px 16px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
                    + Add Level
                </button>
                ${loading2 ? '<div class="loading-spinner"></div>' : `
                    <button onclick="handleSubmitApproval()" style="align-self: center; min-width: 80px; min-height: 30px; font-size: 16px; padding: 8px 12px; font-weight: 600; background: #2667ff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Submit
                    </button>
                `}
            </div>
        `;
    }

    // Handle approval back
    window.handleApprovalBack = function() {
        if (showNewApprovalForm) {
            handleFormBackClick();
        } else if (selectedClause) {
            selectedClause = null;
            renderApprovalView();
            updateApprovalContent();
        } else {
            if (window.showReviewHub) {
                window.showReviewHub();
            }
        }
    };

    // Show new approval form
    window.showNewApprovalFormHandler = async function() {
        loading = true;
        updateApprovalContent();

        try {
            const pluginData = window.getPluginData();
            const backendUrl = window.getBackendUrl();
            const accessToken = window.getAccessToken();

            const url = `${backendUrl}/clause-approval/contract-followers?contractId=${pluginData.contractId}`;
            const response = await fetch(url, {
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data?.status && data?.data?.length > 0) {
                    contractFollowers = data.data;
                }
            }
        } catch (err) {
            console.error('Error fetching contract followers:', err);
        } finally {
            loading = false;
            showNewApprovalForm = true;
            renderApprovalView();
            updateApprovalContent();
        }
    };

    // Handle form input change
    window.handleFormInputChange = function(field, value) {
        form[field] = value;
        if (errors[field]) {
            delete errors[field];
        }
        updateApprovalContent();
    };

    // Handle form back click
    function handleFormBackClick() {
        showNewApprovalForm = false;
        form = {
            contractId: form.contractId,
            clauseNo: '',
            clause: '',
            summary: '',
            standPosition: '',
            levels: [{ levelName: "Level-1", orgUsers: [], fullName: '' }],
            approvalId: '',
            reminderDays: ''
        };
        errors = {};
        renderApprovalView();
        updateApprovalContent();
    }

    // Start clause approvals
    window.startClauseApprovals = async function() {
        try {
            loaderFor.startApprovalLoading = true;
            renderApprovalView();

            const pluginData = window.getPluginData();
            const backendUrl = window.getBackendUrl();
            const accessToken = window.getAccessToken();

            const url = `${backendUrl}/clause-approval/start-clause-approval?contractId=${pluginData.contractId}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data?.status) {
                    showToast('Approval Workflows Started Successfully', 'success');
                    getClauseApprovalsList();
                } else {
                    errorMessage = data.msg || 'Failed to start approvals';
                }
            }
        } catch (err) {
            console.error('Error starting clause approvals:', err);
            errorMessage = 'Something went wrong';
        } finally {
            loaderFor.startApprovalLoading = false;
            renderApprovalView();
        }
    };

    // Send approvals reminder
    window.sendApprovalsReminder = async function() {
        try {
            loaderFor.isReminderLoading = true;
            renderApprovalView();

            const pluginData = window.getPluginData();
            const backendUrl = window.getBackendUrl();
            const accessToken = window.getAccessToken();

            const url = `${backendUrl}/clause-approval/approval-reminder?contractId=${pluginData.contractId}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data?.status) {
                    showToast('Approval Reminder Sent Successfully', 'success');
                } else {
                    showToast('Something went wrong!', 'error');
                }
            }
        } catch (err) {
            console.error('Error sending reminder:', err);
            showToast('Something went wrong!', 'error');
        } finally {
            loaderFor.isReminderLoading = false;
            renderApprovalView();
        }
    };

    // Download approval matrix
    window.downloadApprovalMatrix = async function() {
        try {
            loaderFor.downloadFileLoading = true;
            renderApprovalView();

        const pluginData = window.getPluginData();
            const backendUrl = window.getBackendUrl();
            const accessToken = window.getAccessToken();

            const url = `${backendUrl}/clause-approval/approval-matrix?contractId=${pluginData.contractId}`;
            const response = await fetch(url, {
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data?.status && data?.data) {
                    window.open(data.data, '_blank');
                    showToast('Approval Matrix Downloaded Successfully', 'success');
                } else {
                    showToast('Something went wrong!', 'error');
                }
            }
        } catch (err) {
            console.error('Error downloading matrix:', err);
            showToast('Something went wrong!', 'error');
        } finally {
            loaderFor.downloadFileLoading = false;
            renderApprovalView();
        }
    };

    // Handle edit clause
    window.handleEditClause = function() {
        // Implementation for editing clause
        showToast('Edit functionality coming soon', 'info');
    };

    // Handle generate summary
    window.handleGenerateSummary = async function() {
        if (!form.clause) return;
        generatingSummary = true;
        updateApprovalContent();

        try {
            const backendUrl = window.getBackendUrl();
            const accessToken = window.getAccessToken();

            const url = `${backendUrl}/ai-assistant/generate-contract-clause-summary`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ clause: form.clause })
            });

            if (response.ok) {
                const data = await response.json();
                if (data?.status && data?.data) {
                    form.summary = data.data;
                }
            }
        } catch (error) {
            console.error('Error generating summary:', error);
        } finally {
            generatingSummary = false;
            updateApprovalContent();
        }
    };

    // Handle add level
    window.handleAddLevel = function() {
        const nextIndex = form.levels.length;
        form.levels.push({ levelName: `Level-${nextIndex + 1}`, orgUsers: [], fullName: '' });
        updateApprovalContent();
    };

    // Handle level delete
    window.handleLevelDelete = function(deleteIndex) {
        form.levels = form.levels
            .filter((_, idx) => idx !== deleteIndex)
            .map((level, idx) => ({
                ...level,
                levelName: `Level-${idx + 1}`
            }));
        updateApprovalContent();
    };

    // Handle submit approval
    window.handleSubmitApproval = async function() {
        // Validate form
        errors = {};
        if (!form.clauseNo) errors.clauseNo = "Clause No is required";
        if (!form.clause) errors.clause = "Clause is required";
        if (!form.summary) errors.summary = "Summary is required";
        if (!form.standPosition) errors.standPosition = "Stand Position is required";
        if (!form.reminderDays) errors.reminderDays = "Reminder days required";

        form.levels.forEach((level) => {
            if (!level.orgUsers.length) errors.level = "Approver is required";
        });

        if (Object.keys(errors).length > 0) {
            updateApprovalContent();
            return;
        }

        loading2 = true;
        updateApprovalContent();

        try {
            const backendUrl = window.getBackendUrl();
            const accessToken = window.getAccessToken();

            const url = `${backendUrl}/clause-approval/create-clause-approval`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(form)
            });

            if (response.ok) {
            const data = await response.json();
                if (data?.status) {
                    showNewApprovalForm = false;
                    showToast('Approval Workflow Created Successfully', 'success');
                    form = {
                        contractId: form.contractId,
                        clauseNo: '',
                        clause: '',
                        summary: '',
                        standPosition: '',
                        levels: [{ levelName: "Level-1", orgUsers: [], fullName: '' }],
                        approvalId: '',
                        reminderDays: ''
                    };
                    errors = {};
                    selectedClause = null;
                    getClauseApprovalsList();
                } else {
                    errorMessage = data.msg || 'Failed to create approval';
                }
            }
        } catch (err) {
            console.error('Error submitting approval:', err);
            errorMessage = 'Something went wrong';
        } finally {
            loading2 = false;
            renderApprovalView();
            updateApprovalContent();
        }
    };

    // Escape HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Show toast
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast-message ${type === 'error' ? 'error' : type === 'info' ? 'info' : ''}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

})(window);
