// AI Playbook Feature Module - Matches MS Editor AiPlaybook.js Exactly
(function(window) {
    'use strict';

    // State management
    let playbooks = [];
    let selectedPlaybook = null;
    let isLoading = false;
    let errorMessage = '';
    let runningPlaybook = null;
    let showDetailView = false;
    let selectedPlaybookForDetail = null;
    let playbookResults = null;
    let showResultsView = false;
    let isDrawerOpen = false;
    let activeContentPlaybook = null;
    let showCreateForm = false;
    let showCreatePage = false;
    
    // Expose to window for main.js
    window.showCreatePage = false;
    window.showCreateForm = false;
    let fileName = 'Untitled Document';
    let activeFilter = 'all';
    let filteredPlaybook = [];
    let isStreamingPlaybook = false;
    let streamBuffer = '';
    let streamHasEndMarker = false;
    let lastStreamSnapshot = null;
    const STREAM_END_MARKER = '---END_OF_ASSISTANT_RESPONSE---';

    // Initialize playbook view
    window.initPlaybookView = function() {
        const playbookView = document.getElementById('playbook-view');
        if (!playbookView) return;

        // Clear and render playbook list
        renderPlaybookList();
        
        // Fetch playbooks
        fetchPlaybooks();
    };

    // Render playbook list - matches MS Editor
    function renderPlaybookList() {
        const playbookView = document.getElementById('playbook-view');
        if (!playbookView) return;

        playbookView.innerHTML = `
            <div class="playbook-header-section">
                <button class="new-guide-button" onclick="handleNewGuideClick()">Create New Guide</button>
                <p class="header-subtitle">Or choose from the guides below</p>
            </div>
            <div class="playbook-content-section">
                <div id="playbook-list-container" class="playbook-list"></div>
                <div id="playbook-loading-container" class="loading-container" style="display: none;">
                    <div class="loading-spinner"></div>
                </div>
                <div id="playbook-error-container" class="error-container" style="display: none;"></div>
            </div>
        `;
    }

    // Fetch playbooks - matches MS Editor
    async function fetchPlaybooks() {
        let loaderTimeout = null;
        const loadingContainer = document.getElementById('playbook-loading-container');
        const listContainer = document.getElementById('playbook-list-container');
        const errorContainer = document.getElementById('playbook-error-container');
        
        try {
            isLoading = true;
            if (loadingContainer) loadingContainer.style.display = 'none';
            if (errorContainer) errorContainer.style.display = 'none';
            
            loaderTimeout = setTimeout(() => {
                if (loadingContainer) loadingContainer.style.display = 'flex';
            }, 300);
            
            const pluginData = window.getPluginData();
            const backendUrl = window.getBackendUrl();
            const accessToken = window.getAccessToken();

            if (!accessToken) {
                throw new Error('Access token not available');
            }

            const url = `/ai-assistant/global-playbooks`;
            const response = await window.pluginFetch(url);

            if (!response.ok) {
                const errorText = await response.text();
                let errorMsg = 'Failed to fetch playbooks';
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMsg = errorJson.msg || errorJson.message || errorMsg;
                } catch {
                    // If not JSON, use the text or status text
                    errorMsg = errorText || response.statusText || errorMsg;
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            
            if (data?.status && data?.data?.result?.length > 0) {
                playbooks = data.data.result;
                selectedPlaybook = playbooks[0];
                renderPlaybookItems();
                // Clear any error messages
                if (errorContainer) {
                    errorContainer.style.display = 'none';
                }
            } else if (data?.status && (!data?.data?.result || data.data.result.length === 0)) {
                // No playbooks found but API call was successful
                playbooks = [];
                renderPlaybookItems();
                if (errorContainer) {
                    errorContainer.style.display = 'none';
                }
            } else {
                // API returned error status
                const errorMsg = data?.msg || data?.message || 'No playbooks found';
                errorMessage = errorMsg;
                if (errorContainer) {
                    errorContainer.innerHTML = `<div class="error-message">${errorMessage}</div>`;
                    errorContainer.style.display = 'block';
                }
            }
        } catch (error) {
            errorMessage = error?.message || 'Failed to load playbooks';
            console.error('Error fetching playbooks:', error);
            if (errorContainer) {
                errorContainer.innerHTML = `<div class="error-message">${errorMessage}</div>`;
                errorContainer.style.display = 'block';
            }
            // Clear playbooks on error
            playbooks = [];
            renderPlaybookItems();
        } finally {
            if (loaderTimeout) clearTimeout(loaderTimeout);
            isLoading = false;
            if (loadingContainer) loadingContainer.style.display = 'none';
        }
    }

    // Render playbook items - matches MS Editor
    function renderPlaybookItems() {
        const listContainer = document.getElementById('playbook-list-container');
        if (!listContainer) return;

        if (playbooks.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <p class="empty-state-text">No guides available</p>
                </div>
            `;
            return;
        }

        const itemsHTML = playbooks.map(playbook => {
            const isStandard = playbook.organizationId === null;
            const rulesCount = playbook.rules?.length || 0;
            const isRunning = runningPlaybook === playbook._id;

            return `
                <div class="playbook-item" onclick="handlePlaybookClick('${playbook._id}')">
                    <div class="playbook-header">
                        <div class="playbook-info">
                            <p class="playbook-guidelines">
                                <span class="standard-text">${isStandard ? 'Standard' : 'Custom'}</span>
                                <span>•</span>
                                <span>${rulesCount} Guidelines</span>
                            </p>
                            <h3 class="playbook-title" title="${escapeHtml(playbook.name)}">${escapeHtml(playbook.name)}</h3>
                        </div>
                        <div class="playbook-actions">
                            <button class="run-button" onclick="event.stopPropagation(); handleRunPlaybook('${playbook._id}')" ${runningPlaybook !== null ? 'disabled' : ''}>
                                ${isRunning ? '<div class="loading-spinner-small"></div>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'}
                                Run
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        listContainer.innerHTML = itemsHTML;
    }

    // Handle playbook click
    window.handlePlaybookClick = function(playbookId) {
        const playbook = playbooks.find(pb => pb._id === playbookId);
        if (playbook) {
            selectedPlaybookForDetail = playbook;
            showDetailView = true;
            // Render detail view (would need PlaybookDetail component equivalent)
            renderPlaybookDetail(playbook);
        }
    };

    // Render playbook detail
    function renderPlaybookDetail(playbook) {
        // This would render the PlaybookDetail view
        // For now, just show a placeholder
        console.log('Show playbook detail:', playbook);
    }

    // Handle run playbook - matches MS Editor handleRunPlaybook
    window.handleRunPlaybook = async function(playbookId) {
        const pluginData = window.getPluginData();
        const backendUrl = window.getBackendUrl();
        const accessToken = window.getAccessToken();
        
        if (!pluginData.contractId || !accessToken) {
            showToast('Missing contract details', 'error');
                return;
            }

        const playbook = playbooks.find(pb => pb._id === playbookId);
        if (!playbook) return;

        selectedPlaybook = playbook;
        runningPlaybook = playbookId;
        errorMessage = '';
        showResultsView = true;
        playbookResults = null;
        filteredPlaybook = [];
        activeFilter = 'all';
        isDrawerOpen = false;
        activeContentPlaybook = null;
        isStreamingPlaybook = true;
        streamBuffer = '';
        streamHasEndMarker = false;
        lastStreamSnapshot = null;

        // Render results view
        renderResultsView();

        try {
            const params = new URLSearchParams({ contractId: pluginData.contractId });
            if (playbookId) {
                params.append('playbookId', playbookId);
            }

            const url = `/ai-assistant/run-playbook-stream?${params.toString()}`;
            const response = await window.pluginFetch(url, {
                method: 'GET'
            });

            if (!response.ok) {
                const text = await response.text();
                let errorMsg = text || 'Failed to stream playbook response';
                try {
                    const errorJson = JSON.parse(text);
                    errorMsg = errorJson.msg || errorJson.message || errorMsg;
                } catch {
                    // non json
                }
                throw new Error(errorMsg);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Streaming is not supported in this environment.');
            }

                const decoder = new TextDecoder();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                if (!value) continue;
                
                const chunk = decoder.decode(value, { stream: true });
                streamBuffer += chunk;

                if (streamHasEndMarker) {
                    continue;
                }

                const partial = parsePlaybookStreamPayload(streamBuffer);
                if (partial?.aiPlaybookResponse?.length) {
                    const snapshotKey = JSON.stringify(partial.aiPlaybookResponse);
                    if (snapshotKey === lastStreamSnapshot) {
                        continue;
                    }
                    lastStreamSnapshot = snapshotKey;
                    playbookResults = partial;
                    updateResultsView();
                }
            }

            const remaining = decoder.decode();
            if (remaining) {
                streamBuffer += remaining;
            }
        } catch (error) {
            console.error('Playbook stream error:', error);
            errorMessage = error?.message || 'Failed to run playbook';
            showToast(errorMessage, 'error');
            showResultsView = false;
            playbookResults = null;
            filteredPlaybook = [];
            activeFilter = 'all';
        } finally {
            isStreamingPlaybook = false;
            runningPlaybook = null;
            
            const finalPayload = parsePlaybookStreamPayload(streamBuffer, { includePostMarker: true });
            if (finalPayload) {
                playbookResults = finalPayload;
                updateResultsView();
                showToast('Playbook executed successfully!', 'success');
            } else if (!errorMessage) {
                errorMessage = 'Unable to parse AI playbook response';
                showToast(errorMessage, 'error');
            }
        }
    };

    // Parse playbook stream payload - matches MS Editor
    function parsePlaybookStreamPayload(raw, options = {}) {
        const { includePostMarker = false } = options;
        if (!raw) return null;

        let working = raw.replace(/\u0000/g, '');
        const markerIndex = working.indexOf(STREAM_END_MARKER);
        if (markerIndex >= 0) {
            streamHasEndMarker = true;
            if (includePostMarker) {
                working = working.replace(STREAM_END_MARKER, '');
            } else {
                working = working.slice(0, markerIndex);
            }
        }

        if (!working.trim()) return null;

        const sanitizedLines = working
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && line !== STREAM_END_MARKER)
            .filter((line) => !line.startsWith('event:'))
            .map((line) => (line.startsWith('data:') ? line.replace(/^data:\s*/, '') : line));

        const sanitizedPayload = sanitizedLines.join('\n');
        const matches = sanitizedPayload.match(/\{[\s\S]*?\}/g) || [];
        if (!matches.length) return null;

        const parsedObjects = [];
        matches.forEach((snippet) => {
            try {
                parsedObjects.push(JSON.parse(snippet));
            } catch {
                // ignore malformed json fragment
            }
        });

        if (!parsedObjects.length) return null;

        let tokenDetails = null;
        const analysisEntries = [];

        parsedObjects.forEach((obj) => {
            if (obj.token_details || obj.tokenDetails) {
                tokenDetails = obj.token_details || obj.tokenDetails;
                return;
            }
            if (Array.isArray(obj.aiPlaybookResponse)) {
                analysisEntries.push(...obj.aiPlaybookResponse);
                if (!tokenDetails && obj.token_details) tokenDetails = obj.token_details;
                return;
            }
            if (Array.isArray(obj.data)) {
                analysisEntries.push(...obj.data);
                if (!tokenDetails && obj.token_details) tokenDetails = obj.token_details;
                return;
            }
            analysisEntries.push(obj);
        });

        if (!analysisEntries.length) return null;

        const statusCounts = { met: 0, notMet: 0, NA: 0 };
        const statusMapping = {
            'Met': 'met',
            'Not met': 'notMet',
            'Not Met': 'notMet',
            'met': 'met',
            'notMet': 'notMet',
            'NA': 'na',
            'N/A': 'na',
            'na': 'na'
        };

        const dedupedEntries = [];
        const seen = new Map();

        analysisEntries.forEach((entry) => {
            const key =
                entry?.['Rule Index'] !== undefined
                    ? `idx-${entry['Rule Index']}`
                    : entry?.['Rule Number'] !== undefined
                        ? `rule-${entry['Rule Number']}`
                        : entry?.Rule
                            ? `ruleName-${entry.Rule}`
                            : JSON.stringify(entry);

            if (!seen.has(key)) {
                seen.set(key, true);
                dedupedEntries.push(entry);
            }
        });

        const processedResults = dedupedEntries
            .filter((entry) => {
                const hasRule = entry?.Rule && entry.Rule.trim().length > 0;
                const hasConclusion = entry?.Conclusion && entry.Conclusion.trim().length > 0;
                const hasEvaluation = entry?.Evaluation && entry.Evaluation.trim().length > 0;
                const hasSuggestion = entry?.Suggestion && entry.Suggestion.trim().length > 0;
                const hasStatus = entry?.Status && entry.Status.toString().trim().length > 0;
                return hasRule || hasConclusion || hasEvaluation || hasSuggestion || hasStatus;
            })
            .map((entry) => {
                const rawStatus = (entry?.Status || entry?.status || entry?.statusValue || 'NA').toString().trim();
                const statusValue = statusMapping[rawStatus] || 'na';
                if (statusValue === 'met') statusCounts.met += 1;
                else if (statusValue === 'notMet') statusCounts.notMet += 1;
                else statusCounts.NA += 1;

                return {
                    ...entry,
                    statusValue
                };
            });

        return {
            aiPlaybookResponse: processedResults,
            statusCount: statusCounts,
            tokenDetails: tokenDetails || null
        };
    }

    // Render results view - matches MS Editor
    function renderResultsView() {
        const playbookView = document.getElementById('playbook-view');
        if (!playbookView) return;

        playbookView.innerHTML = `
            <div class="results-root">
                <div class="results-header">
                    <div class="header-box">
                        <svg class="back-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" onclick="handleBackFromResults()" style="cursor: pointer;">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                        <p class="summary-text" onclick="handleBackFromResults()" style="cursor: pointer; margin: 0;">Back</p>
                    </div>
                    <div id="streaming-indicator" style="flex: 0 0 auto; width: 60px;"></div>
                </div>
                <div class="results-content" id="results-content"></div>
            </div>
        `;

        updateResultsView();
    }

    // Update results view
    function updateResultsView() {
        const resultsContent = document.getElementById('results-content');
        const streamingIndicator = document.getElementById('streaming-indicator');
        
        if (!resultsContent) return;

        const hasFinalData = Array.isArray(playbookResults?.aiPlaybookResponse) && playbookResults.aiPlaybookResponse.length > 0;
        const playBook = hasFinalData ? playbookResults.aiPlaybookResponse : [];
        const statusCount = playbookResults?.statusCount || {};
        
        // Update filtered playbook
        if (activeFilter === 'all') {
            filteredPlaybook = playBook;
        } else {
            filteredPlaybook = playBook.filter((item) => item?.statusValue === activeFilter);
        }

        // Update streaming indicator
        if (streamingIndicator) {
            const streamingPlaybookMeta = runningPlaybook && !hasFinalData
                ? playbooks.find((pb) => pb._id === runningPlaybook) || selectedPlaybook
                : selectedPlaybook;
            const streamingTotalCount = streamingPlaybookMeta?.rules?.length || 0;
            const streamingCompletedCount = playbookResults?.aiPlaybookResponse?.length || 0;
            const showStreamingIndicator = isStreamingPlaybook && streamingTotalCount > 0 && playBook.length > 0;
            const streamingProgressLabel =
                streamingTotalCount > 0
                    ? `${Math.min(streamingCompletedCount, streamingTotalCount)}/${streamingTotalCount} Done`
                    : 'Loading…';

            if (showStreamingIndicator) {
                streamingIndicator.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #6e6b7b; font-weight: 500;">
                        <div class="loading-spinner-small"></div>
                        <span>${streamingProgressLabel}</span>
                    </div>
                `;
            } else {
                streamingIndicator.innerHTML = '<div style="flex: 0 0 auto; width: 60px;"></div>';
            }
        }

        if (playBook.length === 0) {
            if (isStreamingPlaybook) {
                resultsContent.innerHTML = `
                    <div class="loading-container" style="position: relative;">
                        ${window.createProgressLoader ? '' : '<div class="loading-spinner"></div>'}
                    </div>
                `;
                if (window.createProgressLoader) {
                    window.createProgressLoader(resultsContent, {
                        title: 'Analyzing your contract playbook',
                        steps: [
                            'Reading playbook guidelines',
                            'Analyzing compliance requirements',
                            'Identifying gaps and risks',
                            'Generating recommendations'
                        ],
                        stepDelay: 1000,
                        minDisplayTime: 3000
                    });
                }
            } else {
                resultsContent.innerHTML = '<p class="empty-state-text">No playbook results available</p>';
            }
            return;
        }

        // Render filters and results
        const riskyPercentage = ((statusCount?.notMet || 0) / playBook.length) * 100;
        const favorablePercentage = ((statusCount?.met || 0) / playBook.length) * 100;
        const missingPercentage = ((statusCount?.NA || 0) / playBook.length) * 100;

        resultsContent.innerHTML = `
            <div style="padding: 10px; margin: 8px; background-color: rgb(128 128 128 / 15%); border-radius: 4px;">
                <div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 0.75rem; margin-bottom: 12px;">
                    <button class="filter-badge ${activeFilter === 'all' ? 'active' : ''}" onclick="filterWithResult('all', ${playBook.length})">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        <span>All</span>
                        <span class="badge-count">${playBook.length}</span>
                    </button>
                    <button class="filter-badge ${activeFilter === 'met' ? 'active' : ''}" onclick="filterWithResult('met', ${statusCount?.met || 0})">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="green" stroke="#ffff" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        <span>Favourable</span>
                        <span class="badge-count">${statusCount?.met || 0}</span>
                    </button>
                    <button class="filter-badge ${activeFilter === 'notMet' ? 'active' : ''}" onclick="filterWithResult('notMet', ${statusCount?.notMet || 0})">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="red" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        <span>Risky</span>
                        <span class="badge-count">${statusCount?.notMet || 0}</span>
                    </button>
                    <button class="filter-badge ${activeFilter === 'na' ? 'active' : ''}" onclick="filterWithResult('na', ${statusCount?.NA || 0})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                        <span>Missing</span>
                        <span class="badge-count">${statusCount?.NA || 0}</span>
                    </button>
                </div>
                ${!isStreamingPlaybook && hasFinalData ? `
                    <div style="display: flex; height: 20px; border-radius: 4px; overflow: hidden; background-color: #e9ecef; border: 1px solid #dee2e6;">
                        ${riskyPercentage > 0 ? `<div style="width: ${riskyPercentage}%; background-color: #dc3545; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: 600; min-width: ${riskyPercentage < 5 ? 'auto' : '0'};">
                            ${riskyPercentage >= 1 ? Math.round(riskyPercentage) + '%' : ''}
                        </div>` : ''}
                        ${favorablePercentage > 0 ? `<div style="width: ${favorablePercentage}%; background-color: #28a745; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: 600; min-width: ${favorablePercentage < 5 ? 'auto' : '0'};">
                            ${favorablePercentage >= 1 ? Math.round(favorablePercentage) + '%' : ''}
                        </div>` : ''}
                        ${missingPercentage > 0 ? `<div style="width: ${missingPercentage}%; background-color: #6c757d; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: 600; min-width: ${missingPercentage < 5 ? 'auto' : '0'};">
                            ${missingPercentage >= 1 ? Math.round(missingPercentage) + '%' : ''}
                        </div>` : ''}
                    </div>
                ` : ''}
            </div>
            <div style="border-top: 1px solid #6a666633;">
                ${filteredPlaybook.map((val, i) => {
                    const statusValue = val?.statusValue || 'na';
                    const badgeIcon = getBadgeIcon(statusValue);
                    return `
                        <div class="result-item" onclick="handleItemClick(${i})" style="background: rgb(128 128 128 / 15%); margin: 10px 9px; border-radius: 5px; padding: 12px; position: relative; cursor: pointer;">
                            <div style="display: flex; justifyContent: space-between; alignItems: flex-start; marginBottom: 8px;">
                                <div style="display: flex; gap: 0.5rem; alignItems: center; flex: 1;">
                                    ${badgeIcon}
                                    <span style="fontWeight: 600; fontSize: 14px;">Guideline</span>
                                </div>
                                <div style="padding: 4px; borderRadius: 4px;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" style="color: #666;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                            </div>
                            <p style="fontSize: 13px; fontWeight: 350; margin: 0; lineHeight: 1.4;">${escapeHtml(val?.Rule || '')}</p>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // Get badge icon
    function getBadgeIcon(statusValue) {
        if (statusValue === 'met') {
            return '<svg width="18" height="18" viewBox="0 0 24 24" fill="green" stroke="#ffff" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
        } else if (statusValue === 'notMet') {
            return '<svg width="18" height="18" viewBox="0 0 24 24" fill="red" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
        } else {
            return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>';
        }
    }

    // Filter with result
    window.filterWithResult = function(val, count) {
        if (activeFilter === val) {
            activeFilter = 'all';
        } else if (val === 'all') {
            activeFilter = 'all';
        } else if (count > 0) {
            activeFilter = val;
        }
        updateResultsView();
    };

    // Handle back from results
    window.handleBackFromResults = function() {
        showResultsView = false;
        playbookResults = null;
        activeFilter = 'all';
        filteredPlaybook = [];
        isDrawerOpen = false;
        activeContentPlaybook = null;
        isStreamingPlaybook = false;
        streamBuffer = '';
        streamHasEndMarker = false;
        lastStreamSnapshot = null;
        runningPlaybook = null;
        renderPlaybookList();
        fetchPlaybooks();
    };

    // Handle item click
    window.handleItemClick = function(index) {
        const item = filteredPlaybook[index];
        if (!item) return;
        
        activeContentPlaybook = item;
        isDrawerOpen = true;
        renderDrawer();
    };

    // Render drawer for playbook item details
    function renderDrawer() {
        if (!activeContentPlaybook) return;

        // Create drawer overlay and content
        const drawerOverlay = document.createElement('div');
        drawerOverlay.className = 'drawer-overlay';
        drawerOverlay.onclick = closeDrawer;
        
        const drawer = document.createElement('div');
        drawer.className = 'drawer';
        drawer.style.display = 'block';
        
        const status = activeContentPlaybook.Status || activeContentPlaybook.status;
        const statusValue = activeContentPlaybook.statusValue;
        const isNotMet = status === 'Not met' || status === 'notMet' || statusValue === 'notMet';
        
        drawer.innerHTML = `
            <div class="drawer-header">
                <button class="drawer-close-button" onclick="closePlaybookDrawer()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <h3 class="drawer-title">Guideline Details</h3>
            </div>
            <div class="drawer-content" style="padding: 12px; max-height: calc(90vh - 60px); overflow-y: auto;">
                ${isNotMet ? `
                    <div style="marginBottom: 12px;">
                        <strong>Guideline:</strong> <span style="color: #666;">${escapeHtml(activeContentPlaybook.Rule || 'No guideline text available')}</span>
                    </div>
                    <div style="marginBottom: 12px;">
                        <strong>Evaluation:</strong> <span style="color: #666;">${escapeHtml(activeContentPlaybook.Evaluation || 'No evaluation available')}</span>
                    </div>
                ` : `
                    <div style="marginBottom: 12px;">
                        <strong>Guideline:</strong>
                        <div style="color: #666; marginTop: 4px;">${escapeHtml(activeContentPlaybook.Rule || 'No guideline text available')}</div>
                    </div>
                    <div style="marginBottom: 12px;">
                        <strong>Conclusion:</strong>
                        <div style="color: #666; marginTop: 4px;">${escapeHtml(activeContentPlaybook.Conclusion || 'No conclusion available')}</div>
                    </div>
                    <div style="marginBottom: 12px;">
                        <strong>Evaluation:</strong>
                        <div style="color: #666; marginTop: 4px;">${escapeHtml(activeContentPlaybook.Evaluation || 'No evaluation available')}</div>
                    </div>
                `}
            </div>
        `;

        document.body.appendChild(drawerOverlay);
        document.body.appendChild(drawer);
    }

    // Close playbook drawer
    window.closePlaybookDrawer = function() {
        const drawer = document.querySelector('.drawer');
        const overlay = document.querySelector('.drawer-overlay');
        if (drawer) drawer.remove();
        if (overlay) overlay.remove();
        isDrawerOpen = false;
        activeContentPlaybook = null;
    };

    // Handle new guide click
    window.handleNewGuideClick = function() {
        showCreatePage = true;
        window.showCreatePage = true;
        renderCreatePage();
    };
    
    // Render create page - matches MS Editor CreateGuidePage
    function renderCreatePage() {
        const playbookView = document.getElementById('playbook-view');
        if (!playbookView) return;
        
        playbookView.innerHTML = `
            <div class="create-page-root">
                <div class="create-page-header">
                    <div class="create-page-header-left">
                        <svg class="back-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" onclick="handleBackFromCreatePage()" style="cursor: pointer;">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                        <span style="font-size: 14px; font-weight: 650;">Back</span>
                    </div>
                </div>
                <div class="create-page-content" id="create-page-content">
                    ${renderCreatePageContent()}
                </div>
            </div>
        `;
    }
    
    // Render create page content based on state
    function renderCreatePageContent() {
        if (isGeneratingPlaybook) {
            return renderGeneratingView();
        } else if (generatedPlaybook) {
            return renderGeneratedPlaybookView();
        } else {
            return renderInitialCreateView();
        }
    }
    
    // Render initial create view
    function renderInitialCreateView() {
        const pluginData = window.getPluginData();
        const fileName = pluginData?.fileName || 'Untitled Document';
        
        return `
            <div class="create-page-inner">
                <h1 style="font-size: 18px; font-weight: bold; color: #212529; margin: 0 0 12px 0; text-align: center;">
                    Create a new Guide
                </h1>
                
                <div class="flow-container">
                    <div class="image-container">
                        <div style="width: 80px; height: 80px; border: 2px solid #2667ff; border-radius: 8px; background: #f8f9ff; display: flex; align-items: center; justify-content: center;">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2667ff" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                        </div>
                    </div>
                    <div class="arrow">→</div>
                    <div class="image-container">
                        <div style="width: 80px; height: 80px; border: 2px solid #2667ff; border-radius: 8px; background: #f8f9ff; display: flex; align-items: center; justify-content: center; position: relative;">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2667ff" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M12 6v6l4 2"></path>
                            </svg>
                            <div style="position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; background: #2667ff; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                    <path d="M12 2v20M2 12h20"></path>
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
                
                <p class="instruction-text">
                    Open your standard contract and use AI to create your personalized Guide
                </p>
                
                <button class="generate-button" onclick="handleGenerateWithAI()" ${isGeneratingPlaybook ? 'disabled' : ''}>
                    ${isGeneratingPlaybook ? '<div class="loading-spinner-small"></div> Generating...' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Generate With AI'}
                </button>
            </div>
            
            <div class="create-page-footer">
                <p class="footer-text">Want to craft your own guidelines?</p>
                <span class="start-from-scratch" onclick="handleStartFromScratch()">Start From Scratch</span>
            </div>
        `;
    }
    
    // Render generating view
    function renderGeneratingView() {
        return `
            <div class="loading-container" style="position: relative; min-height: 400px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div style="width: 120px; height: 120px; margin: 10px auto 24px; position: relative;">
                    <div style="width: 80px; height: 120px; border: 3px solid #2667ff; border-radius: 12px; margin: 0 auto; position: relative; background-color: #f8f9ff;">
                        <div style="width: 70px; height: 100px; margin: 8px auto 0; display: flex; flex-direction: column; gap: 8px; padding: 8px;">
                            <div style="width: 100%; height: 8px; background-color: #2667ff; border-radius: 4px;"></div>
                            <div style="width: 80%; height: 8px; background-color: #2667ff; border-radius: 4px;"></div>
                            <div style="width: 90%; height: 8px; background-color: #2667ff; border-radius: 4px;"></div>
                            <div style="width: 70%; height: 8px; background-color: #2667ff; border-radius: 4px;"></div>
                        </div>
                        <div style="width: 20px; height: 2px; background-color: #2667ff; position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); border-radius: 1px;"></div>
                    </div>
                </div>
                <h2 style="font-size: 18px; font-weight: 600; color: #212529; margin: 0 0 8px 0;">Generating your Guide</h2>
                <p style="font-size: 14px; color: #6c757d; text-align: center; margin: 0 0 16px 0;">
                    AI is analyzing your contract and creating personalized guidelines...
                </p>
                <div class="loading-spinner"></div>
            </div>
        `;
    }
    
    // Render generated playbook view
    function renderGeneratedPlaybookView() {
        if (!generatedPlaybook) return '';
        
        const rulesHTML = generatedPlaybook.rules.map((rule, index) => {
            const isEditing = editingRuleIndex === index;
            return `
                <div class="rule-card ${isEditing ? 'editing' : ''}">
                    <div class="rule-number">Rule ${index + 1}</div>
                    ${isEditing ? `
                        <div>
                            <textarea class="rule-textarea" id="rule-textarea-${index}" placeholder="Enter rule text">${escapeHtml(rule)}</textarea>
                            <div class="rule-actions">
                                <button class="cancel-button" onclick="handleCancelEditRule()">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    Cancel
                                </button>
                                <button class="save-button" onclick="handleSaveRule(${index})">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    Save
                                </button>
                            </div>
                        </div>
                    ` : `
                        <div>
                            <div class="rule-text">${escapeHtml(rule)}</div>
                            <button class="edit-button" onclick="handleEditRule(${index})" title="Edit rule">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button class="delete-button" onclick="handleDeleteRule(${index})" title="Delete rule">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    `}
                </div>
            `;
        }).join('');
        
        return `
            <div class="generated-content">
                <div style="position: relative; width: 100%; margin-bottom: 20px;">
                    <input type="text" class="title-input" id="playbook-name-input" value="${escapeHtml(generatedPlaybook.name)}" placeholder="Click to edit guide name" onchange="handlePlaybookNameChange(this.value)">
                    <div style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #6c757d; pointer-events: none;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </div>
                </div>
                <div class="rules-grid">
                    ${rulesHTML}
                </div>
            </div>
            <button class="fixed-save-button" onclick="handleSaveGuide()" ${isSavingPlaybook ? 'disabled' : ''}>
                ${isSavingPlaybook ? '<div class="loading-spinner-small"></div> Saving...' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Save Guide'}
            </button>
        `;
    }
    
    // State for create page
    let isGeneratingPlaybook = false;
    let generatedPlaybook = null;
    let isSavingPlaybook = false;
    let editingRuleIndex = null;
    let editingRuleText = '';
    
    // Handle generate with AI
    window.handleGenerateWithAI = async function() {
        const pluginData = window.getPluginData();
        const backendUrl = window.getBackendUrl();
        const accessToken = window.getAccessToken();
        
        if (!pluginData.contractId || !accessToken) {
            showToast('Missing contract details', 'error');
            return;
        }
        
        isGeneratingPlaybook = true;
        const contentDiv = document.getElementById('create-page-content');
        if (contentDiv) {
            contentDiv.innerHTML = renderGeneratingView();
        }
        
        try {
            const url = `/ai-assistant/generate-playbook-with-ai`;
            const response = await window.pluginFetch(url, {
                method: 'POST',
                body: JSON.stringify({
                    contractId: pluginData.contractId,
                    fileName: pluginData.fileName || 'Untitled Document'
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                let errorMsg = 'Failed to generate playbook';
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMsg = errorJson.msg || errorJson.message || errorMsg;
                } catch {
                    errorMsg = errorText || response.statusText || errorMsg;
                }
                throw new Error(errorMsg);
            }
            
            const data = await response.json();
            
            if (data?.status && data?.data) {
                // Generate versioned name
                const versionedName = await generateVersionedName('AI Playbook');
                generatedPlaybook = {
                    ...data.data,
                    name: versionedName
                };
                showToast('AI generation completed successfully!', 'success');
            } else {
                throw new Error(data?.msg || 'Failed to generate playbook with AI');
            }
        } catch (error) {
            console.error('Error generating playbook:', error);
            showToast(error?.message || 'Failed to generate playbook with AI', 'error');
            // Reset to initial view on error
            generatedPlaybook = null;
        } finally {
            isGeneratingPlaybook = false;
            const contentDiv = document.getElementById('create-page-content');
            if (contentDiv) {
                contentDiv.innerHTML = renderCreatePageContent();
            }
        }
    };
    
    // Generate versioned name
    async function generateVersionedName(baseName) {
        try {
            const pluginData = window.getPluginData();
            const backendUrl = window.getBackendUrl();
            const accessToken = window.getAccessToken();
            
            if (!accessToken) return baseName;
            
            const url = `/ai-assistant/global-playbooks`;
            const response = await window.pluginFetch(url);
            
            if (response.ok) {
                const data = await response.json();
                if (data?.status && data?.data?.result) {
                    const existingNames = data.data.result
                        .filter(pb => pb.name && pb.name.startsWith(baseName))
                        .map(pb => pb.name);
                    
                    if (existingNames.length === 0) {
                        return baseName;
                    }
                    
                    // Find the highest version number
                    let maxVersion = 0;
                    existingNames.forEach(name => {
                        const match = name.match(/^(.+?)\s+(\d+)$/);
                        if (match && match[1] === baseName) {
                            const version = parseInt(match[2], 10);
                            if (version > maxVersion) {
                                maxVersion = version;
                            }
                        }
                    });
                    
                    return maxVersion > 0 ? `${baseName} ${maxVersion + 1}` : `${baseName} 1`;
                }
            }
        } catch (error) {
            console.error('Error generating versioned name:', error);
        }
        
        return baseName;
    }
    
    // Handle start from scratch
    window.handleStartFromScratch = function() {
        showCreateForm = true;
        window.showCreateForm = true;
        renderCreateForm();
    };
    
    // Render create form - matches MS Editor CreateGuideForm
    function renderCreateForm() {
        const playbookView = document.getElementById('playbook-view');
        if (!playbookView) return;
        
        playbookView.innerHTML = `
            <div class="create-form-root">
                <div class="create-form-header">
                    <div class="create-form-header-left">
                        <svg class="back-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" onclick="handleBackFromCreateForm()" style="cursor: pointer;">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                        <span style="font-size: 14px; font-weight: 650;">Back</span>
                    </div>
                </div>
                <div class="create-form-content" id="create-form-content">
                    <div class="create-form-inner">
                        <div style="margin-bottom: 16px;">
                            <label class="section-label">Guide Name</label>
                            <input type="text" class="title-input" id="form-playbook-name" placeholder="Enter guide name" value="Manual Playbook">
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label class="section-label">Guidelines</label>
                            <div id="guidelines-container">
                                <div class="guideline-item">
                                    <textarea class="guideline-input" placeholder="Enter guideline text" rows="3"></textarea>
                                    <button class="delete-guideline-button" onclick="handleDeleteGuideline(this)" style="display: none;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                            </div>
                            <button class="add-rule-button" onclick="handleAddGuideline()">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                Add Guideline
                            </button>
                        </div>
                        <button class="save-form-button" onclick="handleSaveFormGuide()" ${isSavingPlaybook ? 'disabled' : ''}>
                            ${isSavingPlaybook ? '<div class="loading-spinner-small"></div> Saving...' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Save Guide'}
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Show delete buttons when there are multiple guidelines
        updateGuidelineDeleteButtons();
    }
    
    // Handle add guideline
    window.handleAddGuideline = function() {
        const container = document.getElementById('guidelines-container');
        if (!container) return;
        
        const newItem = document.createElement('div');
        newItem.className = 'guideline-item';
        newItem.innerHTML = `
            <textarea class="guideline-input" placeholder="Enter guideline text" rows="3"></textarea>
            <button class="delete-guideline-button" onclick="handleDeleteGuideline(this)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        `;
        container.appendChild(newItem);
        updateGuidelineDeleteButtons();
    };
    
    // Handle delete guideline
    window.handleDeleteGuideline = function(button) {
        const item = button.closest('.guideline-item');
        if (item) {
            item.remove();
            updateGuidelineDeleteButtons();
        }
    };
    
    // Update guideline delete buttons visibility
    function updateGuidelineDeleteButtons() {
        const container = document.getElementById('guidelines-container');
        if (!container) return;
        
        const items = container.querySelectorAll('.guideline-item');
        items.forEach(item => {
            const deleteBtn = item.querySelector('.delete-guideline-button');
            if (deleteBtn) {
                deleteBtn.style.display = items.length > 1 ? 'flex' : 'none';
            }
        });
    }
    
    // Handle save form guide
    window.handleSaveFormGuide = async function() {
        const pluginData = window.getPluginData();
        const backendUrl = window.getBackendUrl();
        const accessToken = window.getAccessToken();
        
        if (!accessToken) {
            showToast('Access token not available', 'error');
            return;
        }
        
        const nameInput = document.getElementById('form-playbook-name');
        const name = nameInput ? nameInput.value.trim() : 'Manual Playbook';
        
        if (!name) {
            showToast('Please enter a guide name', 'error');
            return;
        }
        
        const container = document.getElementById('guidelines-container');
        if (!container) return;
        
        const textareas = container.querySelectorAll('.guideline-input');
        const rules = Array.from(textareas)
            .map(ta => ta.value.trim())
            .filter(rule => rule.length > 0);
        
        if (rules.length === 0) {
            showToast('Please add at least one guideline', 'error');
            return;
        }
        
        isSavingPlaybook = true;
        const saveButton = document.querySelector('.save-form-button');
        if (saveButton) {
            saveButton.disabled = true;
        }
        
        try {
            const url = `/ai-assistant/editor-create-playbook`;
            const response = await window.pluginFetch(url, {
                method: 'POST',
                body: JSON.stringify({
                    name: name,
                    rules: rules
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                let errorMsg = 'Failed to save guide';
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMsg = errorJson.msg || errorJson.message || errorMsg;
                } catch {
                    errorMsg = errorText || response.statusText || errorMsg;
                }
                throw new Error(errorMsg);
            }
            
            const data = await response.json();
            
            if (data?.status) {
                showToast('Guide saved successfully!', 'success');
                // Reset and go back to playbook list
                showCreateForm = false;
                showCreatePage = false;
                window.showCreateForm = false;
                window.showCreatePage = false;
                generatedPlaybook = null;
                isGeneratingPlaybook = false;
                renderPlaybookList();
                fetchPlaybooks();
            } else {
                throw new Error(data?.msg || 'Failed to save guide');
            }
        } catch (error) {
            console.error('Error saving guide:', error);
            showToast(error?.message || 'Failed to save guide', 'error');
        } finally {
            isSavingPlaybook = false;
            if (saveButton) {
                saveButton.disabled = false;
            }
        }
    };
    
    // Handle back from create page
    window.handleBackFromCreatePage = function() {
        showCreatePage = false;
        window.showCreatePage = false;
        generatedPlaybook = null;
        isGeneratingPlaybook = false;
        editingRuleIndex = null;
        editingRuleText = '';
        renderPlaybookList();
        fetchPlaybooks();
    };
    
    // Handle back from create form
    window.handleBackFromCreateForm = function() {
        showCreateForm = false;
        window.showCreateForm = false;
        renderCreatePage();
    };
    
    // Handle playbook name change
    window.handlePlaybookNameChange = function(value) {
        if (generatedPlaybook) {
            generatedPlaybook.name = value;
        }
    };
    
    // Handle edit rule
    window.handleEditRule = function(index) {
        if (!generatedPlaybook || !generatedPlaybook.rules) return;
        editingRuleIndex = index;
        editingRuleText = generatedPlaybook.rules[index] || '';
        const contentDiv = document.getElementById('create-page-content');
        if (contentDiv) {
            contentDiv.innerHTML = renderCreatePageContent();
            // Focus on textarea
            setTimeout(() => {
                const textarea = document.getElementById(`rule-textarea-${index}`);
                if (textarea) {
                    textarea.focus();
                    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
                }
            }, 100);
        }
    };
    
    // Handle save rule
    window.handleSaveRule = function(index) {
        const textarea = document.getElementById(`rule-textarea-${index}`);
        if (textarea && generatedPlaybook && generatedPlaybook.rules) {
            generatedPlaybook.rules[index] = textarea.value.trim();
            editingRuleIndex = null;
            editingRuleText = '';
            const contentDiv = document.getElementById('create-page-content');
            if (contentDiv) {
                contentDiv.innerHTML = renderCreatePageContent();
            }
        }
    };
    
    // Handle cancel edit rule
    window.handleCancelEditRule = function() {
        editingRuleIndex = null;
        editingRuleText = '';
        const contentDiv = document.getElementById('create-page-content');
        if (contentDiv) {
            contentDiv.innerHTML = renderCreatePageContent();
        }
    };
    
    // Handle delete rule
    window.handleDeleteRule = function(index) {
        if (generatedPlaybook && generatedPlaybook.rules) {
            generatedPlaybook.rules = generatedPlaybook.rules.filter((_, i) => i !== index);
            const contentDiv = document.getElementById('create-page-content');
            if (contentDiv) {
                contentDiv.innerHTML = renderCreatePageContent();
            }
        }
    };
    
    // Handle save guide (from generated playbook)
    window.handleSaveGuide = async function() {
        if (!generatedPlaybook) return;
        
        const pluginData = window.getPluginData();
        const backendUrl = window.getBackendUrl();
        const accessToken = window.getAccessToken();
        
        if (!accessToken) {
            showToast('Access token not available', 'error');
            return;
        }
        
        const nameInput = document.getElementById('playbook-name-input');
        const name = nameInput ? nameInput.value.trim() : generatedPlaybook.name;
        
        if (!name) {
            showToast('Please enter a guide name', 'error');
            return;
        }
        
        if (!generatedPlaybook.rules || generatedPlaybook.rules.length === 0) {
            showToast('Please add at least one rule', 'error');
            return;
        }
        
        isSavingPlaybook = true;
        const saveButton = document.querySelector('.fixed-save-button');
        if (saveButton) {
            saveButton.disabled = true;
        }
        
        try {
            const url = `/ai-assistant/editor-create-playbook`;
            const response = await window.pluginFetch(url, {
                method: 'POST',
                body: JSON.stringify({
                    name: name,
                    rules: generatedPlaybook.rules
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                let errorMsg = 'Failed to save guide';
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMsg = errorJson.msg || errorJson.message || errorMsg;
                } catch {
                    errorMsg = errorText || response.statusText || errorMsg;
                }
                throw new Error(errorMsg);
            }
            
            const data = await response.json();
            
            if (data?.status) {
                showToast('Guide saved successfully!', 'success');
                // Reset and go back to playbook list
                showCreatePage = false;
                window.showCreatePage = false;
                generatedPlaybook = null;
                isGeneratingPlaybook = false;
                editingRuleIndex = null;
                editingRuleText = '';
                renderPlaybookList();
                fetchPlaybooks();
            } else {
                throw new Error(data?.msg || 'Failed to save guide');
            }
        } catch (error) {
            console.error('Error saving guide:', error);
            showToast(error?.message || 'Failed to save guide', 'error');
        } finally {
            isSavingPlaybook = false;
            if (saveButton) {
                saveButton.disabled = false;
            }
        }
    };

    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Show toast
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast-message ${type === 'error' ? 'error' : ''}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // Wait for main.js to initialize
            setTimeout(initPlaybook, 100);
        });
    } else {
        setTimeout(initPlaybook, 100);
    }

    function initPlaybook() {
        // Playbook view will be initialized by main.js when Playbook tab is selected
        // This is just a placeholder initialization
    }

})(window);
