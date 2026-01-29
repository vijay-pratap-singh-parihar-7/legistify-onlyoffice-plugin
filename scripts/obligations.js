// Obligations Feature Module - Matches MS Editor Obligation.js Exactly
(function(window) {
    'use strict';

    // State management
    let obligationsData = null;
    let savedObligation = '';
    let responseChunks = [];
    let isStreaming = false;
    let initialLoading = true;
    let regenerateLoader = false;
    let abortControllerRef = null;
    let readerRef = null;
    let progressLoaderInstance = null;
    let responseContainerRef = null;
    let currentObligationTimeStamp = null;
    let shouldHideLoader = false;
    let didStartRef = false;

    // Initialize obligations view
    window.initObligationsView = async function() {
        // Find result container - check drawer first (with -drawer suffix), then original view
        const drawerContent = document.getElementById('drawer-content');
        let resultContainer = null;
        
        if (drawerContent) {
            // Try with -drawer suffix first (cloned content)
            resultContainer = drawerContent.querySelector('#obligations-result-drawer');
            // If not found, try without suffix
            if (!resultContainer) {
                resultContainer = drawerContent.querySelector('#obligations-result');
            }
            // Also check nested containers
            if (!resultContainer) {
                resultContainer = drawerContent.querySelector('[id*="obligations-result"]');
            }
        }
        
        // Fallback to original view
        if (!resultContainer) {
            resultContainer = document.getElementById('obligations-result');
        }
        
        if (!resultContainer) {
            console.warn('Obligations result container not found');
            return;
        }
        
        responseContainerRef = resultContainer;

        // Show progress loader immediately
        if (window.createProgressLoader) {
            progressLoaderInstance = window.createProgressLoader(resultContainer, {
                title: 'Analyzing contract obligations',
                steps: [
                    'Scanning contract sections',
                    'Extracting obligations and duties',
                    'Mapping to responsible parties',
                    'Generating obligation matrix'
                ],
                stepDelay: 1000,
                minDisplayTime: 3000,
                titleMarginBottom: '1.5rem'
            });
        }

        // Check for existing obligations and auto-generate if needed
        await checkExistingObligations();
    };

    // Render obligations view - matches MS Editor
    function renderObligationsView() {
        const obligationsView = document.getElementById('obligations-view');
        if (!obligationsView) return;

        obligationsView.innerHTML = `
            <div class="summary-feature-container">
                <div class="feature-header">
                    <div class="header-box">
                        <svg class="back-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" onclick="handleBackFromObligations()" style="cursor: pointer;">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                        <p class="summary-text">Obligations</p>
                    </div>
                    <div class="response-action-box" id="obligations-action-box" style="display: none;">
                        <div class="summary-button" onclick="regenerateObligations()" style="cursor: pointer; border: 1px solid #0000003d;" title="Regenerate Obligation">
                            <svg id="regenerate" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="cursor-pointer icons">
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <polyline points="1 20 1 14 7 14"></polyline>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                            </svg>
                        </div>
                        <div class="summary-button" onclick="copyObligations()" style="cursor: pointer; border: 1px solid #0000003d;" title="Copy Obligation">
                            <svg id="copy" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="cursor-pointer icons">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </div>
                    </div>
                </div>
                <div class="summary-text-card" id="obligations-result" style="position: relative;"></div>
            </div>
        `;

        responseContainerRef = document.getElementById('obligations-result');
    }

    function sanitizeResponse(raw) {
        if (!raw) return '';
        const cleaned = raw
            .replace('```html', '')
            .replace('```', '')
            .replace(/---END_OF_ASSISTANT_RESPONSE---[\s\S]*$/i, '')
            .replace(/\n?\{\s*"thread_last_event"[\s\S]*$/i, '');
        return cleaned.trim();
    }

    async function generateObligation(type) {
        // Cancel previous request if it exists
        if (abortControllerRef) {
            abortControllerRef.abort();
        }
        if (readerRef) {
            try {
                await readerRef.cancel();
            } catch (e) {
                // Ignore cancel errors
            }
        }

        // Create new AbortController for this request
        const abortController = new AbortController();
        abortControllerRef = abortController;

        const pluginData = window.getPluginData();
        const backendUrl = window.getBackendUrl();
        const accessToken = window.getAccessToken();
        
        // Find result container - check drawer first (with -drawer suffix), then original view
        const drawerContent = document.getElementById('drawer-content');
        let resultContainer = null;
        
        if (drawerContent) {
            resultContainer = drawerContent.querySelector('#obligations-result-drawer') || 
                             drawerContent.querySelector('#obligations-result') ||
                             drawerContent.querySelector('[id*="obligations-result"]');
        }
        
        if (!resultContainer) {
            resultContainer = document.getElementById('obligations-result');
        }

        if (!pluginData.contractId || !accessToken) {
            showToast('Missing contract details', 'error');
            return;
        }

        // Immediately clear data and chunks when regenerate is clicked
        if (type === "reGenerate") {
            regenerateLoader = true;
            responseChunks = [];
            savedObligation = '';
            obligationsData = null;
            isStreaming = true;
        } else {
            responseChunks = [];
            savedObligation = '';
            obligationsData = null;
            isStreaming = true;
        }

        // Show progress loader if not already showing
        if (!progressLoaderInstance && window.createProgressLoader && resultContainer) {
            progressLoaderInstance = window.createProgressLoader(resultContainer, {
                title: 'Analyzing contract obligations',
                steps: [
                    'Scanning contract sections:',
                    'Extracting obligations and duties:',
                    'Mapping to responsible parties:',
                    'Generating obligation matrix:'
                ],
                stepDelay: 1000,
                minDisplayTime: 3000,
                titleMarginBottom: '1.5rem'
            });
        }

        // Update UI immediately
        updateStreamingUI();

        try {
            const url = `/ai-assistant/onlyoffice/stream-generate-obligation?contractId=${pluginData.contractId}&userId=${pluginData.userId}&organizationId=${pluginData.organizationId}`;
            const res = await window.pluginFetch(url, {
                method: 'GET',
                signal: abortController.signal,
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`HTTP ${res.status}: ${text}`);
            }

            if (!res.body) {
                throw new Error('Streaming is not supported in this environment.');
            }

            const reader = res.body.getReader();
            readerRef = reader;
            const decoder = new TextDecoder();
            const accumulatedChunks = [];

            while (true) {
                // Check if request was aborted
                if (abortController.signal.aborted) {
                    break;
                }

                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                accumulatedChunks.push(chunk);
                responseChunks = [...responseChunks, chunk];
                
                // Update UI with streaming chunks
                updateStreamingUI();
            }
            
            // Save accumulated chunks after streaming completes
            if (!abortController.signal.aborted && accumulatedChunks.length > 0) {
                const accumulated = accumulatedChunks.join('');
                if (accumulated.trim()) {
                    obligationsData = accumulated;
                }
            }
        } catch (e) {
            // Ignore abort errors, but handle other errors
            if (e.name !== 'AbortError') {
                console.error('Obligations generation error:', e);
                
                // Find result container to show error
                const drawerContent = document.getElementById('drawer-content');
                let resultContainer = null;
                
                if (drawerContent) {
                    resultContainer = drawerContent.querySelector('#obligations-result-drawer') || 
                                     drawerContent.querySelector('#obligations-result') ||
                                     drawerContent.querySelector('[id*="obligations-result"]');
                }
                
                if (!resultContainer) {
                    resultContainer = document.getElementById('obligations-result');
                }
                
                if (resultContainer) {
                    // Hide progress loader
                    if (progressLoaderInstance) {
                        progressLoaderInstance.hide();
                        progressLoaderInstance = null;
                    }
                    
                    // Show error message
                    const errorMsg = e.message || "Something went wrong!";
                    resultContainer.innerHTML = `
                        <div class="error-message" style="padding: 20px; color: #d32f2f; background: #ffebee; border-radius: 4px; margin: 10px;">
                            <strong>Error:</strong> ${errorMsg}
                        </div>
                    `;
                } else {
                    showToast(e.message || "Something went wrong!", 'error');
                }
            }
        } finally {
            // Only clear refs if this is still the current request
            if (abortControllerRef === abortController) {
                abortControllerRef = null;
                readerRef = null;
            }
            regenerateLoader = false;
            isStreaming = false;
            
            // Final UI update
            updateStreamingUI();
        }
    }

    // Auto-scroll to bottom when new chunks arrive during streaming
    function scrollToBottom() {
        if (isStreaming && responseContainerRef) {
            responseContainerRef.scrollTop = responseContainerRef.scrollHeight;
        }
    }

    function updateStreamingUI() {
        // Find result container - check drawer first (with -drawer suffix), then original view
        const drawerContent = document.getElementById('drawer-content');
        let resultContainer = null;
        
        if (drawerContent) {
            // Try with -drawer suffix first (cloned content)
            resultContainer = drawerContent.querySelector('#obligations-result-drawer');
            // If not found, try without suffix
            if (!resultContainer) {
                resultContainer = drawerContent.querySelector('#obligations-result');
            }
            // Also check nested containers
            if (!resultContainer) {
                resultContainer = drawerContent.querySelector('[id*="obligations-result"]');
            }
        }
        
        // Fallback to original view
        if (!resultContainer) {
            resultContainer = document.getElementById('obligations-result');
        }
        
        if (!resultContainer) {
            console.warn('Obligations result container not found');
            return;
        }

        // Show blank loading screen when regenerating and no chunks/data yet
        if (regenerateLoader && responseChunks.length === 0 && !savedObligation && !obligationsData) {
            resultContainer.innerHTML = `
                <div style="width: 100%; minHeight: 400px; backgroundColor: #fff;">
                    ${window.createProgressLoader ? '' : '<div class="loading-spinner"></div>'}
                </div>
            `;
            if (window.createProgressLoader) {
                progressLoaderInstance = window.createProgressLoader(resultContainer, {
                    title: 'Analyzing contract obligations',
                    steps: [
                        'Scanning contract sections',
                        'Extracting obligations and duties',
                        'Mapping to responsible parties',
                        'Generating obligation matrix'
                    ],
                    stepDelay: 1000,
                    minDisplayTime: 3000,
                    titleMarginBottom: '1.5rem'
                });
            }
            return;
        }

        if (isStreaming && responseChunks.length === 0 && !savedObligation && !obligationsData) {
            resultContainer.innerHTML = `
                <div style="padding: 10px; textAlign: left; minHeight: 200px;">
                    ${window.createProgressLoader ? '' : '<div class="loading-spinner"></div>'}
                </div>
            `;
            if (window.createProgressLoader) {
                progressLoaderInstance = window.createProgressLoader(resultContainer, {
                    title: 'Analyzing contract obligations',
                    steps: [
                        'Scanning contract sections',
                        'Extracting obligations and duties',
                        'Mapping to responsible parties',
                        'Generating obligation matrix'
                    ],
                    stepDelay: 1000,
                    minDisplayTime: 3000,
                    titleMarginBottom: '1.5rem'
                });
            }
            return;
        }

        // Hide progress loader if we have chunks
        if (responseChunks.length > 0 && progressLoaderInstance) {
            progressLoaderInstance.hide();
            progressLoaderInstance = null;
        }

        // Determine what to display
        const displayData = savedObligation || (responseChunks.length > 0 ? responseChunks.join('') : obligationsData);
        
        if (!displayData) {
            return;
        }

        // Format and display the data - matches MS Editor exactly
        const textToReplace = `Here are the obligations extracted from the document:`;
        
        let processed = sanitizeResponse(displayData)
            .replace(textToReplace, '')
            .replace(/^.*\b(Here|Here's)\b.*\b(obligation|obligations)\b.*$/gim, '');
        
        // Handle markdown bold patterns: **1. Title:** to <strong>1. Title:</strong>
        processed = processed.replace(/\*\*(\d+\.\s+[^*]+?)\*\*/g, '<strong>$1</strong>');
        
        // Format numbered obligations in HTML paragraphs: <p>1. Title: Description</p> -> <p><strong>1. Title:</strong><br>Description</p>
        processed = processed.replace(/<p>(\d+\.\s+[^:]+?):\s*([^<]+?)(?=<\/p>)/g, '<p><strong>$1:</strong><br>$2');
        
        // Format numbered obligations in plain text (not in HTML tags): "1. Title: Description" -> "<p><strong>1. Title:</strong><br>Description</p>"
        processed = processed.replace(/(?:^|\n)(\d+\.\s+[^:\n<]+?):\s*([^\n<]+?)(?=\n\d+\.|$|\n\n)/g, '<p><strong>$1:</strong><br>$2</p>');
        
        // Format numbered obligations without colon but with description: "1. Title Description" -> "<p><strong>1. Title</strong><br>Description</p>"
        processed = processed.replace(/(?:^|\n)(\d+\.\s+[A-Z][^.\n<]+?)(\s+[A-Za-z][^.\n<]+?)(?=\n\d+\.|$|\n\n)/g, (match, heading, description) => {
            if (match.includes('<p>') || match.includes('<strong>')) return match;
            return `<p><strong>${heading.trim()}</strong><br>${description.trim()}</p>`;
        });
        
        // Format standalone numbered items that don't have description yet
        processed = processed.replace(/(?:^|\n)(\d+\.\s+[^\n<]+?)(?=\n\d+\.|$)/g, (match) => {
            if (!match.includes('<p>') && !match.includes('<strong>')) {
                return `<p><strong>${match.trim()}</strong></p>`;
            }
            return match;
        });
        
        // Ensure h2 and h3 headers are bold if not already
        processed = processed.replace(/<h([23])>([^<]+?)<\/h[23]>/g, '<h$1><strong>$2</strong></h$1>');
        
        // Clean up any double paragraph tags and normalize spacing
        processed = processed
            .replace(/<\/p>\s*<p>/g, '</p><p>')
            .replace(/<p><p>/g, '<p>')
            .replace(/<\/p><\/p>/g, '</p>')
            .replace(/<p>\s*<\/p>/g, '')
            .replace(/•\s*/g, '• ')
            .replace(/• (.+?)(?=\s*•|<\/p>)/g, '• $1<br>')
            .replace(/<br><\/p>/g, '</p>');

        resultContainer.innerHTML = `
            <div id="html_obligations_text" class="obligations-content">
                ${processed}
            </div>
            ${currentObligationTimeStamp && !isStreaming ? `
                <div style="color: grey; font-size: 11px; margin-top: 12px;">
                    Last Updated Timestamp ${formatDate(currentObligationTimeStamp)}
                </div>
            ` : ''}
        `;
        
        // Show action buttons in drawer header (matches MS Editor)
        const drawerHeaderActions = document.getElementById('drawer-header-actions');
        if (drawerHeaderActions && (obligationsData || savedObligation || responseChunks.length > 0)) {
            drawerHeaderActions.style.display = 'flex';
        }
        
        // Auto-scroll to bottom during streaming
        if (isStreaming) {
            setTimeout(scrollToBottom, 10);
        }
    }

    async function checkExistingObligations() {
        const pluginData = window.getPluginData();
        const backendUrl = window.getBackendUrl();
        const accessToken = window.getAccessToken();
        
        // Find result container - check drawer first (with -drawer suffix), then original view
        const drawerContent = document.getElementById('drawer-content');
        let resultContainer = null;
        
        if (drawerContent) {
            resultContainer = drawerContent.querySelector('#obligations-result-drawer') || 
                             drawerContent.querySelector('#obligations-result') ||
                             drawerContent.querySelector('[id*="obligations-result"]');
        }
        
        if (!resultContainer) {
            resultContainer = document.getElementById('obligations-result');
        }
        
        if (!pluginData.contractId || !accessToken || !resultContainer) {
            initialLoading = false;
            return;
        }
        
        try {
            initialLoading = true;
            
            // Progress loader already shown in initObligationsView
            
            // Check history for saved obligation
            const url = `/ai-assistant/fetch-obligation?contractId=${pluginData.contractId}`;
            const response = await window.pluginFetch(url);
            const data = await response.json();
                if (data?.status && data?.data?.obligation) {
                    savedObligation = data.data.obligation;
                    obligationsData = data.data.obligation;
                    currentObligationTimeStamp = data.data.obligationUpdatedAt;
                    
                    // Hide progress loader and show data
                    if (progressLoaderInstance) {
                        progressLoaderInstance.hide();
                        progressLoaderInstance = null;
                    }
                    
                    // Update UI with saved obligation
                    updateStreamingUI();
                } else {
                    // No saved obligation, start streaming immediately
                    await generateObligation();
                }
            } else {
                // Error fetching saved obligation, start streaming
                await generateObligation();
            }
        } catch (err) {
            console.error('Error checking existing obligations:', err);
            // Error fetching saved obligation, start streaming
            await generateObligation();
        } finally {
            initialLoading = false;
        }
    }

    function copyObligations() {
        const resultContainer = document.getElementById('obligations-result');
        if (!resultContainer) return;

        const htmlObligationsText = document.getElementById('html_obligations_text');
        if (htmlObligationsText) {
            // Select all text in the container
            const range = document.createRange();
            range.selectNodeContents(htmlObligationsText);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            
            try {
                document.execCommand('copy');
                selection.removeAllRanges();
                showToast('Obligations copied to clipboard', 'success');
            } catch (err) {
                console.error('Failed to copy:', err);
                showToast('Failed to copy obligations', 'error');
            }
        }
    }

    function regenerateObligations() {
        generateObligation('reGenerate');
    }

    function handleBackFromObligations() {
        // Navigate back to review hub
        if (window.showReviewHub) {
            window.showReviewHub();
        }
    }

    function formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        return `${day} ${month}, ${year}`;
    }

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

    // Cleanup: cancel any pending requests when component unmounts
    window.cleanupObligations = function() {
        if (abortControllerRef) {
            abortControllerRef.abort();
        }
        if (readerRef) {
            readerRef.cancel().catch(() => {
                // Ignore cancel errors on cleanup
            });
        }
        if (progressLoaderInstance) {
            progressLoaderInstance.hide();
            progressLoaderInstance = null;
        }
    };

    // Expose functions globally
    window.copyObligations = copyObligations;
    window.regenerateObligations = regenerateObligations;
    window.handleBackFromObligations = handleBackFromObligations;

})(window);
