# OnlyOffice Plugin Data Setup Guide

This guide explains how to properly set up and use plugin data (access tokens, contract IDs, etc.) instead of hardcoded values.

## Overview

The OnlyOffice plugin receives initialization data from the backend when it loads. This data includes:
- `contractId` - The contract being edited
- `accessToken` - User's authentication token
- `userId` - Current user's ID
- `organizationId` - User's organization ID
- `backendUrl` - Backend API base URL
- `permissions` - Feature permissions object

## 1. Backend Setup (How Data is Passed)

### Location: `contract-backend/src/app/services/onlyOfficeService.js`

The backend passes plugin data through OnlyOffice's `pluginsData` configuration:

```javascript
editorConfig: {
    plugins: {
        autostart: ['asc.{9DC93CDB-B576-4F0C-B55E-FCC9C48DD007}'],
        pluginsData: [
            `${process.env.ONLYOFFICE_SERVER_URL}/plugins/openai/config.json`,
            JSON.stringify({
                contractId: contractId,
                accessToken: req.headers['x-auth-token'] || req.headers['authorization']?.replace('Bearer ', '') || '',
                userId: userId,
                organizationId: organizationId,
                backendUrl: process.env.BACKEND_BASE_URL ? `${process.env.BACKEND_BASE_URL}/api` : '',
                permissions: {
                    summary: true,
                    clauses: true,
                    obligations: true,
                    playbook: true,
                    chat: true,
                    approval: true,
                    library: true
                }
            })
        ]
    }
}
```

**Key Points:**
- The data is passed as a JSON string in the `pluginsData` array
- Access token is extracted from request headers (`x-auth-token` or `Authorization`)
- Backend URL is constructed from environment variable
- Permissions control which features are visible

## 2. Plugin Setup (How Data is Received)

### Location: `onlyoffice-plugins/{9DC93CDB-B576-4F0C-B55E-FCC9C48DD007}/scripts/main.js`

The plugin receives data in the `init` function:

```javascript
window.Asc.plugin.init = function() {
    // Get plugin initialization data (passed from backend)
    const initData = window.Asc.plugin.info.initData;
    if (initData) {
        try {
            const data = typeof initData === 'string' ? JSON.parse(initData) : initData;
            // Merge initData with defaults (initData takes precedence)
            window.pluginData = {
                contractId: data.contractId || window.pluginData.contractId,
                accessToken: data.accessToken || window.pluginData.accessToken,
                userId: data.userId || window.pluginData.userId,
                organizationId: data.organizationId || window.pluginData.organizationId,
                backendUrl: data.backendUrl || window.pluginData.backendUrl,
                permissions: data.permissions || window.pluginData.permissions
            };
        } catch (e) {
            console.error('Error parsing plugin init data:', e);
        }
    }
};
```

## 3. Removing Hardcoded Values

### Current Problem

The plugin has hardcoded fallback values in `getPluginData()`:

```javascript
// ❌ BAD - Hardcoded values
window.getPluginData = function() {
    if (!window.pluginData || Object.keys(window.pluginData).length === 0) {
        window.pluginData = {
            contractId: '6970839dcf5e285074cf9bfb',  // Hardcoded!
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',  // Hardcoded!
            userId: '68e60d2de8a6a1a17b0c37be',  // Hardcoded!
            organizationId: '62a1a01cac0059883db40891',  // Hardcoded!
            backendUrl: 'https://contract-backend-dev.legistrak.com/api',  // Hardcoded!
            permissions: {}
        };
    }
    return window.pluginData;
};
```

### Solution: Remove Hardcoded Fallbacks

Replace with proper error handling:

```javascript
// ✅ GOOD - No hardcoded values
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
```

### Update Default Values in `init` Function

Also update the initial default values:

```javascript
// Store plugin data with empty defaults (will be populated from backend)
window.pluginData = {
    contractId: null,
    accessToken: null,
    userId: null,
    organizationId: null,
    backendUrl: null,
    permissions: {}
};
```

## 4. Using Plugin Data in API Calls

### Helper Functions

The plugin provides helper functions to access data:

```javascript
// Get all plugin data
const pluginData = window.getPluginData();

// Get specific values
const accessToken = window.getAccessToken();
const backendUrl = window.getBackendUrl();
const contractId = window.getContractId();
const frontendOrigin = window.getFrontendOrigin();
```

### Example: Making API Calls

**✅ Correct Way:**

```javascript
async function fetchSummary() {
    const pluginData = window.getPluginData();
    const backendUrl = window.getBackendUrl();
    const accessToken = window.getAccessToken();
    
    // Validate required data
    if (!pluginData.contractId || !accessToken) {
        console.error('Missing required plugin data');
        return;
    }
    
    const url = `${backendUrl}/ai-assistant/fetch-Summary-Clause?contractId=${pluginData.contractId}`;
    const response = await fetch(url, {
        headers: {
            'x-auth-token': accessToken,
            'Content-Type': 'application/json'
        }
    });
    
    // Handle response...
}
```

**❌ Wrong Way (Hardcoded):**

