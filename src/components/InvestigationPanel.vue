<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMedkitStore } from '@/stores/medkit'
import { useFlash } from '@/composables/useFlash'
import { CATEGORY_LABELS, FEEDBACK_TYPE_LABELS, SYMPTOM_LABELS, USAGE_LABELS } from '@/rules'
import { fmtDateTime } from '@/utils/date'
import type { Feedback, InvestigationConclusion } from '@/types'
import ItemStatusBadge from './ItemStatusBadge.vue'

const props = defineProps<{ feedback: Feedback }>()
const store = useMedkitStore()
const router = useRouter()
const { show } = useFlash()

const item = computed(() => store.items.find((i) => i.id === props.feedback.itemId))
const frozenItems = computed(() => store.frozenItemsOfFeedback(props.feedback))
const affectedBorrowers = computed(() =>
  [...new Set(
    store.requests
      .filter((r) => frozenItems.value.some((i) => i.id === r.itemId))
      .map((r) => r.applicantName),
  )],
)

const conclusion = ref<InvestigationConclusion>(props.feedback.type === 'adverse_reaction' ? 'individual_allergy' : 'item_issue')
const note = ref('')
const showForm = ref(false)

const ALL_CONCLUSIONS: { value: InvestigationConclusion; label: string; hint: string; actionLabel: string }[] = [
  {
    value: 'individual_allergy',
    label: '个体过敏 / 个体反应',
    hint: '回访+就医记录支持个体体质原因，同批物品包装与质量核验合格：解除冻结、恢复共享，并给该品类加入风险提醒，借用前强制知情确认。',
    actionLabel: '恢复共享并加入风险提醒',
  },
  {
    value: 'item_issue',
    label: '物品问题（批次/包装/质量）',
    hint: '同批号物品存在污染、变质、包装失效或多人出现类似反应：同批次剩余物品全部下架报废，通知全部相关居民并按医疗/有害垃圾处理。',
    actionLabel: '同批次全部下架报废',
  },
  {
    value: 'inconclusive',
    label: '暂无法判定',
    hint: '证据不足、无法联系反馈人或需等待就医结论：先解除冻结恢复借用并持续观察；再次出现同类反馈将重新冻结。',
    actionLabel: '解除冻结，继续观察',
  },
]

/** 包装破损反馈不适用“个体过敏”结论 */
const CONCLUSIONS = computed(() =>
  props.feedback.type === 'adverse_reaction' ? ALL_CONCLUSIONS : ALL_CONCLUSIONS.filter((c) => c.value !== 'individual_allergy'),
)

const selected = computed(() => CONCLUSIONS.value.find((c) => c.value === conclusion.value)!)

function defaultNoteFor(c: InvestigationConclusion): string {
  if (c === 'individual_allergy') return '电话回访反馈人，结合就医记录判断为个体接触性过敏；现场核验同批号物品封签完好、在效期内，恢复共享并加入品类风险提醒。'
  if (c === 'item_issue') return '核验发现同批号物品存在异常，按医疗/有害垃圾流程报废同批次剩余物品，并通知已借用居民停止使用。'
  return '现有信息暂无法判定物品问题，解除冻结并继续关注该批次反馈。'
}

function selectConclusion(c: InvestigationConclusion) {
  conclusion.value = c
  note.value = defaultNoteFor(c)
}

function openForm() {
  if (!note.value) note.value = defaultNoteFor(conclusion.value)
  showForm.value = true
}

function submit() {
  const r = store.resolveFeedback(props.feedback.id, { conclusion: conclusion.value, note: note.value })
  show(r.message, r.ok ? 'ok' : 'err', 7000)
  if (r.ok) showForm.value = false
}
</script>

