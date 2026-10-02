// 演示用户：居民 / 志愿者 / 社区工作人员
import type { BorrowRequest, DemoUser, Feedback, Item, Notice, RiskNotice, TimelineEvent } from '@/types'
import { addDays, addHours } from '@/utils/date'

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

/** 碘伏同批次演示批号：棉片 i2 与棉签 i13 同批号，反馈后连带冻结 */
export const IODOPHER_BATCH_A = 'IDP-2508A'

function buildSeed(now: string): {
  items: Item[]
  requests: BorrowRequest[]
  feedbacks: Feedback[]
  riskNotices: RiskNotice[]
  notices: Notice[]
} {
  const items: Item[] = [
    {
      id: 'i1',
      ownerId: 'u_a',
      ownerName: '王秀兰',
      name: '医用退热贴',
      category: 'fever_patch',
      spec: '4贴/盒',
      expiryDate: addDays(now, 180).slice(0, 10),
      storage: 'cool_dry',
      sealed: true,
      quantity: 2,
      location: '3号楼1单元一楼“邻里药箱”共享柜 A格',
      sceneTags: ['child_night_fever'],
      note: '家里备多了，未拆封，夜间急用可先取。',
      batchNo: 'FT-260301',
      manufacturer: '冰冰医疗',
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
      expiryDate: addDays(now, 45).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 5,
      location: '5号楼3单元门口便民架',
      sceneTags: ['elderly_wound', 'home_care'],
      note: '效期不足两个月，页面会显著提示，请按需借用。批号同 3 号楼王秀兰家的碘伏棉签（IDP-2508A）。',
      batchNo: IODOPHER_BATCH_A,
      manufacturer: '康健医疗用品厂',
      status: 'published',
      createdAt: addDays(now, -6),
      publishedAt: addDays(now, -6),
    },
    {
      id: 'i4',
      ownerId: 'u_c',
      ownerName: '周敏',
      name: '创可贴',
      category: 'bandage',
      spec: '100片/盒',
      expiryDate: addDays(now, 300).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 4,
      location: '5号楼3单元门口便民架',
      sceneTags: ['elderly_wound', 'home_care'],
      batchNo: 'BAN-260112',
      manufacturer: '护可邦',
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
      expiryDate: addDays(now, 400).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 20,
      location: '3号楼1单元一楼“邻里药箱”共享柜 B格',
      sceneTags: ['no_mask', 'home_care'],
      batchNo: 'MK-250618',
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
      expiryDate: addDays(now, 700).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 2,
      location: '5号楼3单元门口便民架',
      sceneTags: ['child_night_fever', 'home_care'],
      note: '电子体温计没电时应急更换。',
      batchNo: 'LR41-2512',
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
      expiryDate: addDays(now, 240).slice(0, 10),
      storage: 'cool_dry',
      sealed: true,
      quantity: 1,
      location: '2号楼2单元201门口挂袋',
      sceneTags: ['child_night_fever'],
      batchNo: 'FT-260508',
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
      expiryDate: addDays(now, 20).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 2,
      location: '3号楼1单元一楼“邻里药箱”共享柜 A格',
      sceneTags: ['elderly_wound'],
      note: '临近效期，请志愿者审核时重点确认。批号 IDP-2509B，与被反馈批次不同。',
      batchNo: 'IDP-2509B',
      manufacturer: '康健医疗用品厂',
      status: 'pending_review',
      createdAt: addDays(now, -1),
    },
    {
      id: 'i13',
      ownerId: 'u_a',
      ownerName: '王秀兰',
      name: '碘伏棉签',
      category: 'iodophor',
      spec: '独立折断式 20支/袋',
      expiryDate: addDays(now, 210).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 3,
      location: '3号楼1单元一楼“邻里药箱”共享柜 A格',
      sceneTags: ['elderly_wound', 'home_care'],
      note: `与 5 号楼周敏共享的碘伏棉片为同一批号（${IODOPHER_BATCH_A}），可互相印证包装情况。`,
      batchNo: IODOPHER_BATCH_A,
      manufacturer: '康健医疗用品厂',
      status: 'published',
      createdAt: addDays(now, -5),
      publishedAt: addDays(now, -5),
    },
    {
      id: 'i14',
      ownerId: 'u_c',
      ownerName: '周敏',
      name: '碘伏消毒液（小瓶）',
      category: 'iodophor',
      spec: '60ml/瓶 带密封盖',
      expiryDate: addDays(now, 260).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 2,
      location: '5号楼3单元门口便民架',
      sceneTags: ['elderly_wound', 'home_care'],
      note: '不同厂家、不同批号（IDP-2511C），同批次核查期间可作为安全替代参考。',
      batchNo: 'IDP-2511C',
      manufacturer: '净安消毒科技',
      status: 'published',
      createdAt: addDays(now, -3),
      publishedAt: addDays(now, -3),
    },
    {
      id: 'i9',
      ownerId: 'u_a',
      ownerName: '王秀兰',
      name: '防水创可贴',
      category: 'bandage',
      spec: '20片/盒',
      expiryDate: addDays(now, 200).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 1,
      location: '3号楼1单元一楼“邻里药箱”共享柜 A格',
      sceneTags: ['elderly_wound'],
      batchNo: 'BAN-250709',
      status: 'quarantined',
      createdAt: addDays(now, -5),
      publishedAt: addDays(now, -5),
      closeReason: '借用反馈包装破损，已隔离待工作人员核查',
      frozenByFeedbackId: 'f1',
      preFreezeStatus: 'published',
      riskSource: true,
    },
    {
      id: 'i3',
      ownerId: 'u_a',
      ownerName: '王秀兰',
      name: '无菌纱布块',
      category: 'gauze',
      spec: '5片/袋（独立灭菌）',
      expiryDate: addDays(now, 12).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 3,
      location: '3号楼1单元一楼“邻里药箱”共享柜 A格',
      sceneTags: ['elderly_wound', 'home_care'],
      note: '临近效期，且收到疑似不适反馈已隔离。',
      batchNo: 'GZ-260105',
      status: 'quarantined',
      createdAt: addDays(now, -7),
      publishedAt: addDays(now, -7),
      closeReason: '借用人反馈使用后伤口周围发红，疑似不适，已隔离',
      frozenByFeedbackId: 'f2',
      preFreezeStatus: 'published',
      riskSource: true,
    },
    {
      id: 'i10',
      ownerId: 'u_c',
      ownerName: '周敏',
      name: '儿童防护口罩',
      category: 'mask',
      spec: '10只/包',
      expiryDate: addDays(now, 300).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 1,
      location: '5号楼3单元门口便民架',
      sceneTags: ['no_mask'],
      batchNo: 'MK-250401',
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
      batchNo: 'GZ-OLD-1999',
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
      expiryDate: addDays(now, -3).slice(0, 10),
      storage: 'room_temp',
      sealed: true,
      quantity: 6,
      location: '5号楼3单元门口便民架',
      sceneTags: ['no_mask'],
      note: '已过期：大厅不可借用，等待工作人员报废。',
      batchNo: 'MK-240101',
      status: 'published',
      createdAt: addDays(now, -200),
      publishedAt: addDays(now, -199),
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
      id: 'r6',
      itemId: 'i2',
      applicantId: 'u_b',
      applicantName: '李建国',
      scene: 'elderly_wound',
      quantity: 1,
      method: 'self_pickup',
      note: '老人小伤口消毒用，昨晚从便民架取走一盒碘伏棉片。',
      status: 'completed',
      createdAt: addHours(now, -20),
      confirmedAt: addHours(now, -19),
      handingAt: addHours(now, -18),
      completedAt: addHours(now, -18),
      confirmerId: 'u_c',
      confirmerName: '周敏',
      handoverPhoto: 'handover-r6.jpg（演示凭证：便民架取件自拍）',
      handoverNote: '取走时外盒封签完好。',
    },
    {
      id: 'r7',
      itemId: 'i13',
      applicantId: 'u_b',
      applicantName: '李建国',
      scene: 'elderly_wound',
      quantity: 1,
      method: 'self_pickup',
      note: '老人伤口还要用几支碘伏棉签，棉片之外再候补一袋同小区邻居的。',
      status: 'waiting',
      createdAt: addHours(now, -4),
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
  ]

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
      frozenItemIds: ['i9'],
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
      symptoms: ['redness_swelling', 'itch'],
      allergyHistory: '本人对部分胶带过敏，具体成分不详；无家族药物过敏史。',
      usageMethod: 'soak_dressing',
      usageDetail: '用清水浸湿纱布后敷在手腕小伤口上约 20 分钟。',
      packagePhotos: ['pkg-f2-1.jpg（演示凭证：纱布独立包装正反面）'],
      soughtMedicalCare: false,
      medicalNote: '',
      frozenItemIds: ['i3'],
    },
    {
      id: 'f3',
      itemId: 'i4',
      requestId: 'r1',
      reporterId: 'u_b',
      reporterName: '李建国',
      type: 'adverse_reaction',
      detail: '老人贴创可贴一天后，胶贴覆盖处发红发痒，摘下半天后消退；同一盒其他人使用无异常。',
      createdAt: addDays(now, -8),
      status: 'resolved_risk_notice',
      symptoms: ['redness_swelling', 'itch'],
      allergyHistory: '老人既往对医用胶布有过类似发红反应。',
      usageMethod: 'direct_skin',
      usageDetail: '贴于手背小擦伤处，约 24 小时。',
      packagePhotos: ['pkg-f3-1.jpg（演示凭证：胶贴与包装批次）'],
      soughtMedicalCare: true,
      medicalNote: '社区卫生服务站判断为胶布接触部位轻度接触性皮炎，无需特殊处理。',
      frozenItemIds: ['i4'],
      handledAt: addDays(now, -7),
      handlerId: 'u_s',
      handlerName: '赵磊（社区工作人员）',
      handleNote: '回访卫生站并核验同批包装封签、灭菌合格证明，倾向个体胶布过敏，物品合格；恢复共享并给“创可贴”品类加入风险提醒。',
      investigation: {
        at: addDays(now, -7),
        handlerId: 'u_s',
        handlerName: '赵磊（社区工作人员）',
        conclusion: 'individual_allergy',
        action: 'restore_with_notice',
        sameBatchScrapped: false,
        riskNoticeAdded: true,
        note: '同批其余独立包装抽检封签完好、在效期内；接触性皮炎与既往胶布过敏史吻合，恢复共享并保留品类风险提醒。',
      },
    },
  ]

  const riskNotices: RiskNotice[] = [
    {
      id: 'rn1',
      category: 'bandage',
      title: '创可贴/医用胶带曾出现个体过敏反馈',
      detail:
        '有邻居（既往对医用胶布过敏）使用创可贴后出现胶贴覆盖处发红发痒，社区核验同批物品合格、判断为个体接触性皮炎。对胶布/橡胶过敏或使用后红肿瘙痒者请勿使用，改用无菌纱布简单包扎并及时就医。',
      relatedItemId: 'i4',
      relatedFeedbackId: 'f3',
      createdAt: addDays(now, -7),
      createdBy: 'u_s',
      createdByName: '赵磊（社区工作人员）',
      active: true,
    },
  ]

  const notices: Notice[] = [
    {
      id: 'n1',
      at: addDays(now, -7),
      kind: 'risk_notice',
      title: '风险提醒：创可贴品类已有个体过敏记录',
      body: '社区核查确认此前创可贴不适反馈为个体胶布过敏、物品合格，已恢复共享；对胶带过敏或使用后红肿者请避免使用并选择替代方式。',
      itemId: 'i4',
      feedbackId: 'f3',
      recipientIds: ['u_a', 'u_b', 'u_c', 'u_v', 'u_s'],
      readBy: ['u_a', 'u_c', 'u_v', 'u_s'],
    },
  ]

  return { items, requests, feedbacks, riskNotices, notices }
}

