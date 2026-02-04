# OssiaVoice
Ossia is an accessibility tool for those unable to speak or type; Ossia enables whole sentence creation with as few clicks as possible and targets <1 word typed per sentence.

Experience it for yourself at [ossiavoice.com](https://ossiavoice.com/)

## Dev Notes (Monorepo)
This repo is now a monorepo with three main parts:
- `apps/ossiavoice-web`: main OssiaVoice web app
- `apps/partner-web`: partner PWA for push-to-talk transcription
- `services/ws-relay`: WebSocket relay + enrollment endpoints

### Setup
From repo root:
- `npm install`

### Run
- `npm run dev:ossia` (OssiaVoice web app)
- `npm run dev:partner` (Partner web app)
- `npm run dev:relay` (WebSocket relay)

### Pairing Flow (Quick)
1. Open OssiaVoice settings → Partner Devices → generate QR.
2. Partner app scans QR or pastes payload → enrolls device.
3. Partner app connects and streams transcripts.

### BLE Support
BLE proximity is best-effort and only available on supported browsers (Chrome desktop). Unsupported browsers (e.g. Safari) will hide/disable BLE features.

### Security Notes
- Relay supports device revocation and secret rotation, but rotation currently requires a handoff flow to the partner device.
- Relay data is in-memory. For production, add persistent storage for owners/devices/sessions.

### Audit
If `npm audit fix` fails due to network restrictions, run it locally with network access or add a dependency override.

## Currently Missing Features
- Switch control (and keyboard navigation) is sorely missing in the current version which is still in beta. The idea is to release Ossia in its current state to collect feedback and ideas while accessibilty is being better implemented. If you feel you can help with this please reach out

## Licence: 
  Attribution-NonCommercial 4.0 International (CC BY-NC 4.0 DEED)
  In addition, the contributor agreement below applies.

  If these terms do not suit your needs, please reach out for suitable collaboration

## Contributor Agreement
  **The following agreement is required to prevent ownership ambiguity as described [here](https://choosealicense.com/no-permission/). Such ambiguity leads to no one being able to contribute to the project (including the original author) (which would be very bad):**
  
  Any contributor, by adding to or adapting the contents of this repository, accepts that the original author (@arneyjfs) retains full ownership over it's contents
