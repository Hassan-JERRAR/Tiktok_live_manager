const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

// Import du gestionnaire de mise à jour
let UpdateManager;
try {
    // Charger les variables d'environnement si le fichier .env existe
    const path = require("path");
    const envPath = path.join(__dirname, ".env");
    if (require("fs").existsSync(envPath)) {
        require("dotenv").config({ path: envPath });
    }
    
    UpdateManager = require("./src/modules/updater/update-manager");
} catch (error) {
    console.log("⚠️ UpdateManager non disponible:", error.message);
}

let mainWindow;
let tiktokConnection;
let isConnected = false;

// Variables pour gérer les modules optionnels
let TikTokLiveConnection, WebcastEvent;
let Printer, USB;

// Données globales
let verifiedUsers = new Set();
let printHistory = [];
let printCounter = 1436;
let messageCount = 0;

// Chemins des fichiers de données
const DATA_DIR = path.join(__dirname, "data");
const VERIFIED_USERS_FILE = path.join(DATA_DIR, "verified-users.json");
const PRINT_DATA_FILE = path.join(DATA_DIR, "print-data.json");

// Fonction pour charger les modules de manière sécurisée
function loadModules() {
    try {
        // Tenter de charger TikTok Live Connector
        const tiktokModule = require("tiktok-live-connector");
        TikTokLiveConnection = tiktokModule.TikTokLiveConnection;
        WebcastEvent = tiktokModule.WebcastEvent;
        console.log("✅ Module TikTok Live Connector chargé");
    } catch (error) {
        console.error(
            "❌ Impossible de charger TikTok Live Connector:",
            error.message
        );
        console.log("🔧 Fonctionnalités TikTok désactivées");
    }

    try {
        // Tenter de charger les modules d'impression
        const printerCore = require("@node-escpos/core");
        const usbAdapter = require("@node-escpos/usb-adapter");
        Printer = printerCore.Printer;
        USB = usbAdapter;
        console.log("✅ Modules d'impression chargés");
    } catch (error) {
        console.error(
            "❌ Impossible de charger les modules d'impression:",
            error.message
        );
        console.log("🔧 Fonctionnalités d'impression désactivées");
    }
}

// Créer le dossier data s'il n'existe pas
function ensureDataDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
        icon: path.join(__dirname, "assets/icon.png"),
        title: "TikTok Live Manager - IzatColis",
    });

    mainWindow.loadFile("index.html");

    // Ouvrir les DevTools en mode développement
    if (process.argv.includes("--dev")) {
        mainWindow.webContents.openDevTools();
    }

    // Charger les données au démarrage
    loadVerifiedUsers();
    loadPrintData();

    // Initialiser le gestionnaire de mise à jour
    if (UpdateManager && !process.argv.includes("--dev")) {
        const updateManager = UpdateManager.getInstance();
        updateManager.setMainWindow(mainWindow);
        
        // Vérifier les mises à jour 5 secondes après le démarrage
        setTimeout(() => {
            updateManager.checkForUpdates();
        }, 5000);
    }

    console.log("Fenêtre créée et données chargées");
}

// Fonctions de gestion des données
function loadVerifiedUsers() {
    try {
        if (fs.existsSync(VERIFIED_USERS_FILE)) {
            const data = fs.readFileSync(VERIFIED_USERS_FILE, "utf8");
            const userArray = JSON.parse(data);
            verifiedUsers = new Set(userArray);
            console.log(`Chargé ${verifiedUsers.size} utilisateurs vérifiés`);
        } else {
            verifiedUsers.add("vonix.xz"); // Utilisateur par défaut
            saveVerifiedUsers();
        }
    } catch (error) {
        console.error(
            "Erreur lors du chargement des utilisateurs vérifiés:",
            error
        );
        verifiedUsers = new Set(["vonix.xz"]);
    }
}

