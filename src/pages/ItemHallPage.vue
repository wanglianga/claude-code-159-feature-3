<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMedkitStore } from '@/stores/medkit'
import { CATEGORY_ALTERNATIVES, CATEGORY_ICONS, CATEGORY_LABELS, SCENE_HINTS, SCENE_LABELS, STORAGE_LABELS, MEDICAL_CHANNELS } from '@/rules'
import { daysUntil } from '@/utils/date'
import type { Scene } from '@/types'
import SafetyBanner from '@/components/SafetyBanner.vue'
import ExpiryBadge from '@/components/ExpiryBadge.vue'
import ItemStatusBadge from '@/components/ItemStatusBadge.vue'
import RiskNoticeBadge from '@/components/RiskNoticeBadge.vue'

const store = useMedkitStore()
const router = useRouter()

const activeScene = ref<Scene | 'all'>('all')
const keyword = ref('')

const scenes = Object.entries(SCENE_LABELS) as [Scene, string][]

/** 正在冻结核查的品类（如：碘伏某批次收到不适反馈） */
const investigatedCategories = computed(() => [...store.categoryInvestigations.values()])

const list = computed(() => {
  const now = store.nowIso
  return store.items
    .filter((i) => ['published', 'partially_lent', 'lent_out'].includes(i.status))
    .filter((i) => !i.frozenByFeedbackId)
    .filter((i) => daysUntil(i.expiryDate, now) >= 0)
    .filter((i) => (activeScene.value === 'all' ? true : i.sceneTags.includes(activeScene.value as Scene)))
    .filter((i) => {
      if (!keyword.value.trim()) return true
      const k = keyword.value.trim()
      return i.name.includes(k) || i.spec.includes(k) || i.location.includes(k) || CATEGORY_LABELS[i.category].includes(k) || (i.batchNo ?? '').toUpperCase().includes(k.toUpperCase())
    })
    .map((i) => ({ item: i, available: store.availableQty(i.id), waiting: store.waitingList(i.id).length }))
    .sort((a, b) => {
      if ((a.available > 0 ? 1 : 0) !== (b.available > 0 ? 1 : 0)) return a.available > 0 ? -1 : 1
      return a.item.expiryDate < b.item.expiryDate ? -1 : 1
    })
})

function go(id: string) {
  router.push(`/items/${id}`)
}
</script>

