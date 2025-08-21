// try {
//     const reloader = require('electron-reloader');
//     reloader(module, {
//     });
// } catch (err) {
// }

require('dotenv').config();

if (require('electron-squirrel-startup')) {
    process.exit(0);
}

const { app, BrowserWindow, shell, ipcMain, dialog, desktopCapturer, session } = require('electron');
const { createWindows } = require('./window/windowManager.js');
const { setupProtocolHandling, getPendingDeepLinkUrl, clearPendingDeepLinkUrl } = require('./main/protocol');
const { startWebStack } = require('./main/webStack');
const { setupWebDataHandlers } = require('./main/webDataHandlers');
const { initAutoUpdater } = require('./main/autoUpdater');
const listenService = require('./features/listen/listenService');
const databaseInitializer = require('./features/common/services/databaseInitializer');
const authService = require('./features/common/services/authService');
const path = require('node:path');
const express = require('express');
const fetch = require('node-fetch');
const { autoUpdater } = require('electron-updater');
const { EventEmitter } = require('events');
const askService = require('./features/ask/askService');
const settingsService = require('./features/settings/settingsService');
const sessionRepository = require('./features/common/repositories/session');
const modelStateService = require('./features/common/services/modelStateService');
const featureBridge = require('./bridge/featureBridge');
const windowBridge = require('./bridge/windowBridge');

// Global variables
const eventBridge = new EventEmitter();
let WEB_PORT = 3000;
let isShuttingDown = false; // Flag to prevent infinite shutdown loop

//////// after_modelStateService ////////
global.modelStateService = modelStateService;
//////// after_modelStateService ////////

// Import and initialize OllamaService
const ollamaService = require('./features/common/services/ollamaService');
const ollamaModelRepository = require('./features/common/repositories/ollamaModel');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
    process.exit(0);
}

// setup protocol after single instance lock
setupProtocolHandling(handleCustomUrl);

app.whenReady().then(async () => {

    // Setup native loopback audio capture for Windows
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
            // Grant access to the first screen found with loopback audio
            callback({ video: sources[0], audio: 'loopback' });
        }).catch((error) => {
            console.error('Failed to get desktop capturer sources:', error);
            callback({});
        });
    });

    // Initialize core services
    
    try {
        await databaseInitializer.initialize();
        console.log('>>> [index.js] Database initialized successfully');
        
        // Clean up zombie sessions from previous runs first - MOVED TO authService
        // sessionRepository.endAllActiveSessions();

        await authService.initialize();

        //////// after_modelStateService ////////
        await modelStateService.initialize();
        //////// after_modelStateService ////////

        featureBridge.initialize();  // 추가: featureBridge 초기화
        windowBridge.initialize();
        setupWebDataHandlers(eventBridge);

        // Initialize Ollama models in database
        await ollamaModelRepository.initializeDefaultModels();

        // Auto warm-up selected Ollama model in background (non-blocking)
        setTimeout(async () => {
            try {
                console.log('[index.js] Starting background Ollama model warm-up...');
                await ollamaService.autoWarmUpSelectedModel();
            } catch (error) {
                console.log('[index.js] Background warm-up failed (non-critical):', error.message);
            }
        }, 2000); // Wait 2 seconds after app start

        // Start web server and create windows ONLY after all initializations are successful
        WEB_PORT = await startWebStack(eventBridge);
        console.log('Web front-end listening on', WEB_PORT);
        
        createWindows();

    } catch (err) {
        console.error('>>> [index.js] Database initialization failed - some features may not work', err);
        // Optionally, show an error dialog to the user
        dialog.showErrorBox(
            'Application Error',
            'A critical error occurred during startup. Some features might be disabled. Please restart the application.'
        );
    }

    // initAutoUpdater should be called after auth is initialized
    initAutoUpdater();

    // Process any pending deep link after everything is initialized
    const p = getPendingDeepLinkUrl();
    if (p) {
        console.log('[Protocol] Processing pending URL:', p);
        handleCustomUrl(p);
        clearPendingDeepLinkUrl();
    }
});

