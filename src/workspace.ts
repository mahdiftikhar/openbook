import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs";

const REQUIRED_DIRS = ["notes", "sources", ".openbook"];
const NOTES_DIR = "notes";

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

function slugify(text: string): string {
  return text
    .trim()
    .replace(/^\s*#+\s*/, "")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}._-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
}

function findUniqueName(dir: string, slug: string, ext: string): string {
  let candidate = `${slug}${ext}`;
  let n = 2;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${slug}-${n}${ext}`;
    n += 1;
  }
  return candidate;
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

  ipcMain.handle("notes:create", (_event, workspacePath: string) => {
    const notesDir = path.join(workspacePath, NOTES_DIR);
    fs.mkdirSync(notesDir, { recursive: true });

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
      now.getDate(),
    )}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const fileName = findUniqueName(notesDir, `untitled-${stamp}`, ".md");
    const filePath = path.join(notesDir, fileName);
    fs.writeFileSync(filePath, "", "utf-8");
    return filePath;
  });

  ipcMain.handle("notes:read", (_event, filePath: string) => {
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch {
      return null;
    }
  });

  ipcMain.handle("notes:write", (_event, filePath: string, content: string) => {
    try {
      fs.writeFileSync(filePath, content, "utf-8");
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle(
    "notes:rename",
    (_event, oldPath: string, newBaseName: string) => {
      const dir = path.dirname(oldPath);
      const ext = path.extname(oldPath);
      const slug = slugify(newBaseName);
      if (!slug) return null;

      const candidate = `${slug}${ext}`;
      const candidatePath = path.join(dir, candidate);
      if (candidatePath === oldPath) return oldPath;
      if (fs.existsSync(candidatePath)) return null;

      fs.renameSync(oldPath, candidatePath);
      return candidatePath;
    },
  );

  ipcMain.handle("notes:delete", async (_event, filePath: string) => {
    const baseName = path.basename(filePath);
    const choice = await dialog.showMessageBox(
      BrowserWindow.getFocusedWindow() ?? undefined,
      {
        type: "warning",
        buttons: ["Delete", "Cancel"],
        defaultId: 1,
        title: "Delete note",
        message: `Delete "${baseName}"?`,
        detail: "This cannot be undone.",
      },
    );
    if (choice.response !== 0) return false;
    try {
      fs.rmSync(filePath);
      return true;
    } catch {
      return false;
    }
  });
}
