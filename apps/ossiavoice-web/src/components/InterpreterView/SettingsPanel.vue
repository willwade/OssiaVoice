<script setup>
import { useSettingsStore } from '@/stores/SettingsStore.js'
import SettingsForm from '@/components/InterpreterView/SettingsForm.vue'

const settingsStore = useSettingsStore()
</script>

<template>
  <div class="settings-panel">
    <div class="panel-header">
      <h3>Settings</h3>
      <v-btn size="small" variant="text" @click="settingsStore.showSettingsPanel = false">
        Close
      </v-btn>
    </div>
    <div class="panel-body">
      <SettingsForm />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/theme';

.settings-panel {
  background: theme.$background-muted;
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 10px;
}

.panel-body {
  overflow: auto;
  max-height: calc(100% - 40px);
}
</style>
