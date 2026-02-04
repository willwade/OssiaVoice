<script setup>
import { computed } from 'vue'
import { usePartnerStore } from '@/stores/PartnerStore.js'

const partnerStore = usePartnerStore()

const latest = computed(() => partnerStore.latestContext())
</script>

<template>
  <div v-if="latest" class="context-bar">
    <strong>Context:</strong>
    <span v-if="latest.context?.label">{{ latest.context.label }}</span>
    <span v-if="latest.context?.notes"> — {{ latest.context.notes }}</span>
    <span v-if="latest.context?.imageCaption"> — {{ latest.context.imageCaption }}</span>
    <span class="meta" v-if="latest.context?.timeOfDay">
      · {{ latest.context.timeOfDay }} · {{ latest.context.weekday }}
    </span>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/theme';

.context-bar {
  padding: 6px 10px;
  background: theme.$background;
  border-bottom: 1px solid theme.$ossia-divider-light-1;
  font-size: 12px;
  color: theme.$text-color-inverted-muted;
}

.meta {
  color: theme.$text-color-inverted-muted;
}
</style>
