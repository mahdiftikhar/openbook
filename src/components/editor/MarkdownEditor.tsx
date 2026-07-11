import { markdown } from "@codemirror/lang-markdown";
import {
    defaultKeymap,
    history,
    historyKeymap,
    indentWithTab,
} from "@codemirror/commands";
import {
    bracketMatching,
    HighlightStyle,
    indentOnInput,
    syntaxHighlighting,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
import {
    Compartment,
    EditorState,
    Prec,
    RangeSetBuilder,
    type Extension,
} from "@codemirror/state";
import {
    Decoration,
    type DecorationSet,
    drawSelection,
    dropCursor,
    EditorView,
    keymap,
    placeholder as editorPlaceholder,
    ViewPlugin,
    WidgetType,
    type ViewUpdate,
} from "@codemirror/view";
import { useEffect, useRef } from "react";

function buildHeadingDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();

    for (const range of view.visibleRanges) {
        for (let pos = range.from; pos <= range.to;) {
            const line = view.state.doc.lineAt(pos);
            const match = /^(#{1,6})(?:\s|$)/.exec(line.text);

            if (match) {
                builder.add(
                    line.from,
                    line.from,
                    Decoration.line({
                        class: `cm-md-heading cm-md-heading-${match[1].length}`,
                    }),
                );
            }

            pos = line.to + 1;
        }
    }

    return builder.finish();
}

const headingLineDecorations = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = buildHeadingDecorations(view);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged) {
                this.decorations = buildHeadingDecorations(update.view);
            }
        }
    },
    {
        decorations: (plugin) => plugin.decorations,
    },
);

const markdownHighlightStyle = HighlightStyle.define([
    { tag: tags.heading, color: "var(--foreground)", fontWeight: "700" },
    { tag: tags.heading1, color: "var(--foreground)", fontWeight: "700" },
    { tag: tags.heading2, color: "var(--foreground)", fontWeight: "700" },
    { tag: tags.heading3, color: "var(--foreground)", fontWeight: "700" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.strong, fontWeight: "700" },
    { tag: tags.monospace, color: "var(--primary)" },
    { tag: tags.link, color: "var(--primary)", textDecoration: "underline" },
    { tag: tags.url, color: "var(--primary)" },
    { tag: tags.quote, color: "var(--muted-foreground)" },
    { tag: tags.list, color: "var(--primary)" },
    { tag: tags.contentSeparator, color: "var(--muted-foreground)" },
    { tag: tags.processingInstruction, color: "var(--muted-foreground)" },
    { tag: tags.meta, color: "var(--muted-foreground)" },
]);

export interface MarkdownEditorWidget {
    id: string;
    label: string;
    title?: string;
    kind?: "source" | "excerpt";
    onRemove: () => void;
}

class ContextWidget extends WidgetType {
    constructor(private readonly widgets: MarkdownEditorWidget[]) {
        super();
    }

    toDOM(): HTMLElement {
        const wrapper = document.createElement("div");
        wrapper.className = "cm-context-widget";

        for (const widget of this.widgets) {
            const chip = document.createElement("span");
            chip.className = [
                "cm-context-chip",
                widget.kind ? `cm-context-chip-${widget.kind}` : "",
            ]
                .filter(Boolean)
                .join(" ");
            if (widget.title) chip.title = widget.title;

            const label = document.createElement("span");
            label.className = "cm-context-chip-label";
            label.textContent = widget.label;
            chip.appendChild(label);

            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "cm-context-chip-remove";
            remove.setAttribute("aria-label", `Remove ${widget.label}`);
            remove.textContent = "x";
            remove.addEventListener("mousedown", (event) => {
                event.preventDefault();
                event.stopPropagation();
            });
            remove.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                widget.onRemove();
            });
            chip.appendChild(remove);

            wrapper.appendChild(chip);
        }

        return wrapper;
    }
}

