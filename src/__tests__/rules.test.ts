import { describe, expect, it } from 'vitest'
import {
  CATEGORY_ALTERNATIVES,
  buildRiskNoticeText,
  isSameBatch,
  isValidBatchNo,
  normalizeBatchNo,
  validateDraft,
} from '@/rules'
import type { ItemDraft } from '@/types'

const NOW = '2026-09-27T09:00:00'

function baseDraft(over: Partial<ItemDraft> = {}): ItemDraft {
  return {
    name: '碘伏棉片',
    category: 'iodophor',
    spec: '20片/盒',
    expiryDate: '2027-01-01',
    storage: 'room_temp',
    sealed: true,
    quantity: 2,
    location: '3号楼共享柜',
    sceneTags: ['elderly_wound'],
    batchNo: 'IDP-2508A',
    ...over,
  }
}

describe('登记禁入规则', () => {
  it('处方药/口服注射药关键词一律禁入', () => {
    for (const name of ['布洛芬缓释胶囊', '阿莫西林颗粒', '头孢注射液', '退烧药水']) {
      const { errors } = validateDraft(baseDraft({ name }), NOW)
      expect(errors.join(' ')).toContain('疑似药品')
    }
  })

  it('拆封、冷链、过期、数量异常分别拦截', () => {
    expect(validateDraft(baseDraft({ sealed: false }), NOW).errors.join()).toContain('拆封')
    expect(validateDraft(baseDraft({ storage: 'refrigerate' }), NOW).errors.join()).toContain('冷链')
    expect(validateDraft(baseDraft({ expiryDate: '2020-01-01' }), NOW).errors.join()).toContain('过期')
    expect(validateDraft(baseDraft({ quantity: 0 }), NOW).errors.join()).toContain('数量')
  })

  it('60/30 天效期分级预警', () => {
    expect(validateDraft(baseDraft({ expiryDate: '2026-10-20' }), NOW).warnings.join()).toContain('30 天')
    expect(validateDraft(baseDraft({ expiryDate: '2026-11-20' }), NOW).warnings.join()).toContain('60 天')
    expect(validateDraft(baseDraft({ expiryDate: '2027-06-01' }), NOW).warnings.join()).not.toContain('效期')
  })

  it('缺批号只警告不拦截，并提示无法同批次联动', () => {
    const r = validateDraft(baseDraft({ batchNo: '' }), NOW)
    expect(r.errors).toHaveLength(0)
    expect(r.warnings.join()).toContain('生产批号')
  })
})

describe('批次判定', () => {
  it('批号规范化（去空格、大写）', () => {
    expect(normalizeBatchNo(' idp-2508a ')).toBe('IDP-2508A')
    expect(isValidBatchNo('a1')).toBe(false)
    expect(isValidBatchNo('IDP-2508A')).toBe(true)
  })

  it('同品类同批号才算同批次，缺批号不构成同批次', () => {
    const a = baseDraft({ batchNo: 'IDP-2508A' })
    const b = baseDraft({ batchNo: 'idp-2508a ' })
    const c = baseDraft({ category: 'gauze', batchNo: 'IDP-2508A' })
    const d = baseDraft({ batchNo: 'IDP-2509B' })
    const e = baseDraft({ batchNo: '' })
    expect(isSameBatch(a, b)).toBe(true)
    expect(isSameBatch(a, c)).toBe(false)
    expect(isSameBatch(a, d)).toBe(false)
    expect(isSameBatch(a, e)).toBe(false)
  })
})

describe('安全替代与风险提醒文案', () => {
  it('碘伏品类至少给出非共享替代方式与社区卫生站渠道', () => {
    const texts = CATEGORY_ALTERNATIVES.iodophor.map((a) => a.title + a.detail).join(' ')
    expect(texts).toContain('清水')
    expect(texts).toContain('社区卫生服务站')
  })

  it('风险提醒文案包含品类与症状描述', () => {
    const t = buildRiskNoticeText('iodophor', '接触部位红肿')
    expect(t.title).toContain('碘伏')
    expect(t.detail).toContain('接触部位红肿')
    expect(t.detail).toContain('就医')
  })
})
