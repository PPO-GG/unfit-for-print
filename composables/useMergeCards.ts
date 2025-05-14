function sanitizeText(text: string): string {
    return text.replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' ').trim()
}
export function mergeCardText(blackText: string, whiteText: string | string[]): string {
    const whiteTexts = Array.isArray(whiteText) ? whiteText : [whiteText]
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

    console.log(result.join('').trim())
    return result.join('').trim()
}

