// Approval Feature Module - Matches MS Editor ClauseApproval.js Exactly
(function(window) {
    'use strict';

    // -------------------------------------------------------------------------
    // API PATHS - Centralized to match MS Editor (avoid drift)
    // -------------------------------------------------------------------------
    const APPROVAL_API = {
        LIST: (contractId) => `clause-approval/clause-approvals-list/${encodeURIComponent(contractId)}`,
        DETAILS: (contractId, approvalId) => `clause-approval/clause-approval-details?contractId=${encodeURIComponent(contractId)}&approvalId=${encodeURIComponent(approvalId)}`,
        CONTRACT_FOLLOWERS: (contractId) => `contract/contract-followers/${encodeURIComponent(contractId)}`,
        CREATE: 'clause-approval/create-clause-approval',
        START_WORKFLOW: (contractId) => `clause-approval/start-clause-approval-workflow/${encodeURIComponent(contractId)}`,
        REMINDER: (contractId) => `clause-approval/approval-reminder/${encodeURIComponent(contractId)}`,
        GET_APPROVAL_MATRIX_URL: (contractId) => `clause-approval/get-approval-matrix-url/${encodeURIComponent(contractId)}`,
        GENERATE_CLAUSE_SUMMARY: 'ai-assistant/generate-contract-clause-summary',
        ORG_USERS: (email) => `org-user/all-users?email=${encodeURIComponent(email || '')}`
    };

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

    // Team member dropdown portal (rendered to body to avoid drawer overflow clipping)
    let teamMemberPortalEl = null;
    let isTeamDropdownOpen = false;
    let isSelectingMember = false;
    const TEAM_MEMBER_DEBOUNCE_MS = 400;
    const FORM_INPUT_DEBOUNCE_MS = 250;
    let formInputDebounceTimer = null;

    // Reset approval state when drawer closes (prevents stale UI on reopen)
    window.resetApprovalState = function() {
        selectedClause = null;
        showNewApprovalForm = false;
        errorMessage = '';
        errors = {};
        form = {
            contractId: form.contractId || '',
            clauseNo: '',
            clause: '',
            summary: '',
            standPosition: '',
            levels: [{ levelName: 'Level-1', orgUsers: [], fullName: '' }],
            approvalId: '',
            reminderDays: ''
        };
    };

    // Initialize approval view
    window.initApprovalView = function() {
        // Check for drawer view first (cloned), then original view
        var approvalView = document.getElementById('clauseApproval-view-drawer') || document.getElementById('clauseApproval-view');
        if (!approvalView) {
            var container = document.getElementById('clauseApproval-container-drawer') || document.getElementById('clauseApproval-container');
            if (container) approvalView = container;
        }
        if (!approvalView) return;

        var pluginData = window.getPluginData();
        form.contractId = pluginData.contractId;

        renderApprovalView();
        getClauseApprovalsList();
    };

    // Render approval view - matches MS Editor
    function renderApprovalView() {
        // Check for drawer view first (cloned), then original view
        let approvalView = document.getElementById('clauseApproval-view-drawer') || document.getElementById('clauseApproval-view');
        if (!approvalView) {
            // Try to find by container
            const container = document.getElementById('clauseApproval-container-drawer') || document.getElementById('clauseApproval-container');
            if (container) {
                approvalView = container;
            }
        }
        if (!approvalView) return;
        
        // Check if we're in drawer (has -drawer suffix) or original view
        // Also check if we're inside drawer-content
        const isInDrawer = approvalView.closest('#drawer-content') !== null || 
                          approvalView.id === 'clauseApproval-view-drawer' || 
                          approvalView.id === 'clauseApproval-container-drawer';
        const containerId = isInDrawer ? 'clauseApproval-container-drawer' : 'clauseApproval-container';
        const contentId = isInDrawer ? 'approval-content-drawer' : 'approval-content';

        // NEVER render feature-header if in drawer (drawer has its own header)
        const shouldShowHeader = !isInDrawer;

        // One primary CTA: getPrimaryAction(list) -> always exactly one action when on list view
        var actionButtons = '';
        var list = Array.isArray(clauseApprovalsList) ? clauseApprovalsList : [];
        if (!selectedClause && !showNewApprovalForm) {
            var action = getPrimaryAction(list);
            if (typeof console !== 'undefined' && console.debug) {
                console.debug('[ClauseApproval] CTA Decision', { listLength: list.length, action: action });
            }
            if (action === 'download') {
                actionButtons = `
                <div title="Download Report" class="start-clause-button" onclick="downloadApprovalMatrix()" style="padding: 4px 5px; cursor: pointer; border-radius: 5px; background-color: #0f6cbd; color: white; display: flex; align-items: center;">
                    ${loaderFor.downloadFileLoading ? '<div class="loading-spinner-small"></div>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>'}
                </div>
            `;
            } else if (action === 'remind') {
                actionButtons = `
                <div title="Send Reminder" class="start-clause-button" onclick="sendApprovalsReminder()" style="padding: 4px 5px; cursor: pointer; border-radius: 5px; background-color: #0f6cbd; color: white; display: flex; align-items: center;">
                    ${loaderFor.isReminderLoading ? '<div class="loading-spinner-small"></div>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"></path></svg>'}
                </div>
            `;
            } else {
                actionButtons = `
                <div id="start_clause" title="Start Approval Workflow" class="start-clause-button" onclick="startClauseApprovals()" style="padding: 6px 12px; cursor: pointer; border-radius: 5px; background-color: #0f6cbd; color: white; display: flex; align-items: center; gap: 6px;">
                    ${loaderFor.startApprovalLoading ? '<div class="loading-spinner-small"></div>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>Start Approval Workflow</span>'}
                </div>
            `;
            }
        }
        
        // Build status badge HTML
        const statusBadge = selectedClause ? `
            ${getStatus(selectedClause[0]?.approvalWorkflowStatus) === 'Rejected' ? `
                <div class="edit-clause-button" onclick="handleEditClause()" style="padding: 4px 5px; cursor: pointer; border-radius: 5px; background-color: #0f6cbd; color: white; display: flex; align-items: center;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </div>
            ` : ''}
            <span class="status-badge ${getStatusClass(selectedClause[0]?.approvalWorkflowStatus)}">
                ${getStatus(selectedClause[0]?.approvalWorkflowStatus)}
            </span>
        ` : '';
        
        // When in drawer, show primary CTA in a slim bar so "Start Approval Workflow" is always visible
        var drawerActionsBar = (isInDrawer && actionButtons) ? `
            <div class="approval-drawer-actions" style="flex-shrink: 0; display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #e5e5e5; background: #fff;">
                ${actionButtons}
            </div>
        ` : '';

        approvalView.innerHTML = `
            <div id="${containerId}" class="clause-approval-container" style="position: relative; min-height: 0; height: 100%; overflow: hidden; margin-top: ${isInDrawer ? '0' : '-10px'}; display: flex; flex-direction: column; width: 100%;">
                ${errorMessage ? `<div id="approval-error-banner" class="approval-error-banner" style="padding: 10px 12px; margin: 8px; background: #ffebee; color: #c62828; border-radius: 4px; font-size: 13px;">${escapeHtml(errorMessage)}</div>` : ''}
                ${shouldShowHeader ? `
                <div class="feature-header">
                    <div style="width: 100%; display: flex; justify-content: space-between;">
                        <div class="header-box">
                            <svg class="back-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" onclick="handleApprovalBack()" style="cursor: pointer;">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                            <p class="summary-text">Clause Approval</p>
                        </div>
                        ${actionButtons ? `<div style="display: flex; align-items: center; gap: 8px;">${actionButtons}</div>` : ''}
                    </div>
                    ${statusBadge ? `<div style="display: flex; gap: 8px; align-items: center;">${statusBadge}</div>` : ''}
                </div>
                ` : ''}
                ${drawerActionsBar}
                <div id="${contentId}" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding: ${isInDrawer ? '7px 7px 50px 7px' : '0px'}; ${!isInDrawer ? 'padding-bottom: 50px;' : ''} min-height: 0; box-sizing: border-box; width: 100%; -webkit-overflow-scrolling: touch;"></div>
            </div>
        `;

        updateApprovalContent();
    }

    // Update approval content
    function updateApprovalContent() {
        var content = document.getElementById('approval-content-drawer') || document.getElementById('approval-content');
        if (!content) return;

        var activeEl = document.activeElement;
        var activeId = null;
        var selectionStart = 0;
        var selectionEnd = 0;
        if (activeEl && content.contains(activeEl)) {
            activeId = activeEl.id || null;
            if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') {
                selectionStart = activeEl.selectionStart != null ? activeEl.selectionStart : 0;
                selectionEnd = activeEl.selectionEnd != null ? activeEl.selectionEnd : 0;
            }
        }
        if (!activeId && activeEl && activeEl.id && (activeEl.id.startsWith('team-member-input-') || activeEl.className && activeEl.className.indexOf('approval-form') !== -1)) {
            activeId = activeEl.id;
        }

        function restoreFocus() {
            if (!activeId) return;
            setTimeout(function() {
                var el = document.getElementById(activeId);
                if (el) {
                    el.focus();
                    if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.setSelectionRange) {
                        var len = (el.value || '').length;
                        el.setSelectionRange(Math.min(selectionStart, len), Math.min(selectionEnd, len));
                    }
                }
            }, 0);
        }

        if (loading) {
            content.innerHTML = '<div class="loading-container" style="margin-top: 100px;"><div class="loading-spinner"></div></div>';
            restoreFocus();
            return;
        }

        if (showNewApprovalForm) {
            if (isTeamDropdownOpen) return;
            content.innerHTML = renderForm();
            restoreFocus();
            return;
        }

        if (selectedClause) {
            content.innerHTML = renderClauseDetails();
            restoreFocus();
            return;
        }

        // Check if we're in drawer to use correct container ID
        const isDrawer = content.id === 'approval-content-drawer';
        const listContainerId = isDrawer ? 'approval-list-container-drawer' : 'approval-list-container';
        
        // Render list view
        content.innerHTML = `
            <button class="new-approval-button" onclick="showNewApprovalFormHandler()" style="margin-bottom: 16px; width: 100%; padding: 10px; background: #2667ff; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
                +New Approval
            </button>
            <div id="${listContainerId}" style="padding-bottom: 40px; margin-bottom: 30px;"></div>
        `;

        renderApprovalList();
    }

    // Render approval list
    function renderApprovalList() {
        // Check for drawer container first, then original
        const container = document.getElementById('approval-list-container-drawer') || document.getElementById('approval-list-container');
        if (!container) return;

        if (!Array.isArray(clauseApprovalsList) || clauseApprovalsList.length === 0) {
            container.innerHTML = '<div style="margin-top: 16px; color: #666;">No existing clause approvals found.</div>';
            return;
        }

        var listHTML = clauseApprovalsList.map(function(clause) {
            var clauseNo = clause.approvalActivityLogs && clause.approvalActivityLogs.length
                ? clause.approvalActivityLogs[clause.approvalActivityLogs.length - 1].newClauseNo
                : clause.clauseNo;
            var isNotActive = isNotStartedLevel(clause && clause.currentLevelStatus);
            var approvalId = clause._id != null ? String(clause._id) : '';
            var safeId = approvalId.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return '<div class="' + (isNotActive ? 'not-active-clause' : 'approval-card') + '"' +
                (approvalId ? ' data-approval-id="' + safeId + '"' : '') +
                ' style="padding: 10px 15px; margin: 10px 0; border: 1px solid #ddd; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: ' + (isNotActive ? 'not-allowed' : 'pointer') + '; background-color: ' + (isNotActive ? '#f5f5f5' : '#fff') + ';">' +
                '<div style="flex: 1;"><strong>Clause No - ' + escapeHtml(clauseNo) + ' Approval</strong></div>' +
                '<div style="display: flex; gap: 8px; justify-content: center; align-items: center;">' +
                '<span class="status-badge ' + getStatusClass(clause.approvalWorkflowStatus, clause && clause.currentLevelStatus) + '">' + getStatus(clause.approvalWorkflowStatus, clause && clause.currentLevelStatus) + '</span>' +
                (!isNotActive ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>' : '') +
                '</div></div>';
        }).join('');

        container.innerHTML = listHTML;
    }

    // Get clause approvals list - always initializes clauseApprovalsList safely
    async function getClauseApprovalsList() {
        clauseApprovalsList = [];
        try {
            loading = true;
            updateApprovalContent();

            const pluginData = window.getPluginData();
            const backendUrl = window.getBackendUrl();
            const accessToken = window.getAccessToken();

            if (!pluginData || pluginData.contractId == null) {
                console.warn('Clause Approval: contractId from getPluginData() is missing', pluginData);
            }

            if (!accessToken) {
                throw new Error('Access token not available');
            }

            const url = `${backendUrl}/${APPROVAL_API.LIST(pluginData.contractId)}`;
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
            const list = (data && (data.status === true || data.status === 'true')) && Array.isArray(data.data)
                ? data.data
                : (data?.data || data?.result || []);
            clauseApprovalsList = Array.isArray(list) ? list : [];
            errorMessage = '';

            if (clauseApprovalsList.length === 0 && data && typeof data.status === 'boolean' && !data.status) {
                if (typeof console !== 'undefined' && console.debug) {
                    console.debug('Clause Approval: no workflows yet for contract (empty state); Start button will be shown.');
                }
            }
        } catch (err) {
            console.error('Error fetching clause approvals:', err);
            clauseApprovalsList = [];
            errorMessage = err && err.message ? err.message : 'Something went wrong.';
            showToast(errorMessage, 'error');
        } finally {
            loading = false;
            renderApprovalView();
        }
    }

    // Get clause approvals details
    window.getClauseApprovals = async function(approvalId) {
        const clause = clauseApprovalsList.find(c => c._id === approvalId);
        if (!clause || isNotStartedLevel(clause.currentLevelStatus)) return null;

        try {
            loading = true;
            updateApprovalContent();

            const pluginData = window.getPluginData();
            const backendUrl = window.getBackendUrl();
            const accessToken = window.getAccessToken();

            if (!accessToken) {
                throw new Error('Access token not available');
            }

            const url = `${backendUrl}/${APPROVAL_API.DETAILS(pluginData.contractId, approvalId)}`;
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
                errorMessage = '';
            } else {
                errorMessage = data?.msg || 'Failed to load details';
                showToast(errorMessage, 'error');
            }
        } catch (err) {
            console.error('Error fetching clause approval details:', err);
            errorMessage = err && err.message ? err.message : 'Something went wrong.';
            showToast(errorMessage, 'error');
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

    // Render rejected workflows - clause, summary, stand position, levels (matches MS Editor detail)
    function renderRejectedWorkflows(rejectedApprovals) {
        if (!rejectedApprovals || rejectedApprovals.length === 0) return '';
        return rejectedApprovals.map(function(level, index) {
            var clauseNo = escapeHtml(level.newClauseNo || level.clauseNo || '');
            var clause = escapeHtml(level.newClause || level.clause || '');
            var summary = escapeHtml(level.newSummary || level.summary || '');
            var standPos = escapeHtml(level.newStandPosition || level.standPosition || '');
            var levels = level.newLevels || level.levels || [];
            var levelsHtml = levels.filter(function(l) { return l.orgUsers && l.orgUsers.length > 0; }).map(function(lvl, lvlIdx) {
                var status = getStatus(lvl.approvalStatus);
                var statusClass = getStatusClass(lvl.approvalStatus);
                var fullName = (lvl.orgUsers[0] && lvl.orgUsers[0].fullName) || lvl.fullName || '';
                var comment = (lvl.activityLogs && lvl.activityLogs.length) ? lvl.activityLogs[lvl.activityLogs.length - 1].commentText : '';
                return '<div class="clause-details-card" style="border: 1px solid #ccc; border-radius: 8px; padding: 12px; margin-bottom: 12px;">' +
                    '<div class="level-title" style="color: #0078D4; font-weight: 600; margin-bottom: 8px; font-size: 14px;">Level ' + (lvlIdx + 1) + ' <span class="status-badge ' + statusClass + '">' + status + '</span></div>' +
                    '<div style="margin-bottom: 8px;"><strong>' + escapeHtml(fullName) + '</strong></div>' +
                    (comment ? '<div style="font-size: 13px;"><b>Remark:</b> ' + escapeHtml(comment) + '</div>' : '') +
                    '</div>';
            }).join('');
            return '<div style="padding: 12px; margin-bottom: 12px; border: 1px solid #ebe9f1; border-radius: 8px; background: #fafafa;">' +
                '<div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">Clause No: ' + clauseNo + '</div>' +
                '<div style="font-size: 13px; margin-bottom: 6px;"><strong>Clause:</strong> ' + clause + '</div>' +
                '<div style="font-size: 13px; margin-bottom: 6px;"><strong>Summary:</strong> ' + summary + '</div>' +
                '<div style="font-size: 13px; margin-bottom: 8px;"><strong>Implications of Deviation:</strong> ' + standPos + '</div>' +
                (levelsHtml ? '<div style="margin-top: 8px;">' + levelsHtml + '</div>' : '') +
                '</div>';
        }).join('');
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

    // Get status (uses normalized level status so "Not Started" / notActive both work)
    function getStatus(status, levelStatus) {
        var statusValue = isNotStartedLevel(levelStatus) ? 'notActive' : status;
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
        var statusValue = isNotStartedLevel(levelStatus) ? 'notActive' : status;
        switch (statusValue) {
            case "approved": return "approved";
            case "rejected": return "rejected";
            case "pending": return "pending";
            case "notActive": return "pending";
            default: return "pending";
        }
    }

    // -------------------------------------------------------------------------
    // Normalize backend status (handles Not Started, not_started, NOT_ACTIVE, etc.)
    // -------------------------------------------------------------------------
    function normalizeStatus(value) {
        return (value || '')
            .toString()
            .toLowerCase()
            .replace(/[\s_-]/g, '');
    }

    // -------------------------------------------------------------------------
    // State model helpers - single source of truth (list argument, normalized)
    // -------------------------------------------------------------------------
    function hasNotStartedWorkflows(list) {
        return list.some(function(item) {
            var level = normalizeStatus(item && item.currentLevelStatus);
            return level === 'notactive' || level === 'notstarted';
        });
    }

    function hasPendingWorkflows(list) {
        return list.some(function(item) {
            if (!item) return false;
            var level = normalizeStatus(item.currentLevelStatus);
            if (level === 'notactive' || level === 'notstarted') return false;
            return normalizeStatus(item.approvalWorkflowStatus) === 'pending';
        });
    }

    function isFullyApproved(list) {
        return list.length > 0 && list.every(function(item) {
            return item && normalizeStatus(item.approvalWorkflowStatus) === 'approved';
        });
    }

    // Strict priority: one primary CTA (download > remind > start)
    function getPrimaryAction(list) {
        if (isFullyApproved(list)) return 'download';
        if (hasPendingWorkflows(list)) return 'remind';
        return 'start'; // covers empty list + not started
    }

    function isNotStartedLevel(status) {
        var n = normalizeStatus(status);
        return n === 'notactive' || n === 'notstarted';
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

    // Render form - matches MS Editor exactly; team member dropdown uses portal (no inline dropdown)
    function renderForm() {
        return `
            <div class="form-container" style="width: 100%; padding: 12px; padding-bottom: 50px; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; overflow: visible; margin-bottom: 30px; min-height: 0;">
                <div class="form-row">
                    <div class="form-group">
                        <input type="text" placeholder="Clause No" value="${escapeHtml(form.clauseNo || '')}" oninput="handleFormInputChange('clauseNo', this.value)" class="approval-form-input" style="border-color: ${errors.clauseNo ? 'red' : '#d1d5db'};" />
                        <div class="error ${errors.clauseNo ? 'visible' : ''}">${escapeHtml(errors.clauseNo || '')}</div>
                    </div>
                    <div class="form-group">
                        <select id="approval-reminder-select" class="approval-form-select" style="border-color: ${errors.reminderDays ? 'red' : '#d1d5db'};" onchange="handleFormInputChange('reminderDays', this.value)">
                            <option value="">Reminder</option>
                            ${Array.from({ length: 10 }, function(_, i) {
                                var v = i + 1;
                                var selected = form.reminderDays == v || form.reminderDays === String(v) ? ' selected' : '';
                                return '<option value="' + v + '"' + selected + '>' + v + '</option>';
                            }).join('')}
                        </select>
                        <div class="error ${errors.reminderDays ? 'visible' : ''}">${escapeHtml(errors.reminderDays || '')}</div>
                    </div>
                </div>
                <div class="form-group">
                    <textarea placeholder="Clause" oninput="handleFormInputChange('clause', this.value)" class="approval-form-textarea" style="height: 120px; resize: vertical; border-color: ${errors.clause ? 'red' : '#d1d5db'}; box-sizing: border-box;">${escapeHtml(form.clause || '')}</textarea>
                    <div class="error ${errors.clause ? 'visible' : ''}">${escapeHtml(errors.clause || '')}</div>
                </div>
                <div class="form-group" style="width: 100%; margin-bottom: 8px; position: relative;">
                    <textarea placeholder="Summary" oninput="handleFormInputChange('summary', this.value)" class="approval-form-textarea" style="height: 120px; resize: vertical; border-color: ${errors.summary ? 'red' : '#d1d5db'}; box-sizing: border-box;">${escapeHtml(form.summary || '')}</textarea>
                    <div class="error ${errors.summary ? 'visible' : ''}">${escapeHtml(errors.summary || '')}</div>
                    <div style="display: flex; justify-content: flex-end; margin-top: 6px;">
                        <button type="button" class="auto-summarize-btn" onclick="handleGenerateSummary()" disabled="${generatingSummary || !form.clause}" style="margin-bottom: -8px;">
                            ${generatingSummary ? 'Generating...' : 'Auto Summarize'}
                        </button>
                    </div>
                </div>
                <div class="form-group">
                    <textarea placeholder="Implications of Deviation" oninput="handleFormInputChange('standPosition', this.value)" class="approval-form-textarea" style="height: 120px; resize: vertical; border-color: ${errors.standPosition ? 'red' : '#d1d5db'}; box-sizing: border-box;">${escapeHtml(form.standPosition || '')}</textarea>
                    <div class="error ${errors.standPosition ? 'visible' : ''}">${escapeHtml(errors.standPosition || '')}</div>
                </div>
                ${form.levels.map((level, index) => `
                    <div style="margin-bottom: 8px; width: 100%; display: flex; gap: 10px;">
                        <div style="width: 90%; position: relative;">
                            <input type="text"
                                id="team-member-input-${index}"
                                placeholder="Search team members"
                                value="${escapeHtml(level.fullName || '')}"
                                oninput="handleTeamMemberSearch(${index}, this.value)"
                                onfocus="handleTeamMemberFocus(${index})"
                                class="approval-form-input team-member-input"
                                style="border-color: ${errors.level ? 'red' : '#d1d5db'};"
                                autocomplete="off" />
                        </div>
                        <div onclick="handleLevelDelete(${index})" style="padding: 8px; cursor: pointer; border-radius: 5px; background-color: rgb(223 20 20); color: white; display: flex; align-items: center;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </div>
                    </div>
                `).join('')}
                <div class="form-group" style="margin-bottom: 0;">
                    <div class="error ${errors.level ? 'visible' : ''}">${escapeHtml(errors.level || '')}</div>
                </div>
                <button onclick="handleAddLevel()" style="width: 100%; margin-top: 8px; min-height: 40px; font-size: 14px; font-weight: 500; padding: 10px 16px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                    + Add Level
                </button>
                ${loading2 ? '<div class="loading-spinner"></div>' : `
                    <button onclick="handleSubmitApproval()" style="align-self: center; min-width: 80px; min-height: 30px; font-size: 16px; padding: 8px 12px; font-weight: 600; background: #2667ff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
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

            const url = `${backendUrl}/${APPROVAL_API.CONTRACT_FOLLOWERS(pluginData.contractId)}`;
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
            } else {
                const errData = await response.json().catch(() => ({}));
                errorMessage = errData?.msg || errData?.message || 'Failed to load contract followers';
                showToast(errorMessage, 'error');
            }
        } catch (err) {
            console.error('Error fetching contract followers:', err);
            errorMessage = err && err.message ? err.message : 'Something went wrong.';
            showToast(errorMessage, 'error');
        } finally {
            loading = false;
            showNewApprovalForm = true;
            renderApprovalView();
            updateApprovalContent();
        }
    };

    // Handle form input change: update state immediately; avoid full re-render while typing (prevents cursor jump)
    window.handleFormInputChange = function(field, value) {
        form[field] = value;
        if (errors[field]) {
            delete errors[field];
        }
        if (field === 'reminderDays') {
            updateApprovalContent();
            return;
        }
        if (isTeamDropdownOpen) {
            return;
        }
        if (field === 'clause') {
            var btn = document.querySelector('.auto-summarize-btn');
            if (btn) {
                btn.disabled = generatingSummary || !(value && value.trim && value.trim().length > 0);
            }
            return;
        }
        // clauseNo, summary, standPosition: update state only, no re-render (validation uses latest on submit)
        if (field === 'clauseNo' || field === 'summary' || field === 'standPosition') {
            return;
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

            const url = `${backendUrl}/${APPROVAL_API.START_WORKFLOW(pluginData.contractId)}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            if (response.ok) {
                const data = await response.json();
                if (data?.status) {
                    showToast('Approval Workflows Started Successfully', 'success');
                    errorMessage = '';
                    getClauseApprovalsList();
                } else {
                    errorMessage = data?.msg || 'Failed to start approvals';
                    showToast(errorMessage, 'error');
                }
            } else {
                const errData = await response.json().catch(() => ({}));
                errorMessage = errData?.msg || 'Failed to start approvals';
                showToast(errorMessage, 'error');
            }
        } catch (err) {
            console.error('Error starting clause approvals:', err);
            errorMessage = err && err.message ? err.message : 'Something went wrong';
            showToast(errorMessage, 'error');
        } finally {
            loaderFor.startApprovalLoading = false;
            renderApprovalView();
            updateApprovalContent();
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

            const url = `${backendUrl}/${APPROVAL_API.REMINDER(pluginData.contractId)}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            if (response.ok) {
                const data = await response.json();
                if (data?.status) {
                    showToast('Approval Reminder Sent Successfully', 'success');
                    getClauseApprovalsList();
                    return;
                } else {
                    showToast(data?.msg || 'Something went wrong!', 'error');
                }
            } else {
                const errData = await response.json().catch(() => ({}));
                showToast(errData?.msg || 'Something went wrong!', 'error');
            }
        } catch (err) {
            console.error('Error sending reminder:', err);
            showToast(err && err.message ? err.message : 'Something went wrong!', 'error');
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

            const url = `${backendUrl}/${APPROVAL_API.GET_APPROVAL_MATRIX_URL(pluginData.contractId)}`;
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
                    showToast(data?.msg || 'Something went wrong!', 'error');
                }
            } else {
                const errData = await response.json().catch(() => ({}));
                showToast(errData?.msg || 'Something went wrong!', 'error');
            }
        } catch (err) {
            console.error('Error downloading matrix:', err);
            showToast(err && err.message ? err.message : 'Something went wrong!', 'error');
        } finally {
            loaderFor.downloadFileLoading = false;
            renderApprovalView();
            updateApprovalContent();
        }
    };

    // Handle edit clause - full flow: use selectedClause, fetch followers, fill form, show form
    window.handleEditClause = async function() {
        if (!selectedClause || !selectedClause[0]) return;
        var clause = selectedClause[0];
        loading = true;
        updateApprovalContent();
        try {
            var pluginData = window.getPluginData();
            var backendUrl = window.getBackendUrl();
            var accessToken = window.getAccessToken();
            if (!accessToken) throw new Error('Access token not available');
            var url = backendUrl + '/' + APPROVAL_API.CONTRACT_FOLLOWERS(pluginData.contractId);
            var response = await fetch(url, {
                headers: { 'x-auth-token': accessToken, 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                var data = await response.json();
                if (data && data.status && data.data && data.data.length > 0) contractFollowers = data.data;
            }
        } catch (err) {
            console.error('Error fetching contract followers for edit:', err);
            showToast(err && err.message ? err.message : 'Something went wrong', 'error');
        } finally {
            loading = false;
        }
        var hasLogs = clause.approvalActivityLogs && clause.approvalActivityLogs.length > 0;
        var lastLog = hasLogs ? clause.approvalActivityLogs[clause.approvalActivityLogs.length - 1] : null;
        var rawLevels = (lastLog ? lastLog.newLevels : clause.levels) || [];
        form = {
            contractId: clause.contractId || form.contractId,
            clauseNo: lastLog ? lastLog.newClauseNo : clause.clauseNo,
            clause: lastLog ? lastLog.newClause : clause.clause,
            summary: lastLog ? lastLog.newSummary : clause.summary,
            standPosition: lastLog ? lastLog.newStandPosition : clause.standPosition,
            levels: [],
            approvalId: clause._id,
            reminderDays: clause.reminderDays || ''
        };
        if (rawLevels.length === 0) {
            form.levels = [{ levelName: 'Level-1', orgUsers: [], fullName: '' }];
        } else {
            form.levels = rawLevels.map(function(lvl, idx) {
                var uid = lvl.orgUsers && lvl.orgUsers[0];
                var id = typeof uid === 'object' && uid ? (uid._id || uid.id) : uid;
                var fn = (lvl.orgUsers && lvl.orgUsers[0] && lvl.orgUsers[0].fullName) || lvl.fullName || '';
                return {
                    levelName: 'Level-' + (idx + 1),
                    orgUsers: id ? [id] : [],
                    fullName: fn
                };
            });
        }
        errors = {};
        showNewApprovalForm = true;
        renderApprovalView();
        updateApprovalContent();
    };

    // Handle generate summary
    window.handleGenerateSummary = async function() {
        if (!form.clause) return;
        generatingSummary = true;
        updateApprovalContent();

        try {
            const backendUrl = window.getBackendUrl();
            const accessToken = window.getAccessToken();

            const url = `${backendUrl}/${APPROVAL_API.GENERATE_CLAUSE_SUMMARY}`;
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

    // Handle level input change (deprecated - use handleTeamMemberSearch)
    window.handleLevelInputChange = function(index, value) {
        if (form.levels[index]) {
            form.levels[index].fullName = value;
        }
    };

    // Team member dropdown portal helpers (avoids drawer overflow clipping)
    function getOrCreateTeamMemberPortal() {
        if (!teamMemberPortalEl) {
            teamMemberPortalEl = document.createElement('div');
            teamMemberPortalEl.className = 'team-member-dropdown-portal';
            teamMemberPortalEl.style.display = 'none';
            teamMemberPortalEl.style.zIndex = '10000';
            document.body.appendChild(teamMemberPortalEl);
        }
        return teamMemberPortalEl;
    }

    function closeTeamMemberPortal() {
        isTeamDropdownOpen = false;
        if (teamMemberPortalEl) {
            teamMemberPortalEl.style.display = 'none';
        }
    }

    function positionTeamMemberPortal(portal, input) {
        const rect = input.getBoundingClientRect();
        portal.style.position = 'fixed';
        portal.style.top = rect.bottom + 'px';
        portal.style.left = rect.left + 'px';
        portal.style.width = rect.width + 'px';
        portal.style.minWidth = rect.width + 'px';
    }

    // Handle team member search with debounce (400ms for faster UX)
    let searchTimers = {};
    window.handleTeamMemberSearch = function(index, value) {
        if (isSelectingMember) return;
        const input = document.getElementById(`team-member-input-${index}`);
        if (!input) return;

        if (form.levels[index]) {
            form.levels[index].fullName = value;
        }

        if (searchTimers[index]) {
            clearTimeout(searchTimers[index]);
        }

        if (value && value.trim().length > 0) {
            searchTimers[index] = setTimeout(function() {
                fetchTeamMembers(index, value.trim());
            }, TEAM_MEMBER_DEBOUNCE_MS);
        } else {
            closeTeamMemberPortal();
        }
    };

    // Handle team member input focus - show default list (empty query)
    window.handleTeamMemberFocus = function(index) {
        if (isSelectingMember) return;
        const input = document.getElementById(`team-member-input-${index}`);
        if (!input) return;
        fetchTeamMembers(index, '');
    };

    // Fetch team members from API; render into portal to avoid drawer overflow clipping
    async function fetchTeamMembers(index, searchValue) {
        if (isSelectingMember) return;
        const isSearch = searchValue && searchValue.trim().length >= 2;
        // Allow fetch if: search (>=2 chars) OR focus (empty value). Skip single-char typing.
        if (!isSearch && searchValue !== '') {
            closeTeamMemberPortal();
            return;
        }
        const input = document.getElementById(`team-member-input-${index}`);
        if (!input) return;

        const portal = getOrCreateTeamMemberPortal();
        positionTeamMemberPortal(portal, input);
        portal.style.display = 'block';
        isTeamDropdownOpen = true;
        portal.innerHTML = '<div class="dropdown-loading" style="padding: 12px; text-align: center; color: #666; font-size: 12px;">Loading...</div>';

        try {
            const pluginData = window.getPluginData();
            const backendUrl = window.getBackendUrl();
            const accessToken = window.getAccessToken();

            if (!accessToken) {
                throw new Error('Access token not available');
            }

            const selectedUserIds = (form.levels
                ?.flatMap((level) => level?.orgUsers)
                ?.filter(Boolean)
                ?.map((user) => String(typeof user === 'object' ? user._id : user)) || []);

            const query = isSearch ? (searchValue || '').trim().replace(/\W/g, '') : '';

            const url = `${backendUrl}/${APPROVAL_API.ORG_USERS(query)}`;
            const response = await fetch(url, {
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const rawUsers = data?.data?.orgUsers || data?.data?.users || data?.orgUsers || data?.users;
                const orgUsers = Array.isArray(rawUsers) ? rawUsers : [];

                if ((data?.status !== false) && orgUsers.length > 0) {
                    const filteredUsers = orgUsers.filter(
                        (item) => !selectedUserIds.includes(String(item._id != null ? item._id : item.id))
                    );

                    if (filteredUsers.length > 0) {
                        portal.innerHTML = filteredUsers.map((user) => {
                            const rawName = user.fullName || user.name || '';
                            const safeName = escapeHtml(rawName);
                            const safeId = String(user._id || user.id || '').replace(/'/g, "&#39;").replace(/"/g, "&quot;");
                            const safeNameAttr = rawName.replace(/\\/g, "\\\\").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;");
                            return '<div class="dropdown-item" onclick="selectTeamMember(' + index + ', \'' + safeNameAttr.replace(/'/g, "&#39;") + '\', \'' + safeId + '\')">' + safeName + '</div>';
                        }).join('');
                    } else if (isSearch && !isSelectingMember) {
                        portal.innerHTML = '<div style="padding: 12px; text-align: center; color: #666; font-size: 12px;">No team members found</div>';
                    }
                } else if (isSearch && !isSelectingMember) {
                    portal.innerHTML = '<div style="padding: 12px; text-align: center; color: #666; font-size: 12px;">No team members found</div>';
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData.msg || errorData.message || 'Error loading team members';
                portal.innerHTML = '<div style="padding: 12px; text-align: center; color: #d32f2f; font-size: 12px;">' + escapeHtml(errorMsg) + '</div>';
            }
        } catch (err) {
            console.error('Error fetching team members:', err);
            portal.innerHTML = '<div style="padding: 12px; text-align: center; color: #d32f2f; font-size: 12px;">Error loading team members</div>';
        }
    }

    // Select team member from dropdown
    window.selectTeamMember = function(index, fullName, userId) {
        isSelectingMember = true;
        closeTeamMemberPortal();

        if (form.levels[index]) {
            form.levels[index].orgUsers = [{ _id: userId }];
            form.levels[index].fullName = fullName;
        }

        const input = document.getElementById('team-member-input-' + index);
        if (input) {
            input.value = fullName;
        }

        if (errors.level) {
            delete errors.level;
        }

        setTimeout(function() {
            isSelectingMember = false;
            updateApprovalContent();
        }, 200);
    };

    // Close portal when clicking outside (not on input or portal)
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.team-member-input') && !event.target.closest('.team-member-dropdown-portal')) {
            closeTeamMemberPortal();
        }
    });

    // Delegated click for clause list: safe handling of approval ID (no inline onclick, no special-char issues)
    document.addEventListener('click', function(event) {
        var card = event.target.closest('.approval-card[data-approval-id]');
        if (!card) return;
        var id = card.getAttribute('data-approval-id');
        if (id && window.getClauseApprovals) window.getClauseApprovals(id);
    });

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

    // Build create-approval payload; normalize levels.orgUsers to match backend (objects with _id)
    function buildCreateApprovalPayload() {
        const levels = (form.levels || []).map(function(level, idx) {
            const orgUsers = (level.orgUsers || []).filter(Boolean).map(function(u) {
                if (typeof u === 'object' && u !== null && (u._id || u.id)) return { _id: u._id || u.id };
                return typeof u === 'string' ? { _id: u } : u;
            });
            return {
                levelName: level.levelName || 'Level-' + (idx + 1),
                orgUsers: orgUsers,
                fullName: level.fullName || ''
            };
        });
        return {
            contractId: form.contractId,
            clauseNo: form.clauseNo,
            clause: form.clause,
            summary: form.summary,
            standPosition: form.standPosition,
            levels: levels,
            approvalId: form.approvalId || '',
            reminderDays: form.reminderDays
        };
    }

    // Handle submit approval
    window.handleSubmitApproval = async function() {
        // Validate form
        errors = {};
        if (!form.clauseNo) errors.clauseNo = "Clause No is required";
        if (!form.clause) errors.clause = "Clause is required";
        if (!form.summary) errors.summary = "Summary is required";
        if (!form.standPosition) errors.standPosition = "Stand Position is required";
        if (!form.reminderDays) errors.reminderDays = "Reminder days required";

        (form.levels || []).forEach(function(level) {
            if (!level.orgUsers || level.orgUsers.length === 0) errors.level = "Approver is required";
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

            const payload = buildCreateApprovalPayload();
            const url = `${backendUrl}/${APPROVAL_API.CREATE}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
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
                    showToast(errorMessage, 'error');
                }
            } else {
                const errData = await response.json().catch(function() { return {}; });
                errorMessage = errData.msg || 'Failed to create approval';
                showToast(errorMessage, 'error');
            }
        } catch (err) {
            console.error('Error submitting approval:', err);
            errorMessage = err && err.message ? err.message : 'Something went wrong';
            showToast(errorMessage, 'error');
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
        return div.innerHTML.replace(/'/g, "&#39;").replace(/"/g, "&quot;");
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
