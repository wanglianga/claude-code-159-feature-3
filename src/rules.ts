import type {
  Category,
  FeedbackType,
  HandoverMethod,
  ItemDraft,
  ItemStatus,
  ReactionSymptom,
  RequestStatus,
  Scene,
  StorageCondition,
  UsageMethod,
} from '@/types'
import { daysUntil } from '@/utils/date'

// ---- 标签字典 ----
export const CATEGORY_LABELS: Record<Category, string> = {
  fever_patch: '退热贴',
  iodophor: '碘伏（棉片/棉签/消毒液）',
  gauze: '纱布',
  bandage: '创可贴',
  mask: '口罩',
  thermometer_battery: '体温计纽扣电池',
  other_consumable: '其他非处方耗材（需审核）',
}

export const CATEGORY_ICONS: Record<Category, string> = {
  fever_patch: '🧊',
  iodophor: '🧴',
  gauze: '🩹',
  bandage: '🩹',
  mask: '😷',
  thermometer_battery: '🔋',
  other_consumable: '📦',
}

export const SCENE_LABELS: Record<Scene, string> = {
  child_night_fever: '孩子夜间发烧（物理降温/测温）',
  elderly_wound: '老人小伤口处理（清洁/包扎）',
  no_mask: '临时缺口罩',
  home_care: '居家护理缺耗材',
}

export const SCENE_HINTS: Record<Scene, string> = {
  child_night_fever: '退热贴、体温计电池等辅助用品；持续高热请及时就医，共享箱不提供退烧药。',
  elderly_wound: '碘伏、纱布、创可贴仅用于浅表小伤口；伤口较深、出血不止或化脓请就医。',
  no_mask: '未拆封的一次性口罩，请注意包装完好与效期。',
  home_care: '护理耗材临时周转；不涉及注射、处方与任何拆封药品。',
}

export const STORAGE_LABELS: Record<StorageCondition, string> = {
  room_temp: '常温避光',
  cool_dry: '阴凉干燥',
  refrigerate: '冷藏（冷链）',
}

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  pending_review: '待志愿者审核',
  rejected: '审核未通过',
  published: '可借',
  partially_lent: '部分外借中',
  lent_out: '已借完/外借中',
  quarantined: '风险隔离待核',
  recalled: '共享人已撤回',
  scrapped: '已报废',
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  waiting: '候补中',
  confirmed: '已确认待交接',
  handing: '交接中',
  completed: '已取走，待归还/补充',
  closed_returned: '已闭环',
  cancelled: '已取消',
}

export const METHOD_LABELS: Record<HandoverMethod, string> = {
  self_pickup: '自取',
  volunteer_delivery: '志愿者代送',
  door_contactless: '邻居门口无接触交接',
}

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  package_damaged: '包装破损',
  adverse_reaction: '疑似使用后不适',
  other: '其他问题',
}

export const CLOSE_MODE_LABELS = {
  return_sealed: '归还原物（未拆封）',
  restock_new: '补充同规格新品',
  mutual_aid: '邻里赠予，无需归还',
} as const

// ---- 不适反馈：症状 / 使用方式字典 ----
export const SYMPTOM_LABELS: Record<ReactionSymptom, string> = {
  redness_swelling: '接触部位红肿、发热、刺痛',
  itch: '瘙痒、起疹子',
  blister: '起水疱、皮肤破溃',
  breathing: '胸闷、喉咙发紧、呼吸不畅',
  fever: '使用后出现发热',
  other_symptom: '其他表现（在描述中写明）',
}

/** 需要立即急诊的严重症状 */
export const SEVERE_SYMPTOMS: ReactionSymptom[] = ['blister', 'breathing']

export const USAGE_LABELS: Record<UsageMethod, string> = {
  wipe_wound: '用碘伏棉片/棉签擦拭伤口及周围皮肤',
  direct_skin: '直接涂抹或湿敷在完好皮肤上',
  soak_dressing: '把碘伏倒在纱布等敷料上外敷',
  other_usage: '其他使用方式（在描述中写明）',
}

/** 批号最小长度（过短视为未填写真实批号） */
export const BATCH_NO_MIN_LEN = 3
export function normalizeBatchNo(value?: string): string {
  return (value ?? '').trim().toUpperCase()
}
export function isValidBatchNo(value?: string): boolean {
  return normalizeBatchNo(value).length >= BATCH_NO_MIN_LEN
}

