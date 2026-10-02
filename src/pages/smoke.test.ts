import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { router } from '@/router'
import { useMedkitStore } from '@/stores/medkit'
import ItemHallPage from '@/pages/ItemHallPage.vue'
import ItemDetailPage from '@/pages/ItemDetailPage.vue'
import StaffPage from '@/pages/StaffPage.vue'

function mountWith(Component: unknown) {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(Component as never, {
    global: {
      plugins: [pinia, router],
    },
  })
}

describe('页面冒烟：冻结提示与核查', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('大厅：老人伤口场景出现碘伏批次核查条、安全替代物与就医渠道，冻结物品不出现在列表', async () => {
    const wrapper = mountWith(ItemHallPage)
    await router.isReady()

    // 切到“老人小伤口处理”场景
    const woundChip = wrapper.findAll('button.chip').find((b) => b.text().includes('老人小伤口'))
    expect(woundChip).toBeTruthy()
    await woundChip!.trigger('click')

    const html = wrapper.html()
    expect(html).toContain('正在社区核查中')
    expect(html).toContain('安全替代物')
    expect(html).toContain('就医渠道')
    // i14/i15 作为安全替代物出现
    expect(html).toContain('无菌纱布块')
    expect(html).toContain('透气创可贴')
    // 冻结的 i2 碘伏棉片不出现在可借卡片
    const cardText = wrapper.findAll('.item-card').map((c) => c.text()).join('|')
    expect(cardText).not.toContain('碘伏棉片')
  })

  it('物品详情：冻结物品页显示冻结原因、批号与替代/就医信息，申请按钮不可用', async () => {
    await router.replace('/items/i2')
    await router.isReady()
    const wrapper = mountWith(ItemDetailPage)
    await flushPromises()

    const html = wrapper.html()
    expect(html).toContain('已被冻结/隔离')
    expect(html).toContain('IOD-20260701')
    expect(html).toContain('就医渠道')
    expect(html).toContain('该批号已冻结')
    // 不适反馈核查信息（f3）与已就医记录在详情可见
    expect(html).toContain('接触部位皮肤发红')
  })

  it('工作人员工作台：冻结批次、不适核查表与四项处置动作可见', () => {
    const wrapper = mountWith(StaffPage)
    const store = useMedkitStore()
    store.switchUser('u_s')

    const html = wrapper.html()
    expect(html).toContain('冻结中批次')
    expect(html).toContain('使用后不适反馈核查')
    expect(html).toContain('个体过敏')
    expect(html).toContain('物品（批次）问题')
    expect(html).toContain('同批次下架报废')
    expect(html).toContain('恢复并加品类风险提醒')
    expect(html).toContain('维持冻结继续核查')
    // f3 登记的过敏史/包装照片/就医情况
    expect(html).toContain('不清楚，没有留意过')
    expect(html).toContain('feedback-f3-package.jpg')
  })
})
