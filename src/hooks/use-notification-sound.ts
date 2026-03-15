import { useCallback, useRef } from 'react'
import { useKV } from '@github/spark/hooks'

export interface QuietHours {
  enabled: boolean
  startTime: string
  endTime: string
  allowCritical: boolean
}

export interface NotificationSoundSettings {
  enabled: boolean
  volume: number
  soundType: 'soft' | 'pleasant' | 'gentle' | 'musical' | 'minimal'
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
      filter.frequency.setValueAtTime(tone.filterFreq || 3000, startTime)
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

interface SoundTone {
  waveType: OscillatorType
  startFreq: number
  endFreq?: number
  duration: number
  volume: number
  attack: number
  delay?: number
  filterFreq?: number
}

interface SoundConfiguration {
  tones: SoundTone[]
}

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
