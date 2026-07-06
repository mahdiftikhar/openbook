import { type ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export type PanelTab = {
    id: string;
    title: string;
    dirty?: boolean;
    closable?: boolean;
};

export function PanelTabBar({
    tabs,
    activeTabId,
    onSelectTab,
    onCloseTab,
    actions,
    className,
    activeTabClassName,
}: {
    tabs: PanelTab[];
    activeTabId: string;
    onSelectTab?: (id: string) => void;
    onCloseTab?: (id: string) => void;
    actions?: ReactNode;
    className?: string;
    activeTabClassName?: string;
}) {
    return (
        <div
            className={cn(
                "flex h-9 shrink-0 items-center justify-between border-b px-2",
                className,
            )}
        >
            <div role="tablist" className="flex h-full min-w-0 items-end gap-1">
                {tabs.map((tab) => {
                    const active = tab.id === activeTabId;
                    const closable = tab.closable && onCloseTab;

                    return (
                        <div
                            key={tab.id}
                            className={cn(
                                "-mb-px flex h-8 min-w-0 max-w-56 items-center rounded-t-md border border-transparent text-xs font-medium transition-colors",
                                active
                                    ? cn(
                                          "border-border border-b-background bg-background text-foreground",
                                          activeTabClassName,
                                      )
                                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
                            )}
                        >
                            <button
                                type="button"
                                role="tab"
                                aria-selected={active}
                                tabIndex={active ? 0 : -1}
                                title={tab.title}
                                className="flex h-full min-w-0 items-center gap-1.5 px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                onClick={() => onSelectTab?.(tab.id)}
                            >
                                <span className="truncate">{tab.title}</span>
                                {tab.dirty ? (
                                    <span
                                        className="size-1.5 shrink-0 rounded-full bg-primary"
                                        aria-label="Unsaved changes"
                                    />
                                ) : null}
                            </button>
                            {closable ? (
                                <button
                                    type="button"
                                    className="mr-1 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                                    aria-label={`Close ${tab.title}`}
                                    title="Close tab"
                                    onClick={() => onCloseTab(tab.id)}
                                >
                                    <X className="size-3" />
                                </button>
                            ) : null}
                        </div>
                    );
                })}
            </div>
            {actions ? (
                <div className="flex shrink-0 items-center gap-1 pl-2">{actions}</div>
            ) : null}
        </div>
    );
}
