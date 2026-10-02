import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMedkitStore } from '@/stores/medkit'
import type { AdverseReportPayload } from '@/stores/medkit'

const STORAGE_KEY = 'medkit-share-state-v2'

function adversePayload(over: Partial<AdverseReportPayload> = {}): AdverseReportPayload {
  return {
    detail: '用碘伏棉片擦拭老人手腕伤口后，伤口周围红肿发痒。',
    symptoms: ['redness_swelling', 'itch'],
    allergyHistory: '不详',
    usageMethod: 'wipe_wound',
    usageDetail: '擦拭 2 次，约 10 分钟后发红',
    packagePhotos: ['pkg-1.jpg（演示凭证）'],
    soughtMedicalCare: false,
    medicalNote: '',
    ...over,
  }
}

function freshStore() {
  localStorage.clear()
  setActivePinia(createPinia())
  return useMedkitStore()
}

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEY)
})

describe('登记 → 审核 → 发布', () => {
  it('禁入品登记失败；正常登记经志愿者审核后发布', () => {
    const store = freshStore()
    store.switchUser('u_a')
    const bad = store.register({
      name: '布洛芬胶囊',
      category: 'other_consumable',
      spec: '10粒/盒',
      expiryDate: '2027-01-01',
      storage: 'room_temp',
      sealed: true,
      quantity: 1,
      location: '家里',
      sceneTags: [],
    })
    expect(bad.ok).toBe(false)

    const ok = store.register({
      name: '无菌棉签',
      category: 'gauze',
      spec: '100支/包',
      expiryDate: '2027-06-01',
      storage: 'room_temp',
      sealed: true,
      quantity: 2,
      location: '3号楼共享柜',
      sceneTags: ['elderly_wound'],
      batchNo: 'MQ-260101',
    })
    expect(ok.ok).toBe(true)
    const item = store.items[0]
    expect(item.status).toBe('pending_review')

    store.switchUser('u_v')
    const reviewed = store.reviewItem(item.id, true)
    expect(reviewed.ok).toBe(true)
    expect(store.items.find((i) => i.id === item.id)?.status).toBe('published')
  })
})

