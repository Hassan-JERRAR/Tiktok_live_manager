const { autoUpdater } = require("electron-updater");
const { dialog, shell } = require("electron");
const EventEmitter = require("events");
const logger = require("../../utils/logger");
const config = require("../../config/app-config");
const updateConfig = require("../../config/update-config");

class UpdateManager extends EventEmitter {
    constructor() {
        super();
        this.updateAvailable = false;
        this.updateDownloaded = false;
        this.mainWindow = null;
        this.setupAutoUpdater();
    }

    static getInstance() {
        if (!UpdateManager.instance) {
            UpdateManager.instance = new UpdateManager();
        }
        return UpdateManager.instance;
    }

    setMainWindow(window) {
        this.mainWindow = window;
    }

    setupAutoUpdater() {
        // Configuration electron-updater uniquement
        autoUpdater.autoDownload = updateConfig.options.autoDownload;
        autoUpdater.autoInstallOnAppQuit = updateConfig.options.autoInstallOnAppQuit;
        
        // Forcer l'architecture correcte sur macOS
        if (process.platform === 'darwin') {
            const arch = process.arch;
            logger.info(`Architecture détectée: ${arch}`);
            
            // Configurer l'URL de mise à jour avec l'architecture
            if (updateConfig.github) {
                const feedURL = `https://github.com/${updateConfig.github.owner}/${updateConfig.github.repo}`;
                autoUpdater.setFeedURL({
                    provider: 'github',
                    owner: updateConfig.github.owner,
                    repo: updateConfig.github.repo,
                    private: updateConfig.github.private || false
                });
            }
        }
        
        // Configuration des logs pour le debug
        autoUpdater.logger = logger;

        // Événements d'auto-updater
        autoUpdater.on("checking-for-update", () => {
            logger.info("Vérification des mises à jour...");
            this.emit("checking-for-update");
        });

        autoUpdater.on("update-available", (info) => {
            logger.info("Mise à jour disponible:", info.version);
            this.updateAvailable = true;
            this.emit("update-available", info);
            this.showUpdateAvailableDialog(info);
        });

        autoUpdater.on("update-not-available", (info) => {
            logger.info("Aucune mise à jour disponible");
            this.emit("update-not-available", info);
        });

        autoUpdater.on("error", (err) => {
            logger.error("Erreur lors de la mise à jour:", err);
            this.emit("update-error", err);
        });

        autoUpdater.on("download-progress", (progressObj) => {
            let logMessage = `Téléchargement: ${progressObj.percent.toFixed(
                2
            )}%`;
            logMessage += ` (${progressObj.transferred}/${progressObj.total})`;
            logger.info(logMessage);
            this.emit("download-progress", progressObj);
            
            // Envoyer le progrès au renderer
            if (this.mainWindow) {
                this.mainWindow.webContents.send('update-download-progress', {
                    percent: progressObj.percent,
                    transferred: progressObj.transferred,
                    total: progressObj.total
                });
            }
        });

        autoUpdater.on("update-downloaded", (info) => {
            logger.info("Mise à jour téléchargée");
            this.updateDownloaded = true;
            this.emit("update-downloaded", info);
            
            // Notifier le renderer que le téléchargement est terminé
            if (this.mainWindow) {
                this.mainWindow.webContents.send('update-downloaded', info);
            }
            
            this.showUpdateDownloadedDialog(info);
        });
    }

    async checkForUpdates(manual = false) {
        try {
            if (manual) {
                logger.info("Vérification manuelle des mises à jour");
            }

            logger.info("Vérification des mises à jour via electron-updater");
            const result = await autoUpdater.checkForUpdates();
            
            if (manual && !result) {
                this.showNoUpdateDialog();
            }
            
            return result ? { updateInfo: result.updateInfo } : { noUpdate: true };
        } catch (error) {
            logger.error("Erreur lors de la vérification des mises à jour:", error);
            if (manual) {
                this.showUpdateErrorDialog(error);
            }
            return { error: error.message };
        }
    }



