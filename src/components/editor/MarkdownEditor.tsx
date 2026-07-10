import { markdown } from "@codemirror/lang-markdown";
import {
    defaultKeymap,
    history,
    historyKeymap,
    indentWithTab,
} from "@codemirror/commands";
import {
    bracketMatching,
    defaultHighlightStyle,
    indentOnInput,
    syntaxHighlighting,
} from "@codemirror/language";
import { EditorState, RangeSetBuilder, type Extension } from "@codemirror/state";
import {
    Decoration,
    type DecorationSet,
    drawSelection,
    dropCursor,
    EditorView,
    keymap,
    placeholder as editorPlaceholder,
    ViewPlugin,
    type ViewUpdate,
} from "@codemirror/view";
import { useEffect, useRef } from "react";

function buildHeadingDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();

    for (const range of view.visibleRanges) {
        for (let pos = range.from; pos <= range.to; ) {
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

const editorExtensions: Extension[] = [
    history(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    bracketMatching(),
    markdown(),
    headingLineDecorations,
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    EditorView.lineWrapping,
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
];

export function MarkdownEditor({
    value,
    onChange,
    onBlur,
    placeholder,
    className,
}: {
    value: string;
    onChange: (value: string) => void;
    onBlur: () => void;
    placeholder?: string;
    className?: string;
}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onBlurRef = useRef(onBlur);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        onBlurRef.current = onBlur;
    }, [onBlur]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const state = EditorState.create({
            doc: value,
            extensions: [
                ...editorExtensions,
                editorPlaceholder(placeholder ?? ""),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        onChangeRef.current(update.state.doc.toString());
                    }
                }),
                EditorView.domEventHandlers({
                    blur: () => {
                        onBlurRef.current();
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

    return (
        <div
            ref={containerRef}
            className={["markdown-editor min-h-0 flex-1", className]
                .filter(Boolean)
                .join(" ")}
        />
    );
}
