// composables/useProfanityFilter.ts
import { Filter } from 'bad-words'

const bannedNames = [
    'admin',
    'administrator',
    'mod',
    'moderator',
    'root',
    'superuser',
    //list of other common usernames that are often banned
    'support',
    'helpdesk',
    'customer',
    'service',
    'info',
    'contact',
    'sales',
    'billing',
    'legal',
    'privacy',
    'terms',
    'policy',
    'security',
    'abuse',
    'spam',
    'scam',
    'fraud',
    'phishing',
    'malware',
    'virus',
    'trojan',
    'worm',
    'ransomware',
    'bot',
    'hacker',
    'cracker',
    'exploit',
    'attack',
    'breach',
    'hack',
    'crack',
]

const filter = new Filter()
filter.addWords(...bannedNames)

export const useProfanityFilter = () => {
    const isBadUsername = (username: string): boolean => {
        return filter.isProfane(username.toLowerCase())
    }

    return { isBadUsername }
}
