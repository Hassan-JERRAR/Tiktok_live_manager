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
            allowPrerelease: true, // Permet les releases draft/pre-release
        };

        // Ajouter le token si disponible
        if (process.env.GH_TOKEN) {
            updateConfig.token = process.env.GH_TOKEN;
        }

        // Configuration spéciale pour les repositories privés
        autoUpdater.setFeedURL(updateConfig);

        // Configuration des headers d'authentification pour les assets
        if (process.env.GH_TOKEN) {
            autoUpdater.requestHeaders = {
                Authorization: `token ${process.env.GH_TOKEN}`,
                "User-Agent": "TikTok-Live-Manager-Updater",
            };
        }

        // Configuration des logs
        autoUpdater.logger = logger;

        // Événements d'auto-updater
        autoUpdater.on("checking-for-update", () => {
            logger.info("Vérification des mises à jour...");
            this.emit("checking-for-update");
        });

        autoUpdater.on("update-available", (info) => {
            const currentVersion = require("../../../package.json").version;
            logger.info(`Mise à jour détectée - Actuelle: ${currentVersion}, Disponible: ${info.version}`);
            
            // Vérifier si c'est vraiment une nouvelle version
            if (this.compareVersions(currentVersion, info.version) >= 0) {
                logger.info("La version disponible n'est pas plus récente que la version actuelle");
                this.emit("update-not-available", { version: currentVersion });
                return;
            }
            
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

            // Vérifier d'abord manuellement les versions pour éviter les faux positifs
            const currentVersion = require("../../../package.json").version;
            logger.info(`Version actuelle: ${currentVersion}`);

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
            this.emit("download-started");
            
            // Afficher une notification de début de téléchargement
            if (this.mainWindow) {
                this.mainWindow.webContents.send('update-download-started');
            }
            
            autoUpdater.downloadUpdate();
        } else {
            logger.warn("Tentative de téléchargement sans mise à jour disponible");
        }
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

    // Publier une release draft pour la rendre disponible
    async publishRelease(releaseId) {
        const token = process.env.GH_TOKEN;
        if (!token) {
            throw new Error("Token GitHub manquant");
        }

        try {
            const response = await fetch(`https://api.github.com/repos/Hassan-JERRAR/Tiktok_live_manager/releases/${releaseId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ draft: false })
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            logger.info(`Release ${releaseId} publiée avec succès`);
            return await response.json();
        } catch (error) {
            logger.error("Erreur lors de la publication de la release:", error);
            throw error;
        }
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
