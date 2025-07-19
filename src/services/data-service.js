/**
 * Service de gestion des données
 */

const FileManager = require('../utils/file-manager');
const AppConfig = require('../config/app-config');
const Logger = require('../utils/logger');
const EventEmitter = require('../utils/event-emitter');

class DataService {
  constructor() {
    this.verifiedUsers = new Set();
    this.printHistory = [];
    this.printCounter = AppConfig.printer.defaultCounter;
    this.messageCount = 0;
    
    this.loadData();
  }

  // Chargement des données
  loadData() {
    this.loadVerifiedUsers();
    this.loadPrintData();
    Logger.info('Données chargées avec succès');
  }

  loadVerifiedUsers() {
    try {
      const users = FileManager.readJSON(AppConfig.data.verifiedUsersFile, []);
      this.verifiedUsers = new Set(users);
      
      if (this.verifiedUsers.size === 0) {
        this.verifiedUsers.add('vonix.xz'); // Utilisateur par défaut
        this.saveVerifiedUsers();
      }
      
      Logger.info(`${this.verifiedUsers.size} utilisateurs vérifiés chargés`);
    } catch (error) {
      Logger.error('Erreur lors du chargement des utilisateurs vérifiés', error);
      this.verifiedUsers = new Set(['vonix.xz']);
    }
  }

  loadPrintData() {
    try {
      const data = FileManager.readJSON(AppConfig.data.printDataFile, {});
      this.printHistory = data.history || [];
      this.printCounter = data.counter || AppConfig.printer.defaultCounter;
      
      Logger.info(`${this.printHistory.length} enregistrements d'impression chargés`);
    } catch (error) {
      Logger.error('Erreur lors du chargement des données d\'impression', error);
      this.printHistory = [];
      this.printCounter = AppConfig.printer.defaultCounter;
    }
  }

  // Sauvegarde des données
  saveVerifiedUsers() {
    try {
      const users = Array.from(this.verifiedUsers);
      const success = FileManager.writeJSON(AppConfig.data.verifiedUsersFile, users);
      
      if (success) {
        Logger.info(`${users.length} utilisateurs vérifiés sauvegardés`);
        EventEmitter.emitStatsUpdate(this.getStats());
      }
      
      return success;
    } catch (error) {
      Logger.error('Erreur lors de la sauvegarde des utilisateurs vérifiés', error);
      return false;
    }
  }

  savePrintData() {
    try {
      const data = {
        counter: this.printCounter,
        history: this.printHistory
      };
      
      const success = FileManager.writeJSON(AppConfig.data.printDataFile, data);
      
      if (success) {
        Logger.info(`${this.printHistory.length} enregistrements d'impression sauvegardés`);
        EventEmitter.emitStatsUpdate(this.getStats());
      }
      
      return success;
    } catch (error) {
      Logger.error('Erreur lors de la sauvegarde des données d\'impression', error);
      return false;
    }
  }

  // Gestion des utilisateurs vérifiés
  addVerifiedUser(userId) {
    if (this.verifiedUsers.has(userId)) {
      return { success: false, message: 'Utilisateur déjà vérifié' };
    }

    this.verifiedUsers.add(userId);
    const success = this.saveVerifiedUsers();
    
    if (success) {
      EventEmitter.emitUserAdded(userId);
      Logger.success(`Utilisateur vérifié ajouté: ${userId}`);
    }

    return {
      success,
      verifiedUsers: Array.from(this.verifiedUsers),
      stats: this.getStats()
    };
  }

  removeVerifiedUser(userId) {
    if (!this.verifiedUsers.has(userId)) {
      return { success: false, message: 'Utilisateur non trouvé' };
    }

    this.verifiedUsers.delete(userId);
    const success = this.saveVerifiedUsers();
    
    if (success) {
      EventEmitter.emitUserRemoved(userId);
      Logger.success(`Utilisateur vérifié supprimé: ${userId}`);
    }

    return {
      success,
      verifiedUsers: Array.from(this.verifiedUsers),
      stats: this.getStats()
    };
  }

  isVerifiedUser(userId) {
    return this.verifiedUsers.has(userId);
  }

  getVerifiedUsers() {
    return Array.from(this.verifiedUsers);
  }

  // Gestion de l'impression
  generateReference() {
    const ref = `${AppConfig.printer.referencePrefix}${this.printCounter.toString().padStart(4, '0')}`;
    this.printCounter++;
    return ref;
  }

  addPrintRecord(printData) {
    this.printHistory.push(printData);
    const success = this.savePrintData();
    
    if (success) {
      EventEmitter.emitPrintCompleted(printData);
      Logger.success(`Enregistrement d'impression ajouté: ${printData.reference}`);
    }
    
    return success;
  }

  getPrintHistory() {
    return this.printHistory;
  }

  // Gestion des messages
  incrementMessageCount() {
    this.messageCount++;
    EventEmitter.emitStatsUpdate(this.getStats());
  }

  resetMessageCount() {
    this.messageCount = 0;
    EventEmitter.emitStatsUpdate(this.getStats());
  }

  // Statistiques
  getStats() {
    return {
      messageCount: this.messageCount,
      verifiedUserCount: this.verifiedUsers.size,
      printCount: this.printHistory.length
    };
  }

  // Données initiales
  getInitialData() {
    return {
      verifiedUsers: this.getVerifiedUsers(),
      printHistory: this.getPrintHistory(),
      stats: this.getStats()
    };
  }

  // Sauvegarde de sécurité
  backupData() {
    try {
      FileManager.backup(AppConfig.data.verifiedUsersFile);
      FileManager.backup(AppConfig.data.printDataFile);
      Logger.info('Sauvegarde de sécurité effectuée');
      return true;
    } catch (error) {
      Logger.error('Erreur lors de la sauvegarde de sécurité', error);
      return false;
    }
  }
}

// Instance singleton
const dataService = new DataService();

module.exports = dataService;