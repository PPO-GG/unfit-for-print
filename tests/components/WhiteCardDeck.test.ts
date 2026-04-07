// tests/components/WhiteCardDeck.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WhiteCardDeck from '~/components/game/WhiteCardDeck.vue'

// Stub heavy dependencies
vi.mock('~/composables/useWhiteDeckPosition', () => ({
  useWhiteDeckPosition: () => ({
    registerDeck: vi.fn(),
    isDealing: { value: false },
  }),
}))

vi.mock('gsap', () => ({
  gsap: { fromTo: vi.fn() },
}))

// Stub WhiteCard so we don't need the full card rendering chain
const WhiteCardStub = { template: '<div class="white-card-stub" />', props: Object.keys({}) }

describe('WhiteCardDeck', () => {
  it('does not render draw indicator when needsDraw is false', () => {
    const wrapper = mount(WhiteCardDeck, {
      props: { needsDraw: false },
      global: { stubs: { WhiteCard: WhiteCardStub, UIcon: true } },
    })
    expect(wrapper.find('.draw-indicator').exists()).toBe(false)
  })

  it('renders draw indicator on topmost layer when needsDraw is true', () => {
    const wrapper = mount(WhiteCardDeck, {
      props: { needsDraw: true },
      global: { stubs: { WhiteCard: WhiteCardStub, UIcon: true } },
    })
    expect(wrapper.find('.draw-indicator').exists()).toBe(true)
  })

  it('renders draw indicator only once (on topmost layer, not all 5)', () => {
    const wrapper = mount(WhiteCardDeck, {
      props: { needsDraw: true },
      global: { stubs: { WhiteCard: WhiteCardStub, UIcon: true } },
    })
    expect(wrapper.findAll('.draw-indicator')).toHaveLength(1)
  })
})
