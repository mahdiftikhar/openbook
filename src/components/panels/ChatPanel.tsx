import { useState } from "react";
import { Send, Sparkles, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
};

// TODO: Temporary data -- to be removed later
const HISTORY: Message[] = [
  {
    id: 1,
    role: "user",
    content: "Summarize the Smith et al. paper in three bullet points.",
  },
  {
    id: 2,
    role: "assistant",
    content:
      "- Proposes a causal-inference framework for observational data.\n- Compares identifiability under three confounder assumptions.\n- Outperforms the baseline on the synthetic benchmark but degrades with sparse covariates.",
  },
  {
    id: 3,
    role: "user",
    content: "Which section should I cross-reference in my notes?",
  },
  {
    id: 4,
    role: "assistant",
    content:
      'Section 4 (Methodology) maps closely onto your "Open questions" item 1 about missing values — they discuss MAR sensitivity there.',
  },
];

// TODO: This interface is entirely static right now. The chat interface will need to
// be updated to include a bunch of features:
//  - maintaining long chat histories
//  - Chat timelines?
//  - live conversation
//  - old chats saved
export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>(HISTORY);
  const [draft, setDraft] = useState("");

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const next: Message = {
      id: messages.length + 1,
      role: "user",
      content: text,
    };
    setMessages([...messages, next]);
    setDraft("");
  };

  return (
    <aside className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <Sparkles className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Assistant</span>
        <span className="ml-auto text-xs text-muted-foreground">
          research-paper.pdf active
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto flex max-w-sm flex-col gap-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                "flex " + (m.role === "user" ? "justify-end" : "justify-start")
              }
            >
              <div
                className={
                  "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm " +
                  (m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground")
                }
              >
                {m.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t px-3 py-2.5">
        <div className="mb-2 flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Attach source"
          >
            <Paperclip className="size-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Context: research-paper.pdf
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-7"
            aria-label="Clear context"
          >
            <X className="size-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask about your sources..."
            className="h-9"
          />
          <Button
            size="icon"
            aria-label="Send message"
            onClick={send}
            disabled={!draft.trim()}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
