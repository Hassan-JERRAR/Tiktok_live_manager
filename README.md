# TikTok Live Manager - IzatColis

Application desktop modulaire pour gérer les streams TikTok Live et l'impression d'étiquettes de colis.

## 🏗️ Architecture Modulaire

Cette application utilise une architecture modulaire avancée pour une meilleure maintenabilité et scalabilité. Voir [ARCHITECTURE.md](ARCHITECTURE.md) pour les détails complets.

## Fonctionnalités

- **Connexion TikTok Live** : Connectez-vous au live de l'utilisateur "izatcolis"
- **Messages en temps réel** : Visualisez les messages du chat TikTok Live
- **Utilisateurs vérifiés** : Gérez une liste d'utilisateurs vérifiés avec badge spécial
- **Impression d'étiquettes** : Imprimez des étiquettes de colis avec référence automatique
- **Historique** : Consultez l'historique des impressions
- **Interface moderne** : Interface graphique intuitive avec thème TikTok

## Prérequis

- Node.js 16 ou supérieur
- Une imprimante ESC/POS compatible USB
- Connexion internet pour TikTok Live

## Installation

1. Naviguez vers le dossier de l'application :
```bash
cd tiktok-live-app
```

2. Installez les dépendances :
```bash
npm install
```

## Utilisation

### Mode développement
```bash
npm run dev
```

### Mode production
```bash
npm start
```

### Construire l'application

Pour Windows :
```bash
npm run build-win
```

Pour macOS :
```bash
npm run build-mac
```

Pour Linux :
```bash
npm run build-linux
```

## Structure des fichiers

- `main.js` : Processus principal Electron
- `index.html` : Interface utilisateur
- `styles.css` : Styles CSS
- `renderer.js` : Logique côté interface
- `data/` : Dossier des données (créé automatiquement)
  - `verified-users.json` : Liste des utilisateurs vérifiés
  - `print-data.json` : Historique des impressions

## Fonctionnement

### Connexion TikTok Live
1. Cliquez sur "Se connecter" dans l'onglet Dashboard
2. L'application se connecte automatiquement au live de "izatcolis"
3. Les messages apparaissent en temps réel

### Gestion des utilisateurs vérifiés
1. Allez dans l'onglet "Utilisateurs Vérifiés"
2. Ajoutez des noms d'utilisateur TikTok
3. Les utilisateurs vérifiés apparaissent avec un badge doré dans le chat

### Impression d'étiquettes
1. Allez dans l'onglet "Impression"
2. Remplissez les champs : pseudo, montant, description
3. Cliquez sur "Imprimer l'Étiquette"
4. L'étiquette est imprimée avec une référence unique

### Historique
1. Consultez l'onglet "Historique"
2. Visualisez toutes les impressions précédentes
3. Recherchez par référence ou date

## Configuration de l'imprimante

L'application utilise une imprimante ESC/POS via USB. Assurez-vous que :
- L'imprimante est connectée en USB
- Les pilotes sont installés
- L'imprimante est reconnue par le système

## Dépannage

### Problèmes de connexion TikTok
- Vérifiez votre connexion internet
- Assurez-vous que l'utilisateur "izatcolis" est en live
- Redémarrez l'application

### Problèmes d'impression
- Vérifiez la connexion USB de l'imprimante
- Redémarrez l'imprimante
- Vérifiez les permissions USB

### Données perdues
Les données sont automatiquement sauvegardées dans le dossier `data/` :
- `verified-users.json` : Liste des utilisateurs vérifiés
- `print-data.json` : Historique des impressions

## Développement

### Structure du code
- **src/main-modular.js** : Processus principal modulaire
- **src/renderer-modular.js** : Interface utilisateur modulaire
- **src/modules/** : Modules métier (TikTok, Printer, Users, etc.)
- **src/services/** : Services de données
- **src/components/** : Composants d'interface
- **styles.css** : Styles avec thème TikTok (rouge/cyan)

### Architecture modulaire
Voir [ARCHITECTURE.md](ARCHITECTURE.md) pour la documentation complète de l'architecture.

### APIs disponibles
- `connect-tiktok` : Connecter au live TikTok
- `disconnect-tiktok` : Déconnecter du live
- `add-verified-user` : Ajouter un utilisateur vérifié
- `remove-verified-user` : Supprimer un utilisateur vérifié
- `print-label` : Imprimer une étiquette
- `get-initial-data` : Récupérer les données initiales

## Licence

MIT License - Voir le fichier LICENSE pour plus de détails.

## Support

Pour toute question ou problème, contactez l'équipe IzatColis.