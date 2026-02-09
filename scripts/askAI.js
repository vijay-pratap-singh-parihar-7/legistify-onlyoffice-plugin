// Ask AI Feature Module - Matches MS Editor Chat.js Exactly
(function(window) {
    'use strict';

    // State management
    let historySearch = [];
    let totalCount = 0;
    let prompt = '';
    let remainingBalance = null;
    let currentPage = 1;
    let isHistoryLoading = true;
    let errorMessage = '';
    let loader = false;
    let error = false;
    let bottomRef = null;
    let promptInputRef = null;
    let messageDivRef = null;

    // Initialize Ask AI view
    window.initAskAIView = function() {
        console.log('🔵 initAskAIView called');
        
        // Find ask-ai-view in drawer first, then original view
        const drawerContent = document.getElementById('drawer-content');
        let askAIView = null;
        
        // Check if drawer-content has the cloned view (it will be the first child if cloned)
        if (drawerContent) {
            console.log('🔵 drawer-content found, children:', drawerContent.children.length);
            if (drawerContent.children.length > 0) {
                // The cloned view might be directly in drawer-content
                const firstChild = drawerContent.children[0];
                console.log('🔵 First child:', firstChild.id, firstChild.className);
                if (firstChild && (firstChild.id === 'ask-ai-view' || firstChild.id === 'ask-ai-view-drawer' || firstChild.classList.contains('drawer-view'))) {
                    askAIView = firstChild;
                } else {
                    // Try to find by ID or class
                    askAIView = drawerContent.querySelector('#ask-ai-view, #ask-ai-view-drawer, .drawer-view');
                }
            } else {
                // No children yet, create the view directly in drawer-content
                console.log('🔵 No children in drawer-content, creating view');
                askAIView = document.createElement('div');
                askAIView.id = 'ask-ai-view';
                askAIView.className = 'drawer-view';
                drawerContent.appendChild(askAIView);
            }
        }
        
        // Fallback to original view
        if (!askAIView) {
            askAIView = document.getElementById('ask-ai-view');
        }
        
        if (!askAIView) {
            console.error('❌ Could not find or create ask-ai-view element for initialization');
            return;
        }
        
        console.log('✅ ask-ai-view found/created:', askAIView.id);

        // Check if we have required data
        const pluginData = window.getPluginData();
        const accessToken = window.getAccessToken();
        
        console.log('🔵 Plugin data:', { hasContractId: !!pluginData?.contractId, hasToken: !!accessToken });
        
        if (!pluginData || !pluginData.contractId || !accessToken || accessToken === "null") {
            console.warn('⚠️ Missing required data for AI Copilot, rendering empty state');
            isHistoryLoading = false;
            historySearch = [];
            renderAskAIView();
            return;
        }

        // Reset state
        historySearch = [];
        totalCount = 0;
        currentPage = 1;
        isHistoryLoading = true;
        errorMessage = '';
        
        // Render Ask AI view structure first
        renderAskAIView();
        
        // Fetch chat history with first=true
        fetchHistory(null, true);
    };

    // Render Ask AI view - matches MS Editor
    function renderAskAIView() {
        // Find ask-ai-view in drawer first, then original view
        const drawerContent = document.getElementById('drawer-content');
        let askAIView = null;
        
        // Check if drawer-content has the cloned view (it will be the first child if cloned)
        if (drawerContent) {
            if (drawerContent.children.length > 0) {
                // The cloned view might be directly in drawer-content
                const firstChild = drawerContent.children[0];
                if (firstChild && (firstChild.id === 'ask-ai-view' || firstChild.id === 'ask-ai-view-drawer' || firstChild.classList.contains('drawer-view'))) {
                    askAIView = firstChild;
                } else {
                    // Try to find by ID or class
                    askAIView = drawerContent.querySelector('#ask-ai-view, #ask-ai-view-drawer, .drawer-view');
                }
            } else {
                // No children, create the view
                askAIView = document.createElement('div');
                askAIView.id = 'ask-ai-view';
                askAIView.className = 'drawer-view';
                drawerContent.appendChild(askAIView);
            }
        }
        
        // Fallback to original view
        if (!askAIView) {
            askAIView = document.getElementById('ask-ai-view');
        }
        
        // Last resort: create in drawer-content if it exists
        if (!askAIView && drawerContent) {
            askAIView = document.createElement('div');
            askAIView.id = 'ask-ai-view';
            askAIView.className = 'drawer-view';
            drawerContent.appendChild(askAIView);
        }
        
        if (!askAIView) {
            console.error('❌ Could not find or create ask-ai-view element for rendering');
            return;
        }
        
        // Ensure the view is visible
        askAIView.style.display = 'block';
        
        console.log('🔵 Rendering Ask AI view into:', askAIView.id, 'isHistoryLoading:', isHistoryLoading, 'historySearch length:', historySearch?.length);

        const htmlContent = `
            <div class="ask-ai-container" style="display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden;">
                ${isHistoryLoading ? `
                    <div class="loading-spinner" style="margin-top: 150px;"></div>
                ` : `
                <div class="ask-ai-body" style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; height: 100%;">
                    <div class="min-height-scrollbar" id="message-div-ref" onscroll="handleChatScroll(event)" style="flex: 1; overflow-y: auto !important; overflow-x: hidden !important; min-height: 0; position: relative;">
                        ${historySearch?.length > 0 ? renderChatHistory() : ''}
                        ${loader ? `
                            <div class="div3">
                                <div class="container">
                                    <div class="prompt-container">
                                        <p class="p5">${escapeHtml(prompt)}</p>
                                    </div>
                                    <div style="width: 32px; height: 32px; border-radius: 50%; background: #2667ff; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; flex-shrink: 0; margin-left: 8px;">
                                        ${getUserInitials()}
                                    </div>
                                </div>
                                <p style="margin-right: 34px; margin-top: 3px;" class="p6">${formatTime(new Date())}</p>
                            </div>
                        ` : ''}
                        <div id="bottom-ref"></div>
                    </div>
                    <div class="prompt-outer-container" style="flex-shrink: 0; position: sticky; bottom: 0; z-index: 100; background-color: #fff; width: 100%; max-width: 49.7rem; margin: 0 auto; padding: 11px; padding-top: 8px; box-sizing: border-box; display: flex; align-items: center;">
                        <div class="g-prompt-container" style="width: 95%; flex: 1;">
                            <textarea id="prompt-input-ref" class="prompt-input" oninput="handlePromptInput(event)" placeholder="Ask any questions about this agreement" style="width: 100%; background: white; padding: 10px 14px; border: none; outline: none; resize: vertical; min-height: 38px; font-size: 14px; font-family: inherit; line-height: 1.5; box-sizing: border-box; direction: ltr; text-align: left; display: block !important; visibility: visible !important;">${escapeHtml(prompt || '')}</textarea>
                        </div>
                        <div class="prompt-actions" style="padding-left: 10px; padding-right: 5px; flex-shrink: 0;">
                            <label id="prompt-send-btn" class="prompt-action-send" onclick="handleGenerate()" style="border-radius: 10px; padding: 8px; cursor: ${error || !prompt?.trim() || loader ? 'not-allowed' : 'pointer'}; margin: 0; display: flex !important; align-items: center; justify-content: center; background-color: ${error || !prompt?.trim() || loader ? 'gray' : '#2667FF'}; color: #fff; transition: background-color 0.2s; border: none; min-width: 36px; min-height: 36px; box-sizing: border-box; visibility: visible !important;">
                                ${loader ? '<div class="loading-spinner-small"></div>' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>'}
                            </label>
                        </div>
                    </div>
                    ${prompt?.length >= 2000 ? `
                        <p style="font-size: 12px; color: ${error ? 'red' : 'black'}; margin: 0; color: #6c757d; text-align: end; padding-right: 1.5rem; padding-left: 11px;">
                            Maximum Limit Reached (2000 words only)
                        </p>
                    ` : ''}
                </div>
                `}
            </div>
        `;
        
        console.log('🔵 Setting innerHTML, length:', htmlContent.length);
        askAIView.innerHTML = htmlContent;
        console.log('✅ innerHTML set, askAIView.children.length:', askAIView.children.length);

        // Find elements within the askAIView we just rendered
        bottomRef = askAIView.querySelector('#bottom-ref');
        promptInputRef = askAIView.querySelector('#prompt-input-ref');
        messageDivRef = askAIView.querySelector('#message-div-ref');
        
        // Store reference globally for scroll handling
        window.messageDivRef = messageDivRef;
        
        // Force scrollbar to work by ensuring proper height constraints
        const ensureScrollable = () => {
            if (messageDivRef && askAIView) {
                const askAiBody = askAIView.querySelector('.ask-ai-body');
                const promptContainer = askAIView.querySelector('.prompt-outer-container');
                
                if (askAiBody && promptContainer) {
                    // Get computed styles
                    const bodyStyle = window.getComputedStyle(askAiBody);
                    const promptStyle = window.getComputedStyle(promptContainer);
                    
                    // Calculate available height more accurately
                    const bodyHeight = askAiBody.offsetHeight || askAiBody.clientHeight;
                    const promptHeight = promptContainer.offsetHeight || promptContainer.clientHeight;
                    const availableHeight = bodyHeight - promptHeight;
                    
                    console.log('Scroll Debug:', {
                        bodyHeight,
                        promptHeight,
                        availableHeight,
                        scrollHeight: messageDivRef.scrollHeight,
                        clientHeight: messageDivRef.clientHeight
                    });
                    
                    // Set explicit height to force scrolling
                    if (availableHeight > 0 && availableHeight < messageDivRef.scrollHeight) {
                        messageDivRef.style.height = availableHeight + 'px';
                        messageDivRef.style.maxHeight = availableHeight + 'px';
                        messageDivRef.style.overflowY = 'scroll';
                    } else {
                        // Use flex if content fits
                        messageDivRef.style.height = '';
                        messageDivRef.style.maxHeight = '';
                        messageDivRef.style.overflowY = 'auto';
                    }
                    
                    // Ensure overflow-x is hidden
                    messageDivRef.style.overflowX = 'hidden';
                    
                    // Force a reflow to trigger scrollbar
                    void messageDivRef.offsetHeight;
                }
            }
        };
        
        // Ensure scrollable after render with multiple attempts
        setTimeout(ensureScrollable, 100);
        setTimeout(ensureScrollable, 300);
        setTimeout(ensureScrollable, 600);
        
        // Also recalculate on window resize
        const resizeHandler = () => {
            setTimeout(ensureScrollable, 100);
        };
        window.addEventListener('resize', resizeHandler);
        
        // Store cleanup
        if (!window.askAICleanup) {
            window.askAICleanup = [];
        }
        window.askAICleanup.push(() => {
            window.removeEventListener('resize', resizeHandler);
        });

        // Set textarea value properly (value attribute doesn't work for textarea)
        if (promptInputRef) {
            promptInputRef.value = prompt || '';
            // Auto-resize textarea
            promptInputRef.style.height = 'auto';
            promptInputRef.style.height = Math.max(38, promptInputRef.scrollHeight) + 'px';
            // Auto-focus input
            promptInputRef.focus();
        }
        
        // Add auto-resize listener for textarea
        if (promptInputRef && !promptInputRef.hasAttribute('data-resize-listener')) {
            promptInputRef.setAttribute('data-resize-listener', 'true');
            promptInputRef.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.max(38, this.scrollHeight) + 'px';
            });
        }

        // Only scroll to bottom on initial load or when there are new messages
        // Don't auto-scroll on every render to prevent unwanted scrolling
        // Scroll will be handled by specific functions (handleGenerate, fetchHistory, etc.)
    }

    // Render chat history
    function renderChatHistory() {
        if (!historySearch || historySearch.length === 0) return '';

        return historySearch
            .slice()
            .reverse()
            .filter(item => item && item !== null && item !== undefined)
            .map((item, i) => {
                if (item?.isInitialResponse === true) {
                    return syncDocumentWithAiResponse(item);
                } else {
                    return `
                        <div key="${item?._id || i}" class="outer-container" style="margin-bottom: 10px; padding: 0 6px; margin-top: 12px;">
                            <div class="div1" style="display: flex; justify-content: center; align-items: center;">
                                <div style="margin-right: 7px;" class="prompt-container">
                                    <p class="p1">${escapeHtml(item?.instruction || '')}</p>
                                </div>
                                <div style="width: 32px; height: 32px; border-radius: 50%; background: #2667ff; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; flex-shrink: 0;">
                                    ${getUserInitials()}
                                </div>
                            </div>
                            <p style="margin-top: 3px;" class="p2">${formatTime(item?.createdAt)}</p>
                            <div class="div2">
                                <div>
                                    <button class="btn-outline-success" style="padding: 8px 9px; border-radius: 50%; margin-top: 10px; cursor: pointer;">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle></svg>
                                    </button>
                                </div>
                                <div style="margin-left: 7px;" class="response-container">
                                    <p class="p3">${formatResponse(item.response || '')}</p>
                                    <div onclick="copyToClipboard('${escapeHtml(item.response || '')}')" class="copy-clause">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                    </div>
                                </div>
                            </div>
                            <p style="margin-left: 31px; margin-top: 3px;" class="p4">${formatTime(item?.createdAt)}</p>
                        </div>
                    `;
                }
            }).join('');
    }

    // Sync document with AI response
    function syncDocumentWithAiResponse(item) {
        if (!item || !item.response) return '';

        const cleanedHtmlData = item.response.replace(/^```html\s*|\s*```$/g, '');
        const regex = /<li>(.*?)<\/li>/gs;
        const matches = [...cleanedHtmlData?.matchAll(regex)] || [];
        const Questions = matches?.map((match) => match[1]) || [];
        const regex2 = /<ol>.*?<\/ol>/gs;
        const noOlHtmlData = cleanedHtmlData?.replace(regex2, '');
        const removeInlineStyles = (html) => {
            return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        };

        return `
            <div class="div5" style="display: flex; align-items: top;">
                <div>
                    <button style="border: 0; background-color: rgba(40, 199, 111, .1); color: #28c76f; padding: 8px 9px; border-radius: 50%; margin-top: 10px; cursor: pointer;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle></svg>
                    </button>
                </div>
                <div key="${item._id}" class="outer-container" style="margin-bottom: 20px; padding: 0 6px; margin-top: 12px; box-sizing: border-box;">
                    <div id="syncDocResponse" class="response-container" style="border-radius: 8px; position: relative; background-color: #f9f9f9; padding: 12px; max-width: calc(100% - 50px); width: fit-content; box-shadow: rgba(99, 99, 99, 0.2) 0px 2px 8px 0px; font-size: 12px; word-wrap: break-word; overflow-wrap: break-word; line-height: 1.6; box-sizing: border-box;">
                        <div style="line-height: 1.6; color: #333; margin-bottom: ${Questions?.length ? '12px' : '0'};">
                            ${formatHtmlContent(removeInlineStyles(noOlHtmlData))}
                        </div>
                        ${Questions?.length ? Questions.map((qs, i) => `
                            <div key="${i}" id="question-${i}" onclick="setPromptFromQuestion('${escapeHtml(qs)}')" class="doc-questions" style="display: flex; align-items: top; cursor: pointer;" onmouseover="this.style.color='#446995'; this.style.textDecoration='dotted';" onmouseout="this.style.color=''; this.style.textDecoration='none';">
                                <p class="p8" style="margin-bottom: 25px; font-size: 12px;">${i + 1}</p>
                                <p style="margin: 0; font-size: 12px;">- ${escapeHtml(qs)}</p>
                            </div>
                        `).join('') : ''}
                        <div onclick="copyToClipboard('${escapeHtml(item.response)}')" class="copy-clause" style="padding: 2px 5px; border-radius: 0 0 8px 0; position: absolute; bottom: 0; right: 0; cursor: pointer; background-color: rgba(255, 255, 255, 0.8);">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </div>
                    </div>
                    <p class="p9" style="font-size: 11px; color: #6c757d; text-align: end;">
                        ${formatTime(item.createdAt)}
                    </p>
                </div>
            </div>
        `;
    }

    // Format HTML content - for sync document response
    function formatHtmlContent(html) {
        if (!html) return '';
        // Return HTML as-is (will be inserted via innerHTML)
        return html;
    }

    // Format response - matches MS Editor formatResponse exactly
    function formatResponse(text) {
        if (!text) return '';
        const lines = text.split('\n');
        let html = '';
        let listItems = [];
        let listKey = 0;

        const pushList = () => {
            if (listItems.length) {
                html += '<ul style="margin-left: -17px !important;">';
                listItems.forEach((item, idx) => {
                    html += `<li style="font-size: 12px; margin: 4px 0; line-height: 1.6;">${escapeHtml(item.replace(/\*/g, '').trim())}</li>`;
                });
                html += '</ul>';
                listItems = [];
            }
        };

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) {
                pushList();
                return;
            }

            if (trimmedLine.startsWith('# ')) {
                pushList();
                html += `<h1 style="font-size: 14px;">${escapeHtml(trimmedLine.replace(/^#\s*/, ''))}</h1>`;
            } else if (trimmedLine.startsWith('## ')) {
                pushList();
                html += `<h2 style="font-size: 12px;">${escapeHtml(trimmedLine.replace(/^##\s*/, ''))}</h2>`;
            } else if (trimmedLine.startsWith('### ')) {
                pushList();
                html += `<h3 style="font-size: 12px;">${escapeHtml(trimmedLine.replace(/^###\s*/, ''))}</h3>`;
            } else if (trimmedLine.startsWith('#### ')) {
                pushList();
                html += `<h4 style="font-size: 12px;">${escapeHtml(trimmedLine.replace(/^####\s*/, ''))}</h4>`;
            } else if (/^\d+\.\s+/.test(trimmedLine) || /^-\s+/.test(trimmedLine) || /^\d+\s*-\s+/.test(trimmedLine)) {
                // Handle patterns: "3. ", "- ", "3 - ", "3- "
                let cleanedLine = trimmedLine
                    .replace(/^\d+\.\s*/, '')  // Remove "3. "
                    .replace(/^-\s*/, '')      // Remove "- "
                    .replace(/\*/g, '')        // Remove asterisks
                    .trim();
                // For "3 - " pattern, keep the number and dash as part of the content
                if (/^\d+\s*-\s+/.test(trimmedLine)) {
                    // Keep the "3 - " format in the list item
                    cleanedLine = trimmedLine.replace(/\*/g, '').trim();
                }
                listItems.push(cleanedLine);
            } else {
                pushList();
                html += `<p style="font-size: 12px; margin-bottom: 0; margin-top: -8px !important;">${escapeHtml(trimmedLine)}</p>`;
            }
        });

        pushList();
        return html;
    }

    // Handle generate
    window.handleGenerate = async function() {
        if (prompt?.length > 2000 || loader || !prompt?.trim()) return;
        
        const currentPrompt = prompt.trim();
        loader = true;
        error = false;
        errorMessage = '';
        
        // Update prompt input to show loading state
        const promptInput = document.getElementById('prompt-input-ref');
        if (promptInput) {
            promptInput.disabled = true;
        }
        
        renderAskAIView();
        
        // Scroll to bottom when showing loader
        setTimeout(() => {
            const bottomRefElement = document.getElementById('bottom-ref');
            if (bottomRefElement) {
                bottomRefElement.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);

        try {
            const pluginData = window.getPluginData();
            const backendUrl = window.getBackendUrl();
            const accessToken = window.getAccessToken();

            if (!pluginData?.contractId || !accessToken) {
                throw new Error('Missing required data');
            }

            const formData = { contractId: pluginData.contractId, question: currentPrompt };
            const url = `${backendUrl}/ai-assistant/ask-question`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': accessToken || '',
                    'accept-language': 'en-US,en;q=0.9'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.msg || 'Failed to get AI response');
            }

            const data = await response.json();
            if (data?.status && data?.data?.chat) {
                // Clear prompt
                prompt = '';
                
                // Add new chat to history
                historySearch = [data.data.chat, ...historySearch];
                if (historySearch.length > 4) {
                    historySearch.pop();
                    totalCount += 1;
                }
                remainingBalance = data.data.balance;
                
                // Re-enable input
                if (promptInput) {
                    promptInput.disabled = false;
                    promptInput.focus();
                }
                
                loader = false;
                renderAskAIView();
                
                // Scroll to bottom after render
                setTimeout(() => {
                    const bottomRefElement = document.getElementById('bottom-ref');
                    if (bottomRefElement) {
                        bottomRefElement.scrollIntoView({ behavior: 'smooth' });
                    }
                }, 100);
            } else {
                errorMessage = data.msg || 'Failed to get response';
                error = true;
                if (promptInput) {
                    promptInput.disabled = false;
                }
            }
        } catch (err) {
            console.error('Error generating response:', err);
            errorMessage = err.message || 'Something went wrong';
            error = true;
            const promptInput = document.getElementById('prompt-input-ref');
            if (promptInput) {
                promptInput.disabled = false;
            }
        } finally {
            loader = false;
            renderAskAIView();
        }
    };

    // Handle prompt input
    window.handlePromptInput = function(event) {
        prompt = event.target.value;
        error = prompt.length >= 2000;
        
        // Auto-resize textarea
        if (event.target) {
            event.target.style.height = 'auto';
            event.target.style.height = Math.max(38, event.target.scrollHeight) + 'px';
        }
        
        // Update send button state without re-rendering entire view
        const sendButton = document.getElementById('prompt-send-btn');
        if (sendButton) {
            sendButton.style.backgroundColor = (error || !prompt?.trim() || loader) ? 'gray' : '#2667FF';
            sendButton.style.cursor = (error || !prompt?.trim() || loader) ? 'not-allowed' : 'pointer';
        }
        
        // Update error message if needed
        const errorMsg = document.querySelector('.prompt-error-message');
        if (prompt.length >= 2000) {
            if (!errorMsg) {
                const promptContainer = document.querySelector('.prompt-outer-container');
                if (promptContainer) {
                    const errorP = document.createElement('p');
                    errorP.className = 'prompt-error-message';
                    errorP.style.cssText = 'font-size: 12px; color: red; margin: 0; color: #6c757d; text-align: end; padding-right: 1.5rem;';
                    errorP.textContent = 'Maximum Limit Reached (2000 words only)';
                    promptContainer.appendChild(errorP);
                }
            }
        } else if (errorMsg) {
            errorMsg.remove();
        }
    };

    // Handle chat scroll
    window.handleChatScroll = function(e) {
        // Load older messages when scrolled to top
        if (e.target.scrollTop === 0) {
            if (Math.ceil(totalCount / 5) > currentPage) {
                const scrollHeight = e.target.scrollHeight;
                fetchHistory(`page=${currentPage + 1}`, false, scrollHeight);
                currentPage += 1;
            }
        }
    };

    // Fetch history - matches MS Editor exactly
    async function fetchHistory(query, first, scrollPos) {
        const pluginData = window.getPluginData();
        const backendUrl = window.getBackendUrl();
        const accessToken = window.getAccessToken();

        if (!pluginData.contractId || !accessToken) {
            isHistoryLoading = false;
            renderAskAIView();
            return;
        }

        const param = query ? `contractId=${pluginData.contractId}&${query}` : `contractId=${pluginData.contractId}`;
        const url = `${backendUrl}/ai-assistant/chat-history?${param}`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                // Match MS Editor: if (response?.status && response?.data?.result.length > 0)
                if (data?.status && data?.data?.result?.length > 0) {
                    totalCount = data.data?.totalCount || 0;
                    const result = data.data?.result || [];
                    
                    // Add new results to history (avoid duplicates)
                    const existingIds = new Set(historySearch.map(item => item._id || item.message_id));
                    const newItems = result.filter(item => !existingIds.has(item._id || item.message_id));
                    historySearch = [...historySearch, ...newItems];
                    
                    // Re-render before scrolling to ensure DOM is updated
                    isHistoryLoading = false;
                    renderAskAIView();
                    
                    // Wait for DOM to update, then handle scroll
                    setTimeout(() => {
                        const messageDivRefElement = document.getElementById('message-div-ref') || window.messageDivRef;
                        if (first) {
                            const bottomRefElement = document.getElementById('bottom-ref');
                            if (bottomRefElement) {
                                bottomRefElement.scrollIntoView({ behavior: 'auto' });
                            }
                        } else if (scrollPos && messageDivRefElement) {
                            // Preserve scroll position when loading older messages at top
                            // Match MS Editor: scrollTop = scrollHeight - scrollPos
                            // scrollPos is the old scrollHeight before new content was added
                            const newScrollHeight = messageDivRefElement.scrollHeight;
                            messageDivRefElement.scrollTop = newScrollHeight - scrollPos;
                        }
                    }, 150);
                } else {
                    // Match MS Editor: else await syncDocumentWithAi(false)
                    // No history or error, sync document to show initial questions
                    if (first) {
                        await syncDocumentWithAi(false);
                    }
                }
            } else {
                // HTTP error, sync document if first load
                if (first) {
                    await syncDocumentWithAi(false);
                }
            }
        } catch (err) {
            console.error('Error fetching history:', err);
            // On error, sync document if first load
            if (first) {
                await syncDocumentWithAi(false);
            }
        } finally {
            // Match MS Editor: setisHistoryLoading(false) - always set after check
            // Only set loading to false and render if we haven't already done so
            if (isHistoryLoading) {
                isHistoryLoading = false;
                renderAskAIView();
            }
        }
    }

    // Sync document with AI - matches MS Editor exactly
    window.syncDocumentWithAi = async function(regenerate = false) {
        try {
            const pluginData = window.getPluginData();
            const backendUrl = window.getBackendUrl();
            const accessToken = window.getAccessToken();

            if (!pluginData.contractId || !accessToken) {
                isHistoryLoading = false;
                renderAskAIView();
                return;
            }

            const bodyData = new FormData();
            bodyData.append('contractId', pluginData.contractId);
            bodyData.append('regenerate', regenerate);

            const url = `${backendUrl}/ai-assistant/onlyoffice/sync-document`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'x-auth-token': accessToken || ''
                },
                body: bodyData
            });

            if (response.ok) {
                const data = await response.json();
                // Match MS Editor: if (response?.status)
                if (data?.status) {
                    // Match MS Editor: const responseData = response.data?.data || response.data?.result
                    const responseData = data.data?.data || data.data?.result;
                    if (responseData) {
                        // Match MS Editor: setHistorySearch((value) => { return [responseData, ...value] })
                        // Check if already exists to avoid duplicates
                        const exists = historySearch.some(item => 
                            (item._id || item.message_id) === (responseData._id || responseData.message_id)
                        );
                        if (!exists) {
                            historySearch = [responseData, ...historySearch];
                            // Scroll to bottom after adding initial response
                            setTimeout(() => {
                                const bottomRefElement = document.getElementById('bottom-ref');
                                if (bottomRefElement) {
                                    bottomRefElement.scrollIntoView({ behavior: 'auto' });
                                }
                            }, 200);
                        }
                    }
                } else {
                    // Match MS Editor: setErrorMessage(response.msg)
                    errorMessage = data.msg || 'Failed to sync document';
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                errorMessage = errorData.msg || 'Failed to sync document';
            }
        } catch (err) {
            console.error('Error syncing document:', err);
            errorMessage = err.message || 'Failed to sync document';
        } finally {
            isHistoryLoading = false;
            renderAskAIView();
        }
    };

    // Set prompt from question
    window.setPromptFromQuestion = function(question) {
        prompt = question;
        error = prompt.length >= 2000;
        const promptInput = document.getElementById('prompt-input-ref');
        if (promptInput) {
            // Preserve cursor position by setting selection at the end
            promptInput.value = question;
            const length = question.length;
            promptInput.setSelectionRange(length, length);
            promptInput.focus();
            
            // Update send button state
            const sendButton = document.getElementById('prompt-send-btn');
            if (sendButton) {
                sendButton.style.backgroundColor = (error || !prompt?.trim() || loader) ? 'gray' : '#2667FF';
                sendButton.style.cursor = (error || !prompt?.trim() || loader) ? 'not-allowed' : 'pointer';
            }
            
            // Update error message if needed
            const errorMsg = document.querySelector('.prompt-error-message');
            if (prompt.length >= 2000) {
                if (!errorMsg) {
                    const promptContainer = document.querySelector('.prompt-outer-container');
                    if (promptContainer) {
                        const errorP = document.createElement('p');
                        errorP.className = 'prompt-error-message';
                        errorP.style.cssText = 'font-size: 12px; color: red; margin: 0; color: #6c757d; text-align: end; padding-right: 1.5rem;';
                        errorP.textContent = 'Maximum Limit Reached (2000 words only)';
                        promptContainer.appendChild(errorP);
                    }
                }
            } else if (errorMsg) {
                errorMsg.remove();
            }
        }
    };

    // Copy to clipboard
    window.copyToClipboard = function(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied To Clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy:', err);
            showToast('Failed to copy', 'error');
        });
    };

    // Handle back from Ask AI
    window.handleBackFromAskAI = function() {
        // Close drawer when back is clicked
        if (window.closeDrawer) {
            window.closeDrawer();
            return;
        }
        if (window.showReviewHub) {
            window.showReviewHub();
        }
    };

    // Get user initials
    function getUserInitials() {
        const pluginData = window.getPluginData();
        const userName = pluginData.userName || pluginData.userDetails?.fullName || 'U';
        const parts = userName.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return userName[0].toUpperCase();
    }

    // Format time - matches MS Editor moment().calendar() format
    function formatTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
        const timeStr = `${displayHours}:${displayMinutes} ${ampm}`;
        
        if (dateOnly.getTime() === today.getTime()) {
            return `Today at ${timeStr}`;
        } else if (dateOnly.getTime() === yesterday.getTime()) {
            return `Yesterday at ${timeStr}`;
        } else {
            const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
            if (diffDays < 7) {
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                return `${dayNames[date.getDay()]} at ${timeStr}`;
            } else {
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const day = date.getDate();
                const month = monthNames[date.getMonth()];
                const year = date.getFullYear() !== now.getFullYear() ? ` ${date.getFullYear()}` : '';
                return `${month} ${day}${year} at ${timeStr}`;
            }
        }
    }

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
        toast.className = `toast-message ${type === 'error' ? 'error' : ''}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

})(window);
