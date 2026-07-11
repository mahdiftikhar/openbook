import {
    useEffect,
    useRef,
    useState,
    type Dispatch,
    type ReactNode,
    type RefObject,
    type SetStateAction,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    ArrowUp,
    BookOpenCheck,
    ChevronDown,
    CircleUserRound,
    LoaderCircle,
    Paperclip,
    Sparkles,
    Square,
    X,
} from "lucide-react";

import {
    MarkdownEditor,
    type MarkdownEditorWidget,
} from "@/components/editor/MarkdownEditor";
import { PanelTabBar } from "@/components/panels/PanelTabBar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { chatApi } from "@/renderer/api/chatApi";
import { sourcesApi } from "@/renderer/api/sourcesApi";
import type {
    ChatCitation,
    SourceEntry,
    TextExcerpt,
} from "@/shared/types";

type Message = {
    id: string;
    role: "user" | "assistant";
    content: string;
    citations?: ChatCitation[];
    status?: "streaming" | "error";
};

const CITATION_LINK_PREFIX = "#openbook-citation-";

export function ChatPanel({
    workspacePath,
    sourcesRefreshKey,
    selectedSourceNames,
    contextTexts,
    onSelectedSourceNamesChange,
    onContextTextsChange,
    onOpenCitation,
}: {
    workspacePath: string;
    sourcesRefreshKey: number;
    selectedSourceNames: string[];
    contextTexts: TextExcerpt[];
    onSelectedSourceNamesChange: Dispatch<SetStateAction<string[]>>;
    onContextTextsChange: Dispatch<SetStateAction<TextExcerpt[]>>;
    onOpenCitation: (citation: ChatCitation) => void;
}) {
    const [sources, setSources] = useState<SourceEntry[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [draft, setDraft] = useState("");
    const [streaming, setStreaming] = useState(false);
    const activeRequestRef = useRef<string | null>(null);
    const activeAssistantMessageRef = useRef<string | null>(null);
    const messageListRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        let active = true;

        sourcesApi.list(workspacePath).then((entries) => {
            if (!active) return;
            setSources(entries);

            const readyNames = entries
                .filter((entry) => entry.status === "ready")
                .map((entry) => entry.fileName);
            onSelectedSourceNamesChange((current) =>
                current.filter((fileName) => readyNames.includes(fileName)),
            );
        });

        return () => {
            active = false;
        };
    }, [workspacePath, sourcesRefreshKey, onSelectedSourceNamesChange]);

    useEffect(() => {
        const unsubscribe = chatApi.onStream((event) => {
            if (event.requestId !== activeRequestRef.current) return;

            const messageId = activeAssistantMessageRef.current;
            if (!messageId) return;

            if (event.type === "start") {
                setMessages((current) =>
                    current.map((message) =>
                        message.id === messageId
                            ? { ...message, citations: event.citations }
                            : message,
                    ),
                );
                return;
            }

            if (event.type === "delta") {
                setMessages((current) =>
                    current.map((message) =>
                        message.id === messageId
                            ? { ...message, content: message.content + event.text }
                            : message,
                    ),
                );
                return;
            }

            if (event.type === "done") {
                setMessages((current) =>
                    current.map((message) =>
                        message.id === messageId
                            ? {
                                  ...message,
                                  content: event.content,
                                  status: undefined,
                              }
                            : message,
                    ),
                );
                setStreaming(false);
                activeRequestRef.current = null;
                activeAssistantMessageRef.current = null;
                return;
            }

            setMessages((current) =>
                current.map((message) =>
                    message.id === messageId
                        ? {
                              ...message,
                              content: event.error,
                              status: "error",
                          }
                        : message,
                ),
            );
            setStreaming(false);
            activeRequestRef.current = null;
            activeAssistantMessageRef.current = null;
        });

        return () => {
            unsubscribe();
            const requestId = activeRequestRef.current;
            if (requestId) chatApi.cancel(requestId);
        };
    }, []);

    useEffect(() => {
        const list = messageListRef.current;
        if (list) list.scrollTop = list.scrollHeight;
    }, [messages]);

    const readySources = sources.filter((entry) => entry.status === "ready");
    const selectedSources = readySources.filter((entry) =>
        selectedSourceNames.includes(entry.fileName),
    );

    const toggleSource = (fileName: string) => {
        onSelectedSourceNamesChange((current) => {
            if (current.includes(fileName)) {
                return current.filter((selectedName) => selectedName !== fileName);
            }
            return [...current, fileName];
        });
    };

    const send = () => {
        const text = draft.trim();
        if (
            !text ||
            streaming ||
            (selectedSourceNames.length === 0 && contextTexts.length === 0)
        )
            return;

        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const assistantId = `${requestId}-assistant`;
        const history = messages.map((message) => ({
            role: message.role,
            content: message.content,
        }));

        activeRequestRef.current = requestId;
        activeAssistantMessageRef.current = assistantId;
        setMessages((current) => [
            ...current,
            {
                id: `${requestId}-user`,
                role: "user",
                content: text,
            },
            {
                id: assistantId,
                role: "assistant",
                content: "",
                status: "streaming",
            },
        ]);
        setDraft("");
        setStreaming(true);
        chatApi.ask({
            requestId,
            workspacePath,
            question: text,
            sourceFileNames: selectedSourceNames,
            contextTexts,
            history,
        });
    };

    const handleCancel = () => {
        const requestId = activeRequestRef.current;
        const messageId = activeAssistantMessageRef.current;
        if (!requestId) return;
        chatApi.cancel(requestId);
        activeRequestRef.current = null;
        activeAssistantMessageRef.current = null;
        setStreaming(false);
        if (messageId) {
            setMessages((current) =>
                current.map((message) =>
                    message.id === messageId && !message.content
                        ? { ...message, content: "Response cancelled." }
                        : message,
                ),
            );
        }
    };

    return (
        <aside className="flex h-full flex-col bg-surface-chat">
            <ChatHeader selectedSources={selectedSources} />
            <MessageList
                listRef={messageListRef}
                messages={messages}
                readySourceCount={readySources.length}
                selectedSourceCount={selectedSources.length}
                onOpenCitation={onOpenCitation}
                onStarterPrompt={setDraft}
            />
            <ChatComposer
                draft={draft}
                readySources={readySources}
                selectedSourceNames={selectedSourceNames}
                selectedSources={selectedSources}
                contextTexts={contextTexts}
                streaming={streaming}
                onCancel={handleCancel}
                onClearSources={() => onSelectedSourceNamesChange([])}
                onClearTextContexts={() => onContextTextsChange([])}
                onDraftChange={setDraft}
                onRemoveTextContext={(index) =>
                    onContextTextsChange((current) =>
                        current.filter((_excerpt, currentIndex) =>
                            currentIndex !== index,
                        ),
                    )
                }
                onSend={send}
                onToggleSource={toggleSource}
            />
        </aside>
    );
}

