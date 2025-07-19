/**
 * Module de gestion des messages
 */

const AppConfig = require('../../config/app-config');
const Logger = require('../../utils/logger');
const EventEmitter = require('../../utils/event-emitter');
const DataService = require('../../services/data-service');

class MessageManager {
  constructor() {
    this.messages = [];
    this.maxMessages = AppConfig.tiktok.maxMessages;
    this.filters = {
      verifiedOnly: false,
      keywords: [],
      blockedUsers: new Set()
    };
    
    this.setupEventListeners();
  }

  // Configuration des écouteurs d'événements
  setupEventListeners() {
    EventEmitter.on('message:new', (messageData) => {
      this.handleNewMessage(messageData);
    });
  }

  // Gestion d'un nouveau message
  handleNewMessage(messageData) {
    try {
      // Validation du message
      if (!this.validateMessage(messageData)) {
        Logger.warn('Message invalide reçu', messageData);
        return;
      }

      // Filtrage du message
      if (!this.shouldProcessMessage(messageData)) {
        Logger.debug('Message filtré', { user: messageData.nickname });
        return;
      }

      // Enrichissement du message
      const enrichedMessage = this.enrichMessage(messageData);

      // Ajout à la liste des messages
      this.addMessage(enrichedMessage);

      // Détection de commandes spéciales
      this.detectCommands(enrichedMessage);

      Logger.debug('Message traité', {
        user: enrichedMessage.nickname,
        verified: enrichedMessage.isVerified,
        messageLength: enrichedMessage.message.length
      });

    } catch (error) {
      Logger.error('Erreur lors du traitement du message', error);
    }
  }

  // Validation du message
  validateMessage(messageData) {
    return messageData &&
           messageData.userId &&
           messageData.nickname &&
           messageData.message &&
           messageData.timestamp;
  }

  // Filtrage des messages
  shouldProcessMessage(messageData) {
    // Filtre utilisateurs bloqués
    if (this.filters.blockedUsers.has(messageData.userId)) {
      return false;
    }

    // Filtre utilisateurs vérifiés uniquement
    if (this.filters.verifiedOnly && !messageData.isVerified) {
      return false;
    }

    // Filtre mots-clés
    if (this.filters.keywords.length > 0) {
      const messageText = messageData.message.toLowerCase();
      const hasKeyword = this.filters.keywords.some(keyword => 
        messageText.includes(keyword.toLowerCase())
      );
      
      if (!hasKeyword) {
        return false;
      }
    }

    return true;
  }

  // Enrichissement du message
  enrichMessage(messageData) {
    const enriched = {
      ...messageData,
      processedAt: new Date().toISOString(),
      wordCount: messageData.message.split(' ').length,
      hasEmojis: this.hasEmojis(messageData.message),
      containsUrl: this.containsUrl(messageData.message),
      sentiment: this.analyzeSentiment(messageData.message)
    };

    return enriched;
  }

  // Ajout d'un message à la liste
  addMessage(message) {
    this.messages.push(message);

    // Maintenir la limite de messages
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }

