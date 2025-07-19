const { ipcRenderer } = require('electron');

console.log('Renderer démarré');

// Variables globales
let currentTab = 'dashboard';
let messages = [];
let isConnected = false;

// Éléments DOM
const elements = {
  // Navigation
  navTabs: document.querySelectorAll('.nav-tab'),
  tabContents: document.querySelectorAll('.tab-content'),
  
  // Status
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  
  // Buttons
  connectBtn: document.getElementById('connectBtn'),
  disconnectBtn: document.getElementById('disconnectBtn'),
  clearMessages: document.getElementById('clearMessages'),
  
  // Stats
  messageCount: document.getElementById('messageCount'),
  verifiedCount: document.getElementById('verifiedCount'),
  printCount: document.getElementById('printCount'),
  
  // Messages
  messagesList: document.getElementById('messagesList'),
  messagesPreview: document.getElementById('messagesPreview'),
  
  // Users
  addUserForm: document.getElementById('addUserForm'),
  newUserInput: document.getElementById('newUserInput'),
  usersList: document.getElementById('usersList'),
  
  // Print
  printForm: document.getElementById('printForm'),
  printPseudo: document.getElementById('printPseudo'),
  printMontant: document.getElementById('printMontant'),
  printDescription: document.getElementById('printDescription'),
  
  // History
  historyList: document.getElementById('historyList'),
  historyCount: document.getElementById('historyCount'),
  
  // Connection info
  roomInfo: document.getElementById('roomInfo'),
  roomId: document.getElementById('roomId'),
  
  // Notifications
  notifications: document.getElementById('notifications')
};

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM chargé, initialisation...');
  setupEventListeners();
  await loadInitialData();
  console.log('Initialisation terminée');
});

// Configuration des écouteurs d'événements
function setupEventListeners() {
  console.log('Configuration des écouteurs d\'événements');
  
  // Navigation
  elements.navTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabName = e.target.closest('.nav-tab').dataset.tab;
      console.log('Changement d\'onglet vers:', tabName);
      switchTab(tabName);
    });
  });
  
  // Connexion
  if (elements.connectBtn) {
    elements.connectBtn.addEventListener('click', () => {
      console.log('Clic sur bouton connexion');
      connectToTikTok();
    });
  }
  
  if (elements.disconnectBtn) {
    elements.disconnectBtn.addEventListener('click', () => {
      console.log('Clic sur bouton déconnexion');
      disconnectFromTikTok();
    });
  }
  
  // Messages
  if (elements.clearMessages) {
    elements.clearMessages.addEventListener('click', () => {
      console.log('Clic sur effacer messages');
      clearMessages();
    });
  }
  
  // Utilisateurs
  if (elements.addUserForm) {
    elements.addUserForm.addEventListener('submit', (e) => {
      console.log('Soumission formulaire utilisateur');
      addVerifiedUser(e);
    });
  }
  
  // Impression
  if (elements.printForm) {
    elements.printForm.addEventListener('submit', (e) => {
      console.log('Soumission formulaire impression');
      printLabel(e);
    });
  }
  
  // Écouter les messages du processus principal
  ipcRenderer.on('new-message', (event, messageData) => {
    console.log('Nouveau message reçu:', messageData);
    addMessage(messageData);
  });
  
  ipcRenderer.on('stats-update', (event, stats) => {
    console.log('Mise à jour stats:', stats);
    updateStats(stats);
  });
  
  console.log('Écouteurs d\'événements configurés');
}

// Charger les données initiales
async function loadInitialData() {
  try {
    console.log('Chargement des données initiales...');
    const data = await ipcRenderer.invoke('get-initial-data');
    console.log('Données reçues:', data);
    
    updateStats(data.stats);
    updateConnectionStatus(data.isConnected);
    renderVerifiedUsers(data.verifiedUsers);
    renderPrintHistory(data.printHistory);
    
    showNotification('Application initialisée avec succès', 'success');
  } catch (error) {
    console.error('Erreur lors du chargement des données:', error);
    showNotification('Erreur lors du chargement des données', 'error');
  }
}