<template>
  <SafetyBanner />

  <div class="card">
    <h2 style="margin-bottom: 6px">按急用场景找物品</h2>
    <div class="muted" style="margin-bottom: 10px">选择你当下的情况，系统只展示审核通过、在有效期内且<strong>未被风险核查冻结</strong>的未拆封共享物品。</div>
    <div style="display: flex; gap: 8px; flex-wrap: wrap">
      <button class="chip" :class="{ active: activeScene === 'all' }" @click="activeScene = 'all'">全部场景</button>
      <button v-for="[key, label] in scenes" :key="key" class="chip" :class="{ active: activeScene === key }" @click="activeScene = key">
        {{ label }}
      </button>
    </div>
    <div v-if="activeScene !== 'all'" class="banner banner-info" style="margin-bottom: 0; margin-top: 12px">
      {{ SCENE_HINTS[activeScene as Scene] }}
    </div>
    <div style="margin-top: 12px">
      <input v-model="keyword" type="text" placeholder="搜索品名 / 规格 / 批号 / 取用地点，如：口罩、IDP、3号楼" />
    </div>
  </div>

  <!-- 品类批次核查警示：有居民仍想申请同类物品时立即提示 -->
  <div v-for="inv in investigatedCategories" :key="inv.category" class="card freeze-banner">
    <div class="banner-row">
      <span style="font-size: 1.4rem">🧊</span>
      <div style="flex: 1">
        <strong>{{ CATEGORY_LABELS[inv.category] }}有批次正在核查（{{ inv.batchNos.join('、') || '批号未标注' }}），相关物品已冻结、暂停借用</strong>
        <div class="muted" style="color: inherit">
          有邻居使用该品类后反馈皮肤红肿等不适，社区正在核实是个体过敏还是物品问题。核查期间请不要申请/使用上述批次；
          下面为你推荐<strong>不同批次的同类物品或其他安全替代方式</strong>，情况紧急请直接就医。
        </div>
        <div class="alt-mini">
          <RouterLink v-for="row in store.safeAlternativesForCategory(inv.category)" :key="row.item.id" :to="`/items/${row.item.id}`" class="alt-link">
            ✅ {{ row.item.name }} · 批号 {{ row.item.batchNo ?? '未标注' }} · 可借 {{ row.available }}
          </RouterLink>
          <span v-for="(t, i) in CATEGORY_ALTERNATIVES[inv.category].slice(0, 2)" :key="`t${i}`" class="alt-text">• {{ t.title }}</span>
        </div>
        <div class="alt-mini">
          <span v-for="(m, i) in MEDICAL_CHANNELS.slice(0, 2)" :key="`m${i}`" class="alt-text" :class="{ urgent: m.urgent }">🚑 {{ m.name }}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="muted" style="margin: 8px 2px">共 {{ list.length }} 件在架物品（已隐藏待审核、隔离/批次冻结、撤回、报废与过期物品）</div>

  <div v-if="!list.length" class="card empty">
    暂时没有符合条件的物品。可以看看其他场景，或到「登记共享」把家中多余的未拆封常备品分享出来。
  </div>

  <div class="grid grid-2">
    <div v-for="row in list" :key="row.item.id" class="card item-card" role="button" tabindex="0" @click="go(row.item.id)" @keydown.enter="go(row.item.id)">
      <div class="title-row">
        <span class="item-icon">{{ CATEGORY_ICONS[row.item.category] }}</span>
        <span class="item-name">{{ row.item.name }}</span>
        <ItemStatusBadge :status="row.item.status" />
      </div>
      <RiskNoticeBadge :category="row.item.category" />
      <dl class="kv">
        <dt>规格</dt>
        <dd>{{ row.item.spec }}</dd>
        <dt>批号</dt>
        <dd>{{ row.item.batchNo ?? '未填写' }}</dd>
        <dt>有效期</dt>
        <dd><ExpiryBadge :expiry-date="row.item.expiryDate" :now="store.nowIso" /></dd>
        <dt>包装</dt>
        <dd>整盒/整包未开封 ✅</dd>
        <dt>存放</dt>
        <dd>{{ STORAGE_LABELS[row.item.storage] }}</dd>
        <dt>余量</dt>
        <dd>
          <strong :style="{ color: row.available > 0 ? 'var(--c-primary-dark)' : 'var(--c-warn)' }">{{ row.available }}</strong>
          / {{ row.item.quantity }}
          <span v-if="row.waiting" class="badge badge-amber" style="margin-left: 6px">{{ row.waiting }} 人候补中</span>
        </dd>
        <dt>来源</dt>
        <dd>邻居 {{ row.item.ownerName }} 共享</dd>
        <dt>取用地点</dt>
        <dd>{{ row.item.location }}</dd>
      </dl>
      <div class="card-actions">
        <button class="btn btn-primary btn-sm">{{ row.available > 0 ? '查看并申请借用' : '余量为 0，查看候补' }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.freeze-banner {
  border: 2px solid var(--c-danger);
  background: var(--c-danger-soft);
  color: var(--c-danger);
}
.alt-mini {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 6px;
  align-items: center;
}
.alt-link {
  background: #fff;
  border: 1px solid var(--c-primary);
  color: var(--c-primary-dark);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 0.8rem;
  font-weight: 600;
}
.alt-text {
  font-size: 0.8rem;
  color: var(--c-gray-700);
}
.alt-text.urgent {
  color: var(--c-danger);
  font-weight: 600;
}
</style>
