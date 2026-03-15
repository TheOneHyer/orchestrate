import { useEffect, useCallback } from 'react'
import { User, Notification } from '@/lib/types'
import { 
  getExpiringCertifications, 
  shouldSendRenewalReminder,
  generateCertificationNotification 
} from '@/lib/certification-tracker'

export function useCertificationNotifications(
  users: User[],
  onCreateNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void,
  onUpdateUsers: (newValue: User[] | ((oldValue?: User[]) => User[])) => void
) {
  const checkAndNotify = useCallback(() => {
    const expiringCerts = getExpiringCertifications(users)
    const updatedUsers = [...users]
    let hasUpdates = false
    
    expiringCerts.forEach(alert => {
      const user = updatedUsers.find(u => u.id === alert.userId)
      if (!user?.trainerProfile?.certificationRecords) return
      
      const certIndex = user.trainerProfile.certificationRecords.findIndex(
        c => c.certificationName === alert.certification.certificationName
      )
      
      if (certIndex === -1) return
      
      const cert = user.trainerProfile.certificationRecords[certIndex]
      
      if (shouldSendRenewalReminder(cert)) {
        onCreateNotification(generateCertificationNotification(alert, false))
        onCreateNotification(generateCertificationNotification(alert, true))
        
        user.trainerProfile.certificationRecords[certIndex] = {
          ...cert,
          remindersSent: cert.remindersSent + 1,
          lastReminderDate: new Date().toISOString()
        }
        hasUpdates = true
      }
    })
    
    if (hasUpdates) {
      onUpdateUsers(updatedUsers)
    }
  }, [users, onCreateNotification, onUpdateUsers])
  
  useEffect(() => {
    checkAndNotify()
    
    const interval = setInterval(() => {
      checkAndNotify()
    }, 24 * 60 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [checkAndNotify])
}