/** 由物品/申请/反馈快照重建全流程时间线（种子数据与数据修复共用） */
export function rebuildTimeline(
  items: Item[],
  requests: BorrowRequest[],
  feedbacks: Feedback[],
  riskNotices: RiskNotice[] = [],
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
      push({
        id: `${it.id}_quar`,
        itemId: it.id,
        at: it.publishedAt ?? it.createdAt,
        actorId: it.riskSource ? 'u_b' : 'u_s',
        actorName: it.riskSource ? '反馈居民' : '社区工作人员',
        kind: it.frozenByFeedbackId ? 'batch_quarantined' : 'quarantined',
        detail: it.closeReason ?? '风险隔离',
      })
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
    if (f.investigation) {
      push({
        id: `${f.id}_inv`,
        itemId: f.itemId,
        requestId: f.requestId,
        at: f.investigation.at,
        actorId: f.investigation.handlerId,
        actorName: f.investigation.handlerName,
        kind: 'investigated',
        detail: `社区核查结论：${
          f.investigation.conclusion === 'individual_allergy'
            ? '个体过敏/个体反应'
            : f.investigation.conclusion === 'item_issue'
              ? '物品问题'
              : '暂无法判定'
        }；处理：${
          f.investigation.action === 'scrap_batch'
            ? '同批次下架报废'
            : f.investigation.action === 'restore_with_notice'
              ? '恢复共享并加入风险提醒'
              : '解除冻结、恢复共享'
        }。${f.investigation.note}`,
      })
    }
  }

  for (const rn of riskNotices) {
    push({
      id: `${rn.id}_tl`,
      itemId: rn.relatedItemId ?? '__category__',
      at: rn.createdAt,
      actorId: rn.createdBy,
      actorName: rn.createdByName,
      kind: 'risk_notice',
      detail: `品类风险提醒：${rn.title}`,
    })
  }

  return events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
}

export function freshState(now: string) {
  const { items, requests, feedbacks, riskNotices, notices } = buildSeed(now)
  return { items, requests, feedbacks, riskNotices, notices, timeline: rebuildTimeline(items, requests, feedbacks, riskNotices) }
}
