// tests/utils/appwrite.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAppwrite } from '~/utils/appwrite'

// Mock the Appwrite SDK
vi.mock('~/composables/useAppwrite', () => ({
    useAppwrite: () => ({
        databases: vi.fn(),
        account: vi.fn(),
        client: vi.fn(),
        functions: vi.fn(),
        teams: vi.fn()
    })
}))

describe('appwrite utility', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns the same instance on multiple calls', () => {
        const instance1 = getAppwrite()
        const instance2 = getAppwrite()

        expect(instance1).toBe(instance2)
    })

    it('initializes with correct configuration', () => {
        const { Client } = require('appwrite')
        getAppwrite()

        expect(Client).toHaveBeenCalled()
        expect(Client.mock.results[0].value.setEndpoint).toHaveBeenCalled()
        expect(Client.mock.results[0].value.setProject).toHaveBeenCalled()
    })
})