// Navigation entre les onglets
function switchTab(tabName) {
  console.log('Changement vers onglet:', tabName);
  
  // Mise à jour des onglets
  elements.navTabs.forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    }
  });
  
  // Mise à jour du contenu
  elements.tabContents.forEach(content => {
    content.classList.remove('active');
    if (content.id === tabName) {
      content.classList.add('active');
    }
  });
  
  currentTab = tabName;
}

// Connexion TikTok
async function connectToTikTok() {
  try {
    console.log('Tentative de connexion TikTok...');
    setConnectButtonLoading(true);
    
    const result = await ipcRenderer.invoke('connect-tiktok', 'izatcolis');
    console.log('Résultat connexion:', result);
    
    if (result.success) {
      isConnected = true;
      updateConnectionStatus(true);
      if (result.roomId && elements.roomId) {
        elements.roomId.textContent = result.roomId;
        elements.roomInfo.style.display = 'block';
      }
      showNotification('Connexion réussie au live TikTok', 'success');
    } else {
      // En cas d'échec, garder le statut déconnecté et réactiver le bouton
      isConnected = false;
      updateConnectionStatus(false);
      showNotification('Erreur de connexion: ' + result.message, 'error');
    }
  } catch (error) {
    console.error('Erreur de connexion:', error);
    // En cas d'erreur, garder le statut déconnecté et réactiver le bouton
    isConnected = false;
    updateConnectionStatus(false);
    showNotification('Erreur de connexion', 'error');
  } finally {
    setConnectButtonLoading(false);
  }
}

// Déconnexion TikTok
async function disconnectFromTikTok() {
  try {
    console.log('Tentative de déconnexion TikTok...');
    setDisconnectButtonLoading(true);
    
    const result = await ipcRenderer.invoke('disconnect-tiktok');
    console.log('Résultat déconnexion:', result);
    
    if (result.success) {
      isConnected = false;
      updateConnectionStatus(false);
      clearMessages();
      if (elements.roomInfo) {
        elements.roomInfo.style.display = 'none';
      }
      showNotification('Déconnexion réussie', 'success');
    } else {
      showNotification('Erreur de déconnexion: ' + result.message, 'error');
    }
  } catch (error) {
    console.error('Erreur de déconnexion:', error);
    showNotification('Erreur de déconnexion', 'error');
  } finally {
    setDisconnectButtonLoading(false);
  }
}

// Mise à jour du statut de connexion
function updateConnectionStatus(connected) {
  console.log('Mise à jour statut connexion:', connected);
  isConnected = connected;
  
  if (connected) {
    if (elements.statusDot) elements.statusDot.classList.add('connected');
    if (elements.statusText) elements.statusText.textContent = 'Connecté';
    if (elements.connectBtn) elements.connectBtn.disabled = true;
    if (elements.disconnectBtn) elements.disconnectBtn.disabled = false;
  } else {
    if (elements.statusDot) elements.statusDot.classList.remove('connected');
    if (elements.statusText) elements.statusText.textContent = 'Déconnecté';
    if (elements.connectBtn) elements.connectBtn.disabled = false;
    if (elements.disconnectBtn) elements.disconnectBtn.disabled = true;
  }
}

// Mise à jour des statistiques
function updateStats(stats) {
  console.log('Mise à jour statistiques:', stats);
  
  if (elements.messageCount) {
    elements.messageCount.textContent = stats.messageCount;
  }
  
  if (elements.verifiedCount) {
    elements.verifiedCount.textContent = stats.verifiedUserCount;
  }
  
  if (elements.printCount) {
    elements.printCount.textContent = stats.printCount;
  }

  if (elements.historyCount) {
    elements.historyCount.textContent = `${stats.printCount} impression(s)`;
  }
}

// Ajout d'un message
function addMessage(messageData) {
  console.log('Ajout message:', messageData);
  messages.push(messageData);
  
  // Limiter le nombre de messages
  if (messages.length > 1000) {
    messages = messages.slice(-1000);
  }
  
  renderMessages();
}