function saveVerifiedUsers() {
    try {
        const userArray = Array.from(verifiedUsers);
        fs.writeFileSync(
            VERIFIED_USERS_FILE,
            JSON.stringify(userArray, null, 2)
        );
        console.log(`Sauvegardé ${userArray.length} utilisateurs vérifiés`);
    } catch (error) {
        console.error("Erreur lors de la sauvegarde:", error);
    }
}

function loadPrintData() {
    try {
        if (fs.existsSync(PRINT_DATA_FILE)) {
            const data = fs.readFileSync(PRINT_DATA_FILE, "utf8");
            const savedData = JSON.parse(data);
            printHistory = savedData.history || [];
            printCounter = savedData.counter || 1436;
            console.log(
                `Chargé ${printHistory.length} enregistrements d'impression`
            );
        }
    } catch (error) {
        console.error(
            "Erreur lors du chargement des données d'impression:",
            error
        );
        printHistory = [];
    }
}

function savePrintData() {
    try {
        const dataToSave = {
            counter: printCounter,
            history: printHistory,
        };
        fs.writeFileSync(PRINT_DATA_FILE, JSON.stringify(dataToSave, null, 2));
        console.log(
            `Sauvegardé ${printHistory.length} enregistrements d'impression`
        );
    } catch (error) {
        console.error(
            "Erreur lors de la sauvegarde des données d'impression:",
            error
        );
    }
}

function generateReference() {
    const ref = `REF-${printCounter.toString().padStart(4, "0")}`;
    printCounter++;
    return ref;
}

function getTimestamp() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const seconds = now.getSeconds().toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
}

// Gestion des événements IPC
ipcMain.handle("get-initial-data", () => {
    console.log("Récupération des données initiales");
    return {
        verifiedUsers: Array.from(verifiedUsers),
        printHistory: printHistory,
        isConnected: isConnected,
        stats: {
            messageCount: messageCount,
            verifiedUserCount: verifiedUsers.size,
            printCount: printHistory.length,
        },
        capabilities: {
            tiktok: !!TikTokLiveConnection,
            printer: !!Printer,
        },
    };
});

ipcMain.handle("connect-tiktok", async (event, username) => {
    console.log("Tentative de connexion TikTok:", username);

    if (!TikTokLiveConnection) {
        return {
            success: false,
            message:
                "Module TikTok Live non disponible. Veuillez redémarrer l'application.",
        };
    }

    try {
        if (isConnected) {
            return { success: false, message: "Déjà connecté" };
        }

        tiktokConnection = new TikTokLiveConnection(username || "izatcolis");

        const state = await tiktokConnection.connect();
        isConnected = true;

        console.log(`Connecté au live TikTok - RoomId: ${state.roomId}`);

        // Écouter les messages
        tiktokConnection.on(WebcastEvent.CHAT, (data) => {
            const userId = data.user?.uniqueId || "unknown";
            const nickname = data.user?.nickname || "Anonyme";
            const message = data.comment || "";
            const timestamp = getTimestamp();
            const isVerified = verifiedUsers.has(userId);

            messageCount++;

            const messageData = {
                id: Date.now().toString() + Math.random(),
                userId,
                nickname,
                message,
                timestamp,
                isVerified,
            };

            // Envoyer le message à l'interface
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("new-message", messageData);
                mainWindow.webContents.send("stats-update", {
                    messageCount: messageCount,
                    verifiedUserCount: verifiedUsers.size,
                    printCount: printHistory.length,
                });
            }
        });

        return { success: true, roomId: state.roomId };
    } catch (error) {
        console.error("Erreur de connexion TikTok:", error);
        isConnected = false;
        return { success: false, message: error.message };
    }
});

