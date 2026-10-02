<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMedkitStore } from '@/stores/medkit'
import { useFlash } from '@/composables/useFlash'
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  FEEDBACK_TYPE_LABELS,
  METHOD_LABELS,
  SCENE_HINTS,
  SCENE_LABELS,
  STORAGE_LABELS,
  SYMPTOM_LABELS,
  USAGE_LABELS,
} from '@/rules'
import { daysUntil, fmtDateTime } from '@/utils/date'
import type { HandoverMethod, Scene } from '@/types'
import SafetyBanner from '@/components/SafetyBanner.vue'
import ExpiryBadge from '@/components/ExpiryBadge.vue'
import ItemStatusBadge from '@/components/ItemStatusBadge.vue'
import TimelineView from '@/components/TimelineView.vue'
import RequestCard from '@/components/RequestCard.vue'
import FeedbackPanel from '@/components/FeedbackPanel.vue'
import AlternativesCard from '@/components/AlternativesCard.vue'
import RiskNoticeBadge from '@/components/RiskNoticeBadge.vue'

const route = useRoute()
const router = useRouter()
const store = useMedkitStore()
const { show } = useFlash()

const item = computed(() => store.items.find((i) => i.id === route.params.id))
const available = computed(() => (item.value ? store.availableQty(item.value.id) : 0))
const waiting = computed(() => (item.value ? store.waitingList(item.value.id) : []))
const relatedRequests = computed(() => (item.value ? store.itemRequests(item.value.id) : []))
const itemFeedback = computed(() => (item.value ? store.feedbacks.filter((f) => f.itemId === item.value!.id) : []))

// ---- 品类风险与批次核查 ----
const riskNotice = computed(() => (item.value ? store.activeRiskNoticeFor(item.value.category) : undefined))
const categoryInvestigation = computed(() => (item.value ? store.investigationForCategory(item.value.category) : undefined))
const itemFrozen = computed(() => !!item.value && (item.value.status === 'quarantined' || !!item.value.frozenByFeedbackId))

// ---- 申请表单 ----
const showApply = ref(false)
const form = reactive<{ quantity: number; scene: Scene; method: HandoverMethod; note: string }>({
  quantity: 1,
  scene: 'child_night_fever',
  method: 'self_pickup',
  note: '',
})
const agreed = reactive({ source: false, expiry: false, package: false, limit: false, risk: false })
const agreeAll = computed(() => agreed.source && agreed.expiry && agreed.package && agreed.limit && (!riskNotice.value || agreed.risk))

const expired = computed(() => (item.value ? daysUntil(item.value.expiryDate, store.nowIso) < 0 : false))
const blocked = computed(() => !item.value || ['rejected', 'recalled', 'scrapped', 'quarantined', 'pending_review'].includes(item.value.status) || !!item.value?.frozenByFeedbackId)

function openApply() {
  if (!item.value) return
  form.quantity = Math.min(1, item.value.quantity) || 1
  form.scene = item.value.sceneTags[0] ?? 'home_care'
  showApply.value = true
}

function submitApply() {
  if (!item.value) return
  if (!agreeAll.value) {
    show('请先逐项确认来源、效期、包装状态、适用限制' + (riskNotice.value ? '与品类风险提醒' : '') + '。', 'err')
    return
  }
  const r = store.apply(item.value.id, form.quantity, form.scene, form.method, form.note || undefined, agreed.risk)
  show(r.message, r.ok ? 'ok' : 'err')
  if (r.ok) {
    showApply.value = false
    router.push('/my-borrows')
  }
}
</script>

