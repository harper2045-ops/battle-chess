import { describe, expect, it } from 'vitest'
import {
  formatBotThinkingLabel,
  formatDifficultyLabel,
} from './botThinking.js'

describe('bot thinking labels', () => {
  it('title-cases known difficulties', () => {
    expect(formatDifficultyLabel('easy')).toBe('Easy')
    expect(formatDifficultyLabel('medium')).toBe('Medium')
    expect(formatDifficultyLabel('hard')).toBe('Hard')
  })

  it('falls back to Medium for unknown levels', () => {
    expect(formatDifficultyLabel('absurd')).toBe('Medium')
    expect(formatDifficultyLabel(undefined)).toBe('Medium')
  })

  it('builds a live thinking label with difficulty', () => {
    expect(formatBotThinkingLabel('hard')).toBe('Bot thinking (Hard)…')
    expect(formatBotThinkingLabel('easy')).toBe('Bot thinking (Easy)…')
  })
})
