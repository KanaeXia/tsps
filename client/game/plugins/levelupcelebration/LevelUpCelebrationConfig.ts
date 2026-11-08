import { ConfigGroup, ConfigItem } from "@runelite/client/config/ConfigItem";

export const LevelUpCelebrationConfig = ConfigGroup("levelupcelebration", {
    showPopup: ConfigItem({
        name: "Show popup",
        description: "Shows \"LEVEL UP!\" with the skill and level in the middle of the game view.",
        position: 0,
        default: true,
    }),
    showRays: ConfigItem({
        name: "Show sun rays",
        description: "Darkens the view around the popup with turning rays of light behind it.",
        position: 1,
        default: true,
    }),
    showConfetti: ConfigItem({
        name: "Show confetti",
        description: "Fires confetti up from the bottom corners of the screen.",
        position: 2,
        default: true,
    }),
    duration: ConfigItem({
        name: "Duration (seconds)",
        description: "How long each level-up shows. Several at once show one after another.",
        position: 3,
        default: 3,
        range: { min: 1, max: 10 },
    }),
    popupScale: ConfigItem({
        name: "Popup size (%)",
        description: "The popup's size.",
        position: 4,
        default: 100,
        range: { min: 50, max: 300 },
    }),
    confettiAmount: ConfigItem({
        name: "Confetti per corner",
        description: "How many pieces of confetti each corner fires.",
        position: 5,
        default: 90,
        range: { min: 10, max: 300 },
    }),
});
