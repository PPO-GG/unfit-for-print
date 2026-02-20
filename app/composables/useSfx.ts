// composables/useSfx.ts
import { getRandomInt, getRandomFloat, getRandomInRange as getCryptoRandomInRange } from '~/composables/useCrypto';

/**
 * Represents options for sound effects (SFX).
 * - `volume`: Sets the volume of the sound. Can be a single number or an array*/
interface SfxOptions {
    volume?: number | [number, number];
    pitch?: number | [number, number];
    id?: string;
}

/**
 *
 */
interface SpriteMap {
    [key: string]: [startMs: number, durationMs: number];
}

/**
 *
 */
export const useSfx = (spriteSrc?: string, spriteMap?: SpriteMap) => {
    if (!import.meta.client) {
        const playSfx = async () => {}
        return { playSfx }
    }

    const audioContext = new AudioContext();
    let spriteAudioBuffer: AudioBuffer | null = null;
    const bufferCache = new Map<string, AudioBuffer>();

    if (spriteSrc) {
        fetch(spriteSrc)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
            .then(buffer => {
                spriteAudioBuffer = buffer;
            })
            .catch(err => {
                if (import.meta.dev) console.warn('Failed to load sprite audio:', err);
            });
    }

    const playSfx = async (src: string | string[], options: SfxOptions = {}) => {
        let bufferSource: AudioBufferSourceNode | null = null;
        let gainNode: GainNode | null = null;

        if (spriteAudioBuffer && spriteMap) {
            let spriteToPlay: string | null = null;

            if (options.id) {
                spriteToPlay = options.id;
            } else {
                const spriteKeys = Object.keys(spriteMap);
                if (spriteKeys.length > 0) {
                    spriteToPlay = spriteKeys[getRandomInt(spriteKeys.length)];
                }
            }

            if (spriteToPlay && spriteMap[spriteToPlay]) {
                const [startMs, durationMs] = spriteMap[spriteToPlay];
                const startSec = startMs / 1000;
                const durationSec = durationMs / 1000;

                bufferSource = audioContext.createBufferSource();
                bufferSource.buffer = spriteAudioBuffer;
                bufferSource.start(0, startSec, durationSec);

                gainNode = audioContext.createGain();
                bufferSource.connect(gainNode);
                gainNode.connect(audioContext.destination);

                if (options.pitch !== undefined) {
                    bufferSource.playbackRate.value = getCryptoRandomInRange(options.pitch);
                }

                if (options.volume !== undefined) {
                    gainNode.gain.value = getCryptoRandomInRange(options.volume);
                }
            }
        } else {
            const file = Array.isArray(src) ? src[getRandomInt(src.length)] : src;

            let buffer = bufferCache.get(file);
            if (!buffer) {
                try {
                    const response = await fetch(file);
                    const arrayBuffer = await response.arrayBuffer();
                    buffer = await audioContext.decodeAudioData(arrayBuffer);
                    bufferCache.set(file, buffer);
                } catch (err) {
                    if (import.meta.dev) console.warn('Failed to load audio:', err);
                    return;
                }
            }

            bufferSource = audioContext.createBufferSource();
            bufferSource.buffer = buffer;
            bufferSource.start(0);

            gainNode = audioContext.createGain();
            bufferSource.connect(gainNode);
            gainNode.connect(audioContext.destination);

            if (options.pitch !== undefined) {
                bufferSource.playbackRate.value = getCryptoRandomInRange(options.pitch);
            }

            if (options.volume !== undefined) {
                gainNode.gain.value = getCryptoRandomInRange(options.volume);
            }
        }
    };

    return { playSfx };
};
