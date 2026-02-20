import { GoogleGenerativeAI } from "@google/generative-ai"

let _client: GoogleGenerativeAI | undefined

export function getGeminiClient(): GoogleGenerativeAI {
  if (!_client) {
    _client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  }
  return _client
}

export const GEMINI_CHAT_MODEL  = process.env.GEMINI_CHAT_MODEL  ?? "gemini-2.0-flash"
export const GEMINI_EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? "text-embedding-004"
// text-embedding-004 produces 768-dimensional vectors
