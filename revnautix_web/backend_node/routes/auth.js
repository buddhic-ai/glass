const express = require('express');
const router = express.Router();
const authService = require('../../../src/features/common/services/authService');
const { ipcRequest } = require('../ipcBridge');

router.get('/status', async (req, res) => {
    try {
        const user = await ipcRequest(req, 'get-user-profile');
        if (!user) {
            return res.status(500).json({ error: 'Default user not initialized' });
        }
        res.json({ 
            authenticated: true, 
            user: {
                id: user.uid,
                name: user.display_name
            }
        });
    } catch (error) {
        console.error('Failed to get auth status via IPC:', error);
        res.status(500).json({ error: 'Failed to retrieve auth status' });
    }
});

router.post('/complete', express.json(), async (req, res) => {
  try {
    const token = req.body && (req.body.token || req.body.access_token);
    if (!token) return res.status(400).json({ success: false, error: 'Missing token' });
    const result = await authService.saveHostedToken(token);
    return res.json({ success: !!result.success });
  } catch (e) {
    console.error('[Node API] /auth/complete error:', e.message);
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

module.exports = router;
