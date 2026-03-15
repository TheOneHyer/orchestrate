import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { MoodLevel, StressLevel, EnergyLevel, WellnessCheckIn } from '@/lib/types'
import { 
  Smiley, 
  SmileyMeh, 
  SmileyNervous, 
  SmileySad,
  Lightning,
  BatteryHigh,
  BatteryMedium,
  BatteryLow,
  BatteryWarning,
  Heart
} from '@phosphor-icons/react'

interface WellnessCheckInDialogProps {
  open: boolean
  onClose: () => void
  trainerId: string
  trainerName: string
  onSubmit: (checkIn: Omit<WellnessCheckIn, 'id' | 'timestamp'>) => void
  currentUtilization?: number
}

const COMMON_CONCERNS = [
  'Too many sessions scheduled',
  'Insufficient preparation time',
  'Challenging student behaviors',
  'Lack of administrative support',
  'Unclear expectations',
  'Technology issues',
  'Personal/family stress',
  'Physical health concerns',
  'Sleep difficulties',
  'Work-life balance'
]

export function WellnessCheckInDialog({
  open,
  onClose,
  trainerId,
  trainerName,
  onSubmit,
  currentUtilization
}: WellnessCheckInDialogProps) {
  const [mood, setMood] = useState<MoodLevel>(3)
  const [stress, setStress] = useState<StressLevel>('moderate')
  const [energy, setEnergy] = useState<EnergyLevel>('neutral')
  const [workloadSatisfaction, setWorkloadSatisfaction] = useState<MoodLevel>(3)
  const [sleepQuality, setSleepQuality] = useState<MoodLevel>(3)
  const [physicalWellbeing, setPhysicalWellbeing] = useState<MoodLevel>(3)
  const [mentalClarity, setMentalClarity] = useState<MoodLevel>(3)
  const [comments, setComments] = useState('')
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>([])
  const [followUpRequired, setFollowUpRequired] = useState(false)

  const handleSubmit = () => {
    const checkIn: Omit<WellnessCheckIn, 'id' | 'timestamp'> = {
      trainerId,
      mood,
      stress,
      energy,
      workloadSatisfaction,
      sleepQuality,
      physicalWellbeing,
      mentalClarity,
      comments: comments.trim() || undefined,
      concerns: selectedConcerns.length > 0 ? selectedConcerns : undefined,
      followUpRequired,
      utilizationAtCheckIn: currentUtilization
    }

    onSubmit(checkIn)
    handleClose()
  }

  const handleClose = () => {
    setMood(3)
    setStress('moderate')
    setEnergy('neutral')
    setWorkloadSatisfaction(3)
    setSleepQuality(3)
    setPhysicalWellbeing(3)
    setMentalClarity(3)
    setComments('')
    setSelectedConcerns([])
    setFollowUpRequired(false)
    onClose()
  }

  const toggleConcern = (concern: string) => {
    setSelectedConcerns(prev =>
      prev.includes(concern)
        ? prev.filter(c => c !== concern)
        : [...prev, concern]
    )
  }

  const getMoodIcon = (value: MoodLevel) => {
    switch (value) {
      case 5: return <Smiley size={32} weight="fill" className="text-green-500" />
      case 4: return <Smiley size={32} weight="regular" className="text-green-400" />
      case 3: return <SmileyMeh size={32} weight="regular" className="text-yellow-500" />
      case 2: return <SmileyNervous size={32} weight="regular" className="text-orange-500" />
      case 1: return <SmileySad size={32} weight="fill" className="text-destructive" />
    }
  }

  const getEnergyIcon = () => {
    switch (energy) {
      case 'excellent': return <Lightning size={24} weight="fill" className="text-green-500" />
      case 'energized': return <BatteryHigh size={24} weight="fill" className="text-green-400" />
      case 'neutral': return <BatteryMedium size={24} weight="regular" className="text-yellow-500" />
      case 'tired': return <BatteryLow size={24} weight="regular" className="text-orange-500" />
      case 'exhausted': return <BatteryWarning size={24} weight="fill" className="text-destructive" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Heart weight="fill" className="text-accent" />
            Wellness Check-In: {trainerName}
          </DialogTitle>
          <DialogDescription>
            This check-in helps us understand your wellbeing and provide appropriate support.
            Your responses are confidential and used to improve your work experience.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Overall Mood</Label>
              {getMoodIcon(mood)}
            </div>
            <Slider
              value={[mood]}
              onValueChange={([value]) => setMood(value as MoodLevel)}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Very Poor</span>
              <span>Poor</span>
              <span>Neutral</span>
              <span>Good</span>
              <span>Excellent</span>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Stress Level</Label>
            <RadioGroup value={stress} onValueChange={(v) => setStress(v as StressLevel)}>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="low" id="stress-low" />
                  <Label htmlFor="stress-low" className="cursor-pointer flex-1">Low - Manageable</Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="moderate" id="stress-moderate" />
                  <Label htmlFor="stress-moderate" className="cursor-pointer flex-1">Moderate</Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="high" id="stress-high" />
                  <Label htmlFor="stress-high" className="cursor-pointer flex-1">High - Concerning</Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="critical" id="stress-critical" />
                  <Label htmlFor="stress-critical" className="cursor-pointer flex-1">Critical - Urgent</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Energy Level</Label>
              {getEnergyIcon()}
            </div>
            <RadioGroup value={energy} onValueChange={(v) => setEnergy(v as EnergyLevel)}>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="exhausted" id="energy-exhausted" />
                  <Label htmlFor="energy-exhausted" className="cursor-pointer flex-1">Exhausted</Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="tired" id="energy-tired" />
                  <Label htmlFor="energy-tired" className="cursor-pointer flex-1">Tired</Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="neutral" id="energy-neutral" />
                  <Label htmlFor="energy-neutral" className="cursor-pointer flex-1">Neutral</Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="energized" id="energy-energized" />
                  <Label htmlFor="energy-energized" className="cursor-pointer flex-1">Energized</Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer col-span-2">
                  <RadioGroupItem value="excellent" id="energy-excellent" />
                  <Label htmlFor="energy-excellent" className="cursor-pointer flex-1">Excellent</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Workload Satisfaction</Label>
              <Slider
                value={[workloadSatisfaction]}
                onValueChange={([value]) => setWorkloadSatisfaction(value as MoodLevel)}
                min={1}
                max={5}
                step={1}
              />
              <div className="text-xs text-muted-foreground text-center">
                {workloadSatisfaction}/5
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sleep Quality</Label>
              <Slider
                value={[sleepQuality]}
                onValueChange={([value]) => setSleepQuality(value as MoodLevel)}
                min={1}
                max={5}
                step={1}
              />
              <div className="text-xs text-muted-foreground text-center">
                {sleepQuality}/5
              </div>
            </div>

            <div className="space-y-2">
              <Label>Physical Wellbeing</Label>
              <Slider
                value={[physicalWellbeing]}
                onValueChange={([value]) => setPhysicalWellbeing(value as MoodLevel)}
                min={1}
                max={5}
                step={1}
              />
              <div className="text-xs text-muted-foreground text-center">
                {physicalWellbeing}/5
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mental Clarity</Label>
              <Slider
                value={[mentalClarity]}
                onValueChange={([value]) => setMentalClarity(value as MoodLevel)}
                min={1}
                max={5}
                step={1}
              />
              <div className="text-xs text-muted-foreground text-center">
                {mentalClarity}/5
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Current Concerns (Select all that apply)</Label>
            <div className="grid grid-cols-2 gap-2">
              {COMMON_CONCERNS.map(concern => (
                <div
                  key={concern}
                  className="flex items-center space-x-2 border rounded p-2 hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleConcern(concern)}
                >
                  <Checkbox
                    id={concern}
                    checked={selectedConcerns.includes(concern)}
                    onCheckedChange={() => toggleConcern(concern)}
                  />
                  <Label htmlFor={concern} className="text-sm cursor-pointer flex-1">
                    {concern}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comments">Additional Comments (Optional)</Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Share any additional thoughts, concerns, or suggestions..."
              rows={4}
            />
          </div>

          <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/30">
            <Checkbox
              id="follow-up"
              checked={followUpRequired}
              onCheckedChange={(checked) => setFollowUpRequired(checked === true)}
            />
            <Label htmlFor="follow-up" className="cursor-pointer flex-1">
              I would like to discuss these concerns with a manager or HR representative
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Submit Check-In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
