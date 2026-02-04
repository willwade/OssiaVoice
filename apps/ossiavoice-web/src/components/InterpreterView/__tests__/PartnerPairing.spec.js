import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import PartnerPairing from '@/components/InterpreterView/PartnerPairing.vue'
import { usePartnerStore } from '@/stores/PartnerStore.js'

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(async () => 'data:image/png;base64,QR')
  }
}))

const VTextField = {
  props: ['modelValue', 'label'],
  emits: ['update:modelValue'],
  template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
}

const VBtn = {
  props: ['loading'],
  emits: ['click'],
  template: '<button @click="$emit(\'click\')"><slot /></button>'
}

describe('PartnerPairing', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders participants and devices', () => {
    const store = usePartnerStore()
    store.participants = [{ participantId: 'p1', displayName: 'Susa' }]
    store.devices = [{ deviceId: 'd1', displayName: 'Device 1' }]

    const wrapper = mount(PartnerPairing, {
      global: {
        stubs: { 'v-text-field': VTextField, 'v-btn': VBtn }
      }
    })

    expect(wrapper.text()).toContain('Susa')
    expect(wrapper.text()).toContain('Device 1')
  })

  it('creates pairing payload and shows QR', async () => {
    const store = usePartnerStore()
    store.issueEnrollToken = vi.fn(async () => ({
      relayBaseUrl: 'http://localhost:8787',
      enrollToken: 'token-1',
      sessionId: 'session-1'
    }))

    const wrapper = mount(PartnerPairing, {
      global: {
        stubs: { 'v-text-field': VTextField, 'v-btn': VBtn }
      }
    })

    const buttons = wrapper.findAll('button')
    const generateButton = buttons.find((btn) => btn.text() === 'Generate QR')
    await generateButton.trigger('click')
    await wrapper.vm.$nextTick()

    expect(store.issueEnrollToken).toHaveBeenCalled()
    expect(wrapper.find('img').exists()).toBe(true)
    expect(wrapper.text()).toContain('token-1')
  })
})
