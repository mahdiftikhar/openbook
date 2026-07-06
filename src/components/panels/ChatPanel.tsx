import {
    useEffect,
    useRef,
    useState,
    type ReactNode,
    type RefObject,
} from "react";
import {
    BookOpen,
    ChevronDown,
    Paperclip,
    Send,
    Sparkles,
    Square,
    X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Message = {
    id: string;
    role: "user" | "assistant";
    content: string;
    citations?: ChatCitation[];
    status?: "streaming" | "error";
};

export function ChatPanel({
    workspacePath,
    sourcesRefreshKey,
    onOpenCitation,
}: {
    workspacePath: string;
    sourcesRefreshKey: number;
    onOpenCitation: (citation: ChatCitation) => void;
}) {
    const [sources, setSources] = useState<SourceEntry[]>([]);
    const [selectedSourceNames, setSelectedSourceNames] = useState<string[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [draft, setDraft] = useState("");
    const [streaming, setStreaming] = useState(false);
    const activeRequestRef = useRef<string | null>(null);
    const activeAssistantMessageRef = useRef<string | null>(null);
    const messageListRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        let active = true;

        window.electron.sources.list(workspacePath).then((entries) => {
            if (!active) return;
            setSources(entries);

            const readyNames = entries
                .filter((entry) => entry.status === "ready")
                .map((entry) => entry.fileName);
            setSelectedSourceNames((current) =>
                current.filter((fileName) => readyNames.includes(fileName)),
            );
        });

        return () => {
            active = false;
        };
    }, [workspacePath, sourcesRefreshKey]);

    useEffect(() => {
        const unsubscribe = window.electron.chat.onStream((event) => {
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
            if (requestId) window.electron.chat.cancel(requestId);
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
        setSelectedSourceNames((current) => {
            if (current.includes(fileName)) {
                return current.filter((selectedName) => selectedName !== fileName);
            }
            return [...current, fileName];
        });
    };

    const send = () => {
        const text = draft.trim();
        if (!text || streaming || selectedSourceNames.length === 0) return;

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
        window.electron.chat.ask({
            requestId,
            workspacePath,
            question: text,
            sourceFileNames: selectedSourceNames,
            history,
        });
    };

    const handleCancel = () => {
        const requestId = activeRequestRef.current;
        const messageId = activeAssistantMessageRef.current;
        if (!requestId) return;
        window.electron.chat.cancel(requestId);
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
        <aside className="flex h-full flex-col bg-background">
            <ChatHeader
                readySources={readySources}
                selectedSources={selectedSources}
            />
            <MessageList
                listRef={messageListRef}
                messages={messages}
                readySourceCount={readySources.length}
                selectedSourceCount={selectedSources.length}
                onOpenCitation={onOpenCitation}
            />
            <ChatComposer
                draft={draft}
                readySources={readySources}
                selectedSourceNames={selectedSourceNames}
                selectedSources={selectedSources}
                streaming={streaming}
                onCancel={handleCancel}
                onClearSources={() => setSelectedSourceNames([])}
                onDraftChange={setDraft}
                onSend={send}
                onToggleSource={toggleSource}
            />
        </aside>
    );
}

function ChatHeader({
    readySources,
    selectedSources,
}: {
    readySources: SourceEntry[];
    selectedSources: SourceEntry[];
}) {
    const selectedCount = selectedSources.length;

    return (
        <div className="border-b bg-card/40 px-4 py-3">
            <div className="flex items-start gap-3">
                <div className="rounded-xl border bg-background p-2 text-primary shadow-sm">
                    <Sparkles className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold tracking-tight">
                            Research Chat
                        </h2>
                        <span className="rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {formatSourceCount(selectedCount)}
                        </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                        Question, compare, and trace answers back to your sources.
                    </p>
                </div>
            </div>
            <SourceContextStrip
                readySources={readySources}
                selectedSources={selectedSources}
            />
        </div>
    );
}

function SourceContextStrip({
    readySources,
    selectedSources,
}: {
    readySources: SourceEntry[];
    selectedSources: SourceEntry[];
}) {
    if (selectedSources.length === 0) {
        return (
            <div className="mt-3 rounded-xl border border-dashed bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                {readySources.length === 0
                    ? "Add a ready PDF source to ground the conversation."
                    : "Choose sources below to ground the conversation."}
            </div>
        );
    }

    const visibleSources = selectedSources.slice(0, 4);
    const extraCount = selectedSources.length - visibleSources.length;

    return (
        <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Context
            </span>
            {visibleSources.map((source) => (
                <div
                    key={source.fileName}
                    className="min-w-0 max-w-48 rounded-full border bg-background px-2.5 py-1 text-xs shadow-sm"
                    title={source.fileName}
                >
                    <span className="block truncate font-medium">
                        {source.fileName}
                    </span>
                </div>
            ))}
            {extraCount > 0 && (
                <span className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                    +{extraCount} more
                </span>
            )}
        </div>
    );
}

function MessageList({
    listRef,
    messages,
    readySourceCount,
    selectedSourceCount,
    onOpenCitation,
}: {
    listRef: RefObject<HTMLDivElement>;
    messages: Message[];
    readySourceCount: number;
    selectedSourceCount: number;
    onOpenCitation: (citation: ChatCitation) => void;
}) {
    return (
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            <div className="mx-auto flex max-w-4xl flex-col gap-4">
                {messages.length === 0 ? (
                    <EmptyChatState
                        readySourceCount={readySourceCount}
                        selectedSourceCount={selectedSourceCount}
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
}: {
    readySourceCount: number;
    selectedSourceCount: number;
}) {
    const prompts = [
        "Summarize the selected sources into working notes.",
        "Compare the strongest claims across these sources.",
        "Find evidence I should cite before writing.",
        "Explain the section that matters most here.",
    ];

    return (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <BookOpen className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold tracking-tight">
                        Start with a research question
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Chat is part of the workspace. Use it to read across PDFs,
                        test ideas, and keep every answer tied to a source.
                    </p>
                </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {prompts.map((prompt) => (
                    <div
                        key={prompt}
                        className="rounded-xl border bg-background/70 px-3 py-2 text-sm leading-5 text-foreground"
                    >
                        {prompt}
                    </div>
                ))}
            </div>
            <p className="mt-4 rounded-xl border border-dashed bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                {formatEmptyContextMessage(readySourceCount, selectedSourceCount)}
            </p>
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
                        "mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground",
                        isUser && "text-right",
                    )}
                >
                    {isUser ? "You" : "Answer"}
                </div>
                <div
                    className={cn(
                        "whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
                        isUser
                            ? "rounded-tr-sm bg-primary text-primary-foreground"
                            : "rounded-tl-sm border bg-card text-foreground",
                        message.status === "error" &&
                            "border-destructive/30 bg-destructive/10 text-destructive",
                    )}
                >
                    {message.content ? (
                        <CitationText
                            content={message.content}
                            citations={message.citations ?? []}
                            onOpenCitation={onOpenCitation}
                        />
                    ) : (
                        <span className="text-muted-foreground">
                            Reading selected sources...
                        </span>
                    )}
                </div>
                {!isUser && message.citations && message.citations.length > 0 && (
                    <CitationCards
                        citations={message.citations}
                        onOpenCitation={onOpenCitation}
                    />
                )}
            </div>
        </div>
    );
}

function CitationCards({
    citations,
    onOpenCitation,
}: {
    citations: ChatCitation[];
    onOpenCitation: (citation: ChatCitation) => void;
}) {
    const visibleCitations = citations.slice(0, 4);
    const extraCount = citations.length - visibleCitations.length;

    return (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {visibleCitations.map((citation) => (
                <button
                    key={`${citation.fileName}-${citation.page}-${citation.id}`}
                    type="button"
                    className="min-w-0 rounded-xl border bg-background/70 px-3 py-2 text-left text-xs shadow-sm transition hover:border-primary/40 hover:bg-primary/5"
                    onClick={() => onOpenCitation(citation)}
                >
                    <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                            {citation.fileName}
                        </span>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            p. {citation.page}
                        </span>
                    </span>
                    <span className="mt-1 block max-h-10 overflow-hidden leading-5 text-muted-foreground">
                        {citation.excerpt}
                    </span>
                </button>
            ))}
            {extraCount > 0 && (
                <div className="rounded-xl border border-dashed bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                    +{extraCount} more sources used in this answer
                </div>
            )}
        </div>
    );
}

function CitationText({
    content,
    citations,
    onOpenCitation,
}: {
    content: string;
    citations: ChatCitation[];
    onOpenCitation: (citation: ChatCitation) => void;
}) {
    const parts: ReactNode[] = [];
    const citationPattern = /\[(\d+)\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null = citationPattern.exec(content);

    while (match) {
        const marker = match[0];
        const id = Number(match[1]);
        const citation = citations.find((item) => item.id === id);

        if (match.index > lastIndex) {
            parts.push(content.slice(lastIndex, match.index));
        }

        if (citation) {
            parts.push(
                <button
                    key={`${match.index}-${marker}`}
                    type="button"
                    title={`${citation.fileName}, page ${citation.page}`}
                    className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-1.5 align-baseline text-[11px] font-semibold text-primary hover:border-primary/40 hover:bg-primary/20"
                    onClick={() => onOpenCitation(citation)}
                >
                    {marker}
                </button>,
            );
        } else {
            parts.push(marker);
        }

        lastIndex = match.index + marker.length;
        match = citationPattern.exec(content);
    }

    if (lastIndex < content.length) {
        parts.push(content.slice(lastIndex));
    }

    return <>{parts}</>;
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
    streaming,
    onCancel,
    onClearSources,
    onDraftChange,
    onSend,
    onToggleSource,
}: {
    draft: string;
    readySources: SourceEntry[];
    selectedSourceNames: string[];
    selectedSources: SourceEntry[];
    streaming: boolean;
    onCancel: () => void;
    onClearSources: () => void;
    onDraftChange: (draft: string) => void;
    onSend: () => void;
    onToggleSource: (fileName: string) => void;
}) {
    const canSend = Boolean(draft.trim()) && selectedSourceNames.length > 0;

    return (
        <div className="border-t px-3 py-2.5">
            <ContextBar
                readySources={readySources}
                selectedSourceNames={selectedSourceNames}
                selectedSources={selectedSources}
                onClearSources={onClearSources}
                onToggleSource={onToggleSource}
            />
            <div className="flex items-center gap-2">
                <Input
                    value={draft}
                    onChange={(e) => onDraftChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            onSend();
                        }
                    }}
                    placeholder="Ask about your sources..."
                    className="h-9"
                    disabled={streaming}
                />
                <Button
                    size="icon"
                    aria-label={streaming ? "Stop response" : "Send message"}
                    onClick={streaming ? onCancel : onSend}
                    disabled={!streaming && !canSend}
                >
                    {streaming ? (
                        <Square className="size-4" />
                    ) : (
                        <Send className="size-4" />
                    )}
                </Button>
            </div>
        </div>
    );
}

