import { describe, expect, it } from 'vitest'
import {
  ALTERNATIVE_ADVICE,
  CATEGORY_ALTERNATIVES,
  MEDICAL_CHANNELS,
  batchKey,
  batchLabel,
  validateDraft,
} from '@/rules'
import type { ItemDraft } from '@/types'

const NOW = '2026-09-27T09:00:00'

function baseDraft(overrides: Partial<ItemDraft> = {}): ItemDraft {
  return {
    name: '碘伏棉片',
    category: 'iodophor',
    spec: '20片/盒',
    batchNo: 'IOD-20260701',
    expiryDate: '2027-01-01',
    storage: 'room_temp',
    sealed: true,
    quantity: 2,
    location: '3号楼共享柜',
    sceneTags: ['elderly_wound'],
    ...overrides,
  }
}

describe('validateDraft 禁入规则', () => {
  it('合规未拆封物品无错误', () => {
    const r = validateDraft(baseDraft(), NOW)
    expect(r.errors).toHaveLength(0)
  })

  it('处方药关键词拦截', () => {
    const r = validateDraft(baseDraft({ name: '布洛芬胶囊' }), NOW)
    expect(r.errors.join()).toContain('药品')
  })

  it('拆封 / 冷链 / 过期 / 数量异常拦截', () => {
    expect(validateDraft(baseDraft({ sealed: false }), NOW).errors.join()).toContain('拆封')
    expect(validateDraft(baseDraft({ storage: 'refrigerate' }), NOW).errors.join()).toContain('冷链')
    expect(validateDraft(baseDraft({ expiryDate: '2026-01-01' }), NOW).errors.join()).toContain('过期')
    expect(validateDraft(baseDraft({ quantity: 0 }), NOW).errors.join()).toContain('数量')
  })

  it('60/30 天效期预警分级', () => {
    expect(validateDraft(baseDraft({ expiryDate: '2026-10-20' }), NOW).warnings.join()).toContain('30')
    expect(validateDraft(baseDraft({ expiryDate: '2026-11-20' }), NOW).warnings.join()).toContain('60')
  })

  it('未填批号给出同批次冻结相关提示，但不拦截', () => {
    const r = validateDraft(baseDraft({ batchNo: '' }), NOW)
    expect(r.errors).toHaveLength(0)
    expect(r.warnings.join()).toContain('批号')
  })
})

describe('批次工具', () => {
  it('同品类同批号键相同，不同批号键不同', () => {
    expect(batchKey('iodophor', 'A')).toBe(batchKey('iodophor', 'A'))
    expect(batchKey('iodophor', 'A')).not.toBe(batchKey('iodophor', 'B'))
    expect(batchKey('iodophor', 'A')).not.toBe(batchKey('gauze', 'A'))
  })
  it('批次标签含品类与批号', () => {
    expect(batchLabel('iodophor', 'IOD-1')).toContain('碘伏')
    expect(batchLabel('iodophor', 'IOD-1')).toContain('IOD-1')
  })
})

describe('安全替代与就医渠道', () => {
  it('碘伏的替代物是纱布与创可贴，且给出非药物处理建议', () => {
    expect(CATEGORY_ALTERNATIVES.iodophor).toEqual(['gauze', 'bandage'])
    expect(ALTERNATIVE_ADVICE.iodophor).toContain('流动水')
  })
  it('提供至少两条就医渠道，含 120 急救', () => {
    expect(MEDICAL_CHANNELS.length).toBeGreaterThanOrEqual(2)
    expect(MEDICAL_CHANNELS.some((c) => c.action.includes('120'))).toBe(true)
  })
})
