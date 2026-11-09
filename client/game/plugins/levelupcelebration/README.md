# XP Fun Effects

Client-side effects for XP and levels, drawn over the game. Once called "Level-up celebration":
the folder, class names and saved settings keep that name, so nothing set before is lost.

## Level-up

Whenever a skill's real level goes up, on top of the game's own fireworks and chat message:

- **Confetti** fired up and in from both bottom corners of the screen, fluttering back down.
- **A popup** in the middle of the game view: the skill's icon, "LEVEL UP!" in the game's large
  quill capitals, and the skill and level under it. The title pops in, the skill grows in after.
- **Sun rays** behind the popup: the view darkens around it, with slowly turning rays of light.

Several level-ups at once (Hitpoints and Attack from one hit) show one after another.

## XP sprites

Whenever a skill gains XP, its icon bursts out of where the XP drop shows, falls back a little,
and then is pulled to the XP counter, where each one pops like a bubble. Larger drops make more
sprites (1 XP: 2, 100 XP: 10, 10,000 XP: 18, at most 40), times the amount setting.

Where they start follows the XP drop:

- With **Customizable XP drops** running and its drops on: over the player with "Attach to
  player", over the target (the player when there is none) with "Attach to target", both with
  its attach offsets; otherwise from its drop box, at the corner its directions start drops from.
- Otherwise from the game's own drop, or the bottom of the area those rise through.

Where they go: Customizable XP drops' XP tracker when "Use xp tracker" is on, else the game's
XP counter, else the top right of the game view.

## Settings

It is on by default. Level-up: each of the three parts on or off, how long each level-up shows
(3 seconds), the popup's size, and how much confetti each corner fires. XP sprites: on or off,
and the amount (100%).

It has no menu entries and can't be moved, so clicks go straight through it. Logging in or
hopping only records your levels and XP, so it never fires for them.

Files: `levelUpCelebration.ts` (level tracking, the timeline and the confetti physics),
`xpSprites.ts` (XP gains and the sprites' burst, pull and pop), neither with drawing;
`LevelUpCelebrationOverlay.ts` (the drawing), `LevelUpCelebrationPlugin.ts`, and the tests
`client/tests/level-up-celebration.test.ts` and `client/tests/xp-fun-effects-sprites.test.ts`.
Customizable XP drops tells it where a drop starts and where its tracker is (`dropOrigin`,
`trackerPoint`).
