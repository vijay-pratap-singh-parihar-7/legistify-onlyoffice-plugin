// Library Feature Module - Matches MS Editor Library.js Exactly
(function(window) {
    'use strict';

    // State management
    let clauseList = [];
    let subClauseList = [];
    let clauseListLoading = false;
    let subClauseVisible = false;
    let subClause = null;
    let subClauseLoading = false;
    let searchType = 'clause';
    let searchText = '';
    let errorMessage = '';
    let clauseSwitch = false;
    let timerRef = null;
    
    // Expose clauseSwitch to window for drawer button state
    Object.defineProperty(window, 'clauseSwitch', {
        get: function() { return clauseSwitch; },
        set: function(value) { clauseSwitch = value; },
        configurable: true
    });
    
    // Expose clauseSwitch to window for drawer button state
    window.clauseSwitch = clauseSwitch;

    // Initialize library view
    window.initLibraryView = function(data) {
        // Check for drawer view first (cloned), then original view
        let libraryView = document.querySelector('#library-view-drawer, #library-view');
        if (!libraryView) {
            // Try to find library-container directly
            libraryView = document.querySelector('#library-container-drawer, #library-container')?.parentElement;
        }
        if (!libraryView) return;

        // Use data from parent if available (passed from main.js)
        if (data && data.length > 0) {
            clauseList = data;
            renderLibraryView();
            renderClauseList();
        } else {
            // Render library view structure
            renderLibraryView();
            
            // Fetch clause library
            getClauseLibrary();
        }
    };

    // Render library view - matches MS Editor Library.js exactly
    function renderLibraryView() {
        // Check for drawer view first (cloned), then original view
        let libraryView = document.querySelector('#library-view-drawer, #library-view');
        if (!libraryView) {
            // Try to find library-container directly
            const container = document.querySelector('#library-container-drawer, #library-container');
            if (container) {
                libraryView = container.parentElement;
            }
        }
        if (!libraryView) return;

        // Check if we're in drawer (has -drawer suffix) or original view
        // Also check if we're inside drawer-content
        const isInDrawer = libraryView.closest('#drawer-content') !== null || 
                          libraryView.id === 'library-view-drawer' || 
                          libraryView.querySelector('#library-container-drawer');
        const containerId = isInDrawer ? 'library-container-drawer' : 'library-container';
        const listContainerId = isInDrawer ? 'library-list-container-drawer' : 'library-list-container';
        const searchInputId = isInDrawer ? 'library-search-input-drawer' : 'library-search-input';
        const searchMenuId = isInDrawer ? 'search-menu-dropdown-drawer' : 'search-menu-dropdown';
        
        // Don't render feature-header if in drawer (drawer has its own header)
        const shouldShowHeader = !isInDrawer;
        
        libraryView.innerHTML = `
            <div id="${containerId}" class="library-container">
                ${shouldShowHeader ? `
                <div class="feature-header">
                    <div class="header-box">
                        <svg class="back-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" onclick="handleBackFromLibrary()" style="cursor: pointer;">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                        <p class="summary-text">Clause Library</p>
                    </div>
                    <div class="favorite-toggle" style="position: absolute; right: 20px;">
                        <span onclick="toggleFavoriteSwitch()" class="${clauseSwitch ? 'active-tab' : 'tab'}" style="white-space: nowrap; font-weight: 600; cursor: pointer; padding: 6.3px 12px; border-radius: 5px; color: ${clauseSwitch ? '#fff' : '#808e99'}; border: 1px solid #5c8dff; font-size: 12px; background-color: ${clauseSwitch ? '#2667ff' : 'transparent'};">
                            Favourites
                        </span>
                    </div>
                </div>
                ` : ''}
                <div style="flex: 1; overflow-y: auto;">
                    <div class="search-container">
                        <input type="text" id="${searchInputId}" class="search-input" value="${searchText}" placeholder="Search any ${searchType !== 'clause' ? 'sub ' : ''}clause by name" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;" />
                        <div class="search-menu" style="position: relative;">
                            <button class="menu-button" onclick="toggleSearchMenu()" style="padding: 0px !important; min-width: 21px; min-height: 26px; border: none !important; background: transparent; cursor: pointer;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="1"></circle>
                                    <circle cx="12" cy="5" r="1"></circle>
                                    <circle cx="12" cy="19" r="1"></circle>
                                </svg>
                            </button>
                            <div id="${searchMenuId}" class="menu-dropdown" style="display: none; position: absolute; right: 0; top: 100%; background: white; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 1000; min-width: 180px; margin-top: 4px;">
                                <div class="menu-item" onclick="handleSearchType('clause')" style="padding: 8px 12px; cursor: pointer; font-size: 14px; ${searchType === 'clause' ? 'background-color: #f0f0f0;' : ''}">Search by Clause</div>
                                <div class="menu-item" onclick="handleSearchType('subClause')" style="padding: 8px 12px; cursor: pointer; font-size: 14px; ${searchType === 'subClause' ? 'background-color: #f0f0f0;' : ''}">Search by Sub Clause</div>
                            </div>
                        </div>
                        <button class="custom-button" onclick="handleAddClause()" style="padding: 0px !important; min-width: 24px; min-height: 26px; background-color: #446995 !important; border-color: #446995 !important; color: #fff !important; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                    </div>
                    <div id="${listContainerId}" class="hiddenScrollbar"></div>
                </div>
            </div>
        `;

        // Setup search input handler - check both drawer and original
        const searchInput = document.getElementById(searchInputId) || document.getElementById('library-search-input-drawer') || document.getElementById('library-search-input');
        if (searchInput) {
            // Remove existing listeners by cloning
            const newInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newInput, searchInput);
            newInput.addEventListener('input', handleInputChange);
        }
        
        // Close dropdown when clicking outside
        const dropdownId = searchMenuId;
        document.addEventListener('click', function(event) {
            const dropdown = document.getElementById(dropdownId) || document.getElementById('search-menu-dropdown-drawer') || document.getElementById('search-menu-dropdown');
            const menuButton = event.target.closest('.menu-button');
            if (dropdown && !dropdown.contains(event.target) && !menuButton) {
                dropdown.style.display = 'none';
            }
        });
    }

    // Toggle favorite switch
    window.toggleFavoriteSwitch = function() {
        clauseSwitch = !clauseSwitch;
        getClauseLibrary('', clauseSwitch);
        // Update UI
        const toggle = document.querySelector('.favorite-toggle span');
        if (toggle) {
            toggle.className = clauseSwitch ? 'active-tab' : 'tab';
            toggle.style.backgroundColor = clauseSwitch ? '#2667ff' : 'transparent';
            toggle.style.color = clauseSwitch ? '#fff' : '#808e99';
        }
    };

    // Handle search type change
    window.handleSearchType = function(name) {
        if (name === searchType) {
            closeSearchMenu();
            return;
        }
        searchText = '';
        const searchInput = document.getElementById('library-search-input-drawer') || document.getElementById('library-search-input');
        if (searchInput) searchInput.value = '';
        if (searchType === 'clause') {
            getSubClauseLibrary();
        } else {
            getClauseLibrary();
        }
        searchType = name;
        closeSearchMenu();
    };

    // Toggle search menu
    window.toggleSearchMenu = function() {
        const dropdown = document.getElementById('search-menu-dropdown-drawer') || document.getElementById('search-menu-dropdown');
        if (dropdown) {
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        }
    };

    // Close search menu
    function closeSearchMenu() {
        const dropdown = document.getElementById('search-menu-dropdown-drawer') || document.getElementById('search-menu-dropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }

    // Handle input change with debounce
    function handleInputChange(e) {
        if (timerRef) {
            clearTimeout(timerRef);
        }
        searchText = e.target.value;
        timerRef = setTimeout(() => {
            if (searchType === 'clause') {
                getClauseLibrary(`name=${e.target.value}`);
            } else {
                getSubClauseLibrary(`name=${e.target.value}`);
            }
        }, 1000);
    }
    
    // Helper function to get current container ID
    function getListContainerId() {
        return document.getElementById('library-list-container-drawer') ? 'library-list-container-drawer' : 'library-list-container';
    }

    // Get clause library
    async function getClauseLibrary(param = '', mode = clauseSwitch) {
        // Check for drawer container first, then original
        const container = document.getElementById('library-list-container-drawer') || document.getElementById('library-list-container');
        if (!container) return;

        clauseListLoading = true;
        updateLibraryLoading(true);

        try {
        const pluginData = window.getPluginData();
        const backendUrl = window.getBackendUrl();
        const accessToken = window.getAccessToken();

            if (!accessToken) {
                throw new Error('Access token not available');
            }

            const query = mode ? `${param}&onlyFavourite=true` : param;
            const url = `${backendUrl}/clause-library/clause-list${query ? '?' + query : ''}`;
            
            const response = await fetch(url, {
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch clause library');
            }

                const data = await response.json();
            if (data?.status) {
                clauseList = data.data?.clauses || [];
                renderClauseList();
                } else {
                errorMessage = data.msg || 'Failed to load clause library';
                showError(errorMessage);
            }
        } catch (error) {
            console.error('Error fetching clause library:', error);
            errorMessage = error.message || 'Failed to load clause library';
            showError(errorMessage);
        } finally {
            clauseListLoading = false;
            updateLibraryLoading(false);
        }
    }

    // Get sub clause library
    async function getSubClauseLibrary(param = '') {
        // Check for drawer container first, then original
        const container = document.getElementById('library-list-container-drawer') || document.getElementById('library-list-container');
        if (!container) return;

        clauseListLoading = true;
        updateLibraryLoading(true);

        try {
            const pluginData = window.getPluginData();
            const backendUrl = window.getBackendUrl();
            const accessToken = window.getAccessToken();

            if (!accessToken) {
                throw new Error('Access token not available');
            }

            const query = clauseSwitch ? `${param}&onlyFavourite=true` : param;
            const url = `${backendUrl}/clause-library/sub-clause-list${query ? '?' + query : ''}`;
            
            const response = await fetch(url, {
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch sub clause library');
            }

            const data = await response.json();
            if (data?.status) {
                subClauseList = data.data?.subClauses || [];
                renderSubClauseList();
            } else {
                errorMessage = data.msg || 'Failed to load sub clause library';
                showError(errorMessage);
            }
        } catch (error) {
            console.error('Error fetching sub clause library:', error);
            errorMessage = error.message || 'Failed to load sub clause library';
            showError(errorMessage);
        } finally {
            clauseListLoading = false;
            updateLibraryLoading(false);
        }
    }

    // Render clause list with accordion
    function renderClauseList() {
        const container = document.getElementById(getListContainerId());
        if (!container) return;

        if (clauseList.length === 0) {
            container.innerHTML = '<div class="empty-state">No clauses found</div>';
            return;
        }

        const accordionHTML = clauseList.map((item, index) => {
            if (!item.subClauses?.length) return null;
            
            const accordionId = `accordion-${index}`;
            return `
                <div class="editor-clause-accordion" style="border-bottom: 1px solid #ebe9f1;">
                    <div class="accordion-header" onclick="toggleAccordion('${accordionId}')" style="padding: 12px 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: #fff;">
                        <span class="accordion-title" style="font-size: 14px; font-weight: 500; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
                        <svg class="accordion-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transform: rotate(0deg); transition: transform 0.2s;">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>
                    <div id="${accordionId}" class="accordion-panel" style="display: none; padding: 0;">
                        ${item.subClauses.map((singleSubClause) => `
                            <div style="padding: 8px;">
                                <div style="display: flex;">
                                    <div onclick="handleViewSubClause('${singleSubClause._id}')" style="flex: 1; cursor: pointer;">
                                        <span style="font-size: 12px; font-weight: 400; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block;" title="${escapeHtml(singleSubClause.name)}">${escapeHtml(singleSubClause.name)}</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        ${item.primarySubClauseId === singleSubClause._id ? `
                                            <span style="border-radius: 50rem; background: #2667ff; color: #fff; padding: 2px 8px; font-size: 11px; font-weight: 600;">P</span>
                                        ` : ''}
                                        <div onclick="handleToggleFavorite('${singleSubClause._id}', ${singleSubClause.isFavourite || false})" style="cursor: pointer;">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="${singleSubClause.isFavourite ? 'rgb(255, 255, 41)' : 'none'}" stroke="${singleSubClause.isFavourite ? 'rgb(255, 255, 41)' : 'grey'}" stroke-width="2">
                                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).filter(Boolean).join('');

        container.innerHTML = accordionHTML;
    }

    // Render sub clause list
    function renderSubClauseList() {
        const container = document.getElementById(getListContainerId());
        if (!container) return;

        if (subClauseList.length === 0) {
            container.innerHTML = '<div class="empty-state">No sub clauses found</div>';
            return;
        }

        const listHTML = subClauseList.map((singleSubClause) => `
            <div style="padding: 8px;">
                <div style="display: flex;">
                    <div onclick="handleViewSubClause('${singleSubClause._id}')" style="flex: 1; cursor: pointer;">
                        <span style="font-size: 12px; font-weight: 400; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block;" title="${escapeHtml(singleSubClause.name)}">${escapeHtml(singleSubClause.name)}</span>
                    </div>
                    <div style="display: flex; align-items: center;">
                        <div onclick="handleToggleFavorite('${singleSubClause._id}', ${singleSubClause.isFavourite || false})" style="cursor: pointer;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="${singleSubClause.isFavourite ? 'rgb(255, 255, 41)' : 'none'}" stroke="${singleSubClause.isFavourite ? 'rgb(255, 255, 41)' : 'grey'}" stroke-width="2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = listHTML;
    }

    // Toggle accordion
    window.toggleAccordion = function(accordionId) {
        const panel = document.getElementById(accordionId);
        const header = panel?.previousElementSibling;
        const icon = header?.querySelector('.accordion-icon');
        
        if (panel) {
            const isOpen = panel.style.display !== 'none';
            panel.style.display = isOpen ? 'none' : 'block';
            if (icon) {
                icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        }
    };

    // Handle view sub clause
    window.handleViewSubClause = async function(subClauseId) {
        subClauseVisible = true;
        subClauseLoading = true;
        
        // Check for drawer view first, then original
        let libraryView = document.getElementById('library-view-drawer') || document.getElementById('library-view');
        if (!libraryView) {
            // Try to find by container
            const container = document.getElementById('library-container-drawer') || document.getElementById('library-container');
            if (container) {
                libraryView = container.parentElement;
            }
        }
        if (!libraryView) return;

        // Update drawer header: replace close button with back button and show copy button
        const drawerCloseButton = document.querySelector('.drawer-close-button');
        const drawerHeaderActions = document.getElementById('drawer-header-actions');
        const drawerCopyBtn = document.getElementById('drawer-copy-btn');
        const drawerTitle = document.getElementById('drawer-title');
        
        // Replace close button (X) with back arrow button
        if (drawerCloseButton) {
            drawerCloseButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
            `;
            drawerCloseButton.onclick = handleBackFromSubClause;
            drawerCloseButton.title = 'Back to Clause Library';
        }
        
        // Show copy button in drawer header actions
        if (drawerHeaderActions) {
            drawerHeaderActions.style.display = 'flex';
        }
        if (drawerCopyBtn) {
            drawerCopyBtn.style.display = 'flex';
            drawerCopyBtn.onclick = copySubClause;
            drawerCopyBtn.title = 'Copy SubClause Details';
        }

        // Render sub clause view without feature-header
        libraryView.innerHTML = `
            <div class="sub-clause-box">
                <div id="sub-clause-content" class="hiddenScrollbar sub-clause-content-wrapper">
                    <div class="loading-spinner"></div>
                </div>
            </div>
        `;

        try {
        const pluginData = window.getPluginData();
        const backendUrl = window.getBackendUrl();
        const accessToken = window.getAccessToken();
        
        if (!accessToken) {
                throw new Error('Access token not available');
        }

            const url = `${backendUrl}/clause-library/sub-clause-details?subClauseId=${subClauseId}`;
            const response = await fetch(url, {
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch sub clause details');
            }

                const data = await response.json();
            if (data?.status && data?.data) {
                subClause = data.data;
                
                // Update drawer title to show clause name (dynamic title)
                if (drawerTitle && subClause.name) {
                    drawerTitle.textContent = subClause.name;
                }
                
                const contentDiv = document.getElementById('sub-clause-content');
                if (contentDiv && subClause.content) {
                    // Remove centering styles when content is loaded and add margin-left
                    contentDiv.style.alignItems = 'flex-start';
                    contentDiv.style.justifyContent = 'flex-start';
                    contentDiv.style.marginLeft = '16px';
                    contentDiv.innerHTML = `<div id="subClauseHtmlContentContainer" style="line-height: normal;">${subClause.content}</div>`;
                }
            } else {
                errorMessage = data.msg || 'Failed to load sub clause details';
                showError(errorMessage);
            }
        } catch (error) {
            console.error('Error fetching sub clause details:', error);
            errorMessage = error.message || 'Failed to load sub clause details';
            showError(errorMessage);
        } finally {
            subClauseLoading = false;
        }
    };

    // Handle back from sub clause
    window.handleBackFromSubClause = function() {
        subClauseVisible = false;
        subClause = null;
        
        // Restore drawer close button to X (close button)
        const drawerCloseButton = document.querySelector('.drawer-close-button');
        const drawerHeaderActions = document.getElementById('drawer-header-actions');
        const drawerCopyBtn = document.getElementById('drawer-copy-btn');
        const drawerTitle = document.getElementById('drawer-title');
        
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
        
        // Restore drawer title to "Clause Library"
        if (drawerTitle) {
            drawerTitle.textContent = 'Clause Library';
        }
        
        // Hide copy button in drawer header actions
        if (drawerHeaderActions) {
            drawerHeaderActions.style.display = 'none';
        }
        if (drawerCopyBtn) {
            drawerCopyBtn.style.display = 'none';
        }
        
        renderLibraryView();
        if (searchType === 'clause') {
            getClauseLibrary();
        } else {
            getSubClauseLibrary();
        }
    };

    // Handle toggle favorite
    window.handleToggleFavorite = async function(subClauseId, currentFavorite) {
        try {
        const pluginData = window.getPluginData();
        const backendUrl = window.getBackendUrl();
        const accessToken = window.getAccessToken();
        
        if (!accessToken) {
                throw new Error('Access token not available');
            }

            const formData = {
                subClauseId: subClauseId,
                markFavourite: !currentFavorite ? 'true' : 'false'
            };

            const url = `${backendUrl}/clause-library/mark-favourite`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'x-auth-token': accessToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                throw new Error('Failed to update favorite');
            }

            // Refresh the list
            if (searchType === 'clause') {
                getClauseLibrary();
            } else {
                getSubClauseLibrary();
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
            showError('Failed to update favorite');
        }
    };

    // Handle add clause
    window.handleAddClause = function() {
        window.open("https://contracts.legistify.com/add-clause", "_blank");
    };

    // Copy sub clause
    window.copySubClause = function() {
        const contentContainer = document.getElementById('subClauseHtmlContentContainer');
        if (!contentContainer) {
            showToast('No sub clause content to copy', 'error');
            return;
        }

        // Extract plain text from the rendered HTML (no HTML tags)
        let text = '';
        if (window.htmlToString) {
            // Use the utility function if available
            text = window.htmlToString(contentContainer.innerHTML);
        } else {
            // Fallback: extract text using DOM
            text = contentContainer.textContent || contentContainer.innerText || '';
            // Clean up whitespace
            text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
        }
        
        if (!text) {
            showToast('No sub clause content to copy', 'error');
            return;
        }
        
        navigator.clipboard.writeText(text).then(() => {
            showToast('Sub clause copied to clipboard', 'success');
        }).catch(err => {
            console.error('Failed to copy:', err);
            showToast('Failed to copy sub clause', 'error');
        });
    };

    // Handle back from library
    window.handleBackFromLibrary = function() {
        // Clear library state
        errorMessage = '';
        searchText = '';
        clauseList = [];
        subClauseList = [];
        
        // Clear any timers
        if (timerRef) {
            clearTimeout(timerRef);
            timerRef = null;
        }
        
        // Close drawer
        if (window.closeDrawer) {
            window.closeDrawer();
        }
    };

    // Update library loading state
    function updateLibraryLoading(loading) {
        const container = document.getElementById(getListContainerId());
        if (!container) return;

        if (loading) {
            container.innerHTML = '<div class="loading-container" style="margin-top: 120px;"><div class="loading-spinner"></div></div>';
        }
    }

    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Show error
    function showError(message) {
        const container = document.getElementById(getListContainerId());
        if (container) {
            container.innerHTML = `<div class="error-message">${escapeHtml(message)}</div>`;
        }
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
