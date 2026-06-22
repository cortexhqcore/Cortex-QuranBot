# Cortex QuranBot 🕌

Cortex QuranBot is a production-grade, highly optimized Discord bot engineered to deliver a seamless, high-fidelity Quran listening experience. Built with a decentralized state-synchronized architecture, it supports live Islamic radio streams, automated Azkar reminders, precise localized prayer times, and advanced role-based controls.

Developed by **mgv-hub** and powered by the team at **Cortex HQ**, this bot is designed to handle thousands of servers with ultra-low latency, automated crash recovery, and high-performance Redis caching.

---

## 🚀 Key Features

- **Comprehensive Quran Playback:** Play all 114 surahs with 50+ verified high-fidelity reciters, featuring continuous play, dynamic pagination, and surah navigation.
- **Decentralized State Caching:** Powered by **Redis**, ensuring sub-millisecond guild state caching, enabling seamless sharding and stateless horizontal scaling.
- **High-Resilience Audio Engine:** Features a dynamic byte-range seek calculator and exponential-backoff retry mechanisms. If a stream fails, it automatically falls back to alternative active reciters or surahs to prevent silence.
- **Live Islamic Radio:** Stream 30+ verified Quranic radio stations with an automated background health checker that monitors link stability.
- **Automated Azkar Reminders:** Scheduled morning, evening, and general dhikr reminders with both visual templates and optional audio playback.
- **Global Prayer Times:** Multi-regional prayer schedules for 30+ major cities worldwide, featuring timezone awareness, calculation method settings, and Gregorian/Hijri date overlays.
- **Interactive Controls:** Dynamic button and select-menu control panel ([/تحكم]) with instant UI state rendering and internal embed caching to minimize API rate limit overhead.
-   - **Lavalink Audio Infrastructure:** Integrated **Lavalink** support for improved audio stability, lower voice connection overhead, better stream recovery, and optimized playback quality across large-scale deployments.

---

## 🛠️ Technology Stack

- **Runtime Environment:** Node.js v22 (Strictly required for voice stream compression compatibility)
- **Framework Library:** Discord.js v14
- **Database Tier:** Firebase Realtime Database (Cold persistence layer) & **Redis** (Hot state cache)
-   - **Audio Engine:** **Lavalink** (primary audio infrastructure), FFmpeg, Opus codecs, custom HLS/MP3 transcoders, and lightweight `@discordjs voice` helpers for voice connection utilities.
- **Task Scheduling:** High-precision cron tasks and concurrent queue semaphores (preventing CPU thread exhaustion)

---

## 📋 Slash Commands Reference

| Command              | Description                                                                                 | Permission Requirement         | Cooldown   |
| :------------------- | :------------------------------------------------------------------------------------------ | :----------------------------- | :--------- |
| **`/إعداد`**         | Automated setup creating a secure Quran category, text channel, and active voice channel.   | Administrator                  | 10 Seconds |
| **`/تحكم`**          | Spawns the interactive control panel with seek, pause, skip, and setting buttons.           | Configurable (Admins/Everyone) | 25 Seconds |
| **`/دخول`**          | Joins the pre-configured voice channel and initiates playback immediately.                  | Administrator / Configurable   | 5 Seconds  |
| **`/خروج`**          | Gracefully leaves the active voice channel and saves the current surah index/reciter state. | Administrator / Configurable   | 5 Seconds  |
| **`/دليل`**          | Displays a complete manual, command guide, and operational help.                            | Everyone                       | 15 Seconds |
| **`/مواقيت_الصلاة`** | Interactive menu to choose country/city and query current Gregorian/Hijri prayer times.     | Everyone                       | 50 Seconds |
| **`/مصادر`**         | Lists the official verified APIs, data sources, and audio stream providers.                 | Everyone                       | 10 Seconds |
| **`/سرعة`**          | Checks API response times, bot uptime, joined guild count, and active CPU/RAM usage.        | Everyone                       | 30 Seconds |

---

## ⚙️ Quick Installation & Setup

### 1. Prerequisite Checks

Cortex QuranBot requires **Node.js v22** and a running **Redis** server:

```bash
# Verify Node.js version
node -v # Expected output: v22.x.x

# Verify Redis connection
redis-cli ping # Expected output: PONG
```

### 2. Download and Dependency Hooking

Clone the repository to your environment and install packages using `pnpm`:

```bash
git clone https://github.com/cortexhqcore/Cortex-QuranBot.git
cd Cortex-QuranBot
pnpm install
```

### 3. Environment Variable Provisioning

Rename the example environment configurations:

```bash
# Windows command shell
ren .env.example .env
ren production.env.example production.env
ren development.env.example development.env
```

Open the newly renamed files (`production.env` or `development.env`) and configure:

- `DISCORD_TOKEN`: Your bot application credential from the Discord Developer Portal.
- `CLIENT_ID`: The unique client snowflake ID of your bot application.
- `REDIS_URL`: Endpoint for your Redis database cache (e.g., `redis://localhost:6379`).
- Firebase Admin SDK service credentials (`FIREBASE_ADMIN_PRIVATE_KEY`, etc.).

### 4. Running the Bot

Launch the bot with dynamic warnings and source mapping:

```bash
# Production Launch
NODE_ENV=production pnpm run start

# Development Watcher
NODE_ENV=development pnpm run dev
```

---

## 🔒 Security & Scaling Best Practices

- **Stateless Scaling:** Using Redis to cache runtime voice connections and guild states ensures that your bot can scale to multiple gateway shards without losing track of player states.
- **Database Isolation:** Firebase Realtime Database rules should be set to deny public reading/writing (`.read: false`, `.write: false`). The bot uses authenticated `firebase-admin` service accounts, allowing secure server-side queries that bypass client-side restrictions.
- **Spawning Semaphores:** The bot automatically limits concurrent audio stream generation via a semaphore (`maxConcurrent: 3` by default) to keep CPU loads predictable and prevent thread lockouts.

---

## 👥 Contributors & Support

Cortex QuranBot is created and maintained by **mgv-hub** and is backed by the team at **Cortex HQ**.

- **Official Support Server:** Join our Discord for assistance, feature suggestions, and status updates: [Discord Support](https://discord.gg/DwtAPzrbZS)
- **Home Website:** Explore details and landing features: [Cortex Quran Portal](https://quran.cortexhq.net)
- **GitHub Repository:** View source and open pull requests: [Cortex-QuranBot Repo](https://github.com/cortexhqcore/Cortex-QuranBot)

---

> نسأل الله أن يكون هذا العمل خالصاً لوجهه الكريم، وأن ينفع به الجميع، وأن يجعلنا وإياكم من الذين يستمعون القول فيتبعون أحسنه.
