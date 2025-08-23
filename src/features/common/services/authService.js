const { BrowserWindow } = require('electron');
const fetch = require('node-fetch');
const encryptionService = require('./encryptionService');
const sessionRepository = require('../repositories/session');
const providerSettingsRepository = require('../repositories/providerSettings');
const permissionService = require('./permissionService');
let keytar;
try {
    keytar = require('keytar');
} catch (_) {
    keytar = null;
}


class AuthService {
    constructor() {
        this.currentUserId = 'default_user';
        this.currentUserMode = 'local';
        this.currentUser = null;
        this.isInitialized = false;
        this.hostedJwtToken = null; // In-memory cache

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

    async saveHostedToken(token) {
        try {
            this.hostedJwtToken = token || null;
            if (keytar && token) {
                await keytar.setPassword('GlassJWT', 'winloss', token);
            }
            if (!token && keytar) {
                try { await keytar.deletePassword('GlassJWT', 'winloss'); } catch (_) {}
            }
            // reflect logged-in state for UI, but keep mode visibility minimal
            if (token) {
                this.currentUserMode = 'hosted';
                this.currentUser = { uid: 'hosted', email: '', displayName: 'Hosted User' };
            } else {
                this.currentUserMode = 'local';
                this.currentUser = null;
            }
            this.broadcastUserState();
            return { success: true };
        } catch (error) {
            console.error('[AuthService] Failed to save hosted token:', error);
            return { success: false, error: error.message };
        }
    }

    async getHostedToken() {
        if (this.hostedJwtToken) return this.hostedJwtToken;
        if (keytar) {
            try {
                const t = await keytar.getPassword('GlassJWT', 'winloss');
                this.hostedJwtToken = t || null;
                return this.hostedJwtToken;
            } catch (e) {
                console.warn('[AuthService] Unable to read hosted token from keytar:', e.message);
            }
        }
        return null;
    }

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
        const isLoggedIn = this.currentUserMode === 'hosted' && !!this.hostedJwtToken;

        if (isLoggedIn) {
            return {
                uid: this.currentUser?.uid || 'hosted',
                email: this.currentUser?.email || '',
                displayName: this.currentUser?.displayName || 'Hosted User',
                mode: 'hosted',
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