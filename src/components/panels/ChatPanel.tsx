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
    BookOpen,
    ChevronDown,
    Paperclip,
    Send,
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

        window.electron.sources.list(workspacePath).then((entries) => {
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
        window.electron.chat.ask({
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
        <aside className="flex h-full flex-col bg-surface-chat">
            <ChatHeader selectedSources={selectedSources} />
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
            tabs={[{ id: "research-chat", title: "Research Chat" }]}
            activeTabId="research-chat"
            actions={
                <span className="truncate text-xs text-muted-foreground">
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
}: {
    listRef: RefObject<HTMLDivElement>;
    messages: Message[];
    readySourceCount: number;
    selectedSourceCount: number;
    onOpenCitation: (citation: ChatCitation) => void;
}) {
    return (
        <div
            ref={listRef}
            className="min-h-0 flex-1 overflow-y-auto bg-surface-chat px-6 py-6"
        >
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
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
    return (
        <div className="mx-auto max-w-lg py-16 text-center">
            <BookOpen className="mx-auto size-6 text-muted-foreground/70" />
            <h3 className="mt-4 text-base font-semibold tracking-tight">
                Start with a research question
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Ask, compare, summarize, or trace an answer back to the selected
                sources.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
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
                        "text-sm leading-6",
                        isUser
                            ? "rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-primary-foreground"
                            : "text-foreground",
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
                        <span className="text-muted-foreground">
                            Reading selected sources...
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
        <div className="border-t bg-surface-composer px-3 py-3">
            <div className="rounded-2xl border border-border bg-background/70 px-3 py-2 shadow-xs focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
                <ComposerMarkdownEditor
                    value={draft}
                    contextWidgets={contextWidgets}
                    onChange={onDraftChange}
                    onSend={onSend}
                    disabled={streaming}
                />
                <div className="mt-1 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                        <SourceSelector
                            readySources={readySources}
                            selectedSourceNames={selectedSourceNames}
                            onToggleSource={onToggleSource}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="mb-0.5 size-8"
                            aria-label="Clear context"
                            onClick={() => {
                                onClearSources();
                                onClearTextContexts();
                            }}
                            disabled={!hasContext}
                        >
                            <X className="size-3.5" />
                        </Button>
                    </div>
                    <Button
                        size="icon"
                        aria-label={streaming ? "Stop response" : "Send message"}
                        onClick={streaming ? onCancel : onSend}
                        disabled={!streaming && !canSend}
                        className="mb-0.5 size-8"
                    >
                        {streaming ? (
                            <Square className="size-4" />
                        ) : (
                            <Send className="size-4" />
                        )}
                    </Button>
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
            placeholder="Ask about your sources..."
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

function fileBaseName(filePath: string): string {
    return filePath.split(/[/\\]/).pop() ?? filePath;
}
