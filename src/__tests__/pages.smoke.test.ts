import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mount, flushPromises } from '@vue/test-utils'
import { useMedkitStore } from '@/stores/medkit'
import type { AdverseReportPayload } from '@/stores/medkit'
import ItemHallPage from '@/pages/ItemHallPage.vue'
import ItemDetailPage from '@/pages/ItemDetailPage.vue'
import StaffPage from '@/pages/StaffPage.vue'
import VolunteerPage from '@/pages/VolunteerPage.vue'
import NotificationBell from '@/components/NotificationBell.vue'
import FeedbackPanel from '@/components/FeedbackPanel.vue'
import InvestigationPanel from '@/components/InvestigationPanel.vue'
import type { Feedback } from '@/types'

function adverse(): AdverseReportPayload {
  return {
    detail: '擦拭碘伏棉片后伤口周围红肿发痒。',
    symptoms: ['redness_swelling', 'itch'],
    allergyHistory: '无药物过敏史',
    usageMethod: 'wipe_wound',
    usageDetail: '擦拭 2 次',
    packagePhotos: ['pkg-1.jpg（演示凭证）'],
    soughtMedicalCare: false,
    medicalNote: '',
  }
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/hall', component: { template: '<div>hall</div>' } },
      { path: '/items/:id', component: ItemDetailPage },
      { path: '/staff', component: StaffPage, meta: { roles: ['staff'] } },
      { path: '/volunteer', component: VolunteerPage, meta: { roles: ['volunteer', 'staff'] } },
    ],
  })
}

async function mountPage(component: unknown, store: ReturnType<typeof useMedkitStore>) {
  const router = makeRouter()
  const wrapper = mount(component as never, {
    global: {
      plugins: [router],
      provide: {},
    },
  })
  await router.push('/hall')
  await router.isReady()
  await flushPromises()
  return { wrapper, router, store }
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('大厅页面', () => {
  it('初始展示在架碘伏物品与安全横幅', async () => {
    const store = useMedkitStore()
    const { wrapper } = await mountPage(ItemHallPage, store)
    expect(wrapper.text()).toContain('按急用场景找物品')
    expect(wrapper.text()).toContain('碘伏棉片')
    // 过期物品 i12 不出现在大厅
    expect(wrapper.text()).not.toContain('库存遗留')
  })

  it('不适反馈后：同批次物品从大厅消失，出现核查警示与不同批次替代推荐', async () => {
    const store = useMedkitStore()
    store.switchUser('u_b')
    store.reportFeedback('i2', 'adverse_reaction', adverse().detail, 'r6', adverse())

    const { wrapper } = await mountPage(ItemHallPage, store)
    const text = wrapper.text()
    expect(text).toContain('批次正在核查')
    expect(text).toContain('IDP-2508A')
    // 同批次的棉片/棉签不再作为可借卡片出现
    expect(text).not.toContain('独立包装 20片/盒')
    // 不同批次替代物 i14 被推荐
    expect(text).toContain('碘伏消毒液（小瓶）')
    expect(text).toContain('IDP-2511C')
    // 就医渠道
    expect(text).toContain('120')
  })
})

describe('物品详情页', () => {
  async function mountDetail(id: string) {
    const store = useMedkitStore()
    const router = makeRouter()
    const wrapper = mount(ItemDetailPage, {
      global: { plugins: [router] },
    })
    await router.push(`/items/${id}`)
    await router.isReady()
    await flushPromises()
    return { wrapper, store }
  }

  it('展示批号、风险提醒徽章与反馈入口', async () => {
    const { wrapper } = await mountDetail('i4') // 创可贴品类已有历史风险提醒 rn1
    const text = wrapper.text()
    expect(text).toContain('BAN-260112')
    expect(text).toContain('品类风险提醒')
    expect(wrapper.findComponent(FeedbackPanel).exists()).toBe(true)
  })

  it('碘伏反馈后详情页显示冻结横幅与安全替代/就医渠道，不再可申请', async () => {
    const { wrapper, store } = await mountDetail('i2')
    store.switchUser('u_b')
    store.reportFeedback('i2', 'adverse_reaction', adverse().detail, 'r6', adverse())
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('已冻结')
    expect(text).toContain('安全替代与就医渠道')
    expect(text).toContain('碘伏消毒液（小瓶）')
    expect(text).not.toContain('我要申请借用')
  })
})

describe('工作人员核查面板', () => {
  it('展示结构化不适信息、冻结范围与三种核查结论', async () => {
    const store = useMedkitStore()
    store.switchUser('u_b')
    store.reportFeedback('i2', 'adverse_reaction', adverse().detail, 'r6', adverse())
    const fb: Feedback = store.feedbacks.find((f) => f.itemId === 'i2' && f.status === 'open')!

    const wrapper = mount(InvestigationPanel, {
      props: { feedback: fb },
      global: { plugins: [makeRouter()] },
    })
    const text = wrapper.text()
    expect(text).toContain('接触部位红肿')
    expect(text).toContain('无药物过敏史')
    expect(text).toContain('擦拭伤口')
    expect(text).toContain('尚未就医')
    expect(text).toContain('已立即冻结 2 件同批次物品')

    // 展开核查表单后，三种结论均可见
    await wrapper.find('button.btn-primary.btn-sm').trigger('click')
    await flushPromises()
    const formText = wrapper.text()
    expect(formText).toContain('个体过敏')
    expect(formText).toContain('物品问题')
    expect(formText).toContain('暂无法判定')
  })
})

describe('通知铃铛', () => {
  it('反馈后共享人铃铛出现未读数，面板展示冻结通知', async () => {
    const store = useMedkitStore()
    store.switchUser('u_b')
    store.reportFeedback('i2', 'adverse_reaction', adverse().detail, 'r6', adverse())
    store.switchUser('u_c') // 周敏是 i2 共享人

    const wrapper = mount(NotificationBell, {
      global: { plugins: [makeRouter()] },
    })
    expect(wrapper.text()).toMatch(/\d+/)
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('同批次已冻结')
  })
})

describe('路由角色守卫', () => {
  it('居民进不了工作人员/志愿者页面', async () => {
    const store = useMedkitStore()
    store.switchUser('u_b')
    const router = makeRouter()
    router.beforeEach((to) => {
      const roles = to.meta.roles as string[] | undefined
      if (!roles) return true
      return roles.includes(store.currentUser.role) ? true : '/hall'
    })
    await router.push('/staff')
    expect(router.currentRoute.value.path).toBe('/hall')
    await router.push('/volunteer')
    expect(router.currentRoute.value.path).toBe('/hall')

    store.switchUser('u_s')
    await router.push('/staff')
    expect(router.currentRoute.value.path).toBe('/staff')
  })
})
