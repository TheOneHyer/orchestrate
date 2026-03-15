import { useEffect, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import { User, Session, Course, WellnessCheckIn } from '@/lib/types'
import { RiskHistorySnapshot, createRiskSnapshot, shouldTakeSnapshot } from '@/lib/risk-history-tracker'

const SNAPSHOT_FREQUENCY_HOURS = 24

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
    const safeRiskHistory = riskHistory || []
    const newSnapshots: RiskHistorySnapshot[] = []
    
    trainers.forEach(trainer => {
      const trainerSnapshots = safeRiskHistory.filter(s => s.trainerId === trainer.id)
      const lastSnapshot = trainerSnapshots.length > 0
        ? trainerSnapshots.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
        : undefined
      
      if (shouldTakeSnapshot(trainer.id, lastSnapshot, SNAPSHOT_FREQUENCY_HOURS)) {
        const snapshot = createRiskSnapshot(trainer, sessions, courses, wellnessCheckIns)
        newSnapshots.push(snapshot)
      }
    })
    
    if (newSnapshots.length > 0) {
      setRiskHistory((current) => [...(current || []), ...newSnapshots])
    }
  }, [users, sessions, courses, wellnessCheckIns, riskHistory, setRiskHistory])
  
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
    
    return limit ? history.slice(-limit) : history
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
