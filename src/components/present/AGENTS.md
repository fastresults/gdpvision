# /present briefing components

- **Briefing flow fit**: `/present` fits only the desktop Data & Decision Flow diagram on a fixed reference canvas; keep the reserved-space reading tray outside that transform and flush to the slide’s right edge so it remains readable and collapsible. Mobile keeps the native stacked flow.
- **Briefing viewer preload**: register every `/present` `LiveFrame` with `ViewerPreloadProvider`; mount each iframe eagerly once and report launched, loaded, sign-in and slow states separately so offscreen viewers preload without cold remounts.
