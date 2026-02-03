import {ref, computed} from 'vue'
import {defineStore} from 'pinia'

const defaultRelayUrl = 'http://localhost:8787'

function getStoredJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID()
  return `id_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`
}

export const usePartnerStore = defineStore('partner', () => {
  const relayBaseUrl = ref(localStorage.getItem('relayBaseUrl') || defaultRelayUrl)
  const ownerId = ref(localStorage.getItem('ownerId') || '')
  const ownerSecret = ref(localStorage.getItem('ownerSecret') || '')
  const sessionId = ref(localStorage.getItem('sessionId') || '')

  const participants = ref(getStoredJson('partnerParticipants', []))
  const devices = ref(getStoredJson('partnerDevices', []))
  const pendingPairings = ref(getStoredJson('pendingPairings', []))
  const liveDrafts = ref({})
  const participantContext = ref(getStoredJson('partnerContext', {}))

  const socketStatus = ref('disconnected')
  const lastError = ref('')
  let socket = null

  const wsUrl = computed(() => {
    if (!relayBaseUrl.value) return ''
    return relayBaseUrl.value.replace(/^http/, 'ws') + '/ws'
  })

  function persist() {
    localStorage.setItem('relayBaseUrl', relayBaseUrl.value)
    localStorage.setItem('ownerId', ownerId.value)
    localStorage.setItem('ownerSecret', ownerSecret.value)
    localStorage.setItem('sessionId', sessionId.value)
    localStorage.setItem('partnerParticipants', JSON.stringify(participants.value))
    localStorage.setItem('partnerDevices', JSON.stringify(devices.value))
    localStorage.setItem('pendingPairings', JSON.stringify(pendingPairings.value))
    localStorage.setItem('partnerContext', JSON.stringify(participantContext.value))
  }

  async function ensureOwner() {
    if (ownerId.value && ownerSecret.value) return
    const response = await fetch(`${relayBaseUrl.value}/owner-register`, {
      method: 'POST'
    })
    if (!response.ok) throw new Error('owner_register_failed')
    const data = await response.json()
    ownerId.value = data.ownerId
    ownerSecret.value = data.ownerSecret
    persist()
  }

  function createSession() {
    sessionId.value = uuid()
    persist()
  }

  async function issueEnrollToken(displayName) {
    await ensureOwner()
    if (!sessionId.value) createSession()

    const participantId = uuid()
    const response = await fetch(`${relayBaseUrl.value}/enroll-issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId,
        ownerId: ownerId.value,
        ownerSecret: ownerSecret.value,
        displayName
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'enroll_issue_failed')
    }

    const data = await response.json()

    const participant = {
      participantId,
      displayName: displayName || `Participant ${participants.value.length + 1}`,
      createdAt: Date.now()
    }
    participants.value = [...participants.value, participant]

    const pairingPayload = {
      relayBaseUrl: relayBaseUrl.value,
      enrollToken: data.enrollToken,
      sessionId: sessionId.value
    }

    pendingPairings.value = [
      {
        participantId,
        displayName: participant.displayName,
        enrollToken: data.enrollToken,
        payload: pairingPayload,
        createdAt: Date.now()
      },
      ...pendingPairings.value
    ]

    persist()
    return pairingPayload
  }

  function clearPairing(enrollToken) {
    pendingPairings.value = pendingPairings.value.filter(
      (pairing) => pairing.enrollToken !== enrollToken
    )
    persist()
  }

  function upsertParticipant(participantId, patch) {
    const index = participants.value.findIndex(
      (participant) => participant.participantId === participantId
    )
    if (index === -1) {
      participants.value = [
        ...participants.value,
        {
          participantId,
          displayName: patch.displayName || 'Partner',
          createdAt: Date.now(),
          ...patch
        }
      ]
    } else {
      const updated = [...participants.value]
      updated[index] = { ...updated[index], ...patch }
      participants.value = updated
    }
    persist()
  }

  function getDisplayName(participantId) {
    return (
      participants.value.find((p) => p.participantId === participantId)?.displayName ||
      'Partner'
    )
  }

  function updateParticipantContext(participantId, patch) {
    participantContext.value = {
      ...participantContext.value,
      [participantId]: {
        ...(participantContext.value[participantId] || {}),
        ...patch
      }
    }
    persist()
  }

  function recordDevice(deviceInfo) {
    if (!deviceInfo?.deviceId) return
    const exists = devices.value.some((device) => device.deviceId === deviceInfo.deviceId)
    if (!exists) {
      devices.value = [
        ...devices.value,
        {
          deviceId: deviceInfo.deviceId,
          participantId: deviceInfo.participantId,
          displayName: deviceInfo.displayName,
          createdAt: Date.now()
        }
      ]
    }
    persist()
  }

  async function revokeDevice(deviceId) {
    if (!ownerId.value || !ownerSecret.value) return
    await fetch(`${relayBaseUrl.value}/device-revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: ownerId.value, ownerSecret: ownerSecret.value, deviceId })
    })
    devices.value = devices.value.filter((device) => device.deviceId !== deviceId)
    persist()
  }

  async function rotateDeviceSecret(deviceId) {
    if (!ownerId.value || !ownerSecret.value) return null
    const response = await fetch(`${relayBaseUrl.value}/device-rotate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: ownerId.value, ownerSecret: ownerSecret.value, deviceId })
    })
    if (!response.ok) return null
    return response.json()
  }

  function setLiveDraft(participantId, text) {
    liveDrafts.value = {
      ...liveDrafts.value,
      [participantId]: text
    }
  }

  function connect(messageHandler) {
    if (!wsUrl.value || !sessionId.value || !ownerId.value || !ownerSecret.value) {
      return
    }
    if (socket && socket.readyState === WebSocket.OPEN) return

    socketStatus.value = 'connecting'
    lastError.value = ''
    socket = new WebSocket(wsUrl.value)

    socket.addEventListener('open', () => {
      socketStatus.value = 'connected'
      socket.send(
        JSON.stringify({
          type: 'join_listener',
          sessionId: sessionId.value,
          ownerId: ownerId.value,
          ownerSecret: ownerSecret.value
        })
      )
    })

    socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data)
        messageHandler?.(payload)
      } catch (error) {
        console.warn('WS message parse failed', error)
      }
    })

    socket.addEventListener('close', () => {
      socketStatus.value = 'disconnected'
    })

    socket.addEventListener('error', () => {
      socketStatus.value = 'error'
      lastError.value = 'Relay connection failed'
    })
  }

  function disconnect() {
    if (socket) socket.close()
    socket = null
    socketStatus.value = 'disconnected'
  }

  return {
    relayBaseUrl,
    ownerId,
    ownerSecret,
    sessionId,
    participants,
    devices,
    pendingPairings,
    liveDrafts,
    participantContext,
    socketStatus,
    lastError,
    wsUrl,
    ensureOwner,
    createSession,
    issueEnrollToken,
    clearPairing,
    upsertParticipant,
    getDisplayName,
    setLiveDraft,
    updateParticipantContext,
    recordDevice,
    revokeDevice,
    rotateDeviceSecret,
    connect,
    disconnect,
    persist
  }
})