<template>
  <div class="card" style="border-left: 4px solid var(--c-danger)">
    <div style="display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap">
      <strong>
        {{ FEEDBACK_TYPE_LABELS[feedback.type] }}：{{ item?.name ?? feedback.itemId }}
        <span v-if="item" class="muted">· {{ CATEGORY_LABELS[item.category] }} · 批号 {{ item.batchNo ?? '未标注' }}</span>
      </strong>
      <span class="badge badge-red">待核查</span>
    </div>

    <p style="margin: 8px 0">{{ feedback.detail }}</p>
    <div class="muted">报告人：{{ feedback.reporterName }} · 时间：{{ fmtDateTime(feedback.createdAt) }}</div>

    <!-- 结构化不适信息 -->
    <template v-if="feedback.type === 'adverse_reaction'">
      <dl class="kv" style="margin-top: 8px">
        <dt>表现</dt>
        <dd>
          <span v-for="s in feedback.symptoms ?? []" :key="s" class="badge" style="margin: 2px" :class="s === 'breathing' || s === 'blister' ? 'badge-red' : 'badge-amber'">
            {{ SYMPTOM_LABELS[s] }}
          </span>
          <span v-if="!(feedback.symptoms ?? []).length" class="muted">未勾选</span>
        </dd>
        <dt>过敏史</dt>
        <dd>{{ feedback.allergyHistory ?? '未填写' }}</dd>
        <dt>使用方式</dt>
        <dd>{{ feedback.usageMethod ? USAGE_LABELS[feedback.usageMethod] : '未填写' }}</dd>
        <dt v-if="feedback.usageDetail">使用细节</dt>
        <dd v-if="feedback.usageDetail">{{ feedback.usageDetail }}</dd>
        <dt>包装照片</dt>
        <dd>
          <template v-if="feedback.packagePhotos?.length">
            <div v-for="(p, i) in feedback.packagePhotos" :key="i">📷 {{ p }}</div>
          </template>
          <span v-else class="muted">未上传</span>
        </dd>
        <dt>是否就医</dt>
        <dd>
          <span :class="feedback.soughtMedicalCare ? 'badge badge-blue' : 'badge badge-gray'" class="badge">
            {{ feedback.soughtMedicalCare ? '已就医' : '尚未就医' }}
          </span>
          <span v-if="feedback.medicalNote" class="muted" style="margin-left: 6px">{{ feedback.medicalNote }}</span>
        </dd>
      </dl>
    </template>

    <!-- 冻结范围与通知对象 -->
    <div class="banner banner-danger" style="margin-top: 8px">
      <strong>已立即冻结 {{ frozenItems.length }} 件同批次物品</strong>
      <div v-if="frozenItems.length" style="margin-top: 4px">
        <div v-for="it in frozenItems" :key="it.id" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap">
          <ItemStatusBadge :status="it.status" />
          <span>{{ it.name }} · {{ it.spec }} · 批号 {{ it.batchNo ?? '未标注' }} · 共享人 {{ it.ownerName }}</span>
        </div>
      </div>
      <div class="muted" style="margin-top: 4px; color: inherit">
        已通知：共享人、社区/志愿者、已借用居民{{ affectedBorrowers.length ? `（${affectedBorrowers.join('、')}）` : '' }}；
        在途申请已全部取消，已取走的借用保留并提醒停止使用、观察就医。
      </div>
    </div>

    <div class="card-actions">
      <button class="btn btn-primary btn-sm" @click="openForm">填写核查结论并处置</button>
      <button class="btn btn-sm" @click="router.push(`/items/${feedback.itemId}`)">打开物品全流程</button>
    </div>

    <!-- 核查表单 -->
    <div v-if="showForm" class="invest-form">
      <label v-for="c in CONCLUSIONS" :key="c.value" class="conclusion" :class="{ active: conclusion === c.value }">
        <label class="check-row" style="padding: 2px 0">
          <input type="radio" :checked="conclusion === c.value" @change="selectConclusion(c.value)" />
          <span><strong>{{ c.label }}</strong></span>
        </label>
        <span class="muted" style="font-size: 0.83rem">{{ c.hint }}</span>
      </label>

      <label class="field" style="margin-top: 10px">
        <span>核查记录 / 处置依据（会写入时间线并通知相关居民）</span>
        <textarea v-model="note" rows="3"></textarea>
      </label>

      <div class="banner" :class="conclusion === 'item_issue' ? 'banner-danger' : conclusion === 'individual_allergy' ? 'banner-info' : 'banner-warn'">
        提交后将执行：<strong>{{ selected.actionLabel }}</strong>，并向共享人、已借用居民与在途申请人发送核查结论通知。
      </div>

      <div class="card-actions">
        <button
          class="btn"
          :class="conclusion === 'item_issue' ? 'btn-danger' : 'btn-primary'"
          @click="submit"
        >
          确认：{{ selected.actionLabel }}
        </button>
        <button class="btn" @click="showForm = false">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.invest-form {
  margin-top: 12px;
  border-top: 1px dashed var(--c-gray-300);
  padding-top: 10px;
}
.conclusion {
  display: block;
  border: 1px solid var(--c-gray-200);
  border-radius: 10px;
  padding: 8px 12px;
  margin-bottom: 8px;
  cursor: pointer;
  background: #fff;
}
.conclusion.active {
  border-color: var(--c-primary);
  background: var(--c-primary-soft);
}
</style>
