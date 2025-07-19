/**
 * Module de gestion de la connexion TikTok Live
 */

// Chargement conditionnel pour éviter les erreurs de build
let TikTokLiveConnection, WebcastEvent;
try {
    const tiktokModule = require("tiktok-live-connector");
    TikTokLiveConnection = tiktokModule.TikTokLiveConnection;
    WebcastEvent = tiktokModule.WebcastEvent;
} catch (error) {
    console.error("❌ TikTok Live Connector non disponible:", error.message);
}
const AppConfig = require("../../config/app-config");
const Logger = require("../../utils/logger");
const EventEmitter = require("../../utils/event-emitter");
const DataService = require("../../services/data-service");

class TikTokManager {
    constructor() {
        this.connection = null;
        this.isConnected = false;
        this.currentUsername = null;
        this.roomId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
    }

    // Connexion au live TikTok
    async connect(username = AppConfig.tiktok.defaultUsername) {
        try {
            if (!TikTokLiveConnection) {
                return {
                    success: false,
                    message:
                        "Module TikTok Live non disponible. Veuillez redémarrer l'application.",
                };
            }

            if (this.isConnected) {
                return { success: false, message: "Déjà connecté" };
            }

            Logger.info(`Tentative de connexion au live TikTok: ${username}`);

            this.connection = new TikTokLiveConnection(username);
            this.currentUsername = username;

            // Configuration des écouteurs d'événements
            this.setupEventListeners();

            // Connexion
            const state = await this.connection.connect();

            this.isConnected = true;
            this.roomId = state.roomId;
            this.reconnectAttempts = 0;

            EventEmitter.emitConnectionStatus({
                connected: true,
                username: username,
                roomId: state.roomId,
            });

            Logger.success(`Connecté au live TikTok - RoomId: ${state.roomId}`);

            return {
                success: true,
                roomId: state.roomId,
                username: username,
            };
        } catch (error) {
            Logger.error("Erreur de connexion TikTok", error);
            this.isConnected = false;

            EventEmitter.emitError({
                type: "connection",
                message: error.message,
            });

            return {
                success: false,
                message: error.message,
            };
        }
    }

    // Déconnexion
    disconnect() {
        try {
            if (this.connection) {
                this.connection.disconnect();
                this.connection = null;
            }

            this.isConnected = false;
            this.currentUsername = null;
            this.roomId = null;
            this.reconnectAttempts = 0;

            DataService.resetMessageCount();

            EventEmitter.emitConnectionStatus({
                connected: false,
                username: null,
                roomId: null,
            });

            Logger.info("Déconnexion TikTok réussie");

            return { success: true };
        } catch (error) {
            Logger.error("Erreur de déconnexion TikTok", error);
            return { success: false, message: error.message };
        }
    }

    // Configuration des écouteurs d'événements TikTok
    setupEventListeners() {
        if (!this.connection) return;

        // Messages de chat
        this.connection.on(WebcastEvent.CHAT, (data) => {
            this.handleChatMessage(data);
        });

        // Cadeaux (optionnel, pour étendre les fonctionnalités)
        this.connection.on(WebcastEvent.GIFT, (data) => {
            this.handleGift(data);
        });

        // Connexions/Déconnexions
        this.connection.on("connected", () => {
            Logger.info("Connexion TikTok établie");
        });

        this.connection.on("disconnected", () => {
            Logger.warn("Connexion TikTok fermée");
            this.handleDisconnection();
        });

        // Erreurs
        this.connection.on("error", (error) => {
            Logger.error("Erreur TikTok Live", error);
            this.handleConnectionError(error);
        });
    }

    // Gestion des messages de chat
    handleChatMessage(data) {
        try {
            const userId = data.user?.uniqueId || "unknown";
            const nickname = data.user?.nickname || "Anonyme";
            const message = data.comment || "";
            const timestamp = this.getTimestamp();
            const isVerified = DataService.isVerifiedUser(userId);

            const messageData = {
                id: Date.now().toString() + Math.random(),
                userId,
                nickname,
                message,
                timestamp,
                isVerified,
            };

            DataService.incrementMessageCount();
            EventEmitter.emitNewMessage(messageData);

            Logger.debug("Nouveau message TikTok", {
                user: nickname,
                verified: isVerified,
                message: message.substring(0, 50),
            });
        } catch (error) {
            Logger.error("Erreur lors du traitement du message", error);
        }
    }

    // Gestion des cadeaux (pour extension future)
    handleGift(data) {
        try {
            const userId = data.user?.uniqueId || "unknown";
            const nickname = data.user?.nickname || "Anonyme";
            const giftId = data.giftId;
            const isVerified = DataService.isVerifiedUser(userId);

            Logger.info(
                `Cadeau reçu de ${nickname} (${
                    isVerified ? "vérifié" : "standard"
                }): ${giftId}`
            );

            // Émettre un événement pour les cadeaux si nécessaire
            EventEmitter.emit("gift:received", {
                userId,
                nickname,
                giftId,
                isVerified,
                timestamp: this.getTimestamp(),
            });
        } catch (error) {
            Logger.error("Erreur lors du traitement du cadeau", error);
        }
    }

    // Gestion des déconnexions
    handleDisconnection() {
        if (this.isConnected) {
            this.isConnected = false;

            EventEmitter.emitConnectionStatus({
                connected: false,
                username: this.currentUsername,
                roomId: this.roomId,
            });

            // Tentative de reconnexion automatique
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.attemptReconnection();
            } else {
                Logger.error(
                    "Nombre maximum de tentatives de reconnexion atteint"
                );
                EventEmitter.emitError({
                    type: "reconnection",
                    message: "Impossible de se reconnecter automatiquement",
                });
            }
        }
    }

    // Gestion des erreurs de connexion
    handleConnectionError(error) {
        Logger.error("Erreur de connexion TikTok", error);

        EventEmitter.emitError({
            type: "tiktok_connection",
            message: error.message,
        });

        // Tentative de reconnexion en cas d'erreur
        if (this.isConnected) {
            this.handleDisconnection();
        }
    }

    // Tentative de reconnexion automatique
    async attemptReconnection() {
        this.reconnectAttempts++;

        Logger.info(
            `Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
        );

        setTimeout(async () => {
            try {
                if (this.currentUsername) {
                    await this.connect(this.currentUsername);
                }
            } catch (error) {
                Logger.error("Échec de la reconnexion automatique", error);

                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.attemptReconnection();
                }
            }
        }, AppConfig.tiktok.reconnectDelay);
    }

    // Utilitaires
    getTimestamp() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, "0");
        const minutes = now.getMinutes().toString().padStart(2, "0");
        const seconds = now.getSeconds().toString().padStart(2, "0");
        return `${hours}:${minutes}:${seconds}`;
    }

    // Getters
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            username: this.currentUsername,
            roomId: this.roomId,
            reconnectAttempts: this.reconnectAttempts,
        };
    }

    getCurrentUsername() {
        return this.currentUsername;
    }

    getRoomId() {
        return this.roomId;
    }

    // Nettoyage
    cleanup() {
        if (this.connection) {
            this.disconnect();
        }
    }
}

// Instance singleton
const tiktokManager = new TikTokManager();

module.exports = tiktokManager;
