import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMedkitStore } from '@/stores/medkit'
import type { ItemDraft } from '@/types'
import { IODOPHOR_BATCH } from '@/data/seed'

const STORAGE_KEY = 'medkit-share-state-v2'
/** 用例专用批号，避免与种子已冻结的 IOD-20260701 撞号 */
const TEST_BATCH = 'IOD-TEST-0001'

function freshStore() {
  localStorage.clear()
  setActivePinia(createPinia())
  const store = useMedkitStore()
  // 用例自己造冻结场景：清掉种子的冻结批次/通知/反馈/申请，避免品类级暂停与既有通知干扰断言
  store.frozenBatches = []
  store.notifications = []
  store.feedbacks = []
  store.requests = []
  store.riskWarnings = []
  return store
}

function iodophorDraft(ownerPatch: Partial<ItemDraft> = {}): ItemDraft {
  return {
    name: '碘伏棉片',
    category: 'iodophor',
    spec: '20片/盒',
    batchNo: TEST_BATCH,
    expiryDate: '2027-03-01',
    storage: 'room_temp',
    sealed: true,
    quantity: 3,
    location: '3号楼共享柜',
    sceneTags: ['elderly_wound', 'home_care'],
    ...ownerPatch,
  }
}

/** 登记并以志愿者审核发布，返回物品 id */
function publishItem(store: ReturnType<typeof useMedkitStore>, draft: ItemDraft, owner = 'u_a'): string {
  store.switchUser(owner)
  const reg = store.register(draft)
  expect(reg.ok).toBe(true)
  const id = store.items[0].id
  store.switchUser('u_v')
  const rev = store.reviewItem(id, true)
  expect(rev.ok).toBe(true)
  return id
}

/** 申请 → 确认 → 自取交接 → 拍照完成，返回申请 id */
function completeBorrow(store: ReturnType<typeof useMedkitStore>, itemId: string, applicant: string) {
  store.switchUser(applicant)
  const apply = store.apply(itemId, 1, 'elderly_wound', 'self_pickup')
  expect(apply.ok).toBe(true)
  const reqId = store.requests[0].id
  store.switchUser('u_v')
  expect(store.confirmRequest(reqId).ok).toBe(true)
  expect(store.startHandover(reqId).ok).toBe(true)
  expect(store.completeHandover(reqId, 'photo.jpg', '封签完好').ok).toBe(true)
  return reqId
}

const ADVERSE_EXTRA = {
  symptoms: '接触部位皮肤发红；局部肿胀',
  usageMethod: '用碘伏棉片湿敷/擦拭',
  allergyHistory: '不清楚，没有留意过',
  packagePhoto: 'feedback-package.jpg（演示凭证）',
  soughtMedicalCare: true,
  medicalNote: '社区卫生服务中心考虑接触性皮炎',
}

/** 借用人提交不适反馈，返回新反馈 id（反馈列表最新在前） */
function reportAdverse(store: ReturnType<typeof useMedkitStore>, itemId: string, detail = '用后半小时伤口周围红肿发痒') {
  store.switchUser('u_b')
  const r = store.reportFeedback(itemId, 'adverse_reaction', detail, undefined, ADVERSE_EXTRA)
  expect(r.ok).toBe(true)
  return store.feedbacks[0].id
}

