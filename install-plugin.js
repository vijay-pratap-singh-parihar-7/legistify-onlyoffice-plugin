/**
 * OnlyOffice Plugin Installation Helper Script
 * 
 * Copy and paste this into your browser console when the OnlyOffice editor is loaded.
 * Or save as a bookmarklet for easy access.
 * 
 * Usage:
 * 1. Open OnlyOffice editor in browser
 * 2. Wait for editor to fully load (5-10 seconds)
 * 3. Open Browser Console (F12)
 * 4. Copy and paste this entire script
 * 5. Press Enter
 */

(function() {
    'use strict';
    
    const PLUGIN_URL = 'http://localhost:8080/config.json';
    
    // Function to check if OnlyOffice API is available
    function checkAPI() {
        console.log('Checking OnlyOffice API availability...');
        
        if (typeof window.Asc === 'undefined') {
            console.error('❌ window.Asc is not defined');
            return false;
        }
        
        if (typeof window.Asc.editor === 'undefined') {
            console.error('❌ window.Asc.editor is not defined');
            return false;
        }
        
        if (typeof window.Asc.editor.installDeveloperPlugin === 'undefined') {
            console.error('❌ window.Asc.editor.installDeveloperPlugin is not defined');
            console.log('Available methods:', Object.keys(window.Asc.editor));
            return false;
        }
        
        console.log('✅ OnlyOffice API is available!');
        return true;
    }
    
    // Function to install plugin
    function installPlugin() {
        if (!checkAPI()) {
            console.error('Cannot install plugin: API not available');
            console.log('\n💡 Tips:');
            console.log('1. Make sure the OnlyOffice editor is fully loaded');
            console.log('2. Wait 5-10 seconds after page load');
            console.log('3. Make sure you are in the editor context (not parent page)');
            console.log('4. Try refreshing the page and running this script again');
            console.log('\n💡 Alternative: Configure plugin directly in backend (see QUICK_START.md)');
            return false;
        }
        
        try {
            console.log('Installing plugin from:', PLUGIN_URL);
            window.Asc.editor.installDeveloperPlugin(PLUGIN_URL);
            console.log('✅ Plugin installation initiated!');
            console.log('Refresh the page to see the plugin.');
            return true;
        } catch (error) {
            console.error('❌ Error installing plugin:', error);
            return false;
        }
    }
    
    // Try to install immediately
    if (installPlugin()) {
        console.log('\n✅ Success! Plugin should be installed.');
    } else {
        console.log('\n⏳ API not ready. Waiting 3 seconds and retrying...');
        
        setTimeout(function() {
            if (installPlugin()) {
                console.log('\n✅ Success! Plugin should be installed.');
            } else {
                console.log('\n❌ Still not available. Try:');
                console.log('1. Wait longer (10+ seconds)');
                console.log('2. Use Option A in QUICK_START.md (direct backend configuration)');
            }
        }, 3000);
    }
})();
