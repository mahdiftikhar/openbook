import { useEffect, useRef, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { PanelTabBar } from "@/components/panels/PanelTabBar";
import { Button } from "@/components/ui/button";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export function PdfViewer({
    filePath,
    targetPage,
    onClose,
}: {
    filePath: string;
    targetPage: number | null;
    onClose: () => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
    const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load the PDF document whenever the selected file changes.
    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);

            try {
                const buf = await window.electron.sources.readFile(filePath);
                if (cancelled) return;
                if (!buf) {
                    setError("Could not read file");
                    setLoading(false);
                    return;
                }

                const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
                if (cancelled) return;
                pdfRef.current = pdf;

                setNumPages(pdf.numPages);
                setCurrentPage(1);
                setLoading(false);
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to load PDF",
                    );
                    setLoading(false);
                }
            }
        }

        load();

        return () => {
            cancelled = true;
            renderTaskRef.current?.cancel();
        };
    }, [filePath]);

    useEffect(() => {
        if (!targetPage || numPages === 0) return;
        setCurrentPage(Math.max(1, Math.min(numPages, targetPage)));
    }, [targetPage, numPages]);

    // Render the selected PDF page onto the canvas.
    useEffect(() => {
        const pdf = pdfRef.current;
        const canvas = canvasRef.current;

        if (!pdf || !canvas) return;
        renderTaskRef.current?.cancel();

        async function render() {
            const page = await pdf.getPage(currentPage);
            const viewport = page.getViewport({ scale });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            renderTaskRef.current = page.render({ canvas, viewport });
            await renderTaskRef.current.promise;
        }
        render();
    }, [currentPage, scale, numPages]);

    const changeZoom = (delta: number) =>
        setScale((s) => Math.max(0.5, Math.min(3, s + delta)));

    const fileName = filePath.split(/[/\\]/).pop() ?? filePath;

    return (
        <section className="flex h-full flex-col bg-surface-reference">
            <PdfToolbar
                filePath={filePath}
                fileName={fileName}
                numPages={numPages}
                currentPage={currentPage}
                scale={scale}
                onZoomOut={() => changeZoom(-0.25)}
                onZoomIn={() => changeZoom(0.25)}
                onPreviousPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
                onNextPage={() =>
                    setCurrentPage((p) => Math.min(numPages, p + 1))
                }
                onClose={onClose}
            />
            <PdfCanvasArea
                canvasRef={canvasRef}
                loading={loading}
                error={error}
            />
        </section>
    );
}

function PdfToolbar({
    filePath,
    fileName,
    numPages,
    currentPage,
    scale,
    onZoomOut,
    onZoomIn,
    onPreviousPage,
    onNextPage,
    onClose,
}: {
    filePath: string;
    fileName: string;
    numPages: number;
    currentPage: number;
    scale: number;
    onZoomOut: () => void;
    onZoomIn: () => void;
    onPreviousPage: () => void;
    onNextPage: () => void;
    onClose: () => void;
}) {
    return (
        <>
            <PanelTabBar
                className="bg-surface-reference-header"
                activeTabClassName="border-b-surface-reference bg-surface-reference"
                tabs={[{ id: filePath, title: fileName }]}
                activeTabId={filePath}
            />
            <div className="flex h-9 shrink-0 items-center justify-end border-b bg-surface-reference-header px-2">
                <div className="flex items-center gap-1">
                    <ZoomOutButton scale={scale} onZoomOut={onZoomOut} />
                    <ZoomIndicator scale={scale} />
                    <ZoomInButton scale={scale} onZoomIn={onZoomIn} />
                    <ToolbarDivider />
                    <PreviousPageButton
                        currentPage={currentPage}
                        onPreviousPage={onPreviousPage}
                    />
                    <PageIndicator currentPage={currentPage} numPages={numPages} />
                    <NextPageButton
                        currentPage={currentPage}
                        numPages={numPages}
                        onNextPage={onNextPage}
                    />
                    <ToolbarDivider />
                    <ClosePdfButton onClose={onClose} />
                </div>
            </div>
        </>
    );
}

function ZoomOutButton({
    scale,
    onZoomOut,
}: {
    scale: number;
    onZoomOut: () => void;
}) {
    return (
        <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onZoomOut}
            disabled={scale <= 0.5}
        >
            -
        </Button>
    );
}

function ZoomIndicator({ scale }: { scale: number }) {
    return (
        <span className="w-10 text-center text-xs text-muted-foreground">
            {Math.round(scale * 100)}%
        </span>
    );
}

function ZoomInButton({
    scale,
    onZoomIn,
}: {
    scale: number;
    onZoomIn: () => void;
}) {
    return (
        <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onZoomIn}
            disabled={scale >= 3}
        >
            +
        </Button>
    );
}

function PreviousPageButton({
    currentPage,
    onPreviousPage,
}: {
    currentPage: number;
    onPreviousPage: () => void;
}) {
    return (
        <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onPreviousPage}
            disabled={currentPage <= 1}
        >
            <ChevronLeft className="size-4" />
        </Button>
    );
}

function PageIndicator({
    currentPage,
    numPages,
}: {
    currentPage: number;
    numPages: number;
}) {
    return (
        <span className="w-16 text-center text-xs tabular-nums text-muted-foreground">
            {currentPage} / {numPages || "?"}
        </span>
    );
}

function NextPageButton({
    currentPage,
    numPages,
    onNextPage,
}: {
    currentPage: number;
    numPages: number;
    onNextPage: () => void;
}) {
    return (
        <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onNextPage}
            disabled={currentPage >= numPages}
        >
            <ChevronRight className="size-4" />
        </Button>
    );
}

function ToolbarDivider() {
    return <div className="mx-1 h-5 w-px bg-border" />;
}

function ClosePdfButton({ onClose }: { onClose: () => void }) {
    return (
        <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClose}
            aria-label="Close PDF"
        >
            <X className="size-4" />
        </Button>
    );
}

function PdfCanvasArea({
    canvasRef,
    loading,
    error,
}: {
    canvasRef: RefObject<HTMLCanvasElement>;
    loading: boolean;
    error: string | null;
}) {
    return (
        <div className="min-h-0 flex-1 overflow-auto bg-surface-pdf-canvas">
            {loading && <PdfLoadingMessage />}
            {error && <PdfErrorMessage error={error} />}
            <canvas
                ref={canvasRef}
                className="mx-auto my-4 shadow-lg"
                style={{ display: loading || error ? "none" : "block" }}
            />
        </div>
    );
}

function PdfLoadingMessage() {
    return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading PDF...
        </div>
    );
}

function PdfErrorMessage({ error }: { error: string }) {
    return (
        <div className="flex h-full items-center justify-center text-sm text-destructive">
            {error}
        </div>
    );
}
