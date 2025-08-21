const express = require('express');
const router = express.Router();
const { ipcRequest } = require('../ipcBridge');

router.get('/whisper', async (req, res) => {
  try {
    const status = await ipcRequest(req, 'settings:whisper:status');
    res.json(status);
  } catch (error) {
    console.error('Failed to get whisper status via IPC:', error);
    res.status(500).json({ error: 'Failed to get whisper status' });
  }
});

router.post('/whisper/enable', async (req, res) => {
  try {
    await ipcRequest(req, 'settings:whisper:enable');
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to enable whisper via IPC:', error);
    res.status(500).json({ error: 'Failed to enable whisper' });
  }
});

router.post('/whisper/disable', async (req, res) => {
  try {
    await ipcRequest(req, 'settings:whisper:disable');
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to disable whisper via IPC:', error);
    res.status(500).json({ error: 'Failed to disable whisper' });
  }
});

module.exports = router;


