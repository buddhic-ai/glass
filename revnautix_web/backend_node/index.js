const express = require('express');
const cors = require('cors');
// const db = require('./db'); // No longer needed
const { identifyUser } = require('./middleware/auth');

function createApp(eventBridge) {
    const app = express();

    const webUrl = process.env.revnautix_WEB_URL || process.env.pickleglass_WEB_URL || 'http://localhost:3000';
    const allowedOrigins = [
        webUrl,
        'http://localhost:4000',
        'http://127.0.0.1:4000'
    ];
    console.log(`🔧 Backend CORS configured for:`, allowedOrigins);

    app.use(cors({
        origin: function(origin, callback) {
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            return callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
        optionsSuccessStatus: 200
    }));

    app.use(express.json());

    app.get('/', (req, res) => {
        res.json({ message: "Revnautix API is running" });
    });

    app.use((req, res, next) => {
        req.bridge = eventBridge;
        next();
    });

    app.use('/api', identifyUser);

    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/user', require('./routes/user'));
    app.use('/api/conversations', require('./routes/conversations'));
    app.use('/api/presets', require('./routes/presets'));
    app.use('/api/settings', require('./routes/settings'));

    app.get('/api/sync/status', (req, res) => {
        res.json({
            status: 'online',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    });

    app.post('/api/desktop/set-user', (req, res) => {
        res.json({
            success: true,
            message: "Direct IPC communication is now used. This endpoint is deprecated.",
            user: req.body,
            deprecated: true
        });
    });

    app.get('/api/desktop/status', (req, res) => {
        res.json({
            connected: true,
            current_user: null,
            communication_method: "IPC",
            file_based_deprecated: true
        });
    });

    return app;
}

module.exports = createApp;
