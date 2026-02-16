/**
 * Claude Intelligence Adapter
 *
 * HTTP wrapper that calls the Anthropic Messages API.
 * - Takes system prompt + user input JSON
 * - Calls Claude using ANTHROPIC_API_KEY env var
 * - Forces JSON-only output using strict system message
 * - Validates output with Zod schema if provided
 * - Feature flag: AI_ENABLED env var (default false)
 * - If AI disabled or call fails, returns null so caller can fallback to heuristics
 * - Never includes PII beyond truck numbers
 */

import { z } from 'zod'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'
const DEFAULT_MAX_TOKENS = 4096

const SYSTEM_PREFIX =
  'You are an AI assistant for a petroleum terminal. ' +
  'ALWAYS respond with valid JSON only. No markdown, no explanation, no code fences. Only JSON.'

export interface ClaudeCallOptions<T> {
  systemPrompt: string
  userMessage: string
  outputSchema?: z.ZodType<T>
  maxTokens?: number
}

export interface ClaudeCallResult<T> {
  result: T | null
  raw: any
  error?: string
}

/**
 * Call Claude via the Anthropic Messages API and optionally validate the
 * response against a Zod schema.
 *
 * Returns `{ result: null }` with an error string when:
 * - AI_ENABLED is not 'true'
 * - The API key is missing
 * - The HTTP request fails
 * - JSON parsing fails
 * - Zod validation fails
 *
 * Callers should always be prepared to fall back to deterministic heuristics
 * when `result` is null.
 */
export async function callClaude<T = unknown>(
  opts: ClaudeCallOptions<T>,
): Promise<ClaudeCallResult<T>> {
  // ── Feature flag gate ───────────────────────────────────────────────────
  const aiEnabled = process.env.AI_ENABLED
  if (aiEnabled !== 'true') {
    return { result: null, raw: null, error: 'AI_DISABLED' }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { result: null, raw: null, error: 'ANTHROPIC_API_KEY not configured' }
  }

  try {
    // ── Build the request ───────────────────────────────────────────────
    const systemMessage = `${SYSTEM_PREFIX}\n\n${opts.systemPrompt}`

    const body = {
      model: DEFAULT_MODEL,
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: systemMessage,
      messages: [
        {
          role: 'user' as const,
          content: opts.userMessage,
        },
      ],
    }

    // ── Call Anthropic API ──────────────────────────────────────────────
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown')
      return {
        result: null,
        raw: null,
        error: `API_ERROR: ${response.status} ${response.statusText} – ${errorBody}`,
      }
    }

    const apiResponse = await response.json()

    // ── Extract text from response ─────────────────────────────────────
    const contentBlocks: Array<{ type: string; text?: string }> =
      apiResponse?.content ?? []
    const textBlock = contentBlocks.find((b) => b.type === 'text')

    if (!textBlock?.text) {
      return {
        result: null,
        raw: apiResponse,
        error: 'NO_TEXT_CONTENT: Claude returned no text block',
      }
    }

    const rawText = textBlock.text.trim()

    // ── Parse JSON ─────────────────────────────────────────────────────
    let parsed: unknown
    try {
      parsed = JSON.parse(rawText)
    } catch {
      return {
        result: null,
        raw: rawText,
        error: `JSON_PARSE_FAILED: Response was not valid JSON – ${rawText.slice(0, 200)}`,
      }
    }

    // ── Validate against schema if provided ────────────────────────────
    if (opts.outputSchema) {
      const validation = opts.outputSchema.safeParse(parsed)
      if (!validation.success) {
        return {
          result: null,
          raw: parsed,
          error: `VALIDATION_FAILED: ${validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
        }
      }
      return { result: validation.data, raw: parsed }
    }

    // No schema – return the raw parsed JSON cast to T
    return { result: parsed as T, raw: parsed }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      result: null,
      raw: null,
      error: `UNEXPECTED_ERROR: ${message}`,
    }
  }
}
