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

            const url = `${backendUrl}/ai-assistant/global-playbooks`;
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': accessToken
                }
            });

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

    // Render playbook detail - matches MS Editor exactly
    function renderPlaybookDetail(playbook) {
        const playbookView = document.getElementById('playbook-view');
        if (!playbookView) return;
        
        const rules = playbook.rules || [];
        const isStandard = playbook.organizationId === null;
        
        // Always show edit button, delete button only for custom playbooks (matches MS Editor pattern)
        const isEditable = true; // Always allow editing (matches MS Editor)
        
        playbookView.innerHTML = `
            <div class="playbook-detail-root">
                <div class="playbook-detail-header">
                    <div class="playbook-detail-header-left">
                        <svg class="back-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" onclick="handleBackFromDetail()" style="cursor: pointer;">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                        <span style="font-size: 14px; font-weight: 650; cursor: pointer;" onclick="handleBackFromDetail()">Back</span>
                        <span style="font-size: 16px; font-weight: 650; margin-left: 8px; color: #212529;">${escapeHtml(playbook.name)}</span>
                    </div>
                    ${isEditable ? `
                    <div class="playbook-detail-header-actions">
                        <button class="playbook-detail-edit-button" onclick="handleEditPlaybook('${playbook._id}')" title="Edit guide name and rules">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        ${!isStandard ? `
                        <button class="playbook-detail-delete-button" onclick="handleDeletePlaybook('${playbook._id}')" title="Delete this playbook">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                        ` : ''}
                    </div>
                    ` : ''}
                </div>
                <div class="playbook-detail-content">
                    <div class="playbook-detail-info">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">
                            <span class="standard-text">${isStandard ? 'Standard' : 'Custom'}</span>
                            <span>•</span>
                            <span style="font-size: 14px; color: #6c757d;">${rules.length} Guidelines</span>
                        </div>
                    </div>
                    <div class="playbook-detail-guidelines">
                        <h3 style="font-size: 14px; font-weight: 600; color: #2667ff; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.3px;">Guidelines</h3>
                        <div class="guidelines-list">
                            ${rules.map((rule, index) => {
                                const ruleText = typeof rule === 'string' ? rule : rule.rule || rule.text || '';
                                return `
                                    <div class="guideline-detail-item">
                                        <div class="guideline-number">${index + 1}</div>
                                        <div class="guideline-text">${escapeHtml(ruleText)}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
                <div class="playbook-detail-actions">
                    <button class="run-playbook-detail-button" onclick="handleRunPlaybookFromDetail('${playbook._id}')" ${runningPlaybook !== null ? 'disabled' : ''}>
                        ${runningPlaybook === playbook._id ? '<div class="loading-spinner-small"></div>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>'}
                        Run Guide
                    </button>
                </div>
            </div>
        `;
    }
    
    // Handle edit playbook
    window.handleEditPlaybook = function(playbookId) {
        // TODO: Implement edit functionality
        showToast('Edit functionality coming soon', 'info');
    };
    
    // Handle delete playbook
    window.handleDeletePlaybook = async function(playbookId) {
        if (!confirm('Are you sure you want to delete this guide?')) {
            return;
        }
        
        const pluginData = window.getPluginData();
        const backendUrl = window.getBackendUrl();
        const accessToken = window.getAccessToken();
        
        if (!accessToken) {
            showToast('Access token not available', 'error');
            return;
        }
        
        try {
            const url = `${backendUrl}/ai-assistant/delete-playbook/${playbookId}`;
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': accessToken
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data?.status) {
                    showToast('Guide deleted successfully', 'success');
                    handleBackFromDetail();
                } else {
                    throw new Error(data?.msg || 'Failed to delete guide');
                }
            } else {
                throw new Error('Failed to delete guide');
            }
        } catch (error) {
            console.error('Error deleting playbook:', error);
            showToast(error?.message || 'Failed to delete guide', 'error');
        }
    };
    
    // Handle back from detail
    window.handleBackFromDetail = function() {
        showDetailView = false;
        selectedPlaybookForDetail = null;
        renderPlaybookList();
        fetchPlaybooks();
    };
    
    // Handle run playbook from detail
    window.handleRunPlaybookFromDetail = function(playbookId) {
        handleRunPlaybook(playbookId);
    };

    // Handle run playbook - matches MS Editor handleRunPlaybook
    window.handleRunPlaybook = async function(playbookId) {
        const pluginData = window.getPluginData();
        const backendUrl = window.getBackendUrl();
        const accessToken = window.getAccessToken();
        
        console.log('🔍 Running playbook:', { playbookId, contractId: pluginData?.contractId, backendUrl, hasToken: !!accessToken });
        
        if (!pluginData?.contractId || !accessToken) {
            const errorMsg = !pluginData?.contractId ? 'Missing contract ID' : 'Missing access token';
            console.error('❌', errorMsg, pluginData);
            showToast(errorMsg, 'error');
            return;
        }

        const playbook = playbooks.find(pb => pb._id === playbookId);
        if (!playbook) {
            console.error('❌ Playbook not found:', playbookId);
            showToast('Playbook not found', 'error');
            return;
        }

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

        // Ensure Playbook tab is active and view is visible
        if (window.handleTabChange) {
            window.handleTabChange('Playbook');
        }
        if (window.setActiveContent) {
            window.setActiveContent('playbook');
        }

        // Render results view
        renderResultsView();

        try {
            const params = new URLSearchParams({ contractId: pluginData.contractId });
            if (playbookId) {
                params.append('playbookId', playbookId);
            }

            const url = `${backendUrl}/ai-assistant/run-playbook-stream?${params.toString()}`;
            console.log('📡 Fetching:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'accept-language': 'en-US,en;q=0.9',
                    'x-auth-token': accessToken
                }
            });

            console.log('📥 Response status:', response.status, response.ok);

            if (!response.ok) {
                const text = await response.text();
                let errorMsg = text || 'Failed to stream playbook response';
                try {
                    const errorJson = JSON.parse(text);
                    errorMsg = errorJson.msg || errorJson.message || errorMsg;
                } catch {
                    // non json
                }
                console.error('❌ API Error:', errorMsg);
                throw new Error(errorMsg);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Streaming is not supported in this environment.');
            }

            const decoder = new TextDecoder();
            let receivedAnyData = false;
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log('✅ Stream done. Buffer length:', streamBuffer.length);
                    break;
                }
                if (!value) continue;
                
                const chunk = decoder.decode(value, { stream: true });
                streamBuffer += chunk;
                receivedAnyData = true;
                
                console.log('📦 Received chunk:', chunk.length, 'bytes. Total buffer:', streamBuffer.length);

                if (streamHasEndMarker) {
                    continue;
                }

                const partial = parsePlaybookStreamPayload(streamBuffer);
                if (partial?.aiPlaybookResponse?.length) {
                    console.log('✅ Parsed partial results:', partial.aiPlaybookResponse.length, 'items');
                    const snapshotKey = JSON.stringify(partial.aiPlaybookResponse);
                    if (snapshotKey === lastStreamSnapshot) {
                        continue;
                    }
                    lastStreamSnapshot = snapshotKey;
                    playbookResults = partial;
                    // Force update the view immediately
                    updateResultsView();
                    
                    // Ensure playbook view is visible
                    const playbookView = document.getElementById('playbook-view');
                    if (playbookView) {
                        playbookView.style.display = 'block';
                    }
                } else if (partial) {
                    console.log('⚠️ Partial parsed but no aiPlaybookResponse:', partial);
                }
            }

            const remaining = decoder.decode();
            if (remaining) {
                streamBuffer += remaining;
                console.log('📦 Remaining decoded:', remaining.length, 'bytes');
            }
            
            console.log('📊 Final buffer length:', streamBuffer.length, 'Has end marker:', streamHasEndMarker);
        } catch (error) {
            console.error('Playbook stream error:', error);
            errorMessage = error?.message || 'Failed to run playbook';
            isStreamingPlaybook = false;
            runningPlaybook = null;
            showToast(errorMessage, 'error');
            // Update results view to show error
            updateResultsView();
        } finally {
            isStreamingPlaybook = false;
            runningPlaybook = null;
            
            // Only try to parse final payload if there was no error
            if (!errorMessage && streamBuffer) {
                console.log('🔍 Parsing final payload. Buffer:', streamBuffer.substring(0, 500));
                const finalPayload = parsePlaybookStreamPayload(streamBuffer, { includePostMarker: true });
                console.log('📊 Final payload:', finalPayload);
                
                if (finalPayload && finalPayload.aiPlaybookResponse && finalPayload.aiPlaybookResponse.length > 0) {
                    playbookResults = finalPayload;
                    console.log('✅ Final results:', finalPayload.aiPlaybookResponse.length, 'items');
                    // Ensure playbook view is visible
                    const playbookView = document.getElementById('playbook-view');
                    if (playbookView) {
                        playbookView.style.display = 'block';
                    }
                    updateResultsView();
                    showToast('Playbook executed successfully!', 'success');
                } else if (!errorMessage) {
                    // Log what we got for debugging
                    console.error('❌ No valid results. Payload:', finalPayload);
                    console.error('❌ Buffer content:', streamBuffer.substring(0, 1000));
                    errorMessage = streamBuffer.length > 0 
                        ? 'Unable to parse playbook response. Check console for details.'
                        : 'No data received from playbook execution';
                    // Ensure playbook view is visible even for errors
                    const playbookView = document.getElementById('playbook-view');
                    if (playbookView) {
                        playbookView.style.display = 'block';
                    }
                    updateResultsView();
                    showToast(errorMessage, 'error');
                }
            } else if (errorMessage) {
                console.error('❌ Error occurred:', errorMessage);
                // Ensure error is displayed and view is visible
                const playbookView = document.getElementById('playbook-view');
                if (playbookView) {
                    playbookView.style.display = 'block';
                }
                updateResultsView();
            } else if (!streamBuffer || streamBuffer.length === 0) {
                console.error('❌ No stream buffer received');
                errorMessage = 'No data received from server';
                const playbookView = document.getElementById('playbook-view');
                if (playbookView) {
                    playbookView.style.display = 'block';
                }
                updateResultsView();
                showToast(errorMessage, 'error');
            }
        }
    };

    // Parse playbook stream payload - matches MS Editor
    function parsePlaybookStreamPayload(raw, options = {}) {
        const { includePostMarker = false } = options;
        if (!raw || !raw.trim()) {
            console.log('⚠️ Empty raw payload');
            return null;
        }

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

        if (!working.trim()) {
            console.log('⚠️ Working payload is empty after processing');
            return null;
        }

        const sanitizedLines = working
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && line !== STREAM_END_MARKER)
            .filter((line) => !line.startsWith('event:'))
            .map((line) => (line.startsWith('data:') ? line.replace(/^data:\s*/, '') : line));

        const sanitizedPayload = sanitizedLines.join('\n');
        console.log('📝 Sanitized payload (first 500 chars):', sanitizedPayload.substring(0, 500));
        
        // Try to parse the entire payload as JSON first (in case it's a single object or array)
        try {
            const fullJson = JSON.parse(sanitizedPayload);
            if (fullJson) {
                console.log('✅ Parsed as full JSON');
                return fullJson;
            }
        } catch (e) {
            // Not a single JSON object, continue with parsing individual objects
        }
        
        // Extract complete JSON objects from the stream
        // The stream sends individual JSON objects, possibly concatenated or on separate lines
        const parsedObjects = [];
        let currentJson = '';
        let braceCount = 0;
        let inString = false;
        let escapeNext = false;
        
        for (let i = 0; i < sanitizedPayload.length; i++) {
            const char = sanitizedPayload[i];
            
            if (escapeNext) {
                escapeNext = false;
                currentJson += char;
                continue;
            }
            
            if (char === '\\') {
                escapeNext = true;
                currentJson += char;
                continue;
            }
            
            if (char === '"' && !escapeNext) {
                inString = !inString;
                currentJson += char;
                continue;
            }
            
            if (!inString) {
                if (char === '{') {
                    if (braceCount === 0) {
                        currentJson = '{';
                    } else {
                        currentJson += char;
                    }
                    braceCount++;
                } else if (char === '}') {
                    currentJson += char;
                    braceCount--;
                    if (braceCount === 0) {
                        // Complete JSON object found
                        try {
                            const parsed = JSON.parse(currentJson);
                            parsedObjects.push(parsed);
                            if (parsedObjects.length === 1) {
                                console.log('✅ First parsed object:', Object.keys(parsed));
                            }
                            currentJson = '';
                        } catch (e) {
                            console.log('⚠️ Failed to parse complete JSON object:', e.message);
                            currentJson = '';
                        }
                    }
                } else {
                    if (braceCount > 0) {
                        currentJson += char;
                    }
                }
            } else {
                currentJson += char;
            }
        }
        
        console.log('📦 Found', parsedObjects.length, 'complete JSON objects');
        
        if (!parsedObjects.length) {
            console.log('⚠️ No complete JSON objects found');
            return null;
        }
        
        console.log('✅ Parsed', parsedObjects.length, 'objects');

        let tokenDetails = null;
        const analysisEntries = [];

        parsedObjects.forEach((obj, idx) => {
            if (obj.token_details || obj.tokenDetails) {
                tokenDetails = obj.token_details || obj.tokenDetails;
                return;
            }
            if (Array.isArray(obj.aiPlaybookResponse)) {
                console.log(`✅ Found aiPlaybookResponse array with ${obj.aiPlaybookResponse.length} items`);
                analysisEntries.push(...obj.aiPlaybookResponse);
                if (!tokenDetails && obj.token_details) tokenDetails = obj.token_details;
                return;
            }
            if (Array.isArray(obj.data)) {
                console.log(`✅ Found data array with ${obj.data.length} items`);
                analysisEntries.push(...obj.data);
                if (!tokenDetails && obj.token_details) tokenDetails = obj.token_details;
                return;
            }
            // Check if it's a single entry object
            if (obj.Rule || obj.Status || obj.Conclusion || obj.Evaluation) {
                console.log(`✅ Found single entry object (Rule: ${obj.Rule?.substring(0, 50)}...)`);
                analysisEntries.push(obj);
                return;
            }
            // Log what we're skipping
            if (idx < 3) {
                console.log(`⚠️ Object ${idx} keys:`, Object.keys(obj));
            }
        });

        if (!analysisEntries.length) {
            console.log('⚠️ No analysis entries found after processing objects');
            return null;
        }
        
        console.log('✅ Total analysis entries:', analysisEntries.length);

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

    // Render results view - matches MS Editor/OnlyOffice exactly
    function renderResultsView() {
        const playbookView = document.getElementById('playbook-view');
        if (!playbookView) {
            console.error('playbook-view element not found');
            return;
        }
        
        // Ensure playbook view is visible
        playbookView.style.display = 'block';
        
        // Ensure Playbook tab is active
        const playbookTab = document.querySelector('[data-tab="Playbook"]');
        if (playbookTab && !playbookTab.classList.contains('active')) {
            if (window.handleTabChange) {
                window.handleTabChange('Playbook');
            }
        }

        // Ensure activeContent is set to playbook
        if (window.setActiveContent) {
            window.setActiveContent('playbook');
        }

        const playbook = playbooks.find(pb => pb._id === runningPlaybook) || selectedPlaybook;
        const playbookName = playbook?.name || 'Guide';

        playbookView.innerHTML = `
            <div class="results-root">
                <div class="results-header" style="display: flex; justify-content: space-between; align-items: center; position: relative;">
                    <div class="header-box" style="display: flex; align-items: center; gap: 4px; flex: 0 0 auto;">
                        <svg class="back-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" onclick="handleBackFromResults()" style="cursor: pointer;">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                        <p class="summary-text" onclick="handleBackFromResults()" style="cursor: pointer; margin: 0; font-weight: 650; font-size: 16px;">Back</p>
                    </div>
                    <div id="streaming-indicator" style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #6e6b7b; font-weight: 500; flex: 0 0 auto;"></div>
                </div>
                <div class="results-content" id="results-content" style="padding-bottom: ${!isStreamingPlaybook && playbookResults?.aiPlaybookResponse?.length > 0 ? '80px' : '0'};"></div>
            </div>
        `;

        // Force update the view to show loading state
        updateResultsView();
        
        // Double-check visibility
        setTimeout(() => {
            if (playbookView) {
                playbookView.style.display = 'block';
            }
        }, 100);
    }

    // Update results view
    function updateResultsView() {
        const resultsContent = document.getElementById('results-content');
        const streamingIndicator = document.getElementById('streaming-indicator');
        
        if (!resultsContent) return;

        const hasFinalData = Array.isArray(playbookResults?.aiPlaybookResponse) && playbookResults.aiPlaybookResponse.length > 0;
        const playBook = hasFinalData ? playbookResults.aiPlaybookResponse : [];
        const statusCount = playbookResults?.statusCount || {};
        
        // Update filtered playbook - matches MS Editor logic exactly
        if (!isStreamingPlaybook && activeFilter !== 'all') {
            // When not streaming and filter is not 'all', keep current filter
            filteredPlaybook = playBook.filter((item) => item?.statusValue === activeFilter);
        } else {
            // When streaming or filter is 'all', show all items
            if (activeFilter === 'all') {
                filteredPlaybook = playBook;
            } else {
                filteredPlaybook = playBook.filter((item) => item?.statusValue === activeFilter);
            }
        }

        // Update streaming indicator - matches MS Editor/OnlyOffice exactly
        if (streamingIndicator) {
            const streamingPlaybookMeta = runningPlaybook
                ? playbooks.find((pb) => pb._id === runningPlaybook) || selectedPlaybook
                : selectedPlaybook;
            const streamingTotalCount = streamingPlaybookMeta?.rules?.length || 0;
            const streamingCompletedCount = playBook.length || 0;
            // Only show loader after first chunk of data arrives
            const showStreamingIndicator = isStreamingPlaybook && streamingTotalCount > 0 && playBook.length > 0;
            const streamingProgressLabel =
                streamingTotalCount > 0
                    ? `${Math.min(streamingCompletedCount, streamingTotalCount)}/${streamingTotalCount} Done`
                    : 'Loading…';

            if (showStreamingIndicator) {
                streamingIndicator.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #6e6b7b; font-weight: 500; flex: 0 0 auto;">
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
                // Show ProgressLoader when streaming and no data yet
                // Check if loader already exists to avoid recreating it
                const existingLoader = resultsContent.querySelector('#progress-loader-container');
                if (!existingLoader) {
                    resultsContent.innerHTML = `
                        <div style="display: flex; justify-content: center; align-items: center; min-height: 60vh; width: 100%; position: relative;">
                            <div id="progress-loader-container" style="width: 100%; max-width: 500px;"></div>
                        </div>
                    `;
                    const loaderContainer = document.getElementById('progress-loader-container');
                    if (loaderContainer && window.createProgressLoader) {
                        window.createProgressLoader(loaderContainer, {
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
                    } else if (loaderContainer) {
                        loaderContainer.innerHTML = '<div class="loading-spinner"></div>';
                    }
                }
            } else {
                // Show empty state or error message
                const errorMsg = errorMessage || 'No playbook results available';
                resultsContent.innerHTML = `<p class="empty-state-text" style="text-align: center; color: #6c757d; margin: 40px 0;">${escapeHtml(errorMsg)}</p>`;
            }
            return;
        }
        
        // Remove ProgressLoader if it exists when data arrives
        const existingLoader = resultsContent.querySelector('#progress-loader-container');
        if (existingLoader && existingLoader.parentNode) {
            existingLoader.parentNode.remove();
        }

        // Render filters and results - matches MS Editor exactly
        const riskyPercentage = ((statusCount?.notMet || 0) / playBook.length) * 100;
        const favorablePercentage = ((statusCount?.met || 0) / playBook.length) * 100;
        const missingPercentage = ((statusCount?.NA || 0) / playBook.length) * 100;

        // Render filters and results - matches MS Editor/OnlyOffice screenshot exactly
        resultsContent.innerHTML = `
            <div style="padding: 10px; margin: 8px 8px 8px 8px; background-color: rgb(128 128 128 / 15%); border-radius: 4px;">
                <!-- Filter Buttons -->
                <div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 0.75rem; margin-bottom: ${!isStreamingPlaybook && playBook.length > 0 && ((statusCount?.met || 0) + (statusCount?.notMet || 0)) > 0 ? '12px' : '0'};">
                    <button class="filter-badge ${activeFilter === 'all' ? 'active' : ''}" onclick="filterWithResult('all', ${playBook.length})" style="margin: 0px; display: flex; align-items: center; font-size: 14px; font-weight: 600; color: #000; gap: 4px; border-color: grey; background-color: ${activeFilter === 'all' ? '#e9ecef' : 'transparent'};">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        <span>All</span>
                        <span style="border: 1px solid gray; color: #2567ff; border-radius: 5px; font-size: 12px; padding: 0 5px;">${playBook.length}</span>
                    </button>
                    <button class="filter-badge ${activeFilter === 'met' ? 'active' : ''}" onclick="filterWithResult('met', ${statusCount?.met || 0})" style="margin: 0px; display: flex; align-items: center; font-size: 14px; font-weight: 600; color: #000; gap: 4px; border-color: green; background-color: ${activeFilter === 'met' ? '#e9ecef' : 'transparent'};">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="green" stroke="#ffff" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        <span>Favourable</span>
                        <span style="border: 1px solid gray; color: #2567ff; border-radius: 5px; font-size: 12px; padding: 0 5px;">${statusCount?.met || 0}</span>
                    </button>
                    <button class="filter-badge ${activeFilter === 'notMet' ? 'active' : ''}" onclick="filterWithResult('notMet', ${statusCount?.notMet || 0})" style="margin: 0px; display: flex; align-items: center; font-size: 14px; font-weight: 600; color: #000; gap: 4px; border-color: red; background-color: ${activeFilter === 'notMet' ? '#e9ecef' : 'transparent'};">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="red" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        <span>Risky</span>
                        <span style="border: 1px solid gray; color: #2567ff; border-radius: 5px; font-size: 12px; padding: 0 5px;">${statusCount?.notMet || 0}</span>
                    </button>
                    <button class="filter-badge ${activeFilter === 'na' ? 'active' : ''}" onclick="filterWithResult('na', ${statusCount?.NA || 0})" style="margin: 0px; display: flex; align-items: center; font-size: 14px; font-weight: 600; color: #000; gap: 4px; border-color: gray; background-color: ${activeFilter === 'na' ? '#e9ecef' : 'transparent'};">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                        <span>Missing</span>
                        <span style="border: 1px solid gray; color: #2567ff; border-radius: 5px; font-size: 12px; padding: 0 5px;">${statusCount?.NA || 0}</span>
                    </button>
                </div>

                <!-- Risk Status Progress Bar - matches MS Editor exactly -->
                ${!isStreamingPlaybook && playBook.length > 0 ? `
                    <div>
                        <div style="display: flex; height: 20px; border-radius: 4px; overflow: hidden; background-color: #e9ecef; border: 1px solid #dee2e6;">
                            ${riskyPercentage > 0 ? `
                                <div style="width: ${riskyPercentage}%; background-color: #dc3545; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: 600; transition: width 0.3s ease; min-width: ${riskyPercentage < 5 ? 'auto' : '0'};">
                                    ${riskyPercentage >= 1 ? Math.round(riskyPercentage) + '%' : ''}
                                </div>
                            ` : ''}
                            ${favorablePercentage > 0 ? `
                                <div style="width: ${favorablePercentage}%; background-color: #28a745; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: 600; transition: width 0.3s ease; min-width: ${favorablePercentage < 5 ? 'auto' : '0'};">
                                    ${favorablePercentage >= 1 ? Math.round(favorablePercentage) + '%' : ''}
                                </div>
                            ` : ''}
                            ${missingPercentage > 0 ? `
                                <div style="width: ${missingPercentage}%; background-color: #6c757d; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: 600; transition: width 0.3s ease; min-width: ${missingPercentage < 5 ? 'auto' : '0'};">
                                    ${missingPercentage >= 1 ? Math.round(missingPercentage) + '%' : ''}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>

            <div style="border-top: 1px solid #6a666633;">
                ${filteredPlaybook.map((val, i) => {
                    const statusValue = val?.statusValue || 'na';
                    const badgeIcon = getBadgeIcon(statusValue);
                    return `
                        <div class="result-item" onclick="handleItemClick(${i})" style="background: rgb(128 128 128 / 15%); margin: 10px 9px; border-radius: 5px; padding: 12px; position: relative; cursor: pointer; transition: all 0.2s;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                <div style="display: flex; gap: 0.5rem; align-items: center; flex: 1;">
                                    ${badgeIcon}
                                    <span style="font-weight: 600; font-size: 14px;">Guideline</span>
                                </div>
                                <div style="padding: 4px; border-radius: 4px;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" style="color: #666;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                            </div>
                            <p style="font-size: 13px; font-weight: 350; margin: 0; line-height: 1.4;">${escapeHtml(val?.Rule || '')}</p>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // Get badge icon - matches MS Editor/OnlyOffice screenshot
    function getBadgeIcon(statusValue) {
        if (statusValue === 'met') {
            // Favourable - green checkmark
            return '<svg width="18" height="18" viewBox="0 0 24 24" fill="green" stroke="#ffff" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
        } else if (statusValue === 'notMet') {
            // Risky - red exclamation
            return '<svg width="18" height="18" viewBox="0 0 24 24" fill="red" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
        } else {
            // Missing - grey circle-slash
            return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>';
        }
    }

    // Filter with result - matches MS Editor exactly
    window.filterWithResult = function(val, count) {
        const playBook = playbookResults?.aiPlaybookResponse || [];
        
        if (activeFilter === val) {
            activeFilter = 'all';
            filteredPlaybook = playBook;
        } else if (val === 'all') {
            activeFilter = 'all';
            filteredPlaybook = playBook;
        } else if (count > 0) {
            activeFilter = val;
            filteredPlaybook = playBook.filter((item) => item?.statusValue === val);
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

    // Handle item click - matches MS Editor
    window.handleItemClick = function(index) {
        const item = filteredPlaybook[index];
        if (!item) return;
        
        activeContentPlaybook = item;
        isDrawerOpen = true;
        renderDrawer();
    };

    // Render drawer for playbook item details - uses existing drawer infrastructure
    function renderDrawer() {
        if (!activeContentPlaybook) return;

        const drawerOverlay = document.getElementById('drawer-overlay');
        const drawer = document.getElementById('drawer');
        const drawerTitle = document.getElementById('drawer-title');
        const drawerContent = document.getElementById('drawer-content');
        
        if (!drawerOverlay || !drawer || !drawerTitle || !drawerContent) return;
        
        const status = activeContentPlaybook.Status || activeContentPlaybook.status;
        const statusValue = activeContentPlaybook.statusValue;
        const isNotMet = status === 'Not met' || status === 'notMet' || statusValue === 'notMet';
        
        drawerTitle.textContent = 'Guideline Details';
        drawerContent.innerHTML = `
            <div style="padding: 12px; max-height: calc(90vh - 60px); overflow-y: auto;">
                ${isNotMet ? `
                    <div style="margin-bottom: 12px;">
                        <strong>Guideline:</strong> <span style="color: #666;">${escapeHtml(activeContentPlaybook.Rule || 'No guideline text available')}</span>
                    </div>
                    <div style="margin-bottom: 12px;">
                        <strong>Evaluation:</strong> <span style="color: #666;">${escapeHtml(activeContentPlaybook.Evaluation || 'No evaluation available')}</span>
                    </div>
                ` : `
                    <div style="margin-bottom: 12px;">
                        <strong>Guideline:</strong>
                        <div style="color: #666; margin-top: 4px;">${escapeHtml(activeContentPlaybook.Rule || 'No guideline text available')}</div>
                    </div>
                    <div style="margin-bottom: 12px;">
                        <strong>Conclusion:</strong>
                        <div style="color: #666; margin-top: 4px;">${escapeHtml(activeContentPlaybook.Conclusion || 'No conclusion available')}</div>
                    </div>
                    <div style="margin-bottom: 12px;">
                        <strong>Evaluation:</strong>
                        <div style="color: #666; margin-top: 4px;">${escapeHtml(activeContentPlaybook.Evaluation || 'No evaluation available')}</div>
                    </div>
                `}
            </div>
        `;
        
        drawerOverlay.style.display = 'block';
        drawer.style.display = 'flex';
    }

    // Close playbook drawer
    window.closePlaybookDrawer = function() {
        const drawerOverlay = document.getElementById('drawer-overlay');
        const drawer = document.getElementById('drawer');
        if (drawerOverlay) drawerOverlay.style.display = 'none';
        if (drawer) drawer.style.display = 'none';
        isDrawerOpen = false;
        activeContentPlaybook = null;
    };
    
    // Also handle closeDrawer from main.js
    const originalCloseDrawer = window.closeDrawer;
    window.closeDrawer = function() {
        if (isDrawerOpen && activeContentPlaybook) {
            closePlaybookDrawer();
        } else if (originalCloseDrawer) {
            originalCloseDrawer();
        }
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
                <div class="create-page-footer">
                    <p class="footer-text">Want to craft your own guidelines?</p>
                    <span class="start-from-scratch" onclick="handleStartFromScratch()">Start From Scratch</span>
                </div>
            </div>
        `;
        // Update footer visibility based on current state
        updateCreatePageFooter();
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
    
    // Update footer visibility based on current state
    function updateCreatePageFooter() {
        const footer = document.querySelector('.create-page-footer');
        if (!footer) return;
        
        // Show footer only in initial view (not generating, not generated)
        const shouldShow = !isGeneratingPlaybook && !generatedPlaybook;
        footer.style.display = shouldShow ? 'block' : 'none';
    }
    
    // Render initial create view - Matches MS Editor CreateGuidePage exactly
    function renderInitialCreateView() {
        const pluginData = window.getPluginData();
        const fileName = pluginData?.fileName || 'Untitled Document';
        
        return `
            <div class="create-page-inner">
                <h1 style="font-size: 18px; font-weight: bold; color: #212529; margin: 0 0 20px 0; text-align: center;">
                    Create a new Guide
                </h1>
                
                <div class="flow-container">
                    <div class="flow-item">
                        <div class="contract-illustration">
                            <img 
                                src="https://cdn.spotdraft.com/review-plugin/production/release-20250728/20250818/assets/images/your-contract-illustration.svg"
                                alt="Your Contract"
                                class="contract-image"
                                onerror="this.style.display='none';"
                            />
                        </div>
                    </div>
                    
                    <div class="flow-arrow">→</div>
                    
                    <div class="flow-item">
                        <div class="document-processor-wrapper">
                            <div class="processor-circle">
                                <div class="side-doc side-doc-left"></div>
                                <div class="side-doc side-doc-right"></div>
                                <div class="main-doc">
                                    <div class="doc-lines">
                                        <div class="doc-line"></div>
                                        <div class="doc-line"></div>
                                        <div class="doc-line"></div>
                                        <div class="doc-line"></div>
                                    </div>
                                    <div class="magnifying-glass">
                                        <div class="magnifying-handle"></div>
                                    </div>
                                </div>
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
        `;
    }
    
    // Render generating view - Matches MS Editor smartphone loading animation exactly
    function renderGeneratingView() {
        return `
            <div class="loading-container-visual">
                <div class="smartphone-illustration">
                    <div class="phone-container">
                        <div class="phone-screen">
                            <div class="screen-line" style="width: 100%;"></div>
                            <div class="screen-line" style="width: 80%;"></div>
                            <div class="screen-line" style="width: 90%;"></div>
                            <div class="screen-line" style="width: 70%;"></div>
                        </div>
                        <div class="phone-button"></div>
                    </div>
                    <!-- Decorative elements matching MS Editor -->
                    <div class="phone-decorative-dot phone-dot-1"></div>
                    <div class="phone-decorative-dot phone-dot-2"></div>
                    <div class="phone-decorative-dot phone-dot-3"></div>
                </div>
                <h2 class="loading-title">Generating your Guide</h2>
                <p class="loading-description">
                    AI is analyzing your contract and creating personalized guidelines...
                </p>
                <div class="loading-spinner-wrapper">
                    <div class="custom-loader"></div>
                </div>
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
            updateCreatePageFooter();
        }
        
        try {
            const url = `${backendUrl}/ai-assistant/generate-playbook-with-ai`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': accessToken
                },
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
                updateCreatePageFooter();
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
            
            const url = `${backendUrl}/ai-assistant/global-playbooks`;
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': accessToken
                }
            });
            
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
    
    // Handle start from scratch - matches MS Editor behavior
    window.handleStartFromScratch = function() {
        // Hide create page first, then show form (matches MS Editor pattern)
        showCreatePage = false;
        window.showCreatePage = false;
        showCreateForm = true;
        window.showCreateForm = true;
        initializeManualForm().then(() => {
            renderCreateForm();
        });
    };
    
    // State for manual form
    let manualFormRules = [];
    let manualFormCurrentRule = '';
    let manualFormGuideName = 'Manual Playbook';
    
    // Initialize manual form with versioned name
    async function initializeManualForm() {
        const versionedName = await generateVersionedName('Manual Playbook');
        manualFormGuideName = versionedName;
        manualFormRules = [];
        manualFormCurrentRule = '';
    }
    
    // Render create form - matches MS Editor CreateGuideForm exactly
    function renderCreateForm() {
        const playbookView = document.getElementById('playbook-view');
        if (!playbookView) return;
        
        // Initialize form if needed
        if (!manualFormGuideName || manualFormGuideName === 'Manual Playbook') {
            initializeManualForm().then(() => {
                renderCreateForm();
            });
            return;
        }
        
        const rulesHTML = manualFormRules.map((rule, index) => `
            <div class="rule-card-view-mode">
                <div class="rule-card-number">RULE ${index + 1}</div>
                <div class="rule-card-text">${escapeHtml(rule)}</div>
                <button class="rule-card-delete-button" onclick="handleDeleteManualRule(${index})" title="Delete rule">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `).join('');
        
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
                    <div class="create-form-scrollable">
                        <div style="position: relative; width: 100%; margin-bottom: 8px;">
                            <label class="section-label" style="display: block; margin-bottom: 6px;">Guide Name*</label>
                            <input type="text" class="title-input" id="form-playbook-name" placeholder="Enter a descriptive name for your playbook" value="${escapeHtml(manualFormGuideName)}" onchange="handleManualFormNameChange(this.value)">
                            <div style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #6c757d; pointer-events: none; margin-top: 12px;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </div>
                            <p style="font-size: 12px; color: #6c757d; margin: 4px 0 0 0;">Enter a descriptive name for your playbook</p>
                        </div>
                        
                        ${manualFormRules.length > 0 ? `
                            <div class="rules-grid-manual">
                                ${rulesHTML}
                            </div>
                            <div style="margin: 8px 0;">
                                <span class="edit-guidelines-link" onclick="handleEditGuidelines()">Edit Guidelines</span>
                            </div>
                        ` : ''}
                        
                        <div class="section-label" style="margin-top: ${manualFormRules.length > 0 ? '16px' : '0'}; margin-bottom: 6px;">ADD RULES</div>
                        <textarea 
                            class="guideline-input-manual" 
                            id="manual-rule-textarea"
                            placeholder="Start typing a rule that you would like to check your document against..."
                            rows="4"
                            maxlength="500"
                            oninput="handleManualRuleInput(this.value)"
                            onkeydown="handleManualRuleKeyDown(event)"
                        >${escapeHtml(manualFormCurrentRule)}</textarea>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                            <span class="character-counter ${manualFormCurrentRule.length > 450 ? 'character-counter-warning' : ''}">
                                ${manualFormCurrentRule.length}/500 characters
                            </span>
                        </div>
                    </div>
                </div>
                <div class="create-form-footer">
                    <div class="create-form-footer-buttons">
                        <button class="add-rule-button-fixed" onclick="handleAddManualRule()" ${!manualFormCurrentRule.trim() || manualFormCurrentRule.length > 500 ? 'disabled' : ''}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Add Rule
                        </button>
                        <button class="save-button-fixed" onclick="handleSaveFormGuide()" ${isSavingPlaybook ? 'disabled' : ''}>
                            ${isSavingPlaybook ? '<div class="loading-spinner-small"></div> Saving...' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Save Guide'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Handle manual form name change
    window.handleManualFormNameChange = function(value) {
        manualFormGuideName = value;
    };
    
    // Handle manual rule input
    window.handleManualRuleInput = function(value) {
        manualFormCurrentRule = value;
        const counter = document.querySelector('.character-counter');
        const addButton = document.querySelector('.add-rule-button-fixed');
        if (counter) {
            counter.textContent = `${value.length}/500 characters`;
            if (value.length > 450) {
                counter.classList.add('character-counter-warning');
            } else {
                counter.classList.remove('character-counter-warning');
            }
        }
        if (addButton) {
            addButton.disabled = !value.trim() || value.length > 500;
        }
    };
    
    // Handle manual rule keydown (Enter to add)
    window.handleManualRuleKeyDown = function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleAddManualRule();
        }
    };
    
    // Handle add manual rule
    window.handleAddManualRule = function() {
        const ruleText = manualFormCurrentRule.trim();
        if (!ruleText) {
            showToast('Please enter a rule before adding', 'error');
            return;
        }
        if (ruleText.length > 500) {
            showToast('Rule text is too long. Please keep it under 500 characters.', 'error');
            return;
        }
        manualFormRules.push(ruleText);
        manualFormCurrentRule = '';
        renderCreateForm();
        // Focus back on textarea
        setTimeout(() => {
            const textarea = document.getElementById('manual-rule-textarea');
            if (textarea) {
                textarea.focus();
            }
        }, 100);
        showToast('Rule added successfully!', 'success');
    };
    
    // Handle delete manual rule
    window.handleDeleteManualRule = function(index) {
        manualFormRules.splice(index, 1);
        renderCreateForm();
    };
    
    // Handle edit guidelines (show all rules in textarea for editing)
    window.handleEditGuidelines = function() {
        // This could open a modal or switch to edit mode
        // For now, just scroll to the textarea
        const textarea = document.getElementById('manual-rule-textarea');
        if (textarea) {
            textarea.focus();
            textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };
    
    
    // Handle save form guide
    window.handleSaveFormGuide = async function() {
        const pluginData = window.getPluginData();
        const backendUrl = window.getBackendUrl();
        const accessToken = window.getAccessToken();
        
        if (!accessToken) {
            showToast('Access token not available', 'error');
            return;
        }
        
        const name = manualFormGuideName.trim();
        
        if (!name) {
            showToast('Please enter a guide name', 'error');
            return;
        }
        
        if (manualFormRules.length === 0) {
            showToast('Please add at least one rule', 'error');
            return;
        }
        
        isSavingPlaybook = true;
        const saveButton = document.querySelector('.save-button-fixed');
        if (saveButton) {
            saveButton.disabled = true;
        }
        
        try {
            const url = `${backendUrl}/ai-assistant/editor-create-playbook`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': accessToken
                },
                body: JSON.stringify({
                    name: name,
                    rules: manualFormRules
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
                manualFormRules = [];
                manualFormCurrentRule = '';
                manualFormGuideName = 'Manual Playbook';
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
        manualFormRules = [];
        manualFormCurrentRule = '';
        manualFormGuideName = 'Manual Playbook';
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
            updateCreatePageFooter();
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
                updateCreatePageFooter();
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
            updateCreatePageFooter();
        }
    };
    
    // Handle delete rule
    window.handleDeleteRule = function(index) {
        if (generatedPlaybook && generatedPlaybook.rules) {
            generatedPlaybook.rules = generatedPlaybook.rules.filter((_, i) => i !== index);
            const contentDiv = document.getElementById('create-page-content');
            if (contentDiv) {
                contentDiv.innerHTML = renderCreatePageContent();
                updateCreatePageFooter();
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
            const url = `${backendUrl}/ai-assistant/editor-create-playbook`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': accessToken
                },
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
