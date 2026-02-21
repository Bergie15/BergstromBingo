# Custom Bingo (private-friendly static app)

A 5x5 bingo board you can host for free as static files, with explicit Edit/Save mode and optional shared realtime state.

## Features

- Edit wording only when you click **Enter Edit Mode**.
- Save wording via **Save Text Changes**.
- Click/tap square to toggle marked state (green) in play mode.
- Win detection for rows, columns, and diagonals.
- Fireworks animation when you hit bingo (5 in a row).
- Local persistence by default (`localStorage`).
- Optional Supabase sync so all viewers see updates in realtime.

## Run locally

```bash
python -m http.server 4173
```

Then open <http://localhost:4173>.

## Realtime shared setup (Supabase, free tier)

1. Create a Supabase project (free).
2. Run this SQL in Supabase SQL editor:

```sql
create table if not exists public.boards (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter publication supabase_realtime add table public.boards;
```

3. In **Project Settings → API**, copy:
   - Project URL
   - anon public key
4. Open `script.js` and set:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `BOARD_ID` (use same ID for everyone sharing one board)
5. Deploy static files to GitHub Pages / Netlify / Cloudflare Pages / Vercel.

## Private sharing options

- Keep URL unlisted and share only with your group.
- Add access control layer (Cloudflare Access, etc.) for invited users only.
