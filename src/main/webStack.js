const path = require('node:path');
const express = require('express');
const { app } = require('electron');

async function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = require('net').createServer();
    server.listen(0, (err) => {
      if (err) reject(err);
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function startWebStack(eventBridge) {
  console.log('NODE_ENV =', process.env.NODE_ENV);
  const apiPort = await getAvailablePort();
  const externalWebUrl = (process.env.revnautix_WEB_URL || process.env.pickleglass_WEB_URL) && (process.env.revnautix_WEB_URL || process.env.pickleglass_WEB_URL).startsWith('http')
    ? (process.env.revnautix_WEB_URL || process.env.pickleglass_WEB_URL)
    : null;
  const frontendPort = externalWebUrl ? (new URL(externalWebUrl).port || '3000') : await getAvailablePort();

  console.log(`🔧 Allocated ports: API=${apiPort}, Frontend=${frontendPort}`);

  process.env.revnautix_API_PORT = apiPort.toString();
  process.env.revnautix_API_URL = `http://localhost:${apiPort}`;
  process.env.revnautix_WEB_PORT = frontendPort.toString();
  if (!externalWebUrl) {
    process.env.revnautix_WEB_URL = `http://localhost:${frontendPort}`;
  } else {
    process.env.revnautix_WEB_URL = externalWebUrl;
  }

  console.log(`🌍 Environment variables set:`, {
    revnautix_API_URL: process.env.revnautix_API_URL,
    revnautix_WEB_URL: process.env.revnautix_WEB_URL
  });

  // Build our own lightweight API in main process (no dependency on revnautix_web)

  const staticDir = app.isPackaged
    ? path.join(process.resourcesPath, 'out')
    : path.join(__dirname, '..', '..', 'revnautix_web', 'out');

  const fs = require('fs');

  if (!externalWebUrl && !fs.existsSync(staticDir)) {
    console.error('============================================================');
    console.error('[ERROR] Frontend build directory not found!');
    console.error(`Path: ${staticDir}`);
    console.error("Please run 'pnpm run build' inside the 'revnautix_web' directory first.");
    console.error('============================================================');
    app.quit();
    return;
  }

  const runtimeConfig = {
    API_URL: `http://localhost:${apiPort}`,
    WEB_URL: `http://localhost:${frontendPort}`,
    timestamp: Date.now()
  };
  const tempDir = app.getPath('temp');
  const configPath = path.join(tempDir, 'runtime-config.json');
  fs.writeFileSync(configPath, JSON.stringify(runtimeConfig, null, 2));
  console.log(`📝 Runtime config created in temp location: ${configPath}`);

  if (externalWebUrl) {
    console.log(`🟡 Using external web dev server at ${externalWebUrl} (hot reload enabled)`);
    console.log(`✅ API server will start on http://localhost:${apiPort}`);
    return parseInt(frontendPort, 10);
  }

  const frontSrv = express();

  frontSrv.get('/runtime-config.json', (req, res) => {
    res.sendFile(configPath);
  });

  frontSrv.use((req, res, next) => {
    if (req.path.indexOf('.') === -1 && req.path !== '/') {
      const htmlPath = path.join(staticDir, req.path + '.html');
      if (fs.existsSync(htmlPath)) {
        return res.sendFile(htmlPath);
      }
    }
    next();
  });
  
  frontSrv.use(express.static(staticDir));

  await new Promise((resolve, reject) => {
    const server = frontSrv.listen(frontendPort, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
    app.once('before-quit', () => server.close());
  });
  console.log(`✅ Frontend server started on http://localhost:${frontendPort}`);

  const apiSrv = express();
  // CORS for loopback from WinLoss-Test on 4000
  apiSrv.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });
  apiSrv.use(express.json());
  apiSrv.get('/api/health', (req, res) => res.json({ ok: true }));
  apiSrv.post('/api/auth/complete', async (req, res) => {
    try {
      const token = req.body && (req.body.token || req.body.access_token);
      if (!token) return res.status(400).json({ success: false, error: 'Missing token' });
      const authService = require('../features/common/services/authService');
      const result = await authService.saveHostedToken(token);
      return res.json({ success: !!result.success });
    } catch (e) {
      console.error('[Main API] /api/auth/complete error:', e.message);
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  });
  await new Promise((resolve, reject) => {
    const server = apiSrv.listen(apiPort, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
    app.once('before-quit', () => server.close());
  });
  console.log(`✅ API server started on http://localhost:${apiPort}`);

  console.log(`🚀 All services ready:\n  Frontend: http://localhost:${frontendPort}\n  API:      http://localhost:${apiPort}`);
  return frontendPort;
}

module.exports = { startWebStack };


