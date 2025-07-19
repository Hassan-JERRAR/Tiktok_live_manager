/**
 * Configuration principale de l'application
 */

const path = require("path");

const AppConfig = {
    // Configuration TikTok
    tiktok: {
        defaultUsername: "izatcolis",
        maxMessages: 1000,
        reconnectDelay: 5000,
    },

    // Configuration impression
    printer: {
        encoding: "GB18030",
        defaultCounter: 1385,
        referencePrefix: "REF-",
    },

    // Configuration données
    data: {
        dataDir: path.join(__dirname, "../../data"),
        verifiedUsersFile: "verified-users.json",
        printDataFile: "print-data.json",
    },

    // Configuration interface
    ui: {
        windowWidth: 1200,
        windowHeight: 800,
        maxNotifications: 3,
        notificationDuration: 5000,
    },

    // Configuration build
    build: {
        appId: "com.izatcolis.tiktok-live-app",
        productName: "TikTok Live Manager",
        owner: "Hassan-JERRAR",
        repo: "Tiktok_live_manager",
    },
};

module.exports = AppConfig;
