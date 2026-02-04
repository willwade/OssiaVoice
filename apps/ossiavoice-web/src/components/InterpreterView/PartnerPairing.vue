<script setup>
import {computed, ref, watch} from 'vue'
import QRCode from 'qrcode'
import {usePartnerStore} from '@/stores/PartnerStore.js'

const partnerStore = usePartnerStore()
const participantName = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const qrDataUrl = ref('')
const activePayload = ref(null)
const showQr = ref(false)
const zoomQr = ref(false)

const latestPairing = computed(() => partnerStore.pendingPairings[0] || null)

async function generateQr(payload) {
  if (!payload) {
    qrDataUrl.value = ''
    return
  }
  const qrText = JSON.stringify(payload)
  qrDataUrl.value = await QRCode.toDataURL(qrText, {
    width: 240,
    margin: 1
  })
}

watch(
  latestPairing,
  async (pairing) => {
    activePayload.value = pairing?.payload || null
    if (showQr.value) {
      await generateQr(pairing?.payload)
    }
  },
  { immediate: true }
)

async function createPairing() {
  try {
    isLoading.value = true
    errorMessage.value = ''
    const payload = await partnerStore.issueEnrollToken(participantName.value)
    participantName.value = ''
    activePayload.value = payload
    showQr.value = true
    await generateQr(payload)
  } catch (error) {
    errorMessage.value = error?.message || 'Failed to create pairing'
  } finally {
    isLoading.value = false
  }
}

function copyPayload() {
  if (!activePayload.value) return
  navigator.clipboard?.writeText(JSON.stringify(activePayload.value))
}

function clearPairings() {
  partnerStore.clearAllPairings()
  showQr.value = false
  activePayload.value = null
  qrDataUrl.value = ''
}

function resetParticipants() {
  partnerStore.clearParticipantsAndDevices()
  clearPairings()
}

function toggleZoom() {
  zoomQr.value = !zoomQr.value
}
</script>

<template>
  <div class="partner-pairing">
    <div class="section">
      <h3>Relay Settings</h3>
      <v-text-field
        v-model="partnerStore.relayBaseUrl"
        label="Relay URL"
        hide-details
        density="comfortable"
        @blur="partnerStore.persist()"
      />
      <div class="meta">
        <div>
          <strong>Owner ID:</strong>
          <span>{{ partnerStore.ownerId || 'Not registered' }}</span>
        </div>
        <div>
          <strong>Session:</strong>
          <span>{{ partnerStore.sessionId || 'Not set' }}</span>
          <v-btn
            size="small"
            variant="text"
            class="inline-btn"
            @click="partnerStore.createSession()"
          >New session</v-btn>
        </div>
        <div class="status">
          <strong>Status:</strong>
          <span>{{ partnerStore.socketStatus }}</span>
        </div>
      </div>
    </div>

    <div class="section">
      <h3>Add Partner User</h3>
      <div class="row">
        <v-text-field
          v-model="participantName"
          label="Participant name"
          hide-details
          density="comfortable"
        />
        <v-btn
          color="primary"
          :loading="isLoading"
          class="create-btn"
          @click="createPairing"
        >Generate QR</v-btn>
      </div>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    </div>

    <div v-if="activePayload && showQr" class="section">
      <h3>Pairing QR</h3>
      <p class="hint">
        Scan this code with the partner app, or copy the payload below.
      </p>
      <div class="qr-row">
        <img
          v-if="qrDataUrl"
          :src="qrDataUrl"
          alt="Pairing QR"
          class="qr-image"
          @click="toggleZoom"
        />
        <div class="payload">
          <pre>{{ JSON.stringify(activePayload, null, 2) }}</pre>
          <v-btn size="small" variant="text" @click="copyPayload">Copy payload</v-btn>
        </div>
      </div>
    </div>

    <div v-if="zoomQr && qrDataUrl" class="qr-overlay" @click="toggleZoom">
      <img :src="qrDataUrl" alt="Pairing QR enlarged" />
    </div>

    <div class="section">
      <div class="row">
        <v-btn size="small" variant="text" @click="clearPairings">Clear pending QR</v-btn>
        <v-btn size="small" variant="text" @click="resetParticipants">Reset participants</v-btn>
        <v-btn size="small" variant="text" @click="partnerStore.resetOwner()">Re-register owner</v-btn>
      </div>
    </div>

    <div v-if="partnerStore.participants.length" class="section">
      <h3>Participants</h3>
      <ul class="participant-list">
        <li v-for="participant in partnerStore.participants" :key="participant.participantId">
          <span>{{ participant.displayName }}</span>
          <small>{{ participant.participantId }}</small>
        </li>
      </ul>
    </div>

    <div v-if="partnerStore.devices.length" class="section">
      <h3>Devices</h3>
      <ul class="participant-list">
        <li v-for="device in partnerStore.devices" :key="device.deviceId">
          <span>{{ device.displayName || 'Device' }}</span>
          <small>{{ device.deviceId }}</small>
          <div class="device-actions">
            <v-btn
              size="x-small"
              variant="text"
              @click="partnerStore.revokeDevice(device.deviceId)"
            >Revoke</v-btn>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.partner-pairing {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.create-btn {
  height: 44px;
}

.meta {
  display: grid;
  gap: 6px;
}

.status {
  text-transform: capitalize;
}

.inline-btn {
  margin-left: 8px;
}

.error {
  color: #b42318;
}

.qr-row {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 16px;
  align-items: start;
}

.qr-image {
  width: 140px;
  height: 140px;
  cursor: zoom-in;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  background: #fff;
}

.qr-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

.qr-overlay img {
  width: 320px;
  height: 320px;
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  cursor: zoom-out;
}

.payload {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 8px;
}

.payload pre {
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0 0 8px 0;
  font-size: 12px;
}

.participant-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}

.participant-list li {
  display: flex;
  flex-direction: column;
  padding: 10px;
  background: #f3f3f3;
  border-radius: 8px;
}

.device-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.participant-list small {
  color: #666;
  font-size: 11px;
}

@media (max-width: 900px) {
  .qr-row {
    grid-template-columns: 1fr;
  }
}
</style>