// Rendu des messages
function renderMessages() {
  if (!elements.messagesList) return;
  
  const messagesHtml = messages.map(msg => `
    <div class="message-item ${msg.isVerified ? 'verified' : ''}">
      <div class="message-header">
        <span class="message-time">${msg.timestamp}</span>
        <span class="message-user ${msg.isVerified ? 'verified' : ''}">
          ${msg.isVerified ? '<i class="fas fa-star verified-badge"></i>' : ''}
          ${escapeHtml(msg.nickname)}
        </span>
        <span class="message-user-id">(${escapeHtml(msg.userId)})</span>
      </div>
      <div class="message-content">${escapeHtml(msg.message)}</div>
    </div>
  `).join('');
  
  if (messages.length === 0) {
    elements.messagesList.innerHTML = '<p class="no-messages">Connectez-vous pour voir les messages en temps réel</p>';
    if (elements.messagesPreview) {
      elements.messagesPreview.innerHTML = '<p class="no-messages">Connectez-vous pour voir les messages</p>';
    }
  } else {
    elements.messagesList.innerHTML = messagesHtml;
    
    if (elements.messagesPreview) {
      elements.messagesPreview.innerHTML = messages.slice(-5).map(msg => `
        <div class="message-item ${msg.isVerified ? 'verified' : ''}">
          <div class="message-header">
            <span class="message-time">${msg.timestamp}</span>
            <span class="message-user ${msg.isVerified ? 'verified' : ''}">
              ${msg.isVerified ? '<i class="fas fa-star verified-badge"></i>' : ''}
              ${escapeHtml(msg.nickname)}
            </span>
          </div>
          <div class="message-content">${escapeHtml(msg.message)}</div>
        </div>
      `).join('');
    }
    
    // Scroll vers le bas
    elements.messagesList.scrollTop = elements.messagesList.scrollHeight;
  }
}

// Effacer les messages
function clearMessages() {
  console.log('Effacement des messages');
  messages = [];
  renderMessages();
}

// Ajouter un utilisateur vérifié
async function addVerifiedUser(e) {
  e.preventDefault();
  
  const userId = elements.newUserInput.value.trim();
  if (!userId) return;
  
  try {
    console.log('Ajout utilisateur:', userId);
    const result = await ipcRenderer.invoke('add-verified-user', userId);
    console.log('Résultat ajout utilisateur:', result);
    
    if (result.success) {
      renderVerifiedUsers(result.verifiedUsers);
      updateStats(result.stats);
      elements.newUserInput.value = '';
      showNotification(`Utilisateur ${userId} ajouté avec succès`, 'success');
    } else {
      showNotification(result.message, 'warning');
    }
  } catch (error) {
    console.error('Erreur lors de l\'ajout de l\'utilisateur:', error);
    showNotification('Erreur lors de l\'ajout de l\'utilisateur', 'error');
  }
}

// Supprimer un utilisateur vérifié
async function removeVerifiedUser(userId) {
  try {
    console.log('Suppression utilisateur:', userId);
    const result = await ipcRenderer.invoke('remove-verified-user', userId);
    console.log('Résultat suppression utilisateur:', result);
    
    if (result.success) {
      renderVerifiedUsers(result.verifiedUsers);
      updateStats(result.stats);
      showNotification(`Utilisateur ${userId} supprimé`, 'success');
    } else {
      showNotification(result.message, 'warning');
    }
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', error);
    showNotification('Erreur lors de la suppression de l\'utilisateur', 'error');
  }
}

