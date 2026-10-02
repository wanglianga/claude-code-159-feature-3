// 社区药箱共享 —— 领域类型定义

/** 可共享品类（白名单：仅限未拆封常备非处方耗材） */
export type Category =
  | 'fever_patch' // 退热贴
  | 'iodophor' // 碘伏（棉片/棉签/消毒液）
  | 'gauze' // 纱布
  | 'bandage' // 创可贴
  | 'mask' // 口罩
  | 'thermometer_battery' // 体温计纽扣电池
  | 'other_consumable' // 其他经审核的非处方耗材

/** 症状/使用场景 */
export type Scene =
  | 'child_night_fever' // 孩子夜间发烧
  | 'elderly_wound' // 老人小伤口处理
  | 'no_mask' // 临时缺口罩
  | 'home_care' // 居家护理缺耗材

/** 存放条件 */
export type StorageCondition = 'room_temp' | 'cool_dry' | 'refrigerate'

/** 物品全流程状态 */
export type ItemStatus =
  | 'pending_review' // 待审核
  | 'rejected' // 审核驳回（不进入共享）
  | 'published' // 已发布，可借
  | 'partially_lent' // 部分借出，仍有可借余量
  | 'lent_out' // 可借余量为 0（外借中，待归还/补充）
  | 'quarantined' // 风险隔离（包装破损/疑似不适反应待核，或同批次连带冻结）
  | 'recalled' // 共享人撤回
  | 'scrapped' // 报废（过期/破损/核查不合格）

/** 交接方式 */
export type HandoverMethod = 'self_pickup' | 'volunteer_delivery' | 'door_contactless'

/** 借用申请状态 */
export type RequestStatus =
  | 'waiting' // 排队候补（暂无余量，等待他人取消或归还）
  | 'confirmed' // 已确认并锁定数量，等待交接
  | 'handing' // 交接中（自取待取 / 配送中 / 已放门口）
  | 'completed' // 已完成（拍照确认）
  | 'closed_returned' // 已闭环：归还/补充完成
  | 'cancelled' // 已取消（超时未取 / 共享人撤回 / 主动取消 / 配送失败 / 风险冻结）

/** 反馈类型 */
export type FeedbackType = 'package_damaged' | 'adverse_reaction' | 'other'
export type FeedbackStatus =
  | 'open' // 待社区核查
  | 'resolved_scrap' // 核查为物品问题：同批次报废
  | 'resolved_republish' // 核验无问题：解除冻结恢复共享
  | 'resolved_risk_notice' // 个体过敏：恢复共享并加入风险提醒

/** 不适症状表现（多选） */
export type ReactionSymptom =
  | 'redness_swelling' // 接触部位红肿
  | 'itch' // 瘙痒/皮疹
  | 'blister' // 起水疱/破溃
  | 'breathing' // 胸闷/呼吸不畅
  | 'fever' // 发热
  | 'other_symptom' // 其他

/** 使用方式 */
export type UsageMethod =
  | 'wipe_wound' // 擦拭伤口及周围皮肤
  | 'direct_skin' // 直接涂抹/湿敷在完好皮肤上
  | 'soak_dressing' // 浸湿纱布等敷料外敷
  | 'other_usage' // 其他用法

/** 社区核查结论：个体过敏 / 物品问题 / 暂无法判定 */
export type InvestigationConclusion = 'individual_allergy' | 'item_issue' | 'inconclusive'

/** 核查后动作 */
export type InvestigationAction = 'scrap_batch' | 'restore_with_notice' | 'restore_only'

/** 物品登记内容 */
export interface ItemDraft {
  name: string
  category: Category
  spec: string // 规格
  expiryDate: string // YYYY-MM-DD
  storage: StorageCondition
  sealed: boolean // 是否整盒未开封
  quantity: number // 可借数量
  location: string // 取用地点
  sceneTags: Scene[] // 适用场景
  note?: string
  /** 生产批号（包装标注），用于同批次冻结；缺失时无法做同批次联动 */
  batchNo?: string
  /** 生产厂家（选填，辅助批次辨认） */
  manufacturer?: string
}

export interface Item extends ItemDraft {
  id: string
  ownerId: string
  ownerName: string
  status: ItemStatus
  createdAt: string
  publishedAt?: string
  /** 审核记录 */
  review?: { reviewerId: string; reviewerName: string; at: string; approved: boolean; reason?: string }
  /** 最近一次报废/撤回/冻结原因 */
  closeReason?: string
  /** 被哪条不适反馈连带冻结（同批次联动），用于解除冻结时整批恢复 */
  frozenByFeedbackId?: string
  /** 冻结前的状态（解除冻结时恢复：未发布过的回到待审核） */
  preFreezeStatus?: ItemStatus
  /** 直接收到反馈的物品（区别于同批次被连带冻结的物品） */
  riskSource?: boolean
}