// ---- 冻结核查期间，按品类推荐的安全替代与就医渠道 ----
export interface SafetyAlternative {
  title: string
  detail: string
}

export const CATEGORY_ALTERNATIVES: Record<Category, SafetyAlternative[]> = {
  iodophor: [
    { title: '流动清水 + 肥皂冲洗', detail: '浅表小伤口可先用流动清水和肥皂冲洗周围皮肤，冲净污物后保持干燥，等待社区核查结果。' },
    { title: '未拆封的独立包装无菌纱布/创可贴', detail: '大厅中其他共享人登记、不同批次且在有效期内的未拆封包扎耗材。' },
    { title: '社区卫生服务站', detail: '幸福里社区卫生服务站（1 号楼底商）8:00–20:00 可做伤口清洁消毒。' },
  ],
  gauze: [
    { title: '未拆封创可贴（小创面）', detail: '面积较小的浅表伤口，可先用大厅内不同批次的未拆封创可贴保护。' },
    { title: '干净毛巾按压 + 就医', detail: '出血较多时用干净毛巾持续按压，不要自行撒药粉，立即就医。' },
  ],
  bandage: [
    { title: '未拆封无菌纱布 + 胶带', detail: '可用大厅中其他在效期、不同批次的未拆封无菌纱布临时替代。' },
  ],
  fever_patch: [
    { title: '温水擦浴、减少捂盖、适量饮水', detail: '物理降温优先；持续高热、精神差请立即就医，共享箱不提供退烧药。' },
  ],
  mask: [
    { title: '向其他邻居申请不同批次口罩', detail: '大厅仍可检索其他共享人登记、包装完好的未拆封口罩。' },
  ],
  thermometer_battery: [
    { title: '用水银/电子体温计暂代或到门卫室测温', detail: '小区门卫室与居委会提供免费测温服务（8:00–22:00）。' },
  ],
  other_consumable: [
    { title: '先联系社区工作人员', detail: '该品类正在核查，是否有可接受的替代方式请先咨询社区，不要自行换用药品。' },
  ],
}

export interface MedicalChannel {
  name: string
  detail: string
  urgent?: boolean
}

export const MEDICAL_CHANNELS: MedicalChannel[] = [
  { name: '立即拨打 120 / 急诊', detail: '出现呼吸困难、面唇肿胀、全身风团、意识改变等严重过敏表现时。', urgent: true },
  { name: '幸福里社区卫生服务站', detail: '地址：1 号楼底商；服务时间 8:00–20:00，可处理伤口与轻度过敏反应。' },
  { name: '区人民医院皮肤科/急诊', detail: '红肿范围扩大、起水疱或 24 小时不缓解时前往；带上物品与包装。' },
  { name: '社区工作人员热线', detail: '赵磊（社区）演示内线：居委会值班电话，可协助联系志愿者陪诊。' },
]

/** 个体过敏核查成立后，挂到品类上的风险提醒文案模板 */
export function buildRiskNoticeText(category: Category, symptomText: string): { title: string; detail: string } {
  return {
    title: `${CATEGORY_LABELS[category]}曾出现个体过敏反馈`,
    detail: `有邻居使用该品类后出现「${symptomText || '皮肤红肿等不适'}」，社区回访核查倾向于个体过敏，物品本身核验合格。既往有药物/皮肤过敏史，或使用后出现红肿、瘙痒、皮疹的居民请不要使用该品类，改用替代方式并及时就医。`,
  }
}

// ---- 业务规则参数 ----
/** 效期预警阈值（天） */
export const EXPIRY_WARN_DAYS = 60
export const EXPIRY_DANGER_DAYS = 30
/** 确认后取走/完成交接的时限（小时） */
export const PICKUP_WINDOW_HOURS = 24
/** 志愿者配送承诺时限（小时） */
export const DELIVERY_SLA_HOURS = 6

export type ExpiryLevel = 'expired' | 'danger' | 'warn' | 'ok'

export function expiryLevel(expiryDate: string, now: string | Date): ExpiryLevel {
  const d = daysUntil(expiryDate, now)
  if (d < 0) return 'expired'
  if (d <= EXPIRY_DANGER_DAYS) return 'danger'
  if (d <= EXPIRY_WARN_DAYS) return 'warn'
  return 'ok'
}

