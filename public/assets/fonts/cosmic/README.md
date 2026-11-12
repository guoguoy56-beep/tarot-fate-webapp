# Cosmic typography fonts

Noto Serif SC and Noto Sans SC WOFF2 subsets, retrieved on 2026-11-04 from the [Google Fonts CSS API](https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400..600&family=Noto+Serif+SC:wght@400..600&display=swap).

- Upstream projects: [Noto CJK](https://github.com/notofonts/noto-cjk), [Google Fonts Noto Serif SC](https://github.com/google/fonts/tree/main/ofl/notoserifsc), [Google Fonts Noto Sans SC](https://github.com/google/fonts/tree/main/ofl/notosanssc).
- License text is retained in `NotoSerifSC-OFL.txt` and `NotoSansSC-OFL.txt`; one upstream trailing space is removed.
- All 202 binary files are unmodified upstream WOFF2 files. Original URLs, sizes and SHA-256 hashes are retained in `SOURCES.json`.
- Each family contains 101 Unicode subsets. Total font binary size is 10,531,532 bytes; the browser selects subsets for the characters actually used.
- `src/components/cosmic-fonts.css` retains the upstream Unicode ranges, variable weight range 400–600, normal style and `font-display: swap`. Only the CSS family aliases (`Fate Serif`, `Fate Sans`) and source URLs are changed.
- The app serves these fonts locally. Neither the browser nor production build fetches fonts from Google. No `local()` source is used, so the selected faces do not depend on installed fonts.
- In the selected B direction, Serif is used for headings and prose; Sans is used for controls and compact labels. CSS aliases are scoped to the cosmic UI; the legacy UI retains its original font stacks.

The original font binaries have not been renamed internally or modified. CSS aliases are not new font software names.

## Selected-card numerals (2026-11-12)

`CinzelDecorative-Regular.ttf` is the unmodified 60,408-byte upstream regular face from [Google Fonts](https://github.com/google/fonts/blob/main/ofl/cinzeldecorative/CinzelDecorative-Regular.ttf). Its SIL Open Font License and reserved name are retained in `CinzelDecorative-OFL.txt` (one upstream trailing space removed). The original font name and binary remain unchanged.

The 1–5 outlines are now embedded as SVG paths in `src/lib/cosmic-card-marker.ts`, with the source font hash and attribution. Each outline is optically centered in a 20×20 viewBox. Markers render as siblings of the transformed cards, at their final screen-pixel dimensions; they do not magnify a small cached card layer. The former `Fate Numerals` runtime font face was removed; marker rendering needs no font or image request. The bundled font remains the licensed source for those outlines.
