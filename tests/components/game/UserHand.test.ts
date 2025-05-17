// tests/components/game/UserHand.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import UserHand from '~/components/game/UserHand.vue'

// Mock the useSfx composable
vi.mock('~/composables/useSfx', () => ({
    useSfx: () => ({
        playSfx: vi.fn()
    })
}))

// Don't mock Vue's ref - use the real implementation
vi.unmock('vue')

describe('UserHand.vue', () => {
    let wrapper: any

    beforeEach(() => {
        // Reset mocks between tests
        vi.clearAllMocks()
    })

    it('renders the correct number of cards', () => {
        const cards = ['card1', 'card2', 'card3']
        wrapper = mount(UserHand, {
            props: {
                cards,
                disabled: false,
                cardsToSelect: 1
            },
            global: {
                stubs: {
                    'whiteCard': true,
                    'UButton': true
                }
            }
        })

        // Check if all cards are rendered
        const cardElements = wrapper.findAll('.absolute.mb-30')
        expect(cardElements.length).toBe(cards.length)
    })

    it('selects a card when clicked', async () => {
        const cards = ['card1', 'card2', 'card3']
        wrapper = mount(UserHand, {
            props: {
                cards,
                disabled: false,
                cardsToSelect: 2
            },
            global: {
                stubs: {
                    'whiteCard': true,
                    'UButton': true
                }
            }
        })

        // Click the first card
        await wrapper.findAll('.absolute.mb-30')[0].trigger('click')

        // Force a re-render to ensure Vue updates the DOM
        await wrapper.vm.$nextTick()

        // Check if the card is selected by looking for the class on the inner div
        const selectedCards = wrapper.findAll('div[class*="outline-green-500"]')
        expect(selectedCards.length).toBe(1)
    })

    it('emits select-cards event when submit button is clicked with correct selection', async () => {
        const cards = ['card1', 'card2', 'card3']
        wrapper = mount(UserHand, {
            props: {
                cards,
                disabled: false,
                cardsToSelect: 1
            },
            global: {
                stubs: {
                    'whiteCard': true,
                    'UButton': true  // Add UButton stub
                }
            }
        })

        // Select a card
        await wrapper.findAll('.absolute.mb-30')[0].trigger('click')
        await wrapper.vm.$nextTick()

        // Find the UButton component and trigger click
        const submitButton = wrapper.findComponent({ name: 'UButton' })
        await submitButton.trigger('click')

        // Check if the event was emitted with the correct card ID
        expect(wrapper.emitted('select-cards')).toBeTruthy()
        expect(wrapper.emitted('select-cards')[0][0]).toEqual(['card1'])
    })

    it('disables card selection when disabled prop is true', async () => {
        const cards = ['card1', 'card2', 'card3']
        wrapper = mount(UserHand, {
            props: {
                cards,
                disabled: true,
                cardsToSelect: 1
            },
            global: {
                stubs: {
                    'whiteCard': true,
                    'UButton': true
                }
            }
        })

        // Try to click a card
        await wrapper.findAll('.absolute.mb-30')[0].trigger('click')
        await wrapper.vm.$nextTick()

        // Check that no card is selected
        const selectedCards = wrapper.findAll('div[class*="outline-green-500"]')
        expect(selectedCards.length).toBe(0)
    })
})