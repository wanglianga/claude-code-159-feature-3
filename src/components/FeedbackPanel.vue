<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMedkitStore } from '@/stores/medkit'
import { useFlash } from '@/composables/useFlash'
import { FEEDBACK_TYPE_LABELS, SEVERE_SYMPTOMS, SYMPTOM_LABELS, USAGE_LABELS } from '@/rules'
import type { FeedbackType, ReactionSymptom, UsageMethod } from '@/types'

const props = defineProps<{ itemId: string; requestId?: string }>()
const emit = defineEmits<{ submitted: [] }>()

const store = useMedkitStore()
const { show } = useFlash()

const open = ref(false)
const type = ref<FeedbackType>('adverse_reaction')
const detail = ref('')
const symptoms = ref<ReactionSymptom[]>([])
const allergyHistory = ref('')
const usageMethod = ref<UsageMethod>('wipe_wound')
const usageDetail = ref('')
const photos = ref<string[]>([])
const soughtMedicalCare = ref(false)
const medicalNote = ref('')
const submitting = ref(false)

const isAdverse = computed(() => type.value === 'adverse_reaction')
const severeChosen = computed(() => symptoms.value.some((s) => SEVERE_SYMPTOMS.includes(s)))
const symptomEntries = Object.entries(SYMPTOM_LABELS) as [ReactionSymptom, string][]
const usageEntries = Object.entries(USAGE_LABELS) as [UsageMethod, string][]

function reset() {
  detail.value = ''
  symptoms.value = []
  allergyHistory.value = ''
  usageMethod.value = 'wipe_wound'
  usageDetail.value = ''
  photos.value = []
  soughtMedicalCare.value = false
  medicalNote.value = ''
}
function openPanel() {
  open.value = true
}
defineExpose({ open: openPanel })

function toggleSymptom(s: ReactionSymptom) {
  const idx = symptoms.value.indexOf(s)
  if (idx >= 0) symptoms.value.splice(idx, 1)
  else symptoms.value.push(s)
}
function addPhoto() {
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
  photos.value.push(`pkg-${stamp}-${photos.value.length + 1}.jpg（演示凭证：包装/患处情况照片 ${photos.value.length + 1}）`)
}
function removePhoto(i: number) {
  photos.value.splice(i, 1)
}

function submit() {
  submitting.value = true
  const r = store.reportFeedback(
    props.itemId,
    type.value,
    detail.value,
    props.requestId,
    isAdverse.value
      ? {
          detail: detail.value,
          symptoms: symptoms.value,
          allergyHistory: allergyHistory.value,
          usageMethod: usageMethod.value,
          usageDetail: usageDetail.value || undefined,
          packagePhotos: photos.value,
          soughtMedicalCare: soughtMedicalCare.value,
          medicalNote: medicalNote.value || undefined,
        }
      : undefined,
  )
  show(r.message, r.ok ? 'ok' : 'err', 7000)
  submitting.value = false
  if (r.ok) {
    open.value = false
    reset()
    emit('submitted')
  }
}
</script>

