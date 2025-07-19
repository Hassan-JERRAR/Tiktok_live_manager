/**
 * Module de gestion des notifications
 */

const AppConfig = require('../../config/app-config');
const Logger = require('../../utils/logger');
const EventEmitter = require('../../utils/event-emitter');

class NotificationManager {
  constructor() {
    this.notifications = [];
    this.maxNotifications = AppConfig.ui.maxNotifications;
    this.defaultDuration = AppConfig.ui.notificationDuration;
    
    this.setupEventListeners();
  }

  // Configuration des écouteurs d'événements
  setupEventListeners() {
    EventEmitter.on('notification:show', (notification) => {
      this.showNotification(notification);
    });

    EventEmitter.on('app:error', (error) => {
      this.showError(error);
    });

    EventEmitter.on('connection:status', (status) => {
      this.handleConnectionStatus(status);
    });

    EventEmitter.on('print:completed', (printData) => {
      this.handlePrintCompleted(printData);
    });

    EventEmitter.on('user:added', (userId) => {
      this.handleUserAdded(userId);
    });

    EventEmitter.on('user:removed', (userId) => {
      this.handleUserRemoved(userId);
    });

    // Commandes depuis les messages
    EventEmitter.on('command:print', (commandData) => {
      this.handlePrintCommand(commandData);
    });

    EventEmitter.on('command:adduser', (commandData) => {
      this.handleAddUserCommand(commandData);
    });

    EventEmitter.on('command:stats', (commandData) => {
      this.handleStatsCommand(commandData);
    });
  }

  // Affichage d'une notification
  showNotification(notification) {
    try {
      const {
        type = 'info',
        message,
        title = null,
        duration = this.defaultDuration,
        persistent = false
      } = notification;

      const notificationData = {
        id: this.generateId(),
        type,
        title: title || this.getDefaultTitle(type),
        message,
        timestamp: new Date().toISOString(),
        duration,
        persistent
      };

      // Ajouter à la liste
      this.addNotification(notificationData);

      // Envoyer à l'interface
      this.sendToRenderer('notification:display', notificationData);

      // Programmer la suppression automatique si non persistante
      if (!persistent && duration > 0) {
        setTimeout(() => {
          this.removeNotification(notificationData.id);
        }, duration);
      }

      Logger.debug('Notification affichée', {
        type,
        message: message.substring(0, 50)
      });

    } catch (error) {
      Logger.error('Erreur lors de l\'affichage de la notification', error);
    }
  }

  // Affichage d'une erreur
  showError(error) {
    const message = error.message || 'Une erreur est survenue';
    const title = this.getErrorTitle(error.type);

    this.showNotification({
      type: 'error',
      title,
      message,
      duration: this.defaultDuration * 2, // Erreurs affichées plus longtemps
      persistent: false
    });
  }

  // Affichage d'un succès
  showSuccess(message, title = null) {
    this.showNotification({
      type: 'success',
      title,
      message,
      duration: this.defaultDuration
    });
  }

  // Affichage d'un avertissement
  showWarning(message, title = null) {
    this.showNotification({
      type: 'warning',
      title,
      message,
      duration: this.defaultDuration
    });
  }

  // Affichage d'une information
  showInfo(message, title = null) {
    this.showNotification({
      type: 'info',
      title,
      message,
      duration: this.defaultDuration
    });
  }

  // Gestion du statut de connexion
  handleConnectionStatus(status) {
    if (status.connected) {
      this.showSuccess(
        `Connecté au live de ${status.username}${status.roomId ? ` (Room: ${status.roomId})` : ''}`,
        'Connexion TikTok'
      );
    } else {
      this.showInfo(
        'Déconnecté du live TikTok',
        'Connexion TikTok'
      );
    }
  }

  // Gestion de l'impression terminée
  handlePrintCompleted(printData) {
    this.showSuccess(
      `Étiquette ${printData.reference} imprimée pour ${printData.pseudo} (${printData.montant}€)`,
      'Impression terminée'
    );
  }

  // Gestion de l'ajout d'utilisateur
  handleUserAdded(userId) {
    this.showSuccess(
      `Utilisateur ${userId} ajouté aux vérifiés`,
      'Utilisateur ajouté'
    );
  }

