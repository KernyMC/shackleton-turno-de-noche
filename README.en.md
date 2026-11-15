# Shackleton: Night Shift

[Español](README.md) · **English**

A web game where you run the first human base at the Moon's south pole for 30 days. You touch a
**living 3D model** of the base and decide every day which module gets energy: air and water,
food, radiation shielding or the workshop. You survive the lunar night and **real** solar storms,
and at the end the game explains what happened and how a real mission handles it.

**Play:** https://shackleton-turno-de-noche.vercel.app (browser, no account, no download; works on phones and offline once loaded).

Team **Halo Sur** · NASA Space Apps Challenge 2026 · Sangolquí, Ecuador (ESPE).
Challenge: *Build a Junior Astronaut Mission Trainer*. Audience: kids aged 7 to 12. Spanish and English.

> Independent project. Not affiliated with or endorsed by NASA. The story is fiction; the Moon and Sun data are real.

## What it teaches

| A real mission trade-off | How you play it |
|---|---|
| Energy is limited and must be shared | Every day you split the energy from the Sun and the battery among four modules |
| The south-pole lunar night lasts for days | Six days without Sun: you only have what you saved before |
| Solar storms force a choice | Shelter (little radiation, production stops) or keep working (more radiation) |
| Things break and lunar dust gets everywhere | Breakdowns and dusty panels: fixing today costs energy; waiting costs production |
| Communications matter | With the antenna powered, the storm warning arrives 2 days earlier |

The game is split into **5 acts** that unlock the mechanics one at a time, and every event offers
**two valid options with different costs**: no choice is free.

## How it plays

1. **Comic-strip story** (5 panels, skippable): the year 2048, Shackleton crater, the crew, and the storm that cuts off communication. It is labelled "Fiction story · real data".
2. **Three modes**: *Tutorial* (5 guided days; the screen dims and only what you must tap stays lit), *Cadet* (room to learn) and *Commander* (the full challenge).
3. **Every day**: you share out energy with blocks, see at once how each resource will change, and play the day. The crew reacts with faces: happy, calm, worried or scared.
4. **Ten challenges** spread over the 30 days (table below). Each one starts with an animated demo of how to play; the clock does not run until you begin.
5. **Ending**: hold out until day 30 and the relief ship arrives. If not, the mission is aborted and the game explains what happened and how a real mission would handle it.

On the title screen, the **Minigames** button opens the ten challenges on their own, with no game in progress and no rewards, to practise or to show them.

### The ten challenges

| Day | Challenge | What you do | What it leaves |
|---|---|---|---|
| 2 | Rover to the ice | Drive the rover to the ice and back, choosing between sunlit and shaded squares | The Sun gives energy but brings radiation; shade protects but drains the battery |
| 4 | Space weather antennas | Tune the antennas until your wave matches the signal | With good antennas the storm warning arrives earlier |
| 6 | Leaks in the tunnels | Find three leaks using the detector's clues | With no leaks, the air stays inside |
| 8 | Cables to the beacons | Join three pairs of connectors without crossing cables | Plan the path before you start |
| 12 | Robotic arm | Turn shoulder and elbow to pick up a sample without touching rocks | Robotic arms work outside so nobody has to go out |
| 14 | Crew check-up | Give the right care to whoever needs it | On a mission, everyone's health is watched |
| 16 | Regolith wall | Collect regolith piles and build the wall brick by brick | A thick layer of regolith slows radiation |
| 18 | Micrometeorite shower | Turn the shield to where the radar warns | Several thin layers stop a grain better than one thick layer |
| 24 | Great solar storm | Decide what to switch off and place the shelter wall | Saving power in time protects the crew |
| 30 | The relief ship arrives | Lock the four bars for docking | Docking is done slowly and as a team |

The challenges are **game fiction**: their rewards and penalties are design decisions
(`public/data/challenges.json`, status `game_balance`). The science fact shown with each one links
to its source in the "Where does the data come from?" panel.

## NASA and partner-agency data

The game shows its sources in-game, in the **"Where does the data come from?"** panel (title
screen and top bar), which reads `public/data/sources.json`. Every item carries a status:
**real data**, **simulated** or **game design decision**.

