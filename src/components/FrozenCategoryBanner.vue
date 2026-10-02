<script setup lang="ts">
// 品类/批次冻结提示条：冻结期间所有入口都要提示“正在核查”，并推荐安全替代物与就医渠道
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMedkitStore } from '@/stores/medkit'
import { CATEGORY_ALTERNATIVES, CATEGORY_ICONS, CATEGORY_LABELS, MEDICAL_CHANNELS } from '@/rules'
import type { Category } from '@/types'

const props = withDefaults(
  defineProps<{
    category: Category
    /** 紧凑模式只给一句话，详情可展开 */
    compact?: boolean
  }>(),
  { compact: false },
)

const store = useMedkitStore()
const router = useRouter()

const batch = computed(() => store.frozenBatchForCategory(props.category))
const alternatives = computed(() => store.safeAlternatives(props.category))
const advice = computed(() => store.alternativeAdvice(props.category))
const altCategoryLabels = computed(() =>
  CATEGORY_ALTERNATIVES[props.category].map((c) => CATEGORY_LABELS[c]),
)
</script>

<template>
  <div v-if="batch" class="banner banner-danger freeze-banner" role="alert">
    <div class="banner-row">
      <span>🧊</span>
      <div style="flex: 1">
        <strong>「{{ CATEGORY_LABELS[category] }}」当前批次正在社区核查中，暂停一切借用与交接</strong>
        <div class="muted" style="color: inherit; opacity: 0.9">
          {{ batch.label }}：{{ batch.reason }}。为避免风险物品继续扩散，本品类在核查结论出来前不能申请；你可以选择以下安全替代方式。
        </div>

        <template v-if="!compact">
          <!-- 安全替代物 -->
          <div v-if="alternatives.length" class="alt-box">
            <div style="font-weight: 600; margin: 4px 0">✅ 推荐的安全替代物（未涉事批次、在有效期内且有余量）</div>
            <button
              v-for="it in alternatives"
              :key="it.id"
              type="button"
              class="alt-chip"
              @click="router.push(`/items/${it.id}`)"
            >
              {{ CATEGORY_ICONS[it.category] }} {{ it.name }} · {{ it.spec }}
              <span class="muted" style="margin-left: 4px">余量 {{ store.availableQty(it.id) }} · {{ it.location }}</span>
            </button>
          </div>
          <div v-else-if="altCategoryLabels.length" class="muted" style="margin-top: 6px">
            目前大厅暂无可借的{{ altCategoryLabels.join('、') }}替代物，可到「登记共享」看看是否有邻居补充，或直接选择就医渠道处理。
          </div>

          <div v-if="advice" class="alt-advice">🩹 {{ advice }}</div>

          <!-- 就医渠道 -->
          <div class="med-box">
            <div style="font-weight: 600; margin: 4px 0">🏥 就医渠道（社区只做物品流转与风险提醒，不做诊断）</div>
            <ul style="margin: 0; padding-left: 18px">
              <li v-for="ch in MEDICAL_CHANNELS" :key="ch.name">
                <strong>{{ ch.name }}</strong>：{{ ch.desc }} <span class="muted" style="color: inherit; opacity: 0.85">（{{ ch.action }}）</span>
              </li>
            </ul>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.freeze-banner {
  border-width: 2px;
}
.alt-box,
.med-box {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
}
.med-box {
  background: rgba(255, 255, 255, 0.55);
}
.alt-chip {
  display: inline-block;
  margin: 4px 6px 0 0;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid currentColor;
  background: #fff;
  color: var(--c-danger);
  cursor: pointer;
  font-size: 0.86rem;
  font-family: inherit;
}
.alt-chip:hover {
  background: var(--c-danger-soft);
}
.alt-advice {
  margin-top: 8px;
  font-size: 0.88rem;
}
</style>
