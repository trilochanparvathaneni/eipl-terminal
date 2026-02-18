import OpenAI from "openai"

// Lazily initialised so the constructor (which validates OPENAI_API_KEY) is
// never called at Next.js build-time during "Collecting page data".
let _client: OpenAI | undefined

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _client
}

export const CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini"
