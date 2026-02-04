<script setup>
import { useSettingsStore } from '@/stores/SettingsStore.js'
import { onMounted, ref } from 'vue'

const settingsStore = useSettingsStore()
const availableVoices = ref([])

onMounted(() => {
  if (window.speechSynthesis) {
    const loadVoices = () => {
      availableVoices.value = window.speechSynthesis.getVoices()
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
  }
})
</script>

<template>
  <div class="settings-section">
    <h3>Text to Speech</h3>
    <v-switch v-model="settingsStore.ttsEnabled" label="Enable speech output" color="primary" />
    <v-select
      v-model="settingsStore.ttsVoice"
      :items="availableVoices"
      item-title="name"
      item-value="name"
      label="Voice"
      hide-details
      density="comfortable"
    />
    <div class="slider-row">
      <v-slider v-model="settingsStore.ttsRate" min="0.5" max="2" step="0.1" label="Rate" />
      <v-slider v-model="settingsStore.ttsPitch" min="0" max="2" step="0.1" label="Pitch" />
      <v-slider v-model="settingsStore.ttsVolume" min="0" max="1" step="0.1" label="Volume" />
    </div>
  </div>
</template>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.slider-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 800px) {
  .slider-row {
    grid-template-columns: 1fr;
  }
}
</style>
