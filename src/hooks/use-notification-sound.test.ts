import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useKV } from '@github/spark/hooks'
import { useNotificationSound } from './use-notification-sound'

const TEST_TIME = new Date('2026-03-16T12:00:00.000Z')
const oscillatorTypeSetter = vi.fn<(value: OscillatorType) => void>()

vi.mock('@github/spark/hooks')

// Module-level AudioContext mock — safe since Vitest runs each file in isolation
const mockOscillator = {
    connect: vi.fn(),
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    start: vi.fn(),
    stop: vi.fn()
}
const mockGainNode = {
    connect: vi.fn(),
    gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
    }
}
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
const MockAudioContext = vi.fn(function MockAudioContext(this: unknown) {
    return mockAudioContextInstance
})
vi.stubGlobal('AudioContext', MockAudioContext)
Object.defineProperty(window, 'webkitAudioContext', {
    configurable: true,
    writable: true,
    value: MockAudioContext,
})

function makeQuietHoursTimes(utcTime: number) {
    vi.setSystemTime(utcTime)
    const localHourAtUtcTime = new Date(utcTime).getHours()
    const startTime = `${String(localHourAtUtcTime).padStart(2, '0')}:00`
    const endTime = `${String((localHourAtUtcTime + 1) % 24).padStart(2, '0')}:00`

    return { startTime, endTime }
}

Object.defineProperty(mockOscillator, 'type', {
    configurable: true,
    get: () => 'sine' as OscillatorType,
    set: (value: OscillatorType) => oscillatorTypeSetter(value),
})

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useKV).mockImplementation((_key, defaultValue) => [defaultValue as any, vi.fn()] as any)
    vi.useFakeTimers()
    vi.setSystemTime(TEST_TIME)
    mockGainNode.gain.value = 0
})

afterEach(() => {
    vi.useRealTimers()
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
        const { startTime, endTime } = makeQuietHoursTimes(quietHoursUtcTime)

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

    it('initializes audio context and schedules tones when enabled', () => {
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true,
                volume: 0.65,
                soundType: 'pleasant',
                quietHours: { enabled: false, startTime: '22:00', endTime: '08:00', allowCritical: true }
            },
            vi.fn()
        ] as any)

        const { result } = renderHook(() => useNotificationSound())
        act(() => {
            result.current.playSound('high')
        })

        expect(MockAudioContext).toHaveBeenCalledOnce()
        expect(mockAudioContextInstance.createOscillator).toHaveBeenCalled()
        expect(mockAudioContextInstance.createGain).toHaveBeenCalled()
        expect(mockOscillator.start).toHaveBeenCalled()
        expect(mockOscillator.stop).toHaveBeenCalled()
        expect(mockGainNode.gain.value).toBe(0.65)
    })

    it('blocks critical alerts during quiet hours when allowCritical is false', () => {
        const quietHoursUtcTime = Date.UTC(2026, 2, 16, 23, 0, 0)
        const { startTime, endTime } = makeQuietHoursTimes(quietHoursUtcTime)

        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true,
                volume: 0.4,
                soundType: 'soft',
                quietHours: { enabled: true, startTime, endTime, allowCritical: false }
            },
            vi.fn()
        ] as any)

        const { result } = renderHook(() => useNotificationSound())
        act(() => {
            result.current.playSound('critical')
        })

        expect(MockAudioContext).not.toHaveBeenCalled()
    })

    it('allows critical alerts during quiet hours when allowCritical is true', () => {
        const quietHoursUtcTime = Date.UTC(2026, 2, 16, 23, 0, 0)
        const { startTime, endTime } = makeQuietHoursTimes(quietHoursUtcTime)

        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true,
                volume: 0.4,
                soundType: 'musical',
                quietHours: { enabled: true, startTime, endTime, allowCritical: true }
            },
            vi.fn()
        ] as any)

        const { result } = renderHook(() => useNotificationSound())
        act(() => {
            result.current.playSound('critical')
        })

        expect(MockAudioContext).toHaveBeenCalledOnce()
        expect(mockAudioContextInstance.createOscillator).toHaveBeenCalled()
    })

    it('falls back to pleasant configuration when sound type is unknown', () => {
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true,
                volume: 0.5,
                soundType: 'unknown',
                quietHours: { enabled: false, startTime: '22:00', endTime: '08:00', allowCritical: true }
            },
            vi.fn()
        ] as any)

        const { result } = renderHook(() => useNotificationSound())
        act(() => {
            result.current.playSound('medium')
        })

        expect(MockAudioContext).toHaveBeenCalledOnce()
        expect(mockAudioContextInstance.createOscillator).toHaveBeenCalled()
        expect(oscillatorTypeSetter).toHaveBeenCalledWith('sine')
        expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalled()
        const scheduledFrequencies = vi.mocked(mockOscillator.frequency.setValueAtTime).mock.calls.map(call => call[0])
        expect(scheduledFrequencies.every((frequency) => Number.isFinite(frequency) && frequency > 0)).toBe(true)
    })
})
