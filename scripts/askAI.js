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
            <div class="ask-ai-container" style="display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; position: relative;">
                ${isHistoryLoading ? `
                    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
                        <div class="loading-spinner"></div>
                    </div>
                ` : `
                <div class="ask-ai-body" style="display: flex; flex-direction: column; overflow: scroll; height: calc(100vh - 52px);">
                    <div class="" id="message-div-ref" onscroll="handleChatScroll(event)" style="flex: 1; overflow-y: auto !important; overflow-x: hidden !important; min-height: 0; position: relative;">
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
                                <p style="margin-right: 34px; margin-top: 3px; text-align: right;" class="p6">${formatTime(new Date())}</p>
                            </div>
                        ` : ''}
                        <div class="prompt-outer-container" style="flex-shrink: 0; background-color: #fff; width: 100%; max-width: 49.7rem; margin: 0 auto; padding: 11px; padding-top: 8px; box-sizing: border-box;">
                            <div class="c_d_ai_prompt_container" style="width: 100%; max-width: 100%; background-color: #fff !important; border: 1px solid #dadce0; border-radius: 15px; box-shadow: 0 1px 6px rgba(32, 33, 36, 0.28); position: relative; transition: box-shadow 0.2s;">
                                <div class="c_d_ai_prompt_input_wrapper ${!prompt?.trim() ? 'c_d_ai_prompt_input_wrapper_v2' : ''}" id="prompt-input-wrapper" style="display: flex; flex-direction: ${!prompt?.trim() ? 'row' : 'column'}; align-items: ${!prompt?.trim() ? 'center' : 'flex-start'}; padding: ${!prompt?.trim() ? '8px 12px' : '12px'}; box-sizing: border-box; gap: 8px; ${!prompt?.trim() ? 'height: auto; min-height: 48px;' : ''} transition: all 0.2s ease;">
                                    <div class="c_d_ai_prompt_input_area ${!prompt?.trim() ? 'c_d_ai_prompt_input_area_v2' : ''}" style="width: 100%; flex: 1; ${!prompt?.trim() ? 'margin-right: 8px;' : ''}">
                                        <textarea id="prompt-input-ref" rows="1" placeholder="Ask Legistify AI" class="c_d_ai_prompt_input form-control" aria-invalid="false" oninput="handlePromptInput(event)" onfocus="handlePromptFocus(event)" onblur="handlePromptBlur(event)" style="resize: none; height: auto; width: 100%; background: transparent; padding: 0; border: none; outline: none; font-size: 16px; font-family: inherit; line-height: 24px; box-sizing: border-box; direction: ltr; text-align: left; display: block !important; visibility: visible !important; color: #202124; overflow-y: auto; min-height: 24px; max-height: 200px; font-weight: 400; margin: 0;">${escapeHtml(prompt || '')}</textarea>
                                    </div>
                                    <div class="c_d_ai_prompt_icons_container ${!prompt?.trim() ? 'c_d_ai_prompt_icons_container_v2' : ''}" style="display: flex; justify-content: space-between; align-items: center; ${!prompt?.trim() ? 'position: static; width: auto; padding-top: 0; flex-shrink: 0;' : 'width: 100%; padding-top: 4px;'}">
                                        <button id="prompt-send-btn" class="c_d_ai_prompt_icon_btn c_d_ai_prompt_send_btn ${prompt?.trim() ? 'c_d_ai_prompt_send_btn_active' : ''}" type="button" onclick="handleGenerate()" ${error || !prompt?.trim() || loader ? 'disabled=""' : ''} style="cursor: ${error || !prompt?.trim() || loader ? 'not-allowed' : 'pointer'}; margin: 0; display: flex !important; align-items: center; justify-content: center; border: none; width: 40px; height: 40px; box-sizing: border-box; visibility: visible !important; background-color: ${prompt?.trim() && !error && !loader ? '#2567ff' : '#f1f3f4'} !important; padding: 0; border-radius: 50%; transition: background-color 0.2s;">
                                        ${loader ? '<div class="loading-spinner-small"></div>' : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="' + (prompt?.trim() && !error && !loader ? '#ffffff' : '#9aa0a6') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        ${prompt?.length >= 2000 ? `
                            <p style="font-size: 12px; color: ${error ? 'red' : 'black'}; margin: 0; color: #6c757d; text-align: end; padding-right: 1.5rem; padding-left: 11px; padding-bottom: 8px;">
                                Maximum Limit Reached (2000 words only)
                            </p>
                        ` : ''}
                        <div id="bottom-ref"></div>
                    </div>
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
        
        // Ensure scrollbar works - let flexbox handle height naturally
        const ensureScrollable = () => {
            if (messageDivRef) {
                // Ensure flex and overflow are set correctly - NO max-height!
                messageDivRef.style.flex = '1';
                messageDivRef.style.minHeight = '0';
                messageDivRef.style.overflowY = 'auto';
                messageDivRef.style.overflowX = 'hidden';
                
                // Force a reflow to trigger scrollbar
                void messageDivRef.offsetHeight;
            }
        };
        
        // Ensure scrollable after render
        setTimeout(ensureScrollable, 50);
        setTimeout(ensureScrollable, 200);

        // Set textarea value properly (value attribute doesn't work for textarea)
        if (promptInputRef) {
            promptInputRef.value = prompt || '';
            // Auto-resize textarea
            promptInputRef.style.height = 'auto';
            const maxHeight = 200;
            let newHeight = promptInputRef.scrollHeight;
            newHeight = Math.max(24, newHeight);
            newHeight = Math.min(maxHeight, newHeight);
            promptInputRef.style.height = newHeight + 'px';
            promptInputRef.style.minHeight = '24px';
            promptInputRef.style.maxHeight = maxHeight + 'px';
            
            // Set initial wrapper state based on content
            const wrapper = document.getElementById('prompt-input-wrapper');
            if (wrapper && (!prompt || !prompt.trim())) {
                // Empty - should be in compact mode
                wrapper.classList.add('c_d_ai_prompt_input_wrapper_v2');
            }
            
            // Auto-focus input
            promptInputRef.focus();
        }
        
        // Add auto-resize listener for textarea
        if (promptInputRef && !promptInputRef.hasAttribute('data-resize-listener')) {
            promptInputRef.setAttribute('data-resize-listener', 'true');
            promptInputRef.addEventListener('input', function() {
                this.style.height = 'auto';
                const maxHeight = 200;
                let newHeight = this.scrollHeight;
                newHeight = Math.max(24, newHeight);
                newHeight = Math.min(maxHeight, newHeight);
                this.style.height = newHeight + 'px';
                this.style.minHeight = '24px';
                this.style.maxHeight = maxHeight + 'px';
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
                            </div>
                            <p style="margin-top: 3px;" class="p2">${formatTime(item?.createdAt)}</p>
                            <div class="div2">
                                <div style="margin-left: 7px;" class="response-container">
                                    <p class="p3">${formatResponse(item.response || '')}</p>
                                    <div class="chat_response_footer">
                                        <div onclick="copyToClipboard('${escapeHtml(item.response || '')}')" style="cursor: pointer; display: flex; align-items: center;">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="cursor: pointer;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                        </div>
                                        <span class="chat_response_date fs-11 text-secondary">${formatTime(item?.createdAt)}</span>
                                    </div>
                                </div>
                            </div>
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
                            <div key="${i}" id="question-${i}" onclick="setPromptFromQuestion('${escapeHtml(qs)}')" class="doc-questions" style="display: flex; align-items: flex-start; cursor: pointer; margin-bottom: 8px;" onmouseover="this.style.color='#446995'; this.style.textDecoration='dotted';" onmouseout="this.style.color=''; this.style.textDecoration='none';">
                                <p class="p8" style="margin: 0; margin-right: 8px; font-size: 12px; flex-shrink: 0;">${i + 1}</p>
                                <p style="margin: 0; font-size: 12px; flex: 1;">- ${escapeHtml(qs)}</p>
                            </div>
                        `).join('') : ''}
                        <div onclick="copyToClipboard('${escapeHtml(item.response)}')" class="copy-clause" style="padding: 2px 5px; border-radius: 0 0 8px 0; position: absolute; bottom: 0; right: 0; cursor: pointer; background-color: rgba(255, 255, 255, 0.8);">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </div>
                    </div>
                    <p class="p9" style="font-size: 11px; color: #6c757d; text-align: end; margin-top: 8px; margin-bottom: 0; padding-top: 4px;">
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

    // Format response - matches MS Editor formatResponse exactly with proper spacing
    function formatResponse(text) {
        if (!text) return '';
        const lines = text.split('\n');
        let html = '';
        let listItems = [];
        let listKey = 0;
        let previousWasEmpty = false;
        let previousWasParagraph = false;

        const pushList = () => {
            if (listItems.length) {
                html += '<ul style="margin-left: -17px !important; margin-top: 8px; margin-bottom: 8px;">';
                listItems.forEach((item, idx) => {
                    html += `<li style="font-size: 12px; margin: 4px 0; line-height: 1.6;">${escapeHtml(item.replace(/\*/g, '').trim())}</li>`;
                });
                html += '</ul>';
                listItems = [];
            }
        };

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            const isEmpty = !trimmedLine;
            
            if (isEmpty) {
                pushList();
                // Add spacing after previous element if it was a paragraph or heading
                if (previousWasParagraph) {
                    html += '<div style="height: 8px;"></div>';
                }
                previousWasEmpty = true;
                previousWasParagraph = false;
                return;
            }

            previousWasEmpty = false;

            if (trimmedLine.startsWith('# ')) {
                pushList();
                html += `<h1 style="font-size: 14px; margin-top: 12px; margin-bottom: 8px; font-weight: 600;">${escapeHtml(trimmedLine.replace(/^#\s*/, ''))}</h1>`;
                previousWasParagraph = false;
            } else if (trimmedLine.startsWith('## ')) {
                pushList();
                html += `<h2 style="font-size: 13px; margin-top: 12px; margin-bottom: 8px; font-weight: 600;">${escapeHtml(trimmedLine.replace(/^##\s*/, ''))}</h2>`;
                previousWasParagraph = false;
            } else if (trimmedLine.startsWith('### ')) {
                pushList();
                html += `<h3 style="font-size: 12px; margin-top: 12px; margin-bottom: 8px; font-weight: 600;">${escapeHtml(trimmedLine.replace(/^###\s*/, ''))}</h3>`;
                previousWasParagraph = false;
            } else if (trimmedLine.startsWith('#### ')) {
                pushList();
                html += `<h4 style="font-size: 12px; margin-top: 12px; margin-bottom: 8px; font-weight: 600;">${escapeHtml(trimmedLine.replace(/^####\s*/, ''))}</h4>`;
                previousWasParagraph = false;
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
                previousWasParagraph = false;
            } else {
                pushList();
                // Add spacing before paragraph if previous was not empty and not a paragraph
                const marginTop = (previousWasParagraph || index === 0) ? '0' : '8px';
                html += `<p style="font-size: 12px; margin-top: ${marginTop}; margin-bottom: 0; line-height: 1.6;">${escapeHtml(trimmedLine)}</p>`;
                previousWasParagraph = true;
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

    // Handle prompt focus - expand wrapper and textarea
    window.handlePromptFocus = function(event) {
        if (event.target) {
            const wrapper = document.getElementById('prompt-input-wrapper');
            const inputArea = wrapper?.querySelector('.c_d_ai_prompt_input_area');
            const iconsContainer = wrapper?.querySelector('.c_d_ai_prompt_icons_container');
            
            // Remove _v2 class to expand the wrapper
            if (wrapper) {
                wrapper.classList.remove('c_d_ai_prompt_input_wrapper_v2');
                wrapper.style.flexDirection = 'column';
                wrapper.style.alignItems = 'flex-start';
                wrapper.style.padding = '12px';
                wrapper.style.height = 'auto';
                wrapper.style.minHeight = 'auto';
            }
            
            // Update input area
            if (inputArea) {
                inputArea.classList.remove('c_d_ai_prompt_input_area_v2');
                inputArea.style.marginRight = '0';
            }
            
            // Update icons container
            if (iconsContainer) {
                iconsContainer.classList.remove('c_d_ai_prompt_icons_container_v2');
                iconsContainer.style.position = 'static';
                iconsContainer.style.width = '100%';
                iconsContainer.style.paddingTop = '4px';
                iconsContainer.style.flexShrink = 'auto';
            }
            
            // Auto-resize textarea
            event.target.style.height = 'auto';
            const maxHeight = 200;
            let newHeight = event.target.scrollHeight;
            newHeight = Math.min(maxHeight, newHeight);
            event.target.style.height = newHeight + 'px';
            event.target.style.minHeight = '24px';
            event.target.style.maxHeight = maxHeight + 'px';
            
            // Enable scrolling if content exceeds max height
            if (event.target.scrollHeight > maxHeight) {
                event.target.style.overflowY = 'auto';
            } else {
                event.target.style.overflowY = 'hidden';
            }
        }
    };

    // Handle prompt blur - shrink wrapper if empty, keep expanded if has content
    window.handlePromptBlur = function(event) {
        if (event.target) {
            const value = event.target.value;
            const wrapper = document.getElementById('prompt-input-wrapper');
            const inputArea = wrapper?.querySelector('.c_d_ai_prompt_input_area');
            const iconsContainer = wrapper?.querySelector('.c_d_ai_prompt_icons_container');
            
            if (!value || !value.trim()) {
                // If empty, add _v2 class to shrink the wrapper
                if (wrapper) {
                    wrapper.classList.add('c_d_ai_prompt_input_wrapper_v2');
                    wrapper.style.flexDirection = 'row';
                    wrapper.style.alignItems = 'center';
                    wrapper.style.padding = '8px 12px';
                    wrapper.style.height = 'auto';
                    wrapper.style.minHeight = '48px';
                }
                
                // Update input area
                if (inputArea) {
                    inputArea.classList.add('c_d_ai_prompt_input_area_v2');
                    inputArea.style.marginRight = '8px';
                }
                
                // Update icons container
                if (iconsContainer) {
                    iconsContainer.classList.add('c_d_ai_prompt_icons_container_v2');
                    iconsContainer.style.position = 'static';
                    iconsContainer.style.width = 'auto';
                    iconsContainer.style.paddingTop = '0';
                    iconsContainer.style.flexShrink = '0';
                }
                
                // Reset textarea height
                event.target.style.height = 'auto';
                event.target.style.minHeight = '24px';
                event.target.style.maxHeight = '200px';
            } else {
                // If has content, keep expanded (no _v2 class)
                // Just adjust textarea height
                event.target.style.height = 'auto';
                const maxHeight = 200;
                let newHeight = event.target.scrollHeight;
                newHeight = Math.min(maxHeight, newHeight);
                event.target.style.height = newHeight + 'px';
                event.target.style.minHeight = '24px';
                event.target.style.maxHeight = maxHeight + 'px';
                
                // Enable scrolling if content exceeds max height
                if (event.target.scrollHeight > maxHeight) {
                    event.target.style.overflowY = 'auto';
                } else {
                    event.target.style.overflowY = 'hidden';
                }
            }
        }
    };

    // Handle prompt input
    window.handlePromptInput = function(event) {
        prompt = event.target.value;
        error = prompt.length >= 2000;
        
        const wrapper = document.getElementById('prompt-input-wrapper');
        const inputArea = wrapper?.querySelector('.c_d_ai_prompt_input_area');
        const iconsContainer = wrapper?.querySelector('.c_d_ai_prompt_icons_container');
        
        // If user starts typing, expand the wrapper (remove _v2 class)
        if (prompt?.trim() && wrapper) {
            wrapper.classList.remove('c_d_ai_prompt_input_wrapper_v2');
            wrapper.style.flexDirection = 'column';
            wrapper.style.alignItems = 'flex-start';
            wrapper.style.padding = '12px';
            wrapper.style.height = 'auto';
            wrapper.style.minHeight = 'auto';
            
            if (inputArea) {
                inputArea.classList.remove('c_d_ai_prompt_input_area_v2');
                inputArea.style.marginRight = '0';
            }
            
            if (iconsContainer) {
                iconsContainer.classList.remove('c_d_ai_prompt_icons_container_v2');
                iconsContainer.style.position = 'static';
                iconsContainer.style.width = '100%';
                iconsContainer.style.paddingTop = '4px';
                iconsContainer.style.flexShrink = 'auto';
            }
        }
        
        // Auto-resize textarea - grows line by line, max 200px
        if (event.target) {
            const maxHeight = 200;
            
            // Reset height to auto to get accurate scrollHeight
            event.target.style.height = 'auto';
            
            // Calculate new height based on content
            let newHeight = event.target.scrollHeight;
            
            // Ensure minimum height
            newHeight = Math.max(24, newHeight);
            
            // Cap at maximum height
            newHeight = Math.min(maxHeight, newHeight);
            
            // Apply the calculated height
            event.target.style.height = newHeight + 'px';
            event.target.style.minHeight = '24px';
            event.target.style.maxHeight = maxHeight + 'px';
            
            // Enable/disable scrolling based on whether content exceeds max height
            if (event.target.scrollHeight > maxHeight) {
                event.target.style.overflowY = 'auto';
            } else {
                event.target.style.overflowY = 'hidden';
            }
        }
        
        // Update send button state without re-rendering entire view
        const sendButton = document.getElementById('prompt-send-btn');
        if (sendButton) {
            if (prompt?.trim() && !error && !loader) {
                sendButton.classList.add('c_d_ai_prompt_send_btn_active');
                sendButton.style.backgroundColor = '#2567ff !important';
                const svg = sendButton.querySelector('svg');
                if (svg) {
                    svg.setAttribute('stroke', '#ffffff');
                }
            } else {
                sendButton.classList.remove('c_d_ai_prompt_send_btn_active');
                sendButton.style.backgroundColor = '#f1f3f4 !important';
                const svg = sendButton.querySelector('svg');
                if (svg) {
                    svg.setAttribute('stroke', '#9aa0a6');
                }
            }
            sendButton.style.cursor = (error || !prompt?.trim() || loader) ? 'not-allowed' : 'pointer';
            sendButton.disabled = (error || !prompt?.trim() || loader);
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
            
            // Expand wrapper since we have content
            const wrapper = document.getElementById('prompt-input-wrapper');
            const inputArea = wrapper?.querySelector('.c_d_ai_prompt_input_area');
            const iconsContainer = wrapper?.querySelector('.c_d_ai_prompt_icons_container');
            
            if (wrapper && prompt?.trim()) {
                wrapper.classList.remove('c_d_ai_prompt_input_wrapper_v2');
                wrapper.style.flexDirection = 'column';
                wrapper.style.alignItems = 'flex-start';
                wrapper.style.padding = '12px';
                wrapper.style.height = 'auto';
                wrapper.style.minHeight = 'auto';
                
                if (inputArea) {
                    inputArea.classList.remove('c_d_ai_prompt_input_area_v2');
                    inputArea.style.marginRight = '0';
                }
                
                if (iconsContainer) {
                    iconsContainer.classList.remove('c_d_ai_prompt_icons_container_v2');
                    iconsContainer.style.position = 'static';
                    iconsContainer.style.width = '100%';
                    iconsContainer.style.paddingTop = '4px';
                    iconsContainer.style.flexShrink = 'auto';
                }
            }
            
            // Auto-resize textarea
            promptInput.style.height = 'auto';
            const maxHeight = 200;
            let newHeight = promptInput.scrollHeight;
            newHeight = Math.max(24, newHeight);
            newHeight = Math.min(maxHeight, newHeight);
            promptInput.style.height = newHeight + 'px';
            promptInput.style.minHeight = '24px';
            promptInput.style.maxHeight = maxHeight + 'px';
            
            promptInput.focus();
            
            // Update send button state
            const sendButton = document.getElementById('prompt-send-btn');
            if (sendButton) {
                if (prompt?.trim() && !error && !loader) {
                    sendButton.classList.add('c_d_ai_prompt_send_btn_active');
                    sendButton.style.backgroundColor = '#2567ff !important';
                    const svg = sendButton.querySelector('svg');
                    if (svg) {
                        svg.setAttribute('stroke', '#ffffff');
                    }
                } else {
                    sendButton.classList.remove('c_d_ai_prompt_send_btn_active');
                    sendButton.style.backgroundColor = '#f1f3f4 !important';
                    const svg = sendButton.querySelector('svg');
                    if (svg) {
                        svg.setAttribute('stroke', '#9aa0a6');
                    }
                }
                sendButton.style.cursor = (error || !prompt?.trim() || loader) ? 'not-allowed' : 'pointer';
                sendButton.disabled = (error || !prompt?.trim() || loader);
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

    // Utility function to strip HTML tags and convert to plain text
    // Matches contract-frontend/src/utility/Utils.js htmlToString function
    window.htmlToString = function(html) {
        if (!html) return '';
        
        // First, try using DOM to extract text (handles HTML entities automatically)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        let text = tempDiv.textContent || tempDiv.innerText || '';
        
        // If DOM method didn't work, fall back to regex (matches contract-frontend)
        if (!text || text.trim() === '') {
            text = html.replace(/<\/?[^>]+(>|$)/g, '');
        }
        
        // Clean up HTML entities (in case regex was used)
        text = text.replace(/&nbsp;/g, ' ');
        text = text.replace(/&amp;/g, '&');
        text = text.replace(/&lt;/g, '<');
        text = text.replace(/&gt;/g, '>');
        text = text.replace(/&quot;/g, '"');
        text = text.replace(/&#39;/g, "'");
        text = text.replace(/&apos;/g, "'");
        
        // Clean up excessive whitespace but preserve line breaks
        text = text.replace(/[ \t]+/g, ' '); // Multiple spaces/tabs to single space
        text = text.replace(/\n{3,}/g, '\n\n'); // More than 2 newlines to 2
        text = text.trim();
        
        return text;
    };

    // Copy to clipboard - strips HTML tags and copies only plain text
    window.copyToClipboard = function(text) {
        if (!text) {
            showToast('Nothing to copy', 'error');
            return;
        }
        
        // Strip HTML tags and get plain text
        const plainText = window.htmlToString(text);
        
        navigator.clipboard.writeText(plainText).then(() => {
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
        const parts = userName.trim().split(' ').filter(part => part.length > 0);
        if (parts.length >= 2) {
            // First letter of first name + first letter of last name
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return userName.trim()[0].toUpperCase();
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
        const ampm = (hours >= 12 ? 'PM' : 'AM').toUpperCase();
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
