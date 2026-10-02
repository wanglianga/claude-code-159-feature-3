<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMedkitStore } from '@/stores/medkit'
import { useFlash } from '@/composables/useFlash'
import {
  ALLERGY_HISTORY_OPTIONS,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  FEEDBACK_TYPE_LABELS,
  METHOD_LABELS,
  SCENE_HINTS,
  SCENE_LABELS,
  STORAGE_LABELS,
  SYMPTOM_OPTIONS,
  USAGE_METHOD_OPTIONS,
} from '@/rules'
import { daysUntil } from '@/utils/date'
import type { FeedbackType, HandoverMethod, Scene } from '@/types'
import SafetyBanner from '@/components/SafetyBanner.vue'
import ExpiryBadge from '@/components/ExpiryBadge.vue'
import ItemStatusBadge from '@/components/ItemStatusBadge.vue'
import TimelineView from '@/components/TimelineView.vue'
import RequestCard from '@/components/RequestCard.vue'
import PhotoCapture from '@/components/PhotoCapture.vue'
import FrozenCategoryBanner from '@/components/FrozenCategoryBanner.vue'

const route = useRoute()
const router = useRouter()
const store = useMedkitStore()
const { show } = useFlash()

const item = computed(() => store.items.find((i) => i.id === route.params.id))
const available = computed(() => (item.value ? store.availableQty(item.value.id) : 0))
const waiting = computed(() => (item.value ? store.waitingList(item.value.id) : []))
const relatedRequests = computed(() => (item.value ? store.itemRequests(item.value.id) : []))
const itemFeedback = computed(() => (item.value ? store.feedbacks.filter((f) => f.itemId === item.value!.id) : []))
const categoryFrozen = computed(() => (item.value ? store.isCategoryFrozen(item.value.category) : false))
const categoryRisk = computed(() => (item.value ? store.categoryWarning(item.value.category) : undefined))
const frozenBatch = computed(() => (item.value ? store.frozenBatches.find((b) => b.key === item.value?.frozenBatchKey) : undefined))

// ---- 申请表单 ----
const showApply = ref(false)
const form = reactive<{ quantity: number; scene: Scene; method: HandoverMethod; note: string }>({
  quantity: 1,
  scene: 'child_night_fever',
  method: 'self_pickup',
  note: '',
})
const agreed = reactive({ source: false, expiry: false, package: false, limit: false })
const agreeAll = computed(() => agreed.source && agreed.expiry && agreed.package && agreed.limit)

const expired = computed(() => (item.value ? daysUntil(item.value.expiryDate, store.nowIso) < 0 : false))
const blocked = computed(() => !item.value || ['rejected', 'recalled', 'scrapped', 'quarantined', 'pending_review'].includes(item.value.status))

function openApply() {
  if (!item.value) return
  if (categoryFrozen.value) {
    show('该品类当前批次正在核查中，已暂停借用；请查看页面上的安全替代物或就医渠道。', 'err')
    return
  }
  form.quantity = Math.min(1, item.value.quantity) || 1
  form.scene = item.value.sceneTags[0] ?? 'home_care'
  showApply.value = true
}

function submitApply() {
  if (!item.value) return
  if (!agreeAll.value) {
    show('请先逐项确认来源、效期、包装状态与适用限制。', 'err')
    return
  }
  const r = store.apply(item.value.id, form.quantity, form.scene, form.method, form.note || undefined)
  show(r.message, r.ok ? 'ok' : 'err')
  if (r.ok) {
    showApply.value = false
    router.push('/my-borrows')
  }
}

// ---- 反馈 ----
const showFeedback = ref(false)
const fbForm = reactive<{
  type: FeedbackType
  detail: string
  symptoms: string[]
  usageMethod: string
  allergyHistory: string
  packagePhoto: string
  soughtMedicalCare: boolean
  medicalNote: string
}>({
  type: 'package_damaged',
  detail: '',
  symptoms: [],
  usageMethod: USAGE_METHOD_OPTIONS[0],
  allergyHistory: ALLERGY_HISTORY_OPTIONS[0],
  packagePhoto: '',
  soughtMedicalCare: false,
  medicalNote: '',
})

function resetFeedbackForm() {
  fbForm.detail = ''
  fbForm.symptoms = []
  fbForm.usageMethod = USAGE_METHOD_OPTIONS[0]
  fbForm.allergyHistory = ALLERGY_HISTORY_OPTIONS[0]
  fbForm.packagePhoto = ''
  fbForm.soughtMedicalCare = false
  fbForm.medicalNote = ''
}

function toggleSymptom(s: string) {
  const idx = fbForm.symptoms.indexOf(s)
  if (idx >= 0) fbForm.symptoms.splice(idx, 1)
  else fbForm.symptoms.push(s)
}

