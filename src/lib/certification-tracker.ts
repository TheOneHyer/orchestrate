import { CertificationRecord, User, Notification } from './types'
import { differenceInDays, addMonths, parseISO, isBefore, isAfter } from 'date-fns'

export interface CertificationAlert {
  userId: string
  userName: string
  certification: CertificationRecord
  daysUntilExpiration: number
  urgency: 'critical' | 'high' | 'medium' | 'low'
}

export function calculateCertificationStatus(cert: CertificationRecord): CertificationRecord['status'] {
  const now = new Date()
  const expirationDate = parseISO(cert.expirationDate)
  const daysUntilExpiration = differenceInDays(expirationDate, now)
  
  if (daysUntilExpiration < 0) {
    return 'expired'
  } else if (daysUntilExpiration <= 30) {
    return 'expiring-soon'
  }
  return 'active'
}

export function shouldSendRenewalReminder(cert: CertificationRecord): boolean {
  const now = new Date()
  const expirationDate = parseISO(cert.expirationDate)
  const daysUntilExpiration = differenceInDays(expirationDate, now)
  
  if (cert.lastReminderDate) {
    const daysSinceLastReminder = differenceInDays(now, parseISO(cert.lastReminderDate))
    if (daysSinceLastReminder < 7) {
      return false
    }
  }
  
  if (daysUntilExpiration <= 90 && daysUntilExpiration > 60) {
    return cert.remindersSent === 0
  } else if (daysUntilExpiration <= 60 && daysUntilExpiration > 30) {
    return cert.remindersSent <= 1
  } else if (daysUntilExpiration <= 30 && daysUntilExpiration > 14) {
    return cert.remindersSent <= 2
  } else if (daysUntilExpiration <= 14 && daysUntilExpiration > 7) {
    return cert.remindersSent <= 3
  } else if (daysUntilExpiration <= 7 && daysUntilExpiration > 0) {
    return true
  }
  
  return false
}

export function getExpiringCertifications(users: User[]): CertificationAlert[] {
  const alerts: CertificationAlert[] = []
  const now = new Date()
  
  users.forEach(user => {
    if (user.role === 'trainer' && user.trainerProfile?.certificationRecords) {
      user.trainerProfile.certificationRecords.forEach(cert => {
        const expirationDate = parseISO(cert.expirationDate)
        const daysUntilExpiration = differenceInDays(expirationDate, now)
        
        if (daysUntilExpiration <= 90) {
          let urgency: CertificationAlert['urgency'] = 'low'
          
          if (daysUntilExpiration < 0) {
            urgency = 'critical'
          } else if (daysUntilExpiration <= 14) {
            urgency = 'critical'
          } else if (daysUntilExpiration <= 30) {
            urgency = 'high'
          } else if (daysUntilExpiration <= 60) {
            urgency = 'medium'
          }
          
          alerts.push({
            userId: user.id,
            userName: user.name,
            certification: cert,
            daysUntilExpiration,
            urgency
          })
        }
      })
    }
  })
  
  return alerts.sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration)
}

