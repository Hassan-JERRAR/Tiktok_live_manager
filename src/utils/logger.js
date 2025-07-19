/**
 * Logger centralisé pour l'application
 */

class Logger {
  constructor() {
    this.logLevel = process.argv.includes('--dev') ? 'debug' : 'info';
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (data) {
      logMessage += ` ${JSON.stringify(data)}`;
    }
    
    return logMessage;
  }

  debug(message, data = null) {
    if (this.logLevel === 'debug') {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  info(message, data = null) {
    console.info(this.formatMessage('info', message, data));
  }

  warn(message, data = null) {
    console.warn(this.formatMessage('warn', message, data));
  }

  error(message, error = null) {
    const errorData = error ? {
      message: error.message,
      stack: error.stack
    } : null;
    
    console.error(this.formatMessage('error', message, errorData));
  }

  success(message, data = null) {
    console.log(this.formatMessage('success', `✅ ${message}`, data));
  }
}

// Instance singleton
const logger = new Logger();

module.exports = logger;