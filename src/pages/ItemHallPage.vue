<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMedkitStore } from '@/stores/medkit'
import { CATEGORY_ICONS, CATEGORY_LABELS, SCENE_HINTS, SCENE_LABELS, STORAGE_LABELS } from '@/rules'
import { daysUntil } from '@/utils/date'
import type { Category, Scene } from '@/types'
import SafetyBanner from '@/components/SafetyBanner.vue'
import ExpiryBadge from '@/components/ExpiryBadge.vue'
import ItemStatusBadge from '@/components/ItemStatusBadge.vue'
import FrozenCategoryBanner from '@/components/FrozenCategoryBanner.vue'

const store = useMedkitStore()
const router = useRouter()

const activeScene = ref<Scene | 'all'>('all')
const keyword = ref('')

const scenes = Object.entries(SCENE_LABELS) as [Scene, string][]

/** 场景涉及哪些品类（冻结提示要按居民当下的找药意图出现） */
const SCENE_CATEGORIES: Record<Scene, Category[]> = {
  child_night_fever: ['fever_patch', 'thermometer_battery'],
  elderly_wound: ['iodophor', 'gauze', 'bandage'],
  no_mask: ['mask'],
  home_care: ['fever_patch', 'iodophor', 'gauze', 'bandage', 'mask', 'thermometer_battery', 'other_consumable'],
}

const frozenBanners = computed(() => {
  const cats = activeScene.value === 'all' ? store.activeFrozenBatches.map((b) => b.category) : SCENE_CATEGORIES[activeScene.value]
  return [...new Set(cats)].filter((c) => store.isCategoryFrozen(c))
})

const visibleWarnings = computed(() => {
  const cats = activeScene.value === 'all' ? new Set(store.items.map((i) => i.category)) : new Set(SCENE_CATEGORIES[activeScene.value])
  return store.riskWarnings.filter((w) => cats.has(w.category))
})

const list = computed(() => {
  const now = store.nowIso
  return store.items
    .filter((i) => ['published', 'partially_lent', 'lent_out'].includes(i.status))
    .filter((i) => daysUntil(i.expiryDate, now) >= 0)
    // 有批次在核查的品类核查期整体下架展示（详情页直达仍提示核查中 + 替代物 + 就医渠道）
    .filter((i) => !store.isCategoryFrozen(i.category))
    .filter((i) => (activeScene.value === 'all' ? true : i.sceneTags.includes(activeScene.value as Scene)))
    .filter((i) => {
      if (!keyword.value.trim()) return true
      const k = keyword.value.trim()
      return i.name.includes(k) || i.spec.includes(k) || i.location.includes(k) || CATEGORY_LABELS[i.category].includes(k) || (i.batchNo ?? '').includes(k)
    })
    .map((i) => ({ item: i, available: store.availableQty(i.id), waiting: store.waitingList(i.id).length, warning: store.categoryWarning(i.category) }))
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
    <div class="muted" style="margin-bottom: 10px">选择你当下的情况，系统只展示审核通过、在有效期内的未拆封共享物品；批次核查中的品类会立即提示并给出安全替代方案。</div>
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
      <input v-model="keyword" type="text" placeholder="也可直接搜索品名 / 规格 / 批号 / 取用地点，如：口罩、3号楼、IOD-20260701" />
    </div>
  </div>

  <!-- 当前意图下正在核查的品类：提示 + 替代物 + 就医渠道 -->
  <FrozenCategoryBanner v-for="c in frozenBanners" :key="c" :category="c" />

  <!-- 品类级长期风险提醒（个体过敏核查后） -->
  <div v-for="w in visibleWarnings" :key="w.category" class="banner banner-warn">
    <strong>🟡 {{ CATEGORY_LABELS[w.category] }} · 风险提醒</strong>
    {{ w.note }}
    <span class="muted" style="display: block; margin-top: 2px">{{ w.staffName }} 于 {{ w.at.replace('T', ' ').slice(0, 16) }} 加挂</span>
  </div>

  <div class="muted" style="margin: 8px 2px">共 {{ list.length }} 件在架物品（已隐藏待审核、冻结/隔离、撤回、报废与过期物品）</div>

  <div v-if="!list.length" class="card empty">
    暂时没有符合条件的物品。<template v-if="frozenBanners.length">需要的品类可能正在批次核查中，请查看上方安全替代物或就医渠道；</template>
    也可以到「登记共享」把家中多余的未拆封常备品分享出来。
  </div>

  <div class="grid grid-2">
    <div v-for="row in list" :key="row.item.id" class="card item-card" role="button" tabindex="0" @click="go(row.item.id)" @keydown.enter="go(row.item.id)">
      <div class="title-row">
        <span class="item-icon">{{ CATEGORY_ICONS[row.item.category] }}</span>
        <span class="item-name">{{ row.item.name }}</span>
        <ItemStatusBadge :status="row.item.status" />
      </div>
      <div v-if="row.warning" class="banner banner-warn" style="margin: 6px 0">🟡 {{ row.warning.note }}</div>
      <dl class="kv">
        <dt>规格</dt><dd>{{ row.item.spec }}</dd>
        <dt>批号</dt><dd>{{ row.item.batchNo || '未标注' }}</dd>
        <dt>有效期</dt><dd><ExpiryBadge :expiry-date="row.item.expiryDate" :now="store.nowIso" /></dd>
        <dt>包装</dt><dd>整盒/整包未开封 ✅</dd>
        <dt>存放</dt><dd>{{ STORAGE_LABELS[row.item.storage] }}</dd>
        <dt>余量</dt>
        <dd>
          <strong :style="{ color: row.available > 0 ? 'var(--c-primary-dark)' : 'var(--c-warn)' }">{{ row.available }}</strong>
          / {{ row.item.quantity }}
          <span v-if="row.waiting" class="badge badge-amber" style="margin-left: 6px">{{ row.waiting }} 人候补中</span>
        </dd>
        <dt>来源</dt><dd>邻居 {{ row.item.ownerName }} 共享</dd>
        <dt>取用地点</dt><dd>{{ row.item.location }}</dd>
      </dl>
      <div class="card-actions">
        <button class="btn btn-primary btn-sm">{{ row.available > 0 ? '查看并申请借用' : '余量为 0，查看候补' }}</button>
      </div>
    </div>
  </div>
</template>
