<script setup>
import { onMounted, ref } from 'vue'
import { useMessageStore } from '@/stores/MessageStore.js'
import { useBoardStore } from '@/stores/BoardStore.js'
import { BoardViewer } from 'aac-board-viewer/vue'
import { configureBrowserSqlJs, loadAACFile } from 'aac-board-viewer'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import 'aac-board-viewer/styles'

const messageStore = useMessageStore()
const boardStore = useBoardStore()
const tree = ref(null)
const loading = ref(false)
const errorMessage = ref('')
let sqlConfigured = false

function ensureSqlConfigured() {
  if (sqlConfigured) return
  configureBrowserSqlJs({
    locateFile: () => sqlWasmUrl
  })
  sqlConfigured = true
}

async function loadDefault() {
  try {
    loading.value = true
    errorMessage.value = ''
    ensureSqlConfigured()
    const response = await fetch('/aac/Aphasia_Duo_16.gridset')
    const blob = await response.blob()
    const file = new File([blob], 'Aphasia_Duo_16.gridset')
    const loaded = await loadAACFile(file)
    tree.value = loaded
    await boardStore.setTree(loaded, file.name)
  } catch (error) {
    errorMessage.value = error?.message || 'Failed to load grid'
  } finally {
    loading.value = false
  }
}

async function handleFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    loading.value = true
    errorMessage.value = ''
    ensureSqlConfigured()
    const loaded = await loadAACFile(file)
    tree.value = loaded
    await boardStore.setTree(loaded, file.name)
  } catch (error) {
    errorMessage.value = error?.message || 'Failed to load grid'
  } finally {
    loading.value = false
  }
}

function handleButtonClick(button) {
  if (!button?.label) return
  messageStore.scriberPhrase = `${messageStore.scriberPhrase || ''}${messageStore.scriberPhrase ? ' ' : ''}${button.label}`
}

function clearBoard() {
  boardStore.clearTree()
  tree.value = null
}

onMounted(() => {
  if (typeof boardStore.loadTree === 'function') {
    boardStore.loadTree().then((stored) => {
      tree.value = stored
      if (!tree.value) loadDefault()
    })
  } else {
    loadDefault()
  }
})
</script>

<template>
  <div class="grid-wrapper">
    <div class="grid-toolbar">
      <label class="file-label">
        Load AAC file
        <input type="file" class="file-input" @change="handleFileChange" />
      </label>
      <v-btn size="small" variant="text" @click="clearBoard" v-if="tree">Clear</v-btn>
      <span v-if="boardStore.name" class="file-name">{{ boardStore.name }}</span>
      <v-btn size="small" variant="text" @click="loadDefault">Load example</v-btn>
    </div>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <div v-if="loading" class="loading">Loading…</div>

    <div v-if="tree" class="grid-view">
      <BoardViewer
        :tree="tree"
        :showMessageBar="false"
        :showEffortBadges="false"
        :showLinkIndicators="true"
        className="ossia-board"
        @buttonClick="handleButtonClick"
      />
    </div>
  </div>
</template>

<style scoped>
.grid-wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 320px;
}

.grid-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.file-label {
  font-size: 12px;
  color: #333;
  background: #f2f2f2;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
}

.file-input {
  display: none;
}

.grid-view :deep(.aac-board-viewer) {
  max-height: 65vh;
}

.file-name {
  font-size: 12px;
  color: #666;
}

.grid-view :deep(.ossia-board) {
  --aac-button-radius: 12px;
  --aac-grid-gap: 1px;
}

.grid-view :deep(.aac-board-viewer .aac-button),
.grid-view :deep(.aac-board-viewer button) {
  border: 1px solid #d6d6d6;
}

.error {
  color: #b42318;
}

.loading {
  font-style: italic;
}
</style>