describe('同批次冻结核查流程', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
  })

  it('不适反馈后立即冻结同品类同批号的全部剩余物品，不同批号不被连带冻结', () => {
    const store = freshStore()
    const idA = publishItem(store, iodophorDraft({ name: '碘伏棉片' }))
    const idB = publishItem(store, iodophorDraft({ name: '碘伏棉签', spec: '36支/盒' }))
    // 不同批号的碘伏：不进入冻结批次清单，但冻结期间随品类暂停申请
    const idC = publishItem(store, iodophorDraft({ name: '碘伏消毒液', spec: '100ml/瓶', batchNo: 'IOD-OTHER' }))
    // 安全替代物：纱布
    const idGauze = publishItem(store, {
      ...iodophorDraft(),
      name: '无菌纱布块',
      category: 'gauze',
      batchNo: 'GA-1',
      spec: '5片/袋',
    })

    // 李建国已取走 idA（已借用居民）
    completeBorrow(store, idA, 'u_b')
    // 周敏对 idB 有一笔候补
    store.switchUser('u_c')
    expect(store.apply(idB, 1, 'home_care', 'door_contactless').ok).toBe(true)
    const waitingReq = store.requests[0]
    // 其他批号 idC：王秀兰一笔已确认（在途，冻结后继续履行）、周敏一笔候补（冻结后取消）
    store.switchUser('u_c')
    expect(store.apply(idC, 1, 'home_care', 'self_pickup').ok).toBe(true)
    const otherWaiting = store.requests[0]
    // 再为王秀兰造一笔已确认的 idC 借用
    store.switchUser('u_a')
    expect(store.apply(idC, 1, 'elderly_wound', 'self_pickup').ok).toBe(true)
    const otherConfirmedReq = store.requests.find((r) => r.applicantId === 'u_a' && r.itemId === idC)!
    store.switchUser('u_v')
    expect(store.confirmRequest(otherConfirmedReq.id).ok).toBe(true)

    // 李建国反馈使用后皮肤红肿
    reportAdverse(store, idA)

    // 同批次两件立即冻结
    expect(store.items.find((i) => i.id === idA)!.status).toBe('quarantined')
    expect(store.items.find((i) => i.id === idB)!.status).toBe('quarantined')
    expect(store.items.find((i) => i.id === idA)!.frozenBatchKey).toBeTruthy()
    // 不同批号物品不被连带物理冻结
    expect(store.items.find((i) => i.id === idC)!.status).not.toBe('quarantined')
    expect(store.items.find((i) => i.id === idGauze)!.status).toBe('published')

    // 冻结批次清单
    expect(store.activeFrozenBatches).toHaveLength(1)
    expect(store.activeFrozenBatches[0].itemIds.sort()).toEqual([idA, idB].sort())
    expect(store.isCategoryFrozen('iodophor')).toBe(true)

    // 候补中申请自动取消（同批次 + 同品类其他批号）；已确认在途借用继续履行；已取走的保留以便回访
    expect(store.requests.find((x) => x.id === waitingReq.id)!.status).toBe('cancelled')
    expect(store.requests.find((x) => x.id === otherWaiting.id)!.status).toBe('cancelled')
    expect(store.requests.find((x) => x.id === otherConfirmedReq.id)!.status).toBe('confirmed')
    expect(store.requests.find((x) => x.itemId === idA && x.status === 'completed')).toBeTruthy()
  })

  it('冻结后立即通知共享人、社区工作人员、已借用居民与被取消申请的居民', () => {
    const store = freshStore()
    const idA = publishItem(store, iodophorDraft())
    const idB = publishItem(store, iodophorDraft({ name: '碘伏棉签' }))
    completeBorrow(store, idA, 'u_b')
    store.switchUser('u_c')
    store.apply(idB, 1, 'home_care', 'self_pickup')
    reportAdverse(store, idA)

    // 共享人王秀兰
    store.switchUser('u_a')
    expect(store.myNotifications.some((n) => n.kind === 'batch_frozen')).toBe(true)
    // 社区工作人员赵磊
    store.switchUser('u_s')
    expect(store.myNotifications.some((n) => n.kind === 'batch_frozen')).toBe(true)
    // 已借用居民李建国
    store.switchUser('u_b')
    expect(store.myNotifications.some((n) => n.kind === 'batch_frozen')).toBe(true)
    // 候补被取消的周敏
    store.switchUser('u_c')
    expect(store.myNotifications.some((n) => n.kind === 'request_cancelled')).toBe(true)

    // 未读计数与已读
    expect(store.unreadCount).toBeGreaterThan(0)
    store.markAllNotificationsRead()
    expect(store.unreadCount).toBe(0)
  })

  it('冻结期间申请同类物品被拦截，并给出安全替代物与就医渠道', () => {
    const store = freshStore()
    const idA = publishItem(store, iodophorDraft())
    const idGauze = publishItem(store, { ...iodophorDraft(), name: '纱布', category: 'gauze', batchNo: 'GA-1' })
    const idBandage = publishItem(store, { ...iodophorDraft(), name: '创可贴', category: 'bandage', batchNo: 'BA-1' })

    reportAdverse(store, idA)

    // 不同批号的碘伏同样不可申请（品类级暂停，避免扩散）
    const idOther = publishItem(store, iodophorDraft({ name: '碘伏消毒液', batchNo: 'IOD-X' }))
    store.switchUser('u_c')
    const blocked = store.apply(idOther, 1, 'elderly_wound', 'self_pickup')
    expect(blocked.ok).toBe(false)
    expect(blocked.message).toContain('核查')

    // 安全替代物：同场景在架、未涉事、有余量
    const alts = store.safeAlternatives('iodophor').map((i) => i.id)
    expect(alts).toContain(idGauze)
    expect(alts).toContain(idBandage)
    expect(store.alternativeAdvice('iodophor')).toContain('流动水')
  })

  it('无批号物品的不适反馈只隔离该单件，不产生批次冻结', () => {
    const store = freshStore()
    const idA = publishItem(store, iodophorDraft({ batchNo: '' }))
    const idB = publishItem(store, iodophorDraft({ name: '碘伏棉签' }))
    store.switchUser('u_b')
    const r = store.reportFeedback(idA, 'adverse_reaction', '红肿', undefined, { ...ADVERSE_EXTRA, packagePhoto: 'feedback-p.jpg' })
    expect(r.ok).toBe(true)
    expect(store.items.find((i) => i.id === idA)!.status).toBe('quarantined')
    expect(store.items.find((i) => i.id === idB)!.status).toBe('published')
    expect(store.activeFrozenBatches).toHaveLength(0)
  })

  it('核查判定物品问题 → 同批次下架报废', () => {
    const store = freshStore()
    const idA = publishItem(store, iodophorDraft())
    const idB = publishItem(store, iodophorDraft({ name: '碘伏棉签' }))
    const fbId = reportAdverse(store, idA)

    store.switchUser('u_s')
    const r = store.investigateFeedback(fbId, 'product_issue', 'delist_batch', '多位居民反馈类似症状，包装封签异常，判定批次问题')
    expect(r.ok).toBe(true)
    expect(store.items.find((i) => i.id === idA)!.status).toBe('scrapped')
    expect(store.items.find((i) => i.id === idB)!.status).toBe('scrapped')
    expect(store.feedbacks.find((f) => f.id === fbId)!.status).toBe('resolved_scrap')
    expect(store.frozenBatches[0].status).toBe('delisted')
    expect(store.activeFrozenBatches).toHaveLength(0)
    // 共享人收到下架通知
    store.switchUser('u_a')
    expect(store.myNotifications.some((n) => n.title.includes('下架'))).toBe(true)
  })

  it('核查判定个体过敏 + 风险提醒 → 恢复共享并加挂品类风险提醒', () => {
    const store = freshStore()
    const idA = publishItem(store, iodophorDraft())
    const idB = publishItem(store, iodophorDraft({ name: '碘伏棉签' }))
    const fbId = reportAdverse(store, idA)

    store.switchUser('u_s')
    const r = store.investigateFeedback(fbId, 'individual_allergy', 'risk_warning', '回访诊断接触性皮炎；同批次其他人无异常，判定个体过敏')
    expect(r.ok).toBe(true)
    expect(store.items.find((i) => i.id === idA)!.status).toBe('published')
    expect(store.items.find((i) => i.id === idB)!.status).toBe('published')
    expect(store.items.find((i) => i.id === idA)!.riskNote).toContain('过敏')
    expect(store.riskWarnings.some((w) => w.category === 'iodophor')).toBe(true)
    expect(store.feedbacks.find((f) => f.id === fbId)!.status).toBe('resolved_warning')
    expect(store.frozenBatches[0].status).toBe('warning')
    expect(store.categoryWarning('iodophor')?.note).toContain('过敏')
  })

  it('核查判定物品无问题 → 直接恢复共享，不加风险提醒', () => {
    const store = freshStore()
    const idA = publishItem(store, iodophorDraft())
    const fbId = reportAdverse(store, idA, '轻微发红')
    store.switchUser('u_s')
    const r = store.investigateFeedback(fbId, 'individual_allergy', 'restore', '核验封签与进货记录合格，反馈为偶发反应')
    expect(r.ok).toBe(true)
    expect(store.items.find((i) => i.id === idA)!.status).toBe('published')
    expect(store.riskWarnings).toHaveLength(0)
    expect(store.frozenBatches[0].status).toBe('restored')
    expect(store.isCategoryFrozen('iodophor')).toBe(false)
  })

  it('证据不足 → 维持冻结继续核查，反馈仍为待处置', () => {
    const store = freshStore()
    const idA = publishItem(store, iodophorDraft())
    const fbId = reportAdverse(store, idA, '有点红')
    store.switchUser('u_s')
    const r = store.investigateFeedback(fbId, 'inconclusive', 'continue_freeze', '暂时联系不上反馈人，继续取证')
    expect(r.ok).toBe(true)
    expect(store.items.find((i) => i.id === idA)!.status).toBe('quarantined')
    expect(store.feedbacks.find((f) => f.id === fbId)!.status).toBe('open')
    expect(store.activeFrozenBatches).toHaveLength(1)
  })

  it('非工作人员不能核查；不适反馈不能走包装破损处置入口', () => {
    const store = freshStore()
    const idA = publishItem(store, iodophorDraft())
    const fbId = reportAdverse(store, idA)
    // 志愿者也不行
    store.switchUser('u_v')
    expect(store.investigateFeedback(fbId, 'product_issue', 'delist_batch', 'x').ok).toBe(false)
    store.switchUser('u_s')
    expect(store.resolveFeedback(fbId, 'scrap', '核查报废').ok).toBe(false)
  })
})

