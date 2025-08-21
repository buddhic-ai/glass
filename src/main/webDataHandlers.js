function setupWebDataHandlers(eventBridge) {
  const sessionRepository = require('../features/common/repositories/session');
  const sttRepository = require('../features/listen/stt/repositories');
  const summaryRepository = require('../features/listen/summary/repositories');
  const askRepository = require('../features/ask/repositories');
  const userRepository = require('../features/common/repositories/user');
  const presetRepository = require('../features/common/repositories/preset');
  const settingsService = require('../features/settings/settingsService');
  const modelStateService = require('../features/common/services/modelStateService');

  const handleRequest = async (channel, responseChannel, payload) => {
    let result;
    try {
      switch (channel) {
        case 'get-sessions':
          result = await sessionRepository.getAllByUserId();
          break;
        case 'get-session-details':
          const session = await sessionRepository.getById(payload);
          if (!session) { result = null; break; }
          const [transcripts, ai_messages, summary] = await Promise.all([
            sttRepository.getAllTranscriptsBySessionId(payload),
            askRepository.getAllAiMessagesBySessionId(payload),
            summaryRepository.getSummaryBySessionId(payload)
          ]);
          result = { session, transcripts, ai_messages, summary };
          break;
        case 'delete-session':
          result = await sessionRepository.deleteWithRelatedData(payload);
          break;
        case 'create-session':
          const id = await sessionRepository.create('ask');
          if (payload && payload.title) {
            await sessionRepository.updateTitle(id, payload.title);
          }
          result = { id };
          break;
        case 'get-user-profile':
          result = await userRepository.getById();
          break;
        case 'update-user-profile':
          result = await userRepository.update(payload);
          break;
        case 'find-or-create-user':
          result = await userRepository.findOrCreate(payload);
          break;
        case 'save-api-key':
          result = await modelStateService.setApiKey(payload.provider, payload.apiKey);
          break;
        case 'check-api-key-status':
          const hasApiKey = await modelStateService.hasValidApiKey();
          result = { hasApiKey };
          break;
        case 'delete-account':
          result = await userRepository.deleteById();
          break;
        case 'get-presets':
          result = await presetRepository.getPresets();
          break;
        case 'create-preset':
          result = await presetRepository.create(payload);
          settingsService.notifyPresetUpdate('created', result.id, payload.title);
          break;
        case 'update-preset':
          result = await presetRepository.update(payload.id, payload.data);
          settingsService.notifyPresetUpdate('updated', payload.id, payload.data.title);
          break;
        case 'delete-preset':
          result = await presetRepository.delete(payload);
          settingsService.notifyPresetUpdate('deleted', payload);
          break;
        case 'settings:whisper:enable':
          result = await modelStateService.setApiKey('whisper', 'local');
          break;
        case 'settings:whisper:disable':
          result = await modelStateService.handleRemoveApiKey('whisper');
          break;
        case 'settings:whisper:status':
          const keys = await modelStateService.getAllApiKeys();
          result = { enabled: !!(keys && keys.whisper) };
          break;
        case 'get-batch-data':
          const includes = payload ? payload.split(',').map(item => item.trim()) : ['profile', 'presets', 'sessions'];
          const promises = {};
          if (includes.includes('profile')) promises.profile = userRepository.getById();
          if (includes.includes('presets')) promises.presets = presetRepository.getPresets();
          if (includes.includes('sessions')) promises.sessions = sessionRepository.getAllByUserId();
          const batchResult = {};
          const promiseResults = await Promise.all(Object.values(promises));
          Object.keys(promises).forEach((key, index) => { batchResult[key] = promiseResults[index]; });
          result = batchResult;
          break;
        default:
          throw new Error(`Unknown web data channel: ${channel}`);
      }
      eventBridge.emit(responseChannel, { success: true, data: result });
    } catch (error) {
      console.error(`Error handling web data request for ${channel}:`, error);
      eventBridge.emit(responseChannel, { success: false, error: error.message });
    }
  };

  eventBridge.on('web-data-request', handleRequest);
}

module.exports = { setupWebDataHandlers };


