const { BrowserWindow } = require('electron');
const fetch = require('node-fetch');
const encryptionService = require('./encryptionService');
const sessionRepository = require('../repositories/session');
const providerSettingsRepository = require('../repositories/providerSettings');
const permissionService = require('./permissionService');


class AuthService {
    constructor() {
        this.currentUserId = 'default_user';
        this.currentUserMode = 'local';
        this.currentUser = null;
        this.isInitialized = false;

        // This ensures the key is ready before any login/logout state change.
        this.initializationPromise = null;

        sessionRepository.setAuthService(this);
    }

    initialize() {
        if (this.isInitialized) return this.initializationPromise;

        this.initializationPromise = Promise.resolve();
        this.isInitialized = true;
        console.log('[AuthService] Initialized (local-only).');
        return this.initializationPromise;

        return this.initializationPromise;
    }

    // Hosted auth (Supabase) is managed in the web; Electron remains local-only

    async signOut() {
        try {
            await sessionRepository.endAllActiveSessions();
            this.currentUser = null;
            this.currentUserId = 'default_user';
            this.currentUserMode = 'local';
            encryptionService.resetSessionKey();
            this.broadcastUserState();
        } catch (error) {
            console.error('[AuthService] Error signing out:', error);
        }
    }
    
    broadcastUserState() {
        const userState = this.getCurrentUser();
        console.log('[AuthService] Broadcasting user state change:', userState);
        BrowserWindow.getAllWindows().forEach(win => {
            if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
                win.webContents.send('user-state-changed', userState);
            }
        });
    }

    getCurrentUserId() {
        return this.currentUserId;
    }

    getCurrentUser() {
        const isLoggedIn = false;

        if (isLoggedIn) {
            return {
                uid: this.currentUser.uid,
                email: this.currentUser.email,
                displayName: this.currentUser.displayName,
                mode: 'local',
                isLoggedIn: true
            };
        }
        return {
            uid: this.currentUserId, // returns 'default_user'
            email: 'contact@revnautix.com',
            displayName: 'Default User',
            mode: 'local',
            isLoggedIn: false
        };
    }
}

const authService = new AuthService();
module.exports = authService; 