const linkedRequestId = computed(() => (typeof route.query.req === 'string' ? route.query.req : undefined))

function openFeedback() {
  resetFeedbackForm()
  showFeedback.value = true
}

function submitFeedback() {
  if (!item.value) return
  if (fbForm.type === 'adverse_reaction' && !fbForm.symptoms.length) {
    show('请至少勾选一项不适症状表现，便于社区判断个体过敏还是物品问题。', 'err')
    return
  }
  if (fbForm.type === 'adverse_reaction' && !fbForm.packagePhoto) {
    show('请先拍摄包装与生产批号照片，便于同批次定位与追溯。', 'err')
    return
  }
  const r = store.reportFeedback(
    item.value.id,
    fbForm.type,
    fbForm.detail,
    linkedRequestId.value,
    {
    symptoms: fbForm.type === 'adverse_reaction' ? fbForm.symptoms.join('；') : undefined,
    usageMethod: fbForm.type === 'adverse_reaction' ? fbForm.usageMethod : undefined,
    allergyHistory: fbForm.type === 'adverse_reaction' ? fbForm.allergyHistory : undefined,
    packagePhoto: fbForm.type === 'adverse_reaction' ? fbForm.packagePhoto : undefined,
    soughtMedicalCare: fbForm.type === 'adverse_reaction' ? fbForm.soughtMedicalCare : undefined,
    medicalNote: fbForm.type === 'adverse_reaction' && fbForm.soughtMedicalCare ? fbForm.medicalNote || undefined : undefined,
  })
  show(r.message, r.ok ? 'ok' : 'err')
  if (r.ok) {
    showFeedback.value = false
    resetFeedbackForm()
  }
}

const CONCLUSION_TEXT: Record<string, string> = {
  individual_allergy: '个体过敏',
  product_issue: '物品（批次）问题',
  inconclusive: '证据不足',
}
const ACTION_TEXT: Record<string, string> = {
  delist_batch: '同批次下架报废',
  restore: '恢复共享',
  risk_warning: '恢复并加入风险提醒',
  continue_freeze: '维持冻结继续核查',
}
</script>

