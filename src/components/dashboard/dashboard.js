/**
 * Composant Dashboard
 */

class Dashboard {
  constructor() {
    this.elements = {};
    this.stats = {
      messageCount: 0,
      verifiedUserCount: 0,
      printCount: 0
    };
    
    this.init();
  }

  init() {
    this.bindElements();
    this.setupEventListeners();
    this.render();
  }

  bindElements() {
    this.elements = {
      container: document.getElementById('dashboard'),
      messageCount: document.getElementById('messageCount'),
      verifiedCount: document.getElementById('verifiedCount'),
      printCount: document.getElementById('printCount'),
      connectBtn: document.getElementById('connectBtn'),
      disconnectBtn: document.getElementById('disconnectBtn'),
      roomInfo: document.getElementById('roomInfo'),
      roomId: document.getElementById('roomId'),
      messagesPreview: document.getElementById('messagesPreview')
    };
  }

  setupEventListeners() {
    // Boutons de connexion
    if (this.elements.connectBtn) {
      this.elements.connectBtn.addEventListener('click', () => {
        this.handleConnect();
      });
    }

    if (this.elements.disconnectBtn) {
      this.elements.disconnectBtn.addEventListener('click', () => {
        this.handleDisconnect();
      });
    }

    // Écouter les événements de l'application
    if (typeof ipcRenderer !== 'undefined') {
      ipcRenderer.on('stats:update', (event, stats) => {
        this.updateStats(stats);
      });

      ipcRenderer.on('connection:status', (event, status) => {
        this.updateConnectionStatus(status);
      });

      ipcRenderer.on('message:new', (event, message) => {
        this.addMessageToPreview(message);
      });
    }
  }

  async handleConnect() {
    try {
      this.setConnectButtonLoading(true);
      
      const result = await window.electronAPI.connectTikTok('izatcolis');
      
      if (result.success) {
        this.showConnectionSuccess(result);
      } else {
        this.showConnectionError(result.message);
      }
    } catch (error) {
      console.error('Erreur de connexion:', error);
      this.showConnectionError('Erreur de connexion');
    } finally {
      this.setConnectButtonLoading(false);
    }
  }

  async handleDisconnect() {
    try {
      this.setDisconnectButtonLoading(true);
      
      const result = await window.electronAPI.disconnectTikTok();
      
      if (result.success) {
        this.showDisconnectionSuccess();
      } else {
        this.showDisconnectionError(result.message);
      }
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
      this.showDisconnectionError('Erreur de déconnexion');
    } finally {
      this.setDisconnectButtonLoading(false);
    }
  }

  updateStats(stats) {
    this.stats = { ...this.stats, ...stats };
    
    if (this.elements.messageCount) {
      this.elements.messageCount.textContent = this.stats.messageCount;
    }
    
    if (this.elements.verifiedCount) {
      this.elements.verifiedCount.textContent = this.stats.verifiedUserCount;
    }
    
    if (this.elements.printCount) {
      this.elements.printCount.textContent = this.stats.printCount;
    }

    this.animateStatUpdate();
  }

  updateConnectionStatus(status) {
    const isConnected = status.connected;
    
    // Mise à jour des boutons
    if (this.elements.connectBtn) {
      this.elements.connectBtn.disabled = isConnected;
    }
    
    if (this.elements.disconnectBtn) {
      this.elements.disconnectBtn.disabled = !isConnected;
    }

    // Mise à jour des informations de room
    if (status.roomId && this.elements.roomId) {
      this.elements.roomId.textContent = status.roomId;
      this.elements.roomInfo.style.display = 'block';
    } else if (this.elements.roomInfo) {
      this.elements.roomInfo.style.display = 'none';
    }

    // Animation du statut
    this.animateConnectionStatus(isConnected);
  }

  addMessageToPreview(message) {
    if (!this.elements.messagesPreview) return;

    const messageElement = this.createMessagePreviewElement(message);
    this.elements.messagesPreview.appendChild(messageElement);

    // Maintenir seulement les 5 derniers messages
    const messages = this.elements.messagesPreview.children;
    if (messages.length > 5) {
      this.elements.messagesPreview.removeChild(messages[0]);
    }

    // Scroll vers le bas
    this.elements.messagesPreview.scrollTop = this.elements.messagesPreview.scrollHeight;
  }

  createMessagePreviewElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-item ${message.isVerified ? 'verified' : ''}`;
    
    messageDiv.innerHTML = `
      <div class="message-header">
        <span class="message-time">${message.timestamp}</span>
        <span class="message-user ${message.isVerified ? 'verified' : ''}">
          ${message.isVerified ? '<i class="fas fa-star verified-badge"></i>' : ''}
          ${this.escapeHtml(message.nickname)}
        </span>
      </div>
      <div class="message-content">${this.escapeHtml(message.message)}</div>
    `;

    // Animation d'apparition
    messageDiv.style.opacity = '0';
    messageDiv.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
      messageDiv.style.transition = 'all 0.3s ease';
      messageDiv.style.opacity = '1';
      messageDiv.style.transform = 'translateY(0)';
    }, 10);

    return messageDiv;
  }

  setConnectButtonLoading(loading) {
    if (!this.elements.connectBtn) return;
    
    if (loading) {
      this.elements.connectBtn.disabled = true;
      this.elements.connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion...';
    } else {
      this.elements.connectBtn.innerHTML = '<i class="fas fa-play"></i> Se connecter';
    }
  }

  setDisconnectButtonLoading(loading) {
    if (!this.elements.disconnectBtn) return;
    
    if (loading) {
      this.elements.disconnectBtn.disabled = true;
      this.elements.disconnectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Déconnexion...';
    } else {
      this.elements.disconnectBtn.innerHTML = '<i class="fas fa-stop"></i> Se déconnecter';
    }
  }

  showConnectionSuccess(result) {
    this.showNotification('success', `Connexion réussie${result.roomId ? ` (Room: ${result.roomId})` : ''}`);
  }

  showConnectionError(message) {
    this.showNotification('error', `Erreur de connexion: ${message}`);
  }

  showDisconnectionSuccess() {
    this.showNotification('success', 'Déconnexion réussie');
    this.clearMessagesPreview();
  }

  showDisconnectionError(message) {
    this.showNotification('error', `Erreur de déconnexion: ${message}`);
  }

  clearMessagesPreview() {
    if (this.elements.messagesPreview) {
      this.elements.messagesPreview.innerHTML = '<p class="no-messages">Connectez-vous pour voir les messages</p>';
    }
  }

  animateStatUpdate() {
    // Animation des statistiques
    document.querySelectorAll('.stat-card').forEach(card => {
      card.style.transform = 'scale(1.02)';
      setTimeout(() => {
        card.style.transform = 'scale(1)';
      }, 150);
    });
  }

  animateConnectionStatus(isConnected) {
    const statusDot = document.getElementById('statusDot');
    if (statusDot) {
      statusDot.style.transform = 'scale(1.2)';
      setTimeout(() => {
        statusDot.style.transform = 'scale(1)';
      }, 300);
    }
  }

  showNotification(type, message) {
    if (window.notificationManager) {
      window.notificationManager.show(type, message);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  render() {
    // Rendu initial du dashboard
    if (this.elements.container && !this.elements.container.classList.contains('dashboard-initialized')) {
      this.elements.container.classList.add('dashboard-initialized');
      
      // Animations d'initialisation
      this.animateInitialization();
    }
  }

  animateInitialization() {
    const cards = document.querySelectorAll('.stat-card');
    cards.forEach((card, index) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      
      setTimeout(() => {
        card.style.transition = 'all 0.5s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, index * 100);
    });
  }

  destroy() {
    // Nettoyage des écouteurs d'événements
    if (typeof ipcRenderer !== 'undefined') {
      ipcRenderer.removeAllListeners('stats:update');
      ipcRenderer.removeAllListeners('connection:status');
      ipcRenderer.removeAllListeners('message:new');
    }
  }
}

// Export pour utilisation
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Dashboard;
} else {
  window.Dashboard = Dashboard;
}