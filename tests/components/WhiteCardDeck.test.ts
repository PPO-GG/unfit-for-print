// tests/components/WhiteCardDeck.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WhiteCardDeck from '~/components/game/WhiteCardDeck.vue'

;(globalThis as any).useI18n = () => ({ t: (key: string) => key })

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
const stubs = { WhiteCard: WhiteCardStub, UIcon: true }

describe('WhiteCardDeck', () => {
  it('does not render draw indicator when needsDraw is false', () => {
    const wrapper = mount(WhiteCardDeck, {
      props: { needsDraw: false },
      global: { stubs },
    })
    expect(wrapper.find('.draw-indicator').exists()).toBe(false)
  })

  it('renders draw indicator on topmost layer when needsDraw is true', () => {
    const wrapper = mount(WhiteCardDeck, {
      props: { needsDraw: true },
      global: { stubs },
    })
    expect(wrapper.find('.draw-indicator').exists()).toBe(true)
  })

  it('renders draw indicator only once (on topmost layer, not all 5)', () => {
    const wrapper = mount(WhiteCardDeck, {
      props: { needsDraw: true },
      global: { stubs },
    })
    expect(wrapper.findAll('.draw-indicator')).toHaveLength(1)
  })

  // The indicator alone — a small icon on the card back — was easy to play a
  // whole manual-draw game without noticing, so the deck also says how many.
  it('shows how many cards are waiting to be drawn', () => {
    const wrapper = mount(WhiteCardDeck, {
      props: { interactive: true, needsDraw: true, drawCount: 3 },
      global: { stubs },
    })
    expect(wrapper.find('.draw-badge').text()).toBe('+3')
  })

  it('shows no badge and is no button when there is nothing to draw', () => {
    const wrapper = mount(WhiteCardDeck, { global: { stubs } })
    expect(wrapper.find('.draw-badge').exists()).toBe(false)
    expect(wrapper.attributes('role')).toBeUndefined()
  })

  it('draws on click and on Enter while interactive', async () => {
    const wrapper = mount(WhiteCardDeck, {
      props: { interactive: true, needsDraw: true, drawCount: 2 },
      global: { stubs },
    })
    expect(wrapper.attributes('role')).toBe('button')
    await wrapper.trigger('click')
    await wrapper.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('draw')).toHaveLength(2)
  })

  it('ignores clicks while not interactive', async () => {
    const wrapper = mount(WhiteCardDeck, { global: { stubs } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('draw')).toBeUndefined()
  })
})
