// composables/useSfx.ts

/**
 * Interface for sound effect (SFX) options.
 * Simple static sound
 * play('/sounds/card-flip.wav')
 *
 * With random pitch and volume
 * play('/sounds/join.wav', {
 *     pitch: [0.95, 1.05],
 *     volume: [0.4, 0.8],
 * })
 *
 * Pick from a random list of sounds
 * play(['/sounds/blip1.wav', '/sounds/blip2.wav'], {
 *     pitch: 1,
 *     volume: 0.6,
 * })
 */


interface SfxOptions {
    /**
     * Volume level or range for the audio.
     * - If a single number is provided, it sets a fixed volume.
     * - If a tuple [min, max] is provided, a random volume within the range is used.
     */
    volume?: number | [number, number];

    /**
     * Pitch level or range for the audio.
     * - If a single number is provided, it sets a fixed pitch.
     * - If a tuple [min, max] is provided, a random pitch within the range is used.
     */
    pitch?: number | [number, number];
}

/**
 * Utility function to get a random value within a range.
 *
 * @param val - A single number or a range [min, max].
 * @returns A random number within the range, or the number itself if a single value is provided.
 */
const getRandomInRange = (val: number | [number, number]): number => {
    if (typeof val === 'number') return val;
    const [min, max] = val;
    return Math.random() * (max - min) + min;
};

/**
 * Composable function to handle sound effects (SFX).
 * Provides a method to play audio files with optional volume and pitch adjustments.
 *
 * @returns An object containing the `play` method.
 */
export const useSfx = () => {
    /**
     * Plays an audio file or a random file from a list of sources.
     *
     * @param src - A string representing the audio file path or an array of file paths.
     * @param options - Optional settings for volume and pitch adjustments.
     */
    const playSfx = (src: string | string[], options: SfxOptions = {}) => {
        // Select a random file if multiple sources are provided
        const file = Array.isArray(src) ? src[Math.floor(Math.random() * src.length)] : src;

        try {
            const audio = new Audio(file);

            // Adjust playback rate (pitch) if specified
            if (options.pitch !== undefined) {
                audio.playbackRate = getRandomInRange(options.pitch);
            }

            // Adjust volume if specified
            if (options.volume !== undefined) {
                audio.volume = getRandomInRange(options.volume);
            }

            // Attempt to play the audio
            audio.play().catch((err) => {
                if (import.meta.dev) {
                    console.warn('SFX play failed:', err);
                }
            });
        } catch (err) {
            if (import.meta.dev) {
                console.warn('Failed to load audio:', err);
            }
        }
    };

    return { playSfx };
};