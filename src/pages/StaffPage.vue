<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMedkitStore } from '@/stores/medkit'
import { useFlash } from '@/composables/useFlash'
import { CATEGORY_ICONS, CATEGORY_LABELS, FEEDBACK_TYPE_LABELS, ITEM_STATUS_LABELS } from '@/rules'
import { fmtDateTime } from '@/utils/date'
import SafetyBanner from '@/components/SafetyBanner.vue'
import ExpiryBadge from '@/components/ExpiryBadge.vue'
import ItemStatusBadge from '@/components/ItemStatusBadge.vue'
import TimelineView from '@/components/TimelineView.vue'
import InvestigationPanel from '@/components/InvestigationPanel.vue'

const store = useMedkitStore()
const router = useRouter()
const { show } = useFlash()
const tab = ref<'risk' | 'expiry' | 'review2' | 'trace'>('risk')
const traceId = ref('')

const stats = computed(() => store.stats)
const secondReviewQueue = computed(() => store.items.filter((i) => i.status === 'pending_review' && i.category === 'other_consumable' && i.review?.approved))
const quarantined = computed(() => store.items.filter((i) => i.status === 'quarantined'))
/** 没有开放反馈卡片覆盖的隔离物品（避免重复展示） */
const orphanQuarantined = computed(() => {
  const openFbIds = new Set(store.openFeedbackList.map((f) => f.id))
  return quarantined.value.filter((i) => !i.frozenByFeedbackId || !openFbIds.has(i.frozenByFeedbackId))
})
const activeNotices = computed(() => store.riskNotices.filter((n) => n.active))

function scrapItem(id: string, reason: string) {
  const r = store.scrapItem(id, reason)
  show(r.message, r.ok ? 'ok' : 'err')
}
function approve2(id: string) {
  const r = store.secondReview(id, true, '工作人员复核符合共享范围')
  show(r.message, r.ok ? 'ok' : 'err')
}
function reject2(id: string) {
  const reason = window.prompt('复核驳回原因：', '无法确认安全性，不予共享')
  if (reason === null) return
  const r = store.secondReview(id, false, reason || '复核不通过')
  show(r.message, r.ok ? 'ok' : 'err')
}
</script>

