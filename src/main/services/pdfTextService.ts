import fs from "node:fs";
import { extractText, getDocumentProxy } from "unpdf";

export interface PdfTextPage {
    page: number;
    text: string;
}

export interface ExtractedPdfText {
    pages: PdfTextPage[];
    totalPages: number;
}

export async function extractPdfText(
    filePath: string,
): Promise<ExtractedPdfText> {
    const buffer = fs.readFileSync(filePath);
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const extracted = await extractText(pdf, { mergePages: false });
    const pageTexts = Array.isArray(extracted.text)
        ? extracted.text
        : [extracted.text];

    return {
        totalPages: extracted.totalPages,
        pages: pageTexts.map((text, index) => ({
            page: index + 1,
            text,
        })),
    };
}
