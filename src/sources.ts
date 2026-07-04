import { dialog, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import { extractText, getDocumentProxy } from "unpdf";

// Storage layout under workspace/:
//   sources/<fileName>.pdf            — the original PDF (unique filename)
//   .openbook/text/<fileName>.txt     — extracted text sidecar (greppable)
//   .openbook/sources-index.json      — metadata index: Record<fileName, SourceEntry>

interface SourcesIndex {
  [fileName: string]: SourceEntry;
}

function getSourcesDir(workspacePath: string): string {
  return path.join(workspacePath, "sources");
}

function getIndexFilePath(workspacePath: string): string {
  return path.join(workspacePath, ".openbook", "sources-index.json");
}

function getTextSidecarPath(workspacePath: string, fileName: string): string {
  return path.join(
    workspacePath,
    ".openbook",
    "text",
    fileName.replace(/\.pdf$/i, ".txt"),
  );
}

function readIndex(workspacePath: string): SourcesIndex {
  try {
    return JSON.parse(
      fs.readFileSync(getIndexFilePath(workspacePath), "utf-8"),
    );
  } catch {
    return {};
  }
}

function writeIndex(workspacePath: string, index: SourcesIndex): void {
  fs.mkdirSync(path.dirname(getIndexFilePath(workspacePath)), {
    recursive: true,
  });
  fs.writeFileSync(
    getIndexFilePath(workspacePath),
    JSON.stringify(index, null, 2),
    "utf-8",
  );
}

function uniqueName(dir: string, baseName: string, ext: string): string {
  let candidate = `${baseName}${ext}`;
  let n = 2;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${baseName}-${n}${ext}`;
    n += 1;
  }
  return candidate;
}

export function registerSourcesHandlers(): void {
  ipcMain.handle("sources:list", (_event, workspacePath: string) => {
    return Object.values(readIndex(workspacePath));
  });

  ipcMain.handle(
    "sources:open",
    async (_event, filePath: string) => {
      if (fs.existsSync(filePath)) {
        await shell.openPath(filePath);
      }
    },
  );

  ipcMain.handle(
    "sources:add-pdf",
    async (_event, workspacePath: string) => {
      const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "PDF Files", extensions: ["pdf"] }],
        title: "Add PDF source",
      });
      if (result.canceled || result.filePaths.length === 0) return null;

      const originalPath = result.filePaths[0];
      const originalName = path.basename(originalPath);
      const baseName = originalName.replace(/\.pdf$/i, "");

      const sourcesDir = getSourcesDir(workspacePath);
      fs.mkdirSync(sourcesDir, { recursive: true });

      const fileName = uniqueName(sourcesDir, baseName, ".pdf");
      const destPath = path.join(sourcesDir, fileName);
      fs.copyFileSync(originalPath, destPath);

      let totalPages = 0;
      let textContent = "";
      let extractionError: string | undefined;

      try {
        const buffer = fs.readFileSync(destPath);
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const extracted = await extractText(pdf, { mergePages: true });
        totalPages = extracted.totalPages;
        textContent = extracted.text;
        const sidecarPath = getTextSidecarPath(workspacePath, fileName);
        fs.mkdirSync(path.dirname(sidecarPath), { recursive: true });
        fs.writeFileSync(sidecarPath, textContent, "utf-8");
      } catch (err) {
        extractionError = err instanceof Error ? err.message : String(err);
      }

      const entry: SourceEntry = {
        fileName,
        fileType: "pdf",
        status: extractionError ? "error" : "ready",
        addedAt: new Date().toISOString(),
        totalPages,
        ...(extractionError ? { error: extractionError } : {}),
      };

      const index = readIndex(workspacePath);
      index[fileName] = entry;
      writeIndex(workspacePath, index);

      return entry;
    },
  );

  ipcMain.handle(
    "sources:remove",
    async (_event, workspacePath: string, fileName: string) => {
      const index = readIndex(workspacePath);
      if (!(fileName in index)) return false;

      const sourcesDir = getSourcesDir(workspacePath);
      const pdfPath = path.join(sourcesDir, fileName);
      const txtPath = getTextSidecarPath(workspacePath, fileName);
      for (const p of [pdfPath, txtPath]) {
        try {
          fs.rmSync(p);
        } catch {
          // File may not exist
        }
      }

      delete index[fileName];
      writeIndex(workspacePath, index);
      return true;
    },
  );
}