import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/repositories/ChatCompletionRepository.js', () => ({
  getResponse: vi.fn()
}))

import { getResponse } from '@/repositories/ChatCompletionRepository.js'
import { useMessageStore } from '@/stores/MessageStore.js'

describe('MessageStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('generates sentence suggestions', async () => {
    getResponse.mockResolvedValueOnce(['Hello', 'Hi'])
    const store = useMessageStore()

    store.messageHistory.push({ role: 'user', content: 'Hello' })
    await store.generateSentences()

    expect(store.sentenceSuggestions).toEqual(['Hello', 'Hi'])
    expect(store.activeEditHistory.length).toBe(2)
    expect(getResponse).toHaveBeenCalledOnce()
  })

  it('generates word suggestions', async () => {
    getResponse.mockResolvedValueOnce(['test', 'word'])
    const store = useMessageStore()

    store.messageHistory.push({ role: 'user', content: 'Hello' })
    await store.generateWords()

    expect(store.wordSuggestions).toEqual(['test', 'word'])
    expect(getResponse).toHaveBeenCalledOnce()
  })
})