<template>
  <div>
    <button class="btn btn-danger btn-sm" @click="open = true">反馈包装破损 / 使用后不适</button>

    <div v-if="open" class="card" style="border: 2px solid var(--c-danger); margin-top: 10px">
      <h3>问题反馈与安全上报</h3>
      <div class="banner banner-danger" style="margin-top: 0">
        提交<strong>使用后不适</strong>后，系统会<strong>立即冻结同品类同批号的剩余物品</strong>，
        并通知共享人、社区工作人员与已借用居民；社区核查结论为个体过敏或物品问题后，才会下架报废、恢复或加入风险提醒。
      </div>

      <label class="field">
        <span>问题类型</span>
        <select v-model="type">
          <option value="adverse_reaction">{{ FEEDBACK_TYPE_LABELS.adverse_reaction }}（如皮肤红肿、瘙痒、起疹）</option>
          <option value="package_damaged">{{ FEEDBACK_TYPE_LABELS.package_damaged }}</option>
          <option value="other">{{ FEEDBACK_TYPE_LABELS.other }}</option>
        </select>
      </label>

      <!-- 不适反馈的结构化信息 -->
      <template v-if="isAdverse">
        <label class="field">
          <span>出现的表现（可多选，至少一项）</span>
          <label v-for="[k, label] in symptomEntries" :key="k" class="check-row">
            <input type="checkbox" :checked="symptoms.includes(k)" @change="toggleSymptom(k)" />
            <span>{{ label }}<strong v-if="SEVERE_SYMPTOMS.includes(k)" style="color: var(--c-danger)">（需立即就医）</strong></span>
          </label>
        </label>

        <div v-if="severeChosen" class="banner banner-danger">
          <strong>你选择的表现可能提示严重过敏反应：</strong>请立即停止使用、用大量清水冲洗，
          出现呼吸不畅、面唇舌肿胀、全身风团或意识改变时<strong>立即拨打 120 / 前往急诊</strong>，并带上物品与包装。
        </div>

        <div class="grid grid-2">
          <label class="field">
            <span>过敏史（本人/家族）</span>
            <input v-model="allergyHistory" type="text" placeholder="如：对胶布/碘伏过敏、无、不清楚" />
            <span class="hint">社区回访判断“个体过敏还是物品问题”的重要依据，可填“不清楚”。</span>
          </label>
          <label class="field">
            <span>使用方式</span>
            <select v-model="usageMethod">
              <option v-for="[k, label] in usageEntries" :key="k" :value="k">{{ label }}</option>
            </select>
          </label>
        </div>
        <label class="field">
          <span>使用情况补充（用量/频率/部位，可选）</span>
          <input v-model="usageDetail" type="text" placeholder="如：用棉片擦拭手腕伤口周围 2 次，约 10 分钟后开始发红" />
        </label>

        <div class="field">
          <span>包装 / 局部情况照片（建议保留包装并拍照）</span>
          <div v-for="(p, i) in photos" :key="i" class="photo-row">
            <span>📷 {{ p }}</span>
            <button class="btn btn-sm btn-danger" @click="removePhoto(i)">删除</button>
          </div>
          <button type="button" class="btn btn-sm" @click="addPhoto">📷 拍照 / 上传凭证（{{ photos.length }} 张）</button>
        </div>

        <div class="field">
          <span>是否已经就医</span>
          <label class="check-row"><input type="radio" :checked="soughtMedicalCare === false" @change="soughtMedicalCare = false" /> 尚未就医，先冲洗观察并报备</label>
          <label class="check-row"><input type="radio" :checked="soughtMedicalCare === true" @change="soughtMedicalCare = true" /> 已经就医 / 正在前往医院</label>
        </div>
        <label v-if="soughtMedicalCare" class="field">
          <span>就医情况（科室、医生判断或处置，可选）</span>
          <textarea v-model="medicalNote" placeholder="如：社区卫生服务站诊断为接触性皮炎，建议停用观察"></textarea>
        </label>
      </template>

      <label class="field">
        <span>具体情况描述</span>
        <textarea v-model="detail" placeholder="请描述发现/使用时间、反应出现时间与变化、包装外观、是否保留同批物品"></textarea>
      </label>

      <div v-if="isAdverse" class="banner banner-warn">
        社区只做物品流转与风险提醒，<strong>不提供诊断结论</strong>；提交即表示同意社区工作人员就身体情况进行回访。
      </div>

      <div class="card-actions">
        <button class="btn btn-danger" :disabled="submitting" @click="submit">
          {{ isAdverse ? '提交并立即冻结同批次物品' : '提交反馈并隔离该物品' }}
        </button>
        <button class="btn" @click="open = false">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.photo-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  background: var(--c-primary-soft);
  color: var(--c-primary-dark);
  border-radius: 8px;
  padding: 6px 10px;
  margin-bottom: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}
</style>
