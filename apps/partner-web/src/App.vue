<script setup>
import {computed, onMounted, ref} from 'vue'
import { BrowserMultiFormatReader } from '@zxing/browser'

const pairingInput = ref('')
const pairing = ref(null)
const device = ref(null)
const connectionStatus = ref('disconnected')
const errorMessage = ref('')
const transcriptPreview = ref('')
const manualText = ref('')
const participantName = ref('')
const sttAvailable = ref(false)
const isListening = ref(false)
const contextNotes = ref('')

const storedPairing = localStorage.getItem('partnerPairing')
const storedDevice = localStorage.getItem('partnerDevice')
try {
  if (storedPairing) pairing.value = JSON.parse(storedPairing)
  if (storedDevice) device.value = JSON.parse(storedDevice)
} catch {
  localStorage.removeItem('partnerPairing')
  localStorage.removeItem('partnerDevice')
}
let recognition
let socket
let codeReader
const scanActive = ref(false)
const scanError = ref('')
const videoRef = ref(null)

const relayWsUrl = computed(() => {
  if (!pairing.value?.relayBaseUrl) return ''
  return pairing.value.relayBaseUrl.replace(/^http/, 'ws') + '/ws'
})

const isPaired = computed(() => !!pairing.value && !!device.value)
const isReady = computed(() => !!device.value && connectionStatus.value === 'connected')

function initRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) {
    sttAvailable.value = false
    return
  }

  sttAvailable.value = true
  recognition = new SpeechRecognition()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'en-US'

  recognition.onresult = (event) => {
    let interim = ''
    let finalText = ''

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const result = event.results[i]
      const transcript = result[0].transcript.trim()
      if (result.isFinal) {
        finalText += transcript
      } else {
        interim += transcript
      }
    }

    if (interim) {
      transcriptPreview.value = interim
      sendMessage({
        type: 'transcript_chunk',
        text: interim,
        isFinal: false
      })
    }

    if (finalText) {
      transcriptPreview.value = ''
      sendMessage({
        type: 'final_transcript',
        text: finalText,
        isFinal: true
      })
    }
  }

  recognition.onerror = (event) => {
    errorMessage.value = event.error || 'Speech recognition error'
    isListening.value = false
  }

  recognition.onend = () => {
    isListening.value = false
  }
}

async function applyPairing() {
  errorMessage.value = ''
  try {
    const payload = JSON.parse(pairingInput.value)
    if (!payload?.relayBaseUrl || !payload?.enrollToken || !payload?.sessionId) {
      throw new Error('Invalid payload')
    }
    pairing.value = payload
    localStorage.setItem('partnerPairing', JSON.stringify(payload))
    await enrollDevice()
    await connectRelay()
  } catch (error) {
    errorMessage.value = error?.message || 'Failed to apply pairing'
  }
}

async function startScan() {
  scanError.value = ''
  scanActive.value = true
  if (!codeReader) codeReader = new BrowserMultiFormatReader()
  try {
    const devices = await BrowserMultiFormatReader.listVideoInputDevices()
    const deviceId = devices[0]?.deviceId
    if (!deviceId) throw new Error('No camera available')

    await codeReader.decodeFromVideoDevice(deviceId, videoRef.value, (result, err) => {
      if (result) {
        pairingInput.value = result.getText()
        stopScan()
      }
      if (err && !(err.name && err.name.includes('NotFoundException'))) {
        scanError.value = err.message || 'Scan failed'
      }
    })
  } catch (error) {
    scanError.value = error?.message || 'Unable to start scanner'
    scanActive.value = false
  }
}

function stopScan() {
  if (codeReader) codeReader.reset()
  scanActive.value = false
}

function clearPairing() {
  pairing.value = null
  device.value = null
  pairingInput.value = ''
  localStorage.removeItem('partnerPairing')
  localStorage.removeItem('partnerDevice')
  connectionStatus.value = 'disconnected'
}

