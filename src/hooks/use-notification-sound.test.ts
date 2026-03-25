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

    it('falls back to default settings when persisted settings are undefined and merges updates from defaults', () => {
        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue([undefined, setter] as any)

        const { result } = renderHook(() => useNotificationSound())

        expect(result.current.settings.enabled).toBe(true)
        expect(result.current.settings.soundType).toBe('pleasant')

        act(() => {
            result.current.updateSettings({ enabled: false })
        })

        const updaterFn = vi.mocked(setter).mock.calls[0][0] as (prev: unknown) => Record<string, unknown>
        const merged = updaterFn(undefined)

        expect(merged.enabled).toBe(false)
        expect(merged.volume).toBe(0.4)
        expect(merged.soundType).toBe('pleasant')
    })

    it('falls back to default settings when persisted settings are undefined and merges updates from defaults', () => {
        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue([undefined, setter] as any)

        const { result } = renderHook(() => useNotificationSound())

        expect(result.current.settings.enabled).toBe(true)
        expect(result.current.settings.soundType).toBe('pleasant')

        act(() => {
            result.current.updateSettings({ enabled: false })
        })

        const updaterFn = vi.mocked(setter).mock.calls[0][0] as (prev: unknown) => Record<string, unknown>
        const merged = updaterFn(undefined)
        expect(merged.enabled).toBe(false)
        expect(merged.volume).toBe(0.4)
        expect(merged.soundType).toBe('pleasant')
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

    it('suppresses sound during normal quiet-hour windows that do not cross midnight', () => {
        const candidateUtcHours = [12, 9, 6, 3, 0, 15, 18, 21]
        let chosenUtcTime = Date.UTC(2026, 2, 16, 12, 30, 0)

        for (const hour of candidateUtcHours) {
            const candidate = Date.UTC(2026, 2, 16, hour, 30, 0)
            const localHour = new Date(candidate).getHours()
            if (localHour >= 1 && localHour <= 21) {
                chosenUtcTime = candidate
                break
            }
        }

        vi.setSystemTime(chosenUtcTime)
        const localHour = new Date(chosenUtcTime).getHours()
        const startTime = `${String(localHour).padStart(2, '0')}:00`
        const endTime = `${String(localHour + 1).padStart(2, '0')}:00`

        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true,
                volume: 0.4,
                soundType: 'soft',
                quietHours: { enabled: true, startTime, endTime, allowCritical: true }
            },
            vi.fn()
        ] as any)

        const { result } = renderHook(() => useNotificationSound())
        act(() => {
            result.current.playSound('low')
        })

        expect(MockAudioContext).not.toHaveBeenCalled()
    })

    it('handles AudioContext initialization failures without throwing', () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        MockAudioContext.mockImplementationOnce(function ThrowingAudioContext() {
            throw new Error('audio-init-failure')
        })
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true,
                volume: 0.4,
                soundType: 'pleasant',
                quietHours: { enabled: false, startTime: '22:00', endTime: '08:00', allowCritical: true }
            },
            vi.fn()
        ] as any)

        const { result } = renderHook(() => useNotificationSound())

        expect(() => {
            act(() => {
                result.current.playSound('medium')
            })
        }).not.toThrow()
        expect(consoleErrorSpy).toHaveBeenCalled()

        consoleErrorSpy.mockRestore()
    })

    it('falls back to webkitAudioContext when AudioContext is unavailable', () => {
        vi.stubGlobal('AudioContext', undefined)
        Object.defineProperty(window, 'webkitAudioContext', {
            configurable: true,
            writable: true,
            value: MockAudioContext,
        })

        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true,
                volume: 0.4,
                soundType: 'pleasant',
                quietHours: { enabled: false, startTime: '22:00', endTime: '08:00', allowCritical: true }
            },
            vi.fn()
        ] as any)

        const { result } = renderHook(() => useNotificationSound())

        act(() => {
            result.current.playSound('medium')
        })

        expect(MockAudioContext).toHaveBeenCalledOnce()

        vi.stubGlobal('AudioContext', MockAudioContext)
    })

    it('falls back to webkitAudioContext when AudioContext is unavailable', () => {
        vi.stubGlobal('AudioContext', undefined)
        Object.defineProperty(window, 'webkitAudioContext', {
            configurable: true,
            writable: true,
            value: MockAudioContext,
        })
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true,
                volume: 0.4,
                soundType: 'pleasant',
                quietHours: { enabled: false, startTime: '22:00', endTime: '08:00', allowCritical: true }
            },
            vi.fn()
        ] as any)

        const { result } = renderHook(() => useNotificationSound())

        act(() => {
            result.current.playSound('medium')
        })

        expect(MockAudioContext).toHaveBeenCalledOnce()

        vi.stubGlobal('AudioContext', MockAudioContext)
    })

    it('uses testSound helper to trigger audio playback', () => {
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true,
                volume: 0.5,
                soundType: 'gentle',
                quietHours: { enabled: false, startTime: '22:00', endTime: '08:00', allowCritical: true }
            },
            vi.fn()
        ] as any)

        const { result } = renderHook(() => useNotificationSound())
        act(() => {
            result.current.testSound('high')
        })

        expect(MockAudioContext).toHaveBeenCalledOnce()
        expect(mockAudioContextInstance.createOscillator).toHaveBeenCalled()
    })
})

it('suppresses sound during overnight (cross-midnight) quiet hours', () => {
    // startTime "01:00" > endTime "00:30" in minutes (60 > 30), triggering the
    // else branch in isWithinQuietHours. Any local time in range [01:00, 00:30)
    // wrapping around midnight is suppressed; with a near-24h window every
    // reasonable local time is within quiet hours.
    vi.mocked(useKV).mockReturnValue([
        {
            enabled: true,
            volume: 0.4,
            soundType: 'soft',
            quietHours: { enabled: true, startTime: '01:00', endTime: '00:30', allowCritical: true }
        },
        vi.fn()
    ] as any)

    const { result } = renderHook(() => useNotificationSound())
    act(() => { result.current.playSound('medium') })

    expect(MockAudioContext).not.toHaveBeenCalled()
})

it('plays sound outside overnight quiet hours when current time is between end and start', () => {
    // With start > end, isWithinQuietHours uses the overnight branch:
    // current >= start || current < end. At local noon this expression is false for 23:00-05:00.
    vi.mocked(useKV).mockReturnValue([
        {
            enabled: true,
            volume: 0.4,
            soundType: 'soft',
            quietHours: { enabled: true, startTime: '23:00', endTime: '05:00', allowCritical: true }
        },
        vi.fn()
    ] as any)

    const { result } = renderHook(() => useNotificationSound())
    act(() => { result.current.playSound('medium') })

    expect(MockAudioContext).toHaveBeenCalledOnce()
})

it('schedules an exponential frequency ramp when tone has a different endFreq', () => {
    // The 'pleasant' sound type at 'low' priority has startFreq: 587.33, endFreq: 523.25,
    // which triggers exponentialRampToValueAtTime when endFreq differs from startFreq.
    vi.mocked(useKV).mockReturnValue([
        {
            enabled: true,
            volume: 0.5,
            soundType: 'pleasant',
            quietHours: { enabled: false, startTime: '22:00', endTime: '08:00', allowCritical: true }
        },
        vi.fn()
    ] as any)

    const { result } = renderHook(() => useNotificationSound())
    act(() => { result.current.playSound('low') })

    expect(MockAudioContext).toHaveBeenCalledOnce()
    expect(mockOscillator.frequency.exponentialRampToValueAtTime).toHaveBeenCalled()
})
