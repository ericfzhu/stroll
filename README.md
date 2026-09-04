# Stroll

An interactive procedural flower meadow built with React, Three.js, and React Three Fiber.

- `/` is the presentation version of **A Stroll Through the Meadow**. It uses current Sydney weather from OpenWeather.
- `/demo` exposes the camera, weather, lighting, wind, chunk, and performance controls.

## Local development

Requirements: Node.js 22 and Yarn 3.6.3.

```sh
corepack enable
yarn install
cp .dev.vars.example .dev.vars
yarn dev
```

Set `OPENWEATHERMAP_API_KEY` in `.dev.vars`. The Vite frontend runs at `http://127.0.0.1:8788`; the local Cloudflare Worker runs at `http://127.0.0.1:8789` and is proxied automatically.

## Checks

```sh
yarn lint
yarn test
yarn build
```

## Cloudflare Workers

Authenticate once, configure the weather API secret, then deploy the Worker and its static assets:

```sh
yarn wrangler login
yarn wrangler secret put OPENWEATHERMAP_API_KEY
yarn deploy
```

`yarn deploy` builds the Vite app and publishes `dist` with `worker/index.ts`. The Worker handles `/api/weather` and serves the React app for all other routes.

## Attribution

The procedural terrain began from Misha Kiiatkin's MIT-licensed infinite-terrain work. Its license is preserved at `public/assets/flower-field/infinite-terrain/LICENSE.txt`.
