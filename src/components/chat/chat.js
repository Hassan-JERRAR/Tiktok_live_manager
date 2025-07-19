/**
 * Composant Chat
 */

class Chat {
  constructor() {
    this.messages = [];
    this.elements = {};
    this.maxMessages = 1000;
    this.autoScroll = true;
    this.filters = {
      verifiedOnly: false,
      search: ''
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
      container: document.getElementById('messages'),
      messagesList: document.getElementById('messagesList'),
      clearMessages: document.getElementById('clearMessages'),
      searchInput: document.createElement('input'), // À ajouter dans le HTML
      verifiedFilter: document.createElement('input'), // À ajouter dans le HTML
      messageCount: document.createElement('span') // À ajouter dans le HTML
    };
  }

  setupEventListeners() {
    // Bouton d'effacement
    if (this.elements.clearMessages) {
      this.elements.clearMessages.addEventListener('click', () => {
        this.clearMessages();
      });
    }

    // Scroll automatique
    if (this.elements.messagesList) {
      this.elements.messagesList.addEventListener('scroll', () => {
        this.handleScroll();
      });
    }

    // Filtres
    if (this.elements.searchInput) {
      this.elements.searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value;
        this.filterAndRenderMessages();
      });
    }

    if (this.elements.verifiedFilter) {
      this.elements.verifiedFilter.addEventListener('change', (e) => {
        this.filters.verifiedOnly = e.target.checked;
        this.filterAndRenderMessages();
      });
    }

    // Écouter les nouveaux messages
    if (typeof ipcRenderer !== 'undefined') {
      ipcRenderer.on('message:new', (event, message) => {
        this.addMessage(message);
      });

      ipcRenderer.on('messages:cleared', (event, data) => {
        this.handleMessagesCleared(data);
      });
    }
  }

  addMessage(message) {
    // Validation du message
    if (!this.validateMessage(message)) {
      console.warn('Message invalide reçu:', message);
      return;
    }

    // Ajout à la liste
    this.messages.push(message);

    // Maintenir la limite
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }

    // Rendu si pas de filtre ou si message correspond aux filtres
    if (this.shouldDisplayMessage(message)) {
      this.renderNewMessage(message);
    }

    // Mise à jour du compteur
    this.updateMessageCount();

    // Animation de notification pour les utilisateurs vérifiés
    if (message.isVerified) {
      this.showVerifiedUserNotification(message);
    }
  }

  validateMessage(message) {
    return message &&
           message.id &&
           message.userId &&
           message.nickname &&
           message.message &&
           message.timestamp;
  }

  shouldDisplayMessage(message) {
    // Filtre utilisateurs vérifiés
    if (this.filters.verifiedOnly && !message.isVerified) {
      return false;
    }

    // Filtre recherche
    if (this.filters.search) {
      const searchTerm = this.filters.search.toLowerCase();
      const messageText = message.message.toLowerCase();
      const nickname = message.nickname.toLowerCase();
      
      if (!messageText.includes(searchTerm) && !nickname.includes(searchTerm)) {
        return false;
      }
    }

    return true;
  }

  renderNewMessage(message) {
    if (!this.elements.messagesList) return;

    const messageElement = this.createMessageElement(message);
    this.elements.messagesList.appendChild(messageElement);

    // Animation d'apparition
    this.animateMessageAppearance(messageElement);

    // Scroll automatique si activé
    if (this.autoScroll) {
      this.scrollToBottom();
    }

    // Maintenir la limite d'affichage
    this.limitDisplayedMessages();
  }

  createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-item ${message.isVerified ? 'verified' : ''}`;
    messageDiv.dataset.messageId = message.id;
    
    messageDiv.innerHTML = `
      <div class="message-header">
        <span class="message-time">${message.timestamp}</span>
        <span class="message-user ${message.isVerified ? 'verified' : ''}">
          ${message.isVerified ? '<i class="fas fa-star verified-badge"></i>' : ''}
          ${this.escapeHtml(message.nickname)}
        </span>
        <span class="message-user-id">(${this.escapeHtml(message.userId)})</span>
        ${this.createMessageActions(message)}
      </div>
      <div class="message-content">${this.formatMessageContent(message.message)}</div>
      ${this.createMessageMetadata(message)}
    `;

    return messageDiv;
  }

  createMessageActions(message) {
    return `
      <div class="message-actions">
        <button class="action-btn" onclick="window.chatComponent.copyMessage('${message.id}')" title="Copier">
          <i class="fas fa-copy"></i>
        </button>
        ${!message.isVerified ? `
          <button class="action-btn" onclick="window.chatComponent.promoteUser('${this.escapeHtml(message.userId)}')" title="Vérifier utilisateur">
            <i class="fas fa-star"></i>
          </button>
        ` : ''}
        <button class="action-btn" onclick="window.chatComponent.blockUser('${this.escapeHtml(message.userId)}')" title="Bloquer utilisateur">
          <i class="fas fa-ban"></i>
        </button>
      </div>
    `;
  }

  createMessageMetadata(message) {
    if (!message.wordCount && !message.hasEmojis && !message.containsUrl) {
      return '';
    }

    return `
      <div class="message-metadata">
        ${message.wordCount ? `<span class="metadata-item">${message.wordCount} mots</span>` : ''}
        ${message.hasEmojis ? `<span class="metadata-item"><i class="fas fa-smile"></i> Emojis</span>` : ''}
        ${message.containsUrl ? `<span class="metadata-item"><i class="fas fa-link"></i> Lien</span>` : ''}
        ${message.sentiment ? `<span class="metadata-item sentiment-${message.sentiment}">${message.sentiment}</span>` : ''}
      </div>
    `;
  }

  formatMessageContent(content) {
    // Échapper le HTML
    let formatted = this.escapeHtml(content);

    // Détecter et formater les URLs
    formatted = this.formatUrls(formatted);

    // Détecter et formater les mentions
    formatted = this.formatMentions(formatted);

    // Détecter et formater les hashtags
    formatted = this.formatHashtags(formatted);

    return formatted;
  }

  formatUrls(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, '<a href="$1" target="_blank" class="message-link">$1</a>');
  }

  formatMentions(text) {
    const mentionRegex = /@(\w+)/g;
    return text.replace(mentionRegex, '<span class="message-mention">@$1</span>');
  }

  formatHashtags(text) {
    const hashtagRegex = /#(\w+)/g;
    return text.replace(hashtagRegex, '<span class="message-hashtag">#$1</span>');
  }

  animateMessageAppearance(messageElement) {
    messageElement.style.opacity = '0';
    messageElement.style.transform = 'translateX(-20px)';
    
    setTimeout(() => {
      messageElement.style.transition = 'all 0.3s ease';
      messageElement.style.opacity = '1';
      messageElement.style.transform = 'translateX(0)';
    }, 10);
  }

  scrollToBottom() {
    if (this.elements.messagesList) {
      this.elements.messagesList.scrollTop = this.elements.messagesList.scrollHeight;
    }
  }

  handleScroll() {
    if (!this.elements.messagesList) return;
    
    const { scrollTop, scrollHeight, clientHeight } = this.elements.messagesList;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50;
    
    // Désactiver le scroll automatique si l'utilisateur scroll vers le haut
    this.autoScroll = isAtBottom;

    // Afficher/masquer le bouton "aller en bas"
    this.toggleScrollToBottomButton(!isAtBottom);
  }

  toggleScrollToBottomButton(show) {
    let button = document.getElementById('scrollToBottomBtn');
    
    if (show && !button) {
      button = document.createElement('button');
      button.id = 'scrollToBottomBtn';
      button.className = 'scroll-to-bottom-btn';
      button.innerHTML = '<i class="fas fa-arrow-down"></i>';
      button.onclick = () => {
        this.scrollToBottom();
        this.autoScroll = true;
      };
      
      this.elements.container.appendChild(button);
    } else if (!show && button) {
      button.remove();
    }
  }

  limitDisplayedMessages() {
    if (!this.elements.messagesList) return;
    
    const messages = this.elements.messagesList.children;
    const maxDisplayed = 500;
    
    if (messages.length > maxDisplayed) {
      for (let i = 0; i < messages.length - maxDisplayed; i++) {
        this.elements.messagesList.removeChild(messages[i]);
      }
    }
  }

  clearMessages() {
    this.messages = [];
    
    if (this.elements.messagesList) {
      this.elements.messagesList.innerHTML = '<p class="no-messages">Messages effacés</p>';
    }
    
    this.updateMessageCount();
    this.showNotification('info', 'Messages effacés');
  }

  filterAndRenderMessages() {
    if (!this.elements.messagesList) return;
    
    // Effacer l'affichage actuel
    this.elements.messagesList.innerHTML = '';
    
    // Filtrer et afficher les messages
    const filteredMessages = this.messages.filter(message => this.shouldDisplayMessage(message));
    
    if (filteredMessages.length === 0) {
      this.elements.messagesList.innerHTML = '<p class="no-messages">Aucun message ne correspond aux filtres</p>';
      return;
    }
    
    // Afficher les messages filtrés
    filteredMessages.forEach(message => {
      const messageElement = this.createMessageElement(message);
      this.elements.messagesList.appendChild(messageElement);
    });
    
    // Scroll vers le bas
    this.scrollToBottom();
  }

  updateMessageCount() {
    if (this.elements.messageCount) {
      this.elements.messageCount.textContent = this.messages.length;
    }
  }

  showVerifiedUserNotification(message) {
    // Animation spéciale pour les utilisateurs vérifiés
    const notification = document.createElement('div');
    notification.className = 'verified-user-notification';
    notification.innerHTML = `
      <i class="fas fa-star"></i>
      Message de ${this.escapeHtml(message.nickname)} (vérifié)
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // Actions sur les messages
  copyMessage(messageId) {
    const message = this.messages.find(m => m.id === messageId);
    if (message) {
      navigator.clipboard.writeText(message.message).then(() => {
        this.showNotification('success', 'Message copié');
      });
    }
  }

  async promoteUser(userId) {
    try {
      const result = await window.electronAPI.addVerifiedUser(userId);
      if (result.success) {
        this.showNotification('success', `Utilisateur ${userId} promu`);
        this.rerenderMessages(); // Re-rendre pour mettre à jour les badges
      } else {
        this.showNotification('error', result.message);
      }
    } catch (error) {
      this.showNotification('error', 'Erreur lors de la promotion');
    }
  }

  async blockUser(userId) {
    // Cette fonctionnalité pourrait être ajoutée dans le MessageManager
    this.showNotification('info', `Utilisateur ${userId} bloqué (fonctionnalité à implémenter)`);
  }

  rerenderMessages() {
    // Re-rendre tous les messages pour mettre à jour les statuts
    this.filterAndRenderMessages();
  }

  handleMessagesCleared(data) {
    this.clearMessages();
    this.showNotification('info', `${data.clearedCount} messages effacés`);
  }

  // Recherche dans les messages
  searchMessages(query) {
    this.filters.search = query;
    this.filterAndRenderMessages();
  }

  // Export des messages
  exportMessages() {
    const exportData = {
      exportDate: new Date().toISOString(),
      totalMessages: this.messages.length,
      messages: this.messages
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `tiktok-messages-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    this.showNotification('success', 'Messages exportés');
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
    // Rendu initial
    if (this.elements.container && !this.elements.container.classList.contains('chat-initialized')) {
      this.elements.container.classList.add('chat-initialized');
      
      if (this.elements.messagesList) {
        this.elements.messagesList.innerHTML = '<p class="no-messages">Connectez-vous pour voir les messages en temps réel</p>';
      }
    }
  }

  destroy() {
    // Nettoyage
    if (typeof ipcRenderer !== 'undefined') {
      ipcRenderer.removeAllListeners('message:new');
      ipcRenderer.removeAllListeners('messages:cleared');
    }
  }
}

// Export pour utilisation
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Chat;
} else {
  window.Chat = Chat;
  window.chatComponent = new Chat(); // Instance globale pour les actions
}