| Dataset | What it does in the game | Status | Link |
|---|---|---|---|
| **NASA DONKI** (Space Weather Database Of Notifications, Knowledge, Information) | The game's storms are real events (coronal mass ejections and solar energetic particles). If the Sun is active today, the first storm is this week's real event (proxy `/api/spaceweather`) | Real data | [ccmc.gsfc.nasa.gov/tools/DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/) |
| **RadLab** (OSDR Radiation Dosimetry Database) | Real doses measured on the International Space Station (Lidal instrument, April 2022), to compare with the game's radiation | Real data | [visualization.osdr.nasa.gov/radlab](https://visualization.osdr.nasa.gov/radlab/gui/data-api/) |
| **NASA OSDR** (Open Science Data Repository) | "Real science" card at the end: studies on radiation, muscle and bone, and crops on the Space Station | Real data | [osdr.nasa.gov/bio/repo](https://osdr.nasa.gov/bio/repo/) |
| **Blue Marble: Next Generation** (NASA Earth Observatory) | The Earth seen in the lunar sky | Real data | [science.nasa.gov/…/blue-marble-next-generation](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry) |
| **CGI Moon Kit** (LOLA and LROC WAC, NASA SVS) | South-pole terrain relief and color, **only if the maps are installed** (`scripts/README-textures.md`). In the published demo the terrain is generated by code | Optional, not included in the demo | [svs.gsfc.nasa.gov/4720](https://svs.gsfc.nasa.gov/4720) |
| **NASA 3D Resources** | Visual reference for the lander and rover models, which the team modeled | Reference | [github.com/nasa/NASA-3D-Resources](https://github.com/nasa/NASA-3D-Resources) |
| **CSA — Food production** (Canadian Space Agency) | Facts about producing food on the Moon | Real data (partner agency) | [asc-csa.gc.ca](https://www.asc-csa.gc.ca/eng/youth-educators/toolkits/food-production/) |
| Storm level (1–4), dose, consumption and balance | Turning real events into playable rules | Game design decision (`DECISIONES.md`) | — |

**How the data is processed:** `npm run data:donki` downloads a year of DONKI events, normalizes
them (type, date, speed or class) and assigns a level from 1 to 4 by strength;
`npm run data:radlab` downloads and summarizes the RadLab doses. Results are stored as JSON in
`public/data/` so the game works offline. The engine (`src/sim`) picks, by seed, a real storm of
the level that fits each act, without changing its data.

## How it is built

- **Astro + Preact + TypeScript**, with **Three.js** for the 3D model.
- **Pure, deterministic game engine** (`src/sim`): same seed and same decisions give the same result. Covered by tests (Vitest) and a 1000-game simulation to measure balance (`npm run simulate`).
- **Own proxy** `/api/spaceweather` (Vercel function) for live space weather: the NASA key never reaches the browser and, if it fails, the game uses the stored data.
- **Adaptive quality**: lowers resolution and effects on slow devices.
- **Accessible**: everything can be done with the keyboard and from the panel (without 3D), state is never shown by color alone, and "reduce motion" is respected.
- **Built for little reading**: an animated demo before each challenge, drawings instead of labels, short sentences in Spanish and English.

```
src/sim/         game engine: rules, acts, events, fast-forward (with tests)
src/state/       store (signals): bridge between engine, interface and scene
src/scene/       3D model of the base (Three.js)
src/components/  interface (HUD, energy panel, events, crew, comic, challenges, ending)
src/i18n/        texts in Spanish and English
public/data/     balance and NASA data as JSON
api/             space-weather proxy (Vercel)
scripts/         data download and balance simulation
docs/            design (GDD), art, rubric and tasks (in Spanish)
```

## Run it

You need [Node.js](https://nodejs.org) 22 or newer.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:4321.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Engine and interface tests |
| `npm run check` | TypeScript types |
| `npm run build` | Static build in `dist/` |
| `npm run simulate` | Plays 1000 automatic games and prints the balance |
| `npm run data:donki` / `data:radlab` | Downloads real NASA data into `public/data/` |
| `npm run check:nasa` | Tests the space-weather proxy: API up, API down and offline |

Environment variables: copy `.env.example` to `.env` (never committed). `NASA_API_KEY` is
optional (free key from https://api.nasa.gov); without it the game uses the stored data.

## What comes next

Draft team roadmap, with no committed dates:

- Test it with more children aged 7 to 12 and tune the difficulty from what we observe.
- A short guide for teachers: which real mission trade-off each day and each challenge works on.
- Real south-pole terrain (CGI Moon Kit) included in the demo, not only as an option.
- More languages and an installable version that works offline from the first moment.

## Transparency

- **Use of AI:** declared in [AI_USAGE.md](AI_USAGE.md). The code was developed with AI assistance, directed and reviewed by the team.
- **Credits and sources:** [CREDITS.md](CREDITS.md). No NASA logos are used. The astronauts' 3D model is "Little Astronaut" by Jelle Vermandere (CC-BY 4.0), recolored.
- **What is data and what is not:** the storms, the reference doses and the photo of Earth are real. The terrain, the drawn crater, the clouds on Earth, the story and the balance numbers belong to the game.
- **Design decisions:** [DECISIONES.md](DECISIONES.md) (in Spanish).
- **License:** [MIT](LICENSE). Data and imagery from NASA and partner agencies keep their own terms.