describe('种子演示数据：碘伏红肿场景开箱即用', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('i2/i13 同批次已冻结，通知已发给三方', () => {
    localStorage.clear()
    setActivePinia(createPinia())
    const store = useMedkitStore()

    const i2 = store.items.find((i) => i.id === 'i2')!
    const i13 = store.items.find((i) => i.id === 'i13')!
    expect(i2.status).toBe('quarantined')
    expect(i13.status).toBe('quarantined')
    expect(i2.frozenBatchKey).toBe(i13.frozenBatchKey)
    expect(store.activeFrozenBatches[0].batchNo).toBe(IODOPHOR_BATCH)

    const alts = store.safeAlternatives('iodophor').map((i) => i.id)
    expect(alts).toContain('i14')
    expect(alts).toContain('i15')

    store.switchUser('u_s')
    expect(store.myNotifications.some((n) => n.kind === 'batch_frozen')).toBe(true)
    store.switchUser('u_c')
    expect(store.myNotifications.some((n) => n.kind === 'request_cancelled')).toBe(true)

    const f3 = store.feedbacks.find((f) => f.id === 'f3')!
    expect(f3.symptoms).toContain('发红')
    expect(f3.soughtMedicalCare).toBe(true)
    expect(f3.packagePhoto).toContain('包装')
  })
})
