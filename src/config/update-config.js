/**
 * Configuration complète pour electron-updater
 * Optimisée pour macOS dual-arch et Windows
 */

const config = {
    // Configuration GitHub
    github: {
        owner: "Hassan-JERRAR",
        repo: "Tiktok_live_manager",
        private: false, // Mettre à true si votre repo est privé
        releaseType: 'release' // 'release', 'prerelease', ou 'draft'
    },

    // Options electron-updater
    options: {
        autoDownload: false, // Téléchargement manuel pour plus de contrôle
        autoInstallOnAppQuit: true, // Installation automatique à la fermeture
        checkFrequency: 24 * 60 * 60 * 1000, // Vérification toutes les 24 heures
        allowPrerelease: false, // Pas de pré-releases en production
        allowDowngrade: false, // Interdire les downgrades
        disableWebInstaller: false, // Autoriser l'installeur web
        requestTimeout: 60000, // Timeout de 60 secondes
    },

    // Configuration spécifique par plateforme
    platforms: {
        darwin: {
            // Configuration macOS
            architectures: ['x64', 'arm64'], // Support Intel et Apple Silicon
            minimumSystemVersion: '10.15.0', // Catalina minimum
            hardenedRuntime: true,
            entitlements: 'build/entitlements.mac.plist'
        },
        win32: {
            // Configuration Windows
            architectures: ['x64'],
            target: 'nsis',
            minimumSystemVersion: '10.0.0' // Windows 10 minimum
        },
        linux: {
            // Configuration Linux
            architectures: ['x64'],
            target: 'AppImage'
        }
    },

    // Configuration de debug
    debug: {
        enabled: process.env.NODE_ENV === 'development' || process.env.DEBUG_UPDATES === 'true',
        logLevel: 'info', // 'error', 'warn', 'info', 'debug'
        forceDevUpdateConfig: process.env.NODE_ENV === 'development'
    },

    // URLs et endpoints personnalisés (optionnel)
    customServer: {
        url: process.env.UPDATE_SERVER_URL || null,
        token: process.env.UPDATE_SERVER_TOKEN || null
    }
};

module.exports = config;
