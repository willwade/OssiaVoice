import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import InterpreterView from '@/views/InterpreterView.vue'
import { usePartnerStore } from '@/stores/PartnerStore.js'
import { useMessageStore } from '@/stores/MessageStore.js'

vi.mock('@/repositories/TextToSpeechRepository.js', () => ({}))

const stubComponent = {
  template: '<div><slot /></div>'
}

describe('InterpreterView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('ingests partner final transcript into history', () => {
    const partnerStore = usePartnerStore()
    const messageStore = useMessageStore()

    const connectMock = vi.fn((handler) => {
      handler({
        type: 'final_transcript',
        participantId: 'p1',
        deviceId: 'd1',
        text: 'Hello there'
      })
    })

    partnerStore.sessionId = 'session-1'
    partnerStore.connect = connectMock
    partnerStore.getDisplayName = () => 'Susa'
    partnerStore.setLiveDraft = vi.fn()
    messageStore.generateWords = vi.fn()
    messageStore.generateSentences = vi.fn()

    mount(InterpreterView, {
      global: {
        stubs: {
          'v-overlay': stubComponent,
          'v-progress-linear': stubComponent,
          InterlocutorPanel: stubComponent,
          MessageHistory: stubComponent,
          MessageBuilder: stubComponent,
          MessageOptions: stubComponent,
          SettingsOverlay: stubComponent,
          ErrorHandling: stubComponent
        }
      }
    })

    expect(connectMock).toHaveBeenCalled()
    expect(messageStore.messageHistory[0].content).toBe('Susa: Hello there')
    expect(messageStore.generateWords).toHaveBeenCalled()
    expect(messageStore.generateSentences).toHaveBeenCalled()
  })
})
