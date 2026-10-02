import type {
  Category,
  FeedbackType,
  HandoverMethod,
  Item,
  ItemDraft,
  ItemStatus,
  RequestStatus,
  Scene,
  StorageCondition,
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

// ---- 不适反馈：使用方式 / 过敏史 / 症状 选项 ----
export const USAGE_METHOD_OPTIONS = [
  '直接涂抹伤口及周围皮肤',
  '用碘伏棉片湿敷/擦拭',
  '用碘伏棉签点涂消毒',
  '擦拭完整皮肤（未接触伤口）',
  '其他方式（在情况描述中说明）',
] as const

export const ALLERGY_HISTORY_OPTIONS = [
  '无已知药物/消毒剂过敏史',
  '既往对碘伏或含碘消毒剂过敏',
  '对其他外用药/胶布等过敏（具体写在描述里）',
  '不清楚，没有留意过',
] as const

export const SYMPTOM_OPTIONS = ['接触部位皮肤发红', '局部肿胀', '瘙痒/灼热感', '皮疹/水疱', '呼吸不畅或其他全身反应'] as const

// ---- 批次 ----
/** 批次定位键：同品类 + 同生产批号（无批号物品不参与自动连带冻结） */
export function batchKey(category: Category, batchNo?: string): string {
  return `${category}::${(batchNo ?? '').trim() || 'NO_BATCH'}`
}

export function batchLabel(category: Category, batchNo?: string): string {
  return `${CATEGORY_LABELS[category]} · 批号 ${batchNo && batchNo.trim() ? batchNo : '未标注'}`
}

/**
 * 安全替代物：某品类因不适反馈核查时，向居民推荐的其他在架品类。
 * 仅推荐物理性、低致敏的护理耗材；药品类一律不出现。
 */
export const CATEGORY_ALTERNATIVES: Record<Category, Category[]> = {
  iodophor: ['gauze', 'bandage'],
  gauze: ['bandage'],
  bandage: ['gauze'],
  fever_patch: ['thermometer_battery'],
  mask: [],
  thermometer_battery: [],
  other_consumable: [],
}

/** 替代时的非药物处理建议 */
export const ALTERNATIVE_ADVICE: Partial<Record<Category, string>> = {
  iodophor: '浅表小伤口可先用清洁流动水冲洗，再用未涉事批次的无菌纱布/创可贴覆盖保护；伤口较深、化脓或出血不止请直接就医。',
  gauze: '浅表小伤口清洁后可用创可贴保护；如创面较大或渗液较多，请前往社区卫生服务中心处理。',
  bandage: '清洁伤口后可用无菌纱布简单覆盖；保持干燥并观察，红肿加重请就医。',
  fever_patch: '可先温水擦浴、减少捂盖进行物理降温；持续高热、精神差请立即就医，共享箱不提供退烧药。',
}

/** 就医渠道（演示数据，真实环境对接社区卫生服务中心信息） */
export interface MedicalChannel {
  name: string
  desc: string
  action: string
}
export const MEDICAL_CHANNELS: MedicalChannel[] = [
  {
    name: '幸福里社区卫生服务中心',
    desc: '皮肤红肿、瘙痒、伤口感染咨询；工作日 8:00–20:00，周末有值班。',
    action: '咨询电话 0571-8888-0000（演示号码）',
  },
  {
    name: '120 急救 / 最近三甲医院急诊',
    desc: '出现呼吸不畅、喉头水肿、全身风团、意识异常等严重过敏表现时立即拨打。',
    action: '立即拨打 120',
  },
  {
    name: '正规药店 / 医院皮肤科',
    desc: '就诊或购药时请携带涉事物品包装，向医生出示批号与使用方式。',
    action: '携带包装与批号前往',
  },
]

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
  if (!draft.batchNo?.trim()) {
    warnings.push('未填写生产批号：一旦出现使用后不适，将无法精确冻结同批次物品，建议按包装标注补填。')
  }
  if (draft.sceneTags.length === 0) warnings.push('未选择适用场景，将较难被有需要的邻居检索到。')
  return { errors, warnings }
}

/** 占用库存的申请状态：确认后即锁定，直到取消或闭环（归还/补充/赠予）才释放 */
export const STOCK_LOCKING_STATUSES: RequestStatus[] = ['confirmed', 'handing', 'completed']

/** 仍可能流向居民手中、需要安全通知的借用状态 */
export const BORROWER_NOTIFY_STATUSES: RequestStatus[] = ['completed', 'closed_returned']

export function isTerminalItemStatus(status: ItemStatus): boolean {
  return status === 'rejected' || status === 'recalled' || status === 'scrapped'
}

/** 物品是否处于会被大厅展示/申请的状态 */
export function isActiveItem(item: Item): boolean {
  return ['published', 'partially_lent', 'lent_out'].includes(item.status)
}
