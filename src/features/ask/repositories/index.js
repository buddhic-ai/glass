const sqliteRepository = require('./sqlite.repository');
const authService = require('../../common/services/authService');

// The adapter layer that injects the UID
const askRepositoryAdapter = {
    addAiMessage: ({ sessionId, role, content, model }) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.addAiMessage({ uid, sessionId, role, content, model });
    },
    getAllAiMessagesBySessionId: (sessionId) => {
        // This function does not require a UID at the service level.
        return sqliteRepository.getAllAiMessagesBySessionId(sessionId);
    }
};

module.exports = askRepositoryAdapter; 