describe('使用后不适反馈 → 同批次立即冻结 + 通知', () => {
  it('碘伏同批号物品全部冻结、不同批号不受影响', () => {
    const store = freshStore()
    store.switchUser('u_b') // 李建国：r6 已取走过一盒 i2 碘伏棉片
    const r = store.reportFeedback('i2', 'adverse_reaction', adversePayload().detail, 'r6', adversePayload())
    expect(r.ok).toBe(true)

    const fb = store.feedbacks.find((f) => f.itemId === 'i2' && f.status === 'open')!
    expect(fb.symptoms).toEqual(['redness_swelling', 'itch'])
    expect(fb.allergyHistory).toBe('不详')
    expect(fb.packagePhotos).toHaveLength(1)
    expect(fb.frozenItemIds?.sort()).toEqual(['i13', 'i2'])

    expect(store.items.find((i) => i.id === 'i2')?.status).toBe('quarantined')
    expect(store.items.find((i) => i.id === 'i2')?.frozenByFeedbackId).toBe(fb.id)
    expect(store.items.find((i) => i.id === 'i13')?.status).toBe('quarantined')
    // 不同批号 / 不同品类不受影响
    expect(store.items.find((i) => i.id === 'i14')?.status).toBe('published')
    expect(store.items.find((i) => i.id === 'i8')?.status).toBe('pending_review')
  })

  it('在途申请全部取消，已取走的借用保留', () => {
    const store = freshStore()
    store.switchUser('u_b')
    store.reportFeedback('i2', 'adverse_reaction', adversePayload().detail, 'r6', adversePayload())

    const r6 = store.requests.find((x) => x.id === 'r6')! // 李建国已取走
    const r7 = store.requests.find((x) => x.id === 'r7')! // 王秀兰候补 i13
    expect(r6.status).toBe('completed')
    expect(r7.status).toBe('cancelled')
    expect(r7.cancelReason).toContain('批次')
    expect(r7.frozenByFeedbackId).toBeTruthy()
  })

  it('通知共享人、社区工作人员和已借用居民；候补人收到取消通知', () => {
    const store = freshStore()
    store.switchUser('u_b')
    store.reportFeedback('i2', 'adverse_reaction', adversePayload().detail, 'r6', adversePayload())

    const quarantine = store.notices.find((n) => n.kind === 'quarantine')!
    expect(quarantine).toBeTruthy()
    // 共享人：周敏(i2)、王秀兰(i13)；已借用居民/候补人：李建国(r6/r7)；志愿者+工作人员
    for (const uid of ['u_a', 'u_b', 'u_c', 'u_v', 'u_s']) {
      expect(quarantine.recipientIds).toContain(uid)
    }
    expect(quarantine.body).toContain('同批次')

    // 李建国（u_b）既是反馈人/已借用居民又是被取消的候补人，能看到冻结+取消通知
    const titles = store.myNotices.map((n) => n.title).join(' ')
    expect(titles).toContain('冻结')
    expect(titles).toContain('取消')
    // 共享人王秀兰收到冻结通知
    store.switchUser('u_a')
    expect(store.myNotices.some((n) => n.kind === 'quarantine')).toBe(true)
  })

  it('冻结期间不能申请/确认/交接/审核该批次物品', () => {
    const store = freshStore()
    store.switchUser('u_b')
    store.reportFeedback('i2', 'adverse_reaction', adversePayload().detail, 'r6', adversePayload())

    expect(store.apply('i2', 1, 'elderly_wound', 'self_pickup').ok).toBe(false)
    expect(store.apply('i13', 1, 'elderly_wound', 'self_pickup').ok).toBe(false)
    store.switchUser('u_v')
    expect(store.reviewItem('i8', true).ok).toBe(true) // 不同批次仍可审核
  })

  it('大厅替代推荐只给不同批次、在效期、有余量的同类物品', () => {
    const store = freshStore()
    store.switchUser('u_b')
    store.reportFeedback('i2', 'adverse_reaction', adversePayload().detail, 'r6', adversePayload())

    const alts = store.safeAlternativesForCategory('iodophor').map((x) => x.item.id)
    expect(alts).toContain('i14')
    expect(alts).not.toContain('i2')
    expect(alts).not.toContain('i13')

    const inv = store.investigationForCategory('iodophor')!
    expect(inv.batchNos).toEqual(['IDP-2508A'])
    expect(inv.itemIds.sort()).toEqual(['i13', 'i2'])
  })

  it('包装破损只冻结反馈物品本身，不联动同批次', () => {
    const store = freshStore()
    store.switchUser('u_a')
    const r = store.reportFeedback('i4', 'package_damaged', '外盒封签开裂')
    expect(r.ok).toBe(true)
    expect(store.items.find((i) => i.id === 'i4')?.status).toBe('quarantined')
    // 只有反馈物品被本次反馈冻结；i9 是种子里另一条反馈(f1)早已隔离的，与本次无关
    const linked = store.items.filter((i) => i.frozenByFeedbackId === store.feedbacks[0].id)
    expect(linked.map((i) => i.id)).toEqual(['i4'])
  })
})

