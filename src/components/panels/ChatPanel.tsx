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
            <ChatHeader selectedCount={selectedSources.length} />
            <MessageList
                listRef={messageListRef}
                messages={messages}
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

function ChatHeader({ selectedCount }: { selectedCount: number }) {
    return (
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
            <Sparkles className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Assistant</span>
            <span className="ml-auto text-xs text-muted-foreground">
                {selectedCount === 1
                    ? "1 source selected"
                    : `${selectedCount} sources selected`}
            </span>
        </div>
    );
}

function MessageList({
    listRef,
    messages,
    onOpenCitation,
}: {
    listRef: RefObject<HTMLDivElement>;
    messages: Message[];
    onOpenCitation: (citation: ChatCitation) => void;
}) {
    return (
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            <div className="mx-auto flex max-w-sm flex-col gap-3">
                {messages.length === 0 ? (
                    <EmptyChatState />
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

function EmptyChatState() {
    return (
        <div className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            <BookOpen className="mx-auto mb-2 size-5 opacity-50" />
            Select sources, then ask a question about them.
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
            <div
                className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                    isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    message.status === "error" && "text-destructive",
                )}
            >
                {message.content ? (
                    <CitationText
                        content={message.content}
                        citations={message.citations ?? []}
                        onOpenCitation={onOpenCitation}
                    />
                ) : (
                    <span className="text-muted-foreground">Thinking...</span>
                )}
            </div>
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
                    className="mx-0.5 rounded bg-primary/10 px-1 text-xs font-medium text-primary hover:bg-primary/20"
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
