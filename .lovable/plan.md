Add two new categories — **"Past Events"** and **"Brand Building"** — that play uploaded video files full-screen in the kiosk's lower pane.

## Database
- Create a private storage bucket `event-videos` (shared by both new categories) with a public read policy on `storage.objects`. Admin uploads via the service role; kiosk plays via public URL.
- No `items` table change needed — `category` is free-text. New values: `"videos"` (Past Events) and `"brand"` (Brand Building). `items.url` stores the public MP4 URL; `favicon_url` stays null.

## Settings
- Add two new setting keys:
  - `label_videos` → default `"Past Events"`
  - `label_brand` → default `"Brand Building"`
- Update `src/lib/settings.functions.ts`: add both keys to `SettingKey`, `SETTING_KEYS`, `DEFAULTS`, and the `updateSetting` zod enum.

## Server functions (`src/lib/items.functions.ts`)
- Extend `ItemCategory` and `categorySchema` to include `"videos"` and `"brand"`.
- Add `uploadEventVideo` server fn: accepts `FormData` with a `file` field, validates MIME (`video/mp4`, `video/webm`, `video/quicktime`) and max size (~500 MB), uploads to `event-videos` with a uuid path, returns `{ publicUrl }`. Same fn is reused for both categories.
- Skip Google favicon derivation in `createItem` when category is `videos` or `brand`.

## Admin UI (`src/routes/admin.tsx`)
- Add `videos` and `brand` to `CATEGORY_KEYS`; map `videos → label_videos`, `brand → label_brand` in `CATEGORY_TO_SETTING`.
- When the active tab is a video category, replace the URL text input with a file picker. Submitting calls `uploadEventVideo`, then `createItem` with the returned URL and the user-typed label.
- Show upload pending state and inline errors.
- List rows for video items show a small "video" badge instead of a favicon.

## Kiosk UI (`src/routes/index.tsx`)
- Add `videos` and `brand` to `CATEGORY_LABELS`, sourced from the new settings.
- Add a video icon (lucide `Film`) for both in the dropdown.
- When the active item's category is `videos` or `brand`, render `<video src={url} controls autoPlay playsInline className="h-full w-full bg-black object-contain" />` instead of the iframe. Skip the "iframe blocked" fallback for these.

## Files touched
- supabase migration (new bucket + storage policy)
- `src/lib/settings.functions.ts`
- `src/lib/items.functions.ts`
- `src/routes/admin.tsx`
- `src/routes/index.tsx`

No new packages.