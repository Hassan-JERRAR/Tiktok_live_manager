# Instructions pour les Mises à Jour OTA

## Configuration Initiale

### 1. Configuration GitHub Repository

1. **Mettre à jour package.json** :

   - Modifier `"owner": "your-github-username"` avec votre nom d'utilisateur GitHub
   - Modifier `"repo": "tiktok-live-app"` avec le nom de votre repository

2. **Créer un repository GitHub** (si pas déjà fait) :

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/tiktok-live-app.git
   git push -u origin main
   ```

3. **Configurer les GitHub Actions** :
   - Le fichier `.github/workflows/release.yml` est déjà configuré
   - Il se déclenche automatiquement lors de la création d'un tag de version

### 2. Publication d'une nouvelle version

#### Méthode 1: Via tag Git (Recommandée)

```bash
# Mettre à jour la version dans package.json
npm version patch  # pour 1.0.0 -> 1.0.1
# ou
npm version minor  # pour 1.0.0 -> 1.1.0
# ou
npm version major  # pour 1.0.0 -> 2.0.0

# Pousser le tag
git push origin --tags
```

#### Méthode 2: Manuellement via GitHub Actions

1. Aller sur GitHub > Actions
2. Sélectionner "Release Application"
3. Cliquer "Run workflow"
4. Entrer la version souhaitée
5. Cliquer "Run workflow"

### 3. Test en développement

Pour tester le système de mise à jour en local :

1. **Modifier la configuration dans UpdateManager** :

   ```javascript
   // Dans src/modules/updater/update-manager.js
   setupAutoUpdater() {
       // Pour les tests locaux, utiliser un serveur personnalisé
       if (process.env.NODE_ENV === 'development') {
           autoUpdater.setFeedURL({
               provider: 'generic',
               url: 'http://localhost:3000/updates'
           });
       }
   }
   ```

2. **Créer un serveur de test local** (optionnel) :
   ```bash
   npm install -g http-server
   # Créer un dossier avec les fichiers de mise à jour
   mkdir update-server
   cd update-server
   http-server -p 3000
   ```

## Fonctionnalités Disponibles

### Interface Utilisateur

- **Onglet Paramètres** : Accès aux options de mise à jour
- **Vérification manuelle** : Bouton pour vérifier les mises à jour
- **Téléchargement** : Télécharger une mise à jour disponible
- **Installation** : Installer et redémarrer avec la nouvelle version
- **Mise à jour automatique** : Toggle pour activer/désactiver

### Vérification Automatique

- Vérification au démarrage (5 secondes après le lancement)
- Désactivée en mode développement (`--dev`)
- Notifications utilisateur pour les mises à jour disponibles

### Sécurité

- Utilise le système de signature d'Electron
- Vérification des checksums automatique
- Téléchargement sécurisé via HTTPS

## Configuration Avancée

### Variables d'Environnement

Créer un fichier `.env` (optionnel) :

```env
# Configuration des mises à jour
UPDATE_SERVER_URL=https://api.github.com/repos/YOUR_USERNAME/tiktok-live-app/releases
AUTO_UPDATE_ENABLED=true
UPDATE_CHECK_INTERVAL=3600000
```

### Signature des Releases (Pour la production)

1. **Générer une clé de signature** :

   ```bash
   # Installer electron-builder
   npm install -g electron-builder

   # Générer les clés
   electron-builder create-self-signed-cert -p YOUR_COMPANY_NAME
   ```

2. **Configurer dans package.json** :
   ```json
   {
     "build": {
       "win": {
         "certificateFile": "path/to/certificate.p12",
         "certificatePassword": "password"
       },
       "mac": {
         "identity": "Developer ID Application: Your Name"
       }
     }
   }
   ```

## Dépannage

### Problèmes Courants

1. **"Aucune mise à jour disponible"** :

   - Vérifier que le repository GitHub est public
   - Vérifier que les releases sont publiées
   - Vérifier la configuration dans package.json

2. **Erreur de téléchargement** :

   - Vérifier la connexion internet
   - Vérifier les permissions de l'antivirus
   - Essayer en mode administrateur

3. **Mise à jour ne s'installe pas** :
   - Fermer tous les processus de l'application
   - Relancer en mode administrateur
   - Vérifier l'espace disque disponible

### Logs de Débogage

Les logs sont disponibles dans la console de développement :

```bash
# Lancer avec les DevTools
npm run dev
```

## Migration depuis une Version Antérieure

Si vous avez déjà une application sans mises à jour OTA :

1. **Sauvegarder les données** :

   ```bash
   cp -r data/ data_backup/
   ```

2. **Installer la nouvelle version** avec OTA

3. **Restaurer les données** si nécessaire

## Conseils de Déploiement

### Versioning Sémantique

- **MAJOR** (x.0.0) : Changements incompatibles
- **MINOR** (0.x.0) : Nouvelles fonctionnalités compatibles
- **PATCH** (0.0.x) : Corrections de bugs

### Test Before Release

1. Tester en mode développement
2. Créer une release beta/preview
3. Tester avec un petit groupe d'utilisateurs
4. Publier la version finale

### Communication Utilisateur

- Préparer les notes de version (changelog)
- Informer des nouvelles fonctionnalités
- Documenter les changements importants
