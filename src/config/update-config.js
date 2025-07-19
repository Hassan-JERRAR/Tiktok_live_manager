/**
 * Configuration pour les mises à jour avec repository privé
 */

const config = {
    // Configuration GitHub pour repository privé
    github: {
        owner: 'Hassan-JERRAR',
        repo: 'Tiktok_live_manager',
        private: true,
        // Token d'accès GitHub pour repository privé
        token: process.env.GITHUB_TOKEN || null
    },

    // Configuration alternative avec serveur personnalisé
    customServer: {
        url: process.env.UPDATE_SERVER_URL || null,
        headers: {
            'Authorization': process.env.UPDATE_SERVER_TOKEN ? `Bearer ${process.env.UPDATE_SERVER_TOKEN}` : null
        }
    },

    // Options de mise à jour
    options: {
        autoDownload: true,
        autoInstallOnAppQuit: false,
        checkFrequency: 24 * 60 * 60 * 1000, // 24 heures
        allowPrerelease: false
    }
};

module.exports = config;