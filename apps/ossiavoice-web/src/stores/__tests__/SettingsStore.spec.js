import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from '@/stores/SettingsStore.js'

describe('SettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('saves settings when agreements are accepted', () => {
    const store = useSettingsStore()
    store.openAIAPIKey = 'sk-test'
    store.backstory = 'Backstory'
    store.context = 'Context'
    store.liabilityAgreement = true
    store.cookieAgreement = true

    store.save()

    expect(localStorage.getItem('openAIAPIKey')).toBe('sk-test')
    expect(localStorage.getItem('backstory')).toBe('Backstory')
    expect(localStorage.getItem('context')).toBe('Context')
    expect(store.showSettingsWarning).toBe(false)
  })

  it('blocks save when agreements are missing', () => {
    const store = useSettingsStore()
    store.openAIAPIKey = 'sk-test'
    store.backstory = 'Backstory'
    store.context = 'Context'
    store.liabilityAgreement = false
    store.cookieAgreement = false

    store.save()

    expect(store.showSettingsOverlay).toBe(true)
    expect(store.showSettingsWarning).toBe(true)
    expect(localStorage.getItem('openAIAPIKey')).toBeNull()
  })
})
