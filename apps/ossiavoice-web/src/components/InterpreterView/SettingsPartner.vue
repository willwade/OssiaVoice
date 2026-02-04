<script setup>
import PartnerPairing from '@/components/InterpreterView/PartnerPairing.vue'
import PartnerContext from '@/components/InterpreterView/PartnerContext.vue'
</script>

<template>
  <div class="settings-section">
    <h3>Partner Connection</h3>
    <PartnerPairing />
    <PartnerContext />
  </div>
</template>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
</style>
