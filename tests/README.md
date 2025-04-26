# Testing with Vitest

This directory contains tests for the Unfit application using Vitest.

## Running Tests

You can run the tests using the following npm scripts:

```bash
# Run all tests once
pnpm test

# Run tests in watch mode (rerun on file changes)
pnpm test:watch

# Run tests with the Vitest UI
pnpm test:ui
```

## Test Structure

The tests are organized into the following directories:

- `components/`: Tests for Vue components
- `composables/`: Tests for composable functions
- `examples/`: Example tests demonstrating specific testing techniques
- `utils/`: Utility functions for testing

## Testing the Winning Screen

One of the key features to test is the winning screen that appears when a game is complete. There are several ways to trigger the winning screen for testing purposes:

### Using gameTestUtils

The `gameTestUtils` utility provides functions to help with testing game-related functionality:

```typescript
import { gameTestUtils } from '../utils/gameTestUtils'

// Create a mock lobby
const lobbyRef = gameTestUtils.createMockLobby()

// Create mock players
const players = gameTestUtils.createMockPlayers()

// Create a mock game context
const mockGameContext = gameTestUtils.createMockGameContext(false)

// Trigger the winning screen
gameTestUtils.triggerWinningScreen(lobbyRef)

// Update the game context to match
mockGameContext.isComplete.value = true
mockGameContext.leaderboard.value = [
  { playerId: 'player1', points: 10 },
  { playerId: 'player2', points: 5 }
]
```

See the `examples/triggerWinningScreen.test.ts` file for complete examples.

### Direct Approach

You can also directly modify the game context to trigger the winning screen:

```typescript
// Assuming you have a mock game context
mockGameContext.isComplete.value = true
mockGameContext.leaderboard.value = [
  { playerId: 'player1', points: 10 },
  { playerId: 'player2', points: 5 }
]
```

## Mocking Dependencies

Most tests will need to mock various dependencies. Here's an example of how to mock the common composables:

```typescript
import { vi } from 'vitest'

// Mock useGameContext
vi.mock('~/composables/useGameContext', () => ({
  useGameContext: vi.fn(() => ({
    // Return mock values here
    isComplete: ref(false),
    // ...other properties
  }))
}))

// Mock useGameActions
vi.mock('~/composables/useGameActions', () => ({
  useGameActions: vi.fn(() => ({
    startGame: vi.fn(),
    playCard: vi.fn(),
    selectWinner: vi.fn()
  }))
}))
```

## Adding New Tests

When adding new tests:

1. Follow the existing directory structure
2. Use descriptive test names
3. Mock dependencies as needed
4. Use the utility functions in `utils/gameTestUtils.ts` when appropriate