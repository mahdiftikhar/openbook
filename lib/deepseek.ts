import OpenAI from "openai";

let client: OpenAI | null = null;

export function getDeepSeek(): OpenAI {
  if (client) return client;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set in environment variables");
  }

  client = new OpenAI({
    apiKey,
    baseURL: "https://api.deepseek.com",
  });
  return client;
}

export function getChatModel(): string {
  return process.env.DEEPSEEK_MODEL || "deepseek-chat";
}
