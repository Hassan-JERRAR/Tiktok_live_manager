/**
 * Event Emitter pour la communication inter-modules
 */

const EventEmitter = require('events');

class AppEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Augmenter la limite pour éviter les warnings
  }

  // Méthodes spécifiques pour les événements de l'app
  emitConnectionStatus(status) {
    this.emit('connection:status', status);
  }

  emitNewMessage(messageData) {
    this.emit('message:new', messageData);
  }

  emitStatsUpdate(stats) {
    this.emit('stats:update', stats);
  }

  emitUserAdded(user) {
    this.emit('user:added', user);
  }

  emitUserRemoved(user) {
    this.emit('user:removed', user);
  }

  emitPrintCompleted(printData) {
    this.emit('print:completed', printData);
  }

  emitError(error) {
    this.emit('app:error', error);
  }

  emitNotification(notification) {
    this.emit('notification:show', notification);
  }
}

// Instance singleton
const appEventEmitter = new AppEventEmitter();

module.exports = appEventEmitter;