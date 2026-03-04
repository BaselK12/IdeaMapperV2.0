# V3 Foundation Setup

This repository now contains two frontend clients:

- `client/` = V2 (existing CRA app, unchanged)
- `client-v3/` = V3 (new Vite + React + TypeScript app)

## Prerequisites

- Node.js 18+ (Node.js 20+ recommended)
- npm 9+

## Environment Variables

Use the root `.env.example` as the source of truth for both apps:

- V2 (CRA): `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`
- V3 (Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Install Dependencies

Install dependencies in each app:

```bash
cd client
npm install

cd ../client-v3
npm install
```

You can also install from root if you want to use npm workspaces:

```bash
npm install
```

## Run V2 Locally

From root:

```bash
npm run dev:v2
```

Equivalent direct command:

```bash
cd client
npm start
```

## Run V3 Locally

From root:

```bash
npm run dev:v3
```

Equivalent direct command:

```bash
cd client-v3
npm run dev
```

## Build

From root:

```bash
npm run build:v2
npm run build:v3
```

Or directly:

```bash
cd client
npm run build

cd ../client-v3
npm run build
```
