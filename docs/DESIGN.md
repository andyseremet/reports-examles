# Design

The look, the wording and how controls behave. Read this before any change the user can see, on screen or in print.

## Words

- Plain English, short sentences. Explain any technical term with `term()`.
- Rate topics only with the five labels in `STATUS_LABEL`.

## Visual style (owner, 7 November 2026)

Clean, uncrowded and elegant, in a calm Apple-like style. Use it for every visual change, on screen and in print:

- **Type:** the system font (`-apple-system`, then Helvetica, then Arial); one text size per block; semibold headings
  with slightly tight letter spacing; muted grey (`#6e6e73`/`#86868b`) for labels, dates and captions.
- **Lines and panels:** thin hairline borders (`#d2d2d7`/`#e5e5ea`), rounded corners (10–14 px), white cards, soft grey
  panels (`#f5f5f7`) only where they group something. No heavy borders, boxes inside boxes, or shadows on paper.
- **Space:** generous white space between cards and before sections; never crowd a page to save space.
- **Less is more:** show only what the reader needs; move detail (sources, dates, long links) to one place at the end.
- **One accent colour** (owner, 8 November 2026): a calm blue (`--link`/`--accent-bg`, `#0066cc`) for links, the
  active tab and the one filled button ("Check this property"); buttons inside the report are quiet grey. Icons are
  thin line drawings (`ICON_PATHS`, `TOPIC_ICONS`), never emoji, except the two problem ratings' symbols.
- **Colour with meaning only:** a thin coloured accent per rating, always with its symbol (and a border pattern in
  print), so it still reads without colour.

## Interface habits

- Buttons show an icon and a word; never an icon alone (a first-time user may not know the icon). One exception
  (owner, 8 November 2026): the share and printer icons beside the Summary heading stand alone, with a tooltip and a
  spoken name (`aria-label`).
- Undo, not "Are you sure?": an action that deletes something offers Undo for about 10 seconds.
- Short messages ("Saved ✓", "Copied", "Removed …") sit in a `role="status"` or `aria-live="polite"` element.
- A control's spoken name (`aria-label`) starts with its visible words (WCAG 2.5.3, voice control).
- **On a phone** (wording and phone review, 2.3.4): nothing floats over the report. The tab bar's Summary goes back
  to the top, so the round Back to top button shows only on bigger screens. Technical details a buyer does not need on
  a small screen (the pin's map coordinates) show on bigger screens and on paper only.
- **Abbreviations:** write them out in text people read (the Office for National Statistics, not ONS). A dataset's own
  name may follow in brackets in a source line, for example "the Department for Transport's list of stops, NaPTAN".
- **Sticky bars:** focus and in-page jumps land clear of them (`scroll-margin`, `--sticky-top`/`--bottom-clear` in
  `css/app.css`). Never use `html { scroll-padding }`: it stops the section bar's smooth scroll.

After a visual change, run the accessibility re-check (`docs/TESTING.md`).
