import fs from "node:fs";
import path from "node:path";

import {
    indexNote,
    removeNoteIndex,
    renameNoteIndex,
} from "../../agents/indexing/indexService";
import { WORKSPACE_DIRS } from "../../workspaceLayout";

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

export function createNote(workspacePath: string): string {
    const notesDir = path.join(workspacePath, WORKSPACE_DIRS.notes);
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
}

export function readNote(filePath: string): string | null {
    try {
        return fs.readFileSync(filePath, "utf-8");
    } catch {
        return null;
    }
}

export async function writeNote(
    workspacePath: string,
    filePath: string,
    content: string,
): Promise<boolean> {
    try {
        fs.writeFileSync(filePath, content, "utf-8");
        await indexNote(workspacePath, filePath, content);
        return true;
    } catch {
        return false;
    }
}

export function renameNote(
    workspacePath: string,
    oldPath: string,
    newBaseName: string,
): string | null {
    const dir = path.dirname(oldPath);
    const ext = path.extname(oldPath);
    const slug = slugify(newBaseName);
    if (!slug) return null;

    const candidate = `${slug}${ext}`;
    const candidatePath = path.join(dir, candidate);
    if (candidatePath === oldPath) return oldPath;
    if (fs.existsSync(candidatePath)) return null;

    fs.renameSync(oldPath, candidatePath);
    renameNoteIndex(workspacePath, oldPath, candidatePath);
    return candidatePath;
}

export function deleteNote(workspacePath: string, filePath: string): boolean {
    try {
        fs.rmSync(filePath);
        removeNoteIndex(workspacePath, filePath);
        return true;
    } catch {
        return false;
    }
}
