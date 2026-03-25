import { useCallback, useRef } from 'react'
import { useKV } from '@github/spark/hooks'

/**
 * Configuration for a quiet-hours window during which notification sounds are suppressed.
 */
export interface QuietHours {
  /** Whether the quiet-hours feature is currently active. */
  enabled: boolean
  /** Start of the quiet period in `HH:mm` 24-hour format (e.g. `"22:00"`). */
  startTime: string
  /** End of the quiet period in `HH:mm` 24-hour format (e.g. `"08:00"`). */
  endTime: string
  /** When `true`, critical-priority notifications still play a sound during quiet hours. */
  allowCritical: boolean
}

/**
 * Persisted user preferences for in-app notification sounds.
 */
export interface NotificationSoundSettings {
  /** Whether notification sounds are globally enabled. */
  enabled: boolean
  /** Playback volume, expressed as a value between `0` (silent) and `1` (full volume). */
  volume: number
  /** The tone palette to use when playing notification sounds. */
  soundType: 'soft' | 'pleasant' | 'gentle' | 'musical' | 'minimal'
  /** Quiet-hours configuration that suppresses sounds during specified time windows. */
  quietHours: QuietHours
}

const DEFAULT_SETTINGS: NotificationSoundSettings = {
  enabled: true,
  volume: 0.4,
  soundType: 'pleasant',
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
    allowCritical: true
  }
}

/**
 * Hook that provides Web Audio API–based notification sounds with configurable
 * tone palettes, volume, and quiet-hours scheduling.
 *
 * Sound settings are persisted via KV storage so they survive page reloads.
 * The Web Audio context is initialised lazily on first sound playback.
 *
 * @returns An object containing:
 *   - `settings` – Current {@link NotificationSoundSettings}.
 *   - `playSound` – Play a notification tone for the given priority level.
 *   - `updateSettings` – Merge partial settings updates into the persisted store.
 *   - `testSound` – Play a test tone for the given priority (delegates to `playSound`).
 */
export function useNotificationSound() {
  const [settings, setSettings] = useKV<NotificationSoundSettings>(
    'notification-sound-settings',
    DEFAULT_SETTINGS
  )
  const audioContextRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)

  const safeSettings = settings || DEFAULT_SETTINGS

  const initAudioContext = useCallback(() => {
    if (audioContextRef.current) return

    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      gainNodeRef.current = audioContextRef.current.createGain()
      gainNodeRef.current.connect(audioContextRef.current.destination)
    } catch (error) {
      console.error('Failed to initialize audio context:', error)
    }
  }, [])

  const isWithinQuietHours = useCallback(() => {
    if (!safeSettings.quietHours.enabled) return false

    const now = new Date()
    const currentTime = now.getHours() * 60 + now.getMinutes()

    const [startHour, startMin] = safeSettings.quietHours.startTime.split(':').map(Number)
    const [endHour, endMin] = safeSettings.quietHours.endTime.split(':').map(Number)

    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin

    if (startMinutes < endMinutes) {
      return currentTime >= startMinutes && currentTime < endMinutes
    } else {
      return currentTime >= startMinutes || currentTime < endMinutes
    }
  }, [safeSettings])

  const playSound = useCallback((priority: 'low' | 'medium' | 'high' | 'critical' = 'medium') => {
    if (!safeSettings.enabled) return

    if (isWithinQuietHours()) {
      if (priority !== 'critical' || !safeSettings.quietHours.allowCritical) {
        return
      }
    }

    initAudioContext()

    if (!audioContextRef.current || !gainNodeRef.current) return

    const ctx = audioContextRef.current
    const now = ctx.currentTime

    const soundConfig = getSoundConfig(safeSettings.soundType, priority)
    gainNodeRef.current.gain.value = safeSettings.volume

    soundConfig.tones.forEach((tone, index) => {
      const delay = tone.delay || 0
      const startTime = now + delay / 1000

      const oscillator = ctx.createOscillator()
      const envelope = ctx.createGain()
      const filter = ctx.createBiquadFilter()

      oscillator.connect(filter)
      filter.connect(envelope)
      envelope.connect(gainNodeRef.current!)

      oscillator.type = tone.waveType
      oscillator.frequency.setValueAtTime(tone.startFreq, startTime)

      if (tone.endFreq && tone.endFreq !== tone.startFreq) {
        oscillator.frequency.exponentialRampToValueAtTime(tone.endFreq, startTime + tone.duration * 0.8)
      }

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(tone.filterFreq, startTime)
      filter.Q.setValueAtTime(1, startTime)

      envelope.gain.setValueAtTime(0, startTime)
      envelope.gain.linearRampToValueAtTime(tone.volume, startTime + tone.attack)
      envelope.gain.exponentialRampToValueAtTime(0.01, startTime + tone.duration)

      oscillator.start(startTime)
      oscillator.stop(startTime + tone.duration)
    })
  }, [safeSettings, initAudioContext, isWithinQuietHours])

  const updateSettings = useCallback((updates: Partial<NotificationSoundSettings>) => {
    setSettings((current) => ({
      ...(current || DEFAULT_SETTINGS),
      ...updates
    }))
  }, [setSettings])

  const testSound = useCallback((priority: 'low' | 'medium' | 'high' | 'critical' = 'medium') => {
    playSound(priority)
  }, [playSound])

  return {
    settings: safeSettings,
    playSound,
    updateSettings,
    testSound
  }
}

