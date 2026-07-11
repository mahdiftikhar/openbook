import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

import { REQUIRED_WORKSPACE_DIRS } from "../../workspaceLayout";
import type { FileNode } from "../../shared/types";

interface AppConfig {
    workspacePath?: string;
}

function getConfigPath(): string {
    return path.join(app.getPath("userData"), "config.json");
}

function readConfig(): AppConfig {
    try {
        return JSON.parse(fs.readFileSync(getConfigPath(), "utf-8"));
    } catch {
        return {};
    }
}

function writeConfig(config: AppConfig): void {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), "utf-8");
}

export function getSavedWorkspacePath(): string | null {
    return readConfig().workspacePath ?? null;
}

export function saveWorkspacePath(workspacePath: string): void {
    writeConfig({ workspacePath });
}

export function clearSavedWorkspacePath(): void {
    writeConfig({});
}

export function validateWorkspace(workspacePath: string): boolean {
    return REQUIRED_WORKSPACE_DIRS.every((dir) => {
        try {
            return fs.statSync(path.join(workspacePath, dir)).isDirectory();
        } catch {
            return false;
        }
    });
}

export function createWorkspaceStructure(workspacePath: string): void {
    for (const dir of REQUIRED_WORKSPACE_DIRS) {
        fs.mkdirSync(path.join(workspacePath, dir), { recursive: true });
    }
}

export function listWorkspaceFiles(dirPath: string, depth = 0): FileNode[] {
    if (depth > 10) return [];

    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
        return [];
    }

    const nodes: FileNode[] = [];

    for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            nodes.push({
                name: entry.name,
                type: "folder",
                path: fullPath,
                children: listWorkspaceFiles(fullPath, depth + 1),
            });
        } else {
            nodes.push({
                name: entry.name,
                type: "file",
                path: fullPath,
            });
        }
    }

    nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    return nodes;
}
