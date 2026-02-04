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
const contextLabel = ref('')
const contextHistory = ref([])
const imageItems = ref([])
const isCaptioning = ref(false)
const captionError = ref('')
const gpsStatus = ref('')
const gpsError = ref('')
const isSecureContext = ref(!!window.isSecureContext)
const bleSupported = ref(false)
const bleDevices = ref([])
const savedProfiles = ref([])
const quickLabels = ['Living room', 'Bedroom', 'Kitchen', 'Garden']
const accuracyThreshold = Number(import.meta.env.VITE_GPS_ACCURACY_METERS || 50)
let gpsWatchId = null

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
const activeProfileId = computed(() => pairing.value?.sessionId || '')

function loadProfiles() {
  const raw = localStorage.getItem('partnerProfiles')
  if (!raw) return
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) savedProfiles.value = parsed
  } catch {}
}

function persistProfiles(next) {
  savedProfiles.value = next
  localStorage.setItem('partnerProfiles', JSON.stringify(next))
}

function upsertProfile() {
  if (!pairing.value) return
  const id = pairing.value.sessionId
  const name = pairing.value.participantName || participantName.value || 'AAC user'
  const entry = {
    id,
    name,
    relayBaseUrl: pairing.value.relayBaseUrl,
    pairing: pairing.value,
    device: device.value || null,
    lastUsed: new Date().toISOString()
  }
  const next = [
    entry,
    ...savedProfiles.value.filter((profile) => profile.id !== id)
  ].slice(0, 10)
  persistProfiles(next)
}

function removeProfile(id) {
  const next = savedProfiles.value.filter((profile) => profile.id !== id)
  persistProfiles(next)
}

async function switchProfile(profile) {
  if (!profile?.pairing) return
  disconnectSocket()
  pairing.value = profile.pairing
  device.value = profile.device || null
  pairingInput.value = ''
  participantName.value = profile.name || ''
  localStorage.setItem('partnerPairing', JSON.stringify(pairing.value))
  if (device.value) {
    localStorage.setItem('partnerDevice', JSON.stringify(device.value))
  } else {
    localStorage.removeItem('partnerDevice')
  }
  connectionStatus.value = 'connecting'
  if (!device.value) {
    try {
      await enrollDevice()
    } catch (error) {
      errorMessage.value = error?.message || 'Enrollment failed'
      connectionStatus.value = 'disconnected'
      return
    }
  }
  await connectRelay()
  upsertProfile()
}

function disconnectSocket() {
  if (socket && socket.readyState <= WebSocket.OPEN) {
    socket.close()
  }
  socket = null
}

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
    if (participantName.value) payload.participantName = participantName.value
    pairing.value = payload
    localStorage.setItem('partnerPairing', JSON.stringify(payload))
    await enrollDevice()
    await connectRelay()
    upsertProfile()
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
  disconnectSocket()
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
  upsertProfile()
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

function timeMeta() {
  const now = new Date()
  const hour = now.getHours()
  const timeOfDay =
    hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night'
  return {
    localTime: now.toISOString(),
    date: now.toLocaleDateString(),
    weekday: now.toLocaleDateString(undefined, { weekday: 'long' }),
    timeOfDay,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  }
}

function pushHistory(entry) {
  const next = [entry, ...contextHistory.value].slice(0, 5)
  contextHistory.value = next
  localStorage.setItem('contextHistory', JSON.stringify(next))
}

function sendContextUpdate(extra = {}) {
  const meta = timeMeta()
  const context = {
    label: contextLabel.value || undefined,
    notes: contextNotes.value || undefined,
    ...extra,
    ...meta
  }
  sendMessage({
    type: 'context_update',
    context
  })
  pushHistory(context)
  contextNotes.value = ''
}

function resendContext(entry) {
  sendMessage({
    type: 'context_update',
    context: entry
  })
}

function sendQuickLabel(label) {
  contextLabel.value = label
  sendContextUpdate({ source: 'manual' })
}

