<script setup>
import { useSettingsStore } from '@/stores/SettingsStore.js'
import PartnerPairing from '@/components/InterpreterView/PartnerPairing.vue'
import PartnerContext from '@/components/InterpreterView/PartnerContext.vue'
import { onMounted, ref } from 'vue'

const settingsStore = useSettingsStore()
const availableVoices = ref([])

onMounted(() => {
  if (window.speechSynthesis) {
    const loadVoices = () => {
      availableVoices.value = window.speechSynthesis.getVoices()
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
  }
})
</script>

<template>
  <div class="settings-form">
    <h2 class="title">Settings</h2>
    <div class="group-content">
      <h3 class="subheading"><span style="color: red">*</span> OpenAI API Key</h3>
      <span>
        Ossia is built on top of ChatGPT. You need an OpenAI account to use Ossia.
      </span>
      <div id="api-key-input-wrapper">
        <v-text-field
          id="api-key-input"
          :append-inner-icon="settingsStore.showOpenAIKey ? 'mdi-eye' : 'mdi-eye-off'"
          @click:append-inner="settingsStore.showOpenAIKey = !settingsStore.showOpenAIKey"
          :type="settingsStore.showOpenAIKey ? 'text' : 'password'"
          v-model="settingsStore.openAIAPIKey"
          label="Do not share this key. E.g. sk-..."
        />
        <strong id="important">Important!</strong> You will be charged for each request Ossia makes.
      </div>
    </div>

    <div class="group-content">
      <h3 class="subheading"><span style="color: red">*</span> User Backstory</h3>
      Describe the user in as much detail as possible.
      <span id="example-link" @click="settingsStore.backstory = settingsStore.exampleBackstory">
        Or use an example
      </span>
      <div id="backstory-input-wrapper">
        <v-textarea id="backstory-input" label="user backstory" v-model="settingsStore.backstory" hide-details />
      </div>
    </div>

    <div class="group-content">
      <h3 class="subheading"><span style="color: red">*</span> Terms & Conditions and Cookies </h3>
      <v-checkbox
        v-model="settingsStore.liabilityAgreement"
        label="I agree that by using this software in beta I am doing so entirely at my own risk."
      />
      <v-checkbox
        v-model="settingsStore.cookieAgreement"
        label="We use cookies and local storage to save settings locally on your device."
      />
    </div>

    <h2 class="title">Partner Devices</h2>
    <div class="group-content">
      <PartnerPairing />
    </div>
    <div class="group-content">
      <PartnerContext />
    </div>

    <h2 class="title">Voice</h2>
    <div class="group-content">
      <v-switch v-model="settingsStore.ttsEnabled" label="Enable speech output" color="primary" />
      <v-select
        v-model="settingsStore.ttsVoice"
        :items="availableVoices"
        item-title="name"
        item-value="name"
        label="Voice"
        hide-details
        density="comfortable"
      />
      <div class="slider-row">
        <v-slider v-model="settingsStore.ttsRate" min="0.5" max="2" step="0.1" label="Rate" />
        <v-slider v-model="settingsStore.ttsPitch" min="0" max="2" step="0.1" label="Pitch" />
        <v-slider v-model="settingsStore.ttsVolume" min="0" max="1" step="0.1" label="Volume" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/theme';

.settings-form {
  display: flex;
  flex-direction: column;
}

.title {
  color: darken(theme.$primary, 10%);
  margin: 10px 0 0 10px;
}

.subheading {
  padding-bottom: 20px;
}

.group-content {
  display: flex;
  flex-direction: column;
  padding: 20px 20px 30px 20px;
}

#api-key-input-wrapper {
  margin-top: 20px;
  max-width: 700px;
}

#backstory-input-wrapper {
  margin-top: 20px;
}

#backstory-input {
  &:deep(textarea) {
    height: 100%;
  }
}

#example-link {
  color: darken(theme.$primary, 10%);
  cursor: pointer;
  width: fit-content;
}

#important {
  color: darken(theme.$primary, 10%);
}

.slider-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

@media screen and (max-width: 600px), (max-height: 770px) {
  .slider-row {
    grid-template-columns: 1fr;
  }
}
</style>