ipcMain.handle("disconnect-tiktok", () => {
    console.log("Déconnexion TikTok");
    try {
        if (tiktokConnection) {
            tiktokConnection.disconnect();
            tiktokConnection = null;
        }
        isConnected = false;
        messageCount = 0;
        return { success: true };
    } catch (error) {
        console.error("Erreur de déconnexion:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle("add-verified-user", (event, userId) => {
    console.log("Ajout utilisateur vérifié:", userId);
    try {
        if (verifiedUsers.has(userId)) {
            return { success: false, message: "Utilisateur déjà vérifié" };
        }

        verifiedUsers.add(userId);
        saveVerifiedUsers();

        return {
            success: true,
            verifiedUsers: Array.from(verifiedUsers),
            stats: {
                messageCount: messageCount,
                verifiedUserCount: verifiedUsers.size,
                printCount: printHistory.length,
            },
        };
    } catch (error) {
        console.error("Erreur lors de l'ajout de l'utilisateur:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle("remove-verified-user", (event, userId) => {
    console.log("Suppression utilisateur vérifié:", userId);
    try {
        if (!verifiedUsers.has(userId)) {
            return { success: false, message: "Utilisateur non trouvé" };
        }

        verifiedUsers.delete(userId);
        saveVerifiedUsers();

        return {
            success: true,
            verifiedUsers: Array.from(verifiedUsers),
            stats: {
                messageCount: messageCount,
                verifiedUserCount: verifiedUsers.size,
                printCount: printHistory.length,
            },
        };
    } catch (error) {
        console.error("Erreur lors de la suppression de l'utilisateur:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle(
    "print-label",
    async (event, { pseudo, montant, description }) => {
        console.log("Impression étiquette:", { pseudo, montant, description });

        if (!Printer || !USB) {
            return {
                success: false,
                message:
                    "Module d'impression non disponible. Fonctionnalité désactivée.",
            };
        }

        try {
            // Validation simple
            if (!pseudo || isNaN(montant) || !description) {
                throw new Error("Données invalides pour l'impression");
            }

            const device = new USB();

            return new Promise((resolve, reject) => {
                device.open(function (err) {
                    if (err) {
                        console.error("Erreur imprimante:", err);
                        resolve({
                            success: false,
                            message: "Erreur imprimante: " + err.message,
                        });
                        return;
                    }

                    const now = new Date();
                    const reference = generateReference();
                    const timestamp = now.toLocaleTimeString("fr-FR");
                    const date = now.toLocaleDateString("fr-FR");

                    const printData = {
                        reference,
                        pseudo,
                        montant,
                        description,
                        timestamp,
                        date,
                    };

                    printHistory.push(printData);
                    savePrintData();

                    const options = { encoding: "GB18030" };
                    const printer = new Printer(device, options);

                    printer
                        .text("")
                        .align("ct")
                        .text(`${reference}`)
                        .text(`${pseudo}`)
                        .text(`${montant} euros`)
                        .text(`${date} a ${timestamp}`)
                        .cut()
                        .close();

                    console.log(`Étiquette imprimée - ${reference}`);

                    resolve({
                        success: true,
                        printData,
                        printHistory: printHistory,
                        stats: {
                            messageCount: messageCount,
                            verifiedUserCount: verifiedUsers.size,
                            printCount: printHistory.length,
                        },
                    });
                });
            });
        } catch (error) {
            console.error("Erreur lors de l'impression:", error);
            return { success: false, message: error.message };
        }
    }
);

ipcMain.handle("print-test-label", async () => {
    console.log("Test d'impression");

    // Créer une étiquette de test même sans imprimante
    const now = new Date();
    const reference = generateReference();
    const timestamp = now.toLocaleTimeString("fr-FR");
    const date = now.toLocaleDateString("fr-FR");

    const printData = {
        reference,
        pseudo: "TEST",
        montant: 0.01,
        description: "Test d'impression",
        timestamp,
        date,
    };

    printHistory.push(printData);
    savePrintData();

    if (!Printer || !USB) {
        console.log(
            "Mode simulation - étiquette enregistrée sans impression physique"
        );
        return {
            success: true,
            printData,
            message:
                "Test réussi (mode simulation - imprimante non disponible)",
            printHistory: printHistory,
            stats: {
                messageCount: messageCount,
                verifiedUserCount: verifiedUsers.size,
                printCount: printHistory.length,
            },
        };
    }

    // Tenter l'impression réelle si les modules sont disponibles
    return ipcMain.invoke("print-label", null, {
        pseudo: "TEST",
        montant: 0.01,
        description: "Test d'impression",
    });
});

ipcMain.handle("get-system-info", () => {
    return {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        modules: {
            tiktok: !!TikTokLiveConnection,
            printer: !!Printer,
            websocket: (() => {
                try {
                    require("websocket");
                    return true;
                } catch {
                    return false;
                }
            })(),
        },
    };
});

ipcMain.handle("show-error-dialog", (event, { title, message }) => {
    dialog.showErrorBox(title, message);
});

ipcMain.handle("show-info-dialog", (event, { title, message }) => {
    dialog.showMessageBox(mainWindow, {
        type: "info",
        title: title,
        message: message,
        buttons: ["OK"],
    });
});

// Gestionnaires IPC pour les mises à jour
ipcMain.handle("check-for-updates", async (event, manual = false) => {
    if (UpdateManager) {
        try {
            const updateManager = UpdateManager.getInstance();
            return await updateManager.checkForUpdates(manual);
        } catch (error) {
            console.error("Erreur lors de la vérification des mises à jour:", error);
            return { error: error.message };
        }
    }
    return { error: "Gestionnaire de mise à jour non disponible" };
});

ipcMain.handle("download-update", () => {
    if (UpdateManager) {
        const updateManager = UpdateManager.getInstance();
        updateManager.downloadUpdate();
        return { success: true };
    }
    return { error: "Gestionnaire de mise à jour non disponible" };
});

ipcMain.handle("install-update", () => {
    if (UpdateManager) {
        const updateManager = UpdateManager.getInstance();
        updateManager.quitAndInstall();
        return { success: true };
    }
    return { error: "Gestionnaire de mise à jour non disponible" };
});

ipcMain.handle("get-update-status", () => {
    if (UpdateManager) {
        const updateManager = UpdateManager.getInstance();
        return updateManager.getUpdateStatus();
    }
    return { error: "Gestionnaire de mise à jour non disponible" };
});

ipcMain.handle("set-auto-update", (event, enabled) => {
    if (UpdateManager) {
        const updateManager = UpdateManager.getInstance();
        updateManager.enableAutoUpdate(enabled);
        return { success: true };
    }
    return { error: "Gestionnaire de mise à jour non disponible" };
});

app.whenReady().then(() => {
    console.log("🚀 Démarrage de l'application TikTok Live Manager");
    console.log("📂 Dossier de données:", DATA_DIR);

    ensureDataDirectory();
    loadModules();
    createWindow();

    console.log("✅ Application démarrée");
});

app.on("window-all-closed", () => {
    console.log("Fermeture de l'application");
    // Sauvegarder les données avant de quitter
    saveVerifiedUsers();
    savePrintData();

    // Déconnecter TikTok si connecté
    if (tiktokConnection) {
        try {
            tiktokConnection.disconnect();
            tiktokConnection = null;
            isConnected = false;
        } catch (error) {
            console.error("Erreur lors de la déconnexion TikTok:", error);
        }
    }

    // Quitter l'application sur toutes les plateformes
    app.quit();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Gestion de la fermeture propre
app.on("before-quit", () => {
    console.log("Sauvegarde avant fermeture");
    saveVerifiedUsers();
    savePrintData();

    if (tiktokConnection) {
        tiktokConnection.disconnect();
    }
});

// Gestion des erreurs non capturées
process.on("uncaughtException", (error) => {
    console.error("❌ Erreur non capturée:", error);

    // Essayer de sauvegarder les données avant de quitter
    try {
        saveVerifiedUsers();
        savePrintData();
    } catch (saveError) {
        console.error("❌ Erreur lors de la sauvegarde d'urgence:", saveError);
    }
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Promise rejetée non gérée:", reason);
});

console.log("🔧 Main process initialisé avec gestion d'erreurs robuste");
