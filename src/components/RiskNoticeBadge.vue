<script setup lang="ts">
import { computed } from 'vue'
import { useMedkitStore } from '@/stores/medkit'
import type { Category } from '@/types'

const props = defineProps<{ category: Category; showDetail?: boolean }>()
const store = useMedkitStore()
const notice = computed(() => store.activeRiskNoticeFor(props.category))
</script>

<template>
  <div v-if="notice" class="risk-notice">
    <span class="badge badge-purple">⚠️ 品类风险提醒</span>
    <strong v-if="showDetail" style="display: block; margin-top: 4px">{{ notice.title }}</strong>
    <p v-if="showDetail" class="muted" style="margin: 4px 0 0; font-size: 0.85rem">{{ notice.detail }}</p>
  </div>
</template>

<style scoped>
.risk-notice {
  background: #f1eafe;
  border: 1px solid #d8c4f5;
  border-radius: 8px;
  padding: 8px 10px;
  margin: 6px 0;
  font-size: 0.85rem;
  color: #5b21b6;
}
</style>
