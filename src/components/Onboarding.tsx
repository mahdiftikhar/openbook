import { useState, type ReactNode } from "react";
import {
    ArrowRight,
    BookOpenText,
    FileSearch,
    FolderOpen,
    FolderPlus,
    LoaderCircle,
    MessageSquareText,
    Quote,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { workspaceApi } from "@/renderer/api/workspaceApi";

interface OnboardingProps {
    onComplete: (workspacePath: string) => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
    const [loading, setLoading] = useState(false);

    const handlePickExisting = async () => {
        setLoading(true);
        try {
            const result = await workspaceApi.pickExisting();
            if (result) onComplete(result);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNew = async () => {
        setLoading(true);
        try {
            const result = await workspaceApi.createNew();
            if (result) onComplete(result);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="onboarding-shell fixed inset-0 z-50 flex overflow-auto bg-surface-shell text-foreground">
            <div className="drag-region fixed inset-x-0 top-0 h-10" />
            <main className="relative m-auto grid w-full max-w-5xl gap-12 px-8 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                <section className="onboarding-copy max-w-xl">
                    <div className="mb-10 flex items-center gap-3">
                        <span className="brand-mark flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/15">
                            <BookOpenText className="size-5" strokeWidth={1.8} />
                        </span>
                        <div>
                            <div className="text-sm font-semibold tracking-tight">
                                openbook
                            </div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Research workspace
                            </div>
                        </div>
                    </div>

                    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                        Read with a longer memory
                    </p>
                    <h1 className="font-display text-4xl font-medium leading-[1.08] tracking-[-0.035em] sm:text-5xl">
                        Your sources, notes, and questions in one focused space.
                    </h1>
                    <p className="mt-5 max-w-lg text-[15px] leading-7 text-muted-foreground">
                        Build a library, trace every answer to its source, and keep
                        the ideas worth returning to.
                    </p>

                    <div className="mt-9 grid gap-3 sm:grid-cols-2">
                        <WorkspaceAction
                            icon={<FolderPlus className="size-5" />}
                            title="Create a workspace"
                            detail="Start a new research library"
                            primary
                            loading={loading}
                            onClick={handleCreateNew}
                        />
                        <WorkspaceAction
                            icon={<FolderOpen className="size-5" />}
                            title="Open a workspace"
                            detail="Continue where you left off"
                            loading={loading}
                            onClick={handlePickExisting}
                        />
                    </div>
                    <p className="mt-4 text-xs text-muted-foreground/80">
                        Your files stay in a folder you choose.
                    </p>
                </section>

                <ResearchPreview />
            </main>
        </div>
    );
}

function WorkspaceAction({
    icon,
    title,
    detail,
    primary = false,
    loading,
    onClick,
}: {
    icon: ReactNode;
    title: string;
    detail: string;
    primary?: boolean;
    loading: boolean;
    onClick: () => void;
}) {
    return (
        <Button
            variant={primary ? "default" : "outline"}
            className="no-drag group h-auto justify-start gap-3 rounded-xl px-4 py-3.5 text-left shadow-sm"
            onClick={onClick}
            disabled={loading}
        >
            <span className={primary ? "text-primary-foreground" : "text-primary"}>
                {loading && primary ? (
                    <LoaderCircle className="size-5 animate-spin" />
                ) : (
                    icon
                )}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{title}</span>
                <span
                    className={
                        "mt-0.5 block text-xs font-normal " +
                        (primary
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground")
                    }
                >
                    {detail}
                </span>
            </span>
            <ArrowRight className="size-4 opacity-50 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
        </Button>
    );
}

function ResearchPreview() {
    return (
        <section
            className="onboarding-preview relative hidden min-h-122.5 overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-2xl shadow-black/10 lg:block"
            aria-label="Openbook workspace preview"
        >
            <div className="flex h-11 items-center gap-2 border-b bg-surface-topbar px-4">
                <span className="size-2 rounded-full bg-primary/80" />
                <span className="text-[11px] font-semibold text-muted-foreground">
                    Field notes
                </span>
                <span className="ml-auto rounded-md border bg-background/60 px-2 py-1 text-[9px] font-medium text-muted-foreground">
                    3 sources connected
                </span>
            </div>
            <div className="grid h-111.25 grid-cols-[132px_1fr]">
                <div className="border-r bg-surface-files p-3">
                    <PreviewLabel icon={<FileSearch className="size-3" />}>
                        Library
                    </PreviewLabel>
                    {[
                        "Reading notes",
                        "Systems thinking",
                        "Design research",
                    ].map((label, index) => (
                        <div
                            key={label}
                            className={
                                "mt-1.5 truncate rounded-md px-2 py-1.5 text-[10px] " +
                                (index === 1
                                    ? "bg-primary/10 font-semibold text-primary"
                                    : "text-muted-foreground")
                            }
                        >
                            {label}
                        </div>
                    ))}
                </div>
                <div className="relative flex flex-col bg-surface-chat">
                    <div className="flex-1 px-7 py-8">
                        <PreviewLabel icon={<MessageSquareText className="size-3" />}>
                            Research thread
                        </PreviewLabel>
                        <h2 className="font-display mt-7 text-2xl font-medium leading-tight tracking-tight">
                            Where do these authors disagree about feedback loops?
                        </h2>
                        <div className="citation-thread mt-8 pl-5">
                            <p className="text-xs leading-6 text-foreground/85">
                                The disagreement is less about whether feedback
                                matters, and more about when it becomes legible to
                                the people inside the system.
                            </p>
                            <div className="mt-4 flex gap-2">
                                <span className="source-token">Meadows · p. 42</span>
                                <span className="source-token">Dubberly · p. 8</span>
                            </div>
                        </div>
                    </div>
                    <div className="m-4 rounded-xl border bg-surface-composer p-3 shadow-sm">
                        <div className="flex gap-1.5">
                            <span className="source-token">2 sources</span>
                            <span className="source-token">1 excerpt</span>
                        </div>
                        <div className="mt-3 flex items-center text-[11px] text-muted-foreground">
                            Ask a follow-up question
                            <span className="ml-auto flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                <ArrowRight className="size-3.5" />
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <Quote className="absolute right-5 top-16 size-14 text-primary/5" />
        </section>
    );
}

function PreviewLabel({
    icon,
    children,
}: {
    icon: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {icon}
            {children}
        </div>
    );
}
