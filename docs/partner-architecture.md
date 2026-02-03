# Partner App Architecture (Draft)

## Goals
- Allow multiple partner devices to stream transcripts + metadata into OssiaVoice in real time.
- Provide session-safe pairing via QR codes with revocation.
- Support context/social graph updates per participant.
- Add BLE proximity hints when supported (Chrome Desktop), and disable gracefully elsewhere.

## Components
- `apps/ossiavoice-web`: main app (session creation, pairing, participant management)
- `apps/partner-web`: partner PWA (PTT, transcription, context updates)
- `services/ws-relay`: WebSocket relay + enrollment endpoints
- `packages/shared`: shared protocol schemas and message validation

## Pairing & Identity
1. OssiaVoice creates a participant and issues an enroll token.
2. Partner app scans QR and calls `POST /enroll`.
3. Relay issues `deviceId` + `deviceSecret`.
4. Partner app joins a session by sending a `join` message over WS.
5. OssiaVoice joins the same session as a listener using `join_listener`.

### Enrollment API (relay)
- `POST /owner-register`
  - **Output**: `{ ownerId, ownerSecret }`
  - Used by OssiaVoice to authenticate enroll requests and listener joins.

- `POST /enroll-issue`
  - **Input**: `{ participantId, ownerId, ownerSecret, displayName }`
  - **Output**: `{ enrollToken, expiresIn }`
  - This endpoint must be protected (auth/CSRF) in production.

- `POST /enroll`
  - **Input**: `{ enrollToken }`
  - **Output**: `{ deviceId, deviceSecret }`

- `POST /device-revoke`
  - **Input**: `{ ownerId, ownerSecret, deviceId }`
  - **Output**: `{ revoked: true }`

- `POST /device-rotate`
  - **Input**: `{ ownerId, ownerSecret, deviceId }`
  - **Output**: `{ deviceId, deviceSecret }`

## WebSocket Protocol
Messages are JSON. All partner-origin messages include:
- `sessionId`, `participantId`, `deviceId`, `timestamp`

### Required message types
- `join`
- `transcript_chunk`
- `final_transcript`
- `participant_update`
- `context_update`
- `leave`
- `heartbeat`
- `join_listener` (OssiaVoice only)

Schemas live in `packages/shared/src/protocol.js`.

## BLE Proximity (Feasibility)
- **Web Bluetooth availability**: Chrome desktop only; Safari and most mobile browsers do not support the API.
- **MAC address access**: Not accessible in web APIs; rely on device name/UUID.
- **RSSI access**: Not guaranteed; the UI should treat proximity as a hint.

### UX behavior
- If `navigator.bluetooth` is unavailable, hide BLE controls and omit proximity context.
- If available, allow the user to label nearby BLE devices. Stream labels + coarse RSSI hints to OssiaVoice.

## Monorepo Structure
```
apps/
  ossiavoice-web/
  partner-web/
services/
  ws-relay/
packages/
  shared/
```

## Next Implementation Steps
1. Add OssiaVoice pairing UI and participant management.
2. Wire partner app to relay with join + transcript messages.
3. Add server-side auth + rate limits.
4. Build BLE scanner UI in partner app and guard by feature detection.
