<script setup>
import { useMessageStore } from '@/stores/MessageStore.js'
import { useSettingsStore } from '@/stores/SettingsStore.js'

const messageStore = useMessageStore()
const settingsStore = useSettingsStore()

function clearHistory() {
  messageStore.messageHistory = []
}
</script>

<template>
  <div class="settings-section">
    <h3>History & Context</h3>
    <div class="group">
      <h4>Context</h4>
      <v-textarea v-model="settingsStore.context" label="Context" hide-details />
    </div>
    <div class="group">
      <div class="row">
        <h4>Recent Messages</h4>
        <v-btn size="small" variant="text" @click="clearHistory">Clear</v-btn>
      </div>
      <div class="history-list">
        <div v-if="messageStore.messageHistory.length === 0" class="empty">No messages yet</div>
        <div v-for="(msg, index) in messageStore.messageHistory.slice(-50)" :key="index" class="history-item">
          <strong>{{ msg.role }}:</strong> {{ msg.content }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-list {
  max-height: 280px;
  overflow: auto;
  border: 1px solid #e1e1e1;
  border-radius: 8px;
  padding: 10px;
  background: #fafafa;
}

.history-item {
  padding: 6px 0;
  border-bottom: 1px solid #eee;
}

.history-item:last-child {
  border-bottom: none;
}

.empty {
  color: #777;
}
</style>