async function enrollDevice() {
  const response = await fetch(`${pairing.value.relayBaseUrl}/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrollToken: pairing.value.enrollToken })
  })

  if (!response.ok) {
    throw new Error('Enrollment failed')
  }

  device.value = await response.json()
  localStorage.setItem('partnerDevice', JSON.stringify(device.value))
}

async function connectRelay() {
  if (!relayWsUrl.value || !device.value) return

  if (socket && socket.readyState === WebSocket.OPEN) return

  connectionStatus.value = 'connecting'
  socket = new WebSocket(relayWsUrl.value)

  socket.addEventListener('open', () => {
    connectionStatus.value = 'connected'
    socket.send(
      JSON.stringify({
        type: 'join',
        sessionId: pairing.value.sessionId,
        participantId: device.value.participantId,
        deviceId: device.value.deviceId,
        deviceSecret: device.value.deviceSecret
      })
    )
    if (participantName.value) {
      sendMessage({
        type: 'participant_update',
        displayName: participantName.value
      })
    }
  })

  socket.addEventListener('close', () => {
    connectionStatus.value = 'disconnected'
  })

  socket.addEventListener('error', () => {
    connectionStatus.value = 'error'
  })
}

function sendMessage(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN || !device.value) return

  const base = {
    sessionId: pairing.value.sessionId,
    participantId: device.value.participantId,
    deviceId: device.value.deviceId,
    timestamp: Date.now()
  }

  socket.send(JSON.stringify({ ...base, ...payload }))
}

function startPTT() {
  if (!sttAvailable.value || !recognition) return
  if (isListening.value) return
  isListening.value = true
  recognition.start()
}

function stopPTT() {
  if (!recognition) return
  recognition.stop()
}

function sendManual() {
  if (!manualText.value.trim()) return
  sendMessage({
    type: 'final_transcript',
    text: manualText.value.trim(),
    isFinal: true
  })
  manualText.value = ''
}

function sendContextUpdate() {
  sendMessage({
    type: 'context_update',
    notes: contextNotes.value
  })
  contextNotes.value = ''
}

onMounted(() => {
  initRecognition()
  if (pairing.value && device.value) {
    connectRelay()
  }
})
</script>

<template>
  <main class="page">
    <header class="hero">
      <div class="app-title">Ossia Partner</div>
      <div class="status-pill" :class="isPaired ? 'ok' : 'idle'">
        {{ isPaired ? 'Paired' : 'Not paired' }}
      </div>
    </header>

    <section class="card">
      <h2>Pairing</h2>
      <p>Paste the pairing payload from OssiaVoice or scan a QR.</p>
      <textarea
        v-model="pairingInput"
        rows="4"
        class="input"
        placeholder="Pairing payload"
      ></textarea>
      <div class="row">
        <button class="pair-btn" @click="scanActive ? stopScan() : startScan()">
          {{ scanActive ? 'Stop scanner' : 'Scan QR' }}
        </button>
        <button v-if="isPaired" class="pair-btn ghost" @click="clearPairing">
          Clear pairing
        </button>
        <span v-if="scanError" class="error">{{ scanError }}</span>
      </div>
      <div v-if="scanActive" class="scanner">
        <video ref="videoRef" class="scanner-video"></video>
      </div>
      <div class="row">
        <input
          v-model="participantName"
          class="input"
          placeholder="Display name (optional)"
        />
        <button class="pair-btn" @click="applyPairing">Pair device</button>
      </div>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <div class="status">
        <strong>Status:</strong>
        <span>{{ connectionStatus }}</span>
      </div>
    </section>

    <section v-if="isPaired" class="card">
      <h2>Push to Talk</h2>
      <p v-if="!sttAvailable" class="error">
        Speech recognition is not available in this browser. Use manual input instead.
      </p>
      <div class="ptt">
        <button
          class="ptt-btn"
          :class="{ active: isListening }"
          :disabled="!isReady || !sttAvailable"
          @mousedown="startPTT"
          @mouseup="stopPTT"
          @mouseleave="stopPTT"
          @touchstart.prevent="startPTT"
          @touchend.prevent="stopPTT"
        >
          {{ isListening ? 'Listening…' : 'Hold to Talk' }}
        </button>
        <p class="preview" v-if="transcriptPreview">
          {{ transcriptPreview }}
        </p>
      </div>
    </section>

    <section v-if="isPaired" class="card">
      <h2>Manual Send</h2>
      <p>Use this fallback if speech recognition is unavailable.</p>
      <div class="row">
        <input v-model="manualText" class="input" placeholder="Message" />
        <button :disabled="!isReady" class="pair-btn" @click="sendManual">
          Send
        </button>
      </div>
    </section>

    <section v-if="isPaired" class="card">
      <h2>Context Update</h2>
      <p>Send social graph or background context notes to OssiaVoice.</p>
      <textarea
        v-model="contextNotes"
        rows="3"
        class="input"
        placeholder="Context notes"
      ></textarea>
      <button :disabled="!isReady" class="pair-btn" @click="sendContextUpdate">
        Send context
      </button>
    </section>

    <section v-if="isPaired" class="card">
      <h2>BLE Proximity (Chrome Desktop)</h2>
      <p>
        BLE context hints will be enabled only when supported by the browser. Safari
        and unsupported browsers will skip this feature automatically.
      </p>
    </section>
  </main>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;600;700&display=swap');

:root {
  color-scheme: light;
}

.page {
  min-height: 100vh;
  padding: 20px 16px 80px;
  font-family: 'Inter', system-ui, sans-serif;
  background: radial-gradient(circle at top, #f4efe7, #f8f6f2 55%, #f1f4f8 100%);
  color: #1b1a17;
  display: grid;
  gap: 32px;
}

.hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 720px;
}

.app-title {
  font-weight: 700;
  letter-spacing: 0.03em;
}

.status-pill {
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  background: #e8e3da;
  color: #3a332a;
}

.status-pill.ok {
  background: #d9f2e3;
  color: #20623b;
}

.card {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 16px 40px rgba(38, 28, 18, 0.08);
  max-width: 720px;
  display: grid;
  gap: 16px;
}

.row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.input {
  width: 100%;
  border: 1px solid #d5ccc2;
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 14px;
  font-family: inherit;
}

.input:focus {
  outline: 2px solid rgba(84, 62, 35, 0.2);
  border-color: #a89373;
}

.pair-btn {
  height: 44px;
  background: #1b1a17;
  color: white;
  border: none;
  border-radius: 12px;
  padding: 0 20px;
  font-weight: 600;
  cursor: pointer;
}

.pair-btn.ghost {
  background: transparent;
  border: 1px solid #bdb3a7;
  color: #1b1a17;
}
.pair-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status {
  text-transform: capitalize;
}

.error {
  color: #b42318;
}

.ptt {
  display: grid;
  gap: 12px;
}

.ptt-btn {
  background: #1b1a17;
  color: #ffffff;
  border: none;
  border-radius: 999px;
  padding: 18px 26px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.ptt-btn.active {
  box-shadow: 0 0 0 4px rgba(18, 112, 33, 0.2);
  transform: scale(1.02);
}

.ptt-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.preview {
  font-style: italic;
  color: #3a332a;
}

.scanner {
  border: 1px solid #e1d8cc;
  border-radius: 12px;
  overflow: hidden;
  background: #f9f7f3;
}

.scanner-video {
  width: 100%;
  max-height: 280px;
  display: block;
}

@media (max-width: 900px) {
  .row {
    flex-direction: column;
    align-items: stretch;
  }

  .hero {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