describe('社区核查结论', () => {
  function freezeIodophor() {
    const store = freshStore()
    store.switchUser('u_b')
    store.reportFeedback('i2', 'adverse_reaction', adversePayload().detail, 'r6', adversePayload())
    store.switchUser('u_s')
    const fb = store.feedbacks.find((f) => f.itemId === 'i2' && f.status === 'open')!
    return { store, fb }
  }

  it('个体过敏：同批次恢复共享并发布品类风险提醒，借用前强制确认', () => {
    const { store, fb } = freezeIodophor()
    const r = store.resolveFeedback(fb.id, { conclusion: 'individual_allergy', note: '回访判断为个体接触性过敏，同批封签完好' })
    expect(r.ok).toBe(true)

    // i2 有 1 件已被 r6 取走锁定，恢复后按占用派生为“部分外借中”；i13 无锁定恢复为可借
    expect(store.items.find((i) => i.id === 'i2')?.status).toBe('partially_lent')
    expect(store.items.find((i) => i.id === 'i13')?.status).toBe('published')
    const refreshed = store.feedbacks.find((f) => f.id === fb.id)!
    expect(refreshed.status).toBe('resolved_risk_notice')
    expect(refreshed.investigation?.riskNoticeAdded).toBe(true)

    const notice = store.activeRiskNoticeFor('iodophor')
    expect(notice?.title).toContain('碘伏')
    expect(store.riskNotices.some((n) => n.category === 'iodophor' && n.active)).toBe(true)

    // 未勾选风险知情确认不能申请
    store.switchUser('u_c')
    const blocked = store.apply('i14', 1, 'elderly_wound', 'self_pickup')
    expect(blocked.ok).toBe(false)
    expect(blocked.message).toContain('风险提醒')
    const allowed = store.apply('i14', 1, 'elderly_wound', 'self_pickup', undefined, true)
    expect(allowed.ok).toBe(true)

    // 相关居民收到核查结论通知
    const invNotice = store.notices.find((n) => n.kind === 'investigation')!
    expect(invNotice.body).toContain('个体过敏')
  })

  it('物品问题：同批次剩余物品全部下架报废', () => {
    const { store, fb } = freezeIodophor()
    const r = store.resolveFeedback(fb.id, { conclusion: 'item_issue', note: '同批号棉片变色并有异味，多人反馈类似刺痛' })
    expect(r.ok).toBe(true)

    for (const id of ['i2', 'i13']) {
      const it = store.items.find((i) => i.id === id)!
      expect(it.status).toBe('scrapped')
      expect(it.closeReason).toContain('物品问题')
    }
    // 不同批次 i14 仍然在架
    expect(store.items.find((i) => i.id === 'i14')?.status).toBe('published')
    const done = store.feedbacks.find((f) => f.id === fb.id)!
    expect(done.status).toBe('resolved_scrap')
    expect(store.notices.some((n) => n.kind === 'investigation' && n.body.includes('物品问题'))).toBe(true)
  })

  it('暂无法判定：解除冻结恢复共享，不加风险提醒', () => {
    const { store, fb } = freezeIodophor()
    const r = store.resolveFeedback(fb.id, { conclusion: 'inconclusive', note: '反馈人无法联系，包装核验无异常' })
    expect(r.ok).toBe(true)
    expect(['published', 'partially_lent']).toContain(store.items.find((i) => i.id === 'i2')?.status)
    expect(store.activeRiskNoticeFor('iodophor')).toBeUndefined()
    expect(store.feedbacks.find((f) => f.id === fb.id)?.status).toBe('resolved_republish')
  })

  it('只有工作人员可以处置反馈', () => {
    const { store, fb } = freezeIodophor()
    store.switchUser('u_b')
    const r = store.resolveFeedback(fb.id, { conclusion: 'inconclusive', note: '居民尝试处置' })
    expect(r.ok).toBe(false)
  })
})

