import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { User, UserRole, ShiftType } from '@/lib/types'
import { X } from '@phosphor-icons/react'
import { toast } from 'sonner'

function generateUserId() {
  return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Props for the {@link AddPersonDialog} component.
 */
interface AddPersonDialogProps {
  /** Whether the dialog is open. */
  open: boolean
  /** Callback to update the open state of the dialog. */
  onOpenChange: (open: boolean) => void
  /**
   * Callback invoked with the fully constructed {@link User} object when the form is saved.
   * @param user - The new user to add to the system.
   */
  onSave: (user: User) => void
  /** List of already-registered email addresses used to prevent duplicate entries. */
  existingEmails: string[]
}

/**
 * Modal dialog for adding a new person (employee, trainer, or admin) to the system.
 *
 * Provides a form with fields for name, email, role, department, badge ID, shifts, and
 * certifications. For trainers, a basic {@link TrainerProfile} is automatically scaffolded.
 * Client-side validation is performed before {@link AddPersonDialogProps.onSave} is called.
 */
export function AddPersonDialog({ open, onOpenChange, onSave, existingEmails }: AddPersonDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'employee' as UserRole,
    department: '',
    badgeId: '',
    shifts: [] as ShiftType[],
    certifications: [] as string[],
  })
  const [certificationInput, setCertificationInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleShiftToggle = (shift: ShiftType) => {
    setFormData(prev => ({
      ...prev,
      shifts: prev.shifts.includes(shift)
        ? prev.shifts.filter(s => s !== shift)
        : [...prev.shifts, shift]
    }))
  }

  const handleAddCertification = () => {
    if (certificationInput.trim() && !formData.certifications.includes(certificationInput.trim())) {
      setFormData(prev => ({
        ...prev,
        certifications: [...prev.certifications, certificationInput.trim()]
      }))
      setCertificationInput('')
    }
  }

  const handleRemoveCertification = (cert: string) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.filter(c => c !== cert)
    }))
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format'
    } else if (existingEmails.includes(formData.email.toLowerCase())) {
      newErrors.email = 'Email already exists'
    }

    if (!formData.department.trim()) {
      newErrors.department = 'Department is required'
    }

    if (formData.shifts.length === 0) {
      newErrors.shifts = 'At least one shift must be selected'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (!validateForm()) {
      toast.error('Please fix the errors before saving')
      return
    }

    const newUser: User = {
      id: generateUserId(),
      name: formData.name.trim(),
      email: formData.email.toLowerCase().trim(),
      role: formData.role,
      department: formData.department.trim(),
      badgeId: formData.badgeId.trim() || undefined,
      shifts: formData.shifts,
      certifications: formData.certifications,
      hireDate: new Date().toISOString(),
      ...(formData.role === 'trainer' && {
        trainerProfile: {
          authorizedRoles: [],
          shiftSchedules: [],
          tenure: {
            hireDate: new Date().toISOString(),
            yearsOfService: 0,
            monthsOfService: 0
          },
          specializations: formData.certifications
        }
      })
    }

    onSave(newUser)
    handleClose()
    toast.success(`${formData.name} has been added successfully`)
  }

  const handleClose = () => {
    setFormData({
      name: '',
      email: '',
      role: 'employee',
      department: '',
      badgeId: '',
      shifts: [],
      certifications: [],
    })
    setCertificationInput('')
    setErrors({})
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Person</DialogTitle>
          <DialogDescription>
            Add a new employee, trainer, or admin to the system
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="john.doe@company.com"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">
                Role <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData(prev => ({ ...prev, role: value as UserRole }))}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="trainer">Trainer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">
                Department <span className="text-destructive">*</span>
              </Label>
              <Input
                id="department"
                placeholder="Operations"
                value={formData.department}
                onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                className={errors.department ? 'border-destructive' : ''}
              />
              {errors.department && <p className="text-sm text-destructive">{errors.department}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="badgeId">Badge ID (Optional)</Label>
            <Input
              id="badgeId"
              placeholder="B12345"
              value={formData.badgeId}
              onChange={(e) => setFormData(prev => ({ ...prev, badgeId: e.target.value }))}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>
              Shifts <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="shift-day"
                  checked={formData.shifts.includes('day')}
                  onCheckedChange={() => handleShiftToggle('day')}
                />
                <Label htmlFor="shift-day" className="font-normal cursor-pointer">
                  Day
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="shift-evening"
                  checked={formData.shifts.includes('evening')}
                  onCheckedChange={() => handleShiftToggle('evening')}
                />
                <Label htmlFor="shift-evening" className="font-normal cursor-pointer">
                  Evening
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="shift-night"
                  checked={formData.shifts.includes('night')}
                  onCheckedChange={() => handleShiftToggle('night')}
                />
                <Label htmlFor="shift-night" className="font-normal cursor-pointer">
                  Night
                </Label>
              </div>
            </div>
            {errors.shifts && <p className="text-sm text-destructive">{errors.shifts}</p>}
          </div>

          <Separator />

          <div className="space-y-3">
            <Label htmlFor="certifications">Certifications</Label>
            <div className="flex gap-2">
              <Input
                id="certifications"
                placeholder="Add certification..."
                value={certificationInput}
                onChange={(e) => setCertificationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddCertification()
                  }
                }}
              />
              <Button type="button" onClick={handleAddCertification} variant="secondary">
                Add
              </Button>
            </div>
            {formData.certifications.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {formData.certifications.map((cert) => (
                  <Badge key={cert} variant="secondary" className="gap-1 pr-1">
                    {cert}
                    <button
                      type="button"
                      onClick={() => handleRemoveCertification(cert)}
                      aria-label={`Remove certification ${cert}`}
                      className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                    >
                      <X size={12} />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {formData.role === 'trainer' && (
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Trainer profile will be created automatically. You can configure their schedule and authorized roles after creation.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Add Person
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
