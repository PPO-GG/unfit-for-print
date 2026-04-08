# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [3.12.0](https://github.com/PPO-GG/unfit-for-print/compare/v3.11.0...v3.12.0) (2026-04-08)


### ✨ Features

* **activity:** add error diagnostic digest with copy-to-clipboard support ([94290a1](https://github.com/PPO-GG/unfit-for-print/commit/94290a1f9522aa50c9f0f5a45a75417f1957091b))
* **activity:** add stage-aware error UI for Discord launch flow and allow sidebar during gameplay ([c3e7891](https://github.com/PPO-GG/unfit-for-print/commit/c3e789151678af866eabdbf81a1a0e2d260cdf22))
* add settings to profile page ([a9b2eb4](https://github.com/PPO-GG/unfit-for-print/commit/a9b2eb4f7b19c38242c40c6e237430324d5bcad1))
* **web:** streamline Discord Activity launch to skip header and land on main page ([2ddffd0](https://github.com/PPO-GG/unfit-for-print/commit/2ddffd03d5aa367797993038fd851295e6412753))


### 🐛 Bug Fixes

* add optional chaining for strict array index access in discord-activity auth ([52bd851](https://github.com/PPO-GG/unfit-for-print/commit/52bd851600399b2650c448b3b4b75bce3cdbb5be))
* **tts:** set default tts voice to kokoro nicole ([b9713c6](https://github.com/PPO-GG/unfit-for-print/commit/b9713c6bb671b37899f0190ddd26146a8c776c10))

## [3.11.0](https://github.com/PPO-GG/unfit-for-print/compare/v3.10.0...v3.11.0) (2026-04-08)


### ✨ Features

* **animations:** arc trajectory and landing bounce for card submission ([9d07617](https://github.com/PPO-GG/unfit-for-print/commit/9d076172cf70f79787f772b772f978fe2555d8c0))
* **animations:** enhanced FLIP overshoot, reveal flash, and whoosh SFX ([bddf7cc](https://github.com/PPO-GG/unfit-for-print/commit/bddf7cce5da492817b136df2542d00dc6069e5db))
* **animations:** hand rise/lower, zone glow, black card slide-in, judge pulse ([a0dc5b0](https://github.com/PPO-GG/unfit-for-print/commit/a0dc5b0bdd3b35ae664a2287361ccbcc9aa05647))
* **app-shell:** game menu landing page with atmospheric overlay ([71d9c3d](https://github.com/PPO-GG/unfit-for-print/commit/71d9c3d06fcbb1ceaa9eca6495f742255384014a))
* **app-shell:** lobby browser game tile styling ([43179f1](https://github.com/PPO-GG/unfit-for-print/commit/43179f19e405ec09acb262629dd8775f63794814))
* **atmosphere:** ambient dust motes and submission ripple effects ([7759724](https://github.com/PPO-GG/unfit-for-print/commit/775972481637dca08bec022bb3f075552d0cc979))
* **board:** wire skip-player event up to page handler ([989500c](https://github.com/PPO-GG/unfit-for-print/commit/989500caad2edff57e0117608d7f85d60fdf52d9))
* **celebrations:** game win card sweep, crown decoration, and golden card display ([32f6d90](https://github.com/PPO-GG/unfit-for-print/commit/32f6d9096a48586f5aa39b156a35d789b8808813))
* **celebrations:** round win spotlight, screen shake, confetti, and card slide-off ([93dcbc1](https://github.com/PPO-GG/unfit-for-print/commit/93dcbc1f97214ec4cea4042b9f55047b9996d924))
* **celebrations:** score fly +1 badge arcing to winner seat ([ca0cb70](https://github.com/PPO-GG/unfit-for-print/commit/ca0cb703bb26d8e23fac43a1bc7af29c2e346cad))
* **deck:** add pulsing draw indicator on white deck in manual draw mode ([a06ecee](https://github.com/PPO-GG/unfit-for-print/commit/a06eceefbcee6723500665dbcb032626cf5583b7))
* **game:** propagate card pack name through black card pipeline ([491a7e2](https://github.com/PPO-GG/unfit-for-print/commit/491a7e28aef7e7a0054ed0ae67b5401d29e21ed2))
* **header:** add back button to desktop nav on non-home, non-game pages ([f252b4e](https://github.com/PPO-GG/unfit-for-print/commit/f252b4eb13c50e136c1e097ab4719afec3f32e81))
* **home:** redesign user menu, add hover effects, and add footer legal links ([2101986](https://github.com/PPO-GG/unfit-for-print/commit/21019868c17d937064602fbc1a28af933f6431c3))
* **index:** add avatarUrl, handleLogout, handleLoginWithDiscord, isAdmin, isDiscordActivity helpers ([96a68fa](https://github.com/PPO-GG/unfit-for-print/commit/96a68fafd31ffe764dc444ed5cb01845b84a143d))
* **index:** gate admin button with isAdmin, add Hub for Discord Activity mode ([6705776](https://github.com/PPO-GG/unfit-for-print/commit/670577608f597e6b1317e02154ed5f6670f9ae3c))
* **index:** replace raw buttons with UButton AppHeader style ([075aab9](https://github.com/PPO-GG/unfit-for-print/commit/075aab94e5b6ba27e6d5dace615cd7b706b50a15))
* **index:** replace top-right corner with avatar UDropdownMenu ([00c0277](https://github.com/PPO-GG/unfit-for-print/commit/00c0277ac6b2d5a05a7ce5ed33a8a48574ef9be4))
* **manual-draw:** add engine logic and interactive deck UI ([1ade22b](https://github.com/PPO-GG/unfit-for-print/commit/1ade22b654d5c18e120f0675c1d5d37f00784d34))
* **seats:** add host skip button to player seat arc and overflow ([4d63f16](https://github.com/PPO-GG/unfit-for-print/commit/4d63f1684afa2158b35f9c42c8847edea9a13826))
* **settings:** add manual draw toggle to game settings UI ([d67961d](https://github.com/PPO-GG/unfit-for-print/commit/d67961de6ea9ce8eb70b0231fe5fb6896491066e))
* **settings:** add manualDraw setting to types and mutations ([468d2fa](https://github.com/PPO-GG/unfit-for-print/commit/468d2fa5487ca0ae8d848ad778e09ba8e910104b))
* **sfx:** wire placeholder sound effects to phase transitions ([8396254](https://github.com/PPO-GG/unfit-for-print/commit/8396254213ad1dfc7ec5899d20aa6853cbfa9e5c))
* **table:** bubble skip-player event and pass isHost to seats ([34f3e86](https://github.com/PPO-GG/unfit-for-print/commit/34f3e86e2cf9dad837ac32cd1b1f9d3044c4086c))


### 🐛 Bug Fixes

* **game:** add z-index to GameHeader and clean up BlackCardDeck offsets ([0fde8b7](https://github.com/PPO-GG/unfit-for-print/commit/0fde8b706997e07d2638d752f24a0e7e1ae1bb4c))
* **game:** fix manual draw indicator visibility and allow drawing in any phase ([0f54ee8](https://github.com/PPO-GG/unfit-for-print/commit/0f54ee81c3108c3a7e9587b175dffa041b9608a1))
* **index:** remove redundant ClientOnly wrapper around admin button ([8e0b1e7](https://github.com/PPO-GG/unfit-for-print/commit/8e0b1e7820ac55cdb452ca16ea93121a91adb976))
* **index:** restore footer flow layout, add accessible alt to avatar img ([6aaf221](https://github.com/PPO-GG/unfit-for-print/commit/6aaf2216b2c901b1973ea801cc6eaa2502a97d21))
* **layout:** add AppHeader to default layout ([8336a0a](https://github.com/PPO-GG/unfit-for-print/commit/8336a0aa3e00c2bd53b7e8313f7067bc347559a5))
* **layout:** replace AppHeader with standalone back button in default layout ([b5c8b33](https://github.com/PPO-GG/unfit-for-print/commit/b5c8b33cbc4fbd89cf5330cee8b0d8dc33315f45))
* **nav:** move UModal inside root div, show back button on all screen sizes ([d7f9340](https://github.com/PPO-GG/unfit-for-print/commit/d7f9340c6115a8835364d7ea040cff7caafef268))
* **responsive:** scrolling background column count at all viewports ([5f1ef58](https://github.com/PPO-GG/unfit-for-print/commit/5f1ef583a55850811f40e5cbefab1459c5e73af1))
* **seats:** add aria-labels, fix overflow button, add missing i18n keys for skip-player ([9dc0374](https://github.com/PPO-GG/unfit-for-print/commit/9dc037424a849046ef90326d4c3d098006962ff9))


### ♻️ Refactors

* **background:** replace GSAP animation with CSS-only infinite scroll ([803c455](https://github.com/PPO-GG/unfit-for-print/commit/803c4556b52799c8254ec4fd7c9929f78350c341))
* **tts:** export TTSProviderType and adjust Kokoro Nicole speed ([da605b9](https://github.com/PPO-GG/unfit-for-print/commit/da605b968f903e9cc2d174963e66f5df00e29cb8))

## [3.10.0](https://github.com/PPO-GG/unfit-for-print/compare/v3.9.1...v3.10.0) (2026-04-07)


### ✨ Features

* **activity:** add resume game button, error display, and existing lobby redirect in hub ([1eeda2f](https://github.com/PPO-GG/unfit-for-print/commit/1eeda2f1c8ca0afd2dc783a85b37a244beb00be3))
* **admin:** add decoration delete with improved edit modal layout ([79181e0](https://github.com/PPO-GG/unfit-for-print/commit/79181e0074e61e846cc4cda6b66eabdace466463))
* create lobby immediately on button click, remove dialog ([aa2a32e](https://github.com/PPO-GG/unfit-for-print/commit/aa2a32edfc548ea18a5ce7ff40c44728c19cc59c))
* create lobby immediately on button click, skip form ([bd352d9](https://github.com/PPO-GG/unfit-for-print/commit/bd352d9ca6d1b6adbb796e95563003ca9d5d5f51))
* **decorations:** add @lottiefiles/dotlottie-web dependency ([ad03613](https://github.com/PPO-GG/unfit-for-print/commit/ad036134598fee0699ee52aefaf6aa739ca20416))
* **decorations:** add AvatarLottie canvas-based animation renderer ([119f0a3](https://github.com/PPO-GG/unfit-for-print/commit/119f0a3d32dc08327306eb7fd035c0bc215590ab))
* **decorations:** add imageFormat field to data model and Appwrite schema ([7da06c0](https://github.com/PPO-GG/unfit-for-print/commit/7da06c0066e1255827eb2f5f62f5657373638bed))
* **decorations:** add lottie/dotlottie upload validation and format detection ([5b9f853](https://github.com/PPO-GG/unfit-for-print/commit/5b9f853058f5861ae763eca05cc2c8698c324805))
* **decorations:** add playback speed control for Lottie attachments ([b54f532](https://github.com/PPO-GG/unfit-for-print/commit/b54f532ca675307dcba5aefcbe1208fc31418dfb))
* **decorations:** dispatch lottie formats to AvatarLottie component ([97fc2dd](https://github.com/PPO-GG/unfit-for-print/commit/97fc2dd51063a511767901258807bc0362f2fcbd))
* **decorations:** pipe imageFormat through all API endpoints ([e725bf3](https://github.com/PPO-GG/unfit-for-print/commit/e725bf3cd257b7070b76aaa74d341756792dc0d9))
* **decorations:** support lottie upload and preview in admin DecorationManager ([1b41ffa](https://github.com/PPO-GG/unfit-for-print/commit/1b41ffae61d952b737a3237b831f63f9000395d0))
* **discord:** add speakingDiscordIds ref and subscribeToSpeaking ([7912556](https://github.com/PPO-GG/unfit-for-print/commit/7912556b78b5e20aa16d18ec3174d9fc95e80304))
* **discord:** show speaking dot on player list avatars in game ([4227389](https://github.com/PPO-GG/unfit-for-print/commit/422738960ab53cecf516b6ba4121aeaa021a27b9))
* **discord:** show speaking ring on game table seat avatars ([ce4e86f](https://github.com/PPO-GG/unfit-for-print/commit/ce4e86f00419bfacbf34d6c440b8f5dcc87ee6d4))
* **discord:** show speaking ring on VC member avatars in hub ([a9a262b](https://github.com/PPO-GG/unfit-for-print/commit/a9a262ba810e46a43cb12928811ca48294fdb5cc))
* **discord:** subscribe to speaking events during activity launch ([52e19a4](https://github.com/PPO-GG/unfit-for-print/commit/52e19a423c2d13cef3e1633a4201ee63395f128d))
* expose maxPick and password from Y.Doc settings reactive binding ([ae9661f](https://github.com/PPO-GG/unfit-for-print/commit/ae9661f3a9aa34da1795c9b1f1247da3d6578383))
* **i18n:** add nav.hub key to all locale files ([4e3e05e](https://github.com/PPO-GG/unfit-for-print/commit/4e3e05ed1a4db4043ba50753e30d829617c2316b))
* **layout:** add AppHeader to activity layout with header-height margin ([b808636](https://github.com/PPO-GG/unfit-for-print/commit/b808636bb6a9d1b6605ca43c46223138e736758a))
* **lobby:** include expansion packs in default card selection ([b53d875](https://github.com/PPO-GG/unfit-for-print/commit/b53d875865f809fe0a81cf7ea50c69788e2f0082))
* **lobby:** replace status icon with interactive start game button ([1dcd31a](https://github.com/PPO-GG/unfit-for-print/commit/1dcd31a6f7fd09481a693ffb0677635b572220ec))
* **mobile:** add read-aloud speak button to revealed judge cards ([9c1e021](https://github.com/PPO-GG/unfit-for-print/commit/9c1e0216c314638204aa17ea3a90f2ca73ca8a35))
* **mobile:** wire readingAloud and read-aloud event through MobileGameLayout to MobileCardList ([344d117](https://github.com/PPO-GG/unfit-for-print/commit/344d1177f7966e7027b289cd9af602cf932fe395))
* **nav:** activity-aware nav items and hide join/create in Discord activity ([f110e17](https://github.com/PPO-GG/unfit-for-print/commit/f110e17e54e24b1de7ce3e9f181b2d89ba29ee1e))
* read lobbyName from lobby doc instead of gameSettings join ([1b1dd47](https://github.com/PPO-GG/unfit-for-print/commit/1b1dd47fb8327bf237ba0a652ed9c55f5cefda47))
* remove Appwrite gameSettings fallback from game start route ([1ed2b5b](https://github.com/PPO-GG/unfit-for-print/commit/1ed2b5b73afc83319278d7402cfd748254aabd21))
* remove Appwrite settings Realtime from WaitingRoom, use Y.Doc reactive settings ([f16ba46](https://github.com/PPO-GG/unfit-for-print/commit/f16ba468198190e1b9b462cac0fa2132d477cd81))
* remove documentId from game start request body ([e06cdff](https://github.com/PPO-GG/unfit-for-print/commit/e06cdff86df95223b3ecd13e6a0bbdeeaa461ca5))
* remove useGameSettings from game page, read settings from Y.Doc reactive ([5c70e72](https://github.com/PPO-GG/unfit-for-print/commit/5c70e72581a16e64c82725706d363c1ecf9026ca))
* rewrite ChatBox to use Y.Array chat — remove Appwrite gamechat dependency ([868566a](https://github.com/PPO-GG/unfit-for-print/commit/868566a6f3ca62e189f49d8a90086e7e61d4ebf4))
* save game settings to Y.Doc via mutations instead of Appwrite ([7108300](https://github.com/PPO-GG/unfit-for-print/commit/7108300e47f4ac646c03520cf91e30a62f0313bf))
* **tts:** add 1000-char input limit to kokoro-speak endpoint ([fb0af32](https://github.com/PPO-GG/unfit-for-print/commit/fb0af32dc45e247ba6c4bf6316eb733714f634ed))
* **tts:** add Google Neural2 AU and UK voices, dynamic language code ([e022bf4](https://github.com/PPO-GG/unfit-for-print/commit/e022bf447017bd4d2a3af53660bd8dac5044e4b5))
* **tts:** add Google Neural2 provider constants and getProviderFromVoiceId ([5ae14ef](https://github.com/PPO-GG/unfit-for-print/commit/5ae14ef262b966f7a1139592bbd1c5df8d51599f))
* **tts:** add Google Neural2 server endpoint ([ba779e8](https://github.com/PPO-GG/unfit-for-print/commit/ba779e8f245d234ae78fd3e32bf97cd2a4095a22))
* **tts:** add Google Neural2 voices to admin VoiceSwitcher ([9f5806e](https://github.com/PPO-GG/unfit-for-print/commit/9f5806ef6b659a5f7174fef9afc78da4382e1768))
* **tts:** add google provider routing in useSpeech ([8afb110](https://github.com/PPO-GG/unfit-for-print/commit/8afb110a40adbcb8734899719f627262c3b99410))
* **tts:** add google to TTSProvider type in GameBoard ([1b0680b](https://github.com/PPO-GG/unfit-for-print/commit/1b0680bec7f1201f335a38a497c2923c781e8813))
* **tts:** add kokoro provider to useSpeech ([aac5398](https://github.com/PPO-GG/unfit-for-print/commit/aac5398367e623d1f43f45fd4a0b2c3a383bb67e))
* **tts:** add kokoro to GameBoard TTSProvider type ([fecc87e](https://github.com/PPO-GG/unfit-for-print/commit/fecc87e68f9463741fc4aa1ad7d8cd4b0db21e92))
* **tts:** add Kokoro voice constants and provider detection ([3bb65c3](https://github.com/PPO-GG/unfit-for-print/commit/3bb65c353c0f1ca7ba479a32ce96865fa74fb919))
* **tts:** add kokoro-speak server endpoint ([d289216](https://github.com/PPO-GG/unfit-for-print/commit/d289216279e049da447352ca359a1832d507c23f))
* **tts:** redesign VoiceSwitcher with submenus, add Kokoro voices for all users ([f0cd247](https://github.com/PPO-GG/unfit-for-print/commit/f0cd247740d18d5b4693111304694d5a7f11dab1))
* write lobbyName to lobby doc, remove gameSettings/chat Appwrite calls from useLobby ([bd5a1bc](https://github.com/PPO-GG/unfit-for-print/commit/bd5a1bce127900339ce67d2d9c3b46904e4a30b7))


### 🐛 Bug Fixes

* **activity:** allow free navigation in Discord Activity, only redirect /activity init when authed ([8d9cbb8](https://github.com/PPO-GG/unfit-for-print/commit/8d9cbb81efac6db7c73346871601fc01ec5071cd))
* **activity:** preserve Discord query params during init redirect ([3ec840c](https://github.com/PPO-GG/unfit-for-print/commit/3ec840c219b61b1404a2acd6a557e6ad7254ebed))
* **activity:** redirect to init flow when Discord Activity opens on non-activity page ([af199f9](https://github.com/PPO-GG/unfit-for-print/commit/af199f9debf70eac27f4183232ab2c2f0f92108a))
* **activity:** remove nav bar push-down and double margin in activity layout ([6f50fbb](https://github.com/PPO-GG/unfit-for-print/commit/6f50fbb114f1c5b1aff7fa1743d280800af3dfad))
* **activity:** use h-screen on loading splash to prevent overflow ([2c2759d](https://github.com/PPO-GG/unfit-for-print/commit/2c2759d6934e940a54c316a7d26d3d00c43a4a44))
* add lobbyName to Lobby type, remove as any cast in game/index.vue ([303b0e8](https://github.com/PPO-GG/unfit-for-print/commit/303b0e82ef3708ca0603e145bf536bac49ecedcb))
* **auth:** serve animated GIF format for animated Discord avatars ([811e3b0](https://github.com/PPO-GG/unfit-for-print/commit/811e3b06dbf90f0ec207399ee8d679829a8caa3d))
* **bot:** prune orphan bot docs using client Y.Doc state ([fcfdfdc](https://github.com/PPO-GG/unfit-for-print/commit/fcfdfdcfb5667f46632d989f83fd914cc71816cd))
* **cards:** filter by active field instead of disabled for card packs ([e3ca1b2](https://github.com/PPO-GG/unfit-for-print/commit/e3ca1b2d69983fd3a4f8b1331eadb79123d0dafd))
* **config:** set user decorations collection ID in wrangler ([50fdae0](https://github.com/PPO-GG/unfit-for-print/commit/50fdae052bbfdb6369e6de3200eeae911054a3ed))
* **decorations:** correct imageFormat type and fix lottie thumbnail sizing ([91a03a5](https://github.com/PPO-GG/unfit-for-print/commit/91a03a597315fc7525d574bbd7ed6a2513f8c10f))
* **decorations:** fix AvatarLottie canvas sizing, cleanup race, and prop reactivity ([175a61d](https://github.com/PPO-GG/unfit-for-print/commit/175a61d0d07208d844d882b9f3c6c36022dbf059))
* **decorations:** handle x-zip-compressed MIME type and guard non-object JSON ([83cacdf](https://github.com/PPO-GG/unfit-for-print/commit/83cacdf8baa8b9fe131d38d210a588ea3670e224))
* **decorations:** improve Lottie animation rendering and sizing ([a34ca71](https://github.com/PPO-GG/unfit-for-print/commit/a34ca7151b3d3c62d794f2d8c3ce92cc62a272b1))
* **decorations:** prevent Tailwind preflight from clamping scaled attachment images ([3005add](https://github.com/PPO-GG/unfit-for-print/commit/3005add32b87a7bb41ff0f0fc27ef9e101d9134b))
* **decorations:** restore amber-400 rarity color changed by formatter ([910cb69](https://github.com/PPO-GG/unfit-for-print/commit/910cb69dd50b1cd88e91d36b2641af0823fc7378))
* **discord-sdk:** replace broken openInviteDialog with shareLink, fix setActivity clear call ([3d6a06e](https://github.com/PPO-GG/unfit-for-print/commit/3d6a06ea70cbac17cc325a285fef3f6843ad0d1c))
* **discord:** add explicit imports for getDiscordIdFromPlayer in game components ([6c39563](https://github.com/PPO-GG/unfit-for-print/commit/6c395630f332478a2688a09f4901c90af2e9b58e))
* **discord:** add rpc.voice.read scope for speaking event subscriptions ([482db6f](https://github.com/PPO-GG/unfit-for-print/commit/482db6f0276f385a1815362bcfecdcbc8aa3c54a))
* **discord:** provide non-empty message for shareLink invite ([5fb6399](https://github.com/PPO-GG/unfit-for-print/commit/5fb6399fc524f607f300d6913f2f668e736f10a2))
* **game-engine:** support chunked cardTexts for large card sets ([70acdd6](https://github.com/PPO-GG/unfit-for-print/commit/70acdd62a817c3528c4312516c43e9ef59bad3cc))
* **game:** clean up game chat and settings on lobby teardown ([965445c](https://github.com/PPO-GG/unfit-for-print/commit/965445c7b1bb38f7abb3594b80fc760887ef263b))
* **game:** prevent duplicate game settings initialization on sidebar layout ([ab789e7](https://github.com/PPO-GG/unfit-for-print/commit/ab789e7e96c3c40add55d7ada9aa5aac1efdd132))
* **game:** use WebSocket-only connection to eliminate SSE fallback 404 errors ([342fe2c](https://github.com/PPO-GG/unfit-for-print/commit/342fe2cfa9e050ff584183b3077d165e2b0d160a))
* **hub:** fix indentation of centered wrapper, add missing blank line in CSS ([fc733db](https://github.com/PPO-GG/unfit-for-print/commit/fc733db33b358d090e0894158c3f50c5ad602aa8))
* **mobile:** constrain player strip to viewport width to prevent horizontal page overflow ([a12277f](https://github.com/PPO-GG/unfit-for-print/commit/a12277f604a83e53dc3952b9d66b7ba9c1e08a93))
* **pwa:** exclude HTML from SW precache to prevent stale navigation ([b8fad97](https://github.com/PPO-GG/unfit-for-print/commit/b8fad9770349ee1aa0092b10e5211ad4d43e2c60))
* **pwa:** remove navigateFallback to fix refresh redirect on SSR routes ([d4ec522](https://github.com/PPO-GG/unfit-for-print/commit/d4ec522e1cfec3a7f4e3339fc884afaa840ac314))
* remove .value from currentUserId in ChatBox template (auto-unwrapped in Vue templates) ([0865c34](https://github.com/PPO-GG/unfit-for-print/commit/0865c34e71905e7af60bb682006fffec28c1fbdd))
* resolve TypeScript errors after gameChat/gameSettings migration ([be8df2a](https://github.com/PPO-GG/unfit-for-print/commit/be8df2a1e176a6be29abee1053df6d7bd74e10be))
* **security:** address CodeQL and Dependabot vulnerability alerts ([cf3fd87](https://github.com/PPO-GG/unfit-for-print/commit/cf3fd87d106e8bdbd20fd6f5b89285a2351701e3))
* **tts:** remove auth requirement from kokoro-speak endpoint ([d74b389](https://github.com/PPO-GG/unfit-for-print/commit/d74b389461fc4c8a44ce81db2cf420e1260fca73))
* **tts:** resolve google voice name dynamically, add server allowlist ([7d63b6f](https://github.com/PPO-GG/unfit-for-print/commit/7d63b6f1baaf296d347aaf2b9646fb34dc56cfba))
* **tts:** use kokoroVoiceIdSet, remove dead currentVoice, widen dropdown ([d35e056](https://github.com/PPO-GG/unfit-for-print/commit/d35e056653beebc790622bebabea1b10c05acd70))
* **useConfirm:** use useState for SSR-safe promise resolver ([4134c8a](https://github.com/PPO-GG/unfit-for-print/commit/4134c8a00cebcad6942f3baebed3770597453f5f))


### ♻️ Refactors

* **discord:** extract getDiscordIdFromPlayer to shared util, fix speaking ring priority ([3e5f169](https://github.com/PPO-GG/unfit-for-print/commit/3e5f1695070e89edd80fca0d9fb38873030c0afb))
* **tts:** use TTS_PROVIDERS constant for kokoro fallback voice ([2a76132](https://github.com/PPO-GG/unfit-for-print/commit/2a761320d3a965f4da5adb44cace8a51707f8af1))

## [3.9.1](https://github.com/PPO-GG/unfit-for-print/compare/v3.9.0...v3.9.1) (2026-04-05)


### 🐛 Bug Fixes

* **api:** correct userDecorations collection ID casing ([993d942](https://github.com/PPO-GG/unfit-for-print/commit/993d942ac969f32c1fc9ebcb3a22d1314f38adf9))

## [3.9.0](https://github.com/PPO-GG/unfit-for-print/compare/v3.8.0...v3.9.0) (2026-04-05)


### ✨ Features

* **admin:** add dedicated /admin/lobbies page ([9eb81b7](https://github.com/PPO-GG/unfit-for-print/commit/9eb81b77553c24e69807a1f9e390f681026ab500))
* **admin:** add mergeLobbies utility with tests for unified lobby monitor ([a9c0231](https://github.com/PPO-GG/unfit-for-print/commit/a9c02314b1cfbc62c7a3cd0d2e7dfd18d8d11fad))
* **admin:** enhance status endpoint with server-side Teleportal+Appwrite merge ([e837eff](https://github.com/PPO-GG/unfit-for-print/commit/e837eff1181f28f66d0ffe019b7bf05a0ea0ab40))
* **admin:** replace inline lobby monitor with link card to /admin/lobbies ([d036bd6](https://github.com/PPO-GG/unfit-for-print/commit/d036bd678910d4b1101b3168e7f371c73455ae25))
* **admin:** rewrite LobbyMonitor as unified single-endpoint component ([60e53cd](https://github.com/PPO-GG/unfit-for-print/commit/60e53cd64685d0eac64417c36fddbbaa8eaf0160))
* **decorations:** add admin catalog update API ([d8389c3](https://github.com/PPO-GG/unfit-for-print/commit/d8389c3584d58b70080b06a1d0d9145353669d55))
* **decorations:** add admin decorations page with catalog table, edit modal, and grant/revoke ([69fa70b](https://github.com/PPO-GG/unfit-for-print/commit/69fa70b82d2d9204eda90d6f96a5e21dd4c4bd58))
* **decorations:** add admin grant, revoke, and list APIs ([3dd9955](https://github.com/PPO-GG/unfit-for-print/commit/3dd99554504c81400c8c08e882404bc88fff16c5))
* **decorations:** add admin sync API to register decorations in DB ([0221816](https://github.com/PPO-GG/unfit-for-print/commit/02218160dd92859ffa6b10bb06e071bb45d07cff))
* **decorations:** add Appwrite collection, API routes, and useDecorations composable ([95547ef](https://github.com/PPO-GG/unfit-for-print/commit/95547efb17a65095d840bb3a2e4fe661b3e24623))
* **decorations:** add AvatarAttachment, upload routes, and decoration utilities ([a2364a7](https://github.com/PPO-GG/unfit-for-print/commit/a2364a727a43782b28043f9331f9ce49c217e7bb))
* **decorations:** add AvatarDecoration wrapper component ([4539bca](https://github.com/PPO-GG/unfit-for-print/commit/4539bca888c549f3bfb23c774948b390749c2440))
* **decorations:** add category field to admin decoration manager ([43bee57](https://github.com/PPO-GG/unfit-for-print/commit/43bee5728855db56d4c3f2bb07fe840892166466))
* **decorations:** add category field to schema, types, and server routes ([d27eefe](https://github.com/PPO-GG/unfit-for-print/commit/d27eefe0ca5f7ebe488e116d863be86a21abff29))
* **decorations:** add decoration picker to profile page ([f19703a](https://github.com/PPO-GG/unfit-for-print/commit/f19703a0c9cc757f9028d4fb254491ea481628a1))
* **decorations:** add Discord Ed25519 signature verification utility ([28e24f3](https://github.com/PPO-GG/unfit-for-print/commit/28e24f3384b52bd0e81d1c9c508ac511920e3223))
* **decorations:** add Discord webhook endpoint for entitlement fulfillment ([52feffb](https://github.com/PPO-GG/unfit-for-print/commit/52feffbe0c3cc55a95b5189d4a35c4f16af09e75))
* **decorations:** add display utility for rarity pips, colors, and category icons ([aa3e58f](https://github.com/PPO-GG/unfit-for-print/commit/aa3e58f36d19f93f5ad7fbcd4ee8147045db505a))
* **decorations:** add Founder's Ring decoration component ([3896d18](https://github.com/PPO-GG/unfit-for-print/commit/3896d180d4cd323b0adfbefb174503e2125f778a))
* **decorations:** add public catalog API endpoint ([4bf56a7](https://github.com/PPO-GG/unfit-for-print/commit/4bf56a727ed7ce7bc2e8a48f75d5c6188ae35379))
* **decorations:** add Store & Cosmetics section to admin dashboard ([8fc83af](https://github.com/PPO-GG/unfit-for-print/commit/8fc83afdb99578f029901dc8d1395971cf3db07b))
* **decorations:** add types, registry, and activeDecoration fields ([3fee419](https://github.com/PPO-GG/unfit-for-print/commit/3fee419ef30181433123ed1d222520c07e6e01bb))
* **decorations:** allow equipping freeForAll decorations without ownership row ([352063b](https://github.com/PPO-GG/unfit-for-print/commit/352063bcedbb22a1edb86b87379496182ae3d2bc))
* **decorations:** rarity pip stack + category icons, remove equipped badge, 3-line description ([4fd026e](https://github.com/PPO-GG/unfit-for-print/commit/4fd026e33ac151ba79c121c42661452e93f1bbe6))
* **decorations:** rewrite useDecorations to fetch catalog from DB with freeForAll and purchase support ([c9d1b2c](https://github.com/PPO-GG/unfit-for-print/commit/c9d1b2c11173c2000b97126659230c23bd907e9c))
* **decorations:** sync activeDecoration through Y.Doc and lobby join flow ([4343fbc](https://github.com/PPO-GG/unfit-for-print/commit/4343fbcc46b084e44965c1b25cdf44845e6ed484))
* **decorations:** update profile page with catalog descriptions and purchase buttons ([0af50cd](https://github.com/PPO-GG/unfit-for-print/commit/0af50cd19b6bb6c561228c9c878237e67800b897))
* **decorations:** wrap all avatar sites with AvatarDecoration ([4c625fe](https://github.com/PPO-GG/unfit-for-print/commit/4c625fee97b2e3c5268a01e8a748709edf858347))


### 🐛 Bug Fixes

* **admin:** add error handling to unified status endpoint ([d67e9f5](https://github.com/PPO-GG/unfit-for-print/commit/d67e9f5b7dc0a4e97cecf6f7d53e9ca0e82ad9b3))
* **admin:** address review feedback - import shared type, fix partial cleanup, add tab visibility pause ([819b007](https://github.com/PPO-GG/unfit-for-print/commit/819b007a7ebf320f57cdf67383f9990ba6e73420))
* **admin:** correct settingsMap type to Map&lt;string, string | null&gt; ([fc410a7](https://github.com/PPO-GG/unfit-for-print/commit/fc410a752a63e448f9fef1775d6264a079c99aac))
* **admin:** improve error extraction in LobbyMonitor notifications ([940ecd9](https://github.com/PPO-GG/unfit-for-print/commit/940ecd92d9490408778b704e39331b7e6eae7fd0))
* **api:** correct Teleportal GC HTTP methods and add error handling ([1f688dc](https://github.com/PPO-GG/unfit-for-print/commit/1f688dc27c1034351f8ccc0f3a207efd08de6b48))
* **auth:** use server-side sessions for Discord Activity iframe auth ([07e15cf](https://github.com/PPO-GG/unfit-for-print/commit/07e15cfebcb6d00ccadb95cd1d54ee5159109ef7))
* **decorations:** add fetch error display, clear grant fields after action, fix USelectMenu value-key ([990fd8b](https://github.com/PPO-GG/unfit-for-print/commit/990fd8b27f594f17c574c05ad0e12cfc2be1e128))
* **decorations:** add id alias, fix startPurchase SDK call, add enabled to catalog projection ([2f8415d](https://github.com/PPO-GG/unfit-for-print/commit/2f8415dd0cdb7cab1ce87d86291e9749cf94df85))
* **decorations:** add input validation to sync, Query.limit(1) to grant/revoke ([2dfa6d6](https://github.com/PPO-GG/unfit-for-print/commit/2dfa6d6c404cdce6c1ff53a7ceed2845379b4262))
* **decorations:** add row click handler to open edit modal ([c4c3dcb](https://github.com/PPO-GG/unfit-for-print/commit/c4c3dcbf44a1c27ce4f07704b3aed9f2d8999b8f))
* **decorations:** bridge allDecorations to not spread slimmed registry ([18520fe](https://github.com/PPO-GG/unfit-for-print/commit/18520fe28d99e8d4837c0576376dcf96ce2ed88d))
* **decorations:** correct Discord webhook event type, add OAuth user lookup, add header validation ([7a5d7a4](https://github.com/PPO-GG/unfit-for-print/commit/7a5d7a4e204471151fe6efb748ac6a25063a741f))
* **decorations:** remove redundant import, add aria-hidden to decorative corner icons ([380048c](https://github.com/PPO-GG/unfit-for-print/commit/380048cfd737faf964645333c2e1c954a67b74ac))
* **decorations:** rename decorations index.get to list.get for Nitro compatibility ([54e5be5](https://github.com/PPO-GG/unfit-for-print/commit/54e5be502eb46bf6cdfb937fb39a0e8532ae1a4b))
* **decorations:** restore appwrite.json defaults, add category to sync route ([084b94d](https://github.com/PPO-GG/unfit-for-print/commit/084b94d26fdec397a0bc27cc61ec4a2fb91d0473))
* **decorations:** show category icon in admin modal preview ([b15426b](https://github.com/PPO-GG/unfit-for-print/commit/b15426b7e29e30fee248d3c6dd9a619fb5bfef01))
* **discord:** preserve query params when redirecting to Activity page ([4aa74a0](https://github.com/PPO-GG/unfit-for-print/commit/4aa74a05e11389b95de2268722b397504434b67b))
* **discord:** use /appwrite proxy prefix to avoid colliding with app API routes ([af7453d](https://github.com/PPO-GG/unfit-for-print/commit/af7453db6ea0a736786ed36f3e2d8e41fbab7e33))
* **lobby:** self-heal orphaned player docs and clean up on teardown ([e54b675](https://github.com/PPO-GG/unfit-for-print/commit/e54b675cf906b395301dfb11c8db82601a30dd27))


### ♻️ Refactors

* **decorations:** replace fixed size configs with dynamic ResizeObserver sizing ([b865152](https://github.com/PPO-GG/unfit-for-print/commit/b8651525ead256cf5ca8cd459672194609803f15))
* **decorations:** split types, slim registry, add catalog config ([60dad5f](https://github.com/PPO-GG/unfit-for-print/commit/60dad5f2a6b7391d6aa3daba9b542d19e5c51eaf))


### 📖 Documentation

* add avatar decoration system design spec ([6045008](https://github.com/PPO-GG/unfit-for-print/commit/60450083cd69907ad6368dd7905366bc09b61c87))
* expand Terms of Service IP section with CC license attribution ([ba0570b](https://github.com/PPO-GG/unfit-for-print/commit/ba0570b5013a51c9bc7c8a3ccc2e992846e264f8))

## [3.8.0](https://github.com/PPO-GG/unfit-for-print/compare/v3.7.0...v3.8.0) (2026-04-03)


### ✨ Features

* **discord:** add Discord Activity lobby flow with instance-based lobby matching ([fbe0468](https://github.com/PPO-GG/unfit-for-print/commit/fbe0468bf12594aef8684026a83e5b29ef44b568))
* **discord:** add pure mapping function for rich presence activity ([ed15556](https://github.com/PPO-GG/unfit-for-print/commit/ed15556412581039fa5c393c5b1a0141a5ab095f))
* **discord:** add rpc.activities.write scope for rich presence ([fb6cdf7](https://github.com/PPO-GG/unfit-for-print/commit/fb6cdf77e988b1a3fb37fe9aeddd26903e6f68c1))
* **discord:** add useDiscordPresence composable with reactive watch ([8e3f596](https://github.com/PPO-GG/unfit-for-print/commit/8e3f596e9ee0d2ab80e155eb71e5d1dedf0e578e))
* **discord:** wire up rich presence in game page ([fad8dcb](https://github.com/PPO-GG/unfit-for-print/commit/fad8dcb11945dc0f3a2f90970d758daadcbd63e7))
* **mobile:** add mobile game layout with phase-driven UX ([d32e658](https://github.com/PPO-GG/unfit-for-print/commit/d32e65894e18480ed60e6c160c1882edb5247b47))
* **mobile:** add player strip with scores and replace status bar dots with phase label ([f899463](https://github.com/PPO-GG/unfit-for-print/commit/f899463c759b4bd48a2bf3ef20be8ad02721f83f))
* **mobile:** merge winner screens into unified view and add card flip SFX ([5b1c179](https://github.com/PPO-GG/unfit-for-print/commit/5b1c179e8d7c2f700ea68ce87889e20c8f5ffd77))


### 🐛 Bug Fixes

* **admin:** wrap admin page in ClientOnly for SSR compatibility ([8018475](https://github.com/PPO-GG/unfit-for-print/commit/8018475dd9cf99e9e8731678dd5289d9b866e33c))
* **ci:** pass Discord client ID to build step ([90ce14e](https://github.com/PPO-GG/unfit-for-print/commit/90ce14e9a172a8dcaf83db948c0f795cab2f093b))
* **discord:** align client ID env var with NUXT_PUBLIC_ convention ([a7b363f](https://github.com/PPO-GG/unfit-for-print/commit/a7b363f045a83f9e576823b716a63061a6edb86e))
* **discord:** fall back to consent dialog when silent auth fails in DMs ([580e497](https://github.com/PPO-GG/unfit-for-print/commit/580e49779ef9c52009f761b1f9e62658f9ba4288))
* **discord:** patch URL mappings to proxy Appwrite requests through Discord CSP ([7a41294](https://github.com/PPO-GG/unfit-for-print/commit/7a4129456f66288d210cee1aa5f25b964f948842))
* **discord:** redirect Activity iframe to /activity and skip eager session fetch ([2219edc](https://github.com/PPO-GG/unfit-for-print/commit/2219edc358e864785729769241119107c3a858ea))
* **game:** add null guard for lobby ID in ensureGameSettings ([5cae13b](https://github.com/PPO-GG/unfit-for-print/commit/5cae13b1904ea85fb2049e06f8327f309f9bf24a))
* **labs:** add auth headers to submission delete request ([a11ebbe](https://github.com/PPO-GG/unfit-for-print/commit/a11ebbe2ccf91bf6527affffc1cb4f901d1fe62e))


### ♻️ Refactors

* **discord:** type-narrow phase and export DiscordActivity interface ([c9414aa](https://github.com/PPO-GG/unfit-for-print/commit/c9414aaf6f543c267ad568b798aff842a030813a))
* **ui:** migrate ConfirmDialog to Nuxt UI v4 UModal slots API ([9b7b93d](https://github.com/PPO-GG/unfit-for-print/commit/9b7b93dbce0ca37da8ccc3cab0960ef31743d626))
* **ui:** simplify AppHeader layout and move blur to nav buttons ([d8c7d0c](https://github.com/PPO-GG/unfit-for-print/commit/d8c7d0c82b56bace1d04a39724330d411aadc702))

## [3.7.0](https://github.com/PPO-GG/unfit-for-print/compare/v3.6.0...v3.7.0) (2026-04-02)


### ✨ Features

* **admin:** replace native confirm/fetch with modal dialog and server proxy for Discord Activity ([98664bb](https://github.com/PPO-GG/unfit-for-print/commit/98664bb5e68adbf0cfb43f9d8c7627846ca6cc2c))
* **legal:** add Terms of Service and Privacy Policy as dedicated pages ([bba29ff](https://github.com/PPO-GG/unfit-for-print/commit/bba29ffd4675ee652c112e0698a52f6cf73c80b1))


### 🐛 Bug Fixes

* **deps:** add pnpm overrides to resolve 22 dependabot security alerts ([30afb0b](https://github.com/PPO-GG/unfit-for-print/commit/30afb0b250ae7b44d6f7a20c7f1a5959b49b66a8))
* **discord:** add debug logging to SDK close() for troubleshooting ([a44b3b6](https://github.com/PPO-GG/unfit-for-print/commit/a44b3b6fdab0fe9a02a613b281b23d90de6a271f))

## [3.6.0](https://github.com/PPO-GG/unfit-for-print/compare/v3.5.0...v3.6.0) (2026-04-02)


### ✨ Features

* **admin:** move submission deletion to server API route and pin vite ([d8fd0fd](https://github.com/PPO-GG/unfit-for-print/commit/d8fd0fd4c5fb483ba74fe736f502f4b1540a8db6))
* Discord Activity (Embedded App) integration ([3f035ed](https://github.com/PPO-GG/unfit-for-print/commit/3f035ed51e21947480e4663fb33b487dba1c638a))
* **discord-activity:** add activity entry page with auto-lobby creation ([7c477b0](https://github.com/PPO-GG/unfit-for-print/commit/7c477b0b3a561add2533ced225146b161112bd7f))
* **discord-activity:** add CSP frame-ancestors for Discord iframe ([6f2b553](https://github.com/PPO-GG/unfit-for-print/commit/6f2b5538cae8540184043aa6528df7486456291e))
* **discord-activity:** add minimal activity layout for Discord iframe ([9a6df5e](https://github.com/PPO-GG/unfit-for-print/commit/9a6df5e586d32d04c85802e741951d4f563bb483))
* **discord-activity:** add server auth bridge (Discord code → Appwrite session) ([c9f32a0](https://github.com/PPO-GG/unfit-for-print/commit/c9f32a0749ff316af364e315a8a7a932e1a6fd4d))
* **discord-activity:** add useDiscordSDK composable ([3e00fd9](https://github.com/PPO-GG/unfit-for-print/commit/3e00fd9cacc9af71da53612974310ba46bdcd327))
* **discord-activity:** dynamic layout switching and Activity-mode guards ([076170e](https://github.com/PPO-GG/unfit-for-print/commit/076170e271ce6c34973daded754b82dee99828a7))
* **discord-activity:** install embedded app SDK and add config ([e22592f](https://github.com/PPO-GG/unfit-for-print/commit/e22592f7d72fe9ac91c2013e7d0bfac63f688fef))
* **discord-activity:** redirect Discord iframe from / to /activity ([054b930](https://github.com/PPO-GG/unfit-for-print/commit/054b9302984a3cf11fb8e40c228d7ac954e98f75))
* **discord:** improve activity UX — auth-only splash, close button, no auto-lobby ([a7d459a](https://github.com/PPO-GG/unfit-for-print/commit/a7d459adf55bedd74da2498bb17bbcc4911f3fb6))


### 🐛 Bug Fixes

* **discord-activity:** handle retry after auth, revert aggressive session guard ([271cd17](https://github.com/PPO-GG/unfit-for-print/commit/271cd17b3a1dc2d93b685376070844667e5679b1))
* **discord-activity:** skip auto session fetch in Activity mode to prevent 401s ([c4b2efe](https://github.com/PPO-GG/unfit-for-print/commit/c4b2efef59c3f78dad19005f63ccd4459d0dacef))
* **discord-activity:** SSR-safe dynamic import, scoped CSP, clean config ([c3edbd5](https://github.com/PPO-GG/unfit-for-print/commit/c3edbd5d532a298596a68ced79d1a21a8cf8f397))
* **game:** update GameSettings permissions on host transfer ([fac3dcf](https://github.com/PPO-GG/unfit-for-print/commit/fac3dcfaf00ad92ac4214dcfbc3a82ba29aa49f4))
* **license:** change license from CC BY-SA 4.0 to CC BY-NC-SA 4.0 ([352b539](https://github.com/PPO-GG/unfit-for-print/commit/352b539ee5318a920b32f9a0246399e33a3c4dd4))
* **security:** patch Dependabot alerts — bump dompurify, add pnpm overrides ([f70fe51](https://github.com/PPO-GG/unfit-for-print/commit/f70fe51e90d1c34a363a83a6341493e053a95a32))


### 📖 Documentation

* **privacy:** remove inactive Rybbit analytics, update date ([ebbf8b9](https://github.com/PPO-GG/unfit-for-print/commit/ebbf8b98a3fcb9dfe188b00d3e34d6a2a7a3b8a2))
* rewrite README with updated features, tech stack, and correct license ([7f8f9af](https://github.com/PPO-GG/unfit-for-print/commit/7f8f9afbd62346dbb12ede01ed740f56bbde5b7b))

## [3.5.0](https://github.com/PPO-GG/unfit-for-print/compare/v3.4.0...v3.5.0) (2026-03-05)


### ✨ Features

* **admin:** add admin API endpoints for lobby deletion and status updates ([2d89db7](https://github.com/PPO-GG/unfit-for-print/commit/2d89db77209792f18062b8aa7f0d1293beeffc0d))
* **admin:** add web-worker-powered duplicate card scanner with live progress ([1934963](https://github.com/PPO-GG/unfit-for-print/commit/193496315a16907710ba24ea8561d4c9550aab58))
* **admin:** fix card upload pipeline with auth headers, progress bar, and live log terminal ([da979fb](https://github.com/PPO-GG/unfit-for-print/commit/da979fb6788d28b8fdaa5b796dc5fc2e57b95eb3))
* **admin:** overhaul admin card manager into routed multi-page layout ([5acaba4](https://github.com/PPO-GG/unfit-for-print/commit/5acaba41e602bfb6e3d66dad116b48e09745499c))
* **auth:** always sync Discord username and avatar on session load ([6673317](https://github.com/PPO-GG/unfit-for-print/commit/66733178b12516a90d1f052dc9fb8bd2861d24b1))
* **changelog:** redesign changelog page with split layout and categorized timeline ([acdc837](https://github.com/PPO-GG/unfit-for-print/commit/acdc83749543116a5e58d0c1cd45dd0faa9c9b98))
* **game:** fix race conditions in round advancement and card dealing ([8386760](https://github.com/PPO-GG/unfit-for-print/commit/8386760121c018d43e5dd987f924dc572f0b52d4))
* **speech:** add stop() to TTS composables and front-page speak toggle ([68f1afd](https://github.com/PPO-GG/unfit-for-print/commit/68f1afd38b08a97b8b7b988e2022d8b3331adacf))


### 🐛 Bug Fixes

* **game:** fix host demotion not clearing isHost flag on prior host ([87da09c](https://github.com/PPO-GG/unfit-for-print/commit/87da09ca2bbc9c8cbc2e0855cff457602e32dddd))

## [3.4.0](https://github.com/PPO-GG/unfit-for-print/compare/v3.3.1...v3.4.0) (2026-03-02)


### ✨ Features

* add About page with how-to-play guide and FAQ ([55d2bb4](https://github.com/PPO-GG/unfit-for-print/commit/55d2bb4af93d35067612fbe4e6864adeca5103df))
* add Changelog page with GitHub releases via MDC ([02f690b](https://github.com/PPO-GG/unfit-for-print/commit/02f690b96200a2b6a37b9af9de2c4e90a6445bfc))
* add cross-environment UUID v4 utility ([3de461b](https://github.com/PPO-GG/unfit-for-print/commit/3de461bc7ba8a641c81934d73f2b12512f219c62))
* **game:** add draw-cards API and async deck replenishment ([33c5bd2](https://github.com/PPO-GG/unfit-for-print/commit/33c5bd2700fb6cca8508258fb2f24436e3c67b43))
* **game:** add host reset-to-lobby with confirmation modal ([3da85e4](https://github.com/PPO-GG/unfit-for-print/commit/3da85e4454001651f629c38e6ea2831ac88fa8ad))
* **game:** add real-time lobby browser with live game info ([a4d04b3](https://github.com/PPO-GG/unfit-for-print/commit/a4d04b346a81c1408f05705ca94b6c9e3b89140c))
* **i18n:** add reset-game and about nav translation keys ([8b07d2a](https://github.com/PPO-GG/unfit-for-print/commit/8b07d2a1eaf63dc9c3b4a39b1159f3cb76571fbc))


### 🐛 Bug Fixes

* **game:** pass card-pack prop to WhiteCard for report popover ([b979f28](https://github.com/PPO-GG/unfit-for-print/commit/b979f28da9e99ecbb061bf649b32ab73d870313e))


### ♻️ Refactors

* **admin:** replace tabs with responsive card grid layout ([c1a4436](https://github.com/PPO-GG/unfit-for-print/commit/c1a44368968f2757f3e84fd477ece2fd4f99ba30))
* extract shared lobby actions composable and simplify AppHeader ([e3af1ac](https://github.com/PPO-GG/unfit-for-print/commit/e3af1ac4fc364ca3e9bdedb69059247a08bfcaa4))
* **game:** fix spectator filtering in lobby mutations and chat ([33e8dc6](https://github.com/PPO-GG/unfit-for-print/commit/33e8dc694b69c416ab77af3ad8ff34f6a748d414))

## [3.3.1](https://github.com/PPO-GG/unfit-for-print/compare/v3.3.0...v3.3.1) (2026-03-01)


### 🐛 Bug Fixes

* **WhiteCard:** Add correct card type ([0b31702](https://github.com/PPO-GG/unfit-for-print/commit/0b317024ce9ae6c4fd04f8b931c804db4bb2a798))

## [3.3.0](https://github.com/PPO-GG/unfit-for-print/compare/v3.2.0...v3.3.0) (2026-03-01)


### ✨ Features

* **game:** add confetti blast when your card wins ([3c596cd](https://github.com/PPO-GG/unfit-for-print/commit/3c596cde5b5f92693571765db41e1bae8f46c82d))
* **game:** add maxPick setting UI with pick selector and hints ([b76226d](https://github.com/PPO-GG/unfit-for-print/commit/b76226d6c15178d8b0ea0b8111d77a0fff5a3751))
* **game:** add WaitingHero component for lobby display ([92e6089](https://github.com/PPO-GG/unfit-for-print/commit/92e60897af57ef24735a9ef6e38405daec9c1621))
* **game:** enhance Y.Doc engine with card dealing, settings sync, and spectator conversion ([99dc9af](https://github.com/PPO-GG/unfit-for-print/commit/99dc9afb5bdfb6848aa40dcba30bf90ec1576b86))
* **i18n:** add game settings and lobby i18n keys for all locales ([b79aa39](https://github.com/PPO-GG/unfit-for-print/commit/b79aa3929593db73584cd2fa47a6fa5a76a1d472))


### ♻️ Refactors

* **game:** migrate game actions from server API to Y.Doc engine ([5a65709](https://github.com/PPO-GG/unfit-for-print/commit/5a65709437a0c9982a3918564ce97eaa4931b854))

## [3.2.0](https://github.com/PPO-GG/unfit-for-print/compare/v3.1.0...v3.2.0) (2026-03-01)


### ✨ Features

* **admin:** update dashboard for yjs lobby monitoring ([cbf527b](https://github.com/PPO-GG/unfit-for-print/commit/cbf527bfad8699d42d53b3a47703c62c4c6a21f5))
* **api:** add teleportal yjs server for realtime game lobbies ([326a8e5](https://github.com/PPO-GG/unfit-for-print/commit/326a8e5fbaf63202b1668ba211c269bb0b53cd67))
* **web:** update game ui and endpoints to use yjs state structures ([c39d7ce](https://github.com/PPO-GG/unfit-for-print/commit/c39d7ce994a03ae04c5f092bb72b1d4cf620b94a))


### 🐛 Bug Fixes

* **api:** force node-fetch-native-with-agent to workerd-compatible aliases ([1ebc1dc](https://github.com/PPO-GG/unfit-for-print/commit/1ebc1dc440794d0a2edc3e2b6332e6021991e772))
* **api:** shim json-bigint to fix instanceof BigNumber crash on CF Workers ([ed175e4](https://github.com/PPO-GG/unfit-for-print/commit/ed175e492208375b99f36e0c34b2e3ae5c9f9afb))
* **api:** use local fetch shim to bypass node-fetch-native-with-agent on workerd ([28b15c4](https://github.com/PPO-GG/unfit-for-print/commit/28b15c43f0482e3e61f50b760041e6c1022d6e1f))
* **api:** use unenv aliases for node-fetch-native-with-agent workerd compatibility ([c7ee1b8](https://github.com/PPO-GG/unfit-for-print/commit/c7ee1b87d851f2d9d3122b11dfbeea25eb16c793))


### ♻️ Refactors

* **web:** decompose useLobby into reactive yjs composables ([e5d8f24](https://github.com/PPO-GG/unfit-for-print/commit/e5d8f24bc760e364d2bb90671ce0b290048e126f))

## [3.1.0](https://github.com/PPO-GG/unfit-for-print/compare/v3.0.0...v3.1.0) (2026-02-26)


### ✨ Features

* **web:** add dynamic browser tab title with phase and round info ([df98a3e](https://github.com/PPO-GG/unfit-for-print/commit/df98a3e593ebb7cbac9e3f346cee28ccffee4ba7))
* **web:** add dynamic favicon with round badge and status indicators ([b366cdf](https://github.com/PPO-GG/unfit-for-print/commit/b366cdf37986dfed09622ff8ad83f76e8abd8a49))


### 🐛 Bug Fixes

* **api:** use requireAuth and admin SDK in assertAdmin utility ([0358ddc](https://github.com/PPO-GG/unfit-for-print/commit/0358ddc5dcaf2db6634a6c1f2bcd1bc38f0227d7))


### ♻️ Refactors

* **web:** replace Rybbit analytics plugin with no-op stub ([6c319b7](https://github.com/PPO-GG/unfit-for-print/commit/6c319b7461a11b93e6ef75f904afc2f0f4d72f0e))

## [3.0.0](https://github.com/PPO-GG/unfit-for-print/compare/v2.7.1...v3.0.0) (2026-02-26)


### ⚠ BREAKING CHANGES

* nuxt-appwrite module is no longer used as a dependency

### ♻️ Refactors

* inline nuxt-appwrite module for Cloudflare Workers compatibility ([d54a625](https://github.com/PPO-GG/unfit-for-print/commit/d54a6257f6e4e880de704ffbf9e5aa55878a90cc))

## [2.7.1](https://github.com/PPO-GG/unfit-for-print/compare/v2.7.0...v2.7.1) (2026-02-26)


### 🐛 Bug Fixes

* **nitro:** add Cloudflare Workers export conditions for node-appwrite ([75870a6](https://github.com/PPO-GG/unfit-for-print/commit/75870a68d34fa15a4c99cedbfa965e38ef960b9b))


### ⚡ Performance

* **cursor:** rewrite custom cursor with dual-strategy architecture ([a0c3485](https://github.com/PPO-GG/unfit-for-print/commit/a0c3485dba70b22b784742a64997470d3cb1ad3a))

## [2.7.0](https://github.com/PPO-GG/unfit-for-print/compare/v2.6.3...v2.7.0) (2026-02-26)


### ✨ Features

* **seo:** add dynamic OG metadata for shared lobby links ([c3ef1c6](https://github.com/PPO-GG/unfit-for-print/commit/c3ef1c63e48c4b4a83b57a7825557e207d40a3ad))


### 🐛 Bug Fixes

* **build:** remove node-appwrite external to fix Cloudflare Workers 500s ([13a59a9](https://github.com/PPO-GG/unfit-for-print/commit/13a59a9f5ddc9042ba57194d81ca58e313f357e1))

## [2.6.3](https://github.com/PPO-GG/unfit-for-print/compare/v2.6.2...v2.6.3) (2026-02-26)


### 🐛 Bug Fixes

* **ci:** add github-pages environment to deploy job ([f633248](https://github.com/PPO-GG/unfit-for-print/commit/f6332482d79b4cc96f67e7ec0422195eef0bcaeb))

## [2.6.2](https://github.com/PPO-GG/unfit-for-print/compare/v2.6.1...v2.6.2) (2026-02-26)


### 🐛 Bug Fixes

* **ci:** switch deploy from Pages to Workers with wrangler.toml ([466c579](https://github.com/PPO-GG/unfit-for-print/commit/466c579644cb5b9ac6b22b5ee42bc83d8156d32d))

## [2.6.1](https://github.com/PPO-GG/unfit-for-print/compare/v2.6.0...v2.6.1) (2026-02-26)


### 🐛 Bug Fixes

* **deps:** update nuxt-appwrite to pre-built dist commit ([7b81094](https://github.com/PPO-GG/unfit-for-print/commit/7b810946492ba8fc6f95bafcdc38b97303e82182))

## [2.6.0](https://github.com/PPO-GG/unfit-for-print/compare/v2.5.0...v2.6.0) (2026-02-26)


### ✨ Features

* **game:** add dynamic card shadows and improved flip animations ([4cff990](https://github.com/PPO-GG/unfit-for-print/commit/4cff990d909dbfc5a002ce8249aafd657045f262))
* **game:** add player rankings to table seats ([6869b64](https://github.com/PPO-GG/unfit-for-print/commit/6869b646e014071ba2aca819e80d08f5d2bbaadb))
* **game:** add TTS read-aloud broadcast with resilient round advancement ([1522afa](https://github.com/PPO-GG/unfit-for-print/commit/1522afa0967350f21be4ea13afcb24e3888c9bbe))
* **game:** add unique bot names and DiceBear avatars ([eebacd0](https://github.com/PPO-GG/unfit-for-print/commit/eebacd0c3ea783d910ab91178641e785db53f316))
* **game:** scale hand cards smaller at rest and enlarge on hover ([b180d04](https://github.com/PPO-GG/unfit-for-print/commit/b180d045eed40f4c8c2e2cf0992c16e53d858ca9))


### 🐛 Bug Fixes

* **auth:** persist Discord avatar URL and improve refresh reliability ([49df350](https://github.com/PPO-GG/unfit-for-print/commit/49df3501b6d8e60cfc9a072d65fabf0184b38831))
* **game:** harden submission endpoints with retry and version checks ([82d4a52](https://github.com/PPO-GG/unfit-for-print/commit/82d4a52d7fd20d3e4328aa338d618750e6500ab7))
* **home:** correct homepage markup ([b243d61](https://github.com/PPO-GG/unfit-for-print/commit/b243d6145f7d3f742fde17c19d8825649df9d7cf))
* **pwa:** service worker redirect fix ([ddcb97e](https://github.com/PPO-GG/unfit-for-print/commit/ddcb97eb8b7f7c7638efbc005b781be46c42d88f))

## [2.5.0](https://github.com/PPO-GG/unfit-for-print/compare/v2.4.1...v2.5.0) (2026-02-25)


### ✨ Features

* **game:** add GSAP animations to round counter, phase label, and seat interactions ([891f2a3](https://github.com/PPO-GG/unfit-for-print/commit/891f2a3bc942aaf395c3671863ab653e39dd8afd))
* **game:** add GSAP entrance animations to winner celebration with confetti ([127e023](https://github.com/PPO-GG/unfit-for-print/commit/127e02309659f9373d2770213d97df13c3f9b703))
* **game:** add GSAP smooth custom cursor with SVG images ([9ee84b7](https://github.com/PPO-GG/unfit-for-print/commit/9ee84b70ee91f93c1f009df5b8a55f8e802ca0c3))
* **game:** add judge indicator banner and dynamic table padding ([a2f8fee](https://github.com/PPO-GG/unfit-for-print/commit/a2f8feedce26df9d2f6e9382dc03866d87e17512))
* **game:** give bots unique names and DiceBear avatars ([6e2c13f](https://github.com/PPO-GG/unfit-for-print/commit/6e2c13fbc1e123aa378565545e62faab90e519c2))
* **game:** redesign GameOver screen with full leaderboard and stats ([18bf9d6](https://github.com/PPO-GG/unfit-for-print/commit/18bf9d6a2a8cdb6e50b3a7bfdf20fb123dabf87a))
* **pwa:** add install banner to install as pwa ([c6334a4](https://github.com/PPO-GG/unfit-for-print/commit/c6334a4f5bcf578f9790aecf20eb62f51999fef7))


### 🐛 Bug Fixes

* **game:** defer bot cleanup until lobby resets to waiting phase ([9eb9b29](https://github.com/PPO-GG/unfit-for-print/commit/9eb9b29cae2004914e612289cf5f87b8c414dcb3))
* **game:** harden audio loader with content-type checks and error resilience ([baeb6eb](https://github.com/PPO-GG/unfit-for-print/commit/baeb6ebe1610a14583b85f366ba0b4c807c63bd6))
* **game:** host resets lobby on auto-return and manual continue ([a0c3fed](https://github.com/PPO-GG/unfit-for-print/commit/a0c3fede4d02c931a2d37217b8edaf29a293a2d3))
* **game:** improve WhiteCard error handling for catch clause typing ([d6d8351](https://github.com/PPO-GG/unfit-for-print/commit/d6d8351cfa7cfaace28b366bff0cebba1d45c18d))
* **server:** correct Appwrite SDK method signatures and add lobbyId validation ([8db9802](https://github.com/PPO-GG/unfit-for-print/commit/8db9802b09a66f1138f4a56e7352a92ad012ba3e))

## [2.4.1](https://github.com/PPO-GG/unfit-for-print/compare/v2.4.0...v2.4.1) (2026-02-24)


### 🐛 Bug Fixes

* **admin:** update function to properly fetch admin session ([f141dad](https://github.com/PPO-GG/unfit-for-print/commit/f141dad1c03b59c1b4f7aaadcd18a23fdbb9e0e0))
* **api:** restore secure session auth on bot endpoints ([7075a21](https://github.com/PPO-GG/unfit-for-print/commit/7075a21114d57b0d7e35d6ed6d6315e6aa566b5e))
* **api:** rewrite requireAuth to use admin-SDK session verification ([f0a053c](https://github.com/PPO-GG/unfit-for-print/commit/f0a053ce52989f8242cdfe89320d2ad1bce7fe62))
* **api:** use node-appwrite import and add error handling ([f14b2bf](https://github.com/PPO-GG/unfit-for-print/commit/f14b2bfc315038ba6b516e515c1b4729855bd8be))
* **build:** externalize node-appwrite from Nitro bundle ([085c39a](https://github.com/PPO-GG/unfit-for-print/commit/085c39a2fda8a007f745ba646baaa9ae7480c0f5))
* **build:** removed redundant packages for build succession ([3e29493](https://github.com/PPO-GG/unfit-for-print/commit/3e29493c429a3c1aba928ef156aa676c69ee44ef))
* **client:** send auth headers on all authenticated API calls ([8192af9](https://github.com/PPO-GG/unfit-for-print/commit/8192af9fdcdb0295dceb4a39059041710ddbb393))
* **game:** restore bot UI updates and Discord avatar after auth migration ([fa85459](https://github.com/PPO-GG/unfit-for-print/commit/fa854597a0cf5180244b087389ff392890fb107c))
* **realtime:** replace TablesDB .rows channels with standard .documents format ([492d18b](https://github.com/PPO-GG/unfit-for-print/commit/492d18b47aead29c7493ba9dfef8aeb0ee28dd02))

## [2.4.0](https://github.com/PPO-GG/unfit-for-print/compare/v2.3.0...v2.4.0) (2026-02-24)


### ✨ Features

* **admin:** enrich reports with card text and add dismiss/card-action endpoints ([ade5420](https://github.com/PPO-GG/unfit-for-print/commit/ade54203ee01c7cf76b4617f3ef515d8c6f0ff71))
* **admin:** move setup page into admin section with access guard ([de09acd](https://github.com/PPO-GG/unfit-for-print/commit/de09acd58a8d74a2c937da44cc3572569b008c57))
* **auth:** add Discord avatar persistence and streamline login flow ([f587eec](https://github.com/PPO-GG/unfit-for-print/commit/f587eec37ff15c65cc36528f306a8d2b7407616c))
* **bot:** add staggered card play and simulated thinking delays ([f616961](https://github.com/PPO-GG/unfit-for-print/commit/f6169610b1bb40bb3ca602aa02f4cd52db42b5d0))
* **chat:** implement message pagination and server-side system events ([06a4d39](https://github.com/PPO-GG/unfit-for-print/commit/06a4d39e02271cbe3f19ff42df383e2fcf76697c))
* **game:** add win-round and win-game sound effects ([54d9dc8](https://github.com/PPO-GG/unfit-for-print/commit/54d9dc8fa0bbf950db39090aeb115a8880d0b3e7))
* **game:** allow host to skip unresponsive judges ([be227ee](https://github.com/PPO-GG/unfit-for-print/commit/be227eed13bcd894df8ed9b6781bb0b5c26d7dfa))
* **game:** decompose GameTable into focused sub-components ([0c7392e](https://github.com/PPO-GG/unfit-for-print/commit/0c7392e8b2d9f953891eb434fc8f851661082fd4))
* **game:** improve user hand card interaction with earlier snapshotting ([fcf460e](https://github.com/PPO-GG/unfit-for-print/commit/fcf460ec4fb9765f02b456b61acc6deb6f4820bd))
* **game:** redesign game UI — lobby, waiting room, player list, sidebar, and cards ([b61497e](https://github.com/PPO-GG/unfit-for-print/commit/b61497e2c0ac6989015730d5052588501665302e))
* **hand:** enhance mobile hand interactions and drag threshold gestures ([8a0dd5c](https://github.com/PPO-GG/unfit-for-print/commit/8a0dd5c2d0d51e6914417c8afcf26f4b17677a93))
* **i18n:** add lobby players-needed short label across all locales ([3f64717](https://github.com/PPO-GG/unfit-for-print/commit/3f647178ba6a8b5b34867e82ed81ca441b3d565b))
* **labs:** add Labs page with card submission browsing and submission form ([d19a7dc](https://github.com/PPO-GG/unfit-for-print/commit/d19a7dc83b1ee1cfd1f77c3f2fbb1971f7ec5a32))
* **table:** overhaul card animations and layout with GSAP physics ([515b3a0](https://github.com/PPO-GG/unfit-for-print/commit/515b3a0be79bc758283998f13f10d734f29c490a))
* **ui:** overhaul global UI — header, footer, homepage, profile, and error pages ([192cbe6](https://github.com/PPO-GG/unfit-for-print/commit/192cbe6d1ed857ae3ca2da85b6064812a55937c1))


### 🐛 Bug Fixes

* **api:** harden api endpoints and improve team fetching using labels ([5a6196b](https://github.com/PPO-GG/unfit-for-print/commit/5a6196b897a2e857dd7461c82e3ea2a5f4728edd))
* **bot:** bot orchestrator ([40abb5a](https://github.com/PPO-GG/unfit-for-print/commit/40abb5a35ad7ff4704232a79d1b97e666445b45e))
* **bots:** resolve bots not playing cards after watcher refactor ([342c936](https://github.com/PPO-GG/unfit-for-print/commit/342c936c1d9faa5c8a78532c853cac08d33608f6))
* **game:** delay game-over screen to allow winning card celebration to complete ([5a7dc5d](https://github.com/PPO-GG/unfit-for-print/commit/5a7dc5d36dc675d861bd3bf4931a4a819432ca57))
* **game:** hide placeholder card animation snap to correct drop coordinates ([eec86d6](https://github.com/PPO-GG/unfit-for-print/commit/eec86d61ed9ac82598863cc0dd2db65d471301ff))
* **lobby:** auto-delete lobby when last human player leaves ([a380a0e](https://github.com/PPO-GG/unfit-for-print/commit/a380a0e71c2ce2a8cded31172d135a2a3da03248))
* **security:** migrate bot & reveal-card auth from body-based to session-based ([69934bb](https://github.com/PPO-GG/unfit-for-print/commit/69934bbdaaa582bb7ebf4f0e14c1c68003270175))


### ♻️ Refactors

* **client:** migrate client-side composables and utils to TablesDB SDK ([809e609](https://github.com/PPO-GG/unfit-for-print/commit/809e609d34966ad0f4047e14b1dd49ee6f513e1f))
* **server:** migrate all server-side API calls to Appwrite TablesDB SDK ([3f507f5](https://github.com/PPO-GG/unfit-for-print/commit/3f507f50451808702bc170ea559754418e3da70d))

## [2.3.0](https://github.com/PPO-GG/unfit-for-print/compare/v2.2.0...v2.3.0) (2026-02-22)


### ✨ Features

* **game:** add card play mode preferences with click, instant, and gesture submission ([6daa365](https://github.com/PPO-GG/unfit-for-print/commit/6daa365ef80d06354df467427c09741813f4d96a))


### 🐛 Bug Fixes

* **auth:** improve Discord OAuth error logging with status codes and request host ([522d97e](https://github.com/PPO-GG/unfit-for-print/commit/522d97ec4ff46332d7cb9c9ce152f09f25040c99))
* **build:** enable wasm compatibility ([2a1f018](https://github.com/PPO-GG/unfit-for-print/commit/2a1f01884bde6e0a734fbdbb2e18ec1d16d464c7))
* **og-image:** migrate from custom Nitro endpoint to native nuxt-og-image component ([f07ee51](https://github.com/PPO-GG/unfit-for-print/commit/f07ee510e8eb64997807a4a2eedeeaebe2a85560))
* **web:** remove nuxt-og-image to resolve Cloudflare Pages build error ([4b25a25](https://github.com/PPO-GG/unfit-for-print/commit/4b25a25647c8f8fa8dd32f6d680e7b1c35307897))

## [2.2.0](https://github.com/PPO-GG/unfit-for-print/compare/v2.1.2...v2.2.0) (2026-02-21)


### ✨ Features

* **api:** add server-side chat endpoints with rate limiting ([029fdc2](https://github.com/PPO-GG/unfit-for-print/commit/029fdc254cff90a85308c66350a8f92b643b1415))
* **api:** add server-side player verification utility ([38552d4](https://github.com/PPO-GG/unfit-for-print/commit/38552d41cddeb269a22e96340df41e5fbbfac65d))
* **api:** add synchronized card reveal endpoint for judging phase ([bcce143](https://github.com/PPO-GG/unfit-for-print/commit/bcce14343cd51f98de017787b22abb38f4c423fd))
* **game:** add bot player system with host-controlled AI ([56ac6b0](https://github.com/PPO-GG/unfit-for-print/commit/56ac6b0278d0a86276f821fce7e4f530af685e47))
* **game:** add centralized SFX registry and card fly-coordinate composable ([90cd65e](https://github.com/PPO-GG/unfit-for-print/commit/90cd65e5b1149034c105c27eb412316327f5f48c))
* **game:** redesign game board with immersive table layout and physics-based card animations ([b9481fe](https://github.com/PPO-GG/unfit-for-print/commit/b9481fe2c8910bdc22997385444f68c8338eecf6))


### 🐛 Bug Fixes

* **api:** simplify Discord OAuth to use SDK method directly ([b39b0a7](https://github.com/PPO-GG/unfit-for-print/commit/b39b0a7d908ed2db8ee156cf2310aad8d5f5bc86))


### ♻️ Refactors

* **api:** migrate game endpoints to body-based userId verification ([042b1a3](https://github.com/PPO-GG/unfit-for-print/commit/042b1a3069c05dba2475851cd8660f13e81950c1))

## [2.1.2](https://github.com/PPO-GG/unfit-for-print/compare/v2.1.1...v2.1.2) (2026-02-20)


### 🐛 Bug Fixes

* **auth:** bypass node-appwrite fetch to prevent invalid redirect error on Netlify ([48241f8](https://github.com/PPO-GG/unfit-for-print/commit/48241f825426da5e04e61639873da35a72d6911c))

## [2.1.1](https://github.com/PPO-GG/unfit-for-print/compare/v2.1.0...v2.1.1) (2026-02-20)


### 🐛 Bug Fixes

* **auth:** dynamically compute base url for oauth success redirect ([881215e](https://github.com/PPO-GG/unfit-for-print/commit/881215e2aeaadc820b0fb07d6d85c36ae8d4d7d5))
* **web:** comment out ShareImage component on home page ([e2cabac](https://github.com/PPO-GG/unfit-for-print/commit/e2cabac2c76793f1c479b1a23e2232dca6893ddd))

## [2.1.0](https://github.com/PPO-GG/unfit-for-print/compare/v2.0.1...v2.1.0) (2026-02-20)

### ✨ Features

- **api:** migrate spectator conversion to secure server endpoint ([900148c](https://github.com/PPO-GG/unfit-for-print/commit/900148c9751e7ad1c83bdcf4ae8051010d7721b2))
- **api:** secure game endpoints with session and lobby validation ([b3ac7e8](https://github.com/PPO-GG/unfit-for-print/commit/b3ac7e834a1d8355d9a8566e2e452ea26bf9a776))

### 🐛 Bug Fixes

- **oauth:** correct base_url environment variable priority and ensure https ([a93adfa](https://github.com/PPO-GG/unfit-for-print/commit/a93adfaec0ac1b02fb8bfc9024bb64ca66d148da))

### ♻️ Refactors

- **game:** remove unused playedCards and centralize round timer ([b924881](https://github.com/PPO-GG/unfit-for-print/commit/b9248817148267cd05a1ce874ddf256b1abfaac1))

## [2.0.1](https://github.com/PPO-GG/unfit-for-print/compare/v2.0.0...v2.0.1) (2026-02-20)

### 🐛 Bug Fixes

- replace local nuxt-appwrite file reference with GitHub source ([155d551](https://github.com/PPO-GG/unfit-for-print/commit/155d551f26e6853767b71a55c518247b7ce7079f))

## [2.0.0](https://github.com/PPO-GG/unfit-for-print/compare/v1.5.0...v2.0.0) (2026-02-20)

### ⚠ BREAKING CHANGES

- migrate to Nuxt 4 and replace Appwrite functions with Nitro API routes ([#65](https://github.com/PPO-GG/unfit-for-print/issues/65))

### ✨ Features

- add homepage share button ([#55](https://github.com/PPO-GG/unfit-for-print/issues/55)) ([cb9c9ab](https://github.com/PPO-GG/unfit-for-print/commit/cb9c9ab057f75f60b36828184e9f1437702ffb19))
- migrate to Nuxt 4 and replace Appwrite functions with Nitro API routes ([#65](https://github.com/PPO-GG/unfit-for-print/issues/65)) ([a91a0a2](https://github.com/PPO-GG/unfit-for-print/commit/a91a0a26a432321e384d882a243395ce882c29fd))

### 🐛 Bug Fixes

- add player leave handling and skip unresponsive players ([de07fe3](https://github.com/PPO-GG/unfit-for-print/commit/de07fe3dc0c87fa6dd04d982e898ab0da9cdfe1f))
- improve join flow with unique username validation and notification dedup ([e300a7b](https://github.com/PPO-GG/unfit-for-print/commit/e300a7b2cf11eb523d9115e076130731dfa3f2fc))
- resolve TypeScript errors and apply code formatting across components ([a9e13d0](https://github.com/PPO-GG/unfit-for-print/commit/a9e13d0d85663078590dce38a3fff4e212f163dc))

### ♻️ Refactors

- **admin:** extract CardManager into sub-components with composables ([43f6097](https://github.com/PPO-GG/unfit-for-print/commit/43f6097973a09400f49574ce178b60e7033e4a51))
- centralize Appwrite client initialization for SSR safety ([21a6247](https://github.com/PPO-GG/unfit-for-print/commit/21a624760867d07cb17b56284068bfced1fc532b))
- extract shared utilities and type definitions ([b688473](https://github.com/PPO-GG/unfit-for-print/commit/b68847396d671737a62dee54c2cccce68fcae6c3))
- **game:** extract composables from monolithic game page ([c8f0f32](https://github.com/PPO-GG/unfit-for-print/commit/c8f0f322d9c6cc336b6f28d77a90a2f865c9592c))
- remove dead game engine code and notification store ([84dfd56](https://github.com/PPO-GG/unfit-for-print/commit/84dfd56c7bcf3a6a08f1e7d110120e6fee1720ac))

## [1.5.0](https://github.com/PPO-GG/unfit-for-print/compare/v1.4.0...v1.5.0) (2025-06-25)

### Features

- add Rybbit analytics ([1215725](https://github.com/PPO-GG/unfit-for-print/commit/1215725450a81c50669dfb7a6e91fca0b721922e))

## [1.4.0](https://github.com/PPO-GG/unfit-for-print/compare/v1.3.0...v1.4.0) (2025-06-17)

### Features

- merge dev to main ([1e8afd6](https://github.com/PPO-GG/unfit-for-print/commit/1e8afd628b16efebd963afc679d0b39412946d51)), closes [#23](https://github.com/PPO-GG/unfit-for-print/issues/23) [#35](https://github.com/PPO-GG/unfit-for-print/issues/35) [#38](https://github.com/PPO-GG/unfit-for-print/issues/38) [#39](https://github.com/PPO-GG/unfit-for-print/issues/39) [#36](https://github.com/PPO-GG/unfit-for-print/issues/36) [#41](https://github.com/PPO-GG/unfit-for-print/issues/41) [#43](https://github.com/PPO-GG/unfit-for-print/issues/43)

## [1.3.0](https://github.com/PPO-GG/unfit-for-print/compare/v1.2.1...v1.3.0) (2025-06-07)

### Features

- implement browser tts with voice switcher ([6319562](https://github.com/PPO-GG/unfit-for-print/commit/6319562ecb2f494cd4722b345ddea666a6c6085d)), closes [#39](https://github.com/PPO-GG/unfit-for-print/issues/39) [#36](https://github.com/PPO-GG/unfit-for-print/issues/36) [#41](https://github.com/PPO-GG/unfit-for-print/issues/41)

## [1.2.1](https://github.com/PPO-GG/unfit-for-print/compare/v1.2.0...v1.2.1) (2025-06-04)

### Bug Fixes

- force version bump ([cf393c6](https://github.com/PPO-GG/unfit-for-print/commit/cf393c612fd23f8aca2e2766d0f82dc6a6e6bed9))
- hotfix for the content render ([b2223ca](https://github.com/PPO-GG/unfit-for-print/commit/b2223ca26ace1c8459ff2a739fc31ee7697a2f99))
- removed @nuxt/content from package to fix building ([d2f5b67](https://github.com/PPO-GG/unfit-for-print/commit/d2f5b675d1a62f41023d529a2dc7282ad831a8d7))
- replace nuxt-content with markdown-it to fix build error ([9da0b37](https://github.com/PPO-GG/unfit-for-print/commit/9da0b371942df280400f4c700c0dcaaac9f5cf64))
- replace nuxt-content with markdown-it to fix build error ([#33](https://github.com/PPO-GG/unfit-for-print/issues/33)) ([828b9ae](https://github.com/PPO-GG/unfit-for-print/commit/828b9aebd58b10800e6cd046a011b7609184bc84))

## [1.2.0](https://github.com/PPO-GG/unfit-for-print/compare/v1.1.0...v1.2.0) (2025-06-03)

### Bug Fixes

- force version bump ([bf23d50](https://github.com/PPO-GG/unfit-for-print/commit/bf23d50e7017a6985006b045c0a459546f756ed3))

### Features

- add localization, dynamic card packs, and UI updates ([ecd6826](https://github.com/PPO-GG/unfit-for-print/commit/ecd68263e3fdc7574b11b130d580ee215bce6405))
- add localization, dynamic card packs, and UI updates ([ba7aa4b](https://github.com/PPO-GG/unfit-for-print/commit/ba7aa4b11c2424e30d48cc2e18f42a2a4b55e899))

## [1.1.0](https://github.com/MyndPhreak/unfit-for-print/compare/v1.0.1...v1.1.0) (2025-05-17)

### Bug Fixes

- Fixed AppHeader.vue Home button to properly redirect to the homepage. ([98f066e](https://github.com/MyndPhreak/unfit-for-print/commit/98f066ed21e6dd9755a075260d2efba9f3e2622b))
- Fixed AppHeader.vue Home button to properly redirect to the homepage. ([e80799e](https://github.com/MyndPhreak/unfit-for-print/commit/e80799ea8aa2dfc860879ffa45c2d2929c3b79ba))
- force version bump ([82f249f](https://github.com/MyndPhreak/unfit-for-print/commit/82f249f7f84295588852e3e55c8ad44825fe3f32))
- force version bump 2 ([9e1d0b3](https://github.com/MyndPhreak/unfit-for-print/commit/9e1d0b32257aae90f076c79c12bc0ca9b4c4c97a))
- update versioning again to fix bug. ([c4e5de4](https://github.com/MyndPhreak/unfit-for-print/commit/c4e5de402a6cbc145f99b729c36d579a8916a27c))
- update versioning again, again. ([d17ef9b](https://github.com/MyndPhreak/unfit-for-print/commit/d17ef9b179c79b310853b0f3d219e24209d34f90))
- update versioning logic to dynamically fetch app version from package.json ([a079b4d](https://github.com/MyndPhreak/unfit-for-print/commit/a079b4dd124b6d4ab8f436e7fc368d305d205d0e))

### Features

- add `useGetPlayerName` composable, improve game UI/UX, and enhance card styling ([b2f0758](https://github.com/MyndPhreak/unfit-for-print/commit/b2f0758265d6d8f22da17f9091eb38a223d9d615))
- add `useGetPlayerName` composable, improve game UI/UX, and enhance card styling ([c9c9bc6](https://github.com/MyndPhreak/unfit-for-print/commit/c9c9bc67e1b74c497ef0140da84ead588ba2d962))
- add admin CardManager and clearOldUsers function ([9ec4df0](https://github.com/MyndPhreak/unfit-for-print/commit/9ec4df06c74782ee63b0484fe1a8374d7eb9aa46))
- add admin CardManager and clearOldUsers function ([097428c](https://github.com/MyndPhreak/unfit-for-print/commit/097428cbbcb634b389552d0f68a3bbdb2a4b17b1))
- enhance gameplay with document-based settings, Vitest setup, and GitHub Actions ([ebdc8e0](https://github.com/MyndPhreak/unfit-for-print/commit/ebdc8e00eaa63be5e830692b3ad313794cf829db))
- enhance player management, admin checks, and UI updates ([a8807fe](https://github.com/MyndPhreak/unfit-for-print/commit/a8807fe0b42d4f1cdb36bee0e4e3db0b3e361873))
- enhance player management, admin checks, and UI updates ([9c12597](https://github.com/MyndPhreak/unfit-for-print/commit/9c1259767bb225ab9e31e8134affab80a319f825))
- enhance UI components with loading skeletons and improve lobby creation form ([00c2988](https://github.com/MyndPhreak/unfit-for-print/commit/00c29888d3c33d849b07f992e668a6b49b8d3e38))
- enhance UI components with loading skeletons and improve lobby creation form ([06f7395](https://github.com/MyndPhreak/unfit-for-print/commit/06f73953d39f2682d237ce169fa74b264a4d5c73))
- implement game settings management and enhance chat functionality ([f7fc609](https://github.com/MyndPhreak/unfit-for-print/commit/f7fc609ffc06482592b059b4406d3f8d1ea577b9))
- implement game settings management and enhance chat functionality ([aefc91d](https://github.com/MyndPhreak/unfit-for-print/commit/aefc91dff02bbe9f3a6b4d6b71a9b42fab37f9d4))
- implement real-time game settings management and enhance player notifications ([ac78505](https://github.com/MyndPhreak/unfit-for-print/commit/ac78505da4ec2ef374640ba579c0db569c0c8fb3))
- implement real-time game settings management and enhance player notifications ([61f0b29](https://github.com/MyndPhreak/unfit-for-print/commit/61f0b29571b9fa2515e67607dcde68a9bf7c6bec))
- implement user and team management APIs, enhance card upload functionality, and improve UI components ([04260b7](https://github.com/MyndPhreak/unfit-for-print/commit/04260b76358025c467b1f5007c6cbaafe9767449))
- implement user and team management APIs, enhance card upload functionality, and improve UI components ([5be2700](https://github.com/MyndPhreak/unfit-for-print/commit/5be27000d00b255aaf2a250b806058185064ff62))
- update player leave notification and enhance cursor styles for interactive elements ([a9ce0db](https://github.com/MyndPhreak/unfit-for-print/commit/a9ce0db05739847e3afc6a3c95fa8d75ffaafa68))
- update player leave notification and enhance cursor styles for interactive elements ([1c4ee04](https://github.com/MyndPhreak/unfit-for-print/commit/1c4ee04398c1b9587bae67de8b27d1dda1287962))

## [1.0.1](https://git.ppo.gg/MYND/unfit-for-print/compare/v1.0.0...v1.0.1) (2025-05-14)

### Bug Fixes

- force version bump ([de79229](https://git.ppo.gg/MYND/unfit-for-print/commit/de792295b39f33b6c3d7431d7c6ccc9b106b0423))

## [1.0.0](https://git.ppo.gg/MYND/unfit-for-print/commits/v1.0.0) (2025-05-14)

### Features

- add Discord login functionality, enhance lobby joining process, and improve real-time player updates ([2039b98](https://git.ppo.gg/MYND/unfit-for-print/commit/2039b987a98c1e3b9f0cc64cb38f90583a06945c))
- add game actions composable, enhance lobby management, and improve UI responsiveness ([9a55589](https://git.ppo.gg/MYND/unfit-for-print/commit/9a555896af47efb3e40a8dd012632ff4ad9c8dfd))
- enable server-side rendering and add start script for production ([df34ebb](https://git.ppo.gg/MYND/unfit-for-print/commit/df34ebbdf56a08b690e1c0468a695464b62662eb))
- implement Google login functionality, enhance user session management, and improve avatar handling ([e4b0bb9](https://git.ppo.gg/MYND/unfit-for-print/commit/e4b0bb9eea33ee6ca72b404541720892c2ae94ac))
- refactor notifications to use toast system with enhanced options ([ef879db](https://git.ppo.gg/MYND/unfit-for-print/commit/ef879dbcd0e486635da50a9383780282b79ed180))
- update game functions and state management, rename judge to czarId, and enhance function configurations ([f475c9f](https://git.ppo.gg/MYND/unfit-for-print/commit/f475c9f957bf2f2dd30a5bea39dd5cd1b6554013))
- update game state interface, enhance join lobby functionality, and improve user session handling ([4747061](https://git.ppo.gg/MYND/unfit-for-print/commit/474706103418c639805ecf040ded3cfa4b93df7f))

## [0.9.2](///compare/v0.1.0...v0.9.2) (2025-05-13)

### Features

- add `useGetPlayerName` composable, improve game UI/UX, and enhance card styling c9c9bc6
- add admin CardManager and clearOldUsers function 097428c
- enhance player management, admin checks, and UI updates 9c12597
- enhance UI components with loading skeletons and improve lobby creation form 06f7395
- implement game settings management and enhance chat functionality aefc91d
- implement real-time game settings management and enhance player notifications 61f0b29
- implement user and team management APIs, enhance card upload functionality, and improve UI components 5be2700
- update player leave notification and enhance cursor styles for interactive elements 1c4ee04

### Bug Fixes

- Fixed AppHeader.vue Home button to properly redirect to the homepage. e80799e
