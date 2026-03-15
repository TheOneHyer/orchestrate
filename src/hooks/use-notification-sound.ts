import { useCallback, useRef } from 'react'
import { useKV } from '@github/spark/hooks'

interface NotificationSoundSettings {
  enabled: boolean
  volume: number
  soundType: 'default' | 'chime' | 'bell' | 'alert'
}

const DEFAULT_SETTINGS: NotificationSoundSettings = {
  enabled: true,
  volume: 0.5,
  soundType: 'default'
}

export function useNotificationSound() {
  const [settings, setSettings] = useKV<NotificationSoundSettings>(
    'notification-sound-settings',
    DEFAULT_SETTINGS
  )
  const audioContextRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)

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

  const playSound = useCallback((priority: 'low' | 'medium' | 'high' | 'critical' = 'medium') => {
    const safeSettings = settings || DEFAULT_SETTINGS
    
    if (!safeSettings.enabled) return

    initAudioContext()

    if (!audioContextRef.current || !gainNodeRef.current) return

    const ctx = audioContextRef.current
    const now = ctx.currentTime

    const oscillator = ctx.createOscillator()
    const envelope = ctx.createGain()

    oscillator.connect(envelope)
    envelope.connect(gainNodeRef.current)

    gainNodeRef.current.gain.value = safeSettings.volume

    const soundConfig = getSoundConfig(safeSettings.soundType, priority)

    oscillator.type = soundConfig.waveType
    oscillator.frequency.setValueAtTime(soundConfig.startFreq, now)
    
    if (soundConfig.endFreq) {
      oscillator.frequency.exponentialRampToValueAtTime(soundConfig.endFreq, now + soundConfig.duration * 0.7)
    }

    envelope.gain.setValueAtTime(0, now)
    envelope.gain.linearRampToValueAtTime(soundConfig.volume, now + 0.01)
    envelope.gain.exponentialRampToValueAtTime(0.01, now + soundConfig.duration)

    oscillator.start(now)
    oscillator.stop(now + soundConfig.duration)

    if (soundConfig.secondTone) {
      setTimeout(() => {
        const osc2 = ctx.createOscillator()
        const env2 = ctx.createGain()
        
        osc2.connect(env2)
        env2.connect(gainNodeRef.current!)
        
        osc2.type = soundConfig.waveType
        osc2.frequency.setValueAtTime(soundConfig.secondTone!.freq, ctx.currentTime)
        
        env2.gain.setValueAtTime(0, ctx.currentTime)
        env2.gain.linearRampToValueAtTime(soundConfig.secondTone!.volume, ctx.currentTime + 0.01)
        env2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + soundConfig.secondTone!.duration)
        
        osc2.start(ctx.currentTime)
        osc2.stop(ctx.currentTime + soundConfig.secondTone!.duration)
      }, soundConfig.delay || 100)
    }
  }, [settings, initAudioContext])

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
    settings: settings || DEFAULT_SETTINGS,
    playSound,
    updateSettings,
    testSound
  }
}

function getSoundConfig(soundType: string, priority: string) {
  const configs: Record<string, any> = {
    default: {
      low: {
        waveType: 'sine' as OscillatorType,
        startFreq: 400,
        endFreq: 300,
        duration: 0.15,
        volume: 0.3
      },
      medium: {
        waveType: 'sine' as OscillatorType,
        startFreq: 600,
        endFreq: 500,
        duration: 0.2,
        volume: 0.4
      },
      high: {
        waveType: 'sine' as OscillatorType,
        startFreq: 800,
        endFreq: 600,
        duration: 0.25,
        volume: 0.5,
        secondTone: {
          freq: 700,
          duration: 0.15,
          volume: 0.4
        },
        delay: 150
      },
      critical: {
        waveType: 'square' as OscillatorType,
        startFreq: 1000,
        endFreq: 800,
        duration: 0.3,
        volume: 0.6,
        secondTone: {
          freq: 900,
          duration: 0.2,
          volume: 0.5
        },
        delay: 200
      }
    },
    chime: {
      low: {
        waveType: 'sine' as OscillatorType,
        startFreq: 523.25,
        endFreq: null,
        duration: 0.3,
        volume: 0.3
      },
      medium: {
        waveType: 'sine' as OscillatorType,
        startFreq: 659.25,
        endFreq: null,
        duration: 0.35,
        volume: 0.4,
        secondTone: {
          freq: 783.99,
          duration: 0.3,
          volume: 0.35
        },
        delay: 100
      },
      high: {
        waveType: 'sine' as OscillatorType,
        startFreq: 659.25,
        endFreq: null,
        duration: 0.4,
        volume: 0.5,
        secondTone: {
          freq: 880,
          duration: 0.35,
          volume: 0.45
        },
        delay: 120
      },
      critical: {
        waveType: 'triangle' as OscillatorType,
        startFreq: 880,
        endFreq: null,
        duration: 0.4,
        volume: 0.6,
        secondTone: {
          freq: 1046.5,
          duration: 0.35,
          volume: 0.55
        },
        delay: 150
      }
    },
    bell: {
      low: {
        waveType: 'triangle' as OscillatorType,
        startFreq: 800,
        endFreq: 400,
        duration: 0.4,
        volume: 0.3
      },
      medium: {
        waveType: 'triangle' as OscillatorType,
        startFreq: 1000,
        endFreq: 500,
        duration: 0.5,
        volume: 0.4
      },
      high: {
        waveType: 'triangle' as OscillatorType,
        startFreq: 1200,
        endFreq: 600,
        duration: 0.6,
        volume: 0.5
      },
      critical: {
        waveType: 'sawtooth' as OscillatorType,
        startFreq: 1400,
        endFreq: 700,
        duration: 0.6,
        volume: 0.6,
        secondTone: {
          freq: 1200,
          duration: 0.5,
          volume: 0.5
        },
        delay: 250
      }
    },
    alert: {
      low: {
        waveType: 'square' as OscillatorType,
        startFreq: 440,
        endFreq: 330,
        duration: 0.15,
        volume: 0.25
      },
      medium: {
        waveType: 'square' as OscillatorType,
        startFreq: 550,
        endFreq: 440,
        duration: 0.2,
        volume: 0.35
      },
      high: {
        waveType: 'square' as OscillatorType,
        startFreq: 660,
        endFreq: 550,
        duration: 0.25,
        volume: 0.45,
        secondTone: {
          freq: 880,
          duration: 0.2,
          volume: 0.4
        },
        delay: 180
      },
      critical: {
        waveType: 'sawtooth' as OscillatorType,
        startFreq: 880,
        endFreq: 660,
        duration: 0.3,
        volume: 0.55,
        secondTone: {
          freq: 1100,
          duration: 0.25,
          volume: 0.5
        },
        delay: 200
      }
    }
  }

  return configs[soundType]?.[priority] || configs.default[priority]
}