/**
 * Describes a single oscillator tone used to build a notification sound.
 */
interface SoundTone {
  /** Oscillator waveform shape. */
  waveType: OscillatorType
  /** Starting frequency of the tone in Hz. */
  startFreq: number
  /** Optional ending frequency in Hz; when set, the pitch glides from `startFreq` to `endFreq`. */
  endFreq?: number
  /** Total duration of the tone in seconds. */
  duration: number
  /** Peak amplitude of the tone (0–1 scale applied before the master gain node). */
  volume: number
  /** Attack time in seconds – how quickly the tone ramps up to full volume. */
  attack: number
  /** Delay in milliseconds before the tone starts (used to sequence chords/arpeggios). */
  delay?: number
  /** Low-pass filter cut-off frequency in Hz applied to the tone. */
  filterFreq: number
}

/**
 * A collection of tones that together make up a single notification sound.
 */
interface SoundConfiguration {
  /** Ordered list of oscillator tones to play for this sound. */
  tones: SoundTone[]
}

/**
 * Returns the {@link SoundConfiguration} for the given sound type and notification priority.
 *
 * Falls back to the `pleasant` palette if `soundType` is unrecognised.
 *
 * @param soundType - One of the named sound palettes (`'soft'`, `'pleasant'`, `'gentle'`, `'musical'`, `'minimal'`).
 * @param priority - Notification priority level (`'low'`, `'medium'`, `'high'`, `'critical'`).
 * @returns The matching {@link SoundConfiguration} containing the tones to play.
 */
