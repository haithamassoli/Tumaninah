# Fonts

The app ships IBM Plex Sans Arabic locally (no network fetch). Drop the
following `.woff2` files into this directory, then uncomment the
`@import "./fonts.css";` line at the top of
`src/renderer/styles/global.css`:

- `IBMPlexSansArabic-Light.woff2` (300)
- `IBMPlexSansArabic-Regular.woff2` (400)
- `IBMPlexSansArabic-Medium.woff2` (500)
- `IBMPlexSansArabic-SemiBold.woff2` (600)

Source: https://github.com/IBM/plex/tree/master/IBM-Plex-Sans-Arabic/fonts/complete/woff2

The OFL license file should also be vendored alongside per the PRD's
About-tab font credit.