    downloadUpdate() {
        if (!this.updateAvailable) {
            const error = "Aucune mise à jour disponible pour le téléchargement";
            logger.warn(error);
            return Promise.reject(new Error(error));
        }

        logger.info("Téléchargement de la mise à jour via electron-updater");
        return autoUpdater.downloadUpdate();
    }




    quitAndInstall() {
        if (this.updateDownloaded) {
            logger.info("Installation de la mise à jour et redémarrage");
            autoUpdater.quitAndInstall();
        }
    }


    // Fonction pour comparer les versions (semver)
    compareVersions(version1, version2) {
        const v1parts = version1.split('.').map(Number);
        const v2parts = version2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
            const v1part = v1parts[i] || 0;
            const v2part = v2parts[i] || 0;
            
            if (v1part > v2part) return 1;
            if (v1part < v2part) return -1;
        }
        
        return 0; // Versions identiques
    }

    showUpdateAvailableDialog(info) {
        if (!this.mainWindow) return;

        const options = {
            type: "info",
            title: "Mise à jour disponible",
            message: `Une nouvelle version (${info.version}) est disponible.`,
            detail:
                info.releaseNotes ||
                "Nouvelles fonctionnalités et corrections de bugs.",
            buttons: [
                "Télécharger maintenant",
                "Plus tard",
                "Voir les notes de version",
            ],
            defaultId: 0,
            cancelId: 1,
        };

        dialog.showMessageBox(this.mainWindow, options).then((result) => {
            if (result.response === 0) {
                this.downloadUpdate();
            } else if (result.response === 2) {
                shell.openExternal(
                    `https://github.com/${updateConfig.github.owner}/${updateConfig.github.repo}/releases/tag/v${info.version}`
                );
            }
        });
    }

    showUpdateDownloadedDialog(info) {
        if (!this.mainWindow) return;

        const options = {
            type: "info",
            title: "Mise à jour prête",
            message: `La mise à jour vers la version ${info.version} a été téléchargée avec succès.`,
            detail: "Cliquez sur 'Installer et redémarrer' pour appliquer la mise à jour maintenant, ou fermez cette boîte pour l'installer plus tard.",
            buttons: ["Installer et redémarrer", "Plus tard"],
            defaultId: 0,
            cancelId: 1,
        };

        dialog.showMessageBox(this.mainWindow, options).then((result) => {
            if (result.response === 0) {
                this.quitAndInstall();
            }
        });
    }

    showNoUpdateDialog(updateInfo = null) {
        if (!this.mainWindow) return;

        const currentVersion = require("../../../package.json").version;
        let message = "Vous utilisez déjà la dernière version.";
        
        if (updateInfo && updateInfo.isUpToDate) {
            message = `Version à jour (${currentVersion})`;
        } else if (updateInfo && updateInfo.availableVersion) {
            message = `Votre version (${currentVersion}) est plus récente que celle disponible (${updateInfo.availableVersion})`;
        }

        dialog.showMessageBox(this.mainWindow, {
            type: "info",
            title: "Version à jour",
            message: message,
            buttons: ["OK"],
        });
    }

    showUpdateErrorDialog(error) {
        if (!this.mainWindow) return;

        dialog.showMessageBox(this.mainWindow, {
            type: "error",
            title: "Erreur de mise à jour",
            message: "Impossible de vérifier les mises à jour.",
            detail: error.message,
            buttons: ["OK"],
        });
    }

    // Configuration pour le développement
    setUpdateServer(url) {
        autoUpdater.setFeedURL(url);
    }

    // Méthodes pour l'interface utilisateur
    getUpdateStatus() {
        return {
            updateAvailable: this.updateAvailable,
            updateDownloaded: this.updateDownloaded,
            version: require("../../../package.json").version,
        };
    }


    async enableAutoUpdate(enabled) {
        autoUpdater.autoDownload = enabled;
        autoUpdater.autoInstallOnAppQuit = enabled;

        if (enabled) {
            logger.info("Mise à jour automatique activée");
        } else {
            logger.info("Mise à jour automatique désactivée");
        }
    }
}

module.exports = UpdateManager;
