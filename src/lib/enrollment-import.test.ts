import { describe, expect, it } from 'vitest'

import { matchStudentsByIdentifiers, parseEnrollmentIdentifiers } from './enrollment-import'
import type { User } from './types'

const students: User[] = [
  {
    id: 'stu-1',
    name: 'Alice Adams',
    email: 'alice@example.com',
    role: 'employee',
    department: 'Ops',
    certifications: [],
    hireDate: '2025-01-01',
  },
  {
    id: 'stu-2',
    name: 'Ben Brown',
    email: 'ben@example.com',
    role: 'employee',
    department: 'HR',
    certifications: [],
    hireDate: '2025-01-01',
  },
  {
    id: 'stu-3',
    name: 'Ben Brown',
    email: 'ben.secondary@example.com',
    role: 'employee',
    department: 'HR',
    certifications: [],
    hireDate: '2025-01-01',
  },
  {
    id: 'stu-4',
    name: 'Alex One',
    email: 'alex@ops.example.com',
    role: 'employee',
    department: 'Ops',
    certifications: [],
    hireDate: '2025-01-01',
  },
  {
    id: 'stu-5',
    name: 'Alex Two',
    email: 'alex@hr.example.com',
    role: 'employee',
    department: 'HR',
    certifications: [],
    hireDate: '2025-01-01',
  },
]

describe('enrollment-import', () => {
  it('parses newline and comma separated identifiers once', () => {
    expect(parseEnrollmentIdentifiers('stu-1, alice@example.com\nStu-1\n')).toEqual(['stu-1', 'alice@example.com'])
  })

  it('matches ids, emails, and local parts', () => {
    expect(matchStudentsByIdentifiers(['stu-1', 'ben@example.com', 'alice'], students)).toEqual({
      matchedIds: ['stu-1', 'stu-2'],
      unmatched: [],
    })
  })

  it('returns unmatched identifiers when no student can be resolved', () => {
    expect(matchStudentsByIdentifiers(['unknown', 'alice@example.com'], students)).toEqual({
      matchedIds: ['stu-1'],
      unmatched: ['unknown'],
    })
  })

  it('suppresses duplicate matches when multiple identifiers resolve to the same student', () => {
    expect(matchStudentsByIdentifiers(['stu-1', 'alice@example.com', 'unknown'], students)).toEqual({
      matchedIds: ['stu-1'],
      unmatched: ['unknown'],
    })
  })

  it('treats ambiguous full-name or email-local-part identifiers as unmatched', () => {
    const identifiers = parseEnrollmentIdentifiers('Ben Brown\nalex\n')

    expect(matchStudentsByIdentifiers(identifiers, students)).toEqual({
      matchedIds: [],
      unmatched: ['Ben Brown', 'alex'],
    })
  })

  it('matches a student via email local-part when not already in the matched set', () => {
    expect(matchStudentsByIdentifiers(['alice'], students)).toEqual({
      matchedIds: ['stu-1'],
      unmatched: [],
    })
  })

  it('applies first-match-wins semantics when two students share the same id', () => {
    const duplicateIdStudents: User[] = [
      { id: 'stu-1', name: 'Alice Adams', email: 'alice@example.com', role: 'employee', department: 'Ops', certifications: [], hireDate: '2025-01-01' },
      { id: 'stu-1', name: 'Alice Clone', email: 'alice-clone@example.com', role: 'employee', department: 'Ops', certifications: [], hireDate: '2025-01-01' },
    ]
    expect(matchStudentsByIdentifiers(['stu-1'], duplicateIdStudents)).toEqual({
      matchedIds: ['stu-1'],
      unmatched: [],
    })
  })

  it('applies first-match-wins semantics when two students share the same email', () => {
    const duplicateEmailStudents: User[] = [
      { id: 'stu-1', name: 'Alice Adams', email: 'shared@example.com', role: 'employee', department: 'Ops', certifications: [], hireDate: '2025-01-01' },
      { id: 'stu-2', name: 'Bob Brown', email: 'shared@example.com', role: 'employee', department: 'HR', certifications: [], hireDate: '2025-01-01' },
    ]
    expect(matchStudentsByIdentifiers(['shared@example.com'], duplicateEmailStudents)).toEqual({
      matchedIds: ['stu-1'],
      unmatched: [],
    })
  })
})
