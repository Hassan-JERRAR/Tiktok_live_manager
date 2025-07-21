const { autoUpdater } = require("electron-updater");
const { dialog, shell } = require("electron");
const EventEmitter = require("events");
const logger = require("../../utils/logger");
const config = require("../../config/app-config");
const https = require('https');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

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
        if (!process.env.GH_TOKEN) {
            logger.error("GH_TOKEN manquant pour l'auto-updater");
            return;
        }

        // Désactiver complètement autoUpdater et utiliser notre implémentation custom
        this.useCustomUpdater = true;
        
        // Configuration des logs pour le debug
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
            const comparison = this.compareVersions(currentVersion, info.version);
            if (comparison >= 0) {
                logger.info("La version disponible n'est pas plus récente que la version actuelle");
                this.emit("update-not-available", { 
                    version: currentVersion,
                    availableVersion: info.version,
                    isUpToDate: comparison === 0
                });
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

            // Utiliser notre implémentation personnalisée pour les repos privés
            if (this.useCustomUpdater) {
                return await this.checkForUpdatesCustom(manual);
            }

            // Fallback vers l'auto-updater standard (pour repos publics)
            const currentVersion = require("../../../package.json").version;
            logger.info(`Version actuelle: ${currentVersion}`);

            return new Promise((resolve) => {
                const onUpdateAvailable = (info) => {
                    cleanup();
                    resolve({ updateInfo: info });
                };

                const onUpdateNotAvailable = (info) => {
                    cleanup();
                    if (manual) {
                        this.showNoUpdateDialog(info);
                    }
                    resolve({ noUpdate: true, currentVersion, info });
                };

                const onError = (error) => {
                    cleanup();
                    if (manual) {
                        this.showUpdateErrorDialog(error);
                    }
                    resolve({ error: error.message });
                };

                const cleanup = () => {
                    this.off('update-available', onUpdateAvailable);
                    this.off('update-not-available', onUpdateNotAvailable);
                    this.off('update-error', onError);
                };

                this.once('update-available', onUpdateAvailable);
                this.once('update-not-available', onUpdateNotAvailable);
                this.once('update-error', onError);

                autoUpdater.checkForUpdates().catch(onError);
            });
        } catch (error) {
            logger.error("Erreur lors de la vérification des mises à jour:", error);
            if (manual) {
                this.showUpdateErrorDialog(error);
            }
            return { error: error.message };
        }
    }

    // Implémentation personnalisée pour repos privés GitHub
    async checkForUpdatesCustom(manual = false) {
        const currentVersion = require("../../../package.json").version;
        logger.info(`Version actuelle: ${currentVersion}`);

        try {
            // Récupérer la dernière release via l'API GitHub
            const releaseInfo = await this.getLatestReleaseFromGitHub();
            
            if (!releaseInfo) {
                const info = { currentVersion };
                if (manual) {
                    this.showNoUpdateDialog(info);
                }
                return { noUpdate: true, currentVersion, info };
            }

            // Comparer les versions
            const comparison = this.compareVersions(currentVersion, releaseInfo.tag_name.replace('v', ''));
            
            if (comparison >= 0) {
                logger.info("Aucune mise à jour disponible");
                const info = { 
                    currentVersion,
                    availableVersion: releaseInfo.tag_name.replace('v', ''),
                    isUpToDate: comparison === 0
                };
                
                if (manual) {
                    this.showNoUpdateDialog(info);
                }
                return { noUpdate: true, currentVersion, info };
            }

            // Mise à jour disponible
            logger.info(`Mise à jour disponible: ${releaseInfo.tag_name}`);
            this.updateAvailable = true;
            this.latestRelease = releaseInfo;
            
            const updateInfo = {
                version: releaseInfo.tag_name.replace('v', ''),
                releaseNotes: releaseInfo.body,
                releaseDate: releaseInfo.published_at,
                releaseName: releaseInfo.name
            };

            this.emit("update-available", updateInfo);
            if (manual) {
                this.showUpdateAvailableDialog(updateInfo);
            }
            
            return { updateInfo };

        } catch (error) {
            logger.error("Erreur lors de la vérification des mises à jour:", error);
            if (manual) {
                this.showUpdateErrorDialog(error);
            }
            return { error: error.message };
        }
    }

    // Récupérer la dernière release depuis l'API GitHub
    async getLatestReleaseFromGitHub() {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.github.com',
                path: '/repos/Hassan-JERRAR/Tiktok_live_manager/releases/latest',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${process.env.GH_TOKEN}`,
                    'User-Agent': 'TikTok-Live-Manager-Updater',
                    'Accept': 'application/vnd.github.v3+json'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        if (res.statusCode === 200) {
                            const release = JSON.parse(data);
                            resolve(release);
                        } else if (res.statusCode === 404) {
                            logger.info("Aucune release trouvée");
                            resolve(null);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.end();
        });
    }

    downloadUpdate() {
        return new Promise((resolve, reject) => {
            if (!this.updateAvailable) {
                const error = "Aucune mise à jour disponible pour le téléchargement";
                logger.warn(error);
                reject(new Error(error));
                return;
            }

            // Utiliser notre implémentation personnalisée pour les repos privés
            if (this.useCustomUpdater) {
                this.downloadUpdateCustom().then(resolve).catch(reject);
                return;
            }

            // Fallback vers l'auto-updater standard
            logger.info("Début du téléchargement de la mise à jour");
            this.emit("download-started");
            
            if (this.mainWindow) {
                this.mainWindow.webContents.send('update-download-started');
            }

            const onDownloaded = (info) => {
                cleanup();
                resolve({ success: true, info });
            };

            const onError = (error) => {
                cleanup();
                reject(error);
            };

            const cleanup = () => {
                this.off('update-downloaded', onDownloaded);
                this.off('update-error', onError);
            };

            this.once('update-downloaded', onDownloaded);
            this.once('update-error', onError);
            
            try {
                autoUpdater.downloadUpdate();
            } catch (error) {
                cleanup();
                reject(error);
            }
        });
    }

    // Téléchargement personnalisé pour repos privés
    async downloadUpdateCustom() {
        if (!this.latestRelease) {
            throw new Error("Aucune information de release disponible");
        }

        logger.info("Début du téléchargement personnalisé de la mise à jour");
        this.emit("download-started");
        
        if (this.mainWindow) {
            this.mainWindow.webContents.send('update-download-started');
        }

        try {
            // Trouver l'asset approprié pour la plateforme actuelle
            const platform = process.platform;
            let assetName = '';
            
            if (platform === 'darwin') {
                assetName = this.latestRelease.assets.find(asset => 
                    asset.name.endsWith('.dmg')
                )?.name;
            } else if (platform === 'win32') {
                assetName = this.latestRelease.assets.find(asset => 
                    asset.name.endsWith('.exe')
                )?.name;
            } else if (platform === 'linux') {
                assetName = this.latestRelease.assets.find(asset => 
                    asset.name.endsWith('.AppImage')
                )?.name;
            }

            if (!assetName) {
                throw new Error(`Aucun asset trouvé pour la plateforme ${platform}`);
            }

            const asset = this.latestRelease.assets.find(a => a.name === assetName);
            const downloadPath = path.join(app.getPath('temp'), assetName);

            // Télécharger l'asset avec authentification
            await this.downloadAsset(asset, downloadPath);
            
            logger.info("Mise à jour téléchargée avec succès");
            this.updateDownloaded = true;
            
            const updateInfo = {
                version: this.latestRelease.tag_name.replace('v', ''),
                downloadPath: downloadPath,
                assetName: assetName
            };

            this.emit("update-downloaded", updateInfo);
            
            if (this.mainWindow) {
                this.mainWindow.webContents.send('update-downloaded', updateInfo);
            }
            
            this.showUpdateDownloadedDialog(updateInfo);
            
            return { success: true, info: updateInfo };

        } catch (error) {
            logger.error("Erreur lors du téléchargement:", error);
            this.emit("update-error", error);
            throw error;
        }
    }

    // Télécharger un asset GitHub avec authentification
    async downloadAsset(asset, downloadPath) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.github.com',
                path: `/repos/Hassan-JERRAR/Tiktok_live_manager/releases/assets/${asset.id}`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${process.env.GH_TOKEN}`,
                    'User-Agent': 'TikTok-Live-Manager-Updater',
                    'Accept': 'application/octet-stream'
                }
            };

            const file = fs.createWriteStream(downloadPath);
            let downloadedBytes = 0;
            const totalBytes = asset.size;

            const req = https.request(options, (res) => {
                if (res.statusCode === 302 || res.statusCode === 301) {
                    // Redirection vers l'URL de téléchargement
                    const redirectUrl = res.headers.location;
                    logger.info("Redirection vers:", redirectUrl);
                    
                    // Suivre la redirection SANS authentification (Azure Storage)
                    const redirectReq = https.get(redirectUrl, {
                        headers: {
                            'User-Agent': 'TikTok-Live-Manager-Updater'
                        }
                    }, (redirectRes) => {
                        this.handleDownloadResponse(redirectRes, file, downloadedBytes, totalBytes, resolve, reject);
                    });
                    
                    redirectReq.on('error', reject);
                    return;
                }

                this.handleDownloadResponse(res, file, downloadedBytes, totalBytes, resolve, reject);
            });

            req.on('error', (error) => {
                fs.unlink(downloadPath, () => {});
                reject(error);
            });

            req.end();
        });
    }

    // Gérer la réponse de téléchargement avec progress
    handleDownloadResponse(res, file, downloadedBytes, totalBytes, resolve, reject) {
        if (res.statusCode !== 200) {
            file.close();
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            return;
        }

        res.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            const percent = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;
            
            this.emit("download-progress", {
                percent: percent,
                transferred: downloadedBytes,
                total: totalBytes
            });
            
            if (this.mainWindow) {
                this.mainWindow.webContents.send('update-download-progress', {
                    percent: percent,
                    transferred: downloadedBytes,
                    total: totalBytes
                });
            }
        });

        res.pipe(file);

        file.on('finish', () => {
            file.close();
            resolve();
        });

        file.on('error', (error) => {
            fs.unlink(file.path, () => {});
            reject(error);
        });

        res.on('error', (error) => {
            file.close();
            reject(error);
        });
    }

    quitAndInstall() {
        if (this.updateDownloaded) {
            logger.info("Installation de la mise à jour et redémarrage");
            
            // Utiliser notre implémentation personnalisée pour les repos privés
            if (this.useCustomUpdater && this.latestRelease) {
                this.installUpdateCustom();
            } else {
                autoUpdater.quitAndInstall();
            }
        }
    }

    // Installation personnalisée pour repos privés
    installUpdateCustom() {
        try {
            // Trouver l'asset approprié pour la plateforme actuelle
            const platform = process.platform;
            let assetName = '';
            
            if (platform === 'darwin') {
                assetName = this.latestRelease.assets.find(asset => 
                    asset.name.endsWith('.dmg')
                )?.name;
            } else if (platform === 'win32') {
                assetName = this.latestRelease.assets.find(asset => 
                    asset.name.endsWith('.exe')
                )?.name;
            } else if (platform === 'linux') {
                assetName = this.latestRelease.assets.find(asset => 
                    asset.name.endsWith('.AppImage')
                )?.name;
            }

            if (!assetName) {
                throw new Error(`Aucun asset trouvé pour la plateforme ${platform}`);
            }

            const downloadPath = path.join(app.getPath('temp'), assetName);
            
            // Vérifier que le fichier existe
            if (!fs.existsSync(downloadPath)) {
                throw new Error("Fichier de mise à jour introuvable");
            }

            logger.info(`Ouverture du fichier de mise à jour: ${downloadPath}`);

            if (platform === 'darwin') {
                // Sur macOS, ouvrir le DMG
                const { spawn } = require('child_process');
                spawn('open', [downloadPath], { detached: true });
                
                // Fermer l'application après un délai pour permettre l'ouverture du DMG
                setTimeout(() => {
                    app.quit();
                }, 2000);
                
            } else if (platform === 'win32') {
                // Sur Windows, lancer l'installateur
                const { spawn } = require('child_process');
                spawn(downloadPath, [], { detached: true });
                app.quit();
                
            } else if (platform === 'linux') {
                // Sur Linux, rendre le fichier exécutable et l'ouvrir
                const { spawn } = require('child_process');
                fs.chmodSync(downloadPath, '755');
                spawn(downloadPath, [], { detached: true });
                app.quit();
            }

        } catch (error) {
            logger.error("Erreur lors de l'installation:", error);
            
            // Afficher une boîte de dialogue d'erreur
            if (this.mainWindow) {
                dialog.showErrorBox(
                    "Erreur d'installation",
                    `Impossible d'installer automatiquement la mise à jour: ${error.message}\n\nVeuillez installer manuellement le fichier téléchargé.`
                );
            }
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
                    'Authorization': `Bearer ${token}`,
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
