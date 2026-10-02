// 演示用户：居民 / 志愿者 / 社区工作人员
import type {
  AppNotification,
  BorrowRequest,
  CategoryRiskWarning,
  DemoUser,
  Feedback,
  FrozenBatch,
  Item,
  TimelineEvent,
} from '@/types'
import { addDays, addHours } from '@/utils/date'
import { batchKey, batchLabel } from '@/rules'

export type { DemoUser }

export const DEMO_USERS: DemoUser[] = [
  { id: 'u_a', name: '王秀兰', role: 'resident', address: '幸福里小区 3号楼1单元' },
  { id: 'u_b', name: '李建国', role: 'resident', address: '幸福里小区 2号楼2单元' },
  { id: 'u_c', name: '周敏', role: 'resident', address: '幸福里小区 5号楼3单元' },
  { id: 'u_v', name: '陈芳（志愿者）', role: 'volunteer', address: '幸福里小区 1号楼' },
  { id: 'u_s', name: '赵磊（社区工作人员）', role: 'staff', address: '幸福里社区居委会' },
]

// 演示“当前时间”基准，时钟可在页面底部快进，用于演示效期/超时
export const BASE_NOW = '2026-09-27T09:00:00'

let seq = 0
export function uid(prefix: string): string {
  seq += 1
  return `${prefix}_${Date.now().toString(36)}_${seq}_${Math.random().toString(36).slice(2, 6)}`
}

/** 碘伏同批次（红肿反馈核查场景的核心批号） */
export const IODOPHOR_BATCH = 'IOD-20260701'

