// Script de démarrage simple pour débugger
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Démarrage de TikTok Live Manager...');
console.log('📁 Dossier de travail:', __dirname);

// Démarrer Electron
const electron = spawn('npx', ['electron', '.'], {
  cwd: __dirname,
  stdio: 'inherit'
});

electron.on('close', (code) => {
  console.log(`Application fermée avec le code: ${code}`);
});

electron.on('error', (err) => {
  console.error('Erreur lors du démarrage:', err);
});