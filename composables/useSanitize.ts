// composables/useSanitize.ts
import DOMPurify from 'dompurify'

export function useSanitize() {
    const sanitize = (input: string): string => {
        return DOMPurify.sanitize(input, {
            USE_PROFILES: { html: true }
        })
    }

    const sanitizeIfHtml = (input: string): string => {
        // Optional helper: only sanitize if input looks like HTML
        if (/<\/?[a-z][\s\S]*>/i.test(input)) {
            return sanitize(input)
        }
        return input
    }

    return {
        sanitize,
        sanitizeIfHtml
    }
}
