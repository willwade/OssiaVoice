<script setup>
import { useSettingsStore } from '@/stores/SettingsStore.js'

const settingsStore = useSettingsStore()

const themeItems = [
  { title: 'Default', value: 'default' },
  { title: 'High Contrast', value: 'high-contrast' }
]

const fontItems = [
  { title: 'Normal', value: '1' },
  { title: 'Large', value: '1.15' },
  { title: 'Extra Large', value: '1.3' }
]
</script>

<template>
  <div class="settings-section">
    <h3>Appearance</h3>
    <v-select
      v-model="settingsStore.appearanceTheme"
      :items="themeItems"
      item-title="title"
      item-value="value"
      label="Color theme"
      hide-details
      density="comfortable"
    />
    <v-select
      v-model="settingsStore.fontScale"
      :items="fontItems"
      item-title="title"
      item-value="value"
      label="Font size"
      hide-details
      density="comfortable"
    />
  </div>
</template>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