function buildSeed(now: string): {
  items: Item[]
  requests: BorrowRequest[]
  feedbacks: Feedback[]
  frozenBatches: FrozenBatch[]
  riskWarnings: CategoryRiskWarning[]
  notifications: AppNotification[]
} {
  const iodKey = batchKey('iodophor', IODOPHOR_BATCH)

  const items: Item[] = [
    {
      id: 'i1',
      ownerId: 'u_a',
      ownerName: '王秀兰',
      name: '医用退热贴',
      category: 'fever_patch',
      spec: '4贴/盒',
      batchNo: 'FP-20260301',
      expiryDate: addDays(now, 180).slice(0, 10),
      storage: 'cool_dry',
      sealed: true,
      quantity: 2,
      location: '3号楼1单元一楼“邻里药箱”共享柜 A格',
      sceneTags: ['child_night_fever'],
      note: '家里备多了，未拆封，夜间急用可先取。',
      status: 'published',
      createdAt: addDays(now, -10),
      publishedAt: addDays(now, -9),
    },
    {
      id: 'i2',
      ownerId: 'u_c',
      ownerName: '周敏',
      name: '碘伏棉片',
      category: 'iodophor',
      spec: '独立包装 20片/盒',
      batchNo: IODOPHOR_BATCH,
      expiryDate: addDays(now, 45).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 5,
      location: '5号楼3单元门口便民架',
      sceneTags: ['elderly_wound', 'home_care'],
      note: '效期不足两个月，页面会显著提示，请按需借用。',
      status: 'quarantined',
      createdAt: addDays(now, -6),
      publishedAt: addDays(now, -6),
      closeReason: `同批次（批号 ${IODOPHOR_BATCH}）收到借用人使用后皮肤红肿反馈，剩余物品已冻结，待工作人员核查`,
      frozenBatchKey: iodKey,
    },
    {
      id: 'i4',
      ownerId: 'u_c',
      ownerName: '周敏',
      name: '创可贴',
      category: 'bandage',
      spec: '100片/盒',
      batchNo: 'BA-20260501',
      expiryDate: addDays(now, 300).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 4,
      location: '5号楼3单元门口便民架',
      sceneTags: ['elderly_wound', 'home_care'],
      status: 'published',
      createdAt: addDays(now, -15),
      publishedAt: addDays(now, -14),
    },
    {
      id: 'i5',
      ownerId: 'u_a',
      ownerName: '王秀兰',
      name: '一次性使用医用口罩',
      category: 'mask',
      spec: '50只/盒（灭菌级）',
      batchNo: 'MK-20260201',
      expiryDate: addDays(now, 400).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 20,
      location: '3号楼1单元一楼“邻里药箱”共享柜 B格',
      sceneTags: ['no_mask', 'home_care'],
      status: 'published',
      createdAt: addDays(now, -8),
      publishedAt: addDays(now, -8),
    },
    {
      id: 'i6',
      ownerId: 'u_c',
      ownerName: '周敏',
      name: '体温计纽扣电池',
      category: 'thermometer_battery',
      spec: 'LR41 2粒/板',
      batchNo: 'BT-LR41-2025',
      expiryDate: addDays(now, 700).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 2,
      location: '5号楼3单元门口便民架',
      sceneTags: ['child_night_fever', 'home_care'],
      note: '电子体温计没电时应急更换。',
      status: 'published',
      createdAt: addDays(now, -12),
      publishedAt: addDays(now, -12),
    },
    {
      id: 'i7',
      ownerId: 'u_b',
      ownerName: '李建国',
      name: '儿童退热贴',
      category: 'fever_patch',
      spec: '6贴/盒',
      batchNo: 'FP-20260410',
      expiryDate: addDays(now, 240).slice(0, 10),
      storage: 'cool_dry',
      sealed: true,
      quantity: 1,
      location: '2号楼2单元201门口挂袋',
      sceneTags: ['child_night_fever'],
      status: 'pending_review',
      createdAt: addHours(now, -2),
    },
    {
      id: 'i8',
      ownerId: 'u_a',
      ownerName: '王秀兰',
      name: '碘伏消毒液',
      category: 'iodophor',
      spec: '100ml/瓶 带密封盖',
      batchNo: 'IOD-20251201',
      expiryDate: addDays(now, 20).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 2,
      location: '3号楼1单元一楼“邻里药箱”共享柜 A格',
      sceneTags: ['elderly_wound'],
      note: '临近效期，请志愿者审核时重点确认。',
      status: 'pending_review',
      createdAt: addDays(now, -1),
    },
    {
      id: 'i9',
      ownerId: 'u_a',
      ownerName: '王秀兰',
      name: '防水创可贴',
      category: 'bandage',
      spec: '20片/盒',
      batchNo: 'BA-20260301',
      expiryDate: addDays(now, 200).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 1,
      location: '3号楼1单元一楼“邻里药箱”共享柜 A格',
      sceneTags: ['elderly_wound'],
      status: 'quarantined',
      createdAt: addDays(now, -5),
      publishedAt: addDays(now, -5),
      closeReason: '借用反馈包装破损，已隔离待工作人员核查',
    },
    {
      id: 'i3',
      ownerId: 'u_a',
      ownerName: '王秀兰',
      name: '无菌纱布块',
      category: 'gauze',
      spec: '5片/袋（独立灭菌）',
      batchNo: 'GA-20260101',
      expiryDate: addDays(now, 12).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 3,
      location: '3号楼1单元一楼“邻里药箱”共享柜 A格',
      sceneTags: ['elderly_wound', 'home_care'],
      note: '临近效期，且收到疑似不适反馈已隔离。',
      status: 'quarantined',
      createdAt: addDays(now, -7),
      publishedAt: addDays(now, -7),
      closeReason: '借用人反馈使用后伤口周围发红，疑似不适，已隔离',
    },
    {
      id: 'i10',
      ownerId: 'u_c',
      ownerName: '周敏',
      name: '儿童防护口罩',
      category: 'mask',
      spec: '10只/包',
      batchNo: 'MK-20251201',
      expiryDate: addDays(now, 300).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 1,
      location: '5号楼3单元门口便民架',
      sceneTags: ['no_mask'],
      status: 'recalled',
      createdAt: addDays(now, -9),
      publishedAt: addDays(now, -8),
      closeReason: '家中孩子也要用，共享人主动撤回',
    },
    {
      id: 'i11',
      ownerId: 'u_a',
      ownerName: '王秀兰',
      name: '老式脱脂纱布（旧）',
      category: 'gauze',
      spec: '散装旧包装',
      expiryDate: addDays(now, -200).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 1,
      location: '社区库房',
      sceneTags: [],
      status: 'scrapped',
      createdAt: addDays(now, -60),
      publishedAt: addDays(now, -59),
      closeReason: '已过期，工作人员报废并按医疗垃圾处理',
    },
    {
      id: 'i12',
      ownerId: 'u_c',
      ownerName: '周敏',
      name: '一次性防护口罩（库存遗留）',
      category: 'mask',
      spec: '20只/盒',
      batchNo: 'MK-20240101',
      expiryDate: addDays(now, -3).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 6,
      location: '5号楼3单元门口便民架',
      sceneTags: ['no_mask'],
      note: '已过期：大厅不可借用，等待工作人员报废。',
      status: 'published',
      createdAt: addDays(now, -200),
      publishedAt: addDays(now, -199),
    },
    // —— 同批次第二件碘伏：反馈后应被连带冻结 ——
    {
      id: 'i13',
      ownerId: 'u_a',
      ownerName: '王秀兰',
      name: '碘伏棉签',
      category: 'iodophor',
      spec: '独立包装 36支/盒',
      batchNo: IODOPHOR_BATCH,
      expiryDate: addDays(now, 120).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 3,
      location: '3号楼1单元一楼“邻里药箱”共享柜 A格',
      sceneTags: ['elderly_wound', 'home_care'],
      note: '与 5 号楼周敏共享的碘伏棉片为同一生产批号。',
      status: 'quarantined',
      createdAt: addDays(now, -4),
      publishedAt: addDays(now, -4),
      closeReason: `与碘伏棉片同批次（批号 ${IODOPHOR_BATCH}），收到皮肤红肿反馈后连带冻结，待核查`,
      frozenBatchKey: iodKey,
    },
    // —— 安全替代物：冻结期间向居民推荐的其他在架耗材 ——
    {
      id: 'i14',
      ownerId: 'u_b',
      ownerName: '李建国',
      name: '无菌纱布块',
      category: 'gauze',
      spec: '5片/袋（独立灭菌）',
      batchNo: 'GA-20260801',
      expiryDate: addDays(now, 260).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 4,
      location: '2号楼2单元201门口挂袋',
      sceneTags: ['elderly_wound', 'home_care'],
      status: 'published',
      createdAt: addDays(now, -3),
      publishedAt: addDays(now, -3),
    },
    {
      id: 'i15',
      ownerId: 'u_a',
      ownerName: '王秀兰',
      name: '透气创可贴',
      category: 'bandage',
      spec: '50片/盒',
      batchNo: 'BA-20260801',
      expiryDate: addDays(now, 280).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 6,
      location: '3号楼1单元一楼“邻里药箱”共享柜 A格',
      sceneTags: ['elderly_wound', 'home_care'],
      status: 'published',
      createdAt: addDays(now, -2),
      publishedAt: addDays(now, -2),
    },
  ]

  const requests: BorrowRequest[] = [
    {
      id: 'r1',
      itemId: 'i4',
      applicantId: 'u_b',
      applicantName: '李建国',
      scene: 'elderly_wound',
      quantity: 1,
      method: 'volunteer_delivery',
      note: '老人在家不方便下楼，麻烦志愿者送一下。',
      status: 'completed',
      createdAt: addDays(now, -3),
      confirmedAt: addDays(now, -3),
      handingAt: addDays(now, -3),
      completedAt: addDays(now, -2),
      confirmerId: 'u_c',
      confirmerName: '周敏',
      volunteerId: 'u_v',
      volunteerName: '陈芳（志愿者）',
      handoverPhoto: 'handover-r1.jpg（演示凭证：志愿者送达后拍照）',
      handoverNote: '已交到本人手中，外包装完好。',
    },
    {
      id: 'r2',
      itemId: 'i6',
      applicantId: 'u_b',
      applicantName: '李建国',
      scene: 'child_night_fever',
      quantity: 2,
      method: 'self_pickup',
      status: 'completed',
      createdAt: addDays(now, -1),
      confirmedAt: addDays(now, -1),
      handingAt: addDays(now, -1),
      completedAt: addDays(now, -1),
      confirmerId: 'u_c',
      confirmerName: '周敏',
      handoverPhoto: 'handover-r2.jpg（演示凭证：共享柜取件自拍）',
      handoverNote: '从共享柜取走，封签完好。',
    },
    {
      id: 'r3',
      itemId: 'i1',
      applicantId: 'u_c',
      applicantName: '周敏',
      scene: 'child_night_fever',
      quantity: 1,
      method: 'self_pickup',
      note: '孩子夜里烧起来了，先物理降温观察。',
      status: 'confirmed',
      createdAt: addHours(now, -27),
      confirmedAt: addHours(now, -26),
      confirmerId: 'u_a',
      confirmerName: '王秀兰',
    },
    {
      id: 'r4',
      itemId: 'i6',
      applicantId: 'u_a',
      applicantName: '王秀兰',
      scene: 'home_care',
      quantity: 1,
      method: 'door_contactless',
      note: '家里体温计没电，排队等归还。',
      status: 'waiting',
      createdAt: addHours(now, -5),
    },
    {
      id: 'r5',
      itemId: 'i5',
      applicantId: 'u_c',
      applicantName: '周敏',
      scene: 'no_mask',
      quantity: 5,
      method: 'volunteer_delivery',
      note: '家里口罩用完了，明天要陪老人去医院。',
      status: 'handing',
      createdAt: addHours(now, -9),
      confirmedAt: addHours(now, -9),
      handingAt: addHours(now, -8),
      confirmerId: 'u_a',
      confirmerName: '王秀兰',
      volunteerId: 'u_v',
      volunteerName: '陈芳（志愿者）',
    },
    // 李建国借走过涉事批次碘伏棉片（红肿反馈人 + 已借用居民，需被通知）
    {
      id: 'r6',
      itemId: 'i2',
      applicantId: 'u_b',
      applicantName: '李建国',
      scene: 'elderly_wound',
      quantity: 1,
      method: 'self_pickup',
      note: '老人小伤口消毒用。',
      status: 'completed',
      createdAt: addDays(now, -2),
      confirmedAt: addDays(now, -2),
      handingAt: addDays(now, -2),
      completedAt: addDays(now, -2),
      confirmerId: 'u_c',
      confirmerName: '周敏',
      handoverPhoto: 'handover-r6.jpg（演示凭证：共享柜取件自拍）',
      handoverNote: '封签完好，在有效期内。',
    },
    // 周敏申请同批次碘伏棉签：冻结时候补自动取消并通知
    {
      id: 'r7',
      itemId: 'i13',
      applicantId: 'u_c',
      applicantName: '周敏',
      scene: 'home_care',
      quantity: 1,
      method: 'door_contactless',
      status: 'cancelled',
      createdAt: addHours(now, -6),
      closedAt: addHours(now, -4),
      cancelReason: '同批次收到疑似使用后不适反馈被冻结，候补申请自动取消',
    },
  ]

  const frozenAt = addHours(now, -4)
  const feedbacks: Feedback[] = [
    {
      id: 'f1',
      itemId: 'i9',
      reporterId: 'u_b',
      reporterName: '李建国',
      type: 'package_damaged',
      detail: '盒子被压裂，里面两片创可贴的密封纸翘起，不敢使用。',
      createdAt: addHours(now, -6),
      status: 'open',
    },
    {
      id: 'f2',
      itemId: 'i3',
      requestId: undefined,
      reporterId: 'u_c',
      reporterName: '周敏',
      type: 'adverse_reaction',
      detail: '使用纱布包扎后伤口周围发红发痒，已取下并用清水冲洗。不确定是否与物品有关，先报备。',
      createdAt: addHours(now, -3),
      status: 'open',
    },
    // 碘伏红肿反馈：触发同批次冻结与多方通知的主线案例
    {
      id: 'f3',
      itemId: 'i2',
      requestId: 'r6',
      reporterId: 'u_b',
      reporterName: '李建国',
      type: 'adverse_reaction',
      detail: '用碘伏棉片给老人小伤口消毒约半小时后，伤口周围皮肤发红、肿胀并发痒，已取下并用清水冲洗。',
      createdAt: frozenAt,
      status: 'open',
      symptoms: '接触部位皮肤发红；局部肿胀；瘙痒/灼热感',
      usageMethod: '用碘伏棉片湿敷/擦拭',
      allergyHistory: '不清楚，没有留意过',
      soughtMedicalCare: true,
      medicalNote: '已到社区卫生服务中心就诊，医生考虑接触性皮炎，建议停用并观察（演示记录）。',
      packagePhoto: 'feedback-f3-package.jpg（演示凭证：包装与生产批号照片）',
      batchKey: iodKey,
      batchLabel: batchLabel('iodophor', IODOPHOR_BATCH),
    },
  ]

  const frozenBatches: FrozenBatch[] = [
    {
      key: iodKey,
      category: 'iodophor',
      batchNo: IODOPHOR_BATCH,
      label: batchLabel('iodophor', IODOPHOR_BATCH),
      sourceFeedbackId: 'f3',
      sourceItemId: 'i2',
      reason: '借用人使用碘伏棉片后反馈接触部位皮肤红肿，已就医',
      frozenAt,
      status: 'frozen',
      itemIds: ['i2', 'i13'],
    },
  ]

  const riskWarnings: CategoryRiskWarning[] = []

  const notifications: AppNotification[] = [
    {
      id: 'n1',
      at: frozenAt,
      kind: 'batch_frozen',
      title: '你共享的碘伏棉片同批次已冻结',
      body: `借用人使用批号 ${IODOPHOR_BATCH} 碘伏后反馈皮肤红肿。你共享的碘伏棉片剩余库存已立即冻结，暂停借用与交接，待社区核查后通知结论。`,
      userId: 'u_c',
      itemIds: ['i2'],
    },
    {
      id: 'n2',
      at: frozenAt,
      kind: 'batch_frozen',
      title: '你共享的碘伏棉签同批次已冻结',
      body: `你共享的碘伏棉签与被反馈的碘伏棉片为同一批号 ${IODOPHOR_BATCH}，已连带冻结，请先不要自行处置或外借。`,
      userId: 'u_a',
      itemIds: ['i13'],
    },
    {
      id: 'n3',
      at: frozenAt,
      kind: 'batch_frozen',
      title: '碘伏同批次风险待核查',
      body: `批号 ${IODOPHOR_BATCH} 的碘伏类物品已全部冻结（2 件），有居民反馈使用后皮肤红肿并已就医，请尽快联系反馈人、登记过敏史与包装凭证并给出核查结论。`,
      userId: 'u_s',
      roleTargets: ['staff'],
      itemIds: ['i2', 'i13'],
    },
    {
      id: 'n4',
      at: frozenAt,
      kind: 'batch_frozen',
      title: '你借用的碘伏棉片同批次已冻结',
      body: '你此前借走的碘伏棉片同批次已暂停共享。如仍有未使用的棉片请暂停使用；若皮肤红肿持续或加重，请立即就医并保留包装。',
      userId: 'u_b',
      itemIds: ['i2'],
    },
    {
      id: 'n5',
      at: frozenAt,
      kind: 'request_cancelled',
      title: '你的碘伏棉签申请已取消',
      body: `因同批次（${IODOPHOR_BATCH}）收到疑似不适反馈并冻结，你的候补申请已自动取消。页面已为你推荐纱布、创可贴等安全替代物及就医渠道。`,
      userId: 'u_c',
      itemIds: ['i13'],
    },
  ]

  return { items, requests, feedbacks, frozenBatches, riskWarnings, notifications }
}

