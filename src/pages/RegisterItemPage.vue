<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useMedkitStore } from '@/stores/medkit'
import { useFlash } from '@/composables/useFlash'
import { CATEGORY_LABELS, SCENE_LABELS, STORAGE_LABELS, validateDraft } from '@/rules'
import type { Category, Scene, StorageCondition } from '@/types'
import SafetyBanner from '@/components/SafetyBanner.vue'

const router = useRouter()
const store = useMedkitStore()
const { show } = useFlash()

const categories = Object.entries(CATEGORY_LABELS) as [Category, string][]
const scenes = Object.entries(SCENE_LABELS) as [Scene, string][]

const form = reactive<{
  name: string
  category: Category
  spec: string
  batchNo: string
  expiryDate: string
  storage: StorageCondition
  sealed: boolean
  quantity: number
  location: string
  sceneTags: Scene[]
  note: string
}>({
  name: '',
  category: 'fever_patch',
  spec: '',
  batchNo: '',
  expiryDate: '',
  storage: 'room_temp',
  sealed: true,
  quantity: 1,
  location: '',
  sceneTags: [],
  note: '',
})

const validation = computed(() => validateDraft({ ...form, batchNo: form.batchNo || undefined }, store.nowIso))
const canSubmit = computed(() => validation.value.errors.length === 0)

function toggleScene(s: Scene) {
  const idx = form.sceneTags.indexOf(s)
  if (idx >= 0) form.sceneTags.splice(idx, 1)
  else form.sceneTags.push(s)
}

function submit() {
  const r = store.register({
    name: form.name.trim(),
    category: form.category,
    spec: form.spec.trim(),
    batchNo: form.batchNo.trim() || undefined,
    expiryDate: form.expiryDate,
    storage: form.storage,
    sealed: form.sealed,
    quantity: form.quantity,
    location: form.location.trim(),
    sceneTags: form.sceneTags,
    note: form.note.trim() || undefined,
  })
  show(r.message, r.ok ? 'ok' : 'err')
  if (r.ok) router.push('/my-shares')
}
</script>

<template>
  <SafetyBanner compact />

  <div class="card">
    <h2 style="margin-bottom: 4px">登记共享物品</h2>
    <div class="muted">
      仅限<strong>整盒/整包未拆封的非处方常备耗材</strong>；处方药、口服/注射药品、拆封品、冷链与过期物品提交即被拦截。
      建议准确填写包装上的<strong>生产批号</strong>：一旦出现使用后不适，社区可据此立即冻结同批次剩余物品。
    </div>
  </div>

  <div class="card">
    <label class="field">
      <span>品名</span>
      <input v-model="form.name" type="text" placeholder="如：医用退热贴 / 碘伏棉片 / 一次性医用口罩" />
    </label>

    <label class="field">
      <span>品类</span>
      <select v-model="form.category">
        <option v-for="[k, v] in categories" :key="k" :value="k">{{ v }}</option>
      </select>
    </label>

    <label class="field">
      <span>规格</span>
      <input v-model="form.spec" type="text" placeholder="如：4贴/盒、20片/盒、50只/盒" />
    </label>

    <label class="field">
      <span>生产批号（建议填写，包装上可查）</span>
      <input v-model="form.batchNo" type="text" placeholder="如：IOD-20260701；未填写将无法在出现不适反馈时自动联动冻结同批次" />
      <span class="hint">同品类同批号的物品会被视为同批次；出现疑似使用后不适时立即整体冻结并通知相关居民。</span>
    </label>

    <label class="field">
      <span>有效期（截止日期）</span>
      <input v-model="form.expiryDate" type="date" />
    </label>

    <label class="field">
      <span>存放条件</span>
      <select v-model="form.storage">
        <option v-for="[k, v] in Object.entries(STORAGE_LABELS)" :key="k" :value="k">{{ v }}</option>
      </select>
    </label>

    <label class="check-row field">
      <input type="checkbox" v-model="form.sealed" />
      <span style="font-weight: 600">整盒/整包未开封、封签完好</span>
    </label>

    <div class="grid grid-2">
      <label class="field">
        <span>可借数量</span>
        <input v-model.number="form.quantity" type="number" min="1" max="999" />
      </label>
      <label class="field">
        <span>取用地点</span>
        <input v-model="form.location" type="text" placeholder="如：3号楼1单元门口共享柜 A格" />
      </label>
    </div>

    <label class="field">
      <span>适用场景（可多选）</span>
      <label v-for="[k, v] in scenes" :key="k" class="check-row">
        <input type="checkbox" :checked="form.sceneTags.includes(k)" @change="toggleScene(k)" /> {{ v }}
      </label>
    </label>

    <label class="field">
      <span>留言（可选）</span>
      <textarea v-model="form.note" placeholder="如：家里备多了，夜间急用可先取"></textarea>
    </label>

    <div v-for="(e, i) in validation.errors" :key="`e${i}`" class="banner banner-danger">⛔ {{ e }}</div>
    <div v-for="(w, i) in validation.warnings" :key="`w${i}`" class="banner banner-warn">⚠️ {{ w }}</div>

    <div class="card-actions">
      <button class="btn btn-primary" :disabled="!canSubmit" @click="submit">确认无误，提交登记</button>
      <button class="btn" @click="router.push('/hall')">取消</button>
    </div>
  </div>
</template>