function ChatHeader({
    selectedSources,
}: {
    selectedSources: SourceEntry[];
}) {
    const selectedCount = selectedSources.length;

    return (
        <PanelTabBar
            className="bg-surface-chat-header"
            activeTabClassName="border-b-surface-chat bg-surface-chat"
            tabs={[{ id: "research-chat", title: "Research thread" }]}
            activeTabId="research-chat"
            actions={
                <span className="flex items-center gap-1.5 truncate rounded-full border border-border/70 bg-background/50 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                    <BookOpenCheck className="size-3 text-primary" />
                    {formatSourceCount(selectedCount)}
                </span>
            }
        />
    );
}

function MessageList({
    listRef,
    messages,
    readySourceCount,
    selectedSourceCount,
    onOpenCitation,
    onStarterPrompt,
}: {
    listRef: RefObject<HTMLDivElement>;
    messages: Message[];
    readySourceCount: number;
    selectedSourceCount: number;
    onOpenCitation: (citation: ChatCitation) => void;
    onStarterPrompt: (prompt: string) => void;
}) {
    return (
        <div
            ref={listRef}
            className="min-h-0 flex-1 overflow-y-auto bg-surface-chat px-5 py-7 sm:px-8"
        >
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
                {messages.length === 0 ? (
                    <EmptyChatState
                        readySourceCount={readySourceCount}
                        selectedSourceCount={selectedSourceCount}
                        onStarterPrompt={onStarterPrompt}
                    />
                ) : (
                    messages.map((message) => (
                        <MessageBubble
                            key={message.id}
                            message={message}
                            onOpenCitation={onOpenCitation}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function EmptyChatState({
    readySourceCount,
    selectedSourceCount,
    onStarterPrompt,
}: {
    readySourceCount: number;
    selectedSourceCount: number;
    onStarterPrompt: (prompt: string) => void;
}) {
    const canAsk = selectedSourceCount > 0;

    return (
        <div className="mx-auto max-w-xl py-12 sm:py-20">
            <div className="mx-auto flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
                <Sparkles className="size-5" />
            </div>
            <p className="mt-5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                Grounded in your library
            </p>
            <h3 className="font-display mt-2 text-center text-3xl font-medium leading-tight tracking-tight">
                What are you trying to understand?
            </h3>
            <p className="mx-auto mt-3 max-w-md text-center text-sm leading-6 text-muted-foreground">
                Ask across your sources, compare arguments, or follow a claim
                back to the page it came from.
            </p>
            <p className="mt-3 text-center text-xs text-muted-foreground">
                {formatEmptyContextMessage(readySourceCount, selectedSourceCount)}
            </p>
            <div className="mt-8 grid gap-2 sm:grid-cols-3">
                {[
                    "Summarize the main argument",
                    "Where do the sources disagree?",
                    "What evidence supports this?",
                ].map((prompt) => (
                    <button
                        key={prompt}
                        type="button"
                        className="group rounded-xl border border-border/70 bg-card/45 px-3 py-3 text-left text-xs leading-5 text-foreground/80 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card hover:text-foreground hover:shadow-md disabled:pointer-events-none disabled:opacity-45"
                        disabled={!canAsk}
                        onClick={() => onStarterPrompt(prompt)}
                    >
                        {prompt}
                        <ArrowUp className="mt-2 size-3.5 rotate-45 text-primary opacity-50 transition-opacity group-hover:opacity-100" />
                    </button>
                ))}
            </div>
        </div>
    );
}

function MessageBubble({
    message,
    onOpenCitation,
}: {
    message: Message;
    onOpenCitation: (citation: ChatCitation) => void;
}) {
    const isUser = message.role === "user";

    return (
        <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
            <div className={cn(isUser ? "max-w-[78%]" : "w-full")}>
                <div
                    className={cn(
                        "mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground",
                        isUser && "justify-end text-right",
                    )}
                >
                    {isUser ? (
                        <CircleUserRound className="size-3" />
                    ) : (
                        <Sparkles className="size-3 text-primary" />
                    )}
                    {isUser ? "You" : "Openbook"}
                </div>
                <div
                    className={cn(
                        "text-sm leading-6 transition-colors",
                        isUser
                            ? "rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-primary-foreground shadow-sm"
                            : "citation-thread pl-5 text-foreground",
                        message.status === "error" &&
                            "rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive",
                    )}
                >
                    {message.content ? (
                        <MarkdownMessage
                            content={message.content}
                            citations={message.citations ?? []}
                            user={isUser}
                            onOpenCitation={onOpenCitation}
                        />
                    ) : (
                        <span className="flex items-center gap-2 py-1 text-muted-foreground">
                            <LoaderCircle className="size-3.5 animate-spin text-primary" />
                            Tracing ideas across your sources...
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

function MarkdownMessage({
    content,
    citations,
    user,
    onOpenCitation,
}: {
    content: string;
    citations: ChatCitation[];
    user: boolean;
    onOpenCitation: (citation: ChatCitation) => void;
}) {
    return (
        <div className={cn("chat-markdown", user && "chat-markdown-user")}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a({ href, children, ...props }) {
                        const citation = getCitationFromHref(href, citations);

                        if (citation) {
                            return (
                                <CitationLink
                                    citation={citation}
                                    onOpenCitation={onOpenCitation}
                                >
                                    {children}
                                </CitationLink>
                            );
                        }

                        return (
                            <a href={href} {...props}>
                                {children}
                            </a>
                        );
                    },
                }}
            >
                {linkCitationMarkers(content, citations)}
            </ReactMarkdown>
        </div>
    );
}

function getCitationFromHref(
    href: string | undefined,
    citations: ChatCitation[],
): ChatCitation | null {
    if (!href?.startsWith(CITATION_LINK_PREFIX)) return null;

    const id = Number(href.slice(CITATION_LINK_PREFIX.length));
    return citations.find((item) => item.id === id) ?? null;
}

function CitationLink({
    citation,
    children,
    onOpenCitation,
}: {
    citation: ChatCitation;
    children: ReactNode;
    onOpenCitation: (citation: ChatCitation) => void;
}) {
    return (
        <button
            type="button"
            title={`${citation.fileName}, page ${citation.page}`}
            className="chat-citation-link"
            onClick={(event) => {
                event.preventDefault();
                onOpenCitation(citation);
            }}
        >
            {children}
        </button>
    );
}

function linkCitationMarkers(content: string, citations: ChatCitation[]): string {
    const citationIds = new Set(citations.map((citation) => citation.id));
    const lines = content.split("\n");
    let inFence = false;

    return lines
        .map((line) => {
            const fence = /^\s*(```+|~~~+)/.test(line);
            if (fence) {
                inFence = !inFence;
                return line;
            }

            if (inFence) return line;
            return linkInlineCitationMarkers(line, citationIds);
        })
        .join("\n");
}

function linkInlineCitationMarkers(line: string, citationIds: Set<number>): string {
    let output = "";
    let index = 0;

    while (index < line.length) {
        if (line[index] === "`") {
            const ticks = countBackticks(line, index);
            const marker = "`".repeat(ticks);
            const end = line.indexOf(marker, index + ticks);

            if (end === -1) {
                output += line.slice(index);
                break;
            }

            output += line.slice(index, end + ticks);
            index = end + ticks;
            continue;
        }

        const nextCode = line.indexOf("`", index);
        const end = nextCode === -1 ? line.length : nextCode;
        output += line
            .slice(index, end)
            .replace(/\[(\d+)\](?!\()/g, (marker, rawId: string) => {
                const id = Number(rawId);
                if (!citationIds.has(id)) return marker;
                return `[\\[${id}\\]](${CITATION_LINK_PREFIX}${id})`;
            });
        index = end;
    }

    return output;
}

function countBackticks(line: string, start: number): number {
    let count = 0;

    while (line[start + count] === "`") {
        count += 1;
    }

    return count;
}

function formatSourceCount(count: number): string {
    if (count === 0) return "No sources selected";
    if (count === 1) return "1 source selected";
    return `${count} sources selected`;
}

function formatEmptyContextMessage(
    readySourceCount: number,
    selectedSourceCount: number,
): string {
    if (readySourceCount === 0) return "Add a PDF source before starting.";
    if (selectedSourceCount === 0) {
        return "Select one or more ready sources below to start a grounded conversation.";
    }
    if (selectedSourceCount === 1) {
        return "1 source is selected. Ask a question to begin.";
    }
    return `${selectedSourceCount} sources are selected. Ask a question to begin.`;
}

function ChatComposer({
    draft,
    readySources,
    selectedSourceNames,
    selectedSources,
    contextTexts,
    streaming,
    onCancel,
    onClearSources,
    onClearTextContexts,
    onDraftChange,
    onRemoveTextContext,
    onSend,
    onToggleSource,
}: {
    draft: string;
    readySources: SourceEntry[];
    selectedSourceNames: string[];
    selectedSources: SourceEntry[];
    contextTexts: TextExcerpt[];
    streaming: boolean;
    onCancel: () => void;
    onClearSources: () => void;
    onClearTextContexts: () => void;
    onDraftChange: (draft: string) => void;
    onRemoveTextContext: (index: number) => void;
    onSend: () => void;
    onToggleSource: (fileName: string) => void;
}) {
    const hasContext = selectedSources.length > 0 || contextTexts.length > 0;
    const canSend =
        Boolean(draft.trim()) &&
        (selectedSourceNames.length > 0 || contextTexts.length > 0);
    const contextWidgets: MarkdownEditorWidget[] = [
        ...selectedSources.map((source) => ({
            id: `source-${source.fileName}`,
            label: source.fileName,
            title: source.fileName,
            kind: "source" as const,
            onRemove: () => onToggleSource(source.fileName),
        })),
        ...contextTexts.map((excerpt, index) => ({
            id: `excerpt-${excerpt.filePath}-${excerpt.page}-${index}`,
            label: `Excerpt: ${fileBaseName(excerpt.filePath)} p.${excerpt.page}`,
            title: excerpt.text,
            kind: "excerpt" as const,
            onRemove: () => onRemoveTextContext(index),
        })),
    ];

    return (
        <div className="border-t border-border/70 bg-surface-composer px-4 py-3.5">
            <div className="mx-auto max-w-3xl rounded-2xl border border-border/80 bg-background/75 px-3.5 py-2.5 shadow-[0_8px_30px_rgb(0_0_0/0.08)] transition-all focus-within:border-primary/50 focus-within:bg-background focus-within:shadow-[0_10px_36px_rgb(0_0_0/0.11)] focus-within:ring-2 focus-within:ring-primary/10">
                <ComposerMarkdownEditor
                    value={draft}
                    contextWidgets={contextWidgets}
                    onChange={onDraftChange}
                    onSend={onSend}
                    disabled={streaming}
                />
                <div className="mt-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                        <SourceSelector
                            readySources={readySources}
                            selectedSourceNames={selectedSourceNames}
                            onToggleSource={onToggleSource}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="mb-0.5 size-8 rounded-lg text-muted-foreground"
                            aria-label="Clear context"
                            title="Clear all context"
                            onClick={() => {
                                onClearSources();
                                onClearTextContexts();
                            }}
                            disabled={!hasContext}
                        >
                            <X className="size-3.5" />
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="hidden text-[10px] text-muted-foreground/70 sm:inline">
                            {hasContext ? "⌘↵ to send" : "Add a source to begin"}
                        </span>
                        <Button
                        size="icon"
                        aria-label={streaming ? "Stop response" : "Send message"}
                        onClick={streaming ? onCancel : onSend}
                        disabled={!streaming && !canSend}
                        className="mb-0.5 size-8 rounded-xl shadow-sm"
                    >
                        {streaming ? (
                            <Square className="size-4" />
                        ) : (
                            <ArrowUp className="size-4" />
                        )}
                    </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ComposerMarkdownEditor({
    value,
    contextWidgets,
    onChange,
    onSend,
    disabled,
}: {
    value: string;
    contextWidgets?: MarkdownEditorWidget[];
    onChange: (value: string) => void;
    onSend: () => void;
    disabled: boolean;
}) {
    return (
        <MarkdownEditor
            value={value}
            onChange={onChange}
            onModEnter={onSend}
            placeholder="Ask a question, compare ideas, or trace a claim..."
            readOnly={disabled}
            topWidgets={contextWidgets}
            className="chat-markdown-editor"
        />
    );
}

function SourceSelector({
    readySources,
    selectedSourceNames,
    onToggleSource,
}: {
    readySources: SourceEntry[];
    selectedSourceNames: string[];
    onToggleSource: (fileName: string) => void;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 rounded-lg border-border/70 bg-background/40 px-2 text-xs text-muted-foreground shadow-none hover:text-foreground"
                    aria-label="Select sources"
                >
                    <Paperclip className="size-3.5" />
                    <span>Sources</span>
                    {selectedSourceNames.length > 0 ? (
                        <span className="flex size-4 items-center justify-center rounded-full bg-primary/12 text-[9px] font-semibold text-primary">
                            {selectedSourceNames.length}
                        </span>
                    ) : null}
                    <ChevronDown className="size-3" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Sources</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {readySources.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No ready sources. Add a PDF first.
                    </div>
                ) : (
                    readySources.map((source) => (
                        <DropdownMenuCheckboxItem
                            key={source.fileName}
                            checked={selectedSourceNames.includes(source.fileName)}
                            onCheckedChange={() => onToggleSource(source.fileName)}
                            onSelect={(event) => event.preventDefault()}
                        >
                            <span className="truncate">{source.fileName}</span>
                        </DropdownMenuCheckboxItem>
                    ))
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function fileBaseName(filePath: string): string {
    return filePath.split(/[/\\]/).pop() ?? filePath;
}
