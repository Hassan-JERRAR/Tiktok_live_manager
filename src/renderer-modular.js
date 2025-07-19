/**
 * Renderer process modular - Interface utilisateur modulaire
 */

// Modules d'interface
const Dashboard = require('./components/dashboard/dashboard');
const Chat = require('./components/chat/chat');

class TikTokLiveRenderer {
  constructor() {
    this.components = {};
    this.currentTab = 'dashboard';
    this.isInitialized = false;
    
    this.init();
  }

  async init() {
    try {
      // Attendre que le DOM soit chargé
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initialize());
      } else {
        this.initialize();
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du renderer:', error);
    }
  }

  async initialize() {
    try {
      console.log('Initialisation du renderer modulaire...');
      
      // Initialiser les composants
      this.initializeComponents();
      
      // Configurer la navigation
      this.setupNavigation();
      
      // Configurer les gestionnaires d'événements globaux
      this.setupGlobalEventListeners();
      
      // Configurer l'API Electron
      this.setupElectronAPI();
      
      // Charger les données initiales
      await this.loadInitialData();
      
      // Marquer comme initialisé
      this.isInitialized = true;
      
      console.log('Renderer initialisé avec succès');
      
    } catch (error) {
      console.error('Erreur lors de l\'initialisation:', error);
      this.showError('Erreur d\'initialisation: ' + error.message);
    }
  }

  initializeComponents() {
    // Initialiser les composants principaux
    this.components = {
      dashboard: new Dashboard(),
      chat: new Chat(),
      userManagement: new UserManagement(),
      printSystem: new PrintSystem(),
      history: new History(),
      notificationManager: new NotificationManager()
    };

    // Rendre les composants disponibles globalement
    window.components = this.components;
    
    console.log('Composants initialisés:', Object.keys(this.components));
  }

  setupNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    navTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.closest('.nav-tab').dataset.tab;
        this.switchTab(tabName);
      });
    });

    console.log('Navigation configurée');
  }

  switchTab(tabName) {
    if (tabName === this.currentTab) return;

    // Mise à jour des onglets
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      }
    });

    // Mise à jour du contenu
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
      if (content.id === tabName) {
        content.classList.add('active');
      }
    });

    // Notifier le composant du changement
    if (this.components[tabName] && typeof this.components[tabName].onTabActivated === 'function') {
      this.components[tabName].onTabActivated();
    }

    this.currentTab = tabName;
    
    console.log('Onglet changé vers:', tabName);
  }

  setupGlobalEventListeners() {
    // Écouter les événements du processus principal
    if (typeof ipcRenderer !== 'undefined') {
      // Messages
      ipcRenderer.on('new-message', (event, messageData) => {
        this.handleNewMessage(messageData);
      });

      // Statistiques
      ipcRenderer.on('stats-update', (event, stats) => {
        this.handleStatsUpdate(stats);
      });

      // Statut de connexion
      ipcRenderer.on('connection-status', (event, status) => {
        this.handleConnectionStatus(status);
      });

      // Utilisateurs
      ipcRenderer.on('user-added', (event, userId) => {
        this.handleUserAdded(userId);
      });

      ipcRenderer.on('user-removed', (event, userId) => {
        this.handleUserRemoved(userId);
      });

      // Impression
      ipcRenderer.on('print-completed', (event, printData) => {
        this.handlePrintCompleted(printData);
      });

      // Erreurs
      ipcRenderer.on('app-error', (event, error) => {
        this.handleAppError(error);
      });

      // Notifications
      ipcRenderer.on('notification:display', (event, notification) => {
        this.displayNotification(notification);
      });

      ipcRenderer.on('notification:remove', (event, data) => {
        this.removeNotification(data.id);
      });

      ipcRenderer.on('notification:clear-all', () => {
        this.clearAllNotifications();
      });
    }

    // Raccourcis clavier
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcuts(e);
    });

    console.log('Écouteurs d\'événements globaux configurés');
  }

  setupElectronAPI() {
    // API simplifiée pour l'interface
    window.electronAPI = {
      // TikTok
      connectTikTok: (username) => ipcRenderer.invoke('connect-tiktok', username),
      disconnectTikTok: () => ipcRenderer.invoke('disconnect-tiktok'),
      
      // Utilisateurs
      addVerifiedUser: (userId) => ipcRenderer.invoke('add-verified-user', userId),
      removeVerifiedUser: (userId) => ipcRenderer.invoke('remove-verified-user', userId),
      getVerifiedUsers: () => ipcRenderer.invoke('get-verified-users'),
      
      // Impression
      printLabel: (labelData) => ipcRenderer.invoke('print-label', labelData),
      testPrinter: () => ipcRenderer.invoke('test-printer'),
      
      // Messages
      getMessages: (limit) => ipcRenderer.invoke('get-messages', limit),
      clearMessages: () => ipcRenderer.invoke('clear-messages'),
      searchMessages: (query, options) => ipcRenderer.invoke('search-messages', query, options),
      
      // Données
      getInitialData: () => ipcRenderer.invoke('get-initial-data'),
      getStats: () => ipcRenderer.invoke('get-stats'),
      getMessageStats: () => ipcRenderer.invoke('get-message-stats'),
      backupData: () => ipcRenderer.invoke('backup-data'),
      exportData: () => ipcRenderer.invoke('export-data'),
      
      // Notifications
      showNotification: (notificationData) => ipcRenderer.invoke('show-notification', notificationData)
    };

    console.log('API Electron configurée');
  }

  async loadInitialData() {
    try {
      const data = await window.electronAPI.getInitialData();
      
      // Distribuer les données aux composants
      if (this.components.dashboard) {
        this.components.dashboard.updateStats(data.stats);
        this.components.dashboard.updateConnectionStatus({ connected: data.isConnected });
      }

      if (this.components.userManagement) {
        this.components.userManagement.updateUsersList(data.verifiedUsers);
      }

      if (this.components.history) {
        this.components.history.updateHistory(data.printHistory);
      }

      console.log('Données initiales chargées:', data);
      
    } catch (error) {
      console.error('Erreur lors du chargement des données initiales:', error);
      this.showError('Impossible de charger les données initiales');
    }
  }

  // Gestionnaires d'événements
  handleNewMessage(messageData) {
    if (this.components.chat) {
      this.components.chat.addMessage(messageData);
    }

    if (this.components.dashboard) {
      this.components.dashboard.addMessageToPreview(messageData);
    }
  }

  handleStatsUpdate(stats) {
    if (this.components.dashboard) {
      this.components.dashboard.updateStats(stats);
    }
  }

  handleConnectionStatus(status) {
    if (this.components.dashboard) {
      this.components.dashboard.updateConnectionStatus(status);
    }

    // Notification de statut
    const message = status.connected 
      ? `Connecté au live de ${status.username}` 
      : 'Déconnecté du live TikTok';
    
    this.showNotification(status.connected ? 'success' : 'info', message);
  }

  handleUserAdded(userId) {
    if (this.components.userManagement) {
      this.components.userManagement.addUser(userId);
    }

    // Re-rendre les messages pour mettre à jour les badges
    if (this.components.chat) {
      this.components.chat.rerenderMessages();
    }
  }

  handleUserRemoved(userId) {
    if (this.components.userManagement) {
      this.components.userManagement.removeUser(userId);
    }

    // Re-rendre les messages pour mettre à jour les badges
    if (this.components.chat) {
      this.components.chat.rerenderMessages();
    }
  }

  handlePrintCompleted(printData) {
    if (this.components.history) {
      this.components.history.addPrintRecord(printData);
    }

    if (this.components.printSystem) {
      this.components.printSystem.onPrintCompleted(printData);
    }
  }

  handleAppError(error) {
    console.error('Erreur de l\'application:', error);
    this.showError(error.message || 'Une erreur est survenue');
  }

  // Raccourcis clavier
  handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + 1-5 pour changer d'onglet
    if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '5') {
      e.preventDefault();
      const tabs = ['dashboard', 'messages', 'users', 'print', 'history'];
      const tabIndex = parseInt(e.key) - 1;
      if (tabs[tabIndex]) {
        this.switchTab(tabs[tabIndex]);
      }
    }

    // Échap pour fermer les modales/notifications
    if (e.key === 'Escape') {
      this.closeModalsAndNotifications();
    }

    // Ctrl/Cmd + R pour rafraîchir les données
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      this.refreshData();
    }
  }

  closeModalsAndNotifications() {
    // Fermer les modales ouvertes
    document.querySelectorAll('.modal.show').forEach(modal => {
      modal.classList.remove('show');
    });

    // Effacer les notifications
    this.clearAllNotifications();
  }

  async refreshData() {
    try {
      await this.loadInitialData();
      this.showNotification('success', 'Données actualisées');
    } catch (error) {
      this.showError('Erreur lors de l\'actualisation des données');
    }
  }

  // Gestion des notifications
  displayNotification(notification) {
    if (this.components.notificationManager) {
      this.components.notificationManager.display(notification);
    }
  }

  removeNotification(notificationId) {
    if (this.components.notificationManager) {
      this.components.notificationManager.remove(notificationId);
    }
  }

  clearAllNotifications() {
    if (this.components.notificationManager) {
      this.components.notificationManager.clearAll();
    }
  }

  showNotification(type, message, title = null) {
    const notification = {
      type,
      message,
      title,
      timestamp: new Date().toISOString()
    };

    this.displayNotification(notification);
  }

  showError(message, title = 'Erreur') {
    this.showNotification('error', message, title);
  }

  showSuccess(message, title = 'Succès') {
    this.showNotification('success', message, title);
  }

  // Utilitaires
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatDate(date) {
    return new Date(date).toLocaleString('fr-FR');
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }

  // Nettoyage
  cleanup() {
    console.log('Nettoyage du renderer...');

    // Nettoyer les composants
    Object.values(this.components).forEach(component => {
      if (typeof component.destroy === 'function') {
        component.destroy();
      }
    });

    // Nettoyer les écouteurs d'événements
    if (typeof ipcRenderer !== 'undefined') {
      ipcRenderer.removeAllListeners();
    }

    console.log('Nettoyage du renderer terminé');
  }
}

