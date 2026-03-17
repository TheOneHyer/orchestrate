import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { WorkloadRecommendations } from './WorkloadRecommendations'
import type {
  WorkloadAnalysis,
  WorkloadRecommendation,
  TrainerWorkload,
} from '@/lib/workload-balancer'
import type { User } from '@/lib/types'

function makeUser(id: string, name: string): User {
  return {
    id,
    name,
    email: `${id}@example.com`,
    role: 'trainer',
    department: 'Ops',
    certifications: [],
    hireDate: '2022-01-01T00:00:00.000Z',
  }
}

function makeWorkload(trainer: User, utilizationRate: number): TrainerWorkload {
  const totalHours = (40 * utilizationRate) / 100
  return {
    trainer,
    sessionCount: 5,
    totalHours,
    utilizationRate,
    availableHours: Math.max(0, 40 - totalHours),
    sessionsByCourse: new Map(),
    sessionsPerShift: new Map(),
  }
}

function makeRecommendation(overrides: Partial<WorkloadRecommendation> = {}): WorkloadRecommendation {
  return {
    type: 'redistribute',
    title: 'Redistribute Workload',
    description: 'Move sessions from overloaded to underutilized trainer',
    priority: 'high',
    affectedTrainers: [],
    actionable: false,
    ...overrides,
  }
}

function makeAnalysis(overrides: Partial<WorkloadAnalysis> = {}): WorkloadAnalysis {
  return {
    workloads: [],
    overutilizedTrainers: [],
    underutilizedTrainers: [],
    recommendations: [],
    balanceScore: 85,
    totalCapacity: 0,
    totalUtilization: 0,
    ...overrides,
  }
}

