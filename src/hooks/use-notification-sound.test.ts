import { renderHook, act } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useKV } from '@github/spark/hooks'
import { useNotificationSound } from './use-notification-sound'

const TEST_TIME = new Date('2026-03-16T12:00:00.000Z')

vi.mock('@github/spark/hooks', async () => {
    const { useState } = await import('react')
    return {
        useKV: vi.fn((_key: string, defaultValue: unknown) => useState(defaultValue))
    }
})

// Module-level AudioContext mock — safe since Vitest runs each file in isolation
const mockOscillator = {
    connect: vi.fn(),
    type: 'sine' as OscillatorType,
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    start: vi.fn(),
    stop: vi.fn()
}
const mockGainNode = { connect: vi.fn(), gain: { value: 0 } }
const mockFilter = {
    connect: vi.fn(),
    type: 'lowpass' as BiquadFilterType,
    frequency: { setValueAtTime: vi.fn() },
    Q: { setValueAtTime: vi.fn() }
}
const mockAudioContextInstance = {
    createOscillator: vi.fn().mockReturnValue(mockOscillator),
    createGain: vi.fn().mockReturnValue(mockGainNode),
    createBiquadFilter: vi.fn().mockReturnValue(mockFilter),
    currentTime: 0,
    destination: {}
}
const MockAudioContext = vi.fn().mockImplementation(() => mockAudioContextInstance)
vi.stubGlobal('AudioContext', MockAudioContext)

beforeEach(() => {
    vi.mocked(useKV).mockImplementation((_key, defaultValue) => {
        const [value, setValue] = useState(defaultValue as any)
        return [value, setValue, vi.fn()] as any
    })
    vi.useFakeTimers()
    vi.setSystemTime(TEST_TIME)
    MockAudioContext.mockClear()
    mockAudioContextInstance.createOscillator.mockClear()
})

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
})

describe('useNotificationSound', () => {
    it('returns default settings with expected structure', () => {
        const { result } = renderHook(() => useNotificationSound())

        expect(result.current.settings.enabled).toBe(true)
        expect(result.current.settings.volume).toBe(0.4)
        expect(result.current.settings.soundType).toBe('pleasant')
        expect(result.current.settings.quietHours.enabled).toBe(false)
        expect(result.current.settings.quietHours.allowCritical).toBe(true)
    })

    it('updateSettings merges partial changes without losing other settings', () => {
        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true,
                volume: 0.4,
                soundType: 'pleasant',
                quietHours: { enabled: false, startTime: '22:00', endTime: '08:00', allowCritical: true }
            },
            setter
        ] as any)

        const { result } = renderHook(() => useNotificationSound())

        act(() => { result.current.updateSettings({ volume: 0.8 }) })

        expect(setter).toHaveBeenCalledOnce()
        const updaterFn = vi.mocked(setter).mock.calls[0][0] as (prev: any) => any
        const originalSettings = {
            enabled: true, volume: 0.4, soundType: 'pleasant',
            quietHours: { enabled: false, startTime: '22:00', endTime: '08:00', allowCritical: true }
        }
        const merged = updaterFn(originalSettings)
        expect(merged.volume).toBe(0.8)
        expect(merged.soundType).toBe('pleasant')
        expect(merged.enabled).toBe(true)
    })

    it('playSound does not initialize AudioContext when settings.enabled is false', () => {
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: false, volume: 0.4, soundType: 'pleasant',
                quietHours: { enabled: false, startTime: '22:00', endTime: '08:00', allowCritical: true }
            },
            vi.fn()
        ] as any)

        const { result } = renderHook(() => useNotificationSound())
        act(() => { result.current.playSound() })

        expect(MockAudioContext).not.toHaveBeenCalled()
    })

    it('suppresses non-critical sounds during active quiet hours', () => {
        const quietHoursUtcTime = Date.UTC(2026, 2, 16, 23, 0, 0)
        vi.setSystemTime(quietHoursUtcTime)
        const localHourAtUtcTime = new Date(quietHoursUtcTime).getHours()
        const startTime = `${String(localHourAtUtcTime).padStart(2, '0')}:00`
        const endTime = `${String((localHourAtUtcTime + 1) % 24).padStart(2, '0')}:00`

        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true, volume: 0.4, soundType: 'pleasant',
                quietHours: { enabled: true, startTime, endTime, allowCritical: true }
            },
            vi.fn()
        ] as any)

        const { result } = renderHook(() => useNotificationSound())
        act(() => { result.current.playSound('medium') })

        // initAudioContext should not be called because quiet hours block non-critical sounds
        expect(MockAudioContext).not.toHaveBeenCalled()
    })
})
