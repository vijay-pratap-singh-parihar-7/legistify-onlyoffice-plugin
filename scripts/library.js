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

    // Initialize library view
    window.initLibraryView = function() {
        const libraryView = document.getElementById('library-view');
        if (!libraryView) return;

        // Render library view structure
        renderLibraryView();
        
        // Fetch clause library
        getClauseLibrary();
    };

    // Render library view - matches MS Editor
    function renderLibraryView() {
        const libraryView = document.getElementById('library-view');
        if (!libraryView) return;

        libraryView.innerHTML = `
            <div class="library-container">
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
                <div style="flex: 1; overflow-y: auto;">
                    <div class="search-container">
                        <input type="text" id="library-search-input" class="search-input" value="${searchText}" placeholder="Search any ${searchType !== 'clause' ? 'sub ' : ''}clause by name" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;" />
                        <div class="search-menu" style="position: relative;">
                            <button class="menu-button" onclick="toggleSearchMenu()" style="padding: 0; min-width: 21px; min-height: 26px; border: none; background: transparent; cursor: pointer;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="1"></circle>
                                    <circle cx="12" cy="5" r="1"></circle>
                                    <circle cx="12" cy="19" r="1"></circle>
                                </svg>
                            </button>
                            <div id="search-menu-dropdown" class="menu-dropdown" style="display: none; position: absolute; right: 0; top: 100%; background: white; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 1000; min-width: 180px; margin-top: 4px;">
                                <div class="menu-item" onclick="handleSearchType('clause')" style="padding: 8px 12px; cursor: pointer; font-size: 14px; ${searchType === 'clause' ? 'background-color: #f0f0f0;' : ''}">Search by Clause</div>
                                <div class="menu-item" onclick="handleSearchType('subClause')" style="padding: 8px 12px; cursor: pointer; font-size: 14px; ${searchType === 'subClause' ? 'background-color: #f0f0f0;' : ''}">Search by Sub Clause</div>
                            </div>
                        </div>
                        <button class="custom-button" onclick="handleAddClause()" style="padding: 0px; min-width: 24px; min-height: 26px; background-color: #446995; border-color: #446995; color: #fff; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                    </div>
                    <div id="library-list-container"></div>
                </div>
            </div>
        `;

        // Setup search input handler
        const searchInput = document.getElementById('library-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', handleInputChange);
        }
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
        const searchInput = document.getElementById('library-search-input');
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
        const dropdown = document.getElementById('search-menu-dropdown');
        if (dropdown) {
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        }
    };

    // Close search menu
    function closeSearchMenu() {
        const dropdown = document.getElementById('search-menu-dropdown');
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

    // Get clause library
    async function getClauseLibrary(param = '', mode = clauseSwitch) {
        const container = document.getElementById('library-list-container');
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
            const url = `/clause-library/clause-list${query ? '?' + query : ''}`;
            
            const response = await window.pluginFetch(url);
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
        const container = document.getElementById('library-list-container');
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
            const url = `/clause-library/sub-clause-list${query ? '?' + query : ''}`;
            
            const response = await window.pluginFetch(url);

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
        const container = document.getElementById('library-list-container');
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
        const container = document.getElementById('library-list-container');
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
        
        const libraryView = document.getElementById('library-view');
        if (!libraryView) return;

        libraryView.innerHTML = `
            <div class="sub-clause-box" style="position: relative; height: 100vh; overflow: hidden; margin-top: -10px; display: flex; flex-direction: column;">
                <div class="feature-header">
                    <div class="header-box">
                        <svg class="back-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" onclick="handleBackFromSubClause()" style="cursor: pointer;">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                        <p class="summary-text">Sub Clause</p>
                    </div>
                    <div class="copy-button" onclick="copySubClause()" style="position: absolute; right: 20px; padding: 4px; border-radius: 5px; display: flex; align-items: center; cursor: pointer; border: 1px solid #0000003d;" title="Copy SubClause Details">
                        <svg id="copy" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </div>
                </div>
                <div id="sub-clause-content" style="flex: 1; overflow-y: auto; margin-left: 16px; font-size: 12px;">
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

            const url = `/clause-library/sub-clause-details?subClauseId=${subClauseId}`;
            const response = await window.pluginFetch(url);

                const data = await response.json();
            if (data?.status && data?.data) {
                subClause = data.data;
                const contentDiv = document.getElementById('sub-clause-content');
                if (contentDiv && subClause.content) {
                    contentDiv.innerHTML = `<div id="subClauseHtmlContentContainer" style="margin-top: -22px; line-height: normal;">${subClause.content}</div>`;
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

            const url = `/clause-library/mark-favourite`;
            const response = await window.pluginFetch(url, {
                method: 'POST',
                body: JSON.stringify(formData)
            });
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
        if (contentContainer) {
            const range = document.createRange();
            range.selectNodeContents(contentContainer);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            
            try {
                document.execCommand('copy');
                selection.removeAllRanges();
                showToast('Sub clause copied to clipboard', 'success');
            } catch (err) {
                console.error('Failed to copy:', err);
                showToast('Failed to copy sub clause', 'error');
            }
        }
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
        const container = document.getElementById('library-list-container');
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
        const container = document.getElementById('library-list-container');
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