/** 由物品/申请/反馈/冻结快照重建全流程时间线（种子数据与数据修复共用） */
export function rebuildTimeline(
  items: Item[],
  requests: BorrowRequest[],
  feedbacks: Feedback[],
  frozenBatches: FrozenBatch[] = [],
  riskWarnings: CategoryRiskWarning[] = [],
): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const push = (e: TimelineEvent) => events.push(e)

  for (const it of items) {
    push({ id: `${it.id}_reg`, itemId: it.id, at: it.createdAt, actorId: it.ownerId, actorName: it.ownerName, kind: 'registered', detail: `登记「${it.name} ${it.spec}」×${it.quantity}` })
    if (it.review) {
      push({ id: `${it.id}_review`, itemId: it.id, at: it.review.at, actorId: it.review.reviewerId, actorName: it.review.reviewerName, kind: 'reviewed', detail: it.review.approved ? `审核通过${it.review.reason ? `：${it.review.reason}` : ''}` : `审核驳回：${it.review.reason ?? '不符合共享范围'}` })
    }
    if (it.publishedAt) {
      push({ id: `${it.id}_pub`, itemId: it.id, at: it.publishedAt, actorId: 'u_v', actorName: '志愿者', kind: 'published', detail: '发布到邻里药箱大厅' })
    }
    if (it.status === 'recalled') {
      push({ id: `${it.id}_recall`, itemId: it.id, at: it.publishedAt ?? it.createdAt, actorId: it.ownerId, actorName: it.ownerName, kind: 'recalled', detail: it.closeReason ?? '共享人撤回' })
    }
    if (it.status === 'scrapped') {
      push({ id: `${it.id}_scrap`, itemId: it.id, at: it.publishedAt ?? it.createdAt, actorId: 'u_s', actorName: '社区工作人员', kind: 'scrapped', detail: it.closeReason ?? '报废处理' })
    }
    if (it.status === 'quarantined') {
      push({ id: `${it.id}_quar`, itemId: it.id, at: it.publishedAt ?? it.createdAt, actorId: 'u_s', actorName: '社区工作人员', kind: 'quarantined', detail: it.closeReason ?? '风险隔离' })
    }
  }

  for (const r of requests) {
    const item = items.find((i) => i.id === r.itemId)
    const name = item ? `${item.name}` : r.itemId
    push({ id: `${r.id}_apply`, itemId: r.itemId, requestId: r.id, at: r.createdAt, actorId: r.applicantId, actorName: r.applicantName, kind: r.status === 'waiting' ? 'waitlisted' : 'applied', detail: `申请借用「${name}」×${r.quantity}` })
    if (r.confirmedAt) push({ id: `${r.id}_confirm`, itemId: r.itemId, requestId: r.id, at: r.confirmedAt, actorId: r.confirmerId ?? 'u_v', actorName: r.confirmerName ?? '志愿者', kind: 'confirmed', detail: `确认申请并锁定库存 ×${r.quantity}` })
    if (r.handingAt) push({ id: `${r.id}_handing`, itemId: r.itemId, requestId: r.id, at: r.handingAt, actorId: r.volunteerId ?? r.confirmerId ?? 'u_v', actorName: r.volunteerName ?? r.confirmerName ?? '志愿者', kind: 'handover_started', detail: r.method === 'volunteer_delivery' ? '志愿者出发代送' : r.method === 'door_contactless' ? '已放到约定门口位置' : '物品已备好，等待自取' })
    if (r.completedAt) push({ id: `${r.id}_done`, itemId: r.itemId, requestId: r.id, at: r.completedAt, actorId: r.applicantId, actorName: r.applicantName, kind: 'handover_confirmed', detail: `交接拍照确认：${r.handoverPhoto ?? '已上传照片'}${r.handoverNote ? `；${r.handoverNote}` : ''}` })
    if (r.status === 'closed_returned' && r.closedAt) {
      push({ id: `${r.id}_close`, itemId: r.itemId, requestId: r.id, at: r.closedAt, actorId: r.applicantId, actorName: r.applicantName, kind: r.closeMode === 'restock_new' ? 'restocked' : 'returned', detail: r.closeMode === 'mutual_aid' ? '邻里赠予，无需归还' : r.closeMode === 'restock_new' ? '已补充同规格新品' : '已归还原物（未拆封）' })
    }
    if (r.status === 'cancelled') {
      push({ id: `${r.id}_cancel`, itemId: r.itemId, requestId: r.id, at: r.closedAt ?? r.createdAt, actorId: r.applicantId, actorName: r.applicantName, kind: 'cancelled', detail: r.cancelReason ?? '申请取消，库存释放' })
    }
  }

  for (const f of feedbacks) {
    push({ id: `${f.id}_fb`, itemId: f.itemId, requestId: f.requestId, at: f.createdAt, actorId: f.reporterId, actorName: f.reporterName, kind: 'feedback', detail: `${f.type === 'package_damaged' ? '包装破损反馈' : f.type === 'adverse_reaction' ? '疑似不适反应反馈' : '其他反馈'}：${f.detail}` })
  }

  // 同批次冻结/解封/下架：事件挂到批次内每件物品，保证多件物品记录对得上
  for (const fb of frozenBatches) {
    const verb = fb.status === 'delisted' ? '同批次核查后下架' : fb.status === 'restored' || fb.status === 'warning' ? '同批次核查后恢复' : '同批次立即冻结'
    const kind = fb.status === 'delisted' ? 'batch_delisted' : fb.status === 'restored' || fb.status === 'warning' ? 'batch_restored' : 'batch_frozen'
    const at = fb.resolvedAt ?? fb.frozenAt
    for (const id of fb.itemIds) {
      push({ id: `${fb.key}_${kind}_${id}`, itemId: id, at, actorId: 'system', actorName: '系统', kind, detail: `${verb}：${fb.label}${fb.actionNote ? `；${fb.actionNote}` : ''}` })
    }
  }

  // 品类级风险提醒：挂到该品类每件物品
  for (const w of riskWarnings) {
    for (const it of items.filter((i) => i.category === w.category)) {
      push({ id: `warn_${w.category}_${it.id}`, itemId: it.id, at: w.at, actorId: w.staffId, actorName: w.staffName, kind: 'risk_warning', detail: `品类风险提醒：${w.note}` })
    }
  }

  return events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
}

export function freshState(now: string) {
  const { items, requests, feedbacks, frozenBatches, riskWarnings, notifications } = buildSeed(now)
  return {
    items,
    requests,
    feedbacks,
    frozenBatches,
    riskWarnings,
    notifications,
    timeline: rebuildTimeline(items, requests, feedbacks, frozenBatches, riskWarnings),
  }
}
