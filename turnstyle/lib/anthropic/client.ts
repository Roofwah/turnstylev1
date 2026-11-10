/**
 * Shared Anthropic Messages API helpers for Turnstyle.
 * Model: Claude Sonnet 5.5 (claude-sonnet-4-20250514 retired 2026-06-15).
 */

export const ANTHROPIC_MODEL = 'claude-sonnet-5-5'
export const ANTHROPIC_VERSION = '2026-10-21'
export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'

export type AnthropicContentBlock = {
  type?: string
  text?: string
}

/** Prefer text blocks; Sonnet 5.5 may return thinking blocks first. */
export function extractAnthropicText(content: AnthropicContentBlock[] | undefined): string {
  if (!Array.isArray(content) || content.length === 0) return ''
  const texts = content
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text!.trim())
    .filter(Boolean)
  if (texts.length) return texts.join('\n')
  // Fallback for older-shaped responses
  const first = content.find((b) => typeof b?.text === 'string')
  return first?.text?.trim() ?? ''
}

export function anthropicHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
  }
}

/**
 * Default body knobs for structured extraction / review.
 * between_tools avoids expensive adaptive thinking for short JSON tasks.
 */
export function anthropicRequestBody(params: {
  system: string
  user: string
  maxTokens: number
  effort?: 'low' | 'medium' | 'high'
}) {
  return {
    model: ANTHROPIC_MODEL,
    max_tokens: params.maxTokens,
    thinking: { type: 'between_tools' as const },
    output_config: { effort: params.effort ?? 'low' },
    system: params.system,
    messages: [{ role: 'user' as const, content: params.user }],
  }
}
