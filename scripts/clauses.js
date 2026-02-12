// Clauses Feature Module - Matches MS Editor Clauses.js Exactly
(function(window) {
    'use strict';

    // State management
    let clausesData = null;
    let savedClause = '';
    let responseChunks = [];
    let isStreaming = false;
    let initialLoading = true;
    let regenerateLoader = false;
    let abortControllerRef = null;
    let readerRef = null;
    let progressLoaderInstance = null;
    let progressLoaderStartTime = null;
    let responseContainerRef = null;
    let currentClauseTimeStamp = null;
    let shouldHideLoader = false;
    let didStartRef = false;

    // Initialize clauses view
    window.initClausesView = async function() {
        // Find result container - check drawer first (with -drawer suffix), then original view
        const drawerContent = document.getElementById('drawer-content');
        let resultContainer = null;
        
        if (drawerContent) {
            // Try with -drawer suffix first (cloned content)
            resultContainer = drawerContent.querySelector('#clauses-result-drawer');
            // If not found, try without suffix
            if (!resultContainer) {
                resultContainer = drawerContent.querySelector('#clauses-result');
            }
            // Also check nested containers
            if (!resultContainer) {
                resultContainer = drawerContent.querySelector('[id*="clauses-result"]');
            }
        }
        
        // Fallback to original view
        if (!resultContainer) {
            resultContainer = document.getElementById('clauses-result');
        }
        
        if (!resultContainer) {
            console.warn('Clauses result container not found');
            return;
        }
        
        responseContainerRef = resultContainer;

        // Show progress loader immediately
        if (window.createProgressLoader) {
            progressLoaderStartTime = Date.now();
            progressLoaderInstance = window.createProgressLoader(resultContainer, {
                title: 'Analyzing contract clauses',
                steps: [
                    'Scanning contract sections',
                    'Detecting important clauses',
                    'Categorizing by type',
                    'Preparing findings'
                ],
                stepDelay: 1000,
                minDisplayTime: 3000,
                titleMarginBottom: '1.5rem'
            });
        }

        // Check for existing clauses and auto-generate if needed
        await checkExistingClauses();
    };

    // Render clauses view - matches MS Editor
    function renderClausesView() {
        const clausesView = document.getElementById('clauses-view');
        if (!clausesView) return;

        clausesView.innerHTML = `
            <div class="summary-feature-container">
                <div class="feature-header">
                    <div class="header-box">
                        <svg class="back-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" onclick="handleBackFromClauses()" style="cursor: pointer;">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                        <p class="summary-text">Clauses</p>
                    </div>
                    <div class="response-action-box" id="clauses-action-box" style="display: none;">
                        <div class="summary-button" onclick="regenerateClauses()" style="cursor: pointer; border: 1px solid #0000003d;" title="Regenerate Clauses">
                            <svg id="regenerate" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="cursor-pointer icons">
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <polyline points="1 20 1 14 7 14"></polyline>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                            </svg>
                        </div>
                        <div class="summary-button" onclick="copyClauses()" style="cursor: pointer; border: 1px solid #0000003d;" title="Copy Clauses">
                            <svg id="copy" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="cursor-pointer icons">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </div>
                    </div>
                </div>
                <div class="summary-text-card" id="clauses-result" style="position: relative;"></div>
            </div>
        `;

        responseContainerRef = document.getElementById('clauses-result');
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

    async function extractClauses(type) {
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
            resultContainer = drawerContent.querySelector('#clauses-result-drawer') || 
                             drawerContent.querySelector('#clauses-result') ||
                             drawerContent.querySelector('[id*="clauses-result"]');
        }
        
        if (!resultContainer) {
            resultContainer = document.getElementById('clauses-result');
        }

        if (!pluginData.contractId || !accessToken) {
            showToast('Missing contract details', 'error');
            return;
        }

        // Immediately clear data and chunks when regenerate is clicked
        if (type === "reGenerate") {
            regenerateLoader = true;
            responseChunks = [];
            savedClause = '';
            clausesData = null;
            isStreaming = true;
        } else {
            responseChunks = [];
            savedClause = '';
            clausesData = null;
            isStreaming = true;
        }

        // Show progress loader if not already showing
        if (!progressLoaderInstance && window.createProgressLoader && resultContainer) {
            progressLoaderStartTime = Date.now();
            progressLoaderInstance = window.createProgressLoader(resultContainer, {
                title: 'Analyzing contract clauses',
                steps: [
                    'Scanning contract sections:',
                    'Detecting important clauses:',
                    'Categorizing by type:',
                    'Preparing findings:'
                ],
                stepDelay: 1000,
                minDisplayTime: 3000,
                titleMarginBottom: '1.5rem'
            });
        }

        // Update UI immediately
        updateStreamingUI();

        try {
            const url = `${backendUrl}/ai-assistant/onlyoffice/stream-generate-AiClause?contractId=${pluginData.contractId}&userId=${pluginData.userId}&organizationId=${pluginData.organizationId}`;
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': accessToken || '',
                    'accept-language': 'en-US,en;q=0.9',
                },
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
                
                // Auto-scroll to bottom during streaming
                if (isStreaming) {
                    setTimeout(() => {
                        scrollToBottom();
                    }, 50);
                }
            }
            
            // Save accumulated chunks after streaming completes
            if (!abortController.signal.aborted && accumulatedChunks.length > 0) {
                const accumulated = accumulatedChunks.join('');
                if (accumulated.trim()) {
                    clausesData = accumulated;
                }
            }
        } catch (e) {
            // Ignore abort errors, but handle other errors
            if (e.name !== 'AbortError') {
                console.error('Clauses extraction error:', e);
                
                // Find result container to show error
                const drawerContent = document.getElementById('drawer-content');
                let resultContainer = null;
                
                if (drawerContent) {
                    resultContainer = drawerContent.querySelector('#clauses-result-drawer') || 
                                     drawerContent.querySelector('#clauses-result') ||
                                     drawerContent.querySelector('[id*="clauses-result"]');
                }
                
                if (!resultContainer) {
                    resultContainer = document.getElementById('clauses-result');
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
            
            // Scroll to top after streaming completes
            setTimeout(() => {
                scrollToTop();
            }, 100);
        }
    }

    // Auto-scroll to bottom when new chunks arrive during streaming
    function scrollToBottom() {
        if (isStreaming && responseContainerRef) {
            responseContainerRef.scrollTop = responseContainerRef.scrollHeight;
        }
    }

    // Scroll to top after streaming completes
    function scrollToTop() {
        // Find result container - check drawer first (with -drawer suffix), then original view
        const drawerContent = document.getElementById('drawer-content');
        let resultContainer = null;
        
        if (drawerContent) {
            resultContainer = drawerContent.querySelector('#clauses-result-drawer') || 
                             drawerContent.querySelector('#clauses-result') ||
                             drawerContent.querySelector('[id*="clauses-result"]');
        }
        
        if (!resultContainer) {
            resultContainer = document.getElementById('clauses-result');
        }
        
        if (resultContainer) {
            resultContainer.scrollTop = 0;
        }
    }

    function updateStreamingUI() {
        // Find result container - check drawer first (with -drawer suffix), then original view
        const drawerContent = document.getElementById('drawer-content');
        let resultContainer = null;
        
        if (drawerContent) {
            // Try with -drawer suffix first (cloned content)
            resultContainer = drawerContent.querySelector('#clauses-result-drawer');
            // If not found, try without suffix
            if (!resultContainer) {
                resultContainer = drawerContent.querySelector('#clauses-result');
            }
            // Also check nested containers
            if (!resultContainer) {
                resultContainer = drawerContent.querySelector('[id*="clauses-result"]');
            }
        }
        
        // Fallback to original view
        if (!resultContainer) {
            resultContainer = document.getElementById('clauses-result');
        }
        
        if (!resultContainer) {
            console.warn('Clauses result container not found');
            return;
        }

        // Set responseContainerRef for scrolling
        responseContainerRef = resultContainer;

        // Show blank loading screen when regenerating and no chunks/data yet
        if (regenerateLoader && responseChunks.length === 0 && !savedClause && !clausesData) {
            resultContainer.innerHTML = '';
            if (window.createProgressLoader) {
                progressLoaderStartTime = Date.now();
                progressLoaderInstance = window.createProgressLoader(resultContainer, {
                    title: 'Analyzing contract clauses',
                    steps: [
                        'Scanning contract sections',
                        'Detecting important clauses',
                        'Categorizing by type',
                        'Preparing findings'
                    ],
                    stepDelay: 1000,
                    minDisplayTime: 3000,
                    titleMarginBottom: '1.5rem'
                });
            } else {
                resultContainer.innerHTML = '<div class="loading-spinner"></div>';
            }
            return;
        }

        if (isStreaming && responseChunks.length === 0 && !savedClause && !clausesData) {
            resultContainer.innerHTML = '';
            if (window.createProgressLoader) {
                progressLoaderStartTime = Date.now();
                progressLoaderInstance = window.createProgressLoader(resultContainer, {
                    title: 'Analyzing contract clauses',
                    steps: [
                        'Scanning contract sections',
                        'Detecting important clauses',
                        'Categorizing by type',
                        'Preparing findings'
                    ],
                    stepDelay: 1000,
                    minDisplayTime: 3000,
                    titleMarginBottom: '1.5rem'
                });
            } else {
                resultContainer.innerHTML = '<div class="loading-spinner"></div>';
            }
            return;
        }

        // Determine what to display
        const displayData = savedClause || (responseChunks.length > 0 ? responseChunks.join('') : clausesData);
        
        // Helper function to count words (excluding HTML tags)
        function countWords(text) {
            if (!text) return 0;
            // Remove HTML tags
            const textWithoutHtml = text.replace(/<[^>]+>/g, ' ');
            // Remove extra whitespace and split into words
            const words = textWithoutHtml.trim().split(/\s+/).filter(word => word.length > 0);
            return words.length;
        }
        
        // Hide progress loader only when we have at least 3 words AND at least 3 seconds have passed
        const wordCount = countWords(displayData);
        const elapsedTime = progressLoaderStartTime ? Date.now() - progressLoaderStartTime : 0;
        const minDisplayTime = 3000; // 3 seconds
        
        if (wordCount >= 3 && elapsedTime >= minDisplayTime && progressLoaderInstance) {
            progressLoaderInstance.hide();
            progressLoaderInstance = null;
            progressLoaderStartTime = null;
        }
        
        // If no data yet, less than 3 words, or less than 3 seconds passed, keep showing loader
        if (!displayData || !displayData.trim() || wordCount < 3 || elapsedTime < minDisplayTime) {
            return;
        }

        // Format and display the data - matches MS Editor exactly
        const textToReplace = `Here are the key clauses extracted from the document:`;
        
        let processed = sanitizeResponse(displayData)
            .replace(textToReplace, '')
            .replace(/^.*\b(Here|Here's)\b.*\b(clause|clauses)\b.*$/gim, '');
        
        // Handle markdown bold patterns: **1. Title:** to <strong>1. Title:</strong>
        processed = processed.replace(/\*\*(\d+\.\s+[^*]+?)\*\*/g, '<strong>$1</strong>');
        
        // Format numbered clauses in HTML paragraphs: <p>1. Title: Description</p> -> <p><strong>1. Title:</strong><br>Description</p>
        processed = processed.replace(/<p>(\d+\.\s+[^:]+?):\s*([^<]+?)(?=<\/p>)/g, '<p><strong>$1:</strong><br>$2');
        
        // Format numbered clauses in plain text (not in HTML tags): "1. Title: Description" -> "<p><strong>1. Title:</strong><br>Description</p>"
        processed = processed.replace(/(?:^|\n)(\d+\.\s+[^:\n<]+?):\s*([^\n<]+?)(?=\n\d+\.|$|\n\n)/g, '<p><strong>$1:</strong><br>$2</p>');
        
        // Format numbered clauses without colon but with description: "1. Title Description" -> "<p><strong>1. Title</strong><br>Description</p>"
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
            <div id="html_clauses_text" class="clauses-content">
                ${processed}
            </div>
            ${currentClauseTimeStamp && !isStreaming ? `
                <div style="color: grey; font-size: 11px; margin-top: 12px;">
                    Last Updated Timestamp ${formatDate(currentClauseTimeStamp)}
                </div>
            ` : ''}
        `;
        
        // Show action buttons in drawer header (matches MS Editor)
        const drawerHeaderActions = document.getElementById('drawer-header-actions');
        if (drawerHeaderActions && (clausesData || savedClause || responseChunks.length > 0)) {
            drawerHeaderActions.style.display = 'flex';
        }
        
        // Auto-scroll to bottom during streaming (will be called after each chunk update)
        if (isStreaming) {
            setTimeout(scrollToBottom, 50);
        }
    }

    async function checkExistingClauses() {
        const pluginData = window.getPluginData();
        const backendUrl = window.getBackendUrl();
        const accessToken = window.getAccessToken();
        
        // Find result container - check drawer first (with -drawer suffix), then original view
        const drawerContent = document.getElementById('drawer-content');
        let resultContainer = null;
        
        if (drawerContent) {
            resultContainer = drawerContent.querySelector('#clauses-result-drawer') || 
                             drawerContent.querySelector('#clauses-result') ||
                             drawerContent.querySelector('[id*="clauses-result"]');
        }
        
        if (!resultContainer) {
            resultContainer = document.getElementById('clauses-result');
        }
        
        if (!pluginData.contractId || !accessToken || !resultContainer) {
            initialLoading = false;
            return;
        }
        
        try {
            initialLoading = true;
            
            // Progress loader already shown in initClausesView
            
            // Check history for saved clause
            const url = `${backendUrl}/ai-assistant/fetch-Summary-Clause?contractId=${pluginData.contractId}`;
            const response = await fetch(url, {
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data?.status && data?.data?.clause) {
                    savedClause = data.data.clause;
                    clausesData = data.data.clause;
                    currentClauseTimeStamp = data.data.clauseUpdatedAt;
                    
                    // Hide progress loader and show data
                    if (progressLoaderInstance) {
                        progressLoaderInstance.hide();
                        progressLoaderInstance = null;
                    }
                    
                    // Update UI with saved clause
                    updateStreamingUI();
                } else {
                    // No saved clause, start streaming immediately
                    await extractClauses();
                }
            } else {
                // Error fetching saved clause, start streaming
                await extractClauses();
            }
        } catch (err) {
            console.error('Error checking existing clauses:', err);
            // Error fetching saved clause, start streaming
            await extractClauses();
        } finally {
            initialLoading = false;
        }
    }

    function copyClauses() {
        const resultContainer = document.getElementById('clauses-result');
        if (!resultContainer) {
            showToast('No clauses content to copy', 'error');
            return;
        }

        const htmlClausesText = document.getElementById('html_clauses_text');
        if (!htmlClausesText) {
            showToast('No clauses content to copy', 'error');
            return;
        }

        // Extract plain text from the rendered HTML (no HTML tags)
        let text = '';
        if (window.htmlToString) {
            // Use the utility function if available
            text = window.htmlToString(htmlClausesText.innerHTML);
        } else {
            // Fallback: extract text using DOM
            text = htmlClausesText.textContent || htmlClausesText.innerText || '';
            // Clean up whitespace
            text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
        }
        
        if (!text) {
            showToast('No clauses content to copy', 'error');
            return;
        }
        
        navigator.clipboard.writeText(text).then(() => {
            showToast('Clauses copied to clipboard', 'success');
        }).catch(err => {
            console.error('Failed to copy:', err);
            showToast('Failed to copy clauses', 'error');
        });
    }

    function regenerateClauses() {
        extractClauses('reGenerate');
    }

    function handleBackFromClauses() {
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
    window.cleanupClauses = function() {
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
    window.copyClauses = copyClauses;
    window.regenerateClauses = regenerateClauses;
    window.handleBackFromClauses = handleBackFromClauses;

})(window);
