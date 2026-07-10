import { app, BrowserWindow } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";

import { loadEnvFiles } from "./env";
import { registerWorkspaceHandlers } from "./workspace";
import { registerSourcesHandlers } from "./sources";
import { registerChatHandlers } from "./chat";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
    app.quit();
}

const createWindow = () => {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: "#0b111d",
        show: false,
        frame: process.platform !== "darwin",
        titleBarStyle: process.platform === "darwin" ? "hidden" : "default",
        ...(process.platform === "darwin"
            ? { titleBarOverlay: { height: 36 } }
            : {}),
        title: "openbook",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
        },
    });

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
        mainWindow.loadFile(
            path.join(
                __dirname,
                `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
            ),
        );
    }

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
    });
};

loadEnvFiles();
registerWorkspaceHandlers();
registerSourcesHandlers();
registerChatHandlers();

app.on("ready", createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
