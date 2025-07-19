/**
 * Module de gestion de l'impression
 */

const { Printer } = require('@node-escpos/core');
const USB = require('@node-escpos/usb-adapter');
const AppConfig = require('../../config/app-config');
const Logger = require('../../utils/logger');
const EventEmitter = require('../../utils/event-emitter');
const DataService = require('../../services/data-service');

class PrinterManager {
  constructor() {
    this.isConnected = false;
    this.isPrinting = false;
    this.device = null;
    this.printer = null;
    this.printQueue = [];
    this.processingQueue = false;
  }

  // Vérification de la disponibilité de l'imprimante
  async checkPrinterAvailability() {
    try {
      const device = new USB();
      
      return new Promise((resolve) => {
        device.open((err) => {
          if (err) {
            Logger.warn('Imprimante non disponible', err);
            resolve(false);
          } else {
            device.close();
            resolve(true);
          }
        });
      });
    } catch (error) {
      Logger.error('Erreur lors de la vérification de l\'imprimante', error);
      return false;
    }
  }

  // Impression d'une étiquette
  async printLabel(labelData) {
    try {
      const { pseudo, montant, description } = labelData;

      // Validation des données
      if (!pseudo || isNaN(montant) || !description) {
        throw new Error('Données d\'impression invalides');
      }

      // Vérification de la disponibilité de l'imprimante
      const printerAvailable = await this.checkPrinterAvailability();
      if (!printerAvailable) {
        throw new Error('Imprimante non disponible. Vérifiez la connexion USB.');
      }

      Logger.info('Début de l\'impression d\'étiquette', { pseudo, montant, description });

      // Génération des données d'impression
      const printData = this.generatePrintData(pseudo, montant, description);

      // Ajout à la queue d'impression
      return new Promise((resolve, reject) => {
        this.printQueue.push({
          printData,
          resolve,
          reject
        });

        this.processQueue();
      });

    } catch (error) {
      Logger.error('Erreur lors de l\'impression', error);
      
      EventEmitter.emitError({
        type: 'print',
        message: error.message
      });
      
      throw error;
    }
  }

  // Traitement de la queue d'impression
  async processQueue() {
    if (this.processingQueue || this.printQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    while (this.printQueue.length > 0) {
      const printJob = this.printQueue.shift();
      
      try {
        await this.executePrint(printJob.printData);
        printJob.resolve({
          success: true,
          printData: printJob.printData
        });
      } catch (error) {
        printJob.reject(error);
      }
    }

    this.processingQueue = false;
  }

  // Exécution de l'impression
  async executePrint(printData) {
    return new Promise((resolve, reject) => {
      const device = new USB();

      device.open((err) => {
        if (err) {
          reject(new Error('Impossible d\'ouvrir l\'imprimante: ' + err.message));
          return;
        }

        try {
          const options = { encoding: AppConfig.printer.encoding };
          const printer = new Printer(device, options);

          // Formatage de l'étiquette
          printer
            .text('') // Ligne vide
            .align('ct') // Centrer
            .text(`${printData.reference}`)
            .text(`${printData.pseudo}`)
            .text(`${printData.montant} euros`)
            .text(`${printData.date} a ${printData.timestamp}`)
            .cut() // Couper le papier
            .close(); // Fermer la connexion

          // Enregistrement dans l'historique
          DataService.addPrintRecord(printData);

          Logger.success(`Étiquette imprimée: ${printData.reference}`);
          
          EventEmitter.emitNotification({
            type: 'success',
            message: `Étiquette imprimée: ${printData.reference}`
          });

          resolve(printData);

        } catch (printError) {
          device.close();
          reject(new Error('Erreur d\'impression: ' + printError.message));
        }
      });
    });
  }

  // Génération des données d'impression
  generatePrintData(pseudo, montant, description) {
    const now = new Date();
    const reference = DataService.generateReference();
    const timestamp = now.toLocaleTimeString('fr-FR');
    const date = now.toLocaleDateString('fr-FR');

    return {
      reference,
      pseudo,
      montant,
      description,
      timestamp,
      date
    };
  }

  // Impression de test
  async printTestLabel() {
    try {
      const testData = {
        pseudo: 'TEST',
        montant: 0.01,
        description: 'Test d\'impression'
      };

      return await this.printLabel(testData);
    } catch (error) {
      Logger.error('Erreur lors du test d\'impression', error);
      throw error;
    }
  }

  // Statut de l'imprimante
  getStatus() {
    return {
      isConnected: this.isConnected,
      isPrinting: this.isPrinting,
      queueLength: this.printQueue.length,
      processingQueue: this.processingQueue
    };
  }

  // Effacement de la queue
  clearQueue() {
    const clearedItems = this.printQueue.length;
    
    // Rejeter tous les jobs en attente
    this.printQueue.forEach(job => {
      job.reject(new Error('Impression annulée'));
    });
    
    this.printQueue = [];
    
    Logger.info(`Queue d'impression effacée: ${clearedItems} élément(s)`);
    
    return clearedItems;
  }

  // Nettoyage
  cleanup() {
    this.clearQueue();
    
    if (this.device) {
      try {
        this.device.close();
      } catch (error) {
        Logger.error('Erreur lors de la fermeture de l\'imprimante', error);
      }
    }
  }
}

// Instance singleton
const printerManager = new PrinterManager();

module.exports = printerManager;