describe('既有流程回归（锁定/候补/闭环/超时/撤回/过期）', () => {
  it('确认即锁定，余量不足保持候补，补充新品后释放递补', () => {
    const store = freshStore()
    // i1 总量 2，种子 r3 已锁定 1；再申请 1 并确认 → 借完
    store.switchUser('u_b')
    const a1 = store.apply('i1', 1, 'child_night_fever', 'self_pickup')
    expect(a1.ok).toBe(true)
    const req1 = store.requests.find((r) => r.applicantId === 'u_b' && r.itemId === 'i1')!
    store.switchUser('u_a')
    expect(store.confirmRequest(req1.id).ok).toBe(true)
    expect(store.items.find((i) => i.id === 'i1')?.status).toBe('lent_out')

    store.switchUser('u_c')
    const a2 = store.apply('i1', 1, 'child_night_fever', 'self_pickup')
    expect(a2.ok).toBe(true)
    const req2 = store.requests.find((r) => r.applicantId === 'u_c' && r.itemId === 'i1' && r.status === 'waiting')!
    expect(store.confirmRequest(req2.id).ok).toBe(false) // 余量不足

    // 李建国完成取件（交接拍照）后补充新品，库存增加，候补可递补
    store.switchUser('u_b')
    expect(store.startHandover(req1.id).ok).toBe(true)
    expect(store.completeHandover(req1.id, 'photo.jpg', '取件拍照').ok).toBe(true)
    expect(store.closeBorrow(req1.id, 'restock_new', '买了同规格新品').ok).toBe(true)
    store.switchUser('u_a')
    expect(store.confirmRequest(req2.id).ok).toBe(true)
  })

  it('过期物品不能申请；过期清单进入工作人员看板', () => {
    const store = freshStore()
    const blocked = store.apply('i12', 1, 'no_mask', 'self_pickup')
    expect(blocked.ok).toBe(false)
    expect(blocked.message).toContain('过期')
    expect(store.expiredListed.map((i) => i.id)).toContain('i12')
  })

  it('共享人撤回取消候补但保留进行中借用；冻结期间不能撤回', () => {
    const store = freshStore()
    store.switchUser('u_c')
    // i6 有 r4 候补
    const r = store.recallItem('i6', '家里自己要用')
    expect(r.ok).toBe(true)
    expect(store.requests.find((x) => x.id === 'r4')?.status).toBe('cancelled')

    // i2 被冻结后共享人 u_c 不能撤回
    store.switchUser('u_b')
    store.reportFeedback('i2', 'adverse_reaction', adversePayload().detail, 'r6', adversePayload())
    store.switchUser('u_c')
    expect(store.recallItem('i2', '想撤回').ok).toBe(false)
  })

  it('演示时钟快进后超时未取与配送 SLA 派生标红', () => {
    const store = freshStore()
    expect(store.overduePickups.some((x) => x.req.id === 'r3')).toBe(true) // r3 已确认 26h
    expect(store.delayedDeliveries.some((x) => x.req.id === 'r5')).toBe(true) // r5 配送 8h > 6h SLA
  })

  it('历史已处置的创可贴个体过敏反馈在种子中留有风险提醒', () => {
    const store = freshStore()
    const f3 = store.feedbacks.find((f) => f.id === 'f3')
    expect(f3?.status).toBe('resolved_risk_notice')
    expect(f3?.investigation?.conclusion).toBe('individual_allergy')
    expect(store.activeRiskNoticeFor('bandage')).toBeTruthy()
  })

  it('重置演示数据回到初始状态', () => {
    const store = freshStore()
    store.switchUser('u_b')
    store.reportFeedback('i2', 'adverse_reaction', adversePayload().detail, 'r6', adversePayload())
    expect(store.items.find((i) => i.id === 'i2')?.status).toBe('quarantined')
    store.resetDemo()
    expect(store.items.find((i) => i.id === 'i2')?.status).toBe('published')
    expect(store.currentUserId).toBe('u_b')
  })
})

describe('时间线串联', () => {
  it('同一次冻结核查在每件物品时间线都留有事件，含核查结论', () => {
    const store = freshStore()
    store.switchUser('u_b')
    store.reportFeedback('i2', 'adverse_reaction', adversePayload().detail, 'r6', adversePayload())
    store.switchUser('u_s')
    const fb = store.feedbacks.find((f) => f.itemId === 'i2' && f.status === 'open')!
    store.resolveFeedback(fb.id, { conclusion: 'individual_allergy', note: '个体过敏核查记录' })

    const kinds2 = store.itemTimeline('i2').map((e) => e.kind)
    expect(kinds2).toContain('feedback')
    expect(kinds2).toContain('quarantined')
    expect(kinds2).toContain('investigated')
    expect(kinds2).toContain('risk_notice')

    const kinds13 = store.itemTimeline('i13').map((e) => e.kind)
    expect(kinds13).toContain('batch_quarantined')
  })
})
