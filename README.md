<div align="center">
<img src="https://unfit.cards/img/ufp2.svg" alt="UNFIT FOR PRINT Logo" width="300">

# UNFIT FOR PRINT

**A party game for hideous people.**

[![Appwrite](https://img.shields.io/badge/Appwrite-%23FD366E.svg?style=flat&logo=appwrite&logoColor=white)](https://appwrite.io)
[![Build](https://img.shields.io/github/actions/workflow/status/PPO-GG/unfit-for-print/release.yml)](https://github.com/PPO-GG/unfit-for-print/actions)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Version](https://img.shields.io/github/package-json/v/PPO-GG/unfit-for-print/main)](https://github.com/PPO-GG/unfit-for-print/releases)

[Play Now](https://unfit.cards) | [Report a Bug](https://github.com/PPO-GG/unfit-for-print/issues)

</div>

---

Unfit for Print is a Cards Against Humanity-style game built for the browser. Create a lobby, invite your friends, and take turns being terrible. Made by **MYND** at **[PPO.GG](https://ppo.gg)**.

> _Not affiliated with Cards Against Humanity - we just love their game._

## Screenshots

<div align="center">
<img src="https://api.ppo.gg/v1/storage/buckets/6831670e0005cf04762c/files/685c566000229ae5c35a/preview?project=682eb1b9000cb3845772&token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ0b2tlbklkIjoiNjg1YzU3NzAzZTVjZDg4YmE4ZjUiLCJyZXNvdXJjZUlkIjoiNjgzMTY3MGUwMDA1Y2YwNDc2MmM6Njg1YzU2NjAwMDIyOWFlNWMzNWEiLCJyZXNvdXJjZVR5cGUiOiJmaWxlcyIsInJlc291cmNlSW50ZXJuYWxJZCI6IjE6NCIsImV4cCI6OS4yMjMzNzIwMzg2MDU2NThlKzE4fQ.caloDTHv-FNBLxO-Sa0Pc_0LmFErainfrXMwI7zca-0" alt="Unfit For Print Homepage" height="auto">
<img src="https://api.ppo.gg/v1/storage/buckets/6831670e0005cf04762c/files/685c565c00213ebc4ad1/preview?project=682eb1b9000cb3845772&token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ0b2tlbklkIjoiNjg1YzU3YzcxMzc1MDhhMWIzZWEiLCJyZXNvdXJjZUlkIjoiNjgzMTY3MGUwMDA1Y2YwNDc2MmM6Njg1YzU2NWMwMDIxM2ViYzRhZDEiLCJyZXNvdXJjZVR5cGUiOiJmaWxlcyIsInJlc291cmNlSW50ZXJuYWxJZCI6IjE6MyIsImV4cCI6OS4yMjMzNzIwMzg2MDU2NThlKzE4fQ.vwVAEbEQ-Cn6cM814MVF4YPft4JstjkHV3D4myy90lE" alt="Unfit For Print Gameplay" height="auto">
<img src="https://console.ppo.gg/v1/storage/buckets/6831670e0005cf04762c/files/685c56570020bfe5ee8c/preview?project=682eb1b9000cb3845772&token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ0b2tlbklkIjoiNjg1YzU3ZTgxY2RkODIyM2JkZTYiLCJyZXNvdXJjZUlkIjoiNjgzMTY3MGUwMDA1Y2YwNDc2MmM6Njg1YzU2NTcwMDIwYmZlNWVlOGMiLCJyZXNvdXJjZVR5cGUiOiJmaWxlcyIsInJlc291cmNlSW50ZXJuYWxJZCI6IjE6MiIsImV4cCI6OS4yMjMzNzIwMzg2MDU2NThlKzE4fQ.LN81NVWDA9S6PhlGR8K-nfU7j9LlrifT_MIK7-KL-hY" alt="Unfit For Print Judging" height="auto">
</div>

## Features

- **Real-time multiplayer** - game state syncs instantly across all players via CRDTs
- **Rotating judge** - everyone takes turns picking the funniest (or most horrible) answer
- **Public & private lobbies** - share a code or browse open games
- **In-game chat** - talk trash while you play
- **Spectator mode** - watch without playing, jump in when you're ready
- **Submission timers** - keep rounds moving, AFK players get skipped automatically
- **Text-to-speech** - have cards read aloud for extra laughs
- **Discord Activity** - play directly inside a Discord voice channel
- **9 languages** - English, Spanish, French, German, Portuguese, Russian, Japanese, Korean, and Chinese
- **Sound effects** - audio cues to keep the energy up
- **Rejoin on disconnect** - drop out and come back without losing your spot
- **Card packs** - pick which decks to play with each game

New to the game? Check out the [About page](https://unfit.cards/about) for a full walkthrough.

## Tech Stack

| Layer     | Tech                                           |
| --------- | ---------------------------------------------- |
| Framework | Nuxt 4 + Vue 3 Composition API                 |
| UI        | Nuxt UI v4, Tailwind CSS 4                     |
| Real-time | Yjs CRDTs + custom Teleportal WebSocket server |
| Backend   | Appwrite (self-hosted) + Nitro server routes   |
| Auth      | Discord OAuth2 + anonymous sessions            |
| Hosting   | Cloudflare Workers                             |
| i18n      | @nuxtjs/i18n (9 locales)                       |
| Testing   | Vitest                                         |

## Contributing

Found a bug? Have an idea? [Open an issue](https://github.com/PPO-GG/unfit-for-print/issues)

_Still in active development. Things might break, things might not work as intended._

## License

This project is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) - see the [LICENSE](LICENSE) file for details.