export const EXPIRY_LEVEL_TEXT: Record<ExpiryLevel, string> = {
  expired: '已过期',
  danger: '临近效期（≤30天）',
  warn: '效期不足60天',
  ok: '效期正常',
}

// ---- 禁入规则：处方药 / 拆封药品 / 冷链药品 不能进入共享 ----
/** 名称中出现这些词，判定为疑似药品（含处方药），一律禁入 */
const FORBIDDEN_NAME_KEYWORDS = [
  '处方',
  '胶囊',
  '颗粒',
  '口服液',
  '混悬',
  '注射液',
  '输液',
  '抗生素',
  '头孢',
  '阿莫西林',
  '布洛芬',
  '对乙酰氨基酚',
  '退烧药',
  '降压',
  '降糖',
  '药片',
]

export interface DraftValidation {
  errors: string[]
  warnings: string[]
}

export function validateDraft(draft: ItemDraft, now: string | Date): DraftValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (!draft.name.trim()) errors.push('请填写品名。')
  if (!draft.spec.trim()) errors.push('请填写规格（如 4片/盒、50只/盒）。')
  if (!draft.expiryDate) {
    errors.push('请选择有效期。')
  } else {
    const d = daysUntil(draft.expiryDate, now)
    if (d < 0) errors.push('该物品已过期（超过有效期），不能登记共享，应按有害/医疗垃圾处理。')
    else if (d <= EXPIRY_DANGER_DAYS) warnings.push(`距有效期不足 ${EXPIRY_DANGER_DAYS} 天，审核时将重点确认，可能无法发布。`)
    else if (d <= EXPIRY_WARN_DAYS) warnings.push(`距有效期不足 ${EXPIRY_WARN_DAYS} 天，借用页面会显著提示效期。`)
  }
  if (!draft.location.trim()) errors.push('请填写取用地点（如 3号楼1单元门口共享柜）。')
  if (!draft.quantity || draft.quantity <= 0) errors.push('可借数量需大于 0。')
  if (draft.quantity > 999) errors.push('数量异常，请确认后重新填写。')
  if (draft.sealed === false) {
    errors.push('拆封物品不能进入共享：请只登记整盒/整包未开封的物品。')
  }
  if (draft.storage === 'refrigerate') {
    errors.push('冷链/冷藏药品不能进入共享，脱离冷链存在安全风险。')
  }
  const hit = FORBIDDEN_NAME_KEYWORDS.find((k) => draft.name.includes(k))
  if (hit) {
    errors.push(`「${draft.name}」疑似药品/处方药（命中“${hit}”）。共享箱仅限未拆封非处方耗材，处方药与口服/注射药品一律不能进入。`)
  }
  if (draft.category === 'other_consumable') {
    warnings.push('“其他非处方耗材”需要志愿者与社区工作人员双重确认后才能发布。')
  }
  if (!isValidBatchNo(draft.batchNo)) {
    warnings.push('未填写包装上的生产批号：一旦出现使用后不适，系统将无法自动冻结同批次物品，建议补填。')
  }
  if (draft.sceneTags.length === 0) warnings.push('未选择适用场景，将较难被有需要的邻居检索到。')
  return { errors, warnings }
}

/** 同批次判定键：同品类 + 同批号（批号统一大写、去空格） */
export function batchKey(category: Category, batchNo?: string): string {
  return `${category}::${normalizeBatchNo(batchNo)}`
}

/** 两件物品是否属于同品类同批次（任一无批号则不构成同批次） */
export function isSameBatch(a: Pick<ItemDraft, 'category' | 'batchNo'>, b: Pick<ItemDraft, 'category' | 'batchNo'>): boolean {
  if (!isValidBatchNo(a.batchNo) || !isValidBatchNo(b.batchNo)) return false
  return a.category === b.category && normalizeBatchNo(a.batchNo) === normalizeBatchNo(b.batchNo)
}

/** 占用库存的申请状态：确认后即锁定，直到取消或闭环（归还/补充/赠予）才释放 */
export const STOCK_LOCKING_STATUSES: RequestStatus[] = ['confirmed', 'handing', 'completed']

export function isTerminalItemStatus(status: ItemStatus): boolean {
  return status === 'rejected' || status === 'recalled' || status === 'scrapped'
}
