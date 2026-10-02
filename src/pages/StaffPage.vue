<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMedkitStore } from '@/stores/medkit'
import { useFlash } from '@/composables/useFlash'
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  FEEDBACK_TYPE_LABELS,
  ITEM_STATUS_LABELS,
} from '@/rules'
import type { Feedback, InvestigationConclusion, RiskAction } from '@/types'
import SafetyBanner from '@/components/SafetyBanner.vue'
import ExpiryBadge from '@/components/ExpiryBadge.vue'
import ItemStatusBadge from '@/components/ItemStatusBadge.vue'
import TimelineView from '@/components/TimelineView.vue'

const store = useMedkitStore()
const router = useRouter()
const { show } = useFlash()
const tab = ref<'risk' | 'expiry' | 'review2' | 'trace'>('risk')
const traceId = ref('')

const stats = computed(() => store.stats)
const secondReviewQueue = computed(() => store.items.filter((i) => i.status === 'pending_review' && i.category === 'other_consumable' && i.review?.approved))
const quarantined = computed(() => store.items.filter((i) => i.status === 'quarantined'))
const activeFrozen = computed(() => store.activeFrozenBatches)

const openAdverse = computed(() => store.openFeedbackList.filter((f) => f.type === 'adverse_reaction'))
const openOther = computed(() => store.openFeedbackList.filter((f) => f.type !== 'adverse_reaction'))

/** 每个不适反馈的核查表单 */
const forms = reactive<Record<string, { conclusion: InvestigationConclusion; note: string }>>({})
function formOf(f: Feedback) {
  if (!forms[f.id]) forms[f.id] = { conclusion: 'individual_allergy', note: '' }
  return forms[f.id]
}

const CONCLUSION_OPTIONS: Array<{ value: InvestigationConclusion; label: string; hint: string }> = [
  { value: 'individual_allergy', label: '个体过敏', hint: '反馈人个人体质反应，同批次其他居民无异常、包装与来源核验合格' },
  { value: 'product_issue', label: '物品（批次）问题', hint: '多人出现类似反应、包装/外观异常或供货渠道无法确认，需同批次下架' },
  { value: 'inconclusive', label: '证据不足', hint: '暂时无法判定，维持冻结并继续回访/取证' },
]

function feedbackItem(itemId: string) {
  return store.items.find((i) => i.id === itemId)
}

function batchOf(f: Feedback) {
  return f.batchKey ? store.frozenBatches.find((b) => b.key === f.batchKey) : undefined
}

function runInvestigation(f: Feedback, action: RiskAction) {
  const fm = formOf(f)
  const conclusion: InvestigationConclusion =
    action === 'continue_freeze' ? 'inconclusive' : action === 'delist_batch' ? 'product_issue' : fm.conclusion === 'product_issue' ? 'product_issue' : 'individual_allergy'
  const note = fm.note.trim()
  if (!note) {
    show('请填写核查说明（回访情况与判定依据）后再提交。', 'err')
    return
  }
  const r = store.investigateFeedback(f.id, conclusion, action, note)
  show(r.message, r.ok ? 'ok' : 'err')
  if (r.ok) fm.note = ''
}