function sendGpsContext() {
  if (!navigator.geolocation) {
    gpsError.value = 'GPS not supported'
    return
  }
  if (!window.isSecureContext) {
    gpsError.value = 'GPS requires HTTPS (or localhost)'
    return
  }
  gpsStatus.value = 'Locating…'
  gpsError.value = ''
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId)
    gpsWatchId = null
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords
      gpsStatus.value = `Accuracy ~${Math.round(accuracy)}m`
      const context = {
        source: 'gps',
        coords: { lat: latitude, lon: longitude, accuracy }
      }
      if (accuracy <= accuracyThreshold) {
        sendContextUpdate(context)
      } else {
        sendContextUpdate({ ...context, warning: 'low_accuracy' })
      }
    },
    (err) => {
      if (err?.code === 3) {
        gpsStatus.value = 'Waiting for GPS fix…'
        const watchTimeout = window.setTimeout(() => {
          if (gpsWatchId !== null) {
            navigator.geolocation.clearWatch(gpsWatchId)
            gpsWatchId = null
          }
          gpsError.value = 'GPS timed out — try again or move near a window'
          gpsStatus.value = ''
        }, 20000)
        gpsWatchId = navigator.geolocation.watchPosition(
          (pos) => {
            window.clearTimeout(watchTimeout)
            const { latitude, longitude, accuracy } = pos.coords
            gpsStatus.value = `Accuracy ~${Math.round(accuracy)}m`
            const context = {
              source: 'gps',
              coords: { lat: latitude, lon: longitude, accuracy }
            }
            if (accuracy <= accuracyThreshold) {
              sendContextUpdate(context)
            } else {
              sendContextUpdate({ ...context, warning: 'low_accuracy' })
            }
            navigator.geolocation.clearWatch(gpsWatchId)
            gpsWatchId = null
          },
          (watchErr) => {
            window.clearTimeout(watchTimeout)
            gpsError.value = watchErr?.message || 'GPS failed'
            gpsStatus.value = ''
            if (gpsWatchId !== null) {
              navigator.geolocation.clearWatch(gpsWatchId)
              gpsWatchId = null
            }
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        )
        return
      }
      gpsError.value = err?.message || 'GPS failed'
      gpsStatus.value = ''
    },
    { enableHighAccuracy: false, timeout: 60000, maximumAge: 60000 }
  )
}

async function addBleDevice(label) {
  if (!navigator.bluetooth) return
  try {
    if (!window.isSecureContext) {
      captionError.value = 'BLE requires HTTPS (or localhost)'
      return
    }
    const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true })
    const entry = { id: device.id, name: device.name || 'Unknown', label }
    const next = [entry, ...bleDevices.value.filter((d) => d.id !== device.id)].slice(0, 10)
    bleDevices.value = next
    localStorage.setItem('bleDevices', JSON.stringify(next))
  } catch (error) {
    captionError.value = error?.message || 'BLE scan cancelled'
  }
}

function sendBleContext(device) {
  sendContextUpdate({ source: 'ble', label: device.label, beaconName: device.name })
}

async function getCaption(file) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('Missing VITE_OPENAI_API_KEY')
  }
  const base64 = await fileToBase64(file)
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Describe this image in 1-2 sentences.' },
            { type: 'input_image', image_url: base64 }
          ]
        }
      ]
    })
  })
  const data = await response.json()
  if (data.output_text) return data.output_text
  const textOutput = data.output?.find((item) => item.type === 'output_text')
  return textOutput?.text || 'Image description unavailable'
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function handleImageChange(event) {
  const file = event.target.files?.[0]
  if (!file) return
  captionError.value = ''
  isCaptioning.value = true
  try {
    const caption = await getCaption(file)
    await saveImage(file, caption)
    sendContextUpdate({ imageCaption: caption, source: 'image' })
  } catch (error) {
    captionError.value = error?.message || 'Failed to caption image'
  } finally {
    isCaptioning.value = false
  }
}

const DB_NAME = 'partnerImages'
const STORE_NAME = 'images'

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function saveImage(file, caption) {
  const db = await openDb()
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const record = { id, caption, createdAt: Date.now(), blob: file }
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put(record)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
  await loadImages()
}

async function loadImages() {
  const db = await openDb()
  const records = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
  const sorted = records.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5)
  imageItems.value = sorted.map((item) => ({
    id: item.id,
    caption: item.caption,
    createdAt: item.createdAt,
    url: URL.createObjectURL(item.blob)
  }))
  await pruneImages(sorted.map((item) => item.id))
}

