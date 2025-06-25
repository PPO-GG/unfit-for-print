function sanitizeText(text: string | undefined | null): string {
    if (text === undefined || text === null) {
        return '';
    }
    return text.replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' ').trim()
}
export function mergeCardText(blackText: string | undefined | null, whiteText: string | string[] | undefined | null): string {
    // Return empty string if not on client side
    if (typeof window === 'undefined') {
        return '';
    }

    if (blackText === undefined || blackText === null) {
        blackText = '';
    }

    const whiteTexts = Array.isArray(whiteText) ? whiteText : (whiteText !== undefined && whiteText !== null ? [whiteText] : [])
    const sanitizedWhiteTexts = whiteTexts.map(sanitizeText)

    const parts = blackText.split(/_+/g)
    const blanks = blackText.match(/_+/g)?.length || 0

    if (blanks === 0) {
        return `${blackText.trim()} ${sanitizedWhiteTexts.join(', ')}`.trim()
    }

    const result = []
    for (let i = 0; i < parts.length; i++) {
        result.push(parts[i])
        if (i < sanitizedWhiteTexts.length) {
            result.push(sanitizedWhiteTexts[i])
        }
    }

    const finalResult = result.join('').trim()
    // Only log on client side (redundant check since we already check at the beginning, but just to be safe)
    if (typeof window !== 'undefined') {
        // console.info('%c%s','color:lightblue;font-weight:bold;font-size:2em;text-transform:uppercase;',finalResult);
    }
    return finalResult
}