function ContextBar({
    readySources,
    selectedSourceNames,
    selectedSources,
    onClearSources,
    onToggleSource,
}: {
    readySources: SourceEntry[];
    selectedSourceNames: string[];
    selectedSources: SourceEntry[];
    onClearSources: () => void;
    onToggleSource: (fileName: string) => void;
}) {
    return (
        <div className="mb-2 flex items-center gap-1">
            <SourceSelector
                readySources={readySources}
                selectedSourceNames={selectedSourceNames}
                onToggleSource={onToggleSource}
            />
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {formatSelectedSources(selectedSources)}
            </span>
            <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Clear context"
                onClick={onClearSources}
                disabled={selectedSourceNames.length === 0}
            >
                <X className="size-3.5" />
            </Button>
        </div>
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
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    aria-label="Select sources"
                >
                    <Paperclip className="size-3.5" />
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

function formatSelectedSources(selectedSources: SourceEntry[]): string {
    if (selectedSources.length === 0) return "No sources selected";
    if (selectedSources.length === 1) return `Context: ${selectedSources[0].fileName}`;

    const firstTwo = selectedSources.slice(0, 2).map((source) => source.fileName);
    const extraCount = selectedSources.length - firstTwo.length;
    return `Context: ${firstTwo.join(", ")}${extraCount > 0 ? ` +${extraCount}` : ""}`;
}