app.on('before-quit', async (event) => {
    // Prevent infinite loop by checking if shutdown is already in progress
    if (isShuttingDown) {
        console.log('[Shutdown] 🔄 Shutdown already in progress, allowing quit...');
        return;
    }
    
    console.log('[Shutdown] App is about to quit. Starting graceful shutdown...');
    
    // Set shutdown flag to prevent infinite loop
    isShuttingDown = true;
    
    // Prevent immediate quit to allow graceful shutdown
    event.preventDefault();
    
    try {
        // 1. Stop audio capture first (immediate)
        await listenService.closeSession();
        console.log('[Shutdown] Audio capture stopped');
        
        // 2. End all active sessions (database operations) - with error handling
        try {
            await sessionRepository.endAllActiveSessions();
            console.log('[Shutdown] Active sessions ended');
        } catch (dbError) {
            console.warn('[Shutdown] Could not end active sessions (database may be closed):', dbError.message);
        }
        
        // 3. Shutdown Ollama service (potentially time-consuming)
        console.log('[Shutdown] shutting down Ollama service...');
        const ollamaShutdownSuccess = await Promise.race([
            ollamaService.shutdown(false), // Graceful shutdown
            new Promise(resolve => setTimeout(() => resolve(false), 8000)) // 8s timeout
        ]);
        
        if (ollamaShutdownSuccess) {
            console.log('[Shutdown] Ollama service shut down gracefully');
        } else {
            console.log('[Shutdown] Ollama shutdown timeout, forcing...');
            // Force shutdown if graceful failed
            try {
                await ollamaService.shutdown(true);
            } catch (forceShutdownError) {
                console.warn('[Shutdown] Force shutdown also failed:', forceShutdownError.message);
            }
        }
        
        // 4. Close database connections (final cleanup)
        try {
            databaseInitializer.close();
            console.log('[Shutdown] Database connections closed');
        } catch (closeError) {
            console.warn('[Shutdown] Error closing database:', closeError.message);
        }
        
        console.log('[Shutdown] Graceful shutdown completed successfully');
        
    } catch (error) {
        console.error('[Shutdown] Error during graceful shutdown:', error);
        // Continue with shutdown even if there were errors
    } finally {
        // Actually quit the app now
        console.log('[Shutdown] Exiting application...');
        app.exit(0); // Use app.exit() instead of app.quit() to force quit
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindows();
    }
});


async function handleCustomUrl(url) {
    try {
        console.log('[Custom URL] Processing URL:', url);
        
        // Validate and clean URL
        if (!url || typeof url !== 'string' || !url.startsWith('revnautix://')) {
            console.error('[Custom URL] Invalid URL format:', url);
            return;
        }
        
        // Clean up URL by removing problematic characters
        const cleanUrl = url.replace(/[\\₩]/g, '');
        
        // Additional validation
        if (cleanUrl !== url) {
            console.log('[Custom URL] Cleaned URL from:', url, 'to:', cleanUrl);
            url = cleanUrl;
        }
        
        const urlObj = new URL(url);
        const action = urlObj.hostname;
        const params = Object.fromEntries(urlObj.searchParams);
        
        console.log('[Custom URL] Action:', action, 'Params:', params);

        switch (action) {
            case 'login':
                // No-op: Web handles Supabase auth directly
                break;
            case 'personalize':
                handlePersonalizeFromUrl(params);
                break;
            default:
                const { windowPool } = require('./window/windowManager.js');
                const header = windowPool.get('header');
                if (header) {
                    if (header.isMinimized()) header.restore();
                    header.focus();
                    
                    const targetUrl = `http://localhost:${WEB_PORT}/${action}`;
                    console.log(`[Custom URL] Navigating webview to: ${targetUrl}`);
                    header.webContents.loadURL(targetUrl);
                }
        }

    } catch (error) {
        console.error('[Custom URL] Error parsing URL:', error);
    }
}


function handlePersonalizeFromUrl(params) {
    console.log('[Custom URL] Personalize params:', params);
    
    const { windowPool } = require('./window/windowManager.js');
    const header = windowPool.get('header');
    
    if (header) {
        if (header.isMinimized()) header.restore();
        header.focus();
        
        const personalizeUrl = `http://localhost:${WEB_PORT}/personalize?desktop=true`;
        console.log(`[Custom URL] Opening standalone personalize window: ${personalizeUrl}`);
        const { openPersonalizeWindow } = require('./window/windowManager.js');
        openPersonalizeWindow();
        
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('enter-personalize-mode', {
                message: 'Personalization mode activated',
                params: params
            });
        });
    } else {
        console.error('[Custom URL] Header window not found for personalize');
    }
}


