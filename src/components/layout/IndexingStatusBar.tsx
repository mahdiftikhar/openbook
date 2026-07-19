import { AlertCircle, LoaderCircle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { IndexReconciliationResult } from "@/shared/types";

export function IndexingStatusBar({
    running,
    result,
    onRetry,
}: {
    running: boolean;
    result: IndexReconciliationResult | null;
    onRetry: () => void;
}) {
    if (running) {
        return (
            <div className="flex shrink-0 items-center gap-2 border-b border-border/70 bg-surface-topbar px-4 py-2 text-xs text-muted-foreground">
                <LoaderCircle className="size-3.5 animate-spin text-primary" />
                Updating the workspace search index...
            </div>
        );
    }

    if (!result || result.status === "complete") return null;

    const detail =
        result.issue?.message ??
        "Some workspace files could not be added to the search index.";
    const fileCount = result.failed;

    return (
        <div
            className="flex shrink-0 items-center gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive"
            role="alert"
        >
            <AlertCircle className="size-4 shrink-0" />
            <div className="min-w-0 flex-1">
                <p className="font-medium">Search indexing needs attention</p>
                <p className="mt-0.5 text-destructive/80">
                    {detail}
                    {fileCount > 0
                        ? ` ${fileCount} ${fileCount === 1 ? "file" : "files"} could not be indexed.`
                        : ""}
                </p>
            </div>
            <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0 gap-1.5 border-destructive/30 bg-background/60 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onRetry}
            >
                <RotateCw className="size-3" />
                Retry indexing
            </Button>
        </div>
    );
}
