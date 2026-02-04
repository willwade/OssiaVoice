import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import PartnerContext from '@/components/InterpreterView/PartnerContext.vue'
import { usePartnerStore } from '@/stores/PartnerStore.js'

const VSelect = {
  props: ['modelValue', 'items'],
  emits: ['update:modelValue'],
  template: '<select @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in items" :key="item.participantId" :value="item.participantId">{{ item.displayName }}</option></select>'
}

const VTextField = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
}

const VTextarea = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)"></textarea>'
}

const VBtn = {
  emits: ['click'],
  template: '<button @click="$emit(\'click\')"><slot /></button>'
}

describe('PartnerContext', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('saves notes for a participant', async () => {
    const store = usePartnerStore()
    store.participants = [{ participantId: 'p1', displayName: 'Susa' }]

    const wrapper = mount(PartnerContext, {
      global: {
        stubs: {
          'v-select': VSelect,
          'v-text-field': VTextField,
          'v-textarea': VTextarea,
          'v-btn': VBtn
        }
      }
    })

    await wrapper.find('select').setValue('p1')
    await wrapper.find('textarea').setValue('Notes here')

    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click')

    expect(store.participantContext.p1.notes).toBe('Notes here')
  })

  it('adds and removes relationships', async () => {
    const store = usePartnerStore()
    store.participants = [{ participantId: 'p1', displayName: 'Susa' }]

    const wrapper = mount(PartnerContext, {
      global: {
        stubs: {
          'v-select': VSelect,
          'v-text-field': VTextField,
          'v-textarea': VTextarea,
          'v-btn': VBtn
        }
      }
    })

    await wrapper.find('select').setValue('p1')
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('Carer')
    await inputs[1].setValue('family')
    await inputs[2].setValue('0.7')

    const buttons = wrapper.findAll('button')
    const addButton = buttons.find((btn) => btn.text() === 'Add')
    await addButton.trigger('click')

    expect(store.participantContext.p1.relationships.length).toBe(1)

    const removeButton = wrapper.findAll('button').find((btn) => btn.text() === 'Remove')
    await removeButton.trigger('click')

    expect(store.participantContext.p1.relationships.length).toBe(0)
  })
})