// Classes de composants simplifiées (à compléter)
class UserManagement {
  constructor() {
    this.users = [];
    this.init();
  }

  init() {
    // Initialisation du composant de gestion des utilisateurs
  }

  updateUsersList(users) {
    this.users = users;
    this.render();
  }

  addUser(userId) {
    if (!this.users.includes(userId)) {
      this.users.push(userId);
      this.render();
    }
  }

  removeUser(userId) {
    this.users = this.users.filter(u => u !== userId);
    this.render();
  }

  render() {
    // Rendu de la liste des utilisateurs
  }
}

class PrintSystem {
  constructor() {
    this.init();
  }

  init() {
    // Initialisation du système d'impression
  }

  onPrintCompleted(printData) {
    // Gestion de l'impression terminée
  }
}

class History {
  constructor() {
    this.history = [];
    this.init();
  }

  init() {
    // Initialisation de l'historique
  }

  updateHistory(history) {
    this.history = history;
    this.render();
  }

  addPrintRecord(printData) {
    this.history.push(printData);
    this.render();
  }

  render() {
    // Rendu de l'historique
  }
}

class NotificationManager {
  constructor() {
    this.notifications = [];
    this.container = null;
    this.init();
  }

  init() {
    // Créer le conteneur de notifications
    this.container = document.getElementById('notifications') || this.createContainer();
  }

