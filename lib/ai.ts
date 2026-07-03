import { getDeepSeek, getChatModel } from "./deepseek";
import type { Citation } from "@/types";

const SYSTEM_PROMPT = `You are an AI research assistant embedded in OpenBook, a NotebookLM-style tool.
Your role is to help users understand and analyze their documents.

Guidelines:
- Answer questions based ONLY on the provided document excerpts below.
- If the excerpts don't contain enough information to answer fully, say so honestly.
- Always cite your sources using the format [Source: Title] when referencing specific information.
- Be concise but thorough. Use bullet points for clarity when appropriate.
- If asked to summarize, provide a structured summary with key points.
- If the user asks something outside the document scope, politely note that and offer to help with something the documents cover.
- Use markdown formatting for readability (headings, lists, bold, etc).`;

interface ChatOptions {
    query: string;
    contextChunks: Array<{
        text: string;
        documentTitle: string;
        chunkId: string;
    }>;
    conversationHistory?: Array<{
        role: "user" | "assistant";
        content: string;
    }>;
    stream?: boolean;
}

export async function generateChatResponse(
    options: ChatOptions & { stream?: false },
): Promise<{
    content: string;
    citations: Citation[];
}>;

export async function generateChatResponse(
    options: ChatOptions & { stream: true },
): Promise<ReadableStream<Uint8Array>>;

export async function generateChatResponse(
    options: ChatOptions,
): Promise<
    { content: string; citations: Citation[] } | ReadableStream<Uint8Array>
> {
    const deepseek = getDeepSeek();
    const model = getChatModel();

    // Build context string
    const contextStr = options.contextChunks
        .map(
            (c, i) =>
                `[Document: ${c.documentTitle}]\n[Chunk ID: ${c.chunkId}]\n${c.text}\n---`,
        )
        .join("\n\n");

    const messages: Array<{
        role: "system" | "user" | "assistant";
        content: string;
    }> = [
        { role: "system", content: SYSTEM_PROMPT },
        {
            role: "system",
            content: `Here are the relevant document excerpts:\n\n${contextStr}`,
        },
    ];

    // Add conversation history
    if (options.conversationHistory && options.conversationHistory.length > 0) {
        messages.push(...options.conversationHistory);
    }

    messages.push({
        role: "user",
        content: options.query,
    });

    if (options.stream) {
        const stream = await deepseek.chat.completions.create({
            model,
            messages,
            temperature: 0.5,
            max_tokens: 4000,
            stream: true,
        });

        return new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of stream) {
                        const content = chunk.choices[0]?.delta?.content;
                        if (content) {
                            controller.enqueue(
                                new TextEncoder().encode(content),
                            );
                        }
                    }
                    controller.close();
                } catch (error) {
                    controller.error(error);
                }
            },
        });
    }

    const response = await deepseek.chat.completions.create({
        model,
        messages,
        temperature: 0.5,
        max_tokens: 4000,
    });

    const content =
        response.choices[0]?.message?.content ||
        "I couldn't generate a response.";

    // Build citations from context chunks
    const citations: Citation[] = options.contextChunks.map((c) => {
        const snippet = c.text.slice(0, 100);
        const relevance = content.includes(snippet.slice(0, 50)) ? 0.9 : 0.5;

        return {
            document_id: "",
            document_title: c.documentTitle,
            chunk_id: c.chunkId,
            text: c.text.slice(0, 200) + (c.text.length > 200 ? "..." : ""),
            relevance,
        };
    });

    return { content, citations };
}
