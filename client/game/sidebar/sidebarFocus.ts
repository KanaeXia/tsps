/**
 * A mouse press on a sidebar button leaves focus where it was (the game, or a chat or search
 * field), as RuneLite's Swing toolbar buttons aren't focusable. A focused HTML button takes Enter
 * (and Numpad Enter, also "Enter") and Space as another click, so the plugin icon clicked last
 * closed its panel, and the edge arrow hid the sidebar, when Enter sent a chat message.
 * Tab still reaches the buttons for keyboard use.
 */
export function keepFocus(event: { preventDefault(): void }): void {
    event.preventDefault();
}
