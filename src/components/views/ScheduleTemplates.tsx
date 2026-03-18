import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  MagnifyingGlass,
  DotsThree,
  Copy,
  PencilSimple,
  Trash,
  Play,
  Calendar,
  Clock,
  Tag,
  Repeat
} from '@phosphor-icons/react'
import { ScheduleTemplate, Course, Session } from '@/lib/types'
import { ScheduleTemplateDialog } from '@/components/ScheduleTemplateDialog'
import { ApplyTemplateDialog } from '@/components/ApplyTemplateDialog'
import { toast } from 'sonner'
import { format } from 'date-fns'

/** Props for the ScheduleTemplates component. */
interface ScheduleTemplatesProps {
  /** List of all available courses used when creating or editing a template. */
  courses: Course[]
  /** Callback to navigate to another view. @param view - Target view name. */
  onNavigate: (view: string) => void
  /** Optional callback invoked with the newly generated session stubs when a template is applied. */
  onCreateSessions?: (sessions: Partial<Session>[]) => void
}

/**
 * Renders the Schedule Templates management view.
 *
 * Allows admins to create, edit, duplicate, delete, and apply reusable training-schedule
 * templates. Templates are persisted via the Spark KV store. Applying a template opens a
 * dialog that generates concrete {@link Session} stubs and passes them to
 * `onCreateSessions`.
 */
export function ScheduleTemplates({ courses, onNavigate, onCreateSessions }: ScheduleTemplatesProps) {
  const [templates, setTemplates] = useKV<ScheduleTemplate[]>('schedule-templates', [])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedTemplate, setSelectedTemplate] = useState<ScheduleTemplate | null>(null)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [applyDialogOpen, setApplyDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ScheduleTemplate | null>(null)

  const handleCreateTemplate = (templateData: Omit<ScheduleTemplate, 'id' | 'createdAt' | 'createdBy' | 'lastUsed' | 'usageCount'>) => {
    if (editingTemplate) {
      setTemplates((current) =>
        (current || []).map((t) =>
          t.id === editingTemplate.id
            ? { ...editingTemplate, ...templateData }
            : t
        )
      )
      toast.success('Template updated successfully')
    } else {
      const newTemplate: ScheduleTemplate = {
        ...templateData,
        id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdBy: 'admin',
        createdAt: new Date().toISOString(),
        usageCount: 0
      }
      setTemplates((current) => [...(current || []), newTemplate])
      toast.success('Template created successfully')
    }
    setEditingTemplate(null)
  }

  const handleDuplicateTemplate = (template: ScheduleTemplate) => {
    const duplicatedTemplate: ScheduleTemplate = {
      ...template,
      id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${template.name} (Copy)`,
      createdAt: new Date().toISOString(),
      usageCount: 0,
      lastUsed: undefined
    }
    setTemplates((current) => [...(current || []), duplicatedTemplate])
    toast.success('Template duplicated successfully')
  }

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates((current) => (current || []).filter((t) => t.id !== templateId))
    toast.success('Template deleted')
  }

  const handleApplyTemplate = (template: ScheduleTemplate) => {
    setSelectedTemplate(template)
    setApplyDialogOpen(true)
  }

  const handleCreateSessions = (sessions: Partial<Session>[]) => {
    if (selectedTemplate) {
      setTemplates((current) =>
        (current || []).map((t) =>
          t.id === selectedTemplate.id
            ? {
              ...t,
              usageCount: t.usageCount + 1,
              lastUsed: new Date().toISOString()
            }
            : t
        )
      )
    }

    if (onCreateSessions) {
      onCreateSessions(sessions)
    }

    const sessionLabel = sessions.length === 1 ? 'session' : 'sessions'
    toast.success(`${sessions.length} ${sessionLabel} created successfully`)
    setApplyDialogOpen(false)
    setSelectedTemplate(null)
  }

  const handleEditTemplate = (template: ScheduleTemplate) => {
    setEditingTemplate(template)
    setTemplateDialogOpen(true)
  }

  const filteredTemplates = (templates || []).filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter

    return matchesSearch && matchesCategory && template.isActive
  })

  const categories = ['all', ...Array.from(new Set((templates || []).map((t) => t.category)))]

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Schedule Templates</h1>
          <p className="text-muted-foreground mt-1">Create and manage reusable training schedule templates</p>
        </div>
        <Button onClick={() => setTemplateDialogOpen(true)}>
          <Plus size={16} className="mr-2" />
          New Template
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates by name, description, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.slice(1).map((category) => (
              <SelectItem key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredTemplates.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Repeat size={32} className="text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">No Templates Found</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {searchQuery || categoryFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create your first schedule template to get started'}
              </p>
            </div>
            {!searchQuery && categoryFilter === 'all' && (
              <Button onClick={() => setTemplateDialogOpen(true)} className="mt-2">
                <Plus size={16} className="mr-2" />
                Create Template
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <Card key={template.id} data-testid={`template-card-${template.id}`} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{template.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{template.description}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <DotsThree size={20} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleApplyTemplate(template)} data-testid="dropdown-apply-template">
                        <Play size={16} className="mr-2" />
                        Apply Template
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEditTemplate(template)}>
                        <PencilSimple size={16} className="mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicateTemplate(template)}>
                        <Copy size={16} className="mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="text-destructive"
                      >
                        <Trash size={16} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{template.category}</Badge>
                  <Badge variant="outline" className="gap-1">
                    <Repeat size={12} />
                    {template.recurrenceType}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Clock size={12} />
                    {template.sessions.length} session{template.sessions.length !== 1 ? 's' : ''}
                  </Badge>
                </div>

                {template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {template.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs gap-1">
                        <Tag size={10} />
                        {tag}
                      </Badge>
                    ))}
                    {template.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{template.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    Used {template.usageCount} time{template.usageCount !== 1 ? 's' : ''}
                  </div>
                  {template.lastUsed && (
                    <div>Last: {format(new Date(template.lastUsed), 'MMM d')}</div>
                  )}
                </div>

                <Button
                  data-testid={`apply-template-${template.id}`}
                  onClick={() => handleApplyTemplate(template)}
                  className="w-full mt-2"
                >
                  <Play size={16} className="mr-2" />
                  Apply Template
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ScheduleTemplateDialog
        open={templateDialogOpen}
        onOpenChange={(open) => {
          setTemplateDialogOpen(open)
          if (!open) setEditingTemplate(null)
        }}
        template={editingTemplate}
        onSave={handleCreateTemplate}
        courses={courses}
      />

      <ApplyTemplateDialog
        open={applyDialogOpen}
        onOpenChange={setApplyDialogOpen}
        template={selectedTemplate}
        onApply={handleCreateSessions}
      />
    </div>
  )
}
