import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePartnerStore } from '@/stores/PartnerStore.js'

function mockFetchSequence(responses) {
  const fetchMock = vi.fn()
  responses.forEach((response) => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => response,
      text: async () => JSON.stringify(response)
    })
  })
  return fetchMock
}

describe('PartnerStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('registers an owner when missing', async () => {
    const fetchMock = mockFetchSequence([{ ownerId: 'owner-1', ownerSecret: 'secret-1' }])
    vi.stubGlobal('fetch', fetchMock)

    const store = usePartnerStore()
    await store.ensureOwner()

    expect(store.ownerId).toBe('owner-1')
    expect(store.ownerSecret).toBe('secret-1')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('issues an enroll token and records participant', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ enrollToken: 'token-123', expiresIn: 600 }),
      text: async () => ''
    })
    vi.stubGlobal('fetch', fetchMock)

    const store = usePartnerStore()
    store.ownerId = 'owner-1'
    store.ownerSecret = 'secret-1'
    store.sessionId = 'session-1'

    const payload = await store.issueEnrollToken('Susa')

    expect(payload.enrollToken).toBe('token-123')
    expect(payload.sessionId).toBe('session-1')
    expect(store.participants.length).toBe(1)
    expect(store.participants[0].displayName).toBe('Susa')
    expect(store.pendingPairings.length).toBe(1)
  })

  it('updates participant context and persists', () => {
    const store = usePartnerStore()
    store.updateParticipantContext('p1', { notes: 'Friend', relationships: [] })

    expect(store.participantContext.p1.notes).toBe('Friend')
    const persisted = JSON.parse(localStorage.getItem('partnerContext'))
    expect(persisted.p1.notes).toBe('Friend')
  })
})