function scrapFeedback(fid: string) {
  const note = window.prompt('核查与报废说明：', '确认包装/安全性不合格，报废并按医疗垃圾流程处理')
  if (note === null) return
  const r = store.resolveFeedback(fid, 'scrap', note || '核查报废')
  show(r.message, r.ok ? 'ok' : 'err')
}
function republishFeedback(fid: string) {
  const note = window.prompt('核查后重新发布的依据：', '现场核验包装封签完好，反馈问题排除，恢复共享')
  if (note === null) return
  const r = store.resolveFeedback(fid, 'republish', note || '核查无误')
  show(r.message, r.ok ? 'ok' : 'err')
}
function scrapItem(id: string) {
  const r = store.scrapItem(id, '工作人员核查后报废：隔离物品复核不合格')
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
      工作人员的重点：守住安全底线——使用后不适的<strong>同批次冻结核查</strong>、风险反馈处置、过期报废、双重复核与全链路追溯。社区只做<strong>物品流转和风险提醒</strong>，不做诊断结论。
    </div>
    <div class="stat-cards" style="margin-top: 12px; margin-bottom: 0">
      <div class="stat-card"><div class="num" :style="{ color: 'var(--c-danger)' }">{{ stats.openFeedback }}</div><div class="lbl">待处置风险反馈</div></div>
      <div class="stat-card"><div class="num" :style="{ color: 'var(--c-danger)' }">{{ stats.frozenBatches }}</div><div class="lbl">冻结中批次</div></div>
      <div class="stat-card"><div class="num" :style="{ color: 'var(--c-danger)' }">{{ stats.quarantined }}</div><div class="lbl">风险隔离中物品</div></div>
      <div class="stat-card"><div class="num" :style="{ color: 'var(--c-warn)' }">{{ stats.expired }}</div><div class="lbl">已过期待报废</div></div>
      <div class="stat-card"><div class="num">{{ stats.reviewCount }}</div><div class="lbl">志愿者待审</div></div>
      <div class="stat-card"><div class="num">{{ stats.inFlight }}</div><div class="lbl">交接中</div></div>
      <div class="stat-card"><div class="num">{{ stats.waiting }}</div><div class="lbl">候补中</div></div>
      <div class="stat-card"><div class="num">{{ stats.scrapped }}</div><div class="lbl">累计报废</div></div>
    </div>
    <div class="tabs" style="margin-top: 14px; margin-bottom: 0">
      <button class="chip" :class="{ active: tab === 'risk' }" @click="tab = 'risk'">
        冻结核查与风险反馈（{{ stats.openFeedback + stats.frozenBatches }}）
      </button>
      <button class="chip" :class="{ active: tab === 'expiry' }" @click="tab = 'expiry'">效期与报废</button>
      <button class="chip" :class="{ active: tab === 'review2' }" @click="tab = 'review2'">复核（{{ secondReviewQueue.length }}）</button>
      <button class="chip" :class="{ active: tab === 'trace' }" @click="tab = 'trace'">全链路追溯</button>
    </div>
  </div>

  <!-- 风险反馈处置 -->
  <template v-if="tab === 'risk'">
    <div v-if="!store.openFeedbackList.length && !quarantined.length" class="card empty">没有待处置的风险反馈、冻结批次与隔离物品。</div>

    <!-- 冻结中批次总览 -->
    <h3 v-if="activeFrozen.length" class="section-title">🧊 冻结中批次（{{ activeFrozen.length }}）—— 剩余物品已全部停止借用与交接</h3>
    <div v-for="b in activeFrozen" :key="b.key" class="card" style="border-left: 4px solid var(--c-danger)">
      <div style="display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap">
        <strong>{{ CATEGORY_ICONS[b.category] }} {{ b.label }}</strong>
        <span class="badge badge-red">冻结中 · {{ b.itemIds.length }} 件</span>
      </div>
      <div class="muted" style="margin: 6px 0">冻结原因：{{ b.reason }}</div>
      <div class="muted">冻结于 {{ b.frozenAt.replace('T', ' ').slice(0, 16) }} · 涉及物品：
        <RouterLink v-for="(id, i) in b.itemIds" :key="id" :to="`/items/${id}`">
          {{ feedbackItem(id)?.name ?? id }}<span v-if="i < b.itemIds.length - 1">、</span>
        </RouterLink>
      </div>
    </div>

    <!-- 疑似使用后不适：登记信息 + 核查结论 -->
    <h3 v-if="openAdverse.length" class="section-title">🩺 使用后不适反馈核查（{{ openAdverse.length }}）</h3>
    <div v-for="f in openAdverse" :key="f.id" class="card" style="border-left: 4px solid var(--c-danger)">
      <div style="display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap">
        <strong>{{ FEEDBACK_TYPE_LABELS[f.type] }}：{{ feedbackItem(f.itemId)?.name ?? f.itemId }}</strong>
        <span class="badge badge-red">待核查</span>
      </div>
      <p style="margin: 8px 0">{{ f.detail }}</p>

      <dl class="kv inv-kv">
        <dt>报告人</dt><dd>{{ f.reporterName }} · {{ f.createdAt.replace('T', ' ').slice(0, 16) }}</dd>
        <dt>症状表现</dt><dd>{{ f.symptoms || '未登记' }}</dd>
        <dt>使用方式</dt><dd>{{ f.usageMethod || '未登记' }}</dd>
        <dt>过敏史</dt><dd>{{ f.allergyHistory || '未登记' }}</dd>
        <dt>包装照片</dt><dd>{{ f.packagePhoto || '未上传' }}</dd>
        <dt>是否就医</dt>
        <dd>
          {{ f.soughtMedicalCare ? '是' : '否' }}
          <template v-if="f.medicalNote">：{{ f.medicalNote }}</template>
        </dd>
        <dt>关联批次</dt>
        <dd>
          {{ f.batchLabel || '该物品未标注批号，仅冻结单件' }}
          <span v-if="batchOf(f)" class="muted">（已连带冻结 {{ batchOf(f)!.itemIds.length }} 件、通知共享人与已借用居民）</span>
        </dd>
      </dl>

      <div v-if="feedbackItem(f.itemId)" class="muted" style="margin-top: 6px">
        源物品当前状态：<ItemStatusBadge :status="feedbackItem(f.itemId)!.status" />
      </div>

      <!-- 核查表单 -->
      <div class="invest-box">
        <div style="font-weight: 700; margin-bottom: 6px">工作人员核查结论</div>
        <label v-for="opt in CONCLUSION_OPTIONS" :key="opt.value" class="check-row">
          <input type="radio" :name="`conclusion_${f.id}`" :value="opt.value" v-model="formOf(f).conclusion" />
          <span><strong>{{ opt.label }}</strong>：{{ opt.hint }}</span>
        </label>
        <label class="field" style="margin-top: 6px">
          <span>核查 / 回访说明（必填，会写入时间线并同步通知居民）</span>
          <textarea v-model="formOf(f).note" placeholder="例如：电话回访反馈人，已就医诊断接触性皮炎；同批次另 2 位借用人无异常，核验封签与进货记录合格，判定个体过敏"></textarea>
        </label>
        <div class="card-actions">
          <button class="btn btn-danger btn-sm" @click="runInvestigation(f, 'delist_batch')">⛔ 判定物品问题：同批次下架报废</button>
          <button class="btn btn-warn btn-sm" @click="runInvestigation(f, 'risk_warning')">🟡 个体过敏：恢复并加品类风险提醒</button>
          <button class="btn btn-primary btn-sm" @click="runInvestigation(f, 'restore')">✅ 个体/偶发：恢复共享</button>
          <button class="btn btn-sm" @click="runInvestigation(f, 'continue_freeze')">⏳ 证据不足：维持冻结继续核查</button>
          <button class="btn btn-sm" @click="router.push(`/items/${f.itemId}`)">打开物品全流程</button>
        </div>
        <div class="muted" style="margin-top: 6px">
          选择“个体过敏”时建议加挂风险提醒；处置后系统会再次通知共享人与已借用居民，避免风险物品继续扩散。
        </div>
      </div>
    </div>

    <!-- 包装破损 / 其他反馈 -->
    <h3 v-if="openOther.length" class="section-title">📦 包装破损 / 其他反馈（{{ openOther.length }}）</h3>
    <div v-for="f in openOther" :key="f.id" class="card" style="border-left: 4px solid var(--c-warn)">
      <div style="display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap">
        <strong>{{ FEEDBACK_TYPE_LABELS[f.type] }}：{{ feedbackItem(f.itemId)?.name ?? f.itemId }}</strong>
        <span class="badge badge-amber">待核查</span>
      </div>
      <p style="margin: 8px 0">{{ f.detail }}</p>
      <div class="muted">报告人：{{ f.reporterName }} · 时间：{{ f.createdAt.replace('T', ' ').slice(0, 16) }}</div>
      <div v-if="feedbackItem(f.itemId)" class="muted" style="margin-top: 6px">
        当前物品状态：<ItemStatusBadge :status="feedbackItem(f.itemId)!.status" />
      </div>
      <div class="card-actions">
        <button class="btn btn-danger btn-sm" @click="scrapFeedback(f.id)">核查后报废</button>
        <button class="btn btn-primary btn-sm" @click="republishFeedback(f.id)">核验无问题，解除隔离重新发布</button>
        <button class="btn btn-sm" @click="router.push(`/items/${f.itemId}`)">打开物品全流程</button>
      </div>
    </div>

    <h3 v-if="quarantined.length" class="section-title">已隔离物品（暂停一切借用与交接）</h3>
    <div v-for="it in quarantined" :key="it.id" class="card">
      <div style="display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap">
        <strong>{{ CATEGORY_ICONS[it.category] }} {{ it.name }} · {{ it.spec }}</strong>
        <ItemStatusBadge :status="it.status" />
      </div>
      <div class="muted" style="margin: 6px 0">
        {{ it.closeReason }}
        <span v-if="it.frozenBatchKey" class="badge badge-red" style="margin-left: 6px">同批次连带冻结</span>
      </div>
      <div class="card-actions">
        <button class="btn btn-danger btn-sm" @click="scrapItem(it.id)">直接报废</button>
        <button class="btn btn-sm" @click="router.push(`/items/${it.id}`)">查看反馈与时间线</button>
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
      <div class="muted" style="margin: 6px 0">状态：{{ ITEM_STATUS_LABELS[it.status] }} · 地点：{{ it.location }}</div>
      <div class="card-actions">
        <button class="btn btn-danger btn-sm" @click="store.scrapItem(it.id, '已过有效期，工作人员报废并按医疗/有害垃圾处理')">确认报废</button>
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
        共享人：{{ x.item.ownerName }} · 批号：{{ x.item.batchNo || '未标注' }} · 可借 {{ store.availableQty(x.item.id) }}/{{ x.item.quantity }}
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
      <div v-else class="empty">选择物品后，这里展示登记 → 审核 → 发布 → 申请/候补 → 锁定 → 交接拍照 → 归还/补充 → 反馈/同批次冻结 → 核查下架或恢复的全部记录。</div>
    </div>
  </template>
</template>

<style scoped>
.inv-kv {
  grid-template-columns: 88px 1fr;
  margin-top: 8px;
  background: var(--c-gray-100);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 0.86rem;
}
.invest-box {
  margin-top: 10px;
  border: 1px solid #f3c0c0;
  border-radius: 10px;
  padding: 12px;
  background: #fff8f8;
}
</style>
