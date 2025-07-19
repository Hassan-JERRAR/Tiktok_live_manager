/**
 * Gestionnaire de fichiers pour la persistance des données
 */

const fs = require('fs');
const path = require('path');
const AppConfig = require('../config/app-config');

class FileManager {
  constructor() {
    this.dataDir = AppConfig.data.dataDir;
    this.ensureDataDirectory();
  }

  ensureDataDirectory() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  getFilePath(filename) {
    return path.join(this.dataDir, filename);
  }

  readJSON(filename, defaultValue = null) {
    try {
      const filePath = this.getFilePath(filename);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
      return defaultValue;
    } catch (error) {
      console.error(`Erreur lors de la lecture de ${filename}:`, error);
      return defaultValue;
    }
  }

  writeJSON(filename, data) {
    try {
      const filePath = this.getFilePath(filename);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error(`Erreur lors de l'écriture de ${filename}:`, error);
      return false;
    }
  }

  exists(filename) {
    return fs.existsSync(this.getFilePath(filename));
  }

  backup(filename) {
    try {
      const filePath = this.getFilePath(filename);
      const backupPath = this.getFilePath(`${filename}.backup`);
      
      if (fs.existsSync(filePath)) {
        fs.copyFileSync(filePath, backupPath);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Erreur lors de la sauvegarde de ${filename}:`, error);
      return false;
    }
  }
}

// Instance singleton
const fileManager = new FileManager();

module.exports = fileManager;