describe('WorkloadRecommendations', () => {
  it('shows well-balanced state when score is ≥80 and no recommendations', () => {
    render(
      <WorkloadRecommendations
        analysis={makeAnalysis()}
        users={[]}
      />
    )

    expect(screen.getByText(/workload is well balanced/i)).toBeInTheDocument()
  })

  it('shows balance score card when there are recommendations', () => {
    const analysis = makeAnalysis({
      balanceScore: 55,
      recommendations: [makeRecommendation()],
    })

    render(<WorkloadRecommendations analysis={analysis} users={[]} />)

    expect(screen.getByText(/workload balance score/i)).toBeInTheDocument()
    expect(screen.getByText('55')).toBeInTheDocument()
  })

  it('shows overutilized trainers section', () => {
    const trainer = makeUser('t-1', 'Overworked Person')
    const analysis = makeAnalysis({
      balanceScore: 40,
      overutilizedTrainers: [makeWorkload(trainer, 95)],
      recommendations: [makeRecommendation()],
    })

    render(<WorkloadRecommendations analysis={analysis} users={[trainer]} />)

    expect(screen.getByText(/overutilized trainers/i)).toBeInTheDocument()
    expect(screen.getByText('Overworked Person')).toBeInTheDocument()
  })

  it('shows underutilized trainers section', () => {
    const trainer = makeUser('t-2', 'Underused Person')
    const analysis = makeAnalysis({
      balanceScore: 50,
      underutilizedTrainers: [makeWorkload(trainer, 30)],
      recommendations: [makeRecommendation()],
    })

    render(<WorkloadRecommendations analysis={analysis} users={[trainer]} />)

    expect(screen.getByText(/underutilized trainers/i)).toBeInTheDocument()
    expect(screen.getByText('Underused Person')).toBeInTheDocument()
  })

  it('renders recommendation cards', () => {
    const analysis = makeAnalysis({
      balanceScore: 55,
      recommendations: [makeRecommendation({ title: 'Hire New Trainer', type: 'hire', priority: 'medium' })],
    })

    render(<WorkloadRecommendations analysis={analysis} users={[]} />)

    expect(screen.getByText('Hire New Trainer')).toBeInTheDocument()
    expect(screen.getByText(/medium/i)).toBeInTheDocument()
  })

  it('shows count of recommendations', () => {
    const analysis = makeAnalysis({
      balanceScore: 60,
      recommendations: [makeRecommendation(), makeRecommendation({ title: 'Other recommendation' })],
    })

    render(<WorkloadRecommendations analysis={analysis} users={[]} />)

    expect(screen.getByText(/recommendations \(2\)/i)).toBeInTheDocument()
  })

  it('calls onViewTrainer when an affected trainer button is clicked', async () => {
    const user = userEvent.setup()
    const trainer = makeUser('t-1', 'Viewed Trainer')
    const onViewTrainer = vi.fn()
    const analysis = makeAnalysis({
      balanceScore: 50,
      recommendations: [makeRecommendation({ affectedTrainers: ['t-1'] })],
    })

    render(
      <WorkloadRecommendations
        analysis={analysis}
        users={[trainer]}
        onViewTrainer={onViewTrainer}
      />
    )

    await user.click(screen.getByRole('button', { name: /viewed trainer/i }))

    expect(onViewTrainer).toHaveBeenCalledWith('t-1')
  })

  it('shows balanced/overutilized/underutilized counts', () => {
    const t1 = makeUser('t-1', 'T1')
    const t2 = makeUser('t-2', 'T2')
    const t3 = makeUser('t-3', 'T3')
    const analysis = makeAnalysis({
      balanceScore: 60,
      workloads: [makeWorkload(t1, 90), makeWorkload(t2, 50), makeWorkload(t3, 40)],
      overutilizedTrainers: [makeWorkload(t1, 90)],
      underutilizedTrainers: [makeWorkload(t3, 40)],
      recommendations: [makeRecommendation()],
    })

    render(<WorkloadRecommendations analysis={analysis} users={[t1, t2, t3]} />)

    expect(within(screen.getByTestId('overutilized-tile')).getByText('1')).toBeInTheDocument()
    expect(within(screen.getByTestId('balanced-tile')).getByText('1')).toBeInTheDocument()
    expect(within(screen.getByTestId('underutilized-tile')).getByText('1')).toBeInTheDocument()
  })

  it('renders optimize recommendation type and applies actionable recommendation', async () => {
    const user = userEvent.setup()
    const onApplyRecommendation = vi.fn()
    const recommendation = makeRecommendation({
      type: 'optimize',
      title: 'Optimize Trainer Mix',
      actionable: true,
      affectedTrainers: [],
    })

    render(
      <WorkloadRecommendations
        analysis={makeAnalysis({
          balanceScore: 58,
          recommendations: [recommendation],
        })}
        users={[]}
        onApplyRecommendation={onApplyRecommendation}
      />
    )

    expect(screen.getByText('Optimize Trainer Mix')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /view details/i }))
    expect(onApplyRecommendation).toHaveBeenCalledWith(recommendation)
  })

  it('calls onViewTrainer from overutilized and underutilized trainer cards', async () => {
    const user = userEvent.setup()
    const over = makeUser('over-1', 'Over One')
    const under = makeUser('under-1', 'Under One')
    const onViewTrainer = vi.fn()

    render(
      <WorkloadRecommendations
        analysis={makeAnalysis({
          balanceScore: 55,
          recommendations: [makeRecommendation()],
          overutilizedTrainers: [makeWorkload(over, 92)],
          underutilizedTrainers: [makeWorkload(under, 45)],
        })}
        users={[over, under]}
        onViewTrainer={onViewTrainer}
      />
    )

    await user.click(screen.getByRole('button', { name: /over one/i }))
    await user.click(screen.getByRole('button', { name: /under one/i }))

    expect(onViewTrainer).toHaveBeenCalledWith('over-1')
    expect(onViewTrainer).toHaveBeenCalledWith('under-1')
  })

  it('renders low-priority reduce recommendations', () => {
    const analysis = makeAnalysis({
      balanceScore: 52,
      recommendations: [makeRecommendation({
        type: 'reduce',
        title: 'Reduce Session Load',
        priority: 'low',
      })],
    })

    render(<WorkloadRecommendations analysis={analysis} users={[]} />)

    expect(screen.getByText('Reduce Session Load')).toBeInTheDocument()
    expect(screen.getByText(/^low$/i)).toBeInTheDocument()
  })
})
