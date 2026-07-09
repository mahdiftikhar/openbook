import { useEffect, useRef, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { PanelTabBar } from "@/components/panels/PanelTabBar";
import { Button } from "@/components/ui/button";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export function PdfViewer({
    filePath,
    targetPage,
    highlightText,
    onAddTextContext,
    onClose,
}: {
    filePath: string;
    targetPage: number | null;
    highlightText: string | null;
    onAddTextContext: (excerpt: TextExcerpt) => void;
    onClose: () => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const highlightCanvasRef = useRef<HTMLCanvasElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
    const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
    const textLayerTaskRef = useRef<pdfjsLib.TextLayer | null>(null);
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
            textLayerTaskRef.current?.cancel();
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
        textLayerTaskRef.current?.cancel();

        let cancelled = false;

        async function render() {
            try {
                const page = await pdf.getPage(currentPage);
                if (cancelled) return;

                const viewport = page.getViewport({ scale });
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                renderTaskRef.current = page.render({ canvas, viewport });

                const textContent = await page.getTextContent();
                if (cancelled) return;

                await renderTaskRef.current.promise;
                if (cancelled) return;

                const textDiv = textLayerRef.current;
                if (textDiv) {
                    textDiv.innerHTML = "";
                    textLayerTaskRef.current = new pdfjsLib.TextLayer({
                        textContentSource: textContent,
                        container: textDiv,
                        viewport,
                    });
                    await textLayerTaskRef.current.render();
                }
            } catch {
                // silently handle render failures
            }
        }
        render();

        return () => {
            cancelled = true;
            renderTaskRef.current?.cancel();
            textLayerTaskRef.current?.cancel();
        };
    }, [currentPage, scale, numPages]);

    useEffect(() => {
        const hCanvas = highlightCanvasRef.current;
        const mCanvas = canvasRef.current;
        const pdf = pdfRef.current;

        if (!hCanvas || !mCanvas || !pdf || numPages === 0) return;

        const ctx = hCanvas.getContext("2d");
        if (!ctx) return;

        if (hCanvas.width !== mCanvas.width || hCanvas.height !== mCanvas.height) {
            hCanvas.width = mCanvas.width;
            hCanvas.height = mCanvas.height;
        }

        ctx.clearRect(0, 0, hCanvas.width, hCanvas.height);

        if (!highlightText || targetPage !== currentPage) return;

        let cancelled = false;

        const timer = setTimeout(async () => {
            if (cancelled) return;

            try {
                const page = await pdf.getPage(currentPage);
                const viewport = page.getViewport({ scale });
                const textContent = await page.getTextContent();
                if (cancelled) return;

                const ctx2 = hCanvas.getContext("2d");
                if (!ctx2) return;

                const segments: {
                    item: { str: string; width: number; height: number; transform: number[] };
                    start: number;
                    end: number;
                }[] = [];
                let concat = "";

                for (const item of textContent.items) {
                    if (!("str" in item)) continue;
                    const str = (item.str as string).replace(/\s+/g, " ").trim();
                    if (!str) continue;
                    const start = concat.length;
                    concat += (concat.length > 0 ? " " : "") + str;
                    segments.push({
                        item: item as { str: string; width: number; height: number; transform: number[] },
                        start,
                        end: concat.length,
                    });
                }

                let search = highlightText
                    .replace(/^\.\.\./, "")
                    .replace(/\.\.\.$/, "")
                    .trim()
                    .replace(/\s+/g, " ")
                    .toLowerCase();

                const lowerConcat = concat.toLowerCase();
                let matchStart = lowerConcat.indexOf(search);

                if (matchStart === -1 && search.length > 200) {
                    const shorter = search.slice(0, 200);
                    matchStart = lowerConcat.indexOf(shorter);
                    if (matchStart !== -1) search = shorter;
                }

                if (matchStart === -1) return;

                const matchEnd = matchStart + search.length;

                const matchingItems = segments.filter(
                    (seg) => seg.start < matchEnd && seg.end > matchStart,
                );

                ctx2.fillStyle = "rgba(253, 224, 71, 0.35)";

                const viewTransform = viewport.transform;

                for (const { item } of matchingItems) {
                    const tx = item.transform;
                    const canvasX =
                        viewTransform[0] * tx[4] +
                        viewTransform[2] * tx[5] +
                        viewTransform[4];
                    const canvasBaselineY =
                        viewTransform[1] * tx[4] +
                        viewTransform[3] * tx[5] +
                        viewTransform[5];

                    const textHeight = Math.abs(item.height * viewTransform[3]);
                    const textWidth = Math.abs(item.width * viewTransform[0]);

                    ctx2.fillRect(
                        canvasX,
                        canvasBaselineY - textHeight,
                        textWidth,
                        textHeight,
                    );
                }
            } catch {
                // highlight failure is non-critical
            }
        }, 50);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [currentPage, highlightText, scale, numPages, targetPage]);

    const [selectionState, setSelectionState] = useState<{
        text: string;
        x: number;
        y: number;
    } | null>(null);

    useEffect(() => {
        const handleSelectionChange = () => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) {
                setSelectionState(null);
                return;
            }
            const text = selection.toString().trim();
            if (!text) {
                setSelectionState(null);
                return;
            }
            const node = selection.anchorNode;
            if (!node || !(node.parentElement as HTMLElement | null)?.closest(".textLayer")) {
                setSelectionState(null);
                return;
            }
            const rect = selection.getRangeAt(0).getBoundingClientRect();
            setSelectionState({
                text,
                x: rect.left + rect.width / 2,
                y: rect.top,
            });
        };

        document.addEventListener("selectionchange", handleSelectionChange);
        return () =>
            document.removeEventListener("selectionchange", handleSelectionChange);
    }, []);

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
                highlightCanvasRef={highlightCanvasRef}
                textLayerRef={textLayerRef}
                loading={loading}
                error={error}
            />
            {selectionState && (
                <FloatingAddButton
                    x={selectionState.x}
                    y={selectionState.y}
                    onAdd={() => {
                        onAddTextContext({
                            text: selectionState.text,
                            filePath,
                            page: currentPage,
                        });
                        window.getSelection()?.removeAllRanges();
                        setSelectionState(null);
                    }}
                />
            )}
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
    highlightCanvasRef,
    textLayerRef,
    loading,
    error,
}: {
    canvasRef: RefObject<HTMLCanvasElement>;
    highlightCanvasRef: RefObject<HTMLCanvasElement>;
    textLayerRef: RefObject<HTMLDivElement>;
    loading: boolean;
    error: string | null;
}) {
    return (
        <div className="min-h-0 flex-1 overflow-auto bg-surface-pdf-canvas">
            {loading && <PdfLoadingMessage />}
            {error && <PdfErrorMessage error={error} />}
            <div
                className="relative mx-auto my-4 w-fit shadow-lg"
                style={{ display: loading || error ? "none" : "block" }}
            >
                <canvas ref={canvasRef} style={{ display: "block" }} />
                <canvas
                    ref={highlightCanvasRef}
                    style={{
                        display: "block",
                        left: 0,
                        pointerEvents: "none",
                        position: "absolute",
                        top: 0,
                    }}
                />
                <div ref={textLayerRef} className="textLayer" />
            </div>
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

function FloatingAddButton({
    x,
    y,
    onAdd,
}: {
    x: number;
    y: number;
    onAdd: () => void;
}) {
    const below = y + 34 > window.innerHeight;
    const top = below ? y + 10 : y - 34;
    const left = Math.max(4, Math.min(x - 48, window.innerWidth - 100));

    return (
        <div
            className="pointer-events-none fixed z-50"
            style={{ left, top }}
        >
            <button
                type="button"
                className="pointer-events-auto flex items-center gap-1 rounded-md bg-popover px-2 py-1 text-xs font-medium text-foreground shadow-md ring-1 ring-border hover:bg-accent"
                onClick={onAdd}
            >
                <Plus className="size-3" />
                Add to chat
            </button>
        </div>
    );
}