export function generateCertificationNotification(
  alert: CertificationAlert,
  isAdmin: boolean = false
): Omit<Notification, 'id' | 'createdAt'> {
  const { certification, daysUntilExpiration, userId, userName } = alert
  
  let title = ''
  let message = ''
  let priority: Notification['priority'] = 'low'
  
  if (daysUntilExpiration < 0) {
    title = isAdmin 
      ? `${userName}'s ${certification.certificationName} Certification Expired`
      : `Your ${certification.certificationName} Certification Has Expired`
    message = isAdmin
      ? `The certification expired ${Math.abs(daysUntilExpiration)} days ago. ${userName} is no longer authorized to teach courses requiring this certification.`
      : `Your certification expired ${Math.abs(daysUntilExpiration)} days ago. You are no longer authorized to teach courses requiring this certification. Please renew immediately.`
    priority = 'critical'
  } else if (daysUntilExpiration === 0) {
    title = isAdmin
      ? `${userName}'s ${certification.certificationName} Expires Today`
      : `Your ${certification.certificationName} Certification Expires Today`
    message = isAdmin
      ? `Action required: ${userName} must renew this certification today to maintain teaching authorization.`
      : 'Action required: Renew your certification today to maintain teaching authorization.'
    priority = 'critical'
  } else if (daysUntilExpiration <= 7) {
    title = isAdmin
      ? `${userName}'s ${certification.certificationName} Expires in ${daysUntilExpiration} Days`
      : `Your ${certification.certificationName} Certification Expires in ${daysUntilExpiration} Days`
    message = isAdmin
      ? `Urgent: Only ${daysUntilExpiration} days remaining. Ensure ${userName} starts the renewal process immediately.`
      : `Urgent: Only ${daysUntilExpiration} days remaining. Start your renewal process immediately.`
    priority = 'critical'
  } else if (daysUntilExpiration <= 14) {
    title = isAdmin
      ? `${userName}'s ${certification.certificationName} Expires in ${daysUntilExpiration} Days`
      : `Your ${certification.certificationName} Certification Expires in ${daysUntilExpiration} Days`
    message = isAdmin
      ? `Renewal needed soon. Contact ${userName} to initiate the certification renewal process.`
      : 'Renewal needed soon. Please initiate your certification renewal process.'
    priority = 'high'
  } else if (daysUntilExpiration <= 30) {
    title = isAdmin
      ? `${userName}'s ${certification.certificationName} Expires in ${daysUntilExpiration} Days`
      : `Your ${certification.certificationName} Certification Expires in ${daysUntilExpiration} Days`
    message = isAdmin
      ? `Plan renewal: ${userName} should schedule certification renewal within the next month.`
      : 'Plan your renewal: Schedule your certification renewal within the next month.'
    priority = 'high'
  } else if (daysUntilExpiration <= 60) {
    title = isAdmin
      ? `${userName}'s ${certification.certificationName} Expires in ${Math.round(daysUntilExpiration / 7)} Weeks`
      : `Your ${certification.certificationName} Certification Expires in ${Math.round(daysUntilExpiration / 7)} Weeks`
    message = isAdmin
      ? `Reminder: ${userName} should begin planning certification renewal.`
      : 'Reminder: Begin planning your certification renewal.'
    priority = 'medium'
  } else {
    title = isAdmin
      ? `${userName}'s ${certification.certificationName} Expires in ${Math.round(daysUntilExpiration / 30)} Months`
      : `Your ${certification.certificationName} Certification Expires in ${Math.round(daysUntilExpiration / 30)} Months`
    message = isAdmin
      ? `Early notice: ${userName}'s certification will expire soon. Keep this on your radar.`
      : 'Early notice: Your certification will expire soon. Keep this on your radar.'
    priority = 'low'
  }
  
  return {
    userId: isAdmin ? 'admin' : userId,
    type: 'reminder',
    title,
    message,
    priority,
    read: false,
    link: isAdmin ? `/people/${userId}` : '/people'
  }
}

export function updateCertificationRecords(users: User[]): User[] {
  return users.map(user => {
    if (user.role === 'trainer' && user.trainerProfile?.certificationRecords) {
      const updatedRecords = user.trainerProfile.certificationRecords.map(cert => ({
        ...cert,
        status: calculateCertificationStatus(cert)
      }))
      
      return {
        ...user,
        trainerProfile: {
          ...user.trainerProfile,
          certificationRecords: updatedRecords
        }
      }
    }
    return user
  })
}

export function getCertificationSummary(users: User[]) {
  let totalCertifications = 0
  let activeCertifications = 0
  let expiringSoon = 0
  let expired = 0
  
  users.forEach(user => {
    if (user.role === 'trainer' && user.trainerProfile?.certificationRecords) {
      user.trainerProfile.certificationRecords.forEach(cert => {
        totalCertifications++
        const status = calculateCertificationStatus(cert)
        
        if (status === 'active') activeCertifications++
        else if (status === 'expiring-soon') expiringSoon++
        else if (status === 'expired') expired++
      })
    }
  })
  
  return {
    totalCertifications,
    activeCertifications,
    expiringSoon,
    expired,
    complianceRate: totalCertifications > 0 
      ? Math.round((activeCertifications / totalCertifications) * 100) 
      : 100
  }
}
