import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { CertificationRecord } from '@/lib/types'
import { Plus, X } from '@phosphor-icons/react'
import { format } from 'date-fns'

/**
 * Props for the {@link ManageCertificationsDialog} component.
 */
interface ManageCertificationsDialogProps {
  /** Whether the dialog is open. */
  open: boolean
  /** Callback to update the open state of the dialog. */
  onOpenChange: (open: boolean) => void
  /** Current certification records to seed the dialog's local state. */
  certifications: CertificationRecord[]
  /**
   * Callback invoked with the updated list of certifications when the user saves.
   * @param certifications - The full set of certification records after edits.
   */
  onSave: (certifications: CertificationRecord[]) => void
}

/**
 * Returns a blank {@link CertificationRecord} template used to reset the inline form.
 *
 * @returns A partial certification record with default field values.
 */
const getEmptyFormData = (): Partial<CertificationRecord> => ({
  certificationName: '',
  issuedDate: '',
  expirationDate: '',
  status: 'active',
  renewalRequired: true,
  remindersSent: 0,
  renewalInProgress: false,
  notes: ''
})

/**
 * Dialog for adding, editing, and removing a trainer's certification records.
 *
 * Embeds an inline form (add/edit mode) alongside a list of existing certifications.
 * Local state is used for edits and is only committed to the parent when the user clicks
 * "Save Changes". Cancelling reverts local state to the original `certifications` prop.
 * The dialog resets and re-seeds its local state each time it is opened.
 */
export function ManageCertificationsDialog({
  open,
  onOpenChange,
  certifications,
  onSave
}: ManageCertificationsDialogProps) {
  const [localCerts, setLocalCerts] = useState<CertificationRecord[]>(certifications)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const prevOpenRef = useRef(open)

  const [formData, setFormData] = useState<Partial<CertificationRecord>>(getEmptyFormData)

  useEffect(() => {
    const wasOpen = prevOpenRef.current

    if (open && !wasOpen) {
      setLocalCerts(certifications)
      setEditingIndex(null)
      setFormData(getEmptyFormData())
    }

    prevOpenRef.current = open
  }, [open, certifications])

  const handleAdd = () => {
    if (!formData.certificationName || !formData.issuedDate || !formData.expirationDate) {
      return
    }

    const newCert: CertificationRecord = {
      certificationName: formData.certificationName,
      issuedDate: formData.issuedDate,
      expirationDate: formData.expirationDate,
      status: formData.status || 'active',
      renewalRequired: formData.renewalRequired ?? true,
      remindersSent: 0,
      renewalInProgress: formData.renewalInProgress || false,
      notes: formData.notes || ''
    }

    if (editingIndex !== null) {
      const updated = [...localCerts]
      updated[editingIndex] = newCert
      setLocalCerts(updated)
      setEditingIndex(null)
    } else {
      setLocalCerts([...localCerts, newCert])
    }

    setFormData(getEmptyFormData())
  }

  const handleEdit = (index: number) => {
    setEditingIndex(index)
    setFormData(localCerts[index])
  }

  const handleDelete = (index: number) => {
    setLocalCerts(localCerts.filter((_, i) => i !== index))

    if (editingIndex === null) return

    if (index === editingIndex) {
      setEditingIndex(null)
      setFormData(getEmptyFormData())
      return
    }

    if (index < editingIndex) {
      setEditingIndex(editingIndex - 1)
    }
  }

  const handleSave = () => {
    onSave(localCerts)
    onOpenChange(false)
  }

  const handleCancel = () => {
    setLocalCerts(certifications)
    setEditingIndex(null)
    setFormData(getEmptyFormData())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Certifications</DialogTitle>
          <DialogDescription>
            Add, edit, or remove trainer certifications and track expiration dates
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="border rounded-lg p-4 bg-muted/30">
            <h3 className="font-semibold mb-4">
              {editingIndex !== null ? 'Edit Certification' : 'Add New Certification'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cert-name">Certification Name *</Label>
                <Input
                  id="cert-name"
                  value={formData.certificationName || ''}
                  onChange={(e) => setFormData({ ...formData, certificationName: e.target.value })}
                  placeholder="e.g., OSHA Safety Training"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="issued-date">Issued Date *</Label>
                <Input
                  id="issued-date"
                  type="date"
                  value={formData.issuedDate || ''}
                  onChange={(e) => setFormData({ ...formData, issuedDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiration-date">Expiration Date *</Label>
                <Input
                  id="expiration-date"
                  type="date"
                  value={formData.expirationDate || ''}
                  onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="renewal-required">Renewal Required</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch
                    id="renewal-required"
                    checked={formData.renewalRequired ?? true}
                    onCheckedChange={(checked) => setFormData({ ...formData, renewalRequired: checked })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {formData.renewalRequired ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="renewal-in-progress">Renewal in Progress</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch
                    id="renewal-in-progress"
                    checked={formData.renewalInProgress || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, renewalInProgress: checked })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {formData.renewalInProgress ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes about this certification..."
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button onClick={handleAdd} disabled={!formData.certificationName || !formData.issuedDate || !formData.expirationDate}>
                <Plus weight="bold" />
                {editingIndex !== null ? 'Update Certification' : 'Add Certification'}
              </Button>
              {editingIndex !== null && (
                <Button variant="outline" onClick={handleCancel}>
                  Cancel Edit
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Current Certifications ({localCerts.length})</h3>

            {localCerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                <p>No certifications added yet</p>
                <p className="text-sm mt-1">Add certifications to track expiration dates and renewal reminders</p>
              </div>
            ) : (
              <div className="space-y-2">
                {localCerts.map((cert, index) => (
                  <div
                    key={`${cert.certificationName}-${cert.issuedDate}-${index}`}
                    data-testid={`certification-item-${cert.certificationName.toLowerCase().replace(/\s+/g, '-')}-${index}`}
                    className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <p className="font-medium">{cert.certificationName}</p>
                        {cert.renewalInProgress && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                            Renewal in Progress
                          </span>
                        )}
                      </div>
                      <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                        <span>Issued: {format(new Date(cert.issuedDate), 'MMM d, yyyy')}</span>
                        <span>Expires: {format(new Date(cert.expirationDate), 'MMM d, yyyy')}</span>
                        {cert.renewalRequired && <span className="text-amber-600">Renewal Required</span>}
                      </div>
                      {cert.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{cert.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Edit certification ${cert.certificationName}`}
                        onClick={() => handleEdit(index)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        aria-label={`Delete certification ${cert.certificationName}`}
                        onClick={() => handleDelete(index)}
                      >
                        <X weight="bold" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); handleCancel(); }}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
