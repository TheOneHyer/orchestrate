import { hashPassword, verifyPassword } from './auth-utils'

describe('hashPassword', () => {
  it('returns a 64-character hex string for a given password', async () => {
    const hash = await hashPassword('password123')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it('returns the same hash for the same input', async () => {
    const hash1 = await hashPassword('password123')
    const hash2 = await hashPassword('password123')
    expect(hash1).toBe(hash2)
  })

  it('returns different hashes for different passwords', async () => {
    const hash1 = await hashPassword('password123')
    const hash2 = await hashPassword('different-password')
    expect(hash1).not.toBe(hash2)
  })

  it('handles an empty string without throwing', async () => {
    const hash = await hashPassword('')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it('is case-sensitive', async () => {
    const lower = await hashPassword('Password123')
    const upper = await hashPassword('password123')
    expect(lower).not.toBe(upper)
  })

  it('produces the expected SHA-256 digest for a known input', async () => {
    // SHA-256('password123') = ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f
    const hash = await hashPassword('password123')
    expect(hash).toBe('ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f')
  })
})

describe('verifyPassword', () => {
  it('returns true when the password matches the stored hash', async () => {
    const hash = await hashPassword('my-secret')
    expect(await verifyPassword('my-secret', hash)).toBe(true)
  })

  it('returns false when the password does not match the stored hash', async () => {
    const hash = await hashPassword('my-secret')
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })

  it('returns false when the stored hash is an empty string', async () => {
    expect(await verifyPassword('password', '')).toBe(false)
  })

  it('is case-sensitive for the password input', async () => {
    const hash = await hashPassword('Password123')
    expect(await verifyPassword('password123', hash)).toBe(false)
  })

  it('returns true for an empty password hashed and verified against itself', async () => {
    const hash = await hashPassword('')
    expect(await verifyPassword('', hash)).toBe(true)
  })
})
