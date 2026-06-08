Remove autoplay from the kiosk idle carousel and replace it with manual prev/next controls.

### Changes — `src/routes/index.tsx` (`IdleCarousel` only)
- Delete `import Autoplay from "embla-carousel-autoplay"` and the `useRef(Autoplay(...))` line.
- Remove the `plugins={[autoplay.current]}` prop from `<Carousel>`.
- Keep `opts={{ loop: true }}` so manual nav wraps.
- Add shadcn `CarouselPrevious` and `CarouselNext` inside `<Carousel>`, repositioned with `className` overrides (`left-6` / `right-6`, vertically centered, larger touch targets, accent-colored, semi-transparent) so they sit inside the visible iframe area instead of the default off-screen `-left-12` / `-right-12`.
- Hide both buttons when `images.length <= 1`.
- Keyboard arrow-left / arrow-right support is already provided by the shadcn Carousel wrapper — no extra code.

### Out of scope
Admin UI, server functions, `idle_images` table, mobile kiosk, video / PDF / top-bar behavior all unchanged. The `embla-carousel-autoplay` package stays in `package.json` (unused, harmless).

### Verification
Reload `/` with multiple idle images and nothing selected → the slide stays put until the user clicks the on-screen arrows or presses ArrowLeft / ArrowRight.