const { app, BrowserWindow } = require('electron');

let pendingDeepLinkUrl = null;

function focusMainWindow() {
    try {
        const { windowPool } = require('../window/windowManager');
        if (windowPool) {
            const header = windowPool.get('header');
            if (header && !header.isDestroyed()) {
                if (header.isMinimized()) header.restore();
                header.focus();
                return true;
            }
        }
    } catch (_) {}

    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        const mainWindow = windows[0];
        if (!mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            return true;
        }
    }
    return false;
}

function setupProtocolHandling(onUrl) {
    try {
        const currentScheme = app.isDefaultProtocolClient('revnautix') ? 'revnautix' : null;
        if (!currentScheme) {
            const success = app.setAsDefaultProtocolClient('revnautix');
            if (success) {
                console.log('[Protocol] Successfully set as default protocol client for revnautix://');
            } else {
                console.warn('[Protocol] Failed to set as default protocol client - this may affect deep linking');
            }
        } else {
            console.log(`[Protocol] Already registered as default protocol client for ${currentScheme}://`);
        }
    } catch (error) {
        console.error('[Protocol] Error during protocol registration:', error);
    }

    app.on('second-instance', (event, commandLine) => {
        console.log('[Protocol] Second instance command line:', commandLine);
        focusMainWindow();
        for (const arg of commandLine) {
            if (arg && typeof arg === 'string' && arg.startsWith('revnautix://')) {
                const cleanUrl = arg.replace(/[\\₩]/g, '');
                if (process.platform === 'win32') {
                    if (!cleanUrl.includes(':') || cleanUrl.indexOf('://') === cleanUrl.lastIndexOf(':')) {
                        onUrl(cleanUrl);
                        break;
                    }
                } else {
                    onUrl(cleanUrl);
                    break;
                }
            }
        }
    });

    app.on('open-url', (event, url) => {
        event.preventDefault();
        console.log('[Protocol] Received URL via open-url:', url);
        if (!url || !url.startsWith('revnautix://')) {
            console.warn('[Protocol] Invalid URL format:', url);
            return;
        }
        if (app.isReady()) {
            onUrl(url);
        } else {
            pendingDeepLinkUrl = url;
            console.log('[Protocol] App not ready, storing URL for later');
        }
    });

    if (process.platform === 'win32') {
        for (const arg of process.argv) {
            if (arg && typeof arg === 'string' && arg.startsWith('revnautix://')) {
                const cleanUrl = arg.replace(/[\\₩]/g, '');
                if (!cleanUrl.includes(':') || cleanUrl.indexOf('://') === cleanUrl.lastIndexOf(':')) {
                    console.log('[Protocol] Found protocol URL in initial arguments:', cleanUrl);
                    pendingDeepLinkUrl = cleanUrl;
                    break;
                }
            }
        }
        console.log('[Protocol] Initial process.argv:', process.argv);
    }
}

function getPendingDeepLinkUrl() {
    return pendingDeepLinkUrl;
}

function clearPendingDeepLinkUrl() {
    pendingDeepLinkUrl = null;
}

module.exports = { setupProtocolHandling, focusMainWindow, getPendingDeepLinkUrl, clearPendingDeepLinkUrl };


