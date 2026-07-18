import { describe, it, expect } from 'vitest'
import { classifyKey, coerceValue, gamemodeKey } from '../src/renderer/src/lib/stationConfig'
import { gamemodeDisplayName, gamemodeGroup } from '../src/renderer/src/lib/gamemodes'
import { boardName } from '../src/renderer/src/lib/boards'

describe('classifyKey', () => {
  it('hides LE strings, colors, and board URLs', () => {
    expect(classifyKey('CustomGamemodes.0800_Full_3').kind).toBe('hidden')
    expect(classifyKey('primary_color').kind).toBe('hidden')
    expect(classifyKey('secondary_color').kind).toBe('hidden')
    expect(classifyKey('config.stationConfig.BoardTextureUrl10').kind).toBe('hidden')
  })

  it('parses gamemode override keys with the gm id and field', () => {
    const c = classifyKey('loadedgamemodes.1200_Full_2.modulestate.dashboardconfigoverrides.bUseRollbackNetcode')
    expect(c).toEqual({ kind: 'gamemode', gm: '1200_Full_2', field: 'bUseRollbackNetcode' })
    // ids may contain spaces
    const s = classifyKey('loadedgamemodes.fieldhouse 03.modulestate.dashboardconfigoverrides.ballowplayertackling')
    expect(s.kind === 'gamemode' && s.gm).toBe('fieldhouse 03')
  })

  it('everything else is plain config', () => {
    expect(classifyKey('is_whitelist').kind).toBe('config')
    expect(classifyKey('config.spawnPointSettings.overrideSpawnPoint').kind).toBe('config')
  })
})

describe('coerceValue', () => {
  it('types booleans and numbers, keeps text as text', () => {
    expect(coerceValue('true')).toBe(true)
    expect(coerceValue('false')).toBe(false)
    expect(coerceValue('301')).toBe(301)
    expect(coerceValue('4.5')).toBe(4.5)
    expect(coerceValue('Team name example')).toBe('Team name example')
    expect(coerceValue('')).toBe('')
  })
})

describe('gamemode naming', () => {
  it('maps known ids case-insensitively', () => {
    expect(gamemodeDisplayName('tkb_prime')).toBe('Prime Arena')
    expect(gamemodeDisplayName('1200_Full_2')).toBe('First 2v2 Strike Arena')
    expect(gamemodeDisplayName('1200_full_2')).toBe('First 2v2 Strike Arena')
    expect(gamemodeGroup('TKB_Bunker')).toBe('TKB')
  })

  it('prettifies unknown ids', () => {
    expect(gamemodeDisplayName('some_new_arena')).toBe('some new arena')
    expect(gamemodeGroup('some_new_arena')).toBeNull()
  })
})

describe('board naming', () => {
  it('names mapped slots and falls back beyond the list', () => {
    expect(boardName(0).name).toBe('Landing pad triboard left: sides')
    expect(boardName(9).name).toBe('Club large promo board')
    expect(boardName(12).name).toBe('Board 12')
  })
})

describe('gamemodeKey', () => {
  it('builds the full override key', () => {
    expect(gamemodeKey('1200_Full_2', 'matchlengthseconds')).toBe(
      'loadedgamemodes.1200_Full_2.modulestate.dashboardconfigoverrides.matchlengthseconds'
    )
  })
})
