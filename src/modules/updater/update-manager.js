const { autoUpdater } = require("electron-updater");
const { dialog, shell } = require("electron");
const EventEmitter = require("events");
const logger = require("../../utils/logger");
const config = require("../../config/app-config");

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
        // Configuration du serveur de mise à jour pour repository privé
        const updateConfig = {
            provider: "github",
            owner: "Hassan-JERRAR",
            repo: "Tiktok_live_manager",
            private: true,
        };

        // Ajouter le token si disponible
        if (process.env.GH_TOKEN) {
            updateConfig.token = process.env.GH_TOKEN;
        }

        autoUpdater.setFeedURL(updateConfig);

        // Configuration des logs
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
        });

        autoUpdater.on("update-downloaded", (info) => {
            logger.info("Mise à jour téléchargée");
            this.updateDownloaded = true;
            this.emit("update-downloaded", info);
            this.showUpdateDownloadedDialog(info);
        });
    }

    async checkForUpdates(manual = false) {
        try {
            if (manual) {
                logger.info("Vérification manuelle des mises à jour");
            }

            const result = await autoUpdater.checkForUpdatesAndNotify();

            if (manual && !result) {
                this.showNoUpdateDialog();
            }

            return result;
        } catch (error) {
            logger.error(
                "Erreur lors de la vérification des mises à jour:",
                error
            );
            if (manual) {
                this.showUpdateErrorDialog(error);
            }
            throw error;
        }
    }

    downloadUpdate() {
        if (this.updateAvailable) {
            logger.info("Début du téléchargement de la mise à jour");
            autoUpdater.downloadUpdate();
        }
    }

    quitAndInstall() {
        if (this.updateDownloaded) {
            logger.info("Installation de la mise à jour et redémarrage");
            autoUpdater.quitAndInstall();
        }
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
                    `https://github.com/${config.build.owner}/${config.build.repo}/releases/tag/v${info.version}`
                );
            }
        });
    }

    showUpdateDownloadedDialog(info) {
        if (!this.mainWindow) return;

        const options = {
            type: "info",
            title: "Mise à jour prête",
            message: "La mise à jour a été téléchargée.",
            detail: "Redémarrez l'application pour appliquer la mise à jour.",
            buttons: ["Redémarrer maintenant", "Plus tard"],
            defaultId: 0,
            cancelId: 1,
        };

        dialog.showMessageBox(this.mainWindow, options).then((result) => {
            if (result.response === 0) {
                this.quitAndInstall();
            }
        });
    }

    showNoUpdateDialog() {
        if (!this.mainWindow) return;

        dialog.showMessageBox(this.mainWindow, {
            type: "info",
            title: "Pas de mise à jour",
            message: "Vous utilisez déjà la dernière version.",
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
