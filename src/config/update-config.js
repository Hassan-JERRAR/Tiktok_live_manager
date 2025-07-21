/**
 * Configuration pour electron-updater uniquement
 */

const config = {
    // Configuration GitHub pour repository public
    github: {
        owner: "Hassan-JERRAR",
        repo: "Tiktok_live_manager",
        private: false,
    },

    // Options electron-updater
    options: {
        autoDownload: false,
        autoInstallOnAppQuit: false,
        checkFrequency: 24 * 60 * 60 * 1000, // 24 heures
        allowPrerelease: false,
    },
};

module.exports = config;