function getSoundConfig(soundType: string, priority: string): SoundConfiguration {
  const configs: Record<string, Record<string, SoundConfiguration>> = {
    soft: {
      low: {
        tones: [{
          waveType: 'sine',
          startFreq: 523.25,
          duration: 0.4,
          volume: 0.2,
          attack: 0.02,
          filterFreq: 2000
        }]
      },
      medium: {
        tones: [
          {
            waveType: 'sine',
            startFreq: 659.25,
            duration: 0.35,
            volume: 0.25,
            attack: 0.02,
            filterFreq: 2500
          },
          {
            waveType: 'sine',
            startFreq: 783.99,
            duration: 0.3,
            volume: 0.2,
            attack: 0.02,
            delay: 120,
            filterFreq: 2500
          }
        ]
      },
      high: {
        tones: [
          {
            waveType: 'sine',
            startFreq: 659.25,
            duration: 0.35,
            volume: 0.3,
            attack: 0.02,
            filterFreq: 3000
          },
          {
            waveType: 'sine',
            startFreq: 880,
            duration: 0.3,
            volume: 0.25,
            attack: 0.02,
            delay: 110,
            filterFreq: 3000
          }
        ]
      },
      critical: {
        tones: [
          {
            waveType: 'sine',
            startFreq: 880,
            duration: 0.3,
            volume: 0.35,
            attack: 0.02,
            filterFreq: 3500
          },
          {
            waveType: 'sine',
            startFreq: 1046.5,
            duration: 0.25,
            volume: 0.3,
            attack: 0.02,
            delay: 100,
            filterFreq: 3500
          },
          {
            waveType: 'sine',
            startFreq: 880,
            duration: 0.25,
            volume: 0.25,
            attack: 0.02,
            delay: 250,
            filterFreq: 3500
          }
        ]
      }
    },
    pleasant: {
      low: {
        tones: [{
          waveType: 'sine',
          startFreq: 587.33,
          endFreq: 523.25,
          duration: 0.5,
          volume: 0.25,
          attack: 0.03,
          filterFreq: 2200
        }]
      },
      medium: {
        tones: [
          {
            waveType: 'sine',
            startFreq: 698.46,
            duration: 0.4,
            volume: 0.3,
            attack: 0.03,
            filterFreq: 2800
          },
          {
            waveType: 'sine',
            startFreq: 880,
            duration: 0.35,
            volume: 0.25,
            attack: 0.03,
            delay: 130,
            filterFreq: 2800
          }
        ]
      },
      high: {
        tones: [
          {
            waveType: 'sine',
            startFreq: 783.99,
            duration: 0.35,
            volume: 0.35,
            attack: 0.03,
            filterFreq: 3200
          },
          {
            waveType: 'sine',
            startFreq: 987.77,
            duration: 0.3,
            volume: 0.3,
            attack: 0.03,
            delay: 120,
            filterFreq: 3200
          }
        ]
      },
      critical: {
        tones: [
          {
            waveType: 'sine',
            startFreq: 987.77,
            duration: 0.3,
            volume: 0.4,
            attack: 0.02,
            filterFreq: 3500
          },
          {
            waveType: 'sine',
            startFreq: 1174.66,
            duration: 0.25,
            volume: 0.35,
            attack: 0.02,
            delay: 110,
            filterFreq: 3500
          },
          {
            waveType: 'sine',
            startFreq: 987.77,
            duration: 0.25,
            volume: 0.3,
            attack: 0.02,
            delay: 240,
            filterFreq: 3500
          }
        ]
      }
    },
    gentle: {
      low: {
        tones: [{
          waveType: 'triangle',
          startFreq: 440,
          endFreq: 392,
          duration: 0.6,
          volume: 0.2,
          attack: 0.05,
          filterFreq: 1800
        }]
      },
      medium: {
        tones: [
          {
            waveType: 'triangle',
            startFreq: 523.25,
            endFreq: 493.88,
            duration: 0.5,
            volume: 0.25,
            attack: 0.05,
            filterFreq: 2200
          },
          {
            waveType: 'triangle',
            startFreq: 659.25,
            duration: 0.45,
            volume: 0.2,
            attack: 0.05,
            delay: 150,
            filterFreq: 2200
          }
        ]
      },
      high: {
        tones: [
          {
            waveType: 'triangle',
            startFreq: 659.25,
            duration: 0.45,
            volume: 0.3,
            attack: 0.04,
            filterFreq: 2600
          },
          {
            waveType: 'triangle',
            startFreq: 783.99,
            duration: 0.4,
            volume: 0.25,
            attack: 0.04,
            delay: 140,
            filterFreq: 2600
          }
        ]
      },
      critical: {
        tones: [
          {
            waveType: 'triangle',
            startFreq: 783.99,
            duration: 0.35,
            volume: 0.35,
            attack: 0.03,
            filterFreq: 3000
          },
          {
            waveType: 'triangle',
            startFreq: 987.77,
            duration: 0.3,
            volume: 0.3,
            attack: 0.03,
            delay: 120,
            filterFreq: 3000
          },
          {
            waveType: 'triangle',
            startFreq: 880,
            duration: 0.3,
            volume: 0.25,
            attack: 0.03,
            delay: 260,
            filterFreq: 3000
          }
        ]
      }
    },
    musical: {
      low: {
        tones: [
          {
            waveType: 'sine',
            startFreq: 523.25,
            duration: 0.4,
            volume: 0.25,
            attack: 0.03,
            filterFreq: 2500
          },
          {
            waveType: 'sine',
            startFreq: 659.25,
            duration: 0.35,
            volume: 0.2,
            attack: 0.03,
            delay: 120,
            filterFreq: 2500
          }
        ]
      },
      medium: {
        tones: [
          {
            waveType: 'sine',
            startFreq: 659.25,
            duration: 0.35,
            volume: 0.3,
            attack: 0.02,
            filterFreq: 3000
          },
          {
            waveType: 'sine',
            startFreq: 783.99,
            duration: 0.3,
            volume: 0.25,
            attack: 0.02,
            delay: 110,
            filterFreq: 3000
          },
          {
            waveType: 'sine',
            startFreq: 987.77,
            duration: 0.3,
            volume: 0.25,
            attack: 0.02,
            delay: 220,
            filterFreq: 3000
          }
        ]
      },
      high: {
        tones: [
          {
            waveType: 'sine',
            startFreq: 783.99,
            duration: 0.3,
            volume: 0.35,
            attack: 0.02,
            filterFreq: 3500
          },
          {
            waveType: 'sine',
            startFreq: 987.77,
            duration: 0.25,
            volume: 0.3,
            attack: 0.02,
            delay: 100,
            filterFreq: 3500
          },
          {
            waveType: 'sine',
            startFreq: 1174.66,
            duration: 0.25,
            volume: 0.3,
            attack: 0.02,
            delay: 200,
            filterFreq: 3500
          }
        ]
      },
      critical: {
        tones: [
          {
            waveType: 'sine',
            startFreq: 987.77,
            duration: 0.25,
            volume: 0.4,
            attack: 0.02,
            filterFreq: 4000
          },
          {
            waveType: 'sine',
            startFreq: 1174.66,
            duration: 0.25,
            volume: 0.35,
            attack: 0.02,
            delay: 90,
            filterFreq: 4000
          },
          {
            waveType: 'sine',
            startFreq: 1318.51,
            duration: 0.25,
            volume: 0.35,
            attack: 0.02,
            delay: 180,
            filterFreq: 4000
          },
          {
            waveType: 'sine',
            startFreq: 987.77,
            duration: 0.2,
            volume: 0.3,
            attack: 0.02,
            delay: 300,
            filterFreq: 4000
          }
        ]
      }
    },
    minimal: {
      low: {
        tones: [{
          waveType: 'sine',
          startFreq: 440,
          duration: 0.25,
          volume: 0.2,
          attack: 0.02,
          filterFreq: 2000
        }]
      },
      medium: {
        tones: [{
          waveType: 'sine',
          startFreq: 523.25,
          duration: 0.3,
          volume: 0.25,
          attack: 0.02,
          filterFreq: 2500
        }]
      },
      high: {
        tones: [
          {
            waveType: 'sine',
            startFreq: 659.25,
            duration: 0.25,
            volume: 0.3,
            attack: 0.02,
            filterFreq: 3000
          },
          {
            waveType: 'sine',
            startFreq: 783.99,
            duration: 0.2,
            volume: 0.25,
            attack: 0.02,
            delay: 100,
            filterFreq: 3000
          }
        ]
      },
      critical: {
        tones: [
          {
            waveType: 'sine',
            startFreq: 880,
            duration: 0.2,
            volume: 0.35,
            attack: 0.01,
            filterFreq: 3500
          },
          {
            waveType: 'sine',
            startFreq: 1046.5,
            duration: 0.2,
            volume: 0.3,
            attack: 0.01,
            delay: 90,
            filterFreq: 3500
          },
          {
            waveType: 'sine',
            startFreq: 880,
            duration: 0.15,
            volume: 0.25,
            attack: 0.01,
            delay: 210,
            filterFreq: 3500
          }
        ]
      }
    }
  }

  return configs[soundType]?.[priority] || configs.pleasant[priority]
}