  createContainer() {
    const container = document.createElement('div');
    container.id = 'notifications';
    container.className = 'notification-container';
    document.body.appendChild(container);
    return container;
  }

  display(notification) {
    // Afficher une notification
    const element = this.createElement(notification);
    this.container.appendChild(element);
    
    // Supprimer automatiquement après la durée spécifiée
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        this.remove(notification.id);
      }, notification.duration);
    }
  }

  createElement(notification) {
    const div = document.createElement('div');
    div.className = `notification ${notification.type}`;
    div.dataset.id = notification.id;
    
    div.innerHTML = `
      <div class="notification-content">
        ${notification.title ? `<strong>${notification.title}</strong>` : ''}
        <p>${notification.message}</p>
      </div>
      <button class="notification-close" onclick="this.parentElement.remove()">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    return div;
  }

  remove(notificationId) {
    const element = this.container.querySelector(`[data-id="${notificationId}"]`);
    if (element) {
      element.remove();
    }
  }

  clearAll() {
    this.container.innerHTML = '';
  }
}

// Initialisation automatique
const tiktokLiveRenderer = new TikTokLiveRenderer();

// Export pour utilisation externe
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TikTokLiveRenderer;
} else {
  window.TikTokLiveRenderer = TikTokLiveRenderer;
  window.app = tiktokLiveRenderer;
}