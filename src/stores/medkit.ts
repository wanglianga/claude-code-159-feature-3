import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import type {
  AppNotification,
  BorrowRequest,
  CategoryRiskWarning,
  Feedback,
  FeedbackType,
  FrozenBatch,
  HandoverMethod,
  InvestigationConclusion,
  Item,
  ItemDraft,
  RequestStatus,
  RiskAction,
  Scene,
  TimelineEvent,
} from '@/types'
import {
  ALTERNATIVE_ADVICE,
  BORROWER_NOTIFY_STATUSES,
  CATEGORY_ALTERNATIVES,
  CATEGORY_LABELS,
  DELIVERY_SLA_HOURS,
  PICKUP_WINDOW_HOURS,
  STOCK_LOCKING_STATUSES,
  batchKey,
  batchLabel,
  isActiveItem,
  validateDraft,
} from '@/rules'
import { addHours, daysUntil, hoursSince } from '@/utils/date'
import { BASE_NOW, DEMO_USERS, freshState, uid } from '@/data/seed'

const STORAGE_KEY = 'medkit-share-state-v2'

interface PersistShape {
  nowIso: string
  currentUserId: string
  items: Item[]
  requests: BorrowRequest[]
  feedbacks: Feedback[]
  frozenBatches: FrozenBatch[]
  riskWarnings: CategoryRiskWarning[]
  notifications: AppNotification[]
  timeline: TimelineEvent[]
}

interface ActionResult {
  ok: boolean
  message: string
}

export class ActionError extends Error {}

/** 不适反馈扩展登记信息 */
export interface AdverseFeedbackInput {
  symptoms?: string
  usageMethod?: string
  allergyHistory?: string
  packagePhoto?: string
  soughtMedicalCare?: boolean
  medicalNote?: string
}

function load(): PersistShape | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as PersistShape
    if (!Array.isArray(data.items) || !Array.isArray(data.requests)) return null
    if (!Array.isArray(data.frozenBatches) || !Array.isArray(data.notifications) || !Array.isArray(data.riskWarnings)) return null
    return data
  } catch {
    return null
  }
}

