export const useGameState = () => {
  // Convert JS object -> string for Appwrite storage
  const encodeGameState = (state: object): string => {
    try {
      return JSON.stringify(state)
    } catch (error) {
      console.error('Failed to encode game state:', error)
      return ''
    }
  }

  // Convert string from Appwrite -> JS object
  const decodeGameState = (raw: string | null): Record<string, any> => {
    try {
      return raw ? JSON.parse(raw) : {}
    } catch (error) {
      console.error('Failed to decode game state:', error)
      return {}
    }
  }

  return {
    encodeGameState,
    decodeGameState,
  }
}
