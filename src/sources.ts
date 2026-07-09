import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import { extractText, getDocumentProxy } from "unpdf";
import { WORKSPACE_DIRS, WORKSPACE_FILES } from "./workspaceLayout";

// Storage layout under workspace/:
//   WORKSPACE_DIRS.sources/<fileName>.pdf
//   WORKSPACE_DIRS.metadata/WORKSPACE_DIRS.text/<fileName>.txt
//   WORKSPACE_DIRS.metadata/WORKSPACE_DIRS.text/<fileName>.pages.json
//   WORKSPACE_DIRS.metadata/WORKSPACE_FILES.sourcesIndex

interface SourcesIndex {
    [fileName: string]: SourceEntry;
}

interface SourceTextPage {
    page: number;
    text: string;
}

function getSourcesDir(workspacePath: string): string {
    return path.join(workspacePath, WORKSPACE_DIRS.sources);
}

function getIndexFilePath(workspacePath: string): string {
    return path.join(
        workspacePath,
        WORKSPACE_DIRS.metadata,
        WORKSPACE_FILES.sourcesIndex,
    );
}

export function getTextSidecarPath(workspacePath: string, fileName: string): string {
    return path.join(
        workspacePath,
        WORKSPACE_DIRS.metadata,
        WORKSPACE_DIRS.text,
        fileName.replace(/\.pdf$/i, ".txt"),
    );
}

function getPageTextSidecarPath(workspacePath: string, fileName: string): string {
    return path.join(
        workspacePath,
        WORKSPACE_DIRS.metadata,
        WORKSPACE_DIRS.text,
        fileName.replace(/\.pdf$/i, ".pages.json"),
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

async function addPdfSource(
    workspacePath: string,
): Promise<SourceEntry | null> {
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
    let pages: SourceTextPage[] = [];
    let extractionError: string | undefined;

    try {
        const buffer = fs.readFileSync(destPath);
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const extracted = await extractText(pdf, { mergePages: false });
        totalPages = extracted.totalPages;
        const pageTexts = Array.isArray(extracted.text)
            ? extracted.text
            : [extracted.text];
        pages = pageTexts.map((text, index) => ({
            page: index + 1,
            text,
        }));
        textContent = pageTexts.join("\n\n");
        const sidecarPath = getTextSidecarPath(workspacePath, fileName);
        fs.mkdirSync(path.dirname(sidecarPath), { recursive: true });
        fs.writeFileSync(sidecarPath, textContent, "utf-8");
        fs.writeFileSync(
            getPageTextSidecarPath(workspacePath, fileName),
            JSON.stringify(pages, null, 2),
            "utf-8",
        );
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
}

function removeSource(workspacePath: string, fileName: string): boolean {
    const index = readIndex(workspacePath);
    if (!(fileName in index)) return false;

    const sourcesDir = getSourcesDir(workspacePath);
    const pdfPath = path.join(sourcesDir, fileName);
    const txtPath = getTextSidecarPath(workspacePath, fileName);
    const pagesPath = getPageTextSidecarPath(workspacePath, fileName);
    for (const p of [pdfPath, txtPath, pagesPath]) {
        try {
            fs.rmSync(p);
        } catch {
            // File may not exist
        }
    }

    delete index[fileName];
    writeIndex(workspacePath, index);
    return true;
}

function renameSource(
    workspacePath: string,
    oldFileName: string,
    newBaseName: string,
): SourceEntry | null {
    const index = readIndex(workspacePath);
    const entry = index[oldFileName];
    if (!entry) return null;

    const baseName = newBaseName
        .trim()
        .replace(/\.pdf$/i, "")
        .replace(/[\\/]/g, "-");
    if (!baseName) return null;

    const requestedFileName = `${baseName}.pdf`;
    if (requestedFileName === oldFileName) return entry;

    const sourcesDir = getSourcesDir(workspacePath);
    const newFileName = uniqueName(sourcesDir, baseName, ".pdf");
    if (newFileName === oldFileName) return entry;

    const oldPdfPath = path.join(sourcesDir, oldFileName);
    const newPdfPath = path.join(sourcesDir, newFileName);
    if (!fs.existsSync(oldPdfPath)) return null;

    fs.renameSync(oldPdfPath, newPdfPath);

    const sidecars = [
        [
            getTextSidecarPath(workspacePath, oldFileName),
            getTextSidecarPath(workspacePath, newFileName),
        ],
        [
            getPageTextSidecarPath(workspacePath, oldFileName),
            getPageTextSidecarPath(workspacePath, newFileName),
        ],
    ];
    for (const [oldPath, newPath] of sidecars) {
        if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
    }

    const renamed = { ...entry, fileName: newFileName };
    delete index[oldFileName];
    index[newFileName] = renamed;
    writeIndex(workspacePath, index);
    return renamed;
}

export function registerSourcesHandlers(): void {
    ipcMain.handle("sources:list", (_event, workspacePath: string) => {
        return Object.values(readIndex(workspacePath));
    });

    ipcMain.handle("sources:read-file", async (_event, filePath: string) => {
        try {
            const buf = fs.readFileSync(filePath);
            return buf.buffer.slice(
                buf.byteOffset,
                buf.byteOffset + buf.byteLength,
            );
        } catch {
            return null;
        }
    });

    ipcMain.handle("sources:open", async (_event, filePath: string) => {
        if (fs.existsSync(filePath)) {
            await shell.openPath(filePath);
        }
    });

    ipcMain.handle("sources:add-pdf", async (_event, workspacePath: string) => {
        return addPdfSource(workspacePath);
    });

    ipcMain.handle(
        "sources:remove",
        async (_event, workspacePath: string, fileName: string) => {
            const choice = await dialog.showMessageBox(
                BrowserWindow.getFocusedWindow() ?? undefined,
                {
                    type: "warning",
                    buttons: ["Delete", "Cancel"],
                    defaultId: 1,
                    title: "Delete source",
                    message: `Delete "${fileName}"?`,
                    detail: "This cannot be undone.",
                },
            );
            if (choice.response !== 0) return false;
            return removeSource(workspacePath, fileName);
        },
    );

    ipcMain.handle(
        "sources:rename",
        async (
            _event,
            workspacePath: string,
            oldFileName: string,
            newBaseName: string,
        ) => {
            return renameSource(workspacePath, oldFileName, newBaseName);
        },
    );
}
