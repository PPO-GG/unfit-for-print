# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

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