async function pruneImages(keepIds) {
  const db = await openDb()
  const records = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAllKeys()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
  const toDelete = records.filter((id) => !keepIds.includes(id))
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    toDelete.forEach((id) => store.delete(id))
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

onMounted(() => {
  initRecognition()
  loadProfiles()
  const storedHistory = localStorage.getItem('contextHistory')
  if (storedHistory) {
    try {
      contextHistory.value = JSON.parse(storedHistory)
    } catch {}
  }
  if (navigator.bluetooth) bleSupported.value = true
  if (!window.isSecureContext) isSecureContext.value = false
  const storedBle = localStorage.getItem('bleDevices')
  if (storedBle) {
    try {
      bleDevices.value = JSON.parse(storedBle)
    } catch {}
  }
  loadImages()
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

    <section class="card" v-if="!isPaired">
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

    <section class="card" v-else>
      <h2>Connected</h2>
      <p>Pairing is active. You can switch or clear it below.</p>
      <div class="row">
        <div class="input read-only">
          <strong>{{ pairing?.participantName || 'AAC user' }}</strong>
          <div class="small">{{ pairing?.relayBaseUrl }}</div>
        </div>
        <button class="secondary" @click="clearPairing">Disconnect</button>
      </div>
      <div class="profiles">
        <strong>Saved profiles</strong>
        <p v-if="!savedProfiles.length" class="small">No saved profiles yet.</p>
        <div v-else class="profile-list">
          <div
            v-for="profile in savedProfiles"
            :key="profile.id"
            class="profile-item"
            :class="{ active: profile.id === activeProfileId }"
          >
            <div>
              <div class="profile-name">{{ profile.name || 'AAC user' }}</div>
              <div class="small">{{ profile.relayBaseUrl }}</div>
              <div class="small">Last used: {{ new Date(profile.lastUsed).toLocaleString() }}</div>
            </div>
            <div class="profile-actions">
              <button class="pair-btn ghost" @click="switchProfile(profile)">Switch</button>
              <button class="secondary" @click="removeProfile(profile.id)">Remove</button>
            </div>
          </div>
        </div>
      </div>
      <details class="pairing-details">
        <summary>Pair with another AAC user</summary>
        <p>Paste the pairing payload from another OssiaVoice instance or scan a QR.</p>
        <textarea
          v-model="pairingInput"
          rows="4"
          class="input"
          placeholder="Pairing payload"
        ></textarea>
        <div class="row">
          <button class="pair-btn" @click="applyPairing" :disabled="!pairingInput.trim()">
            Pair device
          </button>
          <button class="pair-btn ghost" @click="scanActive ? stopScan() : startScan()">
            {{ scanActive ? 'Stop scanner' : 'Scan QR' }}
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
        </div>
      </details>
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
      <p>Send context notes, location, and image captions to OssiaVoice.</p>
      <div class="chip-row">
        <button v-for="label in quickLabels" :key="label" class="chip" @click="sendQuickLabel(label)">
          {{ label }}
        </button>
      </div>
      <div class="row">
        <input v-model="contextLabel" class="input" placeholder="Location label (e.g. Living room)" />
        <button :disabled="!isReady" class="pair-btn" @click="sendContextUpdate({ source: 'manual' })">
          Send context
        </button>
      </div>
      <div class="row">
        <button :disabled="!isReady" class="pair-btn ghost" @click="sendGpsContext">Use GPS</button>
        <span v-if="gpsStatus" class="small">{{ gpsStatus }}</span>
        <span v-if="gpsError" class="error">{{ gpsError }}</span>
        <span v-if="!isSecureContext" class="error">Requires HTTPS (or localhost)</span>
      </div>
      <div class="ble-block" v-if="bleSupported">
        <div v-if="!isSecureContext" class="error">BLE requires HTTPS (or localhost).</div>
        <div class="row">
          <button class="pair-btn ghost" @click="addBleDevice(contextLabel || 'Living room')">
            Scan & tag BLE
          </button>
          <span class="small">Chrome will show a device picker.</span>
        </div>
        <div class="ble-list" v-if="bleDevices.length">
          <div v-for="device in bleDevices" :key="device.id" class="ble-item">
            <div>
              <strong>{{ device.label }}</strong>
              <div class="small">{{ device.name }}</div>
            </div>
            <button class="pair-btn ghost" @click="sendBleContext(device)">Send</button>
          </div>
        </div>
      </div>
      <textarea
        v-model="contextNotes"
        rows="3"
        class="input"
        placeholder="Context notes"
      ></textarea>
      <div class="row">
        <label class="file-label">
          Add photo
          <input type="file" class="file-input" accept="image/*" capture="environment" @change="handleImageChange" />
        </label>
        <span v-if="isCaptioning" class="small">Captioning…</span>
        <span v-if="captionError" class="error">{{ captionError }}</span>
      </div>
      <div v-if="imageItems.length" class="image-strip">
        <div v-for="item in imageItems" :key="item.id" class="image-card">
          <img :src="item.url" alt="context" />
          <small>{{ item.caption }}</small>
        </div>
      </div>
      <div v-if="contextHistory.length" class="history-strip">
        <strong>Recent contexts</strong>
        <button v-for="(item, index) in contextHistory" :key="index" class="history-pill" @click="resendContext(item)">
          {{ item.label || item.timeOfDay }} · {{ item.weekday }}
        </button>
      </div>
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
.input.read-only {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: #f5f5f5;
  border-style: dashed;
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
.pairing-details {
  margin-top: 12px;
}
.pairing-details summary {
  cursor: pointer;
  font-weight: 600;
  margin-bottom: 8px;
}
.profiles {
  display: grid;
  gap: 8px;
}
.profile-list {
  display: grid;
  gap: 10px;
}
.profile-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #ddd2c7;
  background: #faf7f2;
}
.profile-item.active {
  border-color: #1b1a17;
  box-shadow: 0 0 0 2px rgba(27, 26, 23, 0.1);
}
.profile-name {
  font-weight: 600;
}
.profile-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
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

.file-input {
  display: none;
}

.small {
  font-size: 12px;
  color: #666;
}

.image-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 10px;
}

.image-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid #e2ddd4;
  border-radius: 10px;
  padding: 6px;
  background: #fff;
}

.image-card img {
  width: 100%;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
}

.history-strip {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-pill {
  border: 1px solid #d6d0c7;
  border-radius: 999px;
  padding: 6px 10px;
  background: #f5f2ed;
  font-size: 12px;
  cursor: pointer;
}

.chip-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chip {
  border: 1px solid #d6d0c7;
  border-radius: 999px;
  padding: 6px 12px;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
}

.ble-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ble-list {
  display: grid;
  gap: 8px;
}

.ble-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #e2ddd4;
  border-radius: 10px;
  padding: 8px 10px;
  background: #fff;
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
