# Custom Bingo (private-friendly static app)

A simple 5x5 bingo board you can host for free as static files.

## Features

- Editable text in each square.
- Click/tap square to toggle marked state (green).
- Win detection for rows, columns, and diagonals.
- Fireworks animation when you hit bingo (5 in a row).
- Local storage persistence for square text + marks.

## Run locally

```bash
python -m http.server 4173
```

Then open <http://localhost:4173>.

## Free hosting + sharing privately

You can deploy this as static files to GitHub Pages, Cloudflare Pages, Netlify, or Vercel.

For "private to a few people":

1. **Unlisted URL approach (simplest/free):**
   - Keep the repo private if your plan supports private Pages.
   - Share the direct URL only with your group.
2. **Password layer approach:**
   - Put it behind Cloudflare Access (free tier) or Netlify/Vercel auth, then invite only emails you trust.

If you want, this can be extended with shared real-time boards (so everyone sees the same clicks) using a free backend like Supabase.
