/**
 * Main process modular - Point d'entrée principal de l'application
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Configuration
const AppConfig = require('./config/app-config');
const Logger = require('./utils/logger');
const EventEmitter = require('./utils/event-emitter');

// Services
const DataService = require('./services/data-service');

// Modules
const TikTokManager = require('./modules/tiktok/tiktok-manager');
const PrinterManager = require('./modules/printer/printer-manager');
const UserManager = require('./modules/users/user-manager');
const MessageManager = require('./modules/messages/message-manager');
const NotificationManager = require('./modules/notifications/notification-manager');

class TikTokLiveApp {
  constructor() {
    this.mainWindow = null;
    this.isInitialized = false;
    
    this.setupApplication();
  }

  setupApplication() {
    // Configuration de l'application Electron
    app.whenReady().then(() => {
      this.createWindow();
      this.initializeModules();
      this.setupIpcHandlers();
      this.setupEventListeners();
      
      Logger.success('Application initialisée avec succès');
    });

    // Gestion de la fermeture
    app.on('window-all-closed', () => {
      this.cleanup();
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    // Gestion de la fermeture propre
    app.on('before-quit', () => {
      this.cleanup();
    });

    // Gestion des erreurs non catchées
    process.on('uncaughtException', (error) => {
      Logger.error('Erreur non gérée:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      Logger.error('Promise rejetée non gérée:', reason);
    });
  }

  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: AppConfig.ui.windowWidth,
      height: AppConfig.ui.windowHeight,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      },
      icon: path.join(__dirname, '../assets/icon.png'),
      title: AppConfig.build.productName,
      show: false // Ne pas afficher immédiatement
    });

    // Charger l'interface
    this.mainWindow.loadFile(path.join(__dirname, '../index.html'));

    // Afficher quand prêt
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      
      if (process.argv.includes('--dev')) {
        this.mainWindow.webContents.openDevTools();
      }
    });

    // Gestion de la fermeture
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    Logger.info('Fenêtre principale créée');
  }

  initializeModules() {
    try {
      // Les modules sont déjà initialisés en tant que singletons
      // Ici on peut faire des configurations supplémentaires
      
      Logger.info('Modules initialisés');
      this.isInitialized = true;
      
    } catch (error) {
      Logger.error('Erreur lors de l\'initialisation des modules:', error);
      throw error;
    }
  }

  setupIpcHandlers() {
    // Données initiales
    ipcMain.handle('get-initial-data', () => {
      return {
        ...DataService.getInitialData(),
        isConnected: TikTokManager.getConnectionStatus().connected
      };
    });

    // TikTok Live
    ipcMain.handle('connect-tiktok', async (event, username) => {
      return await TikTokManager.connect(username);
    });

    ipcMain.handle('disconnect-tiktok', () => {
      return TikTokManager.disconnect();
    });

    // Gestion des utilisateurs vérifiés
    ipcMain.handle('add-verified-user', (event, userId) => {
      return UserManager.addUser(userId);
    });

    ipcMain.handle('remove-verified-user', (event, userId) => {
      return UserManager.removeUser(userId);
    });

    ipcMain.handle('get-verified-users', () => {
      return UserManager.getVerifiedUsers();
    });

    // Impression
    ipcMain.handle('print-label', async (event, labelData) => {
      try {
        const result = await PrinterManager.printLabel(labelData);
        return {
          success: true,
          printData: result.printData,
          printHistory: DataService.getPrintHistory(),
          stats: DataService.getStats()
        };
      } catch (error) {
        Logger.error('Erreur d\'impression via IPC:', error);
        return {
          success: false,
          message: error.message
        };
      }
    });

    ipcMain.handle('test-printer', async () => {
      try {
        const result = await PrinterManager.printTestLabel();
        return { success: true, result };
      } catch (error) {
        return { success: false, message: error.message };
      }
    });

    // Messages
    ipcMain.handle('get-messages', (event, limit) => {
      return MessageManager.getMessages(limit);
    });

    ipcMain.handle('clear-messages', () => {
      return MessageManager.clearMessages();
    });

    ipcMain.handle('search-messages', (event, query, options) => {
      return MessageManager.searchMessages(query, options);
    });

    // Statistiques
    ipcMain.handle('get-stats', () => {
      return DataService.getStats();
    });

    ipcMain.handle('get-message-stats', () => {
      return MessageManager.getMessageStats();
    });

    // Utilitaires
    ipcMain.handle('backup-data', () => {
      return DataService.backupData();
    });

    ipcMain.handle('export-data', () => {
      return {
        users: UserManager.exportUsers(),
        messages: MessageManager.getMessages(),
        printHistory: DataService.getPrintHistory()
      };
    });

    // Gestion des erreurs et notifications
    ipcMain.handle('show-notification', (event, notificationData) => {
      NotificationManager.showNotification(notificationData);
      return { success: true };
    });

    Logger.info('Gestionnaires IPC configurés');
  }

  setupEventListeners() {
    // Transfert des événements vers le renderer
    EventEmitter.on('message:new', (messageData) => {
      this.sendToRenderer('new-message', messageData);
    });

    EventEmitter.on('stats:update', (stats) => {
      this.sendToRenderer('stats-update', stats);
    });

    EventEmitter.on('connection:status', (status) => {
      this.sendToRenderer('connection-status', status);
    });

    EventEmitter.on('user:added', (userId) => {
      this.sendToRenderer('user-added', userId);
    });

    EventEmitter.on('user:removed', (userId) => {
      this.sendToRenderer('user-removed', userId);
    });

    EventEmitter.on('print:completed', (printData) => {
      this.sendToRenderer('print-completed', printData);
    });

    EventEmitter.on('app:error', (error) => {
      this.sendToRenderer('app-error', error);
    });

    // Gestion des commandes depuis les messages TikTok
    EventEmitter.on('command:print', async (commandData) => {
      try {
        await PrinterManager.printLabel({
          pseudo: commandData.pseudo,
          montant: commandData.montant,
          description: commandData.description
        });
        
        Logger.info('Impression déclenchée par commande TikTok', commandData);
      } catch (error) {
        Logger.error('Erreur lors de l\'impression par commande:', error);
      }
    });

    EventEmitter.on('command:adduser', async (commandData) => {
      try {
        await UserManager.addUser(commandData.userToAdd);
        Logger.info('Utilisateur ajouté par commande TikTok', commandData);
      } catch (error) {
        Logger.error('Erreur lors de l\'ajout par commande:', error);
      }
    });

    Logger.info('Écouteurs d\'événements configurés');
  }

  sendToRenderer(event, data = null) {
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send(event, data);
      }
    } catch (error) {
      Logger.error('Erreur lors de l\'envoi au renderer:', error);
    }
  }

  // Gestion de la santé de l'application
  getApplicationHealth() {
    return {
      isInitialized: this.isInitialized,
      mainWindow: !!this.mainWindow && !this.mainWindow.isDestroyed(),
      tiktokConnection: TikTokManager.getConnectionStatus(),
      printerStatus: PrinterManager.getStatus(),
      dataService: !!DataService,
      stats: DataService.getStats()
    };
  }

  // Redémarrage des modules
  async restartModules() {
    try {
      Logger.info('Redémarrage des modules...');
      
      // Arrêter TikTok
      TikTokManager.disconnect();
      
      // Effacer les messages
      MessageManager.clearMessages();
      
      // Recharger les données
      DataService.loadData();
      
      Logger.success('Modules redémarrés avec succès');
      
      NotificationManager.showSuccess('Modules redémarrés avec succès');
      
    } catch (error) {
      Logger.error('Erreur lors du redémarrage des modules:', error);
      NotificationManager.showError({ message: 'Erreur lors du redémarrage' });
    }
  }

  cleanup() {
    try {
      Logger.info('Nettoyage de l\'application...');
      
      // Sauvegarder les données
      DataService.backupData();
      
      // Arrêter TikTok
      TikTokManager.cleanup();
      
      // Nettoyer l'imprimante
      PrinterManager.cleanup();
      
      // Nettoyer les autres modules
      MessageManager.cleanup();
      NotificationManager.cleanup();
      
      Logger.info('Nettoyage terminé');
      
    } catch (error) {
      Logger.error('Erreur lors du nettoyage:', error);
    }
  }
}

// Démarrage de l'application
const tiktokLiveApp = new TikTokLiveApp();

// Export pour les tests ou utilisation externe
module.exports = TikTokLiveApp;