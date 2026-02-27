// Main Plugin Entry Point - Matches MS Editor App.jsx
(function (window, undefined) {
    'use strict';

    // Debug: Log when script loads
    console.log('Plugin main.js script loaded at:', new Date().toISOString());
    console.log('window.Asc at script load:', typeof window.Asc !== 'undefined' ? window.Asc : 'undefined');

    // Helper function to set main menu width to 360px
    // This ensures the OnlyOffice main menu always opens at 360px width
    function setMainMenuWidth() {
        try {
            const mainMenuWidthKey = 'de-mainmenu-width';
            const defaultWidth = '360';

            // Set in current window's localStorage
            localStorage.setItem(mainMenuWidthKey, defaultWidth);

            // Also try to set it in parent window's localStorage (if plugin is in iframe)
            try {
                if (window.parent && window.parent !== window && window.parent.localStorage) {
                    window.parent.localStorage.setItem(mainMenuWidthKey, defaultWidth);
                }
            } catch (parentError) {
                // Cross-origin or other error accessing parent, ignore
            }

            console.log('Set main menu width to', defaultWidth, 'px');
        } catch (error) {
            console.warn('Could not set main menu width:', error);
        }
    }

    // Always set main menu width to 360px on plugin load
    // Must be set early, before OnlyOffice reads it during initialization
    setMainMenuWidth();

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

    // Wait for OnlyOffice API to be available before setting up plugin
    function waitForOnlyOfficeAPI(callback) {
        let attempts = 0;
        const maxAttempts = 200; // 20 seconds max wait time (200 * 100ms)

        function checkAPI() {
            attempts++;

            // Check if window.Asc exists
            if (typeof window.Asc === 'undefined') {
                console.log('Waiting for window.Asc... attempt', attempts);
                if (attempts < maxAttempts) {
                    setTimeout(checkAPI, 100);
                } else {
                    console.error('window.Asc not available after', maxAttempts, 'attempts');
                    showPluginError('OnlyOffice API (window.Asc) is not available. Please ensure the plugin is properly loaded and OnlyOffice is running.');
                }
                return;
            }

            // Check if window.Asc.plugin exists
            if (typeof window.Asc.plugin === 'undefined') {
                console.log('Waiting for window.Asc.plugin... attempt', attempts);
                // Try to initialize plugin object if it doesn't exist
                if (!window.Asc.plugin) {
                    window.Asc.plugin = {};
                }
                if (attempts < maxAttempts) {
                    setTimeout(checkAPI, 100);
                } else {
                    console.error('window.Asc.plugin not available after', maxAttempts, 'attempts');
                    console.log('window.Asc:', window.Asc);
                    showPluginError('OnlyOffice plugin API (window.Asc.plugin) is not available. Please refresh the page or contact support.');
                }
                return;
            }

            console.log('OnlyOffice API detected after', attempts, 'attempts');
            console.log('window.Asc.plugin:', window.Asc.plugin);
            callback();
        }

        // Start checking immediately
        checkAPI();
    }

    // Try immediate initialization if API is already available
    if (window.Asc && window.Asc.plugin) {
        console.log('OnlyOffice API already available, setting up immediately');
        setupPluginInit();
    } else {
        // Wait for OnlyOffice API to be available
        waitForOnlyOfficeAPI(function () {
            setupPluginInit();
        });
    }

    function setupPluginInit() {
        // Ensure window.Asc.plugin exists
        if (!window.Asc) {
            console.error('window.Asc is still undefined');
            showPluginError('OnlyOffice API (window.Asc) is not available. Please ensure OnlyOffice is running and the plugin is properly configured.');
            return;
        }

        if (!window.Asc.plugin) {
            console.warn('window.Asc.plugin is undefined, attempting to create it');
            window.Asc.plugin = {};
        }

        // Plugin initialization - called when OnlyOffice loads the plugin
        window.Asc.plugin.init = function (data) {
            console.log('AI Contract Assistant Plugin initialized');
            console.log('Init function received data parameter:', data);

            // Get plugin initialization data (passed from backend)
            // OnlyOffice may pass initData in different formats depending on pluginsData structure
            let initData = null;

            // Debug: Log all available plugin info
            console.log('window.Asc.plugin.info:', window.Asc.plugin.info);
            console.log('window.Asc.plugin.info.options:', window.Asc.plugin.info?.options);
            console.log('window.Asc.plugin.info.initData:', window.Asc.plugin.info?.initData);
            console.log('window.Asc.plugin.info.pluginsData:', window.Asc.plugin.info?.pluginsData);
            console.log('window.Asc.plugin.info.data:', window.Asc.plugin.info?.data);

            // According to OnlyOffice official documentation:
            // - pluginsData should contain only config.json URLs (array)
            // - Initialization data should be passed via the 'options' object
            // - Options can be directly in options object or keyed by plugin GUID
            const pluginGuid = window.Asc.plugin.info?.guid || 'asc.{9DC93CDB-B576-4F0C-B55E-FCC9C48DD007}';

            // Try to get data from options object (official way)
            if (window.Asc.plugin.info && window.Asc.plugin.info.options) {
                // First try: options might be keyed by plugin GUID
                let pluginOptions = window.Asc.plugin.info.options[pluginGuid];

                // If not found, try direct access (options might contain data directly)
                if (!pluginOptions && window.Asc.plugin.info.options.contractId) {
                    pluginOptions = window.Asc.plugin.info.options;
                    console.log('Using options directly (not keyed by GUID)');
                }

                if (pluginOptions) {
                    // Options is an object, convert to JSON string for consistency
                    initData = JSON.stringify(pluginOptions);
                    console.log('Using initData from window.Asc.plugin.info.options for GUID:', pluginGuid);
                }
            }

            // Fallback: Try other locations where OnlyOffice might store the plugin data
            if (!initData) {
                // 1. Check if data is passed as parameter to init function
                if (data && (typeof data === 'string' || (Array.isArray(data) && data.length > 0))) {
                    initData = Array.isArray(data) ? data[data.length - 1] : data;
                    console.log('Using initData from init function parameter');
                } else if (window.Asc.plugin.info && window.Asc.plugin.info.initData) {
                    initData = window.Asc.plugin.info.initData;
                    console.log('Using initData from window.Asc.plugin.info.initData');
                } else if (window.Asc.plugin.info && window.Asc.plugin.info.data) {
                    // Check if data is an array with elements
                    if (Array.isArray(window.Asc.plugin.info.data) && window.Asc.plugin.info.data.length > 0) {
                        // If it's an array, get the last element (the actual data, not the config URL)
                        initData = window.Asc.plugin.info.data[window.Asc.plugin.info.data.length - 1];
                        console.log('Using initData from window.Asc.plugin.info.data array, index:', window.Asc.plugin.info.data.length - 1);
                    } else if (typeof window.Asc.plugin.info.data === 'string' && window.Asc.plugin.info.data.trim() !== '') {
                        // OnlyOffice often stores plugin data in the 'data' field (as a JSON string)
                        initData = window.Asc.plugin.info.data;
                        console.log('Using initData from window.Asc.plugin.info.data (string)');
                    }
                } else if (window.Asc.plugin.info && window.Asc.plugin.info.pluginsData) {
                    // pluginsData can be a string (JSON), object, or array
                    const pluginsData = window.Asc.plugin.info.pluginsData;
                    if (typeof pluginsData === 'string') {
                        // If it's a string, it's the JSON data directly
                        initData = pluginsData;
                        console.log('Using initData from pluginsData (string)');
                    } else if (typeof pluginsData === 'object' && !Array.isArray(pluginsData)) {
                        // If it's an object (keyed by plugin GUID), get the data for this plugin
                        if (pluginsData[pluginGuid]) {
                            initData = pluginsData[pluginGuid];
                            console.log('Using initData from pluginsData object for GUID:', pluginGuid);
                        }
                    } else if (Array.isArray(pluginsData) && pluginsData.length > 0) {
                        // If it's an array, the last element should be the JSON stringified data
                        initData = pluginsData[pluginsData.length - 1];
                        console.log('Using initData from pluginsData array, index:', pluginsData.length - 1);
                    } else {
                        initData = pluginsData;
                        console.log('Using initData from pluginsData (other type)');
                    }
                }
            }

            if (!initData) {
                console.warn('No initData found in window.Asc.plugin.info');
                console.log('Available keys in window.Asc.plugin.info:', window.Asc.plugin.info ? Object.keys(window.Asc.plugin.info) : 'info is null/undefined');

                // Try to extract contractId from document callback URL as fallback
                if (window.Asc.plugin.info && window.Asc.plugin.info.documentCallbackUrl) {
                    const callbackUrl = window.Asc.plugin.info.documentCallbackUrl;
                    console.log('Attempting to extract contractId from callback URL:', callbackUrl);
                    // Extract contractId from URL like: /api/onlyoffice/track/{contractId}
                    const match = callbackUrl.match(/\/onlyoffice\/track\/([a-fA-F0-9]{24})/);
                    if (match && match[1]) {
                        console.log('Extracted contractId from callback URL:', match[1]);
                        // Create minimal plugin data with contractId
                        initData = JSON.stringify({
                            contractId: match[1],
                            accessToken: null, // Will need to be provided via other means
                            userId: window.Asc.plugin.info.userId || null,
                            organizationId: null,
                            backendUrl: callbackUrl.split('/onlyoffice')[0] || null,
                            permissions: {}
                        });
                        console.log('Created fallback initData from callback URL');
                    }
                }
            }

            console.log('initData received:', initData);
            console.log('initData type:', typeof initData);

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

            // Ensure main menu width is set to 360px (set again after initialization)
            // This ensures it's set even if OnlyOffice reads it after plugin init
            // Use ensureMainMenuWidth() which repeatedly sets it for a short period
            ensureMainMenuWidth();

            // // Force width to 360px on first load using ResizeWindow API
            // // Delay ensures editor layout is ready before resizing
            // setTimeout(function() {
            //     forceResizeWindow();
            // }, 300);
            try {
                // resizeWindow(width, height, minW, minH, maxW, maxH)
                // We'll set width = 360 and choose a sensible height (like 800).
                // For panels the height can be large; the editor will clamp it.
                window.Asc.plugin.resizeWindow(360, 800, 360, 200, 1024, 2000);

                // Optional: send a ready message or initialize UI
                // e.g. window.Asc.plugin.executeMethod("ActivateWindow", ["<frameId>"]);
            } catch (e) {
                console.error("resizeWindow failed", e);
            }

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

        // Plugin execution complete callback
        window.Asc.plugin.executeCommand = function (command, data) {
            console.log('Command received:', command, data);
        };

        // Handle plugin panel close event
        window.Asc.plugin.onClose = function () {
            console.log('Plugin panel close event triggered by OnlyOffice');
        };

        // Handle button clicks from OnlyOffice toolbar
        window.Asc.plugin.button = function (id) {
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

        console.log('Plugin initialization functions set up successfully');
    }

    // Initialize tab navigation - matches MS Editor App.jsx
    function initTabNavigation() {
        // Set default tab to Playbook
        selectedTab = 'Playbook';
        updateTabUI();
    }

    // Handle tab change - matches MS Editor App.jsx onTabChange
    window.handleTabChange = function (tabName) {
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
                // Setup refresh button for AI Copilot
                if (contentKey === 'genai' || contentKey === 'askai') {
                    drawerHeaderActions.style.display = 'flex';
                    if (drawerRegenerateBtn) {
                        drawerRegenerateBtn.style.display = 'flex';
                        drawerRegenerateBtn.onclick = () => {
                            if (window.syncDocumentWithAi) {
                                window.syncDocumentWithAi(true);
                            }
                        };
                    }
                    if (drawerCopyBtn) {
                        drawerCopyBtn.style.display = 'none';
                    }
                } else {
                    // Hide header actions for other views (Library, Approval)
                    drawerHeaderActions.style.display = 'none';
                }
            }
        }

        // Show drawer header for non-playbook views (AI Copilot, Summary, etc.)
        const drawerHeader = document.querySelector('.drawer-header');
        if (drawerHeader) {
            drawerHeader.style.display = 'flex';
        }

        // Hide tabs when drawer is open
        const tabListContainer = document.querySelector('.tab-list-container');
        if (tabListContainer) {
            tabListContainer.style.display = 'none';
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
    window.closeDrawer = function () {
        const drawer = document.getElementById('drawer');
        const drawerOverlay = document.getElementById('drawer-overlay');
        const drawerContent = document.getElementById('drawer-content');
        const drawerHeaderActions = document.getElementById('drawer-header-actions');
        const drawerCloseButton = document.querySelector('.drawer-close-button');
        const drawerTitle = document.getElementById('drawer-title');

        // Check if we're closing Copilot drawer
        const wasCopilot = activeContent === 'genai' || activeContent === 'askai';

        // Reset close button to X (in case it was changed to back button)
        if (drawerCloseButton) {
            drawerCloseButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            `;
            drawerCloseButton.onclick = window.closeDrawer;
            drawerCloseButton.title = '';
        }

        // Reset drawer title if we're closing from library view (could be in sub-clause mode)
        // Check if we're closing from library view and reset title
        if (drawerTitle && activeContent === 'library' && drawerTitle.textContent !== 'Clause Library') {
            drawerTitle.textContent = 'Clause Library';
        }

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

        // Show tabs when drawer is closed
        const tabListContainer = document.querySelector('.tab-list-container');
        if (tabListContainer) {
            tabListContainer.style.display = 'block';
        }

        setActiveContent(null);

        // If closing Copilot, restore previous tab
        if (wasCopilot && previousTab) {
            handleTabChange(previousTab);
        }
    };

    // Handle button click - matches MS Editor App.jsx handleButtonClick
    window.handleButtonClick = async function (contentKey) {
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

    // Set up close button event listeners
    function setupCloseButtonListeners() {
        // Try multiple times to find the OnlyOffice close button (it may load later)
        let attempts = 0;
        const maxAttempts = 10;

        // Function to hide close button elements
        const hideCloseButton = function (element) {
            if (element) {
                element.style.display = 'none';
                element.style.visibility = 'hidden';
                element.style.opacity = '0';
                element.style.pointerEvents = 'none';
                element.style.width = '0';
                element.style.height = '0';
                element.style.margin = '0';
                element.style.padding = '0';
                // Also hide parent if it's a wrapper div
                if (element.parentElement && element.parentElement.classList.contains('plugin-close')) {
                    hideCloseButton(element.parentElement);
                }
            }
        };

        const findAndSetupCloseButton = function () {
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
                '.asc-window-header .asc-window-button-close',
                '.current-plugin-header button',
                '.current-plugin-header .asc-window-close',
                '.current-plugin-header [aria-label*="close" i]',
                '.current-plugin-header [title*="close" i]',
                '.current-plugin-header button:last-child'
            ];

            let onlyOfficeCloseBtn = null;
            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    // Check if it's actually a close button
                    const isCloseButton = el.getAttribute('aria-label')?.toLowerCase().includes('close') ||
                        el.getAttribute('title')?.toLowerCase().includes('close') ||
                        el.classList.contains('plugin-close') ||
                        el.classList.contains('asc-window-close') ||
                        el.classList.contains('close');
                    if (isCloseButton) {
                        hideCloseButton(el);
                        if (!onlyOfficeCloseBtn) {
                            onlyOfficeCloseBtn = el;
                            console.log('Found and hiding OnlyOffice close button with selector:', selector);
                        }
                    }
                });
                if (onlyOfficeCloseBtn) break;
            }

            // Also check for close button within current-plugin-header specifically
            if (!onlyOfficeCloseBtn) {
                const currentPluginHeader = document.querySelector('.current-plugin-header');
                if (currentPluginHeader) {
                    // Look for any button or clickable element in the header
                    const buttons = currentPluginHeader.querySelectorAll('button, [role="button"], a, [onclick]');
                    for (let btn of buttons) {
                        // Check if it looks like a close button (X icon, last child, or has close-related attributes)
                        const isCloseButton = btn.getAttribute('aria-label')?.toLowerCase().includes('close') ||
                            btn.getAttribute('title')?.toLowerCase().includes('close') ||
                            btn.classList.contains('close') ||
                            btn.classList.contains('asc-window-close') ||
                            btn.classList.contains('plugin-close') ||
                            (btn === buttons[buttons.length - 1] && buttons.length > 0);

                        if (isCloseButton || buttons.length === 1) {
                            hideCloseButton(btn);
                            // Also hide parent wrapper if it exists
                            if (btn.parentElement && btn.parentElement.classList.contains('plugin-close')) {
                                hideCloseButton(btn.parentElement);
                            }
                            onlyOfficeCloseBtn = btn;
                            console.log('Found and hiding close button in current-plugin-header');
                            break;
                        }
                    }
                }
            }

            // Also check parent window/frame for close button
            if (!onlyOfficeCloseBtn) {
                try {
                    const parentDoc = window.parent?.document || window.top?.document;
                    if (parentDoc) {
                        for (const selector of selectors) {
                            const elements = parentDoc.querySelectorAll(selector);
                            elements.forEach(el => {
                                const isCloseButton = el.getAttribute('aria-label')?.toLowerCase().includes('close') ||
                                    el.getAttribute('title')?.toLowerCase().includes('close') ||
                                    el.classList.contains('plugin-close') ||
                                    el.classList.contains('asc-window-close') ||
                                    el.classList.contains('close');
                                if (isCloseButton) {
                                    hideCloseButton(el);
                                    if (!onlyOfficeCloseBtn) {
                                        onlyOfficeCloseBtn = el;
                                        console.log('Found and hiding OnlyOffice close button in parent with selector:', selector);
                                    }
                                }
                            });
                            if (onlyOfficeCloseBtn) break;
                        }

                        // Also check parent for current-plugin-header
                        if (!onlyOfficeCloseBtn) {
                            const parentCurrentPluginHeader = parentDoc.querySelector('.current-plugin-header');
                            if (parentCurrentPluginHeader) {
                                const buttons = parentCurrentPluginHeader.querySelectorAll('button, [role="button"], a, [onclick]');
                                for (let btn of buttons) {
                                    const isCloseButton = btn.getAttribute('aria-label')?.toLowerCase().includes('close') ||
                                        btn.getAttribute('title')?.toLowerCase().includes('close') ||
                                        btn.classList.contains('close') ||
                                        btn.classList.contains('asc-window-close') ||
                                        btn.classList.contains('plugin-close') ||
                                        (btn === buttons[buttons.length - 1] && buttons.length > 0);

                                    if (isCloseButton || buttons.length === 1) {
                                        hideCloseButton(btn);
                                        // Also hide parent wrapper if it exists
                                        if (btn.parentElement && btn.parentElement.classList.contains('plugin-close')) {
                                            hideCloseButton(btn.parentElement);
                                        }
                                        onlyOfficeCloseBtn = btn;
                                        console.log('Found and hiding close button in parent current-plugin-header');
                                        break;
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Cross-origin or other error, ignore
                }
            }

            // Close button is now hidden, but we keep the function for collapse functionality
            // The collapse functionality is preserved via closePluginPanel() which uses HidePluginPanel
            if (onlyOfficeCloseBtn || attempts >= 5) {
                // Button found and hidden, or we've tried enough times
                console.log('Close button hidden successfully');
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

        // Set up mutation observer to watch for dynamically added close buttons and hide them immediately
        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType === 1) { // Element node
                        // Check if the added node is a close button or contains one
                        const isCloseButton = node.matches && (
                            node.matches('.asc-window-close, .plugin-close, [aria-label*="close" i], [title*="close" i]') ||
                            node.matches('.current-plugin-header') ||
                            node.querySelector && node.querySelector('.current-plugin-header, .asc-window-close, .plugin-close, [aria-label*="close" i], [title*="close" i]')
                        );

                        if (isCloseButton) {
                            // Immediately hide any close buttons found
                            if (node.matches && (node.matches('.plugin-close, .asc-window-close') ||
                                node.getAttribute('aria-label')?.toLowerCase().includes('close'))) {
                                hideCloseButton(node);
                            }
                            // Also check for close buttons inside the node
                            const closeButtons = node.querySelectorAll && node.querySelectorAll('.plugin-close, .asc-window-close, [aria-label*="close" i]');
                            if (closeButtons) {
                                closeButtons.forEach(btn => hideCloseButton(btn));
                            }
                            console.log('Close button or header detected, hiding immediately');
                            setTimeout(findAndSetupCloseButton, 100);
                        }
                    }
                });
            });
        });

        // Observe the document body for added nodes
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Also observe parent document if accessible
        try {
            const parentDoc = window.parent?.document || window.top?.document;
            if (parentDoc && parentDoc.body) {
                const parentObserver = new MutationObserver(function (mutations) {
                    mutations.forEach(function (mutation) {
                        mutation.addedNodes.forEach(function (node) {
                            if (node.nodeType === 1) {
                                const isCloseButton = node.matches && (
                                    node.matches('.asc-window-close, .plugin-close, [aria-label*="close" i], [title*="close" i]') ||
                                    node.matches('.current-plugin-header') ||
                                    node.querySelector && node.querySelector('.current-plugin-header, .asc-window-close, .plugin-close, [aria-label*="close" i], [title*="close" i]')
                                );

                                if (isCloseButton) {
                                    // Immediately hide any close buttons found in parent
                                    if (node.matches && (node.matches('.plugin-close, .asc-window-close') ||
                                        node.getAttribute('aria-label')?.toLowerCase().includes('close'))) {
                                        hideCloseButton(node);
                                    }
                                    // Also check for close buttons inside the node
                                    const closeButtons = node.querySelectorAll && node.querySelectorAll('.plugin-close, .asc-window-close, [aria-label*="close" i]');
                                    if (closeButtons) {
                                        closeButtons.forEach(btn => hideCloseButton(btn));
                                    }
                                    console.log('Close button or header detected in parent, hiding immediately');
                                    setTimeout(findAndSetupCloseButton, 100);
                                }
                            }
                        });
                    });
                });

                parentObserver.observe(parentDoc.body, {
                    childList: true,
                    subtree: true
                });
            }
        } catch (e) {
            // Cross-origin or other error, ignore
        }

        // Set up event delegation as a fallback to catch clicks on close buttons
        // This works even if buttons are added dynamically
        const handleCloseClick = function (e) {
            const target = e.target;
            const clickedElement = target.closest ? target.closest('button, [role="button"], a, [onclick]') : target;

            if (!clickedElement) return;

            // Check if clicked element is in current-plugin-header or is a close button
            const isInCurrentPluginHeader = clickedElement.closest && clickedElement.closest('.current-plugin-header');
            const isCloseButton = clickedElement.classList.contains('asc-window-close') ||
                clickedElement.classList.contains('plugin-close') ||
                clickedElement.classList.contains('close') ||
                clickedElement.getAttribute('aria-label')?.toLowerCase().includes('close') ||
                clickedElement.getAttribute('title')?.toLowerCase().includes('close') ||
                (isInCurrentPluginHeader && clickedElement.closest('.current-plugin-header').querySelectorAll('button, [role="button"], a, [onclick]').length === 1);

            if (isCloseButton || (isInCurrentPluginHeader && clickedElement === clickedElement.closest('.current-plugin-header').querySelector('button:last-child, [role="button"]:last-child'))) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Close button clicked via event delegation');
                closePluginPanel();
                return false;
            }
        };

        // Add event listener to document for event delegation
        document.addEventListener('click', handleCloseClick, true); // Use capture phase

        // Also add to parent document if accessible
        try {
            const parentDoc = window.parent?.document || window.top?.document;
            if (parentDoc) {
                parentDoc.addEventListener('click', handleCloseClick, true);
            }
        } catch (e) {
            // Cross-origin or other error, ignore
        }
    }

    // Track if ensureMainMenuWidth interval is already running
    let mainMenuWidthIntervalId = null;

    // Function to ensure main menu width stays at 360px
    // Uses interval to repeatedly set it for a short period to catch OnlyOffice's reads
    function ensureMainMenuWidth() {
        // Clear any existing interval
        if (mainMenuWidthIntervalId !== null) {
            clearInterval(mainMenuWidthIntervalId);
            mainMenuWidthIntervalId = null;
        }

        const mainMenuWidthKey = 'de-mainmenu-width';
        const defaultWidth = '360';
        let attempts = 0;
        const maxAttempts = 30; // Check for 3 seconds (30 * 100ms) to catch late reads

        // Set it immediately
        setMainMenuWidth();

        mainMenuWidthIntervalId = setInterval(function () {
            try {
                // Set in current window
                localStorage.setItem(mainMenuWidthKey, defaultWidth);

                // Also try to set in parent window (if in iframe)
                try {
                    if (window.parent && window.parent !== window && window.parent.localStorage) {
                        window.parent.localStorage.setItem(mainMenuWidthKey, defaultWidth);
                    }
                } catch (e) {
                    // Cross-origin, ignore
                }

                attempts++;
                if (attempts >= maxAttempts) {
                    clearInterval(mainMenuWidthIntervalId);
                    mainMenuWidthIntervalId = null;
                    console.log('Stopped ensuring main menu width (max attempts reached)');
                }
            } catch (error) {
                clearInterval(mainMenuWidthIntervalId);
                mainMenuWidthIntervalId = null;
                console.warn('Error ensuring main menu width:', error);
            }
        }, 100); // Check every 100ms
    }

    // Helper function to force resize window to 360px using OnlyOffice API
    function forceResizeWindow() {
        try {
            if (window.Asc && window.Asc.plugin && window.Asc.plugin.executeMethod) {
                window.Asc.plugin.executeMethod("ResizeWindow", [360, 0], function () {
                    console.log('ResizeWindow: Forced main menu width to 360px');
                }, function (error) {
                    console.warn('ResizeWindow failed:', error);
                });
            }
        } catch (e) {
            console.warn('ResizeWindow error:', e);
        }
    }

    // Open plugin panel on the left side
    function openPluginPanel() {
        try {
            if (window.Asc && window.Asc.plugin && window.Asc.plugin.executeMethod) {
                window.Asc.plugin.executeMethod("ShowPluginPanel", [], function () {
                    console.log('Plugin panel opened');
                    // Ensure width is set after panel opens
                    ensureMainMenuWidth();
                    // Force resize after panel opens (with delay to ensure panel is rendered)
                    setTimeout(function () {
                        forceResizeWindow();
                    }, 200);
                }, function (error) {
                    console.warn('ShowPluginPanel not available:', error);
                    // Even if panel open fails, ensure width is set
                    ensureMainMenuWidth();
                    forceResizeWindow();
                });
            } else {
                // If API not available, still try to ensure width
                ensureMainMenuWidth();
                forceResizeWindow();
            }
        } catch (error) {
            console.warn('Error opening plugin panel:', error);
            // Even on error, try to ensure width
            ensureMainMenuWidth();
            forceResizeWindow();
        }
    }

    // Initialize OnlyOffice API helpers
    function initOnlyOfficeAPI() {
        window.getDocumentContent = function () {
            return new Promise((resolve, reject) => {
                try {
                    if (window.Asc && window.Asc.plugin && window.Asc.plugin.executeMethod) {
                        window.Asc.plugin.executeMethod("GetDocumentContent", [], function (data) {
                            if (data && data.content) {
                                const text = typeof data.content === 'string'
                                    ? data.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
                                    : JSON.stringify(data.content);
                                resolve(text);
                            } else {
                                resolve('');
                            }
                        }, function (error) {
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

        window.getSelectedText = function () {
            return new Promise((resolve, reject) => {
                try {
                    if (window.Asc && window.Asc.plugin && window.Asc.plugin.executeMethod) {
                        window.Asc.plugin.executeMethod("GetSelectedText", [], function (data) {
                            if (data && data.text) {
                                resolve(data.text);
                            } else {
                                resolve('');
                            }
                        }, function (error) {
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

    // Function to close/hide the plugin panel programmatically
    // NOTE: This function uses HidePluginPanel which COLLAPSES the plugin (not permanently closes it)
    // The collapse functionality is preserved - users can still collapse the plugin via other means
    // The close button is hidden but collapse functionality remains intact
    window.closePluginPanel = function () {
        console.log('closePluginPanel called');

        // First, close any open drawer
        if (window.closeDrawer) {
            window.closeDrawer();
        }

        // Try multiple methods to close the plugin panel
        try {
            if (window.Asc && window.Asc.plugin && window.Asc.plugin.executeMethod) {
                // Method 1: HidePluginPanel - This COLLAPSES the plugin (preserves collapse functionality)
                window.Asc.plugin.executeMethod("HidePluginPanel", [], function () {
                    console.log('Plugin panel closed via HidePluginPanel');
                }, function (error) {
                    console.warn('HidePluginPanel not available, trying alternative methods:', error);

                    // Method 2: Try ClosePluginPanel
                    window.Asc.plugin.executeMethod("ClosePluginPanel", [], function () {
                        console.log('Plugin panel closed via ClosePluginPanel');
                    }, function (error2) {
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
    window.getPluginData = function () {
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
    window.getBackendUrl = function () {
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
    window.getFrontendOrigin = function () {
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
    window.getAccessToken = function () {
        return window.pluginData?.accessToken || '';
    };

    // Helper function to get contract ID
    window.getContractId = function () {
        return window.pluginData?.contractId || '';
    };

    // Initialize resize handle for panel resizing
    function initResizeHandle() {
        const resizeHandle = document.getElementById('resize-handle');
        if (!resizeHandle) return;

        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        resizeHandle.addEventListener('mousedown', function (e) {
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
                    window.Asc.plugin.executeMethod('SetPluginPanelWidth', [newWidth], function () {
                        console.log('Panel width set to:', newWidth);
                    }, function (error) {
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

        resizeHandle.addEventListener('selectstart', function (e) {
            e.preventDefault();
        });
    }

    // Expose activeContentData for use by feature modules
    window.getActiveContentData = function () {
        return activeContentData;
    };

    window.setActiveContentData = function (key, value) {
        activeContentData[key] = value;
    };

})(window);