// Rendu des utilisateurs vérifiés
function renderVerifiedUsers(users) {
  if (!elements.usersList) return;
  
  if (users.length === 0) {
    elements.usersList.innerHTML = '<p class="no-users">Aucun utilisateur vérifié</p>';
    return;
  }
  
  const usersHtml = users.map(user => `
    <div class="user-item">
      <div class="user-info">
        <i class="fas fa-star"></i>
        <span class="user-name">${escapeHtml(user)}</span>
      </div>
      <button class="btn btn-danger" onclick="removeVerifiedUser('${escapeHtml(user)}')">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');
  
  elements.usersList.innerHTML = usersHtml;
}

// Imprimer une étiquette
async function printLabel(e) {
  e.preventDefault();
  
  const pseudo = elements.printPseudo.value.trim();
  const montant = parseFloat(elements.printMontant.value);
  const description = elements.printDescription.value.trim();
  
  if (!pseudo || isNaN(montant) || !description) {
    showNotification('Veuillez remplir tous les champs', 'warning');
    return;
  }
  
  try {
    console.log('Impression étiquette:', { pseudo, montant, description });
    const printBtn = elements.printForm.querySelector('button[type="submit"]');
    const originalHtml = printBtn.innerHTML;
    printBtn.disabled = true;
    printBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Impression...';
    
    const result = await ipcRenderer.invoke('print-label', {
      pseudo,
      montant,
      description
    });
    
    console.log('Résultat impression:', result);
    
    if (result.success) {
      renderPrintHistory(result.printHistory);
      updateStats(result.stats);
      elements.printForm.reset();
      showNotification(`Étiquette imprimée: ${result.printData.reference}`, 'success');
    } else {
      showNotification('Erreur d\'impression: ' + result.message, 'error');
    }
    
    printBtn.disabled = false;
    printBtn.innerHTML = originalHtml;
  } catch (error) {
    console.error('Erreur d\'impression:', error);
    showNotification('Erreur d\'impression', 'error');
    
    const printBtn = elements.printForm.querySelector('button[type="submit"]');
    printBtn.disabled = false;
    printBtn.innerHTML = '<i class="fas fa-print"></i> Imprimer l\'Étiquette';
  }
}

// Rendu de l'historique d'impression
function renderPrintHistory(history) {
  if (!elements.historyList) return;
  
  if (history.length === 0) {
    elements.historyList.innerHTML = '<p class="no-history">Aucune impression dans l\'historique</p>';
    return;
  }
  
  const historyHtml = history.slice(-50).reverse().map(item => `
    <div class="history-item">
      <div class="history-header-item">
        <span class="history-reference">${item.reference}</span>
        <span class="history-datetime">${item.date} ${item.timestamp}</span>
      </div>
      <div class="history-details">
        <div class="history-detail">
          <span class="history-detail-label">Pseudo</span>
          <span class="history-detail-value">${escapeHtml(item.pseudo)}</span>
        </div>
        <div class="history-detail">
          <span class="history-detail-label">Montant</span>
          <span class="history-detail-value">${item.montant}€</span>
        </div>
        <div class="history-detail">
          <span class="history-detail-label">Description</span>
          <span class="history-detail-value">${escapeHtml(item.description)}</span>
        </div>
      </div>
    </div>
  `).join('');
  
  elements.historyList.innerHTML = historyHtml;
}

// Boutons de chargement
function setConnectButtonLoading(loading) {
  if (!elements.connectBtn) return;
  
  if (loading) {
    elements.connectBtn.disabled = true;
    elements.connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion...';
  } else {
    elements.connectBtn.innerHTML = '<i class="fas fa-play"></i> Se connecter';
  }
}

function setDisconnectButtonLoading(loading) {
  if (!elements.disconnectBtn) return;
  
  if (loading) {
    elements.disconnectBtn.disabled = true;
    elements.disconnectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Déconnexion...';
  } else {
    elements.disconnectBtn.innerHTML = '<i class="fas fa-stop"></i> Se déconnecter';
  }
}

// Afficher une notification
function showNotification(message, type = 'info') {
  console.log('Notification:', type, message);
  
  if (!elements.notifications) return;
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <strong>${type === 'success' ? 'Succès' : type === 'error' ? 'Erreur' : type === 'warning' ? 'Attention' : 'Info'}</strong>
      <p>${message}</p>
    </div>
  `;
  
  elements.notifications.appendChild(notification);
  
  // Supprimer la notification après 5 secondes
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);
  
  // Limiter le nombre de notifications
  const notifications = elements.notifications.querySelectorAll('.notification');
  if (notifications.length > 3) {
    notifications[0].remove();
  }
}

// Utilitaires
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Rendre les fonctions disponibles globalement
window.removeVerifiedUser = removeVerifiedUser;

console.log('Renderer configuré');