    // Émettre l'événement pour l'interface
    EventEmitter.emit('message:processed', message);
  }

  // Détection de commandes spéciales dans les messages
  detectCommands(message) {
    const text = message.message.toLowerCase().trim();

    // Commandes uniquement pour les utilisateurs vérifiés
    if (!message.isVerified) {
      return;
    }

    // Commande d'impression rapide: !print pseudo montant description
    if (text.startsWith('!print ')) {
      this.handlePrintCommand(message, text);
    }

    // Commande d'ajout d'utilisateur vérifié: !adduser username
    if (text.startsWith('!adduser ')) {
      this.handleAddUserCommand(message, text);
    }

    // Commande de statistiques: !stats
    if (text === '!stats') {
      this.handleStatsCommand(message);
    }
  }

  // Gestion de la commande d'impression
  handlePrintCommand(message, commandText) {
    try {
      const parts = commandText.split(' ').slice(1); // Enlever "!print"
      
      if (parts.length < 3) {
        Logger.warn('Commande !print invalide', { user: message.nickname, command: commandText });
        return;
      }

      const pseudo = parts[0];
      const montant = parseFloat(parts[1]);
      const description = parts.slice(2).join(' ');

      if (isNaN(montant)) {
        Logger.warn('Montant invalide dans commande !print', { user: message.nickname, montant: parts[1] });
        return;
      }

      Logger.info('Commande d\'impression reçue', {
        from: message.nickname,
        pseudo,
        montant,
        description
      });

      // Émettre un événement pour déclencher l'impression
      EventEmitter.emit('command:print', {
        requestedBy: message.nickname,
        pseudo,
        montant,
        description
      });

    } catch (error) {
      Logger.error('Erreur lors du traitement de la commande !print', error);
    }
  }

  // Gestion de la commande d'ajout d'utilisateur
  handleAddUserCommand(message, commandText) {
    try {
      const parts = commandText.split(' ');
      
      if (parts.length !== 2) {
        Logger.warn('Commande !adduser invalide', { user: message.nickname, command: commandText });
        return;
      }

      const userToAdd = parts[1];

      Logger.info('Commande d\'ajout d\'utilisateur reçue', {
        from: message.nickname,
        userToAdd
      });

      // Émettre un événement pour ajouter l'utilisateur
      EventEmitter.emit('command:adduser', {
        requestedBy: message.nickname,
        userToAdd
      });

    } catch (error) {
      Logger.error('Erreur lors du traitement de la commande !adduser', error);
    }
  }

  // Gestion de la commande de statistiques
  handleStatsCommand(message) {
    try {
      const stats = this.getMessageStats();
      
      Logger.info('Statistiques demandées', { by: message.nickname, stats });

      EventEmitter.emit('command:stats', {
        requestedBy: message.nickname,
        stats
      });

    } catch (error) {
      Logger.error('Erreur lors du traitement de la commande !stats', error);
    }
  }

  // Configuration des filtres
  setFilters(filters) {
    this.filters = { ...this.filters, ...filters };
    Logger.info('Filtres de messages mis à jour', this.filters);
  }

  // Blocage d'un utilisateur
  blockUser(userId) {
    this.filters.blockedUsers.add(userId);
    Logger.info(`Utilisateur bloqué: ${userId}`);
  }

  // Déblocage d'un utilisateur
  unblockUser(userId) {
    this.filters.blockedUsers.delete(userId);
    Logger.info(`Utilisateur débloqué: ${userId}`);
  }

  // Récupération des messages
  getMessages(limit = null) {
    if (limit) {
      return this.messages.slice(-limit);
    }
    return [...this.messages];
  }

  // Recherche dans les messages
  searchMessages(query, options = {}) {
    const {
      verifiedOnly = false,
      dateFrom = null,
      dateTo = null,
      caseSensitive = false
    } = options;

    let filteredMessages = this.messages;

    // Filtre par texte
    if (query) {
      const searchText = caseSensitive ? query : query.toLowerCase();
      filteredMessages = filteredMessages.filter(msg => {
        const messageText = caseSensitive ? msg.message : msg.message.toLowerCase();
        return messageText.includes(searchText);
      });
    }

    // Filtre utilisateurs vérifiés
    if (verifiedOnly) {
      filteredMessages = filteredMessages.filter(msg => msg.isVerified);
    }

    // Filtre par date (à implémenter si nécessaire)
    // if (dateFrom || dateTo) { ... }

    return filteredMessages;
  }

  // Statistiques des messages
  getMessageStats() {
    const totalMessages = this.messages.length;
    const verifiedMessages = this.messages.filter(msg => msg.isVerified).length;
    const averageWordCount = this.messages.reduce((sum, msg) => sum + (msg.wordCount || 0), 0) / totalMessages || 0;
    const messagesWithEmojis = this.messages.filter(msg => msg.hasEmojis).length;
    const messagesWithUrls = this.messages.filter(msg => msg.containsUrl).length;

    return {
      totalMessages,
      verifiedMessages,
      unverifiedMessages: totalMessages - verifiedMessages,
      averageWordCount: Math.round(averageWordCount * 100) / 100,
      messagesWithEmojis,
      messagesWithUrls,
      verifiedPercentage: Math.round((verifiedMessages / totalMessages) * 100) || 0
    };
  }

  // Nettoyage des messages
  clearMessages() {
    const clearedCount = this.messages.length;
    this.messages = [];
    
    Logger.info(`${clearedCount} messages effacés`);
    
    EventEmitter.emit('messages:cleared', { clearedCount });
    
    return clearedCount;
  }

  // Utilitaires
  hasEmojis(text) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    return emojiRegex.test(text);
  }

  containsUrl(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return urlRegex.test(text);
  }

  analyzeSentiment(text) {
    // Analyse de sentiment basique
    const positiveWords = ['super', 'génial', 'excellent', 'parfait', 'love', '❤️', '😍', '👍'];
    const negativeWords = ['nul', 'mauvais', 'horrible', 'déteste', '👎', '😢', '😡'];

    const lowerText = text.toLowerCase();
    
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  // Nettoyage
  cleanup() {
    this.clearMessages();
    Logger.debug('MessageManager: Nettoyage effectué');
  }
}

// Instance singleton
const messageManager = new MessageManager();

module.exports = messageManager;