function contextWidgetExtension(widgets: MarkdownEditorWidget[]): Extension {
    if (widgets.length === 0) return [];

    return EditorView.decorations.of(
        Decoration.set([
            Decoration.widget({
                widget: new ContextWidget(widgets),
                block: true,
                side: -1,
            }).range(0),
        ]),
    );
}

const editorExtensions: Extension[] = [
    history(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    bracketMatching(),
    markdown(),
    headingLineDecorations,
    syntaxHighlighting(markdownHighlightStyle),
    EditorView.lineWrapping,
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
];

export function MarkdownEditor({
    value,
    onChange,
    onBlur,
    onModEnter,
    placeholder,
    readOnly = false,
    topWidgets = [],
    className,
}: {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    onModEnter?: () => void;
    placeholder?: string;
    readOnly?: boolean;
    topWidgets?: MarkdownEditorWidget[];
    className?: string;
}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const readOnlyCompartmentRef = useRef(new Compartment());
    const topWidgetsCompartmentRef = useRef(new Compartment());
    const onChangeRef = useRef(onChange);
    const onBlurRef = useRef(onBlur);
    const onModEnterRef = useRef(onModEnter);

    // Keep the CodeMirror update listener calling the latest change handler.
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    // Keep the CodeMirror blur handler calling the latest blur handler.
    useEffect(() => {
        onBlurRef.current = onBlur;
    }, [onBlur]);

    // Keep the CodeMirror key handler calling the latest submit handler.
    useEffect(() => {
        onModEnterRef.current = onModEnter;
    }, [onModEnter]);

    // Create the CodeMirror editor once when the host element is mounted.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const state = EditorState.create({
            doc: value,
            extensions: [
                ...editorExtensions,
                editorPlaceholder(placeholder ?? ""),
                readOnlyCompartmentRef.current.of([
                    EditorState.readOnly.of(readOnly),
                    EditorView.editable.of(!readOnly),
                ]),
                topWidgetsCompartmentRef.current.of(
                    contextWidgetExtension(topWidgets),
                ),
                Prec.highest(
                    keymap.of([
                        {
                            key: "Mod-Enter",
                            run: () => {
                                if (!onModEnterRef.current) return false;
                                onModEnterRef.current();
                                return true;
                            },
                        },
                    ]),
                ),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        onChangeRef.current(update.state.doc.toString());
                    }
                }),
                EditorView.domEventHandlers({
                    keydown: (event) => {
                        if (
                            onModEnterRef.current &&
                            event.key === "Enter" &&
                            (event.metaKey || event.ctrlKey)
                        ) {
                            event.preventDefault();
                            event.stopPropagation();
                            onModEnterRef.current();
                            return true;
                        }
                        return false;
                    },
                    blur: () => {
                        onBlurRef.current?.();
                    },
                }),
            ],
        });

        const view = new EditorView({ state, parent: container });
        viewRef.current = view;

        return () => {
            view.destroy();
            viewRef.current = null;
        };
    }, []);

    // Sync external value changes into the CodeMirror document.
    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;

        const currentValue = view.state.doc.toString();
        if (currentValue === value) return;

        view.dispatch({
            changes: {
                from: 0,
                to: view.state.doc.length,
                insert: value,
            },
        });
    }, [value]);

    // Update CodeMirror editability when read-only state changes.
    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;

        view.dispatch({
            effects: readOnlyCompartmentRef.current.reconfigure([
                EditorState.readOnly.of(readOnly),
                EditorView.editable.of(!readOnly),
            ]),
        });
    }, [readOnly]);

    // Refresh top editor widgets when chat context chips change.
    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;

        view.dispatch({
            effects: topWidgetsCompartmentRef.current.reconfigure(
                contextWidgetExtension(topWidgets),
            ),
        });
    }, [topWidgets]);

    return (
        <div
            ref={containerRef}
            className={["markdown-editor min-h-0 flex-1", className]
                .filter(Boolean)
                .join(" ")}
        />
    );
}
