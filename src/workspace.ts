import { app, dialog, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs";

const REQUIRED_DIRS = ["notes", "sources", ".opencode"];

interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
}

function getConfigPath(): string {
  return path.join(app.getPath("userData"), "config.json");
}

function readConfig(): { workspacePath?: string } {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), "utf-8"));
  } catch {
    return {};
  }
}

function writeConfig(config: { workspacePath?: string }): void {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), "utf-8");
}

function validateProject(projectPath: string): boolean {
  return REQUIRED_DIRS.every((dir) => {
    try {
      return fs.statSync(path.join(projectPath, dir)).isDirectory();
    } catch {
      return false;
    }
  });
}

function createProjectStructure(projectPath: string): void {
  for (const dir of REQUIRED_DIRS) {
    fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
  }
}

function readDirectoryTree(dirPath: string, depth = 0): FileNode[] {
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
        children: readDirectoryTree(fullPath, depth + 1),
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

export function registerWorkspaceHandlers(): void {
  ipcMain.handle("workspace:get-path", () => {
    return readConfig().workspacePath ?? null;
  });

  ipcMain.handle("workspace:pick-existing", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Select an existing openbook project",
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const projectPath = result.filePaths[0];
    if (!validateProject(projectPath)) {
      await dialog.showMessageBox({
        type: "error",
        title: "Invalid project",
        message:
          "The selected folder does not follow the openbook project structure.",
        detail: `A valid project must contain:\n${REQUIRED_DIRS.map((d) => `  ${d}/`).join("\n")}`,
      });
      return null;
    }

    writeConfig({ workspacePath: projectPath });
    return projectPath;
  });

  ipcMain.handle("workspace:list-files", (_event, workspacePath: string) => {
    return readDirectoryTree(workspacePath);
  });

  ipcMain.handle("workspace:clear", () => {
    writeConfig({});
  });

  ipcMain.handle("workspace:create-new", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Select a location for your new openbook project",
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const projectPath = result.filePaths[0];
    createProjectStructure(projectPath);
    writeConfig({ workspacePath: projectPath });
    return projectPath;
  });
}
