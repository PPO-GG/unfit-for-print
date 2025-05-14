declare module 'mespeak' {
    export interface SpeakOptions {
        amplitude?: number
        pitch?: number
        speed?: number
        wordgap?: number
        variant?: string
        voice?: string
        volume?: number // 0–1
        pan?: number    // -1 to 1 (left to right)
        rawdata?: boolean | 'array' | 'base64' | 'data-url' | 'mime'
        log?: boolean
        punct?: boolean | string
        capitals?: number
        linebreak?: number
        utf16?: boolean
        ssml?: boolean
        nostop?: boolean
        callback?: (success: boolean, id: number, stream?: any) => void
    }

    export function speak(
        text: string,
        options?: SpeakOptions,
        callback?: (success: boolean, id: number, stream?: any) => void
    ): number

    export function loadConfig(config: any): void
    export function loadVoice(voice: any, callback?: (success: boolean, idOrError: string) => void): void
    export function setDefaultVoice(id: string): void
    export function isVoiceLoaded(id: string): boolean
    export function setVolume(vol: number, idList?: number[]): number
    export function getVolume(id?: number): number
    export function stop(...ids: number[]): number
    export function setFilter(...filters: any[]): void
}
