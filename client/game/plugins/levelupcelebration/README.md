# Level-up celebration

A client-side celebration whenever a skill's real level goes up, on top of the game's own
fireworks and chat message:

- **Confetti** fired up and in from both bottom corners of the screen, fluttering back down.
- **A popup** in the middle of the game view: the skill's icon, "LEVEL UP!" in the game's large
  quill capitals, and the skill and level under it. The title pops in, the skill grows in after.
- **Sun rays** behind the popup: the view darkens around it, with slowly turning rays of light.

It draws over everything but has no menu entries and can't be moved, so clicks go straight
through it. Several level-ups at once (Hitpoints and Attack from one hit) show one after another.
Logging in or hopping only records your levels, so it never fires for them.

It is on by default. Settings: each of the three parts on or off, how long each level-up shows
(3 seconds), the popup's size, and how much confetti each corner fires.

Files: `levelUpCelebration.ts` (level tracking, the timeline and the confetti physics, with no
drawing), `LevelUpCelebrationOverlay.ts` (the drawing), `LevelUpCelebrationPlugin.ts`, and the
test `client/tests/level-up-celebration.test.ts`.
