/**
 * Module de gestion des utilisateurs vérifiés
 */

const Logger = require('../../utils/logger');
const EventEmitter = require('../../utils/event-emitter');
const DataService = require('../../services/data-service');

class UserManager {
  constructor() {
    this.setupEventListeners();
  }

  // Configuration des écouteurs d'événements
  setupEventListeners() {
    EventEmitter.on('user:added', (userId) => {
      this.onUserAdded(userId);
    });

    EventEmitter.on('user:removed', (userId) => {
      this.onUserRemoved(userId);
    });
  }

  // Ajout d'un utilisateur vérifié
  async addUser(userId) {
    try {
      // Validation de l'ID utilisateur
      if (!this.validateUserId(userId)) {
        throw new Error('ID utilisateur invalide');
      }

      // Nettoyage de l'ID
      const cleanUserId = this.cleanUserId(userId);

      const result = DataService.addVerifiedUser(cleanUserId);

      if (result.success) {
        Logger.success(`Utilisateur vérifié ajouté: ${cleanUserId}`);
        
        EventEmitter.emitNotification({
          type: 'success',
          message: `Utilisateur ${cleanUserId} ajouté avec succès`
        });
      }

      return result;

    } catch (error) {
      Logger.error('Erreur lors de l\'ajout de l\'utilisateur', error);
      
      EventEmitter.emitError({
        type: 'user_management',
        message: error.message
      });
      
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Suppression d'un utilisateur vérifié
  async removeUser(userId) {
    try {
      const result = DataService.removeVerifiedUser(userId);

      if (result.success) {
        Logger.success(`Utilisateur vérifié supprimé: ${userId}`);
        
        EventEmitter.emitNotification({
          type: 'success',
          message: `Utilisateur ${userId} supprimé`
        });
      }

      return result;

    } catch (error) {
      Logger.error('Erreur lors de la suppression de l\'utilisateur', error);
      
      EventEmitter.emitError({
        type: 'user_management',
        message: error.message
      });
      
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Vérification du statut d'un utilisateur
  isUserVerified(userId) {
    return DataService.isVerifiedUser(userId);
  }

  // Récupération de la liste des utilisateurs vérifiés
  getVerifiedUsers() {
    return DataService.getVerifiedUsers();
  }

  // Recherche d'utilisateurs
  searchUsers(query) {
    const users = this.getVerifiedUsers();
    const lowercaseQuery = query.toLowerCase();
    
    return users.filter(user => 
      user.toLowerCase().includes(lowercaseQuery)
    );
  }

  // Import d'utilisateurs en masse
  async importUsers(userList) {
    try {
      const results = {
        success: 0,
        failed: 0,
        errors: []
      };

      for (const userId of userList) {
        try {
          const result = await this.addUser(userId);
          if (result.success) {
            results.success++;
          } else {
            results.failed++;
            results.errors.push(`${userId}: ${result.message}`);
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`${userId}: ${error.message}`);
        }
      }

      Logger.info(`Import terminé: ${results.success} succès, ${results.failed} échecs`);
      
      EventEmitter.emitNotification({
        type: results.failed === 0 ? 'success' : 'warning',
        message: `Import: ${results.success} utilisateurs ajoutés, ${results.failed} échecs`
      });

      return results;

    } catch (error) {
      Logger.error('Erreur lors de l\'import d\'utilisateurs', error);
      throw error;
    }
  }

  // Export des utilisateurs
  exportUsers() {
    try {
      const users = this.getVerifiedUsers();
      const exportData = {
        exportDate: new Date().toISOString(),
        totalUsers: users.length,
        users: users
      };

      Logger.info(`Export de ${users.length} utilisateurs vérifiés`);
      return exportData;

    } catch (error) {
      Logger.error('Erreur lors de l\'export d\'utilisateurs', error);
      throw error;
    }
  }

  // Validation de l'ID utilisateur
  validateUserId(userId) {
    if (!userId || typeof userId !== 'string') {
      return false;
    }

    // Vérification de la longueur
    if (userId.trim().length < 1 || userId.trim().length > 30) {
      return false;
    }

    // Vérification des caractères autorisés (lettres, chiffres, points, underscores)
    const validPattern = /^[a-zA-Z0-9._]+$/;
    return validPattern.test(userId.trim());
  }

  // Nettoyage de l'ID utilisateur
  cleanUserId(userId) {
    return userId.trim().toLowerCase();
  }

  // Statistiques des utilisateurs
  getUserStats() {
    const users = this.getVerifiedUsers();
    
    return {
      totalUsers: users.length,
      averageUsernameLength: users.reduce((sum, user) => sum + user.length, 0) / users.length || 0,
      longestUsername: users.reduce((longest, user) => user.length > longest.length ? user : longest, ''),
      shortestUsername: users.reduce((shortest, user) => user.length < shortest.length ? user : shortest, users[0] || '')
    };
  }

  // Gestionnaires d'événements
  onUserAdded(userId) {
    Logger.debug(`Événement: Utilisateur ajouté - ${userId}`);
  }

  onUserRemoved(userId) {
    Logger.debug(`Événement: Utilisateur supprimé - ${userId}`);
  }

  // Nettoyage
  cleanup() {
    // Pas de nettoyage spécifique nécessaire pour ce module
    Logger.debug('UserManager: Nettoyage effectué');
  }
}

// Instance singleton
const userManager = new UserManager();

module.exports = userManager;