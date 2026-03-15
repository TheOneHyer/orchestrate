import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { User, CertificationRecord } from '@/lib/types'
import { Plus } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface AddCertificationDialogProps {
  users: User[]
  onAddCertification: (trainerIds: string[], certification: Omit<CertificationRecord, 'status' | 'renewalRequired' | 'remindersSent'>) => void
}

export function AddCertificationDialog({ users, onAddCertification }: AddCertificationDialogProps) {
  const [open, setOpen] = useState(false)
  const [certificationName, setCertificationName] = useState('')
  const [issuedDate, setIssuedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [expirationDate, setExpirationDate] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedTrainers, setSelectedTrainers] = useState<string[]>([])

  const trainers = users.filter(u => u.role === 'trainer')

  const handleToggleTrainer = (trainerId: string) => {
    setSelectedTrainers(prev =>
      prev.includes(trainerId)
        ? prev.filter(id => id !== trainerId)
        : [...prev, trainerId]
    )
  }

  const handleSelectAll = () => {
    if (selectedTrainers.length === trainers.length) {
      setSelectedTrainers([])
    } else {
      setSelectedTrainers(trainers.map(t => t.id))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!certificationName.trim()) {
      toast.error('Please enter a certification name')
      return
    }

    if (!expirationDate) {
      toast.error('Please select an expiration date')
      return
    }

    if (selectedTrainers.length === 0) {
      toast.error('Please select at least one trainer')
      return
    }

    const newCertification: Omit<CertificationRecord, 'status' | 'renewalRequired' | 'remindersSent'> = {
      certificationName: certificationName.trim(),
      issuedDate,
      expirationDate,
      notes: notes.trim() || undefined
    }

    onAddCertification(selectedTrainers, newCertification)

    toast.success(`Certification added to ${selectedTrainers.length} trainer${selectedTrainers.length !== 1 ? 's' : ''}`)

    setCertificationName('')
    setIssuedDate(format(new Date(), 'yyyy-MM-dd'))
    setExpirationDate('')
    setNotes('')
    setSelectedTrainers([])
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus size={20} weight="bold" />
          Add Certification
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Certification</DialogTitle>
          <DialogDescription>
            Add a certification record to one or more trainers
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="cert-name">Certification Name</Label>
              <Input
                id="cert-name"
                value={certificationName}
                onChange={(e) => setCertificationName(e.target.value)}
                placeholder="e.g., CPR Certification, Safety Training"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="issued-date">Issued Date</Label>
                <Input
                  id="issued-date"
                  type="date"
                  value={issuedDate}
                  onChange={(e) => setIssuedDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="expiration-date">Expiration Date</Label>
                <Input
                  id="expiration-date"
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  min={issuedDate}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional information about this certification"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <Label>Select Trainers</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedTrainers.length === trainers.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            {trainers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No trainers found</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-4">
                {trainers.map(trainer => (
                  <div
                    key={trainer.id}
                    className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-md transition-colors"
                  >
                    <Checkbox
                      id={`trainer-${trainer.id}`}
                      checked={selectedTrainers.includes(trainer.id)}
                      onCheckedChange={() => handleToggleTrainer(trainer.id)}
                    />
                    <label
                      htmlFor={`trainer-${trainer.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <p className="font-medium">{trainer.name}</p>
                      <p className="text-sm text-muted-foreground">{trainer.email}</p>
                    </label>
                  </div>
                ))}
              </div>
            )}

            {selectedTrainers.length > 0 && (
              <p className="text-sm text-muted-foreground mt-3">
                {selectedTrainers.length} trainer{selectedTrainers.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Add Certification
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