export const useMedkitStore = defineStore('medkit', () => {
  const persisted = load()
  const seed = persisted ?? { ...freshState(BASE_NOW), nowIso: BASE_NOW, currentUserId: 'u_b' }

  const nowIso = ref<string>(persisted?.nowIso ?? BASE_NOW)
  const currentUserId = ref<string>(persisted?.currentUserId ?? 'u_b')
  const items = ref<Item[]>(seed.items)
  const requests = ref<BorrowRequest[]>(seed.requests)
  const feedbacks = ref<Feedback[]>(seed.feedbacks)
  const frozenBatches = ref<FrozenBatch[]>(seed.frozenBatches)
  const riskWarnings = ref<CategoryRiskWarning[]>(seed.riskWarnings)
  const notifications = ref<AppNotification[]>(seed.notifications)
  const timeline = ref<TimelineEvent[]>(seed.timeline)

  function persist() {
    const data: PersistShape = {
      nowIso: nowIso.value,
      currentUserId: currentUserId.value,
      items: items.value,
      requests: requests.value,
      feedbacks: feedbacks.value,
      frozenBatches: frozenBatches.value,
      riskWarnings: riskWarnings.value,
      notifications: notifications.value,
      timeline: timeline.value,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  function addEvent(e: Omit<TimelineEvent, 'id'>) {
    timeline.value.push({ ...e, id: uid('ev') })
  }

  function pushNotification(n: Omit<AppNotification, 'id' | 'at' | 'read'> & { at?: string }) {
    notifications.value.unshift({ ...n, id: uid('n'), at: n.at ?? nowIso.value, read: false })
  }

  // ---- 时钟与会话 ----
  function advanceHours(hours: number) {
    nowIso.value = addHours(nowIso.value, hours)
    persist()
  }
  function resetDemo() {
    const f = freshState(BASE_NOW)
    items.value = f.items
    requests.value = f.requests
    feedbacks.value = f.feedbacks
    frozenBatches.value = f.frozenBatches
    riskWarnings.value = f.riskWarnings
    notifications.value = f.notifications
    timeline.value = f.timeline
    nowIso.value = BASE_NOW
    currentUserId.value = 'u_b'
    persist()
  }
  function switchUser(id: string) {
    currentUserId.value = id
    persist()
  }

  const users = DEMO_USERS
  const currentUser = computed(() => DEMO_USERS.find((u) => u.id === currentUserId.value) ?? DEMO_USERS[0])
  const isVolunteer = computed(() => currentUser.value.role === 'volunteer' || currentUser.value.role === 'staff')
  const isStaff = computed(() => currentUser.value.role === 'staff')

  // ---- 库存与状态派生 ----
  const itemsById = computed(() => new Map(items.value.map((i) => [i.id, i])))

  function lockedList(itemId: string): BorrowRequest[] {
    return requests.value.filter((r) => r.itemId === itemId && STOCK_LOCKING_STATUSES.includes(r.status))
  }
  function lockedQty(itemId: string): number {
    return lockedList(itemId).reduce((s, r) => s + r.quantity, 0)
  }
  function availableQty(itemId: string): number {
    const it = itemsById.value.get(itemId)
    if (!it) return 0
    return Math.max(0, it.quantity - lockedQty(itemId))
  }
  function waitingList(itemId: string): BorrowRequest[] {
    return requests.value
      .filter((r) => r.itemId === itemId && r.status === 'waiting')
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  }

  /** 根据库存占用重算 可借/部分外借/借完 三态（其他状态不动） */
  function refreshItemStatus(itemId: string) {
    const it = itemsById.value.get(itemId)
    if (!it) return
    if (it.status !== 'published' && it.status !== 'partially_lent' && it.status !== 'lent_out') return
    const locked = lockedQty(itemId)
    if (locked <= 0) it.status = 'published'
    else if (locked < it.quantity) it.status = 'partially_lent'
    else it.status = 'lent_out'
  }

  function requireItem(itemId: string): Item {
    const it = itemsById.value.get(itemId)
    if (!it) throw new ActionError('物品不存在或已被删除。')
    return it
  }

  // ---- 批次冻结派生 ----
  const activeFrozenBatches = computed(() => frozenBatches.value.filter((b) => b.status === 'frozen'))

  function frozenBatchForCategory(category: Item['category']): FrozenBatch | undefined {
    return activeFrozenBatches.value.find((b) => b.category === category)
  }
  function isCategoryFrozen(category: Item['category']): boolean {
    return !!frozenBatchForCategory(category)
  }

  /** 冻结期间可安全替代的其他品类在架物品（排除在核查品类、过期、无余量） */
  function safeAlternatives(category: Item['category']) {
    const altCats = CATEGORY_ALTERNATIVES[category] ?? []
    return items.value
      .filter((i) => altCats.includes(i.category))
      .filter((i) => isActiveItem(i))
      .filter((i) => !isCategoryFrozen(i.category))
      .filter((i) => daysUntil(i.expiryDate, nowIso.value) >= 0)
      .filter((i) => availableQty(i.id) > 0)
  }

  function alternativeAdvice(category: Item['category']): string | undefined {
    return ALTERNATIVE_ADVICE[category]
  }

  function categoryWarning(category: Item['category']): CategoryRiskWarning | undefined {
    return riskWarnings.value
      .filter((w) => w.category === category)
      .sort((a, b) => (a.at < b.at ? 1 : -1))[0]
  }

  // ---- 居民：登记 ----
  function register(draft: ItemDraft): ActionResult {
    const { errors, warnings } = validateDraft(draft, nowIso.value)
    if (errors.length) return { ok: false, message: errors.join(' ') }

    const it: Item = reactive({
      ...draft,
      id: uid('i'),
      ownerId: currentUserId.value,
      ownerName: currentUser.value.name,
      status: 'pending_review',
      createdAt: nowIso.value,
    })
    items.value.unshift(it)
    addEvent({
      itemId: it.id,
      at: nowIso.value,
      actorId: currentUserId.value,
      actorName: currentUser.value.name,
      kind: 'registered',
      detail: `登记「${it.name} ${it.spec}」×${it.quantity}${it.batchNo ? `，批号 ${it.batchNo}` : ''}`,
    })
    persist()
    return { ok: true, message: warnings.length ? warnings.join(' ') : '登记成功，等待志愿者审核后发布。' }
  }

  // ---- 志愿者：审核 ----
  function reviewItem(itemId: string, approved: boolean, reason?: string): ActionResult {
    if (!isVolunteer.value) return { ok: false, message: '只有志愿者可以审核物品。' }
    const it = requireItem(itemId)
    if (it.status !== 'pending_review') return { ok: false, message: '该物品不在待审核状态。' }

    if (approved) {
      if (daysUntil(it.expiryDate, nowIso.value) < 0) return { ok: false, message: '物品已过期，不能发布，应驳回并引导报废。' }
      it.review = { reviewerId: currentUserId.value, reviewerName: currentUser.value.name, at: nowIso.value, approved: true, reason }
      if (it.category === 'other_consumable') {
        it.review.reason = `志愿者初审通过，待社区工作人员复核${reason ? `：${reason}` : ''}`
        addEvent({ itemId, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'reviewed', detail: '志愿者初审通过，待工作人员复核' })
        persist()
        return { ok: true, message: '初审通过，已转社区工作人员复核。' }
      }
      it.status = 'published'
      it.publishedAt = nowIso.value
      addEvent({ itemId, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'reviewed', detail: `审核通过${reason ? `：${reason}` : ''}` })
      addEvent({ itemId, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'published', detail: '发布到邻里药箱大厅' })
    } else {
      it.status = 'rejected'
      it.review = { reviewerId: currentUserId.value, reviewerName: currentUser.value.name, at: nowIso.value, approved: false, reason: reason || '不符合共享范围' }
      it.closeReason = reason
      addEvent({ itemId, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'reviewed', detail: `审核驳回：${reason || '不符合共享范围（处方药/拆封/冷链/过期等）'}` })
    }
    persist()
    return { ok: true, message: approved ? '已审核通过并发布。' : '已驳回，居民可在“我的共享”看到原因。' }
  }

  /** 工作人员复核“其他非处方耗材” */
  function secondReview(itemId: string, approved: boolean, reason?: string): ActionResult {
    if (!isStaff.value) return { ok: false, message: '需要社区工作人员复核。' }
    const it = requireItem(itemId)
    if (it.status !== 'pending_review' || it.category !== 'other_consumable' || !it.review?.approved) {
      return { ok: false, message: '该物品不需要复核或状态不正确。' }
    }
    if (!approved) {
      it.status = 'rejected'
      it.closeReason = reason
      addEvent({ itemId, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'reviewed', detail: `工作人员复核驳回：${reason ?? '不予共享'}` })
      persist()
      return { ok: true, message: '已复核驳回。' }
    }
    it.status = 'published'
    it.publishedAt = nowIso.value
    addEvent({ itemId, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'published', detail: '工作人员复核通过，发布到大厅' })
    persist()
    return { ok: true, message: '复核通过，已发布。' }
  }

  // ---- 居民：申请借用 ----
  function apply(itemId: string, quantity: number, scene: Scene, method: HandoverMethod, note?: string): ActionResult {
    const it = requireItem(itemId)
    if (!['published', 'partially_lent', 'lent_out'].includes(it.status)) return { ok: false, message: '该物品当前不可申请。' }
    const frozen = frozenBatchForCategory(it.category)
    if (frozen) {
      return {
        ok: false,
        message: `「${CATEGORY_LABELS[it.category]}」有批次（${frozen.label}）正在社区核查中，本品类暂时全部暂停借用，避免风险物品继续扩散；请改用下方安全替代物或就医渠道。`,
      }
    }
    if (daysUntil(it.expiryDate, nowIso.value) < 0) {
      return { ok: false, message: '该物品已过期（超过有效期），不能借用，已提示工作人员报废。' }
    }
    if (quantity <= 0) return { ok: false, message: '借用数量需大于 0。' }
    const avail = availableQty(itemId)
    if (quantity > it.quantity) return { ok: false, message: '申请数量超过登记总量。' }

    const req: BorrowRequest = reactive({
      id: uid('r'),
      itemId,
      applicantId: currentUserId.value,
      applicantName: currentUser.value.name,
      scene,
      quantity,
      method,
      note,
      status: 'waiting',
      createdAt: nowIso.value,
    })
    requests.value.unshift(req)
    const ahead = waitingList(itemId).length - 1
    addEvent({
      itemId,
      requestId: req.id,
      at: nowIso.value,
      actorId: currentUserId.value,
      actorName: currentUser.value.name,
      kind: 'waitlisted',
      detail: `提交借用申请「${it.name}」×${quantity}；当前余量 ${avail}，排队候补${ahead ? `，前面还有 ${ahead} 人` : ''}，需共享人/志愿者确认后锁定`,
    })
    persist()
    return {
      ok: true,
      message:
        avail >= quantity
          ? '申请已提交，等待共享人或志愿者确认（先确认者先得）。'
          : `当前余量仅 ${avail}，已进入候补；他人取消或归还后会按顺序递补。`,
    }
  }

  /** 确认申请并锁定库存（余量不足则保持候补） */
  function confirmRequest(requestId: string): ActionResult {
    const r = requests.value.find((x) => x.id === requestId)
    if (!r) return { ok: false, message: '申请不存在。' }
    if (r.status !== 'waiting') return { ok: false, message: '该申请不在候补中。' }
    const it = requireItem(r.itemId)
    if (it.status === 'recalled' || it.status === 'scrapped' || it.status === 'rejected') {
      return { ok: false, message: '物品已不可借，不能确认。' }
    }
    if (it.status === 'quarantined') {
      return { ok: false, message: '物品已被风险隔离/同批次冻结，不能确认；同品类新申请已暂停，请引导申请人改用安全替代物。' }
    }
    if (availableQty(r.itemId) < r.quantity) {
      return { ok: false, message: '余量不足，保持候补；可联系申请人协商数量，或等待归还/补充。' }
    }
    r.status = 'confirmed'
    r.confirmedAt = nowIso.value
    r.confirmerId = currentUserId.value
    r.confirmerName = currentUser.value.name
    if (r.method === 'volunteer_delivery' && currentUser.value.role === 'volunteer') {
      r.volunteerId = currentUserId.value
      r.volunteerName = currentUser.value.name
    }
    refreshItemStatus(r.itemId)
    addEvent({ itemId: r.itemId, requestId: r.id, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'confirmed', detail: `确认申请并锁定库存 ×${r.quantity}，${PICKUP_WINDOW_HOURS}小时内需完成交接` })
    persist()
    return { ok: true, message: '已确认并锁定库存，请尽快安排交接。' }
  }

  // ---- 交接 ----
  function startHandover(requestId: string): ActionResult {
    const r = requests.value.find((x) => x.id === requestId)
    if (!r) return { ok: false, message: '申请不存在。' }
    if (r.status !== 'confirmed') return { ok: false, message: '需先确认申请才能开始交接。' }
    const it = requireItem(r.itemId)
    if (it.status === 'quarantined') return { ok: false, message: '物品已被风险隔离/同批次冻结，暂停交接。' }
    // 注意：仅同批次（已隔离）物品拦截交接；同品类其他批号已确认/交接中的借用沿用“在途继续履行”原则
    r.status = 'handing'
    r.handingAt = nowIso.value
    if (r.method === 'volunteer_delivery' && !r.volunteerId && isVolunteer.value) {
      r.volunteerId = currentUserId.value
      r.volunteerName = currentUser.value.name
    }
    const detail =
      r.method === 'volunteer_delivery' ? '志愿者出发代送' : r.method === 'door_contactless' ? '已放到约定门口位置（无接触）' : '物品已放到约定取件点，等待自取'
    addEvent({ itemId: r.itemId, requestId: r.id, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'handover_started', detail })
    persist()
    return { ok: true, message: detail }
  }

  function completeHandover(requestId: string, photo: string, note?: string): ActionResult {
    const r = requests.value.find((x) => x.id === requestId)
    if (!r) return { ok: false, message: '申请不存在。' }
    if (r.status !== 'handing') return { ok: false, message: '交接尚未开始。' }
    if (!photo.trim()) return { ok: false, message: '请先拍照上传交接凭证再确认。' }
    const it = requireItem(r.itemId)
    if (it.status === 'quarantined') return { ok: false, message: '物品已被风险隔离，不能完成交接。' }
    r.status = 'completed'
    r.completedAt = nowIso.value
    r.handoverPhoto = photo
    r.handoverNote = note
    addEvent({ itemId: r.itemId, requestId: r.id, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'handover_confirmed', detail: `交接拍照确认：${note ?? '包装外观完好'}` })
    persist()
    return { ok: true, message: '交接完成。请按约定归还或补充。' }
  }

  /** 志愿者报备配送延误 */
  function reportDelay(requestId: string, reason: string): ActionResult {
    const r = requests.value.find((x) => x.id === requestId)
    if (!r) return { ok: false, message: '申请不存在。' }
    if (r.status !== 'handing' || r.method !== 'volunteer_delivery') return { ok: false, message: '仅配送中的申请可以报备延误。' }
    r.delayReason = reason || '志愿者临时有事，正在协调改派'
    addEvent({ itemId: r.itemId, requestId: r.id, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'delay_flagged', detail: `配送延误：${r.delayReason}` })
    persist()
    return { ok: true, message: '延误已报备，借用人与工作人员会看到提醒，可改派其他志愿者。' }
  }

  function reassignVolunteer(requestId: string, volunteerId: string): ActionResult {
    const r = requests.value.find((x) => x.id === requestId)
    if (!r) return { ok: false, message: '申请不存在。' }
    if (r.status !== 'handing' || r.method !== 'volunteer_delivery') return { ok: false, message: '仅配送中的申请可以改派。' }
    const v = DEMO_USERS.find((u) => u.id === volunteerId && (u.role === 'volunteer' || u.role === 'staff'))
    if (!v) return { ok: false, message: '未找到可改派的志愿者。' }
    const old = r.volunteerName ?? '原志愿者'
    r.volunteerId = v.id
    r.volunteerName = v.name
    r.delayReason = undefined
    addEvent({ itemId: r.itemId, requestId: r.id, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'handover_started', detail: `配送改派：${old} → ${v.name}` })
    persist()
    return { ok: true, message: `已改派给 ${v.name}。` }
  }

  // ---- 取消 / 超时未取 ----
  function cancelRequest(requestId: string, reason: string, opts: { bySystem?: boolean } = {}): ActionResult {
    const r = requests.value.find((x) => x.id === requestId)
    if (!r) return { ok: false, message: '申请不存在。' }
    if (!['waiting', 'confirmed', 'handing'].includes(r.status)) return { ok: false, message: '该申请已结束，不能取消。' }
    const actor = opts.bySystem ? '系统' : currentUser.value.name
    r.status = 'cancelled'
    r.closedAt = nowIso.value
    r.cancelReason = reason
    refreshItemStatus(r.itemId)
    addEvent({ itemId: r.itemId, requestId: r.id, at: nowIso.value, actorId: opts.bySystem ? 'system' : currentUserId.value, actorName: actor, kind: 'cancelled', detail: `申请取消，库存释放：${reason}` })
    persist()
    const next = waitingList(r.itemId)[0]
    return { ok: true, message: next ? `库存已释放，候补队列首位「${next.applicantName}」可确认递补。` : '申请已取消，库存已释放。' }
  }

  // ---- 闭环：归还 / 补充 / 赠予 ----
  function closeBorrow(requestId: string, mode: BorrowRequest['closeMode'], note?: string): ActionResult {
    const r = requests.value.find((x) => x.id === requestId)
    if (!r) return { ok: false, message: '申请不存在。' }
    if (r.status !== 'completed') return { ok: false, message: '仅已取走的借用可以登记归还/补充。' }
    const it = requireItem(r.itemId)
    r.status = 'closed_returned'
    r.closedAt = nowIso.value
    r.closeMode = mode
    r.closeNote = note

    if (mode === 'restock_new') {
      it.quantity += r.quantity
    } else if (mode === 'mutual_aid') {
      it.quantity = Math.max(0, it.quantity - r.quantity)
    }
    // return_sealed：数量不变，申请离开锁定集合，余量自然恢复
    refreshItemStatus(r.itemId)
    addEvent({
      itemId: r.itemId,
      requestId: r.id,
      at: nowIso.value,
      actorId: currentUserId.value,
      actorName: currentUser.value.name,
      kind: mode === 'restock_new' ? 'restocked' : 'returned',
      detail:
        mode === 'restock_new'
          ? `已补充同规格新品 ×${r.quantity}${note ? `：${note}` : ''}`
          : mode === 'mutual_aid'
            ? `邻里赠予，无需归还（库存核销 ×${r.quantity}）`
            : `已归还原物（未拆封）×${r.quantity}${note ? `：${note}` : ''}`,
    })
    persist()
    const next = waitingList(r.itemId)[0]
    return { ok: true, message: next ? `本次借用已闭环，候补首位「${next.applicantName}」可递补。` : '本次借用已闭环，感谢你的守信与互助。' }
  }

  // ---- 共享人撤回 ----
  function recallItem(itemId: string, reason: string): ActionResult {
    const it = requireItem(itemId)
    if (it.ownerId !== currentUserId.value && !isStaff.value) return { ok: false, message: '只有共享人本人可以撤回。' }
    if (it.status === 'scrapped' || it.status === 'recalled') return { ok: false, message: '物品已结束流转。' }
    it.status = 'recalled'
    it.closeReason = reason
    // 已确认/交接中的借用继续履行；候补中申请全部取消
    const waiting = requests.value.filter((r) => r.itemId === itemId && r.status === 'waiting')
    for (const r of waiting) {
      r.status = 'cancelled'
      r.closedAt = nowIso.value
      r.cancelReason = '共享人撤回物品，候补自动取消'
      addEvent({ itemId, requestId: r.id, at: nowIso.value, actorId: 'system', actorName: '系统', kind: 'cancelled', detail: '共享人撤回，候补申请取消' })
    }
    const inflight = requests.value.filter((r) => r.itemId === itemId && ['confirmed', 'handing', 'completed'].includes(r.status)).length
    addEvent({ itemId, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'recalled', detail: `共享人撤回：${reason}${inflight ? `；${inflight} 笔进行中的借用继续完成` : ''}` })
    persist()
    return { ok: true, message: inflight ? `已撤回，不再接受新申请；${inflight} 笔进行中的借用将继续完成交接与归还。` : '物品已撤回，候补申请已通知取消。' }
  }

  // ---- 反馈：包装破损 / 疑似不适（不适反馈立即冻结同批次） ----
  function reportFeedback(itemId: string, type: FeedbackType, detail: string, requestId?: string, extra?: AdverseFeedbackInput): ActionResult {
    const it = requireItem(itemId)
    if (!detail.trim()) return { ok: false, message: '请填写具体情况描述。' }

    const adverse = type === 'adverse_reaction'
    const key = adverse && it.batchNo?.trim() ? batchKey(it.category, it.batchNo) : undefined

    const fb: Feedback = reactive({
      id: uid('f'),
      itemId,
      requestId,
      reporterId: currentUserId.value,
      reporterName: currentUser.value.name,
      type,
      detail,
      createdAt: nowIso.value,
      status: 'open',
      ...(adverse
        ? {
            symptoms: extra?.symptoms,
            usageMethod: extra?.usageMethod,
            allergyHistory: extra?.allergyHistory,
            packagePhoto: extra?.packagePhoto,
            soughtMedicalCare: extra?.soughtMedicalCare,
            medicalNote: extra?.medicalNote,
            batchKey: key,
            batchLabel: adverse ? batchLabel(it.category, it.batchNo) : undefined,
          }
        : {}),
    })
    feedbacks.value.unshift(fb)
    addEvent({ itemId, requestId, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'feedback', detail: `${type === 'package_damaged' ? '包装破损反馈' : adverse ? '疑似使用后不适反馈' : '反馈'}：${detail}` })

    // 安全优先：包装破损 → 单件隔离；疑似不适 → 同批次立即冻结
    if (type === 'package_damaged') {
      quarantineSingle(it, '收到包装破损反馈，已隔离待核查', '包装破损：物品已隔离，待工作人员核查')
    } else if (adverse) {
      const existingFrozen = key ? frozenBatches.value.find((b) => b.key === key && b.status === 'frozen') : undefined
      if (existingFrozen) {
        // 批次已冻结核查中：补记反馈，不重复冻结/通知
        addEvent({ itemId: it.id, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'feedback', detail: `同批次已在冻结核查中，补充反馈：${detail}` })
        persist()
        return { ok: true, message: '该批次已在冻结核查中，补充信息已记录，社区工作人员会合并核查。' }
      }
      if (key) freezeSameBatch(fb, it, key)
      else quarantineSingle(it, '收到疑似不适反应反馈，已隔离待核查（该物品未标注批号，无法自动定位同批次）', '疑似不适反应：物品已隔离，建议反馈人就医并保留包装')
    }
    persist()
    return {
      ok: true,
      message: adverse
        ? '已记录并立即冻结同批次剩余物品，已通知共享人、社区工作人员与已借用居民。如不适持续或加重，请立即就医；社区仅做物品流转与风险提醒，不提供诊断。'
        : '已记录反馈，物品已隔离，待社区工作人员核查处理。',
    }
  }

  /** 单件隔离（包装破损 / 无批号物品的不适反馈） */
  function quarantineSingle(it: Item, closeReason: string, timelineDetail: string) {
    if (['scrapped', 'recalled', 'rejected'].includes(it.status)) return
    it.status = 'quarantined'
    it.closeReason = closeReason
    cancelInflightForFreeze([it.id], '物品收到风险反馈被隔离，暂停交接')
    addEvent({ itemId: it.id, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'quarantined', detail: timelineDetail })
  }

  /** 同批次冻结：找到同品类同批号的全部物品，立即停止借用与交接并通知相关方 */
  function freezeSameBatch(fb: Feedback, source: Item, key: string) {
    const targets = items.value.filter(
      (i) => i.category === source.category && (i.batchNo ?? '').trim() === (source.batchNo ?? '').trim() && !['scrapped', 'recalled', 'rejected'].includes(i.status),
    )
    const targetIds: string[] = []
    for (const t of targets) {
      targetIds.push(t.id)
      if (t.status !== 'quarantined' || !t.frozenBatchKey) {
        t.status = 'quarantined'
        t.frozenBatchKey = key
        t.closeReason = `同批次（批号 ${source.batchNo}）收到借用人使用后不适反馈，剩余物品已冻结，待社区核查`
      }
    }

    cancelInflightForFreeze(targetIds, '同批次收到疑似使用后不适反馈被冻结，暂停交接')

    // 同品类其他批号物品：物理上不隔离，但核查期暂停新流转，其候补申请一并取消（已确认/交接中的继续履行）
    const sameCategoryOther = items.value.filter((i) => i.category === source.category && !targetIds.includes(i.id) && !['scrapped', 'recalled', 'rejected'].includes(i.status))
    for (const i of sameCategoryOther) {
      for (const r of requests.value.filter((x) => x.itemId === i.id && x.status === 'waiting')) {
        r.status = 'cancelled'
        r.closedAt = nowIso.value
        r.cancelReason = `同品类（${CATEGORY_LABELS[source.category]}）有批次正在核查，暂停新借用，候补申请取消`
        addEvent({ itemId: i.id, requestId: r.id, at: nowIso.value, actorId: 'system', actorName: '系统', kind: 'cancelled', detail: '同品类批次核查中，候补申请取消，已推荐安全替代物' })
      }
    }

    const label = batchLabel(source.category, source.batchNo)
    const reason = `借用人${source.ownerId === fb.reporterId ? '' : `「${fb.reporterName}」`}使用${CATEGORY_LABELS[source.category]}后反馈不适（${fb.symptoms?.split('；')[0] ?? '皮肤红肿'}）${fb.soughtMedicalCare ? '，反馈人已就医' : ''}`
    const batch: FrozenBatch = reactive({
      key,
      category: source.category,
      batchNo: source.batchNo?.trim(),
      label,
      sourceFeedbackId: fb.id,
      sourceItemId: source.id,
      reason,
      frozenAt: nowIso.value,
      status: 'frozen',
      itemIds: targetIds,
    })
    frozenBatches.value.unshift(batch)

    for (const id of targetIds) {
      addEvent({ itemId: id, at: nowIso.value, actorId: 'system', actorName: '系统', kind: 'batch_frozen', detail: `同批次立即冻结：${label}；${reason}` })
    }

    notifyBatchFrozen(batch, targets)
  }

  /** 取消冻结物品上等待/确认/交接中的申请（已取走的保留，以便安全回访） */
  function cancelInflightForFreeze(itemIds: string[], reason: string) {
    for (const r of requests.value.filter((x) => itemIds.includes(x.itemId) && ['waiting', 'confirmed', 'handing'].includes(x.status))) {
      const label: RequestStatus = r.status
      r.status = 'cancelled'
      r.closedAt = nowIso.value
      r.cancelReason = reason
      addEvent({ itemId: r.itemId, requestId: r.id, at: nowIso.value, actorId: 'system', actorName: '系统', kind: 'cancelled', detail: `同批次冻结，${label === 'waiting' ? '候补' : '交接中'}申请取消` })
    }
  }

  /** 冻结后立即通知：共享人、社区工作人员、已借用居民、被取消申请的居民 */
  function notifyBatchFrozen(batch: FrozenBatch, targets: Item[]) {
    // 共享人（去重）
    const owners = [...new Set(targets.map((t) => t.ownerId))]
    for (const ownerId of owners) {
      const mine = targets.filter((t) => t.ownerId === ownerId)
      pushNotification({
        kind: 'batch_frozen',
        title: `你共享的${CATEGORY_LABELS[batch.category]}同批次已冻结`,
        body: `批号 ${batch.batchNo ?? '未标注'} 收到使用后不适反馈。你共享的 ${mine.map((m) => m.name).join('、')} 剩余库存已立即冻结，暂停借用与交接，待社区核查后通知结论，请先不要自行处置或外借。`,
        userId: ownerId,
        itemIds: mine.map((m) => m.id),
      })
    }

    // 社区工作人员（角色广播，演示环境直接派给工作人员账号）
    pushNotification({
      kind: 'batch_frozen',
      title: `${CATEGORY_LABELS[batch.category]}同批次风险待核查`,
      body: `${batch.label} 已全部冻结（${targets.length} 件）：${batch.reason}。请登记反馈人过敏史、包装照片与使用方式，回访就医情况，并判定是个体过敏还是物品问题后决定下架、恢复或加入风险提醒。`,
      userId: 'u_s',
      roleTargets: ['staff'],
      itemIds: batch.itemIds,
    })

    // 已借用居民（含已取走/已闭环，去重；不含反馈人本人）
    const borrowerIds = [...new Set(requests.value.filter((r) => batch.itemIds.includes(r.itemId) && BORROWER_NOTIFY_STATUSES.includes(r.status)).map((r) => r.applicantId))]
    for (const uid2 of borrowerIds) {
      pushNotification({
        kind: 'batch_frozen',
        title: `你借用过的${CATEGORY_LABELS[batch.category]}同批次已暂停共享`,
        body: `你此前借走的 ${batch.label} 已暂停共享。如仍有未使用的物品请暂停使用并保留包装；若出现皮肤红肿、瘙痒加重或呼吸不畅，请立即就医。`,
        userId: uid2,
        itemIds: batch.itemIds,
      })
    }

    // 候补/交接被自动取消的居民（同批次在途 + 同品类其他批号候补）
    const cancelled = requests.value.filter(
      (r) => r.status === 'cancelled' && r.closedAt === nowIso.value && itemsById.value.get(r.itemId)?.category === batch.category,
    )
    for (const r of [...new Map(cancelled.map((r) => [r.applicantId, r])).values()]) {
      pushNotification({
        kind: 'request_cancelled',
        title: `你的${CATEGORY_LABELS[batch.category]}申请已取消`,
        body: `因 ${batch.label} 收到疑似使用后不适反馈并冻结，你的申请已自动取消。页面已推荐安全替代物与就医渠道，避免风险物品继续扩散。`,
        userId: r.applicantId,
        itemIds: batch.itemIds,
      })
    }
  }

  // ---- 工作人员核查处置 ----
  /**
   * 处置不适反馈：
   * - product_issue + delist_batch：判定物品（批次）问题 → 同批次下架报废
   * - individual_allergy + restore：判定个体过敏、物品无问题 → 恢复共享
   * - individual_allergy + risk_warning：个体过敏 → 恢复并对该品类加长期风险提醒
   * - inconclusive + continue_freeze：证据不足 → 维持冻结继续核查
   */
  function investigateFeedback(feedbackId: string, conclusion: InvestigationConclusion, action: RiskAction, note: string): ActionResult {
    if (!isStaff.value) return { ok: false, message: '只有社区工作人员可以核查处置风险反馈。' }
    const fb = feedbacks.value.find((f) => f.id === feedbackId)
    if (!fb) return { ok: false, message: '反馈不存在。' }
    if (fb.type !== 'adverse_reaction') return { ok: false, message: '该核查流程仅适用于疑似使用后不适反馈；包装破损请使用报废/恢复处置。' }
    if (!note.trim()) return { ok: false, message: '请填写核查说明（回访情况、判定依据）。' }
    if (action === 'continue_freeze' && fb.status !== 'open') return { ok: false, message: '反馈已处置，无需继续冻结。' }

    const it = requireItem(fb.itemId)
    const batch = fb.batchKey ? frozenBatches.value.find((b) => b.key === fb.batchKey) : undefined
    const targetIds = batch
      ? items.value.filter((i) => i.frozenBatchKey === batch.key).map((i) => i.id)
      : it.status === 'quarantined'
        ? [it.id]
        : []

    const investigation = {
      at: nowIso.value,
      staffId: currentUserId.value,
      staffName: currentUser.value.name,
      conclusion,
      action,
      note,
    }
    fb.investigation = investigation
    fb.handledAt = nowIso.value
    fb.handlerId = currentUserId.value
    fb.handlerName = currentUser.value.name
    fb.handleNote = note

    if (action === 'continue_freeze') {
      // 证据不足：保留核查记录但不结单，批次维持冻结
      addEvent({ itemId: it.id, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'feedback', detail: `工作人员补充核查：${note}；证据不足，维持冻结继续核查` })
      persist()
      return { ok: true, message: '已记录，同批次维持冻结，继续联系反馈人/供货渠道补充证据。' }
    }

    if (action === 'delist_batch') {
      fb.status = 'resolved_scrap'
      for (const id of targetIds) {
        const t = itemsById.value.get(id)!
        t.status = 'scrapped'
        t.closeReason = `核查判定为物品（批次）问题，同批次下架报废：${note}`
        t.frozenBatchKey = undefined
        for (const r of requests.value.filter((x) => x.itemId === id && ['waiting', 'confirmed', 'handing'].includes(x.status))) {
          r.status = 'cancelled'
          r.closedAt = nowIso.value
          r.cancelReason = '同批次核查判定物品问题并下架，申请取消'
        }
        addEvent({ itemId: id, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'batch_delisted', detail: `同批次核查后下架：${batch?.label ?? CATEGORY_LABELS[t.category]}；${note}` })
        addEvent({ itemId: id, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'scrapped', detail: `物品问题，同批次报废：${note}` })
      }
      if (batch) {
        batch.status = 'delisted'
        batch.resolvedAt = nowIso.value
        batch.actionNote = note
      }
      notifyBatchResolved(batch ?? fb, 'delisted', targetIds, note)
    } else {
      // 恢复（可选叠加品类风险提醒）
      const withWarning = action === 'risk_warning'
      fb.status = withWarning ? 'resolved_warning' : 'resolved_republish'
      for (const id of targetIds) {
        const t = itemsById.value.get(id)!
        t.status = 'published'
        t.closeReason = undefined
        t.frozenBatchKey = undefined
        if (withWarning) {
          t.riskNote = `本品类有个体过敏核查记录：${CATEGORY_LABELS[t.category]}可能引起局部皮肤过敏，借用后如有红肿瘙痒请立即停用并就医。`
        }
        refreshItemStatus(id)
        addEvent({ itemId: id, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'batch_restored', detail: `核查${withWarning ? '判定个体过敏，恢复共享并加入风险提醒' : '判定物品无问题，解除冻结恢复共享'}：${note}` })
      }
      if (batch) {
        batch.status = withWarning ? 'warning' : 'restored'
        batch.resolvedAt = nowIso.value
        batch.actionNote = note
      }
      if (withWarning) {
        const warning: CategoryRiskWarning = reactive({
          category: fb.batchKey ? batch!.category : it.category,
          note: `${CATEGORY_LABELS[it.category]}存在个体过敏案例（接触部位红肿），过敏体质者慎用；使用后出现红肿、瘙痒请立即停用、清水冲洗并就医。`,
          at: nowIso.value,
          staffId: currentUserId.value,
          staffName: currentUser.value.name,
          sourceFeedbackId: fb.id,
        })
        riskWarnings.value.unshift(warning)
        for (const id of items.value.filter((x) => x.category === warning.category).map((x) => x.id)) {
          addEvent({ itemId: id, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'risk_warning', detail: `品类风险提醒：${warning.note}` })
        }
      }
      notifyBatchResolved(batch ?? fb, withWarning ? 'warning' : 'restored', targetIds, note)
    }

    persist()
    return {
      ok: true,
      message:
        action === 'delist_batch'
          ? '已判定为物品问题：同批次全部下架报废，已通知共享人与已借用居民停止使用。'
          : action === 'risk_warning'
            ? '已判定为个体过敏：同批次恢复共享，并已对该品类加入长期风险提醒。'
            : '已判定物品无问题（个体/偶发反应）：同批次解除冻结，恢复共享。',
    }
  }

  function notifyBatchResolved(source: FrozenBatch | Feedback, outcome: 'delisted' | 'restored' | 'warning', targetIds: string[], note: string) {
    const category = 'category' in source ? source.category : itemsById.value.get(source.itemId)?.category
    if (!category) return
    const label = 'label' in source ? source.label : CATEGORY_LABELS[category]
    const titleMap = {
      delisted: `你共享的${CATEGORY_LABELS[category]}同批次已下架报废`,
      restored: `你共享的${CATEGORY_LABELS[category]}同批次已恢复共享`,
      warning: `你共享的${CATEGORY_LABELS[category]}已恢复并加挂风险提醒`,
    } as const
    const bodyMap = {
      delisted: `${label} 经社区核查判定为物品问题，已全部下架并按医疗/有害垃圾流程处理，请停止使用手中的同批次物品。`,
      restored: `${label} 经核查未发现物品问题，已解除冻结恢复共享。核查说明：${note}`,
      warning: `${label} 经核查判定为个体过敏，物品已恢复共享；页面已加挂“过敏体质者慎用”风险提醒。`,
    } as const

    const owners = [...new Set(targetIds.map((id) => itemsById.value.get(id)?.ownerId).filter((x): x is string => !!x))]
    for (const ownerId of owners) {
      pushNotification({ kind: 'batch_resolved', title: titleMap[outcome], body: bodyMap[outcome], userId: ownerId, itemIds: targetIds })
    }
    const borrowerIds = [...new Set(requests.value.filter((r) => targetIds.includes(r.itemId) && BORROWER_NOTIFY_STATUSES.includes(r.status)).map((r) => r.applicantId))]
    for (const borrowerId of borrowerIds) {
      pushNotification({
        kind: outcome === 'delisted' ? 'batch_frozen' : 'batch_resolved',
        title: outcome === 'delisted' ? `你借用过的${CATEGORY_LABELS[category]}同批次已下架` : `你借用过的${CATEGORY_LABELS[category]}核查结论通知`,
        body:
          outcome === 'delisted'
            ? `${label} 被判定为物品问题并下架，如你手中仍有该批次物品请停止使用并按社区通知方式交回。`
            : bodyMap[outcome],
        userId: borrowerId,
        itemIds: targetIds,
      })
    }
    if (outcome === 'warning') {
      pushNotification({
        kind: 'risk_warning',
        title: `${CATEGORY_LABELS[category]}已加入品类风险提醒`,
        body: bodyMap.warning,
        userId: 'u_s',
        roleTargets: ['staff'],
        itemIds: targetIds,
      })
    }
  }

  /** 工作人员处置包装破损/其他反馈：报废 或 核查后重新发布 */
  function resolveFeedback(feedbackId: string, action: 'scrap' | 'republish', note: string): ActionResult {
    if (!isStaff.value) return { ok: false, message: '只有社区工作人员可以处置风险反馈。' }
    const fb = feedbacks.value.find((f) => f.id === feedbackId)
    if (!fb || fb.status !== 'open') return { ok: false, message: '反馈不存在或已处置。' }
    if (fb.type === 'adverse_reaction') return { ok: false, message: '疑似不适反馈请使用“核查个体过敏/物品问题”流程处置。' }
    const it = requireItem(fb.itemId)
    fb.handledAt = nowIso.value
    fb.handlerId = currentUserId.value
    fb.handlerName = currentUser.value.name
    fb.handleNote = note

    if (action === 'scrap') {
      fb.status = 'resolved_scrap'
      it.status = 'scrapped'
      it.closeReason = `工作人员核查后报废：${note}`
      for (const r of requests.value.filter((x) => x.itemId === it.id && ['waiting', 'confirmed', 'handing'].includes(x.status))) {
        r.status = 'cancelled'
        r.closedAt = nowIso.value
        r.cancelReason = '物品报废，申请取消'
      }
      addEvent({ itemId: it.id, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'scrapped', detail: `核查报废：${note}` })
    } else {
      fb.status = 'resolved_republish'
      it.status = 'published'
      it.closeReason = undefined
      refreshItemStatus(it.id)
      addEvent({ itemId: it.id, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'published', detail: `核查后重新发布：${note}` })
    }
    persist()
    return { ok: true, message: action === 'scrap' ? '已报废并记录，按医疗/有害垃圾流程处理。' : '已解除隔离并重新发布。' }
  }

  /** 工作人员直接报废（过期物品清理等） */
  function scrapItem(itemId: string, reason: string): ActionResult {
    if (!isStaff.value) return { ok: false, message: '只有社区工作人员可以报废物品。' }
    const it = requireItem(itemId)
    if (it.status === 'scrapped') return { ok: false, message: '物品已报废。' }
    it.status = 'scrapped'
    it.closeReason = reason
    it.frozenBatchKey = undefined
    for (const r of requests.value.filter((x) => x.itemId === itemId && ['waiting', 'confirmed', 'handing'].includes(x.status))) {
      r.status = 'cancelled'
      r.closedAt = nowIso.value
      r.cancelReason = '物品报废，申请取消'
    }
    addEvent({ itemId, at: nowIso.value, actorId: currentUserId.value, actorName: currentUser.value.name, kind: 'scrapped', detail: reason })
    persist()
    return { ok: true, message: '已报废，相关进行中申请已取消。' }
  }

  // ---- 通知中心 ----
  const myNotifications = computed(() =>
    notifications.value
      .filter((n) => n.userId === currentUserId.value || (!n.userId && n.roleTargets?.includes(currentUser.value.role)))
      .sort((a, b) => (a.at < b.at ? 1 : -1)),
  )
  const unreadCount = computed(() => myNotifications.value.filter((n) => !n.read).length)

  function markNotificationRead(id: string) {
    const n = notifications.value.find((x) => x.id === id)
    if (n) n.read = true
    persist()
  }
  function markAllNotificationsRead() {
    for (const n of myNotifications.value) n.read = true
    persist()
  }

  // ---- 看板派生数据 ----
  const reviewQueue = computed(() => items.value.filter((i) => i.status === 'pending_review'))
  const openFeedbackList = computed(() =>
    feedbacks.value
      .filter((f) => f.status === 'open')
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
  )

  /** 已过期但仍挂在可借状态（大厅会禁借并提示，工作人员应尽快报废） */
  const expiredListed = computed(() =>
    items.value.filter((i) => ['published', 'partially_lent', 'lent_out', 'quarantined'].includes(i.status) && daysUntil(i.expiryDate, nowIso.value) < 0),
  )

  /** 效期临近（60天内）且仍在流转 */
  const expiringSoon = computed(() =>
    items.value
      .filter((i) => ['published', 'partially_lent', 'lent_out'].includes(i.status))
      .map((i) => ({ item: i, days: daysUntil(i.expiryDate, nowIso.value) }))
      .filter((x) => x.days >= 0 && x.days <= 60)
      .sort((a, b) => a.days - b.days),
  )

  interface OverduePickup {
    req: BorrowRequest
    hours: number
  }
  /** 超时未取：确认后超过时限仍未完成交接 */
  const overduePickups = computed<OverduePickup[]>(() =>
    requests.value
      .filter((r) => r.status === 'confirmed' || (r.status === 'handing' && r.method === 'self_pickup'))
      .map((r) => ({ req: r, hours: hoursSince(r.handingAt ?? r.confirmedAt ?? r.createdAt, nowIso.value) }))
      .filter((x) => x.hours > PICKUP_WINDOW_HOURS)
      .sort((a, b) => b.hours - a.hours),
  )

  interface DelayedDelivery {
    req: BorrowRequest
    hours: number
  }
  /** 志愿者配送延误：交接开始后超过 SLA 未完成 */
  const delayedDeliveries = computed<DelayedDelivery[]>(() =>
    requests.value
      .filter((r) => r.status === 'handing' && r.method === 'volunteer_delivery')
      .map((r) => ({ req: r, hours: hoursSince(r.handingAt ?? r.confirmedAt ?? r.createdAt, nowIso.value) }))
      .filter((x) => x.hours > DELIVERY_SLA_HOURS)
      .sort((a, b) => b.hours - a.hours),
  )

  const stats = computed(() => {
    const active = items.value.filter((i) => ['published', 'partially_lent', 'lent_out'].includes(i.status))
    return {
      activeCount: active.length,
      reviewCount: reviewQueue.value.length,
      inFlight: requests.value.filter((r) => ['confirmed', 'handing'].includes(r.status)).length,
      waiting: requests.value.filter((r) => r.status === 'waiting').length,
      completedOpen: requests.value.filter((r) => r.status === 'completed').length,
      openFeedback: openFeedbackList.value.length,
      expired: expiredListed.value.length,
      quarantined: items.value.filter((i) => i.status === 'quarantined').length,
      frozenBatches: activeFrozenBatches.value.length,
      scrapped: items.value.filter((i) => i.status === 'scrapped').length,
    }
  })

  function itemTimeline(itemId: string): TimelineEvent[] {
    return timeline.value.filter((e) => e.itemId === itemId).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  }
  function itemRequests(itemId: string): BorrowRequest[] {
    return requests.value.filter((r) => r.itemId === itemId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }

  return {
    // state
    nowIso,
    currentUserId,
    users,
    items,
    requests,
    feedbacks,
    frozenBatches,
    riskWarnings,
    notifications,
    timeline,
    // getters
    currentUser,
    isVolunteer,
    isStaff,
    reviewQueue,
    openFeedbackList,
    expiredListed,
    expiringSoon,
    overduePickups,
    delayedDeliveries,
    stats,
    activeFrozenBatches,
    myNotifications,
    unreadCount,
    // actions
    advanceHours,
    resetDemo,
    switchUser,
    availableQty,
    lockedQty,
    lockedList,
    waitingList,
    refreshItemStatus,
    frozenBatchForCategory,
    isCategoryFrozen,
    safeAlternatives,
    alternativeAdvice,
    categoryWarning,
    register,
    reviewItem,
    secondReview,
    apply,
    confirmRequest,
    startHandover,
    completeHandover,
    reportDelay,
    reassignVolunteer,
    cancelRequest,
    closeBorrow,
    recallItem,
    reportFeedback,
    investigateFeedback,
    resolveFeedback,
    scrapItem,
    markNotificationRead,
    markAllNotificationsRead,
    itemTimeline,
    itemRequests,
  }
})
