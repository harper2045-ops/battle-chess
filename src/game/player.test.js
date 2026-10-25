import { describe, expect, it } from 'vitest'
import { canScheduleBot, isBotTurn } from './player.js'

describe('bot color assignment', () => {
  it('lets the bot open as White when the player chooses Black', () => {
    expect(isBotTurn('bot', 'b', 'w')).toBe(true)
    expect(isBotTurn('bot', 'b', 'b')).toBe(false)
  })

  it('keeps the bot on Black when the player chooses White', () => {
    expect(isBotTurn('bot', 'w', 'w')).toBe(false)
    expect(isBotTurn('bot', 'w', 'b')).toBe(true)
  })

  it('never assigns a bot turn in Human vs Human mode', () => {
    expect(isBotTurn('human', 'w', 'b')).toBe(false)
  })

  it('does not schedule the bot before the play screen starts', () => {
    expect(canScheduleBot('menu', 'bot', 'b', 'w')).toBe(false)
    expect(canScheduleBot('game', 'bot', 'b', 'w')).toBe(true)
    expect(canScheduleBot('game', 'human', 'b', 'w')).toBe(false)
  })
})
