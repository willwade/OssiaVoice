<script setup>
import { computed, ref } from 'vue'
import { useSettingsStore } from '@/stores/SettingsStore.js'
import SettingsKeyConsent from '@/components/InterpreterView/SettingsKeyConsent.vue'
import SettingsTts from '@/components/InterpreterView/SettingsTts.vue'
import SettingsPartner from '@/components/InterpreterView/SettingsPartner.vue'
import SettingsHistory from '@/components/InterpreterView/SettingsHistory.vue'
import SettingsLayout from '@/components/InterpreterView/SettingsLayout.vue'

const settingsStore = useSettingsStore()
const tab = ref('key')

const tabItems = [
  { title: 'Key & Consent', value: 'key' },
  { title: 'TTS', value: 'tts' },
  { title: 'Partner', value: 'partner' },
  { title: 'History', value: 'history' },
  { title: 'Layout', value: 'layout' }
]

const isSmall = computed(() => window.innerWidth < 700)
</script>

<template>
  <div class="settings-screen">
    <div class="header">
      <h2>Settings</h2>
      <div class="header-actions">
        <v-btn size="small" variant="text" @click="settingsStore.save">Save</v-btn>
        <v-btn size="small" variant="text" @click="settingsStore.showSettingsPanel = false">Close</v-btn>
      </div>
    </div>

    <div class="tab-bar" v-if="!isSmall">
      <v-tabs v-model="tab" color="primary" align-tabs="start">
        <v-tab v-for="item in tabItems" :key="item.value" :value="item.value">
          {{ item.title }}
        </v-tab>
      </v-tabs>
    </div>

    <div class="tab-dropdown" v-else>
      <v-select
        v-model="tab"
        :items="tabItems"
        item-title="title"
        item-value="value"
        label="Settings area"
        hide-details
        density="comfortable"
      />
    </div>

    <div class="tab-content">
      <div v-show="tab === 'key'">
        <SettingsKeyConsent />
      </div>
      <div v-show="tab === 'tts'">
        <SettingsTts />
      </div>
      <div v-show="tab === 'partner'">
        <SettingsPartner />
      </div>
      <div v-show="tab === 'history'">
        <SettingsHistory />
      </div>
      <div v-show="tab === 'layout'">
        <SettingsLayout />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/theme';

.settings-screen {
  width: 100%;
  height: 100%;
  background: theme.$background-muted;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.tab-bar {
  border-bottom: 1px solid #e0e0e0;
}

.tab-content {
  flex: 1;
  overflow: auto;
}
</style>