export interface BorrowRequest {
  id: string
  itemId: string
  applicantId: string
  applicantName: string
  scene: Scene
  quantity: number
  method: HandoverMethod
  note?: string
  status: RequestStatus
  createdAt: string
  confirmedAt?: string
  handingAt?: string
  completedAt?: string
  closedAt?: string
  /** 确认人（共享人/志愿者） */
  confirmerId?: string
  confirmerName?: string
  /** 交接拍照凭证（演示环境用文件名/dataURL 占位） */
  handoverPhoto?: string
  handoverNote?: string
  /** 志愿者配送相关 */
  volunteerId?: string
  volunteerName?: string
  delayReason?: string
  cancelReason?: string
  /** 因风险反馈/同批次冻结被系统取消 */
  frozenByFeedbackId?: string
  /** 归还/补充方式 */
  closeMode?: 'return_sealed' | 'restock_new' | 'mutual_aid'
  closeNote?: string
}

/** 社区核查记录（结构化留痕） */
export interface Investigation {
  at: string
  handlerId: string
  handlerName: string
  conclusion: InvestigationConclusion
  action: InvestigationAction
  /** 是否同步报废同批次其余物品 */
  sameBatchScrapped: boolean
  /** 是否加入品类风险提醒 */
  riskNoticeAdded: boolean
  note: string
}

export interface Feedback {
  id: string
  itemId: string
  requestId?: string
  reporterId: string
  reporterName: string
  type: FeedbackType
  detail: string
  createdAt: string
  status: FeedbackStatus
  handledAt?: string
  handlerId?: string
  handlerName?: string
  handleNote?: string

  // ---- 不适反馈的结构化信息 ----
  /** 症状表现 */
  symptoms?: ReactionSymptom[]
  /** 过敏史（本人/家族药物或耗材过敏史，“无/不详/有…”） */
  allergyHistory?: string
  /** 使用方式 */
  usageMethod?: UsageMethod
  /** 使用方式补充说明（用量、频率、部位） */
  usageDetail?: string
  /** 包装/局部情况照片（演示环境用凭证占位名） */
  packagePhotos?: string[]
  /** 是否已经就医 */
  soughtMedicalCare?: boolean
  /** 就医情况说明（科室、诊断、处置） */
  medicalNote?: string
  /** 本次反馈连带冻结的同批次物品 id（含直接反馈物品） */
  frozenItemIds?: string[]
  /** 社区核查记录 */
  investigation?: Investigation
}

/** 品类级风险提醒（核查为个体过敏后挂到品类上，借用前强制确认） */
export interface RiskNotice {
  id: string
  category: Category
  title: string
  detail: string
  relatedItemId?: string
  relatedFeedbackId?: string
  createdAt: string
  createdBy: string
  createdByName: string
  active: boolean
}

/** 站内通知（共享人 / 社区工作人员 / 已借用居民 / 在途申请人） */
export type NoticeKind =
  | 'quarantine' // 物品/批次冻结
  | 'request_cancelled' // 在途申请因冻结取消
  | 'investigation' // 核查结论通知
  | 'risk_notice' // 风险提醒发布
  | 'system'

export interface Notice {
  id: string
  at: string
  kind: NoticeKind
  title: string
  body: string
  itemId?: string
  feedbackId?: string
  requestId?: string
  /** 收件人 id 列表 */
  recipientIds: string[]
  readBy: string[]
}

/** 与物品串联的全流程时间线事件 */
export interface DemoUser {
  id: string
  name: string
  role: 'resident' | 'volunteer' | 'staff'
  address: string
}

export interface TimelineEvent {
  id: string
  itemId: string
  requestId?: string
  at: string
  actorId: string
  actorName: string
  kind:
    | 'registered'
    | 'reviewed'
    | 'published'
    | 'applied'
    | 'waitlisted'
    | 'confirmed'
    | 'handover_started'
    | 'handover_confirmed'
    | 'returned'
    | 'restocked'
    | 'recalled'
    | 'scrapped'
    | 'quarantined'
    | 'batch_quarantined'
    | 'feedback'
    | 'investigated'
    | 'risk_notice'
    | 'notice'
    | 'overdue_flagged'
    | 'delay_flagged'
    | 'cancelled'
  detail?: string
}
