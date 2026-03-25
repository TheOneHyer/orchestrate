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
]

describe('enrollment-import', () => {
  it('parses newline and comma separated identifiers once', () => {
    expect(parseEnrollmentIdentifiers('stu-1, alice@example.com\nStu-1\n')).toEqual(['stu-1', 'alice@example.com'])
  })

  it('matches ids, emails, local parts, and full names', () => {
    expect(matchStudentsByIdentifiers(['stu-1', 'ben@example.com', 'alice', 'Ben Brown'], students)).toEqual({
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
})