<template>
  <SafetyBanner compact />

  <div v-if="!item" class="card empty">
    物品不存在或已被清理。<RouterLink to="/hall">回到药箱大厅</RouterLink>
  </div>

  <template v-else>
    <button class="btn btn-sm" @click="router.push('/hall')">← 返回大厅</button>

    <div v-if="expired" class="banner banner-danger">
      <strong>该物品已过有效期，禁止借用与交接。</strong>
      系统已提示社区工作人员尽快报废，请选择其他在效期内的物品。
    </div>

    <!-- 当前物品所属批次正在核查：强冻结 -->
    <div v-if="itemFrozen" class="banner banner-danger">
      <div class="banner-row">
        <span>🧊</span>
        <div>
          <strong>该物品已冻结：同批次正在社区核查中，暂停一切借用、交接与新申请。</strong>
          {{ item.closeReason }}
          <div v-if="categoryInvestigation" class="muted" style="margin-top: 4px; color: inherit">
            涉及批号：{{ categoryInvestigation.batchNos.join('、') }}；核查结论出来前请勿使用手头同批物品，已取走的居民请停止使用并留意社区回访。
          </div>
        </div>
      </div>
    </div>

    <!-- 同类物品其他批次正在核查：提示但不阻断本物品 -->
    <div v-else-if="categoryInvestigation" class="banner banner-warn">
      <strong>注意：{{ CATEGORY_LABELS[item.category] }}的其他批次（{{ categoryInvestigation.batchNos.join('、') }}）正在风险核查。</strong>
      你查看的物品批号为「{{ item.batchNo ?? '未标注' }}」，不在冻结范围；如使用后出现红肿、瘙痒等不适请立即停用、就医并反馈。
    </div>

    <div v-if="item.status === 'recalled'" class="banner banner-warn">
      <strong>共享人已撤回该物品。</strong>{{ item.closeReason }}
    </div>

    <div class="card">
      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap">
        <span style="font-size: 1.8rem">{{ CATEGORY_ICONS[item.category] }}</span>
        <h2 style="margin: 0">{{ item.name }}</h2>
        <ItemStatusBadge :status="item.status" />
        <ExpiryBadge :expiry-date="item.expiryDate" :now="store.nowIso" />
        <RiskNoticeBadge :category="item.category" />
      </div>

      <dl class="kv" style="margin-top: 14px">
        <dt>品类</dt><dd>{{ CATEGORY_LABELS[item.category] }}</dd>
        <dt>规格</dt><dd>{{ item.spec }}</dd>
        <dt>生产批号</dt>
        <dd>
          <strong>{{ item.batchNo ?? '未填写' }}</strong>
          <span v-if="item.manufacturer" class="muted"> · 厂家：{{ item.manufacturer }}</span>
          <span v-if="!item.batchNo" class="muted">（未登记批号，出现不适时将无法自动联动冻结同批次）</span>
        </dd>
        <dt>有效期</dt><dd>{{ item.expiryDate }}</dd>
        <dt>存放条件</dt><dd>{{ STORAGE_LABELS[item.storage] }}</dd>
        <dt>包装状态</dt><dd>整盒/整包<strong>未开封</strong>（登记人承诺，志愿者已现场/照片核验）</dd>
        <dt>登记数量</dt><dd>{{ item.quantity }}</dd>
        <dt>当前可借</dt>
        <dd>
          <strong :style="{ color: available > 0 ? 'var(--c-primary-dark)' : 'var(--c-warn)' }">{{ available }}</strong>
          <span v-if="waiting.length" class="badge badge-amber" style="margin-left: 8px">{{ waiting.length }} 人候补中</span>
        </dd>
        <dt>来源</dt><dd>邻居 {{ item.ownerName }}（{{ item.review ? `志愿者 ${item.review.reviewerName} 已审核` : '待志愿者审核' }}）</dd>
        <dt>取用地点</dt><dd>{{ item.location }}</dd>
        <dt>适用场景</dt>
        <dd>
          <span v-for="s in item.sceneTags" :key="s" class="badge badge-blue" style="margin: 2px">{{ SCENE_LABELS[s] }}</span>
          <span v-if="!item.sceneTags.length" class="muted">未标注</span>
        </dd>
      </dl>
      <p v-if="item.note" class="muted" style="margin-top: 8px">共享人留言：{{ item.note }}</p>

      <div v-if="riskNotice" class="banner" style="background: #f1eafe; border-color: #d8c4f5; color: #5b21b6; margin-top: 12px">
        <strong>🛑 品类风险提醒（借用前必读）：{{ riskNotice.title }}</strong>
        {{ riskNotice.detail }}
      </div>

      <div class="banner banner-info" style="margin-top: 12px">
        <strong>适用限制（借用前必读）</strong>
        仅用于对应场景下的临时辅助：物理降温、浅表小伤口清洁包扎、口罩应急与居家护理耗材周转。
        本物品<strong>不是药品、不能替代药物与医生诊治</strong>；儿童高热不退、老人伤口较深/出血不止/化脓、呼吸困难等情况请立即就医。
      </div>

      <div class="card-actions" style="margin-top: 12px">
        <button v-if="!blocked && !expired" class="btn btn-primary" @click="openApply">我要申请借用</button>
        <FeedbackPanel ref="feedbackPanel" :item-id="item.id" />
      </div>
    </div>

    <!-- 冻结期间：安全替代与就医渠道 -->
    <AlternativesCard
      v-if="itemFrozen && categoryInvestigation"
      :category="item.category"
      :batch-nos="categoryInvestigation.batchNos"
      :exclude-item-id="item.id"
    />

    <!-- 申请弹窗 -->
    <div v-if="showApply" class="card" style="border: 2px solid var(--c-primary)">
      <h3>申请借用「{{ item.name }}」</h3>
      <label class="field">
        <span>使用场景</span>
        <select v-model="form.scene">
          <option v-for="[k, v] in Object.entries(SCENE_LABELS)" :key="k" :value="k">{{ v }}</option>
        </select>
        <span class="hint">{{ SCENE_HINTS[form.scene] }}</span>
      </label>
      <label class="field">
        <span>借用数量（当前可借 {{ available }}）</span>
        <input v-model.number="form.quantity" type="number" min="1" :max="item.quantity" />
      </label>
      <label class="field">
        <span>交接方式</span>
        <select v-model="form.method">
          <option value="self_pickup">{{ METHOD_LABELS.self_pickup }}：自行到 {{ item.location }} 取</option>
          <option value="volunteer_delivery">{{ METHOD_LABELS.volunteer_delivery }}：志愿者按约定时限代送</option>
          <option value="door_contactless">{{ METHOD_LABELS.door_contactless }}：放到约定门口位置</option>
        </select>
      </label>
      <label class="field">
        <span>备注（可选）</span>
        <textarea v-model="form.note" placeholder="例如：老人行动不便、希望今晚 8 点后送达"></textarea>
      </label>

      <div v-if="riskNotice" class="banner" style="background: #f1eafe; border-color: #d8c4f5; color: #5b21b6">
        <strong>该品类有个体过敏风险提醒，请确认：</strong>
        <label class="check-row">
          <input type="checkbox" v-model="agreed.risk" />
          我已知晓<strong>{{ CATEGORY_LABELS[item.category] }}</strong>曾有个体过敏反馈；我（或使用人）无相关过敏史，知晓使用后出现红肿、瘙痒、皮疹等反应时需立即停用、就医并反馈。
        </label>
      </div>

      <div class="banner banner-warn">
        <strong>请逐项确认后再提交（每次借用都必须看到这些事项）</strong>
        <label class="check-row"><input type="checkbox" v-model="agreed.source" /> 我已知晓<strong>来源</strong>：{{ item.ownerName }} 共享、志愿者审核，社区只做物品流转，不做担保与诊断。</label>
        <label class="check-row"><input type="checkbox" v-model="agreed.expiry" /> 我已核对<strong>效期与批号</strong>：有效期 {{ item.expiryDate }}、批号 {{ item.batchNo ?? '未标注' }}，临期物品会显著标注，过期不得使用。</label>
        <label class="check-row"><input type="checkbox" v-model="agreed.package" /> 我将在交接时检查<strong>包装状态</strong>：须整盒/整包未开封、封签完好；破损当场拒收并拍照反馈。</label>
        <label class="check-row"><input type="checkbox" v-model="agreed.limit" /> 我了解<strong>适用限制</strong>：仅限临时辅助，不替代就医；如症状加重或使用后不适立即就医并反馈，同批次可能被立即冻结。</label>
      </div>

      <div>
        <button class="btn btn-primary" :disabled="!agreeAll" @click="submitApply">确认无误，提交申请</button>
        <button class="btn" @click="showApply = false">取消</button>
      </div>
    </div>

    <!-- 同物品的借用记录 -->
    <h3 class="section-title">🔗 该物品的借用/候补记录（与登记审核串联）</h3>
    <template v-if="relatedRequests.length">
      <RequestCard v-for="r in relatedRequests" :key="r.id" :req="r" :item-name="item.name" />
    </template>
    <div v-else class="empty">暂无借用记录</div>

    <!-- 反馈记录（含核查结论） -->
    <template v-if="itemFeedback.length">
      <h3 class="section-title">⚠️ 风险反馈与核查记录（{{ itemFeedback.length }}）</h3>
      <div v-for="f in itemFeedback" :key="f.id" class="card" :class="f.status === 'open' ? 'fb-open' : 'fb-done'">
        <div style="display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap">
          <strong>{{ FEEDBACK_TYPE_LABELS[f.type] }}</strong>
          <span class="badge" :class="f.status === 'open' ? 'badge-red' : f.status === 'resolved_scrap' ? 'badge-red' : f.status === 'resolved_risk_notice' ? 'badge-purple' : 'badge-green'">
            {{ f.status === 'open' ? '待社区核查' : f.status === 'resolved_scrap' ? '已核查：物品问题，同批次报废' : f.status === 'resolved_risk_notice' ? '已核查：个体过敏+风险提醒' : '已核查：解除冻结' }}
          </span>
        </div>
        <p style="margin: 6px 0">{{ f.detail }}</p>
        <div class="muted">{{ f.reporterName }} 报告 · {{ fmtDateTime(f.createdAt) }}</div>

        <template v-if="f.type === 'adverse_reaction'">
          <dl class="kv" style="margin-top: 6px">
            <dt>表现</dt>
            <dd><span v-for="s in f.symptoms ?? []" :key="s" class="badge badge-amber" style="margin: 2px">{{ SYMPTOM_LABELS[s] }}</span></dd>
            <dt>过敏史</dt><dd>{{ f.allergyHistory ?? '未填写' }}</dd>
            <dt>使用方式</dt><dd>{{ f.usageMethod ? USAGE_LABELS[f.usageMethod] : '未填写' }}<span v-if="f.usageDetail">（{{ f.usageDetail }}）</span></dd>
            <dt v-if="f.packagePhotos?.length">包装照片</dt>
            <dd v-if="f.packagePhotos?.length"><span v-for="(p, i) in f.packagePhotos" :key="i">📷 {{ p }}<br v-if="i < (f.packagePhotos!.length - 1)" /></span></dd>
            <dt>就医情况</dt>
            <dd>{{ f.soughtMedicalCare ? `已就医${f.medicalNote ? `：${f.medicalNote}` : ''}` : '尚未就医（已提示观察/随诊）' }}</dd>
          </dl>
        </template>

        <div v-if="f.investigation" class="banner banner-info" style="margin-top: 8px">
          <strong>🔬 社区核查结论（{{ fmtDateTime(f.investigation.at) }} · {{ f.investigation.handlerName }}）</strong>
          结论：{{ f.investigation.conclusion === 'individual_allergy' ? '个体过敏/个体反应' : f.investigation.conclusion === 'item_issue' ? '物品问题' : '暂无法判定' }}；
          处置：{{ f.investigation.action === 'scrap_batch' ? '同批次下架报废' : f.investigation.action === 'restore_with_notice' ? '恢复共享并加入品类风险提醒' : '解除冻结、恢复共享' }}。
          {{ f.investigation.note }}
        </div>
      </div>
    </template>

    <h3 class="section-title">📋 全流程时间线（登记 → 审核 → 借出 → 交接 → 归还/报废 → 反馈/同批次冻结/核查）</h3>
    <div class="card">
      <TimelineView :events="store.itemTimeline(item.id)" />
    </div>
  </template>
</template>

<style scoped>
.fb-open {
  border-left: 4px solid var(--c-danger);
}
.fb-done {
  border-left: 4px solid var(--c-primary);
}
</style>
