<script setup>
import { useSettingsStore } from '@/stores/SettingsStore.js'

const settingsStore = useSettingsStore()
</script>

<template>
  <div class="settings-section">
    <h3>Layout</h3>
    <div class="row">
      <v-select
        v-model="settingsStore.topPanelEmphasis"
        :items="['balanced','interlocutor','history']"
        label="Top panel emphasis"
        hide-details
        density="comfortable"
      />
      <v-select
        v-model="settingsStore.bottomPanelEmphasis"
        :items="['balanced','builder','options']"
        label="Bottom panel emphasis"
        hide-details
        density="comfortable"
      />
    </div>
    <v-switch v-model="settingsStore.compactInterlocutorPanel" label="Compact interlocutor panel" color="primary" />
    <v-switch v-model="settingsStore.compactMessageHistory" label="Compact message history" color="primary" />
    <v-switch v-model="settingsStore.compactMessageBuilder" label="Compact message builder" color="primary" />
    <v-switch v-model="settingsStore.compactMessageOptions" label="Compact message options" color="primary" />
  </div>
</template>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 800px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>
