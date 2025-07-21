# Guide complet : Mises à jour OTA avec Electron

## 🏗️ Architecture de mise à jour

Votre système de mise à jour est maintenant configuré pour :
- **macOS** : Support Intel (x64) et Apple Silicon (arm64)
- **Windows** : Support x64 avec installeur NSIS
- **Linux** : Support x64 avec AppImage

## 🚀 Publication d'une nouvelle version

### 1. Préparation
```bash
# Mettre à jour la version dans package.json
npm version patch   # ou minor, major

# Nettoyer et construire
npm run clean-build
```

### 2. Publication sur GitHub Releases
```bash
# Option A: Publier toutes les plateformes
npm run build-publish-all

# Option B: Publier par plateforme
npm run build-publish-mac      # macOS Universal (Intel + Apple Silicon)
npm run build-publish-win      # Windows x64
npm run build-publish-linux    # Linux x64

# Option C: Builds spécifiques macOS
npm run build-publish-mac-intel    # macOS Intel uniquement
npm run build-publish-mac-silicon  # macOS Apple Silicon uniquement
```

### 3. Structure des assets GitHub attendue

Après publication, votre release GitHub doit contenir :
```
v1.0.18/
├── TikTok-Live-Manager-1.0.18-mac-x64.zip        # macOS Intel
├── TikTok-Live-Manager-1.0.18-mac-arm64.zip      # macOS Apple Silicon  
├── TikTok-Live-Manager-1.0.18-mac-universal.zip  # macOS Universal (optionnel)
├── TikTok-Live-Manager-1.0.18-win-x64.exe        # Windows x64
├── TikTok-Live-Manager-1.0.18-linux-x64.AppImage # Linux x64
├── latest.yml                                     # Métadonnées Windows/Linux
└── latest-mac.yml                                # Métadonnées macOS
```

## 🔐 Signature macOS (Recommandée pour production)

### Configuration pour la signature
1. **Obtenir un certificat Developer ID**
   ```bash
   # Vérifier les certificats disponibles
   security find-identity -v -p codesigning
   ```

2. **Configurer les variables d'environnement**
   ```bash
   # Dans votre .env
   CSC_IDENTITY_AUTO_DISCOVERY=true
   # ou spécifier explicitement :
   CSC_NAME="Developer ID Application: Votre Nom (TEAM_ID)"
   ```

3. **Activer la signature dans package.json**
   ```json
   {
     "build": {
       "mac": {
         "hardenedRuntime": true,
         "gatekeeperAssess": false,
         "forceCodeSigning": true, // Changer à true
         "identity": "Developer ID Application: Votre Nom (TEAM_ID)"
       }
     }
   }
   ```

4. **Notarisation Apple (optionnel mais recommandé)**
   ```bash
   # Configurer les variables pour la notarisation
   export APPLE_ID="votre-email@example.com"
   export APPLE_ID_PASSWORD="app-specific-password"
   export APPLE_TEAM_ID="VOTRE_TEAM_ID"
   ```

## 🔧 Configuration avancée

### Variables d'environnement (.env)
```bash
# Token GitHub (OBLIGATOIRE pour publier)
GH_TOKEN=ghp_your_github_token_here

# Configuration de debug
NODE_ENV=development
DEBUG_UPDATES=true

# Serveur de mise à jour personnalisé (optionnel)
UPDATE_SERVER_URL=https://your-update-server.com/updates
UPDATE_SERVER_TOKEN=your_server_token

# Signature macOS (si utilisée)
CSC_IDENTITY_AUTO_DISCOVERY=true
APPLE_ID=votre-email@example.com
APPLE_ID_PASSWORD=app-specific-password
APPLE_TEAM_ID=VOTRE_TEAM_ID
```

## 🧪 Test des mises à jour

### En développement
```bash
# Activer le mode debug
export DEBUG_UPDATES=true
export NODE_ENV=development

# Lancer l'app
npm run dev
```

### Test de production
1. Construire une version locale
2. Publier une pre-release sur GitHub
3. Tester la détection de mise à jour
4. Publier la release finale

## 📱 Interface utilisateur

### Événements disponibles
```javascript
// Dans le renderer process
ipcRenderer.on('update-available', (event, info) => {
  console.log('Mise à jour disponible:', info.version);
});

ipcRenderer.on('update-downloaded', (event, info) => {
  console.log('Mise à jour téléchargée:', info.version);
});

ipcRenderer.on('update-download-progress', (event, progress) => {
  console.log('Progrès:', progress.percent + '%');
});
```

## 🔍 Détection d'architecture

Le système détecte automatiquement :
- **macOS Intel** : `x64` via détection CPU
- **macOS Apple Silicon** : `arm64` via `sysctl machdep.cpu.brand_string`
- **Windows** : `x64` via `process.arch`
- **Linux** : `x64` via `process.arch`

## 📋 Checklist de déploiement

### Avant chaque release
- [ ] Version mise à jour dans `package.json`
- [ ] Token `GH_TOKEN` configuré
- [ ] Assets construits pour toutes les plateformes
- [ ] Fichiers `latest.yml` et `latest-mac.yml` générés
- [ ] Release GitHub créée avec tous les assets
- [ ] Tests de mise à jour effectués

### Pour la signature macOS
- [ ] Certificat Developer ID installé
- [ ] Variables de signature configurées
- [ ] `hardenedRuntime: true` dans la config
- [ ] Entitlements correctement configurés
- [ ] Notarisation configurée (optionnel)

## 🚨 Dépannage courant

### Erreur "No releases found"
- Vérifier que la release GitHub est publique
- Vérifier le format des noms de fichiers assets
- Vérifier la configuration `github.owner/repo`

### Mauvaise architecture téléchargée
- Vérifier les logs de détection d'architecture
- Vérifier les noms des assets dans la release
- Tester la détection avec `UpdateManager.getSystemArchitecture()`

### Signature échoue
- Vérifier les certificats avec `security find-identity`
- Vérifier les entitlements dans `build/entitlements.mac.plist`
- Vérifier les variables CSC_*

## 📊 Monitoring

Les logs détaillés sont disponibles dans :
- **macOS** : `~/Library/Logs/TikTok Live Manager/`
- **Windows** : `%USERPROFILE%\AppData\Roaming\TikTok Live Manager\logs\`
- **Linux** : `~/.config/TikTok Live Manager/logs/`

## 🔗 Resources utiles

- [electron-updater Documentation](https://www.electron.build/auto-update)
- [Code Signing Guide](https://www.electron.build/code-signing)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)
- [Apple Notarization](https://developer.apple.com/documentation/notarization)