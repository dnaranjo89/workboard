# Workboard

A small realtime board for tracking what is happening on three devboxes. The
frontend is Vite + React, the data layer is Convex, and the app is ready for
Vercel deployment.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start Convex and create or connect the project:

   ```bash
   npx convex dev
   ```

   Convex writes `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL` to `.env.local`.
   Do not commit that file.

3. Configure the private board access key in Convex:

   ```bash
   npx convex env set WORKBOARD_ACCESS_KEY
   ```

4. Run the frontend:

   ```bash
   npm run dev
   ```

## Vercel deployment

This repo includes `vercel.json` with the Convex-aware build settings:

- Framework preset: `Vite`
- Build command:
  `npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --cmd 'npm run build'`
- Output directory: `dist`

Set these environment variables in Vercel:

- `CONVEX_DEPLOY_KEY`: a Convex production deploy key

Set this environment variable in Convex production, not in Vercel:

- `WORKBOARD_ACCESS_KEY`: the private key you type into the app

`VITE_CONVEX_URL` is a public frontend value. The Convex deploy command provides
it during the Vercel build, so there is no need to store it manually in the repo.

## Security notes

- `.env`, `.env.local`, and `.vercel` are ignored by git.
- The app never hardcodes the board access key.
- Anyone who knows the deployed URL and the access key can view and edit the
  board. Rotate `WORKBOARD_ACCESS_KEY` from the Convex dashboard or CLI if it is
  shared accidentally.
