const { dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

async function initAutoUpdater() {
  if (process.env.NODE_ENV === 'development') {
    console.log('Development environment, skipping auto-updater.');
    return;
  }
  try {
    await autoUpdater.checkForUpdates();
    autoUpdater.on('update-available', () => {
      console.log('Update available!');
      autoUpdater.downloadUpdate();
    });
    autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName, date, url) => {
      console.log('Update downloaded:', releaseNotes, releaseName, date, url);
      dialog.showMessageBox({
        type: 'info',
        title: 'Application Update',
        message: `A new version of Revnautix (${releaseName}) has been downloaded. It will be installed the next time you launch the application.`,
        buttons: ['Restart', 'Later']
      }).then(response => {
        if (response.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });
    autoUpdater.on('error', (err) => {
      console.error('Error in auto-updater:', err);
    });
  } catch (err) {
    console.error('Error initializing auto-updater:', err);
  }
}

module.exports = { initAutoUpdater };


