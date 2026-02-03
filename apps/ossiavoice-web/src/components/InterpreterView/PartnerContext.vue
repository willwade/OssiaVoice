<script setup>
import {computed, ref} from 'vue'
import {usePartnerStore} from '@/stores/PartnerStore.js'

const partnerStore = usePartnerStore()
const selectedParticipantId = ref('')
const relationshipTarget = ref('')
const relationshipKind = ref('')
const relationshipWeight = ref('0.5')
const notes = ref('')

const selectedParticipant = computed(() =>
  partnerStore.participants.find((p) => p.participantId === selectedParticipantId.value)
)

const currentContext = computed(() =>
  partnerStore.participantContext[selectedParticipantId.value] || { relationships: [], notes: '' }
)

function loadContext() {
  if (!selectedParticipantId.value) return
  notes.value = currentContext.value.notes || ''
}

function saveNotes() {
  if (!selectedParticipantId.value) return
  partnerStore.updateParticipantContext(selectedParticipantId.value, {
    notes: notes.value
  })
}

function addRelationship() {
  if (!selectedParticipantId.value || !relationshipTarget.value || !relationshipKind.value) return
  const relationships = [...(currentContext.value.relationships || [])]
  relationships.push({
    targetId: relationshipTarget.value,
    kind: relationshipKind.value,
    weight: Number(relationshipWeight.value)
  })
  partnerStore.updateParticipantContext(selectedParticipantId.value, { relationships })
  relationshipTarget.value = ''
  relationshipKind.value = ''
  relationshipWeight.value = '0.5'
}

function removeRelationship(index) {
  const relationships = [...(currentContext.value.relationships || [])]
  relationships.splice(index, 1)
  partnerStore.updateParticipantContext(selectedParticipantId.value, { relationships })
}
</script>

<template>
  <div class="context-panel">
    <h3>Participant Context</h3>
    <v-select
      v-model="selectedParticipantId"
      :items="partnerStore.participants"
      item-title="displayName"
      item-value="participantId"
      label="Select participant"
      hide-details
      density="comfortable"
      @update:model-value="loadContext"
    />

    <div v-if="selectedParticipant" class="section">
      <h4>Notes</h4>
      <v-textarea
        v-model="notes"
        label="Context notes"
        hide-details
        auto-grow
      />
      <v-btn size="small" variant="text" @click="saveNotes">Save notes</v-btn>

      <h4>Relationships</h4>
      <div class="row">
        <v-text-field v-model="relationshipTarget" label="Target" hide-details />
        <v-text-field v-model="relationshipKind" label="Kind" hide-details />
        <v-text-field v-model="relationshipWeight" label="Weight" hide-details />
        <v-btn size="small" variant="text" @click="addRelationship">Add</v-btn>
      </div>
      <ul class="relationship-list">
        <li v-for="(rel, index) in currentContext.relationships" :key="index">
          <span>{{ rel.kind }} → {{ rel.targetId }} ({{ rel.weight || 0.5 }})</span>
          <v-btn size="x-small" variant="text" @click="removeRelationship(index)">Remove</v-btn>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.context-panel {
  display: grid;
  gap: 16px;
}

.section {
  display: grid;
  gap: 12px;
}

.row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
  gap: 8px;
  align-items: end;
}

.relationship-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}

.relationship-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 8px;
}

@media (max-width: 900px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>