<template>
  <SafetyBanner compact />

  <div class="card">
    <h2 style="margin-bottom: 4px">社区工作人员工作台 · 风险看板</h2>
    <div class="muted">
      工作人员的重点：守住安全底线——不适反馈回访核查（区分<strong>个体过敏还是物品问题</strong>）、同批次冻结/恢复/报废、品类风险提醒、过期报废、双重复核与全链路追溯。社区只做<strong>物品流转和风险提醒</strong>，不下诊断结论。
    </div>
    <div class="stat-cards" style="margin-top: 12px; margin-bottom: 0">
      <div class="stat-card"><div class="num" :style="{ color: 'var(--c-danger)' }">{{ stats.openFeedback }}</div><div class="lbl">待处置风险反馈</div></div>
      <div class="stat-card"><div class="num" :style="{ color: 'var(--c-danger)' }">{{ stats.quarantined }}</div><div class="lbl">批次冻结中物品</div></div>
      <div class="stat-card"><div class="num" :style="{ color: '#6d28d9' }">{{ stats.activeRiskNotices }}</div><div class="lbl">生效中的品类风险提醒</div></div>
      <div class="stat-card"><div class="num" :style="{ color: 'var(--c-warn)' }">{{ stats.expired }}</div><div class="lbl">已过期待报废</div></div>
      <div class="stat-card"><div class="num">{{ stats.reviewCount }}</div><div class="lbl">志愿者待审</div></div>
      <div class="stat-card"><div class="num">{{ stats.inFlight }}</div><div class="lbl">交接中</div></div>
      <div class="stat-card"><div class="num">{{ stats.waiting }}</div><div class="lbl">候补中</div></div>
      <div class="stat-card"><div class="num">{{ stats.activeCount }}</div><div class="lbl">在架物品</div></div>
    </div>
    <div class="tabs" style="margin-top: 14px; margin-bottom: 0">
      <button class="chip" :class="{ active: tab === 'risk' }" @click="tab = 'risk'">风险反馈与冻结（{{ stats.openFeedback + stats.quarantined }}）</button>
      <button class="chip" :class="{ active: tab === 'expiry' }" @click="tab = 'expiry'">效期与报废</button>
      <button class="chip" :class="{ active: tab === 'review2' }" @click="tab = 'review2'">复核（{{ secondReviewQueue.length }}）</button>
      <button class="chip" :class="{ active: tab === 'trace' }" @click="tab = 'trace'">全链路追溯</button>
    </div>
  </div>

  <!-- 风险反馈处置 -->
  <template v-if="tab === 'risk'">
    <div v-if="!store.openFeedbackList.length && !quarantined.length && !activeNotices.length" class="card empty">没有待处置的风险反馈、冻结物品与风险提醒。</div>

    <!-- 结构化核查：每条开放反馈一张含表单的卡片 -->
    <InvestigationPanel v-for="f in store.openFeedbackList" :key="f.id" :feedback="f" />

    <!-- 生效中的品类风险提醒 -->
    <h3 v-if="activeNotices.length" class="section-title">🛑 生效中的品类风险提醒（个体过敏核查后保留）</h3>
    <div v-for="rn in activeNotices" :key="rn.id" class="card" style="border-left: 4px solid #6d28d9">
      <div style="display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap">
        <strong>⚠️ {{ rn.title }}</strong>
        <span class="badge badge-purple">风险提醒生效中</span>
      </div>
      <p style="margin: 6px 0" class="muted">{{ rn.detail }}</p>
      <div class="muted">
        品类：{{ CATEGORY_LABELS[rn.category] }} · {{ rn.createdByName }} 发布于 {{ fmtDateTime(rn.createdAt) }}
      </div>
      <div class="card-actions">
        <button v-if="rn.relatedItemId" class="btn btn-sm" @click="router.push(`/items/${rn.relatedItemId}`)">查看相关物品与核查记录</button>
      </div>
    </div>

    <!-- 已隔离但无开放反馈卡片覆盖的物品（兜底处理） -->
    <template v-if="orphanQuarantined.length">
      <h3 class="section-title">已冻结/隔离物品（暂停一切借用与交接）</h3>
      <div v-for="it in orphanQuarantined" :key="it.id" class="card">
        <div style="display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap">
          <strong>{{ CATEGORY_ICONS[it.category] }} {{ it.name }} · {{ it.spec }} · 批号 {{ it.batchNo ?? '未标注' }}</strong>
          <ItemStatusBadge :status="it.status" />
        </div>
        <div class="muted" style="margin: 6px 0">{{ it.closeReason }}</div>
        <div v-if="it.frozenByFeedbackId" class="muted">由反馈 {{ it.frozenByFeedbackId }} 同批次联动冻结，核查结论提交后会自动一并处置。</div>
        <div class="card-actions">
          <button class="btn btn-danger btn-sm" @click="scrapItem(it.id, '工作人员核查后报废：隔离物品复核不合格')">直接报废</button>
          <button class="btn btn-sm" @click="router.push(`/items/${it.id}`)">查看反馈与时间线</button>
        </div>
      </div>
    </template>

    <!-- 最近已处置反馈（留痕查看） -->
    <h3 v-if="store.feedbacks.filter((f) => f.status !== 'open').length" class="section-title">📁 最近已处置反馈</h3>
    <div v-for="f in store.feedbacks.filter((f) => f.status !== 'open').slice(0, 5)" :key="f.id" class="card">
      <div style="display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap">
        <strong>{{ FEEDBACK_TYPE_LABELS[f.type] }}：{{ store.items.find((i) => i.id === f.itemId)?.name ?? f.itemId }}</strong>
        <span class="badge" :class="f.status === 'resolved_scrap' ? 'badge-red' : f.status === 'resolved_risk_notice' ? 'badge-purple' : 'badge-green'">
          {{ f.status === 'resolved_scrap' ? '物品问题·已报废' : f.status === 'resolved_risk_notice' ? '个体过敏·风险提醒' : '已解除冻结' }}
        </span>
      </div>
      <div class="muted" style="margin-top: 4px">
        {{ f.handlerName }} 于 {{ f.handledAt ? fmtDateTime(f.handledAt) : '—' }} 处置：{{ f.handleNote }}
      </div>
    </div>
  </template>

  <!-- 效期与报废 -->
  <template v-else-if="tab === 'expiry'">
    <h3 class="section-title">🚮 已过期仍挂在系统中（大厅已自动禁借，需报废清理）</h3>
    <div v-if="!store.expiredListed.length" class="card empty">没有过期物品。</div>
    <div v-for="it in store.expiredListed" :key="it.id" class="card">
      <div style="display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap">
        <strong>{{ CATEGORY_ICONS[it.category] }} {{ it.name }}</strong>
        <ExpiryBadge :expiry-date="it.expiryDate" :now="store.nowIso" />
      </div>
      <div class="muted" style="margin: 6px 0">状态：{{ ITEM_STATUS_LABELS[it.status] }} · 批号 {{ it.batchNo ?? '未标注' }} · 地点：{{ it.location }}</div>
      <div class="card-actions">
        <button class="btn btn-danger btn-sm" @click="scrapItem(it.id, '已过有效期，工作人员报废并按医疗/有害垃圾处理')">确认报废</button>
      </div>
    </div>

    <h3 class="section-title">⏳ 效期 60 天内（提醒共享人优先流转或到期前报废）</h3>
    <div v-if="!store.expiringSoon.length" class="card empty">近期没有临近效期的物品。</div>
    <div v-for="x in store.expiringSoon" :key="x.item.id" class="card">
      <div style="display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap">
        <strong>{{ CATEGORY_ICONS[x.item.category] }} {{ x.item.name }} · {{ x.item.spec }}</strong>
        <ExpiryBadge :expiry-date="x.item.expiryDate" :now="store.nowIso" />
      </div>
      <div class="muted" style="margin: 6px 0">
        共享人：{{ x.item.ownerName }} · 批号 {{ x.item.batchNo ?? '未标注' }} · 可借 {{ store.availableQty(x.item.id) }}/{{ x.item.quantity }}
      </div>
      <div class="card-actions">
        <button class="btn btn-sm" @click="show(`已提醒共享人 ${x.item.ownerName}：物品 ${x.days} 天后到期（演示消息）`)">📞 提醒共享人</button>
        <button class="btn btn-sm" @click="router.push(`/items/${x.item.id}`)">查看物品</button>
      </div>
    </div>
  </template>

  <!-- 双重复核 -->
  <template v-else-if="tab === 'review2'">
    <div v-if="!secondReviewQueue.length" class="card empty">没有需要工作人员复核的“其他非处方耗材”。</div>
    <div v-for="it in secondReviewQueue" :key="it.id" class="card">
      <strong>{{ it.name }} · {{ it.spec }}</strong>
      <div class="muted" style="margin: 6px 0">
        登记人：{{ it.ownerName }} · 志愿者 {{ it.review?.reviewerName }} 已初审：{{ it.review?.reason }}
      </div>
      <p class="muted">{{ CATEGORY_LABELS[it.category] }}：请确认确属未拆封非处方耗材、无药品成分、无需冷链且效期合规。</p>
      <div class="card-actions">
        <button class="btn btn-primary btn-sm" @click="approve2(it.id)">复核通过，发布</button>
        <button class="btn btn-danger btn-sm" @click="reject2(it.id)">复核驳回</button>
      </div>
    </div>
  </template>

  <!-- 全链路追溯 -->
  <template v-else>
    <div class="card">
      <label class="field" style="margin-bottom: 8px">
        <span>选择一件物品，查看从登记到报废的完整链路</span>
        <select v-model="traceId">
          <option value="" disabled>请选择物品…</option>
          <option v-for="it in [...store.items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))" :key="it.id" :value="it.id">
            {{ it.name }} · {{ it.spec }}（{{ it.ownerName }} / {{ ITEM_STATUS_LABELS[it.status] }}）
          </option>
        </select>
      </label>
      <div v-if="traceId">
        <TimelineView :events="store.itemTimeline(traceId)" />
      </div>
      <div v-else class="empty">选择物品后，这里展示登记 → 审核 → 发布 → 申请/候补 → 锁定 → 交接拍照 → 归还/补充 → 反馈 → 同批次冻结 → 核查结论/风险提醒的全部记录。</div>
    </div>
  </template>
</template>
