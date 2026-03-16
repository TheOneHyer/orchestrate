import { useEffect, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import { User, Session, Course, WellnessCheckIn } from '@/lib/types'
import { RiskHistorySnapshot, createRiskSnapshot, shouldTakeSnapshot } from '@/lib/risk-history-tracker'

const SNAPSHOT_FREQUENCY_HOURS = 24
const MAX_HISTORY = 1000

export function useRiskHistory(
  users: User[],
  sessions: Session[],
  courses: Course[],
  wellnessCheckIns: WellnessCheckIn[]
) {
  const [riskHistory, setRiskHistory] = useKV<RiskHistorySnapshot[]>('risk-history-snapshots', [])

  const takeSnapshots = useCallback(() => {
    if (!users || users.length === 0) return

    const trainers = users.filter(u => u.role === 'trainer')
    if (trainers.length === 0) return

    setRiskHistory((current) => {
      const safeRiskHistory = current || []
      const newSnapshots: RiskHistorySnapshot[] = []

      trainers.forEach(trainer => {
        const lastSnapshot = safeRiskHistory.reduce<RiskHistorySnapshot | undefined>((latest, snapshot) => {
          if (snapshot.trainerId !== trainer.id) {
            return latest
          }

          if (!latest) {
            return snapshot
          }

          return new Date(snapshot.timestamp).getTime() > new Date(latest.timestamp).getTime()
            ? snapshot
            : latest
        }, undefined)

        if (shouldTakeSnapshot(trainer.id, lastSnapshot, SNAPSHOT_FREQUENCY_HOURS)) {
          newSnapshots.push(createRiskSnapshot(trainer, sessions, courses, wellnessCheckIns))
        }
      })

      if (newSnapshots.length === 0) {
        return safeRiskHistory
      }

      // Keep history bounded so long-running sessions don't grow storage without limit.
      const combined = [...safeRiskHistory, ...newSnapshots]
      return combined.length > MAX_HISTORY ? combined.slice(-MAX_HISTORY) : combined
    })
  }, [users, sessions, courses, wellnessCheckIns, setRiskHistory])

  useEffect(() => {
    const timer = setTimeout(() => {
      takeSnapshots()
    }, 5000)

    return () => clearTimeout(timer)
  }, [takeSnapshots])

  const getTrainerHistory = useCallback((trainerId: string, limit?: number) => {
    const safeRiskHistory = riskHistory || []
    const history = safeRiskHistory
      .filter(s => s.trainerId === trainerId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    if (typeof limit === 'number') {
      if (limit <= 0) {
        return []
      }

      return history.slice(-limit)
    }

    return history
  }, [riskHistory])

  const clearHistory = useCallback(() => {
    setRiskHistory([])
  }, [setRiskHistory])

  return {
    riskHistory: riskHistory || [],
    getTrainerHistory,
    clearHistory,
    takeSnapshots
  }
}