```javascript
async function fetchSummary() {
    // Don't hardcode values!
    const url = 'https://contract-backend-dev.legistrak.com/api/ai-assistant/fetch-Summary-Clause?contractId=6970839dcf5e285074cf9bfb';
    const response = await fetch(url, {
        headers: {
            'x-auth-token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',  // Hardcoded!
            'Content-Type': 'application/json'
        }
    });
}
```

## 5. Files That Need Updates

### Files Currently Using Hardcoded Values:

1. **`scripts/main.js`** (Lines 6-13, 785-795)
   - Remove hardcoded default values
   - Update `getPluginData()` to not return hardcoded fallbacks

2. **`scripts/summary.js`**
   - Already uses `getPluginData()` correctly ✅
   - Verify all API calls use helper functions

3. **`scripts/clauses.js`**
   - Already uses `getPluginData()` correctly ✅
   - Verify all API calls use helper functions

4. **`scripts/obligations.js`**
   - Already uses `getPluginData()` correctly ✅
   - Verify all API calls use helper functions

5. **`scripts/playbook.js`**
   - Already uses `getPluginData()` correctly ✅
   - Verify all API calls use helper functions

6. **`scripts/library.js`**
   - Already uses `getPluginData()` correctly ✅
   - Verify all API calls use helper functions

7. **`scripts/askAI.js`**
   - Already uses `getPluginData()` correctly ✅
   - Verify all API calls use helper functions

## 6. Validation and Error Handling

### Add Validation in `init` Function

```javascript
window.Asc.plugin.init = function() {
    console.log('AI Contract Assistant Plugin initialized');
    
    const initData = window.Asc.plugin.info.initData;
    if (initData) {
        try {
            const data = typeof initData === 'string' ? JSON.parse(initData) : initData;
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
                // Show user-friendly error
                showPluginError(`Missing required configuration: ${missing.join(', ')}`);
            }
            
            applyPermissions(window.pluginData.permissions || {});
        } catch (e) {
            console.error('Error parsing plugin init data:', e);
            showPluginError('Failed to initialize plugin. Please refresh the page.');
        }
    } else {
        console.error('No plugin initialization data provided');
        showPluginError('Plugin configuration missing. Please contact support.');
    }
    
    // Rest of initialization...
};

function showPluginError(message) {
    // Display error message in plugin UI
    const errorDiv = document.createElement('div');
    errorDiv.className = 'plugin-error';
    errorDiv.style.cssText = 'padding: 20px; background: #fee; color: #c33; border: 1px solid #fcc; margin: 10px;';
    errorDiv.textContent = message;
    document.body.insertBefore(errorDiv, document.body.firstChild);
}
```

## 7. Testing

### Test with Real Data

1. **Backend Test:**
   - Verify backend passes all required fields in `pluginsData`
   - Check that access token is correctly extracted from headers
   - Verify backend URL is correctly constructed

2. **Plugin Test:**
   - Open browser console when plugin loads
   - Check `window.pluginData` object has all required fields
   - Verify no hardcoded values are being used
   - Test API calls work with real data

### Debugging

Add logging to verify data flow:

```javascript
window.Asc.plugin.init = function() {
    const initData = window.Asc.plugin.info.initData;
    console.log('Raw initData:', initData);
    
    if (initData) {
        const data = typeof initData === 'string' ? JSON.parse(initData) : initData;
        console.log('Parsed plugin data:', {
            hasContractId: !!data.contractId,
            hasAccessToken: !!data.accessToken,
            hasUserId: !!data.userId,
            hasOrganizationId: !!data.organizationId,
            hasBackendUrl: !!data.backendUrl,
            backendUrl: data.backendUrl
        });
    }
};
```

## 8. Summary Checklist

- [ ] Remove all hardcoded values from `main.js`
- [ ] Update `getPluginData()` to not return hardcoded fallbacks
- [ ] Add validation in `init` function
- [ ] Add error handling for missing data
- [ ] Verify all API calls use helper functions
- [ ] Test with real backend data
- [ ] Remove any console.log statements with hardcoded values
- [ ] Document any environment-specific configurations

## 9. Environment Variables

The backend uses these environment variables:

- `BACKEND_BASE_URL` - Base URL for backend API
- `ONLYOFFICE_SERVER_URL` - OnlyOffice server URL
- `ONLY_OFFICE_JWT_SECRET` - JWT secret for signing

Make sure these are set correctly in your backend environment.

## 10. Security Notes

⚠️ **Important Security Considerations:**

1. **Access Token:**
   - Never log access tokens in console
   - Never expose tokens in error messages
   - Tokens are passed securely from backend to plugin

2. **Data Validation:**
   - Always validate data before making API calls
   - Check for null/undefined values
   - Handle missing data gracefully

3. **CORS:**
   - Backend must allow requests from OnlyOffice domain
   - Check CORS configuration in backend

## Questions?

If you encounter issues:
1. Check browser console for errors
2. Verify backend is passing data correctly
3. Check network tab for API call failures
4. Verify environment variables are set correctly
