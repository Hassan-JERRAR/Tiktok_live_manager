# Configuration Repository Privé - TikTok Live Manager

## 🔐 Étapes pour configurer les mises à jour OTA avec un repository privé

### 1. Créer un Token GitHub Personnel

1. **Allez sur GitHub** : https://github.com/settings/tokens
2. **Cliquez sur "Generate new token (classic)"**
3. **Configurez le token** :
   - **Name** : `TikTok Live Manager Updates`
   - **Expiration** : `No expiration` (ou 1 an)
   - **Scopes** : Cochez `repo` (Full control of private repositories)
4. **Générez et copiez le token**

### 2. Configuration Locale (Pour le développement)

1. **Créez un fichier `.env`** :
   ```bash
   cp .env.example .env
   ```

2. **Éditez `.env`** et ajoutez votre token :
   ```env
   GH_TOKEN=ghp_votre_token_ici
   NODE_ENV=development
   DEBUG_UPDATES=true
   ```

3. **Ajoutez `.env` au .gitignore** (déjà fait) :
   ```gitignore
   .env
   node_modules/
   dist/
   ```

### 3. Configuration GitHub Actions (Pour la production)

1. **Allez dans votre repository** : https://github.com/Hassan-JERRAR/Tiktok_live_manager
2. **Settings > Secrets and variables > Actions**
3. **Cliquez "New repository secret"**
4. **Ajoutez** :
   - **Name** : `PERSONAL_TOKEN`
   - **Value** : Votre token GitHub personnel

### 4. Options Alternatives

#### Option A: Repository Public (Recommandé)
Si possible, rendez votre repository public :
- Plus simple à configurer
- Pas de token requis
- Mises à jour automatiques sans friction

#### Option B: Serveur de Mise à Jour Personnalisé
Hébergez vos propres fichiers de mise à jour :

1. **Créez un serveur web simple** :
   ```javascript
   // server.js
   const express = require('express');
   const app = express();
   
   app.use('/updates', express.static('releases'));
   app.listen(3000);
   ```

2. **Configurez l'UpdateManager** :
   ```javascript
   autoUpdater.setFeedURL({
       provider: 'generic',
       url: 'https://votre-serveur.com/updates'
   });
   ```

### 5. Test de Configuration

1. **Testez localement** :
   ```bash
   # Avec votre token configuré
   npm run dev
   ```

2. **Vérifiez les logs** dans la console pour :
   - ✅ Token chargé correctement
   - ✅ Connexion au repository réussie
   - ⚠️ Erreurs d'authentification

3. **Testez la vérification manuelle** :
   - Ouvrez l'onglet "Paramètres"
   - Cliquez "Vérifier les mises à jour"

### 6. Processus de Release

1. **Préparez votre release** :
   ```bash
   npm version patch  # 1.0.0 -> 1.0.1
   git push origin --tags
   ```

2. **GitHub Actions construira automatiquement** :
   - Windows (.exe)
   - macOS (.dmg)
   - Linux (.AppImage)

3. **Publiez la release** :
   - Allez sur GitHub > Releases
   - Éditez le draft créé automatiquement
   - Ajoutez des notes de version
   - Publiez la release

### 7. Distribution aux Utilisateurs

#### Pour les nouveaux utilisateurs :
- Téléchargement depuis GitHub Releases
- Installation normale de l'application
- Token automatiquement inclus dans l'app buildée

#### Pour les utilisateurs existants :
- L'application vérifiera automatiquement les mises à jour
- Notification dans l'interface utilisateur
- Téléchargement et installation en un clic

### 8. Sécurité

- ✅ Token stocké localement de manière sécurisée
- ✅ Communication chiffrée HTTPS
- ✅ Vérification des signatures de fichiers
- ✅ Token jamais exposé dans le code source

### 9. Dépannage

#### Erreur "unauthorized" :
- Vérifiez que le token a les bonnes permissions
- Vérifiez que le token n'a pas expiré
- Vérifiez que le repository est accessible

#### Erreur "not found" :
- Vérifiez le nom du repository
- Vérifiez que des releases existent
- Vérifiez la configuration dans package.json

#### Tests de connectivité :
```bash
# Testez l'accès API GitHub
curl -H "Authorization: token VOTRE_TOKEN" \
  https://api.github.com/repos/Hassan-JERRAR/Tiktok_live_manager/releases
```

## 🚀 Commandes Utiles

```bash
# Développement avec debug
DEBUG=electron-updater npm run dev

# Build pour test
npm run build

# Publish automatique
npm run build-publish

# Test de connexion
node -e "console.log(process.env.GITHUB_TOKEN ? 'Token configuré' : 'Token manquant')"
```

Une fois configuré, vos utilisateurs recevront automatiquement les mises à jour sans avoir besoin d'accès au repository privé !