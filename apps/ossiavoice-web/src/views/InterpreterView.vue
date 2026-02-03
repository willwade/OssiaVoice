<script setup>
import InterlocutorPanel from "@/components/InterpreterView/InterlocutorPanel.vue";
import MessageHistory from "@/components/InterpreterView/MessageHistory/MessageHistory.vue";
import MessageBuilder from "@/components/InterpreterView/MessageBuilder/MessageBuilder.vue";
import MessageOptions from "@/components/InterpreterView/MessageOptions.vue";
import SettingsOverlay from "@/components/InterpreterView/SettingsOverlay.vue";
import {useLoadingStore} from "@/stores/LoadingStore.js";
import {useSettingsStore} from "@/stores/SettingsStore.js";
import {usePartnerStore} from "@/stores/PartnerStore.js";
import {useMessageStore} from "@/stores/MessageStore.js";
import ErrorHandling from "@/components/reusable/AlertHandling.vue";
import {onMounted, watch} from "vue";

const loadingStore = useLoadingStore()
const settingStore = useSettingsStore()
const partnerStore = usePartnerStore()
const messageStore = useMessageStore()

function handlePartnerMessage(payload) {
  if (!payload?.type) return
  if (payload.deviceId) {
    partnerStore.recordDevice({
      deviceId: payload.deviceId,
      participantId: payload.participantId,
      displayName: payload.displayName
    })
  }

  if (payload.type === 'transcript_chunk') {
    partnerStore.setLiveDraft(payload.participantId, payload.text)
    return
  }

  if (payload.type === 'final_transcript') {
    partnerStore.setLiveDraft(payload.participantId, '')
    const name = partnerStore.getDisplayName(payload.participantId)
    messageStore.messageHistory.push({
      role: 'user',
      content: `${name}: ${payload.text}`
    })
    messageStore.generateWords()
    messageStore.generateSentences()
    return
  }

  if (payload.type === 'participant_update') {
    partnerStore.upsertParticipant(payload.participantId, {
      displayName: payload.displayName,
      role: payload.role,
      labels: payload.labels
    })
  }

  if (payload.type === 'context_update') {
    partnerStore.updateParticipantContext(payload.participantId, {
      relationships: payload.relationships,
      notes: payload.notes
    })
  }
}

onMounted(() => {
  if (partnerStore.sessionId) {
    partnerStore.connect(handlePartnerMessage)
  }
})

watch(
  () => partnerStore.sessionId,
  (value) => {
    if (value) partnerStore.connect(handlePartnerMessage)
  }
)
</script>

<template>
  <div id="interpreter-grid">
    <v-overlay
        v-model="settingStore.showSettingsOverlay"
        class="align-center justify-center"
    >
      <settings-overlay @close="settingStore.showSettingsOverlay=false"/>
    </v-overlay>
    <div id="top-panel">
      <div id="interlocutor-panel">
        <InterlocutorPanel/>
      </div>
      <div id="message-history">
        <MessageHistory/>
      </div>
    </div>
    <div id="bottom-panel">
      <v-progress-linear
          v-if="loadingStore.newSentenceLoading || loadingStore.newWordsLoading"
          indeterminate rounded color="primary"
          id="progressLoading"/>
      <div id="message-panels">
        <div id="message-builder" tabindex="0" class="tabbable">
          <MessageBuilder/>
        </div>
        <div id="separator"/>
        <div id="message-options" tabindex="0" class="tabbable">
          <MessageOptions/>
        </div>
      </div>
    </div>
    <error-handling/>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/theme';

#interpreter-grid {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  width: 100vw;
}

#top-panel {
  display: flex;
  width: 100%;
  height: 45dvh;
  max-height: 45dvh;
  flex-grow: 1;
  align-items: stretch;
  border-bottom-width: 1px;
  border-bottom-style: solid;
}

#bottom-panel {
  height: 55dvh;
  max-height: 55dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100vw;
  z-index: 1;
}

#progressLoading {
  min-height: 4px;
}

#message-panels {
  display: flex;
  flex-grow: 1;
  max-height: calc(100% - 4px);
}

#interlocutor-panel {
  padding: 10px;
  height: 100%;
  max-height: 100%;
  width: 50%;
  min-width: 300px;
  max-width: 550px;
}

#message-history {
  background: theme.$ossia-light-background-1;;
  height: 100%;
  flex-grow: 1;
}

#message-builder {
  background-color: theme.$ossia-light-background-1;
  height: 100%;
  width: 50%;
  overflow: auto;
  flex-grow: 1;
}

#separator {
  flex-grow: 0;
  width: 2px;
  background-color: theme.$ossia-divider-light-1;
  height: 70%;
  align-self: center;
}

#message-options {
  max-height: 100%;
  width: calc(50% - 2px);
  flex-grow: 1;
  display: flex;
  overflow: auto;
  justify-items: stretch;
  background-color: theme.$ossia-light-background-1;
}

@media (max-width: 600px) {

  #top-panel {
    height: 37dvh;
    max-height: 37dvh;
  }

  #bottom-panel {
    height: 63dvh;
    max-height: 63dvh;
  }

  #message-panels {
    flex-direction: column-reverse;
  }

  #separator {
    height: 2px;
    width: 70%;
  }

  #message-options {
    width: 100%;
    height: calc(50% - 2px);
  }

  #message-builder {
    width: 100%;
    height: 50%;
  }

}

@media screen and (max-width: 600px) {

  #interlocutor-panel {
    min-width: 50%;
  }

}

</style>