  // Gestion de la suppression d'utilisateur
  handleUserRemoved(userId) {
    this.showInfo(
      `Utilisateur ${userId} retiré des vérifiés`,
      'Utilisateur supprimé'
    );
  }

  // Gestion des commandes d'impression
  handlePrintCommand(commandData) {
    this.showInfo(
      `Commande d'impression reçue de ${commandData.requestedBy}: ${commandData.pseudo} - ${commandData.montant}€`,
      'Commande TikTok'
    );
  }

  // Gestion des commandes d'ajout d'utilisateur
  handleAddUserCommand(commandData) {
    this.showInfo(
      `Demande d'ajout d'utilisateur de ${commandData.requestedBy}: ${commandData.userToAdd}`,
      'Commande TikTok'
    );
  }

  // Gestion des commandes de statistiques
  handleStatsCommand(commandData) {
    const stats = commandData.stats;
    this.showInfo(
      `Statistiques demandées par ${commandData.requestedBy}: ${stats.totalMessages} messages, ${stats.verifiedMessages} vérifiés`,
      'Statistiques'
    );
  }

  // Ajout d'une notification à la liste
  addNotification(notification) {
    this.notifications.push(notification);

    // Maintenir la limite
    if (this.notifications.length > this.maxNotifications * 2) {
      this.notifications = this.notifications.slice(-this.maxNotifications);
    }
  }

  // Suppression d'une notification
  removeNotification(notificationId) {
    const index = this.notifications.findIndex(n => n.id === notificationId);
    
    if (index !== -1) {
      this.notifications.splice(index, 1);
      this.sendToRenderer('notification:remove', { id: notificationId });
    }
  }

  // Effacement de toutes les notifications
  clearAllNotifications() {
    const clearedCount = this.notifications.length;
    this.notifications = [];
    
    this.sendToRenderer('notification:clear-all');
    
    Logger.info(`${clearedCount} notifications effacées`);
    return clearedCount;
  }

  // Récupération des notifications
  getNotifications(limit = null) {
    if (limit) {
      return this.notifications.slice(-limit);
    }
    return [...this.notifications];
  }

  // Statistiques des notifications
  getNotificationStats() {
    const total = this.notifications.length;
    const byType = this.notifications.reduce((acc, notif) => {
      acc[notif.type] = (acc[notif.type] || 0) + 1;
      return acc;
    }, {});

    return {
      total,
      byType,
      recent: this.notifications.slice(-10)
    };
  }

  // Utilitaires
  generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  getDefaultTitle(type) {
    const titles = {
      success: 'Succès',
      error: 'Erreur',
      warning: 'Attention',
      info: 'Information'
    };
    
    return titles[type] || 'Notification';
  }

  getErrorTitle(errorType) {
    const errorTitles = {
      connection: 'Erreur de connexion',
      print: 'Erreur d\'impression',
      user_management: 'Erreur utilisateur',
      tiktok_connection: 'Erreur TikTok',
      file: 'Erreur de fichier',
      validation: 'Erreur de validation'
    };
    
    return errorTitles[errorType] || 'Erreur';
  }

  // Communication avec le renderer
  sendToRenderer(event, data = null) {
    try {
      const { BrowserWindow } = require('electron');
      const mainWindow = BrowserWindow.getAllWindows()[0];
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(event, data);
      }
    } catch (error) {
      Logger.error('Erreur lors de l\'envoi au renderer', error);
    }
  }

  // Test de notifications
  testNotifications() {
    const testTypes = ['success', 'error', 'warning', 'info'];
    
    testTypes.forEach((type, index) => {
      setTimeout(() => {
        this.showNotification({
          type,
          message: `Test de notification ${type}`,
          title: `Test ${type.toUpperCase()}`
        });
      }, index * 1000);
    });

    Logger.info('Test de notifications lancé');
  }

  // Nettoyage
  cleanup() {
    this.clearAllNotifications();
    Logger.debug('NotificationManager: Nettoyage effectué');
  }
}

// Instance singleton
const notificationManager = new NotificationManager();

module.exports = notificationManager;