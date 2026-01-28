// Main Plugin Entry Point - Matches MS Editor App.jsx
(function(window, undefined) {
    'use strict';

    // Store plugin data (contractId, accessToken, etc.) - will be populated from backend
    // These are empty defaults - actual values come from backend via initData
    window.pluginData = {
        contractId: null,
        accessToken: null,
        userId: null,
        organizationId: null,
        backendUrl: null,
        permissions: {}
    };

    // State management - matches MS Editor App.jsx
    let selectedTab = 'Playbook';
    let previousTab = 'Playbook'; // Track previous tab before opening Copilot
    let activeContent = null;
    let loadingState = {
        summary: false,
        clause: false,
        obligation: false,
        library: false,
        clauseApproval: false
    };
    let activeContentData = {
        summaryData: null,
        clauseData: null,
        obligationData: null,
        libraryData: null,
        summaryTimeStamp: null,
        clauseTimeStamp: null,
        obligationTimeStamp: null,
        clauseApprovalsData: null
    };
    
    // Plugin initialization - called when OnlyOffice loads the plugin
    window.Asc.plugin.init = function() {
        console.log('AI Contract Assistant Plugin initialized');
        
        // Get plugin initialization data (passed from backend)
        const initData = window.Asc.plugin.info.initData;
        console.log('initData', initData);
        if (initData) {
            try {
                const data = typeof initData === 'string' ? JSON.parse(initData) : initData;
                // Set plugin data from backend (no fallbacks - backend must provide all data)
                window.pluginData = {
                    contractId: data.contractId || null,
                    accessToken: data.accessToken || null,
                    userId: data.userId || null,
                    organizationId: data.organizationId || null,
                    backendUrl: data.backendUrl || null,
                    permissions: data.permissions || {}
                };
                
                // Validate required fields
                const required = ['contractId', 'accessToken', 'userId', 'organizationId', 'backendUrl'];
                const missing = required.filter(key => !window.pluginData[key]);
                
                if (missing.length > 0) {
                    console.error('Missing required plugin data:', missing);
                    showPluginError(`Plugin configuration incomplete. Missing: ${missing.join(', ')}. Please refresh the page.`);
                } else {
                    console.log('Plugin data initialized successfully');
                }
                
                // Apply permissions to hide/show features
                applyPermissions(window.pluginData.permissions || {});
            } catch (e) {
                console.error('Error parsing plugin init data:', e);
                showPluginError('Failed to initialize plugin. Please refresh the page.');
            }
        } else {
            // No initData provided - this is an error
            console.error('No plugin initialization data provided from backend');
            showPluginError('Plugin configuration missing. Please contact support or refresh the page.');
        }
        
        // Log plugin data for debugging (without sensitive data)
        console.log('Plugin data initialized:', {
            contractId: window.pluginData.contractId ? 'Set' : 'Missing',
            accessToken: window.pluginData.accessToken ? 'Set' : 'Missing',
            userId: window.pluginData.userId ? 'Set' : 'Missing',
            organizationId: window.pluginData.organizationId ? 'Set' : 'Missing',
            backendUrl: window.pluginData.backendUrl || 'Missing'
        });
        
        // Initialize tab navigation
        initTabNavigation();
        
        // Initialize OnlyOffice API connection
        initOnlyOfficeAPI();
        
        // Initialize resize handle
        initResizeHandle();
        
        // Set up close button event listeners
        setupCloseButtonListeners();
        
        // Open plugin panel on left side
        openPluginPanel();
        
        // Initialize default view
        handleTabChange('Playbook');
    };
    
    // Initialize tab navigation - matches MS Editor App.jsx
    function initTabNavigation() {
        // Set default tab to Playbook
        selectedTab = 'Playbook';
        updateTabUI();
    }

    // Handle tab change - matches MS Editor App.jsx onTabChange
    window.handleTabChange = function(tabName) {
        // Store previous tab before switching (only if not already Assistant)
        if (selectedTab !== 'Assistant' && tabName === 'Assistant') {
            previousTab = selectedTab;
        }
        
        selectedTab = tabName;
        updateTabUI();
        
        // Hide review hub immediately when switching tabs
        const reviewHubView = document.getElementById('review-hub-view');
        if (reviewHubView) reviewHubView.style.display = 'none';
        
        if (tabName === 'Assistant') {
            // Immediately open Copilot drawer
            setActiveContent('genai');
        } else if (tabName === 'Playbook') {
            setActiveContent('playbook');
        } else {
            setActiveContent(null);
        }
    };

    // Update tab UI
    function updateTabUI() {
        const tabs = document.querySelectorAll('.tab-button');
        tabs.forEach(tab => {
            if (tab.getAttribute('data-tab') === selectedTab) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }

    // Set active content - matches MS Editor App.jsx
    function setActiveContent(contentKey) {
        activeContent = contentKey;
        updateContentView();
    }

    // Update content view based on activeContent
    function updateContentView() {
        // Hide all views
        const reviewHubView = document.getElementById('review-hub-view');
        const playbookView = document.getElementById('playbook-view');
        const assistantView = document.getElementById('assistant-view');
        const drawer = document.getElementById('drawer');
        const drawerOverlay = document.getElementById('drawer-overlay');

        if (reviewHubView) reviewHubView.style.display = 'none';
        if (playbookView) playbookView.style.display = 'none';
        if (assistantView) assistantView.style.display = 'none';
        if (drawer) drawer.style.display = 'none';
        if (drawerOverlay) drawerOverlay.style.display = 'none';

        if (activeContent === 'playbook') {
            // Show playbook view
            if (playbookView) {
                playbookView.style.display = 'block';
                // Re-render playbook list if not showing create page/form
                if (window.renderPlaybookList && !window.showCreatePage && !window.showCreateForm) {
                    window.renderPlaybookList();
                }
            }
            // Initialize playbook if not already done
            if (window.initPlaybookView) {
                window.initPlaybookView();
            }
        } else if (activeContent === 'genai' || activeContent === 'askai') {
            // Show assistant/copilot view in drawer - hide review hub first
            if (reviewHubView) reviewHubView.style.display = 'none';
            openDrawer('genai');
        } else if (activeContent === 'summary' || activeContent === 'clause' || activeContent === 'obligation' || 
                   activeContent === 'library' || activeContent === 'clauseApproval') {
            // Show drawer with content
            if (reviewHubView) reviewHubView.style.display = 'none';
            openDrawer(activeContent);
        } else {
            // Show review hub (card buttons) only if not in Copilot tab
            if (selectedTab !== 'Assistant' && reviewHubView) {
                reviewHubView.style.display = 'block';
            }
        }
    }

    // Open drawer - matches MS Editor CustomDrawer
    function openDrawer(contentKey) {
        const drawer = document.getElementById('drawer');
        const drawerOverlay = document.getElementById('drawer-overlay');
        const drawerContent = document.getElementById('drawer-content');
        const drawerTitle = document.getElementById('drawer-title');
        const drawerHeaderActions = document.getElementById('drawer-header-actions');
        const drawerRegenerateBtn = document.getElementById('drawer-regenerate-btn');
        const drawerCopyBtn = document.getElementById('drawer-copy-btn');
        
        if (!drawer || !drawerContent) return;

        // Hide all drawer views
        const drawerViews = document.querySelectorAll('.drawer-view');
        drawerViews.forEach(view => view.style.display = 'none');

        // Show appropriate view
        const viewMap = {
            'summary': 'summary-view',
            'clause': 'clauses-view',
            'obligation': 'obligations-view',
            'library': 'library-view',
            'clauseApproval': 'clauseApproval-view',
            'genai': 'ask-ai-view',
            'askai': 'ask-ai-view'
        };

        const titleMap = {
            'summary': 'Summary',
            'clause': 'Clauses',
            'obligation': 'Obligations',
            'library': 'Clause Library',
            'clauseApproval': 'Clause Approval',
            'genai': 'AI Copilot',
            'askai': 'AI Copilot'
        };

        const viewId = viewMap[contentKey];
        const view = document.getElementById(viewId);
        
        if (view) {
            view.style.display = 'block';
            if (drawerContent) {
                drawerContent.innerHTML = '';
                // Clone the view and append to drawer
                const clonedView = view.cloneNode(true);
                drawerContent.appendChild(clonedView);
                
                // Remove action boxes from cloned content (they'll be in header)
                const actionBoxes = clonedView.querySelectorAll('.response-action-box');
                actionBoxes.forEach(box => box.remove());
                
                // Remove feature-header from Ask AI view (header is in drawer)
                if (contentKey === 'genai' || contentKey === 'askai') {
                    const featureHeaders = clonedView.querySelectorAll('.feature-header');
                    featureHeaders.forEach(header => header.remove());
                }
                
                // Update IDs in cloned view to work with drawer
                const updateIds = (element, suffix) => {
                    if (element.id) {
                        element.id = element.id + suffix;
                    }
                    Array.from(element.children).forEach(child => updateIds(child, suffix));
                };
                updateIds(clonedView, '-drawer');
            }
            if (drawerTitle) {
                drawerTitle.textContent = titleMap[contentKey] || contentKey;
            }
            
            // Setup header action buttons for Summary, Clauses, Obligations
            if (drawerHeaderActions && (contentKey === 'summary' || contentKey === 'clause' || contentKey === 'obligation')) {
                drawerHeaderActions.style.display = 'flex';
                
                if (drawerRegenerateBtn) {
                    drawerRegenerateBtn.style.display = 'flex';
                    drawerRegenerateBtn.onclick = () => {
                        if (contentKey === 'summary' && window.regenerateSummary) {
                            window.regenerateSummary();
                        } else if (contentKey === 'clause' && window.regenerateClauses) {
                            window.regenerateClauses();
                        } else if (contentKey === 'obligation' && window.regenerateObligations) {
                            window.regenerateObligations();
                        }
                    };
                }
                
                if (drawerCopyBtn) {
                    drawerCopyBtn.style.display = 'flex';
                    drawerCopyBtn.onclick = () => {
                        if (contentKey === 'summary' && window.copySummary) {
                            window.copySummary();
                        } else if (contentKey === 'clause' && window.copyClauses) {
                            window.copyClauses();
                        } else if (contentKey === 'obligation' && window.copyObligations) {
                            window.copyObligations();
                        }
                    };
                }
            } else if (drawerHeaderActions) {
                // Hide header actions for other views (Library, Approval, Copilot)
                drawerHeaderActions.style.display = 'none';
            }
        }

        // Show drawer and overlay
        if (drawer) drawer.style.display = 'block';
        if (drawerOverlay) drawerOverlay.style.display = 'block';

        // Initialize the view after drawer is shown (for progress loader)
        // Use a small delay to ensure DOM is ready
        setTimeout(() => {
            if (contentKey === 'summary' && window.initSummaryView) {
                window.initSummaryView();
            } else if (contentKey === 'clause' && window.initClausesView) {
                window.initClausesView();
            } else if (contentKey === 'obligation' && window.initObligationsView) {
                window.initObligationsView();
            } else if (contentKey === 'library' && window.initLibraryView) {
                window.initLibraryView();
            } else if (contentKey === 'clauseApproval' && window.initApprovalView) {
                window.initApprovalView();
            } else if ((contentKey === 'genai' || contentKey === 'askai') && window.initAskAIView) {
                window.initAskAIView();
            }
        }, 150);
    }

    // Close drawer
    window.closeDrawer = function() {
        const drawer = document.getElementById('drawer');
        const drawerOverlay = document.getElementById('drawer-overlay');
        const drawerContent = document.getElementById('drawer-content');
        const drawerHeaderActions = document.getElementById('drawer-header-actions');
        
        // Check if we're closing Copilot drawer
        const wasCopilot = activeContent === 'genai' || activeContent === 'askai';
        
        if (drawer) drawer.style.display = 'none';
        if (drawerOverlay) drawerOverlay.style.display = 'none';
        if (drawerContent) drawerContent.innerHTML = '';
        if (drawerHeaderActions) {
            drawerHeaderActions.style.display = 'none';
            const regenerateBtn = document.getElementById('drawer-regenerate-btn');
            const copyBtn = document.getElementById('drawer-copy-btn');
            if (regenerateBtn) regenerateBtn.style.display = 'none';
            if (copyBtn) copyBtn.style.display = 'none';
        }
        
        // Hide all drawer-view elements (library-view, summary-view, clauses-view, etc.)
        const drawerViews = document.querySelectorAll('.drawer-view');
        drawerViews.forEach(view => {
            view.style.display = 'none';
            // Clear content from library-view and clauseApproval-view to prevent showing stale data
            if (view.id === 'library-view' || view.id === 'clauseApproval-view') {
                const container = view.querySelector('.library-container, .clauseApproval-container');
                if (container) {
                    container.innerHTML = '';
                }
                // Also clear any error messages
                const errorElements = view.querySelectorAll('.error-message, [class*="error"]');
                errorElements.forEach(el => el.remove());
            }
        });
        
        setActiveContent(null);
        
        // If closing Copilot, restore previous tab
        if (wasCopilot && previousTab) {
            handleTabChange(previousTab);
        }
    };

    // Handle button click - matches MS Editor App.jsx handleButtonClick
    window.handleButtonClick = async function(contentKey) {
        // Set loading state
        setLoadingState(contentKey, true);
        
        // Set active content to show drawer first (so progress loader can be shown immediately)
        setActiveContent(contentKey);
        
        // For Summary, Clauses, Obligations - initialize view immediately to show loader
        // The view will auto-check for existing data and auto-generate if not found
        if (contentKey === 'summary') {
            // Initialize summary view immediately - will show loader and auto-generate
            if (window.initSummaryView) {
                window.initSummaryView();
            }
        } else if (contentKey === 'clause') {
            // Initialize clauses view immediately - will show loader and auto-generate
            if (window.initClausesView) {
                window.initClausesView();
            }
        } else if (contentKey === 'obligation') {
            // Initialize obligations view immediately - will show loader and auto-generate
            if (window.initObligationsView) {
                window.initObligationsView();
            }
        } else if (contentKey === 'library') {
            await getClauseLibrary();
            if (window.initLibraryView) {
                window.initLibraryView();
            }
        } else if (contentKey === 'clauseApproval') {
            await getClauseApprovals();
            if (window.initApprovalView) {
                window.initApprovalView();
            }
        }
        
        setLoadingState(contentKey, false);
    };

    // Set loading state
    function setLoadingState(contentKey, isLoading) {
        loadingState[contentKey] = isLoading;
        const spinner = document.getElementById(contentKey + '-spinner');
        if (spinner) {
            spinner.style.display = isLoading ? 'inline-block' : 'none';
        }
    }

    // Fetch summary or clause generated or not - matches MS Editor
    async function fetchSummaryOrClauseGeneratedOrNot(contentKey) {
        const pluginData = window.getPluginData();
        const backendUrl = window.getBackendUrl();
        const accessToken = window.getAccessToken();
        
        if (!pluginData.contractId || !accessToken) return;

        try {
            const url = `${backendUrl}/ai-assistant/fetch-Summary-Clause?contractId=${pluginData.contractId}`;
            const response = await fetch(url, {
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (contentKey === 'summary' && data && data.summary) {
                    activeContentData.summaryData = data.summary;
                    activeContentData.summaryTimeStamp = data.summaryUpdatedAt;
                } else if (contentKey === 'clause' && data && data.clause) {
                    activeContentData.clauseData = data.clause;
                    activeContentData.clauseTimeStamp = data.clauseUpdatedAt;
                }
            }
        } catch (error) {
            console.error('Error fetching summary/clause:', error);
        }
    }

    // Fetch obligation generated or not - matches MS Editor
    async function fetchObligationGeneratedOrNot() {
        const pluginData = window.getPluginData();
        const backendUrl = window.getBackendUrl();
        const accessToken = window.getAccessToken();
        
        if (!pluginData.contractId || !accessToken) return;

        try {
            const url = `${backendUrl}/ai-assistant/fetch-obligation?contractId=${pluginData.contractId}`;
            const response = await fetch(url, {
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data && data.status && data.data && data.data.obligation) {
                    activeContentData.obligationData = data.data.obligation;
                    activeContentData.obligationTimeStamp = data.data.obligationUpdatedAt;
                }
            }
        } catch (error) {
            console.error('Error fetching obligation:', error);
        }
    }

    // Get clause library - matches MS Editor
    async function getClauseLibrary() {
        const pluginData = window.getPluginData();
        const backendUrl = window.getBackendUrl();
        const accessToken = window.getAccessToken();
        
        if (!accessToken) return;

        try {
            const url = `${backendUrl}/clause-library/clause-list?`;
            const response = await fetch(url, {
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data && data.status && data.data && data.data.clauses) {
                    activeContentData.libraryData = data.data.clauses;
                }
            }
        } catch (error) {
            console.error('Error fetching clause library:', error);
        }
    }

    // Get clause approvals - matches MS Editor
    async function getClauseApprovals() {
        const pluginData = window.getPluginData();
        const backendUrl = window.getBackendUrl();
        const accessToken = window.getAccessToken();
        
        if (!pluginData.contractId || !accessToken) return;

        try {
            const url = `${backendUrl}/clause-approval/clause-approvals-list/${pluginData.contractId}`;
            const response = await fetch(url, {
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data && data.status && data.data && Array.isArray(data.data) && data.data.length > 0) {
                    activeContentData.clauseApprovalsData = data.data;
                }
            }
        } catch (error) {
            console.error('Error fetching clause approvals:', error);
        }
    }

    // Apply permissions to hide/show features
    function applyPermissions(permissions) {
        const featureMap = {
            'summary': 'summary-btn',
            'clauses': 'clause-btn',
            'obligations': 'obligation-btn',
            'playbook': null, // Playbook is in its own tab
            'chat': null, // Chat is in Assistant tab
            'approval': 'clauseApproval-btn',
            'library': 'library-btn'
        };
        
        Object.keys(featureMap).forEach(feature => {
            const isAllowed = permissions[feature] !== false;
            const buttonId = featureMap[feature];
            
            if (!isAllowed && buttonId) {
                const button = document.getElementById(buttonId);
                if (button) {
                    button.style.display = 'none';
                }
            }
        });
    }

    // Handle button clicks from OnlyOffice toolbar
    window.Asc.plugin.button = function(id) {
        const buttonMap = {
            'askai': 'genai',
            'ask-ai': 'genai',
            'summary': 'summary',
            'clauses': 'clause',
            'obligations': 'obligation',
            'aiplaybook': 'playbook',
            'playbook': 'playbook',
            'library': 'library',
            'approval': 'clauseApproval'
        };

        const normalizedId = id.toLowerCase().replace(/\s+/g, '');
        const contentKey = buttonMap[normalizedId] || buttonMap[id];
        
        if (contentKey) {
            if (contentKey === 'playbook') {
                handleTabChange('Playbook');
            } else if (contentKey === 'genai' || contentKey === 'askai') {
                handleTabChange('Assistant');
                setTimeout(() => handleButtonClick('genai'), 100);
            } else {
                handleTabChange('ReviewHub');
                setTimeout(() => handleButtonClick(contentKey), 100);
            }
        }
    };

    // Set up close button event listeners
    function setupCloseButtonListeners() {
        // Try multiple times to find the OnlyOffice close button (it may load later)
        let attempts = 0;
        const maxAttempts = 10;
        
        const findAndSetupCloseButton = function() {
            attempts++;
            
            // Try multiple selectors for OnlyOffice's close button
            const selectors = [
                '.asc-window-close',
                '.plugin-close',
                '[aria-label*="close" i]',
                '[title*="close" i]',
                '.asc-window-header .asc-window-close',
                '.asc-window-header button[aria-label*="close" i]',
                'button[title*="close" i]',
                '.asc-window-header button:last-child',
                '.asc-window-header .asc-window-button-close'
            ];
            
            let onlyOfficeCloseBtn = null;
            for (const selector of selectors) {
                onlyOfficeCloseBtn = document.querySelector(selector);
                if (onlyOfficeCloseBtn) {
                    console.log('Found OnlyOffice close button with selector:', selector);
                    break;
                }
            }
            
            // Also check parent window/frame for close button
            if (!onlyOfficeCloseBtn) {
                try {
                    const parentDoc = window.parent?.document || window.top?.document;
                    if (parentDoc) {
                        for (const selector of selectors) {
                            onlyOfficeCloseBtn = parentDoc.querySelector(selector);
                            if (onlyOfficeCloseBtn) {
                                console.log('Found OnlyOffice close button in parent with selector:', selector);
                                break;
                            }
                        }
                    }
                } catch (e) {
                    // Cross-origin or other error, ignore
                }
            }
            
            if (onlyOfficeCloseBtn) {
                // Remove any existing listeners to avoid duplicates
                const newBtn = onlyOfficeCloseBtn.cloneNode(true);
                onlyOfficeCloseBtn.parentNode.replaceChild(newBtn, onlyOfficeCloseBtn);
                
                newBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('OnlyOffice close button clicked');
                    closePluginPanel();
                });
                
                console.log('OnlyOffice close button listener attached');
                return true;
            } else if (attempts < maxAttempts) {
                // Retry after a delay
                setTimeout(findAndSetupCloseButton, 500);
            } else {
                console.warn('Could not find OnlyOffice close button after', maxAttempts, 'attempts');
            }
        };
        
        // Start looking for the close button
        setTimeout(findAndSetupCloseButton, 100);
    }
    
    // Open plugin panel on the left side
    function openPluginPanel() {
        try {
            if (window.Asc && window.Asc.plugin && window.Asc.plugin.executeMethod) {
                window.Asc.plugin.executeMethod("ShowPluginPanel", [], function() {
                    console.log('Plugin panel opened');
                }, function(error) {
                    console.warn('ShowPluginPanel not available:', error);
                });
            }
        } catch (error) {
            console.warn('Error opening plugin panel:', error);
        }
    }

    // Initialize OnlyOffice API helpers
    function initOnlyOfficeAPI() {
        window.getDocumentContent = function() {
            return new Promise((resolve, reject) => {
                try {
                    if (window.Asc && window.Asc.plugin && window.Asc.plugin.executeMethod) {
                        window.Asc.plugin.executeMethod("GetDocumentContent", [], function(data) {
                            if (data && data.content) {
                                const text = typeof data.content === 'string' 
                                    ? data.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
                                    : JSON.stringify(data.content);
                                resolve(text);
                            } else {
                                resolve('');
                            }
                        }, function(error) {
                            console.warn('GetDocumentContent not available, using fallback:', error);
                            resolve('');
                        });
                    } else {
                        console.warn('OnlyOffice plugin API not available');
                        resolve('');
                    }
                } catch (error) {
                    console.error('Error getting document content:', error);
                    resolve('');
                }
            });
        };

        window.getSelectedText = function() {
            return new Promise((resolve, reject) => {
                try {
                    if (window.Asc && window.Asc.plugin && window.Asc.plugin.executeMethod) {
                        window.Asc.plugin.executeMethod("GetSelectedText", [], function(data) {
                            if (data && data.text) {
                                resolve(data.text);
                            } else {
                                resolve('');
                            }
                        }, function(error) {
                            console.warn('GetSelectedText not available:', error);
                            resolve('');
                        });
                    } else {
                        resolve('');
                    }
                } catch (error) {
                    console.error('Error getting selected text:', error);
                    resolve('');
                }
            });
        };

        window.getDocumentText = window.getDocumentContent;
    }

    // Plugin execution complete callback
    window.Asc.plugin.executeCommand = function(command, data) {
        console.log('Command received:', command, data);
    };

    // Handle plugin panel close event
    window.Asc.plugin.onClose = function() {
        console.log('Plugin panel close event triggered by OnlyOffice');
    };

    // Function to close/hide the plugin panel programmatically
    window.closePluginPanel = function() {
        console.log('closePluginPanel called');
        
        // First, close any open drawer
        if (window.closeDrawer) {
            window.closeDrawer();
        }
        
        // Try multiple methods to close the plugin panel
        try {
            if (window.Asc && window.Asc.plugin && window.Asc.plugin.executeMethod) {
                // Method 1: HidePluginPanel
                window.Asc.plugin.executeMethod("HidePluginPanel", [], function() {
                    console.log('Plugin panel closed via HidePluginPanel');
                }, function(error) {
                    console.warn('HidePluginPanel not available, trying alternative methods:', error);
                    
                    // Method 2: Try ClosePluginPanel
                    window.Asc.plugin.executeMethod("ClosePluginPanel", [], function() {
                        console.log('Plugin panel closed via ClosePluginPanel');
                    }, function(error2) {
                        console.warn('ClosePluginPanel not available:', error2);
                        
                        // Method 3: Try calling onClose
                        if (window.Asc.plugin.onClose) {
                            try {
                                window.Asc.plugin.onClose();
                                console.log('Plugin panel closed via onClose');
                            } catch (e) {
                                console.error('Error calling onClose:', e);
                            }
                        }
                    });
                });
            } else {
                console.warn('OnlyOffice plugin API not available');
            }
        } catch (error) {
            console.error('Error closing plugin panel:', error);
        }
    };

    // Helper function to get plugin data
    window.getPluginData = function() {
        if (!window.pluginData) {
            console.error('Plugin data not initialized. Make sure backend passes initData.');
            // Return empty object to prevent errors, but log warning
            window.pluginData = {
                contractId: null,
                accessToken: null,
                userId: null,
                organizationId: null,
                backendUrl: null,
                permissions: {}
            };
        }
        return window.pluginData;
    };
    
    // Helper function to show plugin error message
    function showPluginError(message) {
        // Display error message in plugin UI
        const errorDiv = document.createElement('div');
        errorDiv.className = 'plugin-error';
        errorDiv.style.cssText = 'padding: 20px; background: #fee; color: #c33; border: 1px solid #fcc; margin: 10px; border-radius: 4px;';
        errorDiv.innerHTML = `<strong>Plugin Error:</strong><br>${message}`;
        const pluginContent = document.getElementById('plugin-content');
        if (pluginContent) {
            pluginContent.insertBefore(errorDiv, pluginContent.firstChild);
        } else {
            document.body.insertBefore(errorDiv, document.body.firstChild);
        }
    }

    // Helper function to get backend URL
    window.getBackendUrl = function() {
        const url = window.pluginData?.backendUrl;
        if (!url) {
            console.error('Backend URL not set in plugin data');
            return null;
        }
        
        let normalized = url.trim().replace(/\/+$/, '');
        
        if (!normalized.endsWith('/api') && !normalized.includes('/api')) {
            normalized = normalized + '/api';
        }
        
        normalized = normalized.replace(/([^:]\/)\/+/g, '$1');
        return normalized;
    };
    
    // Helper function to get frontend origin for CORS
    window.getFrontendOrigin = function() {
        const backendUrl = window.getBackendUrl();
        let frontendOrigin = 'https://contract-frontend-dev.legistrak.com';
        
        try {
            const backendUrlObj = new URL(backendUrl);
            if (backendUrlObj.hostname.includes('contract-backend-dev.legistrak.com')) {
                frontendOrigin = 'https://contract-frontend-dev.legistrak.com';
            } else if (backendUrlObj.hostname.includes('contract-backend')) {
                frontendOrigin = backendUrlObj.origin.replace('contract-backend', 'contract-frontend');
            } else if (backendUrlObj.hostname.includes('localhost')) {
                frontendOrigin = 'http://localhost:3000';
            }
        } catch (e) {
            console.warn('Could not derive frontend origin from backend URL, using default:', frontendOrigin);
        }
        
        return frontendOrigin;
    };

    // Helper function to get access token
    window.getAccessToken = function() {
        return window.pluginData?.accessToken || '';
    };

    // Helper function to get contract ID
    window.getContractId = function() {
        return window.pluginData?.contractId || '';
    };

    // Initialize resize handle for panel resizing
    function initResizeHandle() {
        const resizeHandle = document.getElementById('resize-handle');
        if (!resizeHandle) return;

        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        resizeHandle.addEventListener('mousedown', function(e) {
            isResizing = true;
            resizeHandle.classList.add('resizing');
            startX = e.clientX;
            
            const iframe = window.frameElement;
            if (iframe) {
                startWidth = iframe.offsetWidth;
            } else {
                startWidth = window.innerWidth;
            }

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            
            e.preventDefault();
            e.stopPropagation();
        });

        function handleMouseMove(e) {
            if (!isResizing) return;

            const diff = startX - e.clientX;
            const newWidth = Math.max(250, Math.min(800, startWidth + diff));

            if (window.Asc && window.Asc.plugin && window.Asc.plugin.executeMethod) {
                try {
                    window.Asc.plugin.executeMethod('SetPluginPanelWidth', [newWidth], function() {
                        console.log('Panel width set to:', newWidth);
                    }, function(error) {
                        resizeViaCSS(newWidth);
                    });
                } catch (error) {
                    resizeViaCSS(newWidth);
                }
            } else {
                resizeViaCSS(newWidth);
            }
        }

        function resizeViaCSS(newWidth) {
            const iframe = window.frameElement;
            if (iframe) {
                iframe.style.width = newWidth + 'px';
            }
            document.body.style.minWidth = newWidth + 'px';
            document.body.style.width = newWidth + 'px';
        }

        function handleMouseUp() {
            if (isResizing) {
                isResizing = false;
                resizeHandle.classList.remove('resizing');
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            }
        }

        resizeHandle.addEventListener('selectstart', function(e) {
            e.preventDefault();
        });
    }

    // Expose activeContentData for use by feature modules
    window.getActiveContentData = function() {
        return activeContentData;
    };

    window.setActiveContentData = function(key, value) {
        activeContentData[key] = value;
    };

})(window);
