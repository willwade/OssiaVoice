<script setup>
import { useSettingsStore } from '@/stores/SettingsStore.js'

const settingsStore = useSettingsStore()
</script>

<template>
  <div class="settings-section">
    <h3>Layout</h3>
    <v-switch
      v-model="settingsStore.compactInterlocutorPanel"
      label="Compact left panel"
      color="primary"
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
