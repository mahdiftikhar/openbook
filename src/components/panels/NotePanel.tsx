import { useState } from "react";
import { Plus, X, Paperclip, Sparkles, FileText, Bot } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// TODO: Actual note taking panel will be replaces by some existing library that will
// provide that **rich text** editor.  This will probably be need to be something that
// allows the AI agent to directly make changes
//
// https://lexical.dev/ looks promising for this purpose
//    - light-weight
//    - AI friendly
//    - Notion style note taking (familiar for a lot of users)
//
//
// (The following messsage is a reminder to Mahd (by Mahd))
//    Switching pre-built rich text editor probably comes much later. Maybe we don't
//    even stick to using javascript by that time. Keep simple text inputs for the
//    early stages of the application

interface NoteData {
  content: string;
  author: "human" | "ai";
}

interface AiBlock {
  label: string;
  content: string;
}

interface SourceEntry {
  title: string;
  path: string;
}

const AI_SUMMARY: AiBlock = {
  label: "AI Summary",
  content: `The paper proposes a causal-inference framework for observational data. Three confounder assumptions are compared; the baseline is outperformed on synthetic benchmarks but degrades with sparse covariates. Section 4 discusses MAR sensitivity, which maps onto your open question about missing values.`,
};

const NOTE_DATA: Record<string, NoteData> = {
  notes: {
    author: "human",
    content: `# Meeting Notes — 2024

Key takeaways from the literature review discussion:

- The hypothesis around causal inference still needs stronger evidence.
- Cross-reference the Smith et al. paper (in Sources) for methodology.
- Draft the outline before Friday.

Open questions:
1. How does the dataset handle missing values?
2. What replication strategy makes sense here?`,
  },
  scratch: {
    author: "ai",
    content: `## Generated ideas

- Rank sources by relevance score using cosine similarity on embeddings
- Tag passages that mention null results for quick retrieval
- Consider adding a "counterfactual" entry to the glossary

Next: re-read the Apr interview transcript for edge cases.`,
  },
};

const SOURCE_DATA: SourceEntry[] = [
  {
    title: 'Smith et al. — "A Causal Approach to..."',
    path: "Sources / research-paper.pdf",
  },
  {
    title: "田野 (2023) — Field notes, unrevised",
    path: "Sources / field-notes.md",
  },
  {
    title: "Longitudinal stability review",
    path: "Sources / article.md",
  },
  {
    title: "Apr interview transcript",
    path: "Sources / transcript.txt",
  },
  {
    title: "Glossary: counterfactual entry",
    path: "References / glossary.md",
  },
];

type NoteTab = "notes" | "sources" | "scratch";

const TAB_LABELS: { key: NoteTab; label: string }[] = [
  { key: "notes", label: "Notes" },
  { key: "sources", label: "Sources" },
  { key: "scratch", label: "Scratch" },
];

export function NotePanel() {
  const [open, setOpen] = useState<NoteTab[]>(["notes", "sources", "scratch"]);
  const [active, setActive] = useState<NoteTab>("notes");

  const closeTab = (key: NoteTab) => {
    setOpen((prev) => {
      const next = prev.filter((t) => t !== key);
      if (next.length === 0) return prev;
      if (active === key) setActive(next[0]);
      return next;
    });
  };

  const openTab = (key: NoteTab) => {
    setOpen((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setActive(key);
  };

  const activeMeta = NOTE_DATA[active];

  return (
    <section className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <span className="text-sm font-medium">meeting-2024.md</span>
            <span className="text-xs text-muted-foreground">
              Notes / research-project
            </span>
          </div>
          {activeMeta && activeMeta.author === "ai" && (
            <span className="flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400">
              <Bot className="size-3" />
              AI
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Attach source">
            <Paperclip className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Ask assistant">
            <Sparkles className="size-4" />
          </Button>
        </div>
      </div>

      <Tabs
        value={active}
        onValueChange={(v) => setActive(v as NoteTab)}
        className="flex flex-1 flex-col gap-0"
      >
        <div className="flex items-center gap-1 border-b bg-muted/30 px-2">
          <TabsList className="h-auto bg-transparent p-0">
            {open.map((key) => {
              const label = TAB_LABELS.find((t) => t.key === key)?.label ?? key;
              return (
                <TabsTrigger
                  key={key}
                  value={key}
                  className={cn(
                    "group gap-1.5 rounded-b-none border-b-2 border-transparent bg-transparent shadow-none",
                    "data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:shadow-none",
                  )}
                >
                  {label}
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      closeTab(key);
                    }}
                    className="rounded p-0.5 opacity-0 hover:bg-accent group-hover:opacity-100"
                  >
                    <X className="size-3" />
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="New tab"
            onClick={() => openTab("scratch")}
          >
            <Plus className="size-4" />
          </Button>
        </div>

        <TabsContent
          value="notes"
          className="flex flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <div className="shrink-0">
            <div className="mx-3 mt-3 flex gap-3 rounded-lg border border-violet-500/20 bg-violet-500/[0.04] p-3">
              <div className="w-0.5 self-stretch rounded-full bg-violet-500/40" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-1.5">
                  <Bot className="size-3.5 text-violet-400" />
                  <span className="text-xs font-medium text-violet-400">
                    {AI_SUMMARY.label}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                  {AI_SUMMARY.content}
                </p>
              </div>
            </div>
            <div className="mx-4 my-3 border-t" />
          </div>
          <textarea
            defaultValue={NOTE_DATA.notes.content}
            className="min-h-0 flex-1 resize-none bg-transparent px-4 pb-4 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
            placeholder="Start writing..."
          />
        </TabsContent>

        <TabsContent
          value="scratch"
          className="flex flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <textarea
            defaultValue={NOTE_DATA.scratch.content}
            className={cn(
              "min-h-0 flex-1 resize-none p-4 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground",
              NOTE_DATA.scratch.author === "ai"
                ? "border-l-2 border-violet-500/40 bg-violet-500/[0.03]"
                : "bg-transparent",
            )}
            placeholder="Start writing..."
          />
        </TabsContent>

        <TabsContent
          value="sources"
          className="flex flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <div className="flex-1 overflow-y-auto p-3">
            <p className="mb-3 text-xs text-muted-foreground">
              {SOURCE_DATA.length} references attached to this note
            </p>
            <div className="flex flex-col gap-1.5">
              {SOURCE_DATA.map((source) => (
                <div
                  key={source.path}
                  className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm transition-colors hover:bg-accent/50"
                >
                  <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <span className="block font-medium truncate">
                      {source.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {source.path}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