<template>
  <SafetyBanner compact />

  <div v-if="!item" class="card empty">
    物品不存在或已被清理。<RouterLink to="/hall">回到药箱大厅</RouterLink>
  </div>

  <template v-else>
    <button class="btn btn-sm" @click="router.push('/hall')">← 返回大厅</button>

    <!-- 同品类批次冻结：任何入口都提示核查中 + 替代物 + 就医渠道 -->
    <FrozenCategoryBanner :category="item.category" />

    <div v-if="expired" class="banner banner-danger">
      <strong>该物品已过有效期，禁止借用与交接。</strong>
      系统已提示社区工作人员尽快报废，请选择其他在效期内的物品。
    </div>
    <div v-if="item.status === 'quarantined'" class="banner banner-danger">
      <strong>该物品已被冻结/隔离，暂停一切借用与交接。</strong>
      {{ item.closeReason }}
      <div v-if="frozenBatch" class="muted" style="color: inherit; opacity: 0.9; margin-top: 4px">
        冻结批次：{{ frozenBatch.label }} · 冻结于 {{ frozenBatch.frozenAt.replace('T', ' ').slice(0, 16) }} · 涉及 {{ frozenBatch.itemIds.length }} 件物品
      </div>
    </div>
    <div v-if="item.status === 'recalled'" class="banner banner-warn">
      <strong>共享人已撤回该物品。</strong>{{ item.closeReason }}
    </div>
    <!-- 品类风险提醒：个体过敏核查后长期挂出 -->
    <div v-if="categoryRisk && ['published', 'partially_lent', 'lent_out'].includes(item.status)" class="banner banner-warn">
      <strong>🟡 本品类风险提醒（社区核查后加挂）</strong>
      {{ categoryRisk.note }}
    </div>

    <div class="card">
      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap">
        <span style="font-size: 1.8rem">{{ CATEGORY_ICONS[item.category] }}</span>
        <h2 style="margin: 0">{{ item.name }}</h2>
        <ItemStatusBadge :status="item.status" />
        <ExpiryBadge :expiry-date="item.expiryDate" :now="store.nowIso" />
      </div>

      <dl class="kv" style="margin-top: 14px">
        <dt>品类</dt><dd>{{ CATEGORY_LABELS[item.category] }}</dd>
        <dt>规格</dt><dd>{{ item.spec }}</dd>
        <dt>生产批号</dt>
        <dd>
          {{ item.batchNo?.trim() || '未标注（无法精确联动同批次冻结）' }}
          <span v-if="frozenBatch" class="badge badge-red" style="margin-left: 6px">该批号已冻结</span>
        </dd>
        <dt>有效期</dt><dd>{{ item.expiryDate }}</dd>
        <dt>存放条件</dt><dd>{{ STORAGE_LABELS[item.storage] }}</dd>
        <dt>包装状态</dt><dd>整盒/整包<strong>未开封</strong>（登记人承诺，志愿者已现场/照片核验）</dd>
        <dt>登记数量</dt><dd>{{ item.quantity }}</dd>
        <dt>当前可借</dt>
        <dd>
          <strong :style="{ color: available > 0 ? 'var(--c-primary-dark)' : 'var(--c-warn)' }">{{ categoryFrozen ? 0 : available }}</strong>
          <span v-if="waiting.length" class="badge badge-amber" style="margin-left: 8px">{{ waiting.length }} 人候补中</span>
          <span v-if="categoryFrozen" class="badge badge-red" style="margin-left: 8px">批次核查中</span>
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
      <p v-if="item.riskNote" class="banner banner-warn" style="margin-top: 8px">{{ item.riskNote }}</p>

      <div class="banner banner-info" style="margin-top: 12px">
        <strong>适用限制（借用前必读）</strong>
        仅用于对应场景下的临时辅助：物理降温、浅表小伤口清洁包扎、口罩应急与居家护理耗材周转。
        本物品<strong>不是药品、不能替代药物与医生诊治</strong>；儿童高热不退、老人伤口较深/出血不止/化脓、呼吸困难等情况请立即就医。
      </div>

      <div class="card-actions" style="margin-top: 12px">
        <button v-if="!blocked && !expired" class="btn btn-primary" @click="openApply">
          {{ categoryFrozen ? '该品类批次核查中，不可申请' : '我要申请借用' }}
        </button>
        <button class="btn btn-danger btn-sm" @click="openFeedback">反馈包装破损 / 使用后不适</button>
      </div>
    </div>

    <!-- 申请弹窗 -->
    <div v-if="showApply && !categoryFrozen" class="card" style="border: 2px solid var(--c-primary)">
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

      <div class="banner banner-warn">
        <strong>请逐项确认后再提交（每次借用都必须看到这四项）</strong>
        <label class="check-row"><input type="checkbox" v-model="agreed.source" /> 我已知晓<strong>来源</strong>：{{ item.ownerName }} 共享、志愿者审核，社区只做物品流转，不做担保与诊断。</label>
        <label class="check-row"><input type="checkbox" v-model="agreed.expiry" /> 我已核对<strong>效期</strong>：{{ item.expiryDate }}，临期物品会显著标注，过期不得使用。</label>
        <label class="check-row"><input type="checkbox" v-model="agreed.package" /> 我将在交接时检查<strong>包装状态</strong>：须整盒/整包未开封、封签完好；破损当场拒收并拍照反馈。</label>
        <label class="check-row"><input type="checkbox" v-model="agreed.limit" /> 我了解<strong>适用限制</strong>：仅限临时辅助，不替代就医；如症状加重或使用后不适立即就医并反馈。</label>
      </div>

      <div>
        <button class="btn btn-primary" :disabled="!agreeAll" @click="submitApply">确认无误，提交申请</button>
        <button class="btn" @click="showApply = false">取消</button>
      </div>
    </div>

    <!-- 反馈弹窗 -->
    <div v-if="showFeedback" class="card" style="border: 2px solid var(--c-danger)">
      <h3>问题反馈（包装破损 / 使用后不适）</h3>
      <label class="field">
        <span>问题类型</span>
        <select v-model="fbForm.type">
          <option value="package_damaged">{{ FEEDBACK_TYPE_LABELS.package_damaged }}</option>
          <option value="adverse_reaction">{{ FEEDBACK_TYPE_LABELS.adverse_reaction }}</option>
          <option value="other">{{ FEEDBACK_TYPE_LABELS.other }}</option>
        </select>
      </label>

      <!-- 不适反应扩展登记 -->
      <template v-if="fbForm.type === 'adverse_reaction'">
        <label class="field">
          <span>症状表现（可多选）</span>
          <div>
            <label v-for="s in SYMPTOM_OPTIONS" :key="s" class="check-row">
              <input type="checkbox" :checked="fbForm.symptoms.includes(s)" @change="toggleSymptom(s)" /> {{ s }}
            </label>
          </div>
        </label>
        <label class="field">
          <span>使用方式</span>
          <select v-model="fbForm.usageMethod">
            <option v-for="m in USAGE_METHOD_OPTIONS" :key="m" :value="m">{{ m }}</option>
          </select>
        </label>
        <label class="field">
          <span>过敏史</span>
          <select v-model="fbForm.allergyHistory">
            <option v-for="a in ALLERGY_HISTORY_OPTIONS" :key="a" :value="a">{{ a }}</option>
          </select>
        </label>
        <label class="field">
          <span>包装与生产批号照片（用于同批次定位）</span>
          <PhotoCapture label="📷 拍摄包装/批号照片" prefix="feedback-package" @captured="(p) => (fbForm.packagePhoto = p)" />
        </label>
        <label class="check-row field">
          <input type="checkbox" v-model="fbForm.soughtMedicalCare" />
          <span style="font-weight: 600">已就医或计划尽快就医</span>
        </label>
        <label v-if="fbForm.soughtMedicalCare" class="field">
          <span>就医情况（机构 / 诊断 / 医嘱，可选）</span>
          <textarea v-model="fbForm.medicalNote" placeholder="例如：已到社区卫生服务中心，医生考虑接触性皮炎，建议停用观察"></textarea>
        </label>
        <div class="banner banner-danger">
          提交后系统将<strong>立即冻结同批次（批号 {{ item.batchNo?.trim() || '未标注' }}）剩余物品</strong>，
          并通知共享人、社区工作人员与已借用居民；如出现皮疹、红肿加重、呼吸不畅，请<strong>立即停止使用并就医</strong>，保留物品与包装备查。
        </div>
      </template>

      <label class="field">
        <span>具体情况</span>
        <textarea v-model="fbForm.detail" placeholder="请描述发现时间、包装/身体反应具体表现、处理过程（已停用/清水冲洗等）"></textarea>
      </label>

      <button class="btn btn-danger" @click="submitFeedback">
        {{ fbForm.type === 'adverse_reaction' ? '提交反馈并立即冻结同批次' : '提交反馈并隔离该物品' }}
      </button>
      <button class="btn" @click="showFeedback = false">取消</button>
    </div>

    <!-- 同物品的借用记录 -->
    <h3 class="section-title">🔗 该物品的借用/候补记录（与登记审核串联）</h3>
    <template v-if="relatedRequests.length">
      <RequestCard v-for="r in relatedRequests" :key="r.id" :req="r" :item-name="item.name" />
    </template>
    <div v-else class="empty">暂无借用记录</div>

    <!-- 反馈记录 -->
    <template v-if="itemFeedback.length">
      <h3 class="section-title">⚠️ 风险反馈（{{ itemFeedback.length }}）</h3>
      <div v-for="f in itemFeedback" :key="f.id" class="banner" :class="f.status === 'open' ? 'banner-danger' : 'banner-info'">
        <strong>
          {{ FEEDBACK_TYPE_LABELS[f.type] }} ·
          {{ f.status === 'open' ? '待工作人员核查' : f.status === 'resolved_scrap' ? '已处置：下架报废' : f.status === 'resolved_warning' ? '已处置：恢复并加风险提醒' : '已处置：恢复共享' }}
        </strong>
        <div style="margin-top: 4px">{{ f.detail }}</div>
        <div class="muted" style="color: inherit; opacity: 0.9">{{ f.reporterName }} 报告 · {{ f.createdAt.replace('T', ' ').slice(0, 16) }}</div>

        <!-- 不适反应核查登记表 -->
        <template v-if="f.type === 'adverse_reaction'">
          <dl class="kv fb-kv">
            <dt>症状</dt><dd>{{ f.symptoms || '—' }}</dd>
            <dt>使用方式</dt><dd>{{ f.usageMethod || '—' }}</dd>
            <dt>过敏史</dt><dd>{{ f.allergyHistory || '—' }}</dd>
            <dt>包装照片</dt><dd>{{ f.packagePhoto || '未上传' }}</dd>
            <dt>是否就医</dt><dd>{{ f.soughtMedicalCare ? '是' : '否' }}<template v-if="f.medicalNote">：{{ f.medicalNote }}</template></dd>
            <template v-if="f.investigation">
              <dt>核查结论</dt>
              <dd>
                <span class="badge" :class="f.investigation.conclusion === 'product_issue' ? 'badge-red' : 'badge-amber'">
                  {{ CONCLUSION_TEXT[f.investigation.conclusion] }}
                </span>
                → {{ ACTION_TEXT[f.investigation.action] }}
              </dd>
              <dt>核查说明</dt><dd>{{ f.investigation.note }}</dd>
              <dt>核查人/时间</dt><dd>{{ f.investigation.staffName }} · {{ f.investigation.at.replace('T', ' ').slice(0, 16) }}</dd>
            </template>
          </dl>
        </template>
      </div>
    </template>

    <h3 class="section-title">📋 全流程时间线（登记 → 审核 → 借出 → 交接 → 归还/冻结/核查 → 反馈）</h3>
    <div class="card">
      <TimelineView :events="store.itemTimeline(item.id)" />
    </div>
  </template>
</template>

<style scoped>
.fb-kv {
  grid-template-columns: 88px 1fr;
  margin-top: 8px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 8px;
  padding: 8px 10px;
}
</style>
