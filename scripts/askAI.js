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
            <div class="ask-ai-container" style="margin-bottom: 0; box-shadow: none; flex: 1; border-radius: 0; margin-top: 0; width: 100%; height: 100%; display: flex; flex-direction: column;">
                <div class="ask-ai-body" style="display: flex; flex-direction: column; padding: 11px; flex: 1; overflow: hidden;">
                    ${isHistoryLoading ? `
                        <div class="min-height-scrollbar" id="message-div-ref" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding-top: 20px; padding-bottom: 40px; padding-left: 10px; padding-right: 10px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                            <div class="loading-container" style="margin-top: 150px;"><div class="loading-spinner"></div></div>
                            <div id="bottom-ref"></div>
                        </div>
                    ` : `
                        <div class="min-height-scrollbar" id="message-div-ref" onscroll="handleChatScroll(event)" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding-top: 20px; padding-bottom: 40px; padding-left: 10px; padding-right: 10px; ${historySearch?.length === 0 ? 'display: flex; flex-direction: column; justify-content: center; align-items: center;' : ''}">
                            ${historySearch?.length > 0 ? renderChatHistory() : ''}
                            ${loader ? `
                                <div style="margin-left: 50px; margin-bottom: 20px;">
                                    <div style="display: flex; justify-content: center; align-items: center;">
                                        <div style="margin-right: 7px; border-radius: 8px 8px 0 8px; margin-left: auto; background-color: #eff4ff; padding: 5px 10px; width: fit-content; box-shadow: rgba(99, 99, 99, 0.2) 0px 2px 8px 0px;">
                                            <p style="font-size: 12px; margin: 0;">${escapeHtml(prompt)}</p>
                                        </div>
                                        <div style="width: 32px; height: 32px; border-radius: 50%; background: #2667ff; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">
                                            ${getUserInitials()}
                                        </div>
                                    </div>
                                    <p style="margin-right: 34px; margin-top: 3px; font-size: 11px; color: #6c757d; text-align: end;">
                                        ${formatTime(new Date())}
                                    </p>
                                </div>
                            ` : ''}
                            <div id="bottom-ref"></div>
                        </div>
                    `}
                    <div class="prompt-outer-container" style="width: 100%; background-color: #fff; z-index: 10; max-width: 49.7rem; display: flex; align-items: center; position: sticky; bottom: 0; margin: 0 auto; padding-top: 12px;">
                        <div class="g-prompt-container" style="width: 95%; min-height: 38px; background-color: #fff; border: 1px solid rgba(0, 0, 0, 0.2); border-radius: 10px; display: flex; flex-direction: column; align-items: flex-start; gap: 0.25rem; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);">
                            <textarea id="prompt-input-ref" class="prompt-input" oninput="handlePromptInput(event)" placeholder="Ask any questions about this agreement" style="width: 100%; background: white; padding: 7px 13px; border-bottom: none; border: none; outline: none; resize: vertical; min-height: 38px; font-size: 14px; font-family: inherit; line-height: unset;">${escapeHtml(prompt || '')}</textarea>
                        </div>
                        <div class="prompt-actions" style="padding-left: 10px; padding-right: 5px;">
                            <label class="prompt-action-send" onclick="handleGenerate()" style="border-radius: 10px; padding: 8px; cursor: pointer; margin: 0; display: flex; align-items: center; justify-content: center; background: ${error || !prompt?.trim() ? 'gray' : '#2667FF'}; color: #fff;">
                                ${loader ? '<div class="loading-spinner-small"></div>' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>'}
                            </label>
                        </div>
                    </div>
                    ${prompt?.length >= 2000 ? `
                        <p style="font-size: 12px; color: ${error ? 'red' : 'black'}; margin: 0; color: #6c757d; text-align: end; padding-right: 1.5rem;">
                            Maximum Limit Reached (2000 words only)
                        </p>
                    ` : ''}
                </div>
            </div>
        `;
        
        console.log('🔵 Setting innerHTML, length:', htmlContent.length);
        askAIView.innerHTML = htmlContent;
        console.log('✅ innerHTML set, askAIView.children.length:', askAIView.children.length);

        // Find elements within the askAIView we just rendered
        bottomRef = askAIView.querySelector('#bottom-ref');
        promptInputRef = askAIView.querySelector('#prompt-input-ref');
        messageDivRef = askAIView.querySelector('#message-div-ref');

        // Set textarea value properly (value attribute doesn't work for textarea)
        if (promptInputRef) {
            promptInputRef.value = prompt || '';
            // Auto-focus input
            promptInputRef.focus();
        }

        // Scroll to bottom
        if (bottomRef) {
            setTimeout(() => {
                bottomRef.scrollIntoView({ behavior: 'auto' });
            }, 200);
        }
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
                                <div style="margin-right: 7px;" class="prompt-container" style="border-radius: 8px 8px 0 8px; margin-left: auto; background-color: #eff4ff; padding: 5px 10px; width: fit-content; box-shadow: rgba(99, 99, 99, 0.2) 0px 2px 8px 0px;">
                                    <p style="font-size: 12px; margin: 0;">${escapeHtml(item?.instruction || '')}</p>
                                </div>
                                <div style="width: 32px; height: 32px; border-radius: 50%; background: #2667ff; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">
                                    ${getUserInitials()}
                                </div>
                            </div>
                            <p style="margin-top: 3px; font-size: 11px; color: #6c757d; text-align: end;">
                                ${formatTime(item?.createdAt)}
                            </p>
                            <div class="div2" style="display: flex; align-items: top;">
                                <div>
                                    <button style="border: 0; background-color: rgba(40, 199, 111, .1); color: #28c76f; padding: 8px 9px; border-radius: 50%; margin-top: 10px; cursor: pointer;">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle></svg>
                                    </button>
                                </div>
                                <div style="margin-left: 7px;" class="response-container" style="border-radius: 8px; position: relative; background-color: #f9f9f9; padding: 12px; min-width: 300px; max-width: 85%; width: fit-content; box-shadow: rgba(99, 99, 99, 0.2) 0px 2px 8px 0px; font-size: 12px; word-wrap: break-word;">
                                    <div class="formatted-response" style="line-height: 1.6; color: #333;">${formatResponse(item.response || '')}</div>
                                    <div onclick="copyToClipboard('${escapeHtml(item.response || '')}')" class="copy-clause" style="padding: 2px 5px; border-radius: 0 0 8px 0; position: absolute; bottom: 0; right: 0; cursor: pointer; background-color: rgba(255, 255, 255, 0.8);">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                    </div>
                                </div>
                            </div>
                            <p style="margin-left: 31px; margin-top: 3px; font-size: 11px; color: #6c757d; text-align: start;">
                                ${formatTime(item?.createdAt)}
                            </p>
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
                <div key="${item._id}" class="outer-container" style="margin-bottom: 20px; padding: 0 6px; margin-top: 12px;">
                    <div id="syncDocResponse" class="response-container" style="border-radius: 8px; position: relative; background-color: #f9f9f9; padding: 12px; min-width: 300px; max-width: 85%; width: fit-content; box-shadow: rgba(99, 99, 99, 0.2) 0px 2px 8px 0px; font-size: 12px; word-wrap: break-word; line-height: 1.6;">
                        <div style="line-height: 1.6; color: #333; margin-bottom: ${Questions?.length ? '12px' : '0'};">
                            ${formatHtmlContent(removeInlineStyles(noOlHtmlData))}
                        </div>
                        ${Questions?.length ? Questions.map((qs, i) => `
                            <div key="${i}" id="question-${i}" onclick="setPromptFromQuestion('${escapeHtml(qs)}')" class="doc-questions" style="display: flex; align-items: flex-start; cursor: pointer; margin-bottom: 12px; padding: 8px; border-radius: 4px; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">
                                <p style="margin: 0; margin-right: 8px; font-size: 12px; font-weight: 600; color: #2667ff; min-width: 20px;">${i + 1}.</p>
                                <p style="margin: 0; font-size: 12px; color: #333; line-height: 1.6; flex: 1;">${escapeHtml(qs)}</p>
                            </div>
                        `).join('') : ''}
                        <div onclick="copyToClipboard('${escapeHtml(item.response)}')" class="copy-clause" style="padding: 2px 5px; border-radius: 0 0 8px 0; position: absolute; bottom: 0; right: 0; cursor: pointer; background-color: rgba(255, 255, 255, 0.8);">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </div>
                    </div>
                    <p style="font-size: 11px; color: #6c757d; text-align: end; margin: 0; margin-top: 3px;">
                        ${formatTime(item.createdAt)}
                    </p>
                </div>
            </div>
        `;
    }

    // Format response
    function formatResponse(text) {
        if (!text) return '';
        const lines = text.split('\n');
        let html = '';
        let inList = false;

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) {
                if (inList) { html += '</ul>'; inList = false; }
                return;
            }

            if (trimmedLine.startsWith('# ')) {
                if (inList) { html += '</ul>'; inList = false; }
                html += `<h1 style="font-size: 18px; font-weight: 700; margin: 12px 0 8px 0; line-height: 1.4;">${escapeHtml(trimmedLine.replace(/^#\s*/, ''))}</h1>`;
            } else if (trimmedLine.startsWith('## ')) {
                if (inList) { html += '</ul>'; inList = false; }
                html += `<h2 style="font-size: 16px; font-weight: 700; margin: 10px 0 6px 0; line-height: 1.4;">${escapeHtml(trimmedLine.replace(/^##\s*/, ''))}</h2>`;
            } else if (trimmedLine.startsWith('### ')) {
                if (inList) { html += '</ul>'; inList = false; }
                html += `<h3 style="font-size: 14px; font-weight: 600; margin: 8px 0 4px 0; line-height: 1.4;">${escapeHtml(trimmedLine.replace(/^###\s*/, ''))}</h3>`;
            } else if (trimmedLine.startsWith('#### ')) {
                if (inList) { html += '</ul>'; inList = false; }
                html += `<h4 style="font-size: 12px; font-weight: 600; margin: 6px 0 4px 0; line-height: 1.4;">${escapeHtml(trimmedLine.replace(/^####\s*/, ''))}</h4>`;
            } else if (/^\d+\.\s+/.test(trimmedLine) || /^-\s+/.test(trimmedLine)) {
                if (!inList) { html += '<ul style="margin: 8px 0 8px 20px; padding-left: 0; list-style-type: disc;">'; inList = true; }
                const itemText = trimmedLine.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').replace(/\*/g, '').trim();
                html += `<li style="font-size: 12px; margin: 4px 0; line-height: 1.6; color: #333;">${escapeHtml(itemText)}</li>`;
            } else {
                if (inList) { html += '</ul>'; inList = false; }
                html += `<p style="font-size: 12px; margin: 6px 0; line-height: 1.6; color: #333;">${escapeHtml(trimmedLine)}</p>`;
            }
        });

        if (inList) html += '</ul>';
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
                    if (bottomRef) {
                        bottomRef.scrollIntoView({ behavior: 'smooth' });
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
        renderAskAIView();
    };

    // Handle chat scroll
    window.handleChatScroll = function(e) {
        if (e.target.scrollTop === 0) {
            if (Math.ceil(totalCount / 5) > currentPage) {
                fetchHistory(`page=${currentPage + 1}`, false, e.target.scrollHeight);
                currentPage += 1;
            }
        }
    };

    // Fetch history
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
                if (data?.status && data?.data?.result?.length > 0) {
                    totalCount = data.data.totalCount || 0;
                    historySearch = [...historySearch, ...(data.data.result || [])];
                    
                    if (first) {
                        setTimeout(() => {
                            if (bottomRef) bottomRef.scrollIntoView({ behavior: 'auto' });
                        }, 200);
                    } else if (scrollPos && messageDivRef) {
                        messageDivRef.scrollTop = messageDivRef.scrollHeight - scrollPos;
                    }
                } else {
                    // No history, sync document to show initial questions
                    await syncDocumentWithAi(false);
                }
            } else {
                // Error fetching, try to sync document
                await syncDocumentWithAi(false);
            }
        } catch (err) {
            console.error('Error fetching history:', err);
            await syncDocumentWithAi(false);
        } finally {
            isHistoryLoading = false;
            renderAskAIView();
        }
    }

    // Sync document with AI
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
                if (data?.status) {
                    const responseData = data.data?.data || data.data?.result;
                    if (responseData) {
                        historySearch = [responseData, ...historySearch];
                    }
                }
            }
        } catch (err) {
            console.error('Error syncing document:', err);
        } finally {
            isHistoryLoading = false;
            renderAskAIView();
        }
    };

    // Set prompt from question
    window.setPromptFromQuestion = function(question) {
        prompt = question;
        const promptInput = document.getElementById('prompt-input-ref');
        if (promptInput) {
            promptInput.value = question;
            promptInput.focus();
        }
        renderAskAIView();
        if (promptInputRef) {
            promptInputRef.focus();
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
