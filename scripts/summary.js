// Summary Feature Module - Matches MS Editor Implementation
(function(window) {
    'use strict';

    // State management
    let summaryData = null;
    let savedSummary = '';
    let responseChunks = [];
    let isStreaming = false;
    let initialLoading = true;
    let regenerateLoader = false;
    let shouldHideLoader = false;
    let abortControllerRef = null;
    let readerRef = null;
    let progressLoaderInstance = null;
    let responseContainerRef = null;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSummary);
    } else {
        initSummary();
    }

    function initSummary() {
        // Auto-start generation - no button needed
        
        responseContainerRef = document.getElementById('summary-result');
        
        // Check for existing summary on load
        checkExistingSummary();
    }

    // Initialize summary view - called when drawer opens
    window.initSummaryView = async function() {
        // Find result container - check drawer first (with -drawer suffix), then original view
        const drawerContent = document.getElementById('drawer-content');
        let resultContainer = null;
        
        if (drawerContent) {
            // Try with -drawer suffix first (cloned content)
            resultContainer = drawerContent.querySelector('#summary-result-drawer');
            // If not found, try without suffix
            if (!resultContainer) {
                resultContainer = drawerContent.querySelector('#summary-result');
            }
            // Also check nested containers
            if (!resultContainer) {
                resultContainer = drawerContent.querySelector('[id*="summary-result"]');
            }
        }
        
        // Fallback to original view
        if (!resultContainer) {
            resultContainer = document.getElementById('summary-result');
        }
        
        if (!resultContainer) {
            console.warn('Summary result container not found');
            return;
        }
        
        responseContainerRef = resultContainer;

        // Show progress loader immediately
        if (window.createProgressLoader) {
            progressLoaderInstance = window.createProgressLoader(resultContainer, {
                    title: 'Generating contract summary',
                    steps: [
                        'Reading document',
                        'Identifying main themes',
                        'Extracting critical information',
                        'Synthesizing summary'
                    ],
                stepDelay: 1000,
                minDisplayTime: 3000,
                titleMarginBottom: '1.5rem'
            });
        }

        // Check for existing summary and auto-generate if not found
        await checkExistingSummaryAndGenerate();
    };

    // Check existing summary and auto-generate if needed
    async function checkExistingSummaryAndGenerate() {
        const pluginData = window.getPluginData();
        const backendUrl = window.getBackendUrl();
        const accessToken = window.getAccessToken();
        
        // Find result container - check drawer first (with -drawer suffix), then original view
        const drawerContent = document.getElementById('drawer-content');
        let resultContainer = null;
        
        if (drawerContent) {
            resultContainer = drawerContent.querySelector('#summary-result-drawer') || 
                             drawerContent.querySelector('#summary-result') ||
                             drawerContent.querySelector('[id*="summary-result"]');
        }
        
        if (!resultContainer) {
            resultContainer = document.getElementById('summary-result');
        }
        
        if (!pluginData.contractId || !accessToken || !resultContainer) {
            initialLoading = false;
            return;
        }
        
        try {
            initialLoading = true;
            const url = `${backendUrl}/ai-assistant/fetch-Summary-Clause?contractId=${pluginData.contractId}`;
            const response = await fetch(url, {
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data && data.summary) {
                    savedSummary = data.summary;
                    summaryData = data.summary;
                    
                    // Hide progress loader and show data
                    if (progressLoaderInstance) {
                        progressLoaderInstance.hide();
                        progressLoaderInstance = null;
                    }
                    
                    // Update UI with saved summary
                    updateStreamingUI();
                    
                    // Show action buttons in header
                    showSummaryActions(resultContainer);
                } else {
                    // No saved summary, auto-generate (progress loader already showing)
                    await generateSummary();
                }
            } else {
                // Error fetching, auto-generate (progress loader already showing)
                await generateSummary();
            }
        } catch (error) {
            console.error('Error checking existing summary:', error);
            // Error fetching, auto-generate (progress loader already showing)
            await generateSummary();
        } finally {
            initialLoading = false;
        }
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

    async function generateSummary(type) {
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

        // Find result container - check drawer first (with -drawer suffix), then original view
        const drawerContent = document.getElementById('drawer-content');
        let resultContainer = null;
        
        if (drawerContent) {
            resultContainer = drawerContent.querySelector('#summary-result-drawer') || 
                             drawerContent.querySelector('#summary-result') ||
                             drawerContent.querySelector('[id*="summary-result"]');
        }
        
        if (!resultContainer) {
            resultContainer = document.getElementById('summary-result');
        }
        const pluginData = window.getPluginData();

        // Validate plugin data before proceeding
        if (window.validatePluginData && !window.validatePluginData()) {
            const errorMsg = 'Plugin configuration incomplete. Please check contract ID, access token, and backend URL.';
            console.error(errorMsg);
            if (resultContainer) {
                resultContainer.innerHTML = `<div class="error-message">${errorMsg}</div>`;
            }
            return;
        }
        
        // Basic validation if validatePluginData doesn't exist
        if (!pluginData.contractId || !pluginData.accessToken) {
            const errorMsg = 'Contract ID or Access Token not available. Please check plugin configuration.';
            console.error(errorMsg);
            if (resultContainer) {
                resultContainer.innerHTML = `<div class="error-message">${errorMsg}</div>`;
            }
            return;
        }

        // Immediately clear data and chunks when regenerate is clicked
        if (type === "reGenerate") {
            regenerateLoader = true;
            responseChunks = [];
            savedSummary = '';
            summaryData = null;
            isStreaming = true;
        } else {
            responseChunks = [];
            savedSummary = '';
            summaryData = null;
            isStreaming = true;
        }

        // Clear result container and show progress loader if not already showing
        if (resultContainer) {
            // Only clear and show loader if we don't already have one showing
            if (!progressLoaderInstance) {
                resultContainer.innerHTML = '';
                
                // Show progress loader
                if (window.createProgressLoader) {
                    progressLoaderInstance = window.createProgressLoader(resultContainer, {
                    title: 'Generating contract summary',
                    steps: [
                        'Reading document',
                        'Identifying main themes',
                        'Extracting critical information',
                        'Synthesizing summary'
                    ],
                        stepDelay: 1000,
                        minDisplayTime: 3000,
                        titleMarginBottom: '1.5rem'
                    });
                }
            }
        }

        try {
            const backendUrl = window.getBackendUrl();
            const accessToken = window.getAccessToken();
            
            // #region agent log
            console.log('[DEBUG] Before fetch - data validation:', {backendUrl:backendUrl,hasAccessToken:!!accessToken,contractId:pluginData.contractId,userId:pluginData.userId,organizationId:pluginData.organizationId});
            fetch('http://127.0.0.1:7242/ingest/be32d8b0-12c9-4dbe-a212-01f2fe6cfcc2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'summary.js:138',message:'Before fetch - data validation',data:{backendUrl:backendUrl,hasAccessToken:!!accessToken,contractId:pluginData.contractId,userId:pluginData.userId,organizationId:pluginData.organizationId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            
            if (!accessToken) {
                throw new Error('Access token not available');
            }

            // Construct URL with proper encoding - match frontend exactly
            const params = new URLSearchParams({
                contractId: pluginData.contractId,
                userId: pluginData.userId,
                organizationId: pluginData.organizationId,
                modelId: 'anthropic_claude_sonnet_3_5' // Default model, can be overridden via pluginData if needed
            });
            const url = `${backendUrl}/ai-assistant/onlyoffice/stream-generate-summary?${params.toString()}`;
            
            // #region agent log
            console.log('[DEBUG] Before fetch - URL constructed:', {url:url,backendUrl:backendUrl,queryParams:params.toString(),windowOrigin:window.location.origin,fullUrl:url});
            fetch('http://127.0.0.1:7242/ingest/be32d8b0-12c9-4dbe-a212-01f2fe6cfcc2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'summary.js:152',message:'Before fetch - URL constructed',data:{url:url,backendUrl:backendUrl,queryParams:params.toString(),windowOrigin:window.location.origin},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            
            console.log('Fetching summary from:', url);
            console.log('Backend URL:', backendUrl);
            console.log('Access Token present:', !!accessToken);
            console.log('Contract ID:', pluginData.contractId);
            
            // Get frontend origin for CORS - matches the origin that backend expects
            const frontendOrigin = window.getFrontendOrigin();
            
            let response;
            const fetchStartTime = Date.now();
            try {
                // #region agent log
                console.log('[DEBUG] Fetch request starting:', {url:url,method:'GET',mode:'cors',credentials:'omit',hasSignal:!!abortController.signal,frontendOrigin:frontendOrigin});
                fetch('http://127.0.0.1:7242/ingest/be32d8b0-12c9-4dbe-a212-01f2fe6cfcc2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'summary.js:161',message:'Fetch request starting',data:{url:url,method:'GET',mode:'cors',credentials:'omit',hasSignal:!!abortController.signal,frontendOrigin:frontendOrigin},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                
                // Match frontend request headers exactly as shown in curl
                response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'accept': '*/*',
                        'accept-language': 'en-US,en;q=0.9',
                        'content-type': 'application/json',
                        'origin': frontendOrigin,
                        'x-auth-token': accessToken || ''
                    },
                    signal: abortController.signal,
                    mode: 'cors',
                    credentials: 'omit'
                });
                
                const fetchDuration = Date.now() - fetchStartTime;
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/be32d8b0-12c9-4dbe-a212-01f2fe6cfcc2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'summary.js:177',message:'Fetch response received',data:{status:response.status,statusText:response.statusText,ok:response.ok,headers:Object.fromEntries(response.headers.entries()),duration:fetchDuration},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                
                console.log('Response status:', response.status);
                console.log('Response headers:', Object.fromEntries(response.headers.entries()));
            } catch (fetchError) {
                const fetchDuration = Date.now() - fetchStartTime;
                
                // #region agent log
                console.error('[DEBUG] Fetch error caught:', {name:fetchError.name,message:fetchError.message,stack:fetchError.stack,url:url,duration:fetchDuration,isAbortError:fetchError.name==='AbortError'});
                fetch('http://127.0.0.1:7242/ingest/be32d8b0-12c9-4dbe-a212-01f2fe6cfcc2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'summary.js:185',message:'Fetch error caught',data:{name:fetchError.name,message:fetchError.message,stack:fetchError.stack,url:url,duration:fetchDuration,isAbortError:fetchError.name==='AbortError'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                // #endregion
                
                if (fetchError.name === 'AbortError') {
                    return; // User cancelled, silently return
                }
                const currentOrigin = window.location?.origin || 'unknown';
                const currentHref = window.location?.href || 'unknown';
                
                console.error('Fetch error details:', {
                    name: fetchError.name,
                    message: fetchError.message,
                    stack: fetchError.stack,
                    url: url,
                    currentOrigin: currentOrigin,
                    currentHref: currentHref,
                    isSecureContext: window.isSecureContext
                });
                
                // Try to parse URL for better diagnostics
                let urlInfo = '';
                try {
                    const urlObj = new URL(url);
                    urlInfo = `\nURL Details:\n- Protocol: ${urlObj.protocol}\n- Host: ${urlObj.host}\n- Path: ${urlObj.pathname}\n- Full URL: ${url}`;
                } catch (e) {
                    urlInfo = `\nURL: ${url} (Invalid URL format)`;
                }
                
                // Provide more specific error message with detailed diagnostics
                let errorMessage = 'Connection error: Unable to reach the server.\n\n';
                
                if (fetchError.message.includes('Failed to fetch')) {
                    errorMessage += 'This is likely a CORS or network connectivity issue.\n\n';
                    errorMessage += 'DIAGNOSTIC INFORMATION:\n';
                    errorMessage += `- Plugin Origin: ${currentOrigin}\n`;
                    errorMessage += `- Plugin Location: ${currentHref}\n`;
                    errorMessage += `- Backend URL: ${url.split('?')[0]}\n`;
                    errorMessage += urlInfo;
                    errorMessage += '\n\nPOSSIBLE CAUSES:\n';
                    errorMessage += '1. CORS Configuration: The backend must allow requests from OnlyOffice plugin origin\n';
                    errorMessage += `   - OnlyOffice plugins typically run from origin: "asc-local://" or similar\n`;
                    errorMessage += `   - Backend ALLOWED_ORIGINS must include: "${currentOrigin}"\n`;
                    errorMessage += `   - See CORS_FIX.md for detailed instructions\n`;
                    errorMessage += '2. Network Connectivity: Backend server may be unreachable\n';
                    errorMessage += '3. Backend Server: May not be running or accessible\n';
                    errorMessage += '4. SSL/Certificate: HTTPS backend may have certificate issues\n\n';
                    errorMessage += 'SOLUTION:\n';
                    errorMessage += '1. Check backend CORS configuration (ALLOWED_ORIGINS environment variable)\n';
                    errorMessage += `   - Add "${currentOrigin}" to ALLOWED_ORIGINS\n`;
                    errorMessage += '   - Restart backend server after updating\n';
                    errorMessage += '2. Verify backend server is running and accessible\n';
                    errorMessage += '3. Check network connectivity\n';
                    errorMessage += '4. Open browser console (F12) for detailed error logs\n\n';
                    errorMessage += 'See CORS_FIX.md for detailed fix instructions.\n';
                    errorMessage += 'Check browser console (F12) for technical details.';
                } else {
                    errorMessage += `Error: ${fetchError.message}${urlInfo}`;
                }
                
                throw new Error(errorMessage);
            }

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/be32d8b0-12c9-4dbe-a212-01f2fe6cfcc2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'summary.js:202',message:'Checking response status',data:{ok:response.ok,status:response.status,hasBody:!!response.body},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            
            if (!response.ok) {
                const text = await response.text().catch(() => '');
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/be32d8b0-12c9-4dbe-a212-01f2fe6cfcc2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'summary.js:206',message:'Response not OK',data:{status:response.status,statusText:response.statusText,errorText:text.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                
                throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
            }

            if (!response.body) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/be32d8b0-12c9-4dbe-a212-01f2fe6cfcc2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'summary.js:213',message:'Response body missing',data:{hasBody:false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                
                throw new Error('Streaming is not supported in this environment.');
            }

            const reader = response.body.getReader();
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
                    summaryData = accumulated;
                }
            }
        } catch (e) {
            // Ignore abort errors, but handle other errors
            if (e.name !== 'AbortError') {
                console.error('Summary generation error:', e);
                console.error('Error stack:', e.stack);
                
                // Create user-friendly error message
                let userMessage = e.message || "Something went wrong!";
                
                // If it's a CORS/network error, provide helpful guidance
                if (userMessage.includes('CORS') || userMessage.includes('Failed to fetch') || userMessage.includes('Network error')) {
                    userMessage = 'Connection error: Unable to reach the server. This may be due to:\n' +
                        '• CORS configuration on the backend\n' +
                        '• Network connectivity issues\n' +
                        '• Incorrect backend URL\n\n' +
                        'Please check the browser console (F12) for more details.';
                }
                
                if (resultContainer) {
                    resultContainer.innerHTML = `
                        <div class="error-message">
                            <strong>Error:</strong> ${userMessage}
                            <br><br>
                            <small style="color: #666;">Check browser console (F12) for technical details.</small>
                        </div>`;
                }
                
                // Error already shown in result container
            }
        } finally {
            // Only clear refs if this is still the current request
            if (abortControllerRef === abortController) {
                abortControllerRef = null;
                readerRef = null;
            }
            regenerateLoader = false;
            isStreaming = false;
            
            // Hide progress loader
            if (progressLoaderInstance) {
                progressLoaderInstance.hide();
                progressLoaderInstance = null;
            }
            
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
            resultContainer = drawerContent.querySelector('#summary-result-drawer') || 
                             drawerContent.querySelector('#summary-result') ||
                             drawerContent.querySelector('[id*="summary-result"]');
        }
        
        if (!resultContainer) {
            resultContainer = document.getElementById('summary-result');
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
            resultContainer = drawerContent.querySelector('#summary-result-drawer');
            // If not found, try without suffix
            if (!resultContainer) {
                resultContainer = drawerContent.querySelector('#summary-result');
            }
            // Also check nested containers
            if (!resultContainer) {
                resultContainer = drawerContent.querySelector('[id*="summary-result"]');
            }
        }
        
        // Fallback to original view
        if (!resultContainer) {
            resultContainer = document.getElementById('summary-result');
        }
        
        if (!resultContainer) {
            console.warn('Summary result container not found');
            return;
        }

        // Set responseContainerRef for scrolling
        responseContainerRef = resultContainer;

        // Determine what to display
        const displayData = savedSummary || (responseChunks.length > 0 ? responseChunks.join('') : summaryData);
        
        // Hide progress loader only when we have meaningful content to display
        if (displayData && displayData.trim() && progressLoaderInstance) {
            progressLoaderInstance.hide();
            progressLoaderInstance = null;
        }
        
        // If no data yet, keep showing loader or show it if still loading
        if (!displayData || !displayData.trim()) {
            if ((isStreaming || regenerateLoader) && !progressLoaderInstance && window.createProgressLoader) {
                progressLoaderInstance = window.createProgressLoader(resultContainer, {
                    title: 'Generating contract summary',
                    steps: [
                        'Reading document',
                        'Identifying main themes',
                        'Extracting critical information',
                        'Synthesizing summary'
                    ],
                    stepDelay: 1000,
                    minDisplayTime: 3000
                });
            }
            return;
        }

        if (displayData) {
            // Format and display the data
            const textToReplace = `Here's a summary of the Non-Disclosure Agreement in HTML format:`;
            let cleanedSummaryData = sanitizeResponse(displayData)
                .replace(textToReplace, '')
                .replace(/^.*\b(Here|Here's)\b.*\bsummary\b.*$/gim, '')
                .replace(/•\s*/g, '• ')
                .replace(/• (.+?)(?=\s*•|<\/p>)/g, '• $1<br>')
                .replace(/<br><\/p>/g, '</p>');

            resultContainer.innerHTML = `
                <div id="html_summary_text" class="summary-content">
                    ${cleanedSummaryData}
                </div>
            `;
            
            // Show action buttons
            showSummaryActions(resultContainer);
            
            // Auto-scroll to bottom during streaming (will be called after each chunk update)
            if (isStreaming) {
                setTimeout(scrollToBottom, 50);
            }
        }
    }

    async function checkExistingSummary() {
        const pluginData = window.getPluginData();
        const backendUrl = window.getBackendUrl();
        const accessToken = window.getAccessToken();
        const resultContainer = document.getElementById('summary-result');
        
        if (!pluginData.contractId || !accessToken || !resultContainer) {
            initialLoading = false;
            return;
        }
        
        try {
            initialLoading = true;
            const url = `${backendUrl}/ai-assistant/fetch-Summary-Clause?contractId=${pluginData.contractId}`;
            const response = await fetch(url, {
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data && data.summary) {
                    savedSummary = data.summary;
                    summaryData = data.summary;
                    
                    // Update UI with saved summary
                    updateStreamingUI();
                    
                    // Show action buttons in header
                    showSummaryActions(resultContainer);
                } else {
                    // No saved summary, could start streaming if needed
                }
            }
        } catch (error) {
            console.error('Error checking existing summary:', error);
            // Silent fail - user can still generate new summary
        } finally {
            initialLoading = false;
        }
    }

    function showSummaryActions(container) {
        // Show action buttons in drawer header (matches MS Editor)
        const drawerHeaderActions = document.getElementById('drawer-header-actions');
        if (drawerHeaderActions) {
            drawerHeaderActions.style.display = 'flex';
        }
    }

    function copySummary() {
        // Get the rendered content from the UI
        const resultContainer = document.getElementById('summary-result');
        if (!resultContainer) {
            showToast('No summary content to copy');
            return;
        }

        // Extract plain text from the rendered HTML (no HTML tags)
        let text = '';
        if (window.htmlToString) {
            // Use the utility function if available
            text = window.htmlToString(resultContainer.innerHTML);
        } else {
            // Fallback: extract text using DOM
            text = resultContainer.textContent || resultContainer.innerText || '';
            // Clean up whitespace
            text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
        }
        
        if (!text) {
            showToast('No summary content to copy');
            return;
        }
        
        navigator.clipboard.writeText(text).then(() => {
            showToast('Summary copied to clipboard');
        }).catch(err => {
            console.error('Failed to copy:', err);
            showToast('Failed to copy summary');
        });
    }

    function regenerateSummary() {
        generateSummary('reGenerate');
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    // Expose functions globally
    window.copySummary = copySummary;
    window.regenerateSummary = regenerateSummary;

})(window);
