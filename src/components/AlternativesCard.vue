<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { CATEGORY_ALTERNATIVES, CATEGORY_LABELS, MEDICAL_CHANNELS } from '@/rules'
import { useMedkitStore } from '@/stores/medkit'
import type { Category } from '@/types'

const props = withDefaults(
  defineProps<{
    category: Category
    /** 被冻结核查的批号，用于文案 */
    batchNos?: string[]
    /** 当前物品 id（从替代推荐中排除自身） */
    excludeItemId?: string
    /** 紧凑模式（详情页侧栏提示） */
    compact?: boolean
  }>(),
  { batchNos: () => [], excludeItemId: '', compact: false },
)

const store = useMedkitStore()
const router = useRouter()

const tips = computed(() => CATEGORY_ALTERNATIVES[props.category])
const items = computed(() => store.safeAlternativesForCategory(props.category, props.excludeItemId || undefined))
</script>

<template>
  <div class="card alt-card" :class="{ compact }">
    <h3>🛡️ 当前批次正在核查：安全替代与就医渠道</h3>
    <p class="muted" style="margin-top: 0">
      {{ CATEGORY_LABELS[category] }}
      <template v-if="batchNos.length">（批号 {{ batchNos.join('、') }}）</template>
      正在风险核查中，<strong>请暂停使用/借用该批次物品</strong>，可选择以下安全方式，避免风险物品继续扩散：
    </p>

    <div v-if="items.length" class="alt-items">
      <div class="muted" style="font-weight: 600; margin-bottom: 4px">大厅中不同批次、在效期、包装完好的同类物品：</div>
      <div v-for="row in items" :key="row.item.id" class="alt-item" role="button" tabindex="0" @click="router.push(`/items/${row.item.id}`)">
        <span>🧴 {{ row.item.name }} · {{ row.item.spec }}</span>
        <span class="muted">批号 {{ row.item.batchNo ?? '未标注' }} · 可借 {{ row.available }} · {{ row.item.location }}</span>
        <span class="badge badge-green">安全替代</span>
      </div>
    </div>
    <div v-else class="banner banner-warn" style="margin: 8px 0">
      大厅暂无可借的不同批次同类物品，请优先采用下面的非共享替代方式或就医渠道，<strong>不要冒险使用核查中的批次</strong>。
    </div>

    <ul class="alt-tips">
      <li v-for="(t, i) in tips" :key="i"><strong>{{ t.title }}：</strong>{{ t.detail }}</li>
    </ul>

    <div class="medical-box">
      <div class="muted" style="font-weight: 600">就医与求助渠道</div>
      <div v-for="(m, i) in MEDICAL_CHANNELS" :key="i" class="medical-item" :class="{ urgent: m.urgent }">
        <strong>{{ m.urgent ? '🚑 ' : '🏥 ' }}{{ m.name }}</strong>
        <span class="muted">{{ m.detail }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.alt-card {
  border: 2px solid var(--c-warn);
}
.alt-items {
  margin: 8px 0;
}
.alt-item {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  border: 1px solid var(--c-gray-200);
  border-radius: 10px;
  padding: 8px 12px;
  margin-bottom: 6px;
  cursor: pointer;
  background: #fff;
}
.alt-item:hover {
  border-color: var(--c-primary);
  background: var(--c-primary-soft);
}
.alt-tips {
  margin: 6px 0;
  padding-left: 20px;
}
.alt-tips li {
  margin-bottom: 4px;
  font-size: 0.9rem;
}
.medical-box {
  border-top: 1px dashed var(--c-gray-300);
  margin-top: 8px;
  padding-top: 8px;
}
.medical-item {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
  font-size: 0.88rem;
}
.medical-item.urgent strong {
  color: var(--c-danger);
}
.alt-card.compact h3 {
  font-size: 1rem;
}
</style>
