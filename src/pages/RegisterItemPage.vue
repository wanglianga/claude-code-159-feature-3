<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMedkitStore } from '@/stores/medkit'
import { useFlash } from '@/composables/useFlash'
import {
  CATEGORY_LABELS,
  SCENE_LABELS,
  STORAGE_LABELS,
  validateDraft,
} from '@/rules'
import { addDays } from '@/utils/date'
import type { Category, ItemDraft, Scene } from '@/types'
import SafetyBanner from '@/components/SafetyBanner.vue'

const store = useMedkitStore()
const router = useRouter()
const { show } = useFlash()

const categories = Object.entries(CATEGORY_LABELS) as [Category, string][]
const scenes = Object.entries(SCENE_LABELS) as [Scene, string][]

const form = reactive<ItemDraft>({
  name: '',
  category: 'fever_patch',
  spec: '',
  expiryDate: addDays(new Date().toISOString(), 180).slice(0, 10),
  storage: 'room_temp',
  sealed: true,
  quantity: 1,
  location: '',
  sceneTags: [],
  note: '',
  batchNo: '',
  manufacturer: '',
})

const submitted = ref(false)
const validation = computed(() => validateDraft(form, store.nowIso))

function toggleScene(s: Scene) {
  const idx = form.sceneTags.indexOf(s)
  if (idx >= 0) form.sceneTags.splice(idx, 1)
  else form.sceneTags.push(s)
}

function submit() {
  submitted.value = true
  const { errors, warnings } = validation.value
  if (errors.length) {
    show(errors.join(' '), 'err', 8000)
    return
  }
  const r = store.register({ ...form })
  show(r.message || (warnings.length ? warnings.join(' ') : '登记成功'), r.ok ? 'ok' : 'err', 8000)
  if (r.ok) router.push('/my-shares')
}
</script>

<template>
  <SafetyBanner compact />

  <div class="card">
    <h2 style="margin-bottom: 4px">登记共享物品</h2>
    <div class="muted">
      仅限<strong>整盒/整包未拆封</strong>的常备非处方耗材。系统会实时校验禁入规则；填写包装上的<strong>生产批号</strong>后，一旦出现使用后不适，可自动冻结同批次剩余物品。
    </div>
  </div>

  <div class="card">
    <label class="field">
      <span>品名</span>
      <input v-model="form.name" type="text" placeholder="如：医用退热贴、碘伏棉片、无菌纱布" />
    </label>

    <div class="grid grid-2">
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
    </div>

    <div class="grid grid-2">
      <label class="field">
        <span>有效期（包装标注）</span>
        <input v-model="form.expiryDate" type="date" />
      </label>
      <label class="field">
        <span>存放条件</span>
        <select v-model="form.storage">
          <option value="room_temp">{{ STORAGE_LABELS.room_temp }}</option>
          <option value="cool_dry">{{ STORAGE_LABELS.cool_dry }}</option>
          <option value="refrigerate">{{ STORAGE_LABELS.refrigerate }}（冷链，禁入共享）</option>
        </select>
      </label>
    </div>

    <div class="grid grid-2">
      <label class="field">
        <span>生产批号（包装标注，强烈建议填写）</span>
        <input v-model="form.batchNo" type="text" placeholder="如：IDP-2508A" />
        <span class="hint">用于同批次风险联动：某件物品出现使用后不适时，同品类同批号物品会被立即冻结。</span>
      </label>
      <label class="field">
        <span>生产厂家（选填）</span>
        <input v-model="form.manufacturer" type="text" placeholder="如：康健医疗用品厂" />
      </label>
    </div>

    <div class="grid grid-2">
      <label class="field">
        <span>可借数量</span>
        <input v-model.number="form.quantity" type="number" min="1" max="999" />
      </label>
      <label class="field">
        <span>取用地点</span>
        <input v-model="form.location" type="text" placeholder="如：3号楼1单元一楼共享柜 A格" />
      </label>
    </div>

    <label class="field">
      <span>适用场景（可多选）</span>
      <label v-for="[k, v] in scenes" :key="k" class="check-row">
        <input type="checkbox" :checked="form.sceneTags.includes(k)" @change="toggleScene(k)" />
        <span>{{ v }}</span>
      </label>
    </label>

    <label class="field">
      <span>包装承诺</span>
      <label class="check-row">
        <input type="checkbox" v-model="form.sealed" />
        我确认该物品<strong>整盒/整包未开封、封签完好</strong>，且不是处方药、口服/注射药品或冷链物品。
      </label>
    </label>

    <label class="field">
      <span>给邻居的留言（可选）</span>
      <textarea v-model="form.note" placeholder="如：家里备多了，未拆封，夜间急用可先取。"></textarea>
    </label>

    <!-- 实时规则校验 -->
    <template v-if="submitted || form.name || form.spec">
      <div v-for="(e, i) in validation.errors" :key="`e${i}`" class="banner banner-danger">⛔ {{ e }}</div>
      <div v-for="(w, i) in validation.warnings" :key="`w${i}`" class="banner banner-warn">⚠️ {{ w }}</div>
    </template>

    <div class="card-actions">
      <button class="btn btn-primary" @click="submit">提交登记，等待志愿者审核</button>
      <button class="btn" @click="router.push('/hall')">取消</button>
    </div>
  </div>
</template>
