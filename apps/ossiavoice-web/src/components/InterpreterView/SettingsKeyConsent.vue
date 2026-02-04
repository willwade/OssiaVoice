<script setup>
import { useSettingsStore } from '@/stores/SettingsStore.js'

const settingsStore = useSettingsStore()
</script>

<template>
  <div class="settings-section">
    <h3>Key & Consent</h3>
    <div class="group-content">
      <h4><span style="color: red">*</span> OpenAI API Key</h4>
      <span>
        Ossia is built on top of ChatGPT. You need an OpenAI account to use Ossia.
      </span>
      <div class="field-block">
        <v-text-field
          :append-inner-icon="settingsStore.showOpenAIKey ? 'mdi-eye' : 'mdi-eye-off'"
          @click:append-inner="settingsStore.showOpenAIKey = !settingsStore.showOpenAIKey"
          :type="settingsStore.showOpenAIKey ? 'text' : 'password'"
          v-model="settingsStore.openAIAPIKey"
          label="Do not share this key. E.g. sk-..."
        />
      </div>
    </div>

    <div class="group-content">
      <h4><span style="color: red">*</span> User Backstory</h4>
      <span>Describe the user in as much detail as possible.</span>
      <span class="example-link" @click="settingsStore.backstory = settingsStore.exampleBackstory">Use example</span>
      <div class="field-block">
        <v-textarea v-model="settingsStore.backstory" label="user backstory" hide-details />
      </div>
    </div>

    <div class="group-content">
      <h4><span style="color: red">*</span> Terms & Conditions</h4>
      <v-checkbox
        v-model="settingsStore.liabilityAgreement"
        label="I agree that by using this software in beta I am doing so entirely at my own risk."
      />
      <v-checkbox
        v-model="settingsStore.cookieAgreement"
        label="We use cookies and local storage to save settings locally on your device."
      />
    </div>
  </div>
</template>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field-block {
  max-width: 720px;
}

.example-link {
  color: #2a6bb7;
  cursor: pointer;
  width: fit-content;
}
</style>
