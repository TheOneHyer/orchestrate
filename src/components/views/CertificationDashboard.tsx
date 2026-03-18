import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, CertificationRecord } from '@/lib/types'
import {
  getExpiringCertifications,
  getCertificationSummary,
  calculateCertificationStatus
} from '@/lib/certification-tracker'
import { Certificate, Warning, CheckCircle, XCircle, Clock } from '@phosphor-icons/react'
import { format, parseISO } from 'date-fns'
import { AddCertificationDialog } from '@/components/AddCertificationDialog'

interface CertificationDashboardProps {
  users: User[]
  onNavigate: (view: string, data?: any) => void
  onAddCertification: (trainerIds: string[], certification: Omit<CertificationRecord, 'status' | 'renewalRequired' | 'remindersSent'>) => void
}

export function CertificationDashboard({ users, onNavigate, onAddCertification }: CertificationDashboardProps) {
  const summary = getCertificationSummary(users)
  const expiringAlerts = getExpiringCertifications(users)

  const criticalAlerts = expiringAlerts.filter(a => a.urgency === 'critical')
  const highAlerts = expiringAlerts.filter(a => a.urgency === 'high')
  const mediumAlerts = expiringAlerts.filter(a => a.urgency === 'medium')

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'expiring-soon':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'expired':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'border-l-4 border-l-red-500 bg-red-50'
      case 'high':
        return 'border-l-4 border-l-amber-500 bg-amber-50'
      case 'medium':
        return 'border-l-4 border-l-blue-500 bg-blue-50'
      default:
        return 'border-l-4 border-l-gray-300 bg-gray-50'
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-3">
            <Certificate size={32} weight="duotone" className="text-primary" />
            Certification Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Track trainer certifications and manage renewal requirements
          </p>
        </div>
        <AddCertificationDialog users={users} onAddCertification={onAddCertification} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-6" data-testid="total-card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Certificate size={24} weight="duotone" className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-semibold">{summary.totalCertifications}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6" data-testid="active-card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle size={24} weight="duotone" className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-semibold">{summary.activeCertifications}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6" data-testid="expiring-card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Clock size={24} weight="duotone" className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expiring Soon</p>
              <p className="text-2xl font-semibold">{summary.expiringSoon}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6" data-testid="expired-card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle size={24} weight="duotone" className="text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expired</p>
              <p className="text-2xl font-semibold">{summary.expired}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6" data-testid="compliance-card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <CheckCircle size={24} weight="duotone" className="text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Compliance</p>
              <p className="text-2xl font-semibold">{summary.complianceRate}%</p>
            </div>
          </div>
        </Card>
      </div>

      {criticalAlerts.length > 0 && (
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="flex items-start gap-3 mb-4">
            <Warning size={24} weight="duotone" className="text-red-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-red-900">Critical Alerts</h3>
              <p className="text-sm text-red-700">
                {criticalAlerts.length} certification{criticalAlerts.length !== 1 ? 's' : ''} expired or expiring within 14 days
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {criticalAlerts.slice(0, 5).map((alert) => (
              <div
                key={`${alert.userId}-${alert.certification.certificationName}`}
                data-testid={`critical-alert-${alert.userId}`}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => onNavigate('people', { userId: alert.userId })}
              >
                <div className="flex-1">
                  <p className="font-medium text-foreground">{alert.userName}</p>
                  <p className="text-sm text-muted-foreground">{alert.certification.certificationName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="destructive">
                    {alert.daysUntilExpiration < 0
                      ? `Expired ${Math.abs(alert.daysUntilExpiration)}d ago`
                      : `${alert.daysUntilExpiration} days left`}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {highAlerts.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock size={24} weight="duotone" className="text-amber-600" />
            <div>
              <h3 className="text-lg font-semibold">High Priority</h3>
              <p className="text-sm text-muted-foreground">
                {highAlerts.length} certification{highAlerts.length !== 1 ? 's' : ''} expiring within 30 days
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {highAlerts.slice(0, 5).map((alert) => (
              <div
                key={`${alert.userId}-${alert.certification.certificationName}`}
                data-testid={`high-alert-${alert.userId}`}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onNavigate('people', { userId: alert.userId })}
              >
                <div className="flex-1">
                  <p className="font-medium text-foreground">{alert.userName}</p>
                  <p className="text-sm text-muted-foreground">{alert.certification.certificationName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                    {alert.daysUntilExpiration} days left
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Certificate size={24} weight="duotone" className="text-primary" />
          <div>
            <h3 className="text-lg font-semibold">All Trainer Certifications</h3>
            <p className="text-sm text-muted-foreground">Complete certification tracking for all trainers</p>
          </div>
        </div>

        <div className="space-y-4">
          {users
            .filter(u => u.role === 'trainer' && u.trainerProfile?.certificationRecords?.length)
            .map(trainer => {
              const certificationRecords = trainer.trainerProfile!.certificationRecords!
              const certificationCount = certificationRecords.length

              return (
                <div key={trainer.id} className="border rounded-lg p-4">
                  <div
                    className="flex items-center justify-between mb-3 cursor-pointer"
                    onClick={() => onNavigate('people', { userId: trainer.id })}
                  >
                    <div>
                      <h4 className="font-semibold text-foreground">{trainer.name}</h4>
                      <p className="text-sm text-muted-foreground">{trainer.email}</p>
                    </div>
                    <Badge variant="outline">
                      {certificationCount} certification
                      {certificationCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    {certificationRecords.map((cert, certIdx) => {
                      const status = calculateCertificationStatus(cert)
                      const isUnknownStatus = status !== 'expired' && status !== 'expiring-soon' && status !== 'active'
                      const daysUntil = Math.floor(
                        (new Date(cert.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                      )

                      return (
                        <div
                          key={certIdx}
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-sm">{cert.certificationName}</p>
                            <p className="text-xs text-muted-foreground">
                              Expires: {format(parseISO(cert.expirationDate), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {cert.renewalInProgress && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                Renewal in Progress
                              </Badge>
                            )}
                            <Badge className={getStatusColor(status)} data-testid={isUnknownStatus ? 'status-badge-unknown' : undefined}>
                              {status === 'expired' && 'Expired'}
                              {status === 'expiring-soon' && `${daysUntil}d left`}
                              {status === 'active' && 'Active'}
                              {isUnknownStatus && 'Unknown'}
                            </Badge>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

          {users.filter(u => u.role === 'trainer' && u.trainerProfile?.certificationRecords?.length).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Certificate size={48} weight="duotone" className="mx-auto mb-3 opacity-50" />
              <p>No certification records found</p>
              <p className="text-sm mt-1">Add certification records to trainer profiles to track expiration dates</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
