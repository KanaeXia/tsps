# Visual Metronome

A port of the RuneLite Plugin Hub plugin
[Visual Metronome](https://github.com/vincent0955/Visual-metronome) 1.5.5 by vincent0955
(BSD 2-Clause). It is off by default; turn it on in the plugin list.

A box that changes colour every game tick, for timing things like 3-tick fishing or prayer
flicking without sound:

- **The box** sits above the chatbox on the right. It cycles through 2 to 10 colours (**Number
  of Colors**), changing every tick, or every **Tick Count** ticks. **Show Metronome Tick
  Number** puts the tick (or, at a Tick Count of 1, the colour number) in it, sized to fit the
  box unless **Disable Font Size Scaling** is on.
- **Moving and resizing:** hold Alt and drag the box to move it, or drag its border to resize
  it. Alt + right-click puts it back in its corner at the Default Box Size (25).
- **True tile:** **Enable True Tile Overlay** outlines the tile the server has you on in the
  metronome colour. Its fill can follow the colour too, it can draw only the corners, and it
  can fade out after you stop moving.
- **Tick number over the player and by the mouse**, at the chosen font, size, colour, height
  and offsets.
- **Cycles 2 and 3:** two more counters with their own lengths and colours, shown over the
  player (left and right of the main number) and/or in their own boxes.
- **Hotkeys** to reset the cycle (to a chosen tick), show or hide everything, and raise or lower
  the Tick Count.

## Settings

As the plugin, config group `visualmetronome`, with the same keys and defaults, so settings
exported from RuneLite read the same. Box positions and sizes are saved like RuneLite's, under
`DefaultCycleVisualMetronomeOverlay`, `Cycle2VisualMetronomeOverlay` and
`Cycle3VisualMetronomeOverlay` in the `runelite` group.

## Differences from the plugin

- **No party sync.** The plugin can copy another player's tick count through RuneLite's party
  server; this client has no party, so those settings are left out.
- **Fonts.** This client draws overlay text with the cache's bitmap fonts, so **Font Type**
  offers RS Regular, RS Bold, RS Small and Verdana. Arial, Cambria, Rockwell, Segoe UI and Times
  New Roman aren't in the cache; a saved one reads as RS Regular. Sizes other than the font's
  own scale the bitmap, so very large numbers look blocky.
- **Hidden boxes take no space.** The plugin keeps an empty, invisible box in the corner for a
  cycle that is off; here a box that isn't shown isn't placed, so it doesn't push other overlays
  along.
- **Resizing leaves the corner.** A resized box keeps the edges you didn't drag where they were,
  so it stays put as if you had dragged it there, rather than staying snapped to its corner.
