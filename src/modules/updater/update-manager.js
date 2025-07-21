const { autoUpdater } = require("electron-updater");
const { dialog, shell, app } = require("electron");
const EventEmitter = require("events");
const logger = require("../../utils/logger");
const config = require("../../config/app-config");
const updateConfig = require("../../config/update-config");
const os = require("os");

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
        // Configuration electron-updater
        autoUpdater.autoDownload = updateConfig.options.autoDownload;
        autoUpdater.autoInstallOnAppQuit = updateConfig.options.autoInstallOnAppQuit;
        autoUpdater.allowDowngrade = false;
        autoUpdater.allowPrerelease = updateConfig.options.allowPrerelease;
        
        // Configuration des logs pour le debug
        autoUpdater.logger = logger;
        autoUpdater.logger.transports.file.level = 'info';
        
        // Forcer les mises à jour en mode développement
        if (process.env.NODE_ENV === 'development' || process.defaultApp) {
            autoUpdater.forceDevUpdateConfig = true;
            logger.info("Mode développement détecté - forçage des mises à jour activé");
        }
        
        // Configuration avancée selon la plateforme
        this.configurePlatformSpecific();
        
        // Configuration du provider GitHub
        this.configureGitHubProvider();

        // Événements d'auto-updater
        autoUpdater.on("checking-for-update", () => {
            logger.info("Vérification des mises à jour...");
            this.emit("checking-for-update");
        });

        autoUpdater.on("update-available", (info) => {
            logger.info("Mise à jour disponible:", info.version);
            logger.info("Info complète:", JSON.stringify(info, null, 2));
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

    /**
     * Configuration spécifique à la plateforme
     */
    configurePlatformSpecific() {
        const platform = process.platform;
        const arch = this.getSystemArchitecture();
        
        logger.info(`Plateforme: ${platform}, Architecture: ${arch}`);
        
        if (platform === 'darwin') {
            // Configuration macOS avec détection d'architecture précise
            this.configureMacOS(arch);
        } else if (platform === 'win32') {
            // Configuration Windows
            this.configureWindows(arch);
        } else if (platform === 'linux') {
            // Configuration Linux
            this.configureLinux(arch);
        }
    }

    /**
     * Configuration du provider GitHub
     */
    configureGitHubProvider() {
        if (updateConfig.github) {
            const feedConfig = {
                provider: 'github',
                owner: updateConfig.github.owner,
                repo: updateConfig.github.repo,
                private: updateConfig.github.private || false
            };

            // Ajouter le token si disponible
            if (process.env.GH_TOKEN) {
                feedConfig.token = process.env.GH_TOKEN;
                logger.info("Token GitHub configuré pour les mises à jour");
            }

            autoUpdater.setFeedURL(feedConfig);
            logger.info(`Provider GitHub configuré: ${feedConfig.owner}/${feedConfig.repo}`);
        }
    }

    /**
     * Détection précise de l'architecture système
     */
    getSystemArchitecture() {
        const nodeArch = process.arch;
        const osArch = os.arch();
        
        // Pour macOS, détecter Intel vs Apple Silicon
        if (process.platform === 'darwin') {
            // Vérifier si on est sur Apple Silicon
            try {
                const { execSync } = require('child_process');
                const sysctl = execSync('sysctl -n machdep.cpu.brand_string', { encoding: 'utf8' }).trim();
                
                if (sysctl.includes('Apple')) {
                    return 'arm64'; // Apple Silicon (M1, M2, M3, etc.)
                } else {
                    return 'x64'; // Intel Mac
                }
            } catch (error) {
                logger.warn("Impossible de détecter l'architecture via sysctl, utilisation de process.arch");
                return nodeArch === 'arm64' ? 'arm64' : 'x64';
            }
        }
        
        // Pour Windows et Linux, utiliser process.arch
        return nodeArch === 'x64' || nodeArch === 'x86_64' ? 'x64' : nodeArch;
    }

    /**
     * Configuration spécifique macOS
     */
    configureMacOS(arch) {
        logger.info(`Configuration macOS pour architecture: ${arch}`);
        
        // Configuration spécifique pour les mises à jour macOS
        autoUpdater.requestHeaders = {
            'User-Agent': `TikTokLiveManager/${app.getVersion()} (Darwin ${os.release()}; ${arch})`
        };
        
        // Configurer les entitlements pour les mises à jour
        if (process.env.NODE_ENV !== 'development') {
            logger.info("Configuration des entitlements macOS pour les mises à jour");
        }
    }

    /**
     * Configuration spécifique Windows
     */
    configureWindows(arch) {
        logger.info(`Configuration Windows pour architecture: ${arch}`);
        
        autoUpdater.requestHeaders = {
            'User-Agent': `TikTokLiveManager/${app.getVersion()} (Windows NT ${os.release()}; ${arch})`
        };
    }

    /**
     * Configuration spécifique Linux
     */
    configureLinux(arch) {
        logger.info(`Configuration Linux pour architecture: ${arch}`);
        
        autoUpdater.requestHeaders = {
            'User-Agent': `TikTokLiveManager/${app.getVersion()} (Linux ${os.release()}; ${arch})`
        };
    }

    async checkForUpdates(manual = false) {
        try {
            if (manual) {
                logger.info("Vérification manuelle des mises à jour");
            }

            // Afficher les informations système pour le debug
            const currentArch = this.getSystemArchitecture();
            const currentVersion = app.getVersion();
            
            logger.info(`Système actuel: ${process.platform} ${currentArch} v${currentVersion}`);
            logger.info("Vérification des mises à jour via electron-updater");
            
            // S'assurer que la configuration est correcte avant la vérification
            this.configurePlatformSpecific();
            this.configureGitHubProvider();
            
            const result = await autoUpdater.checkForUpdates();
            
            if (result && result.updateInfo) {
                logger.info(`Mise à jour trouvée: ${result.updateInfo.version}`);
                logger.info("Assets disponibles:", result.updateInfo.files?.map(f => f.url) || 'Non disponibles');
                return { updateInfo: result.updateInfo };
            } else {
                logger.info("Aucune mise à jour disponible");
                if (manual) {
                    this.showNoUpdateDialog();
                }
                return { noUpdate: true };
            }
            
        } catch (error) {
            logger.error("Erreur lors de la vérification des mises à jour:", error);
            logger.error("Stack trace:", error.stack);
            
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
