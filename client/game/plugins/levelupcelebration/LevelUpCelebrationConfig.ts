import { ConfigGroup, ConfigItem, ConfigSection } from "@runelite/client/config/ConfigItem";

const LEVEL_UP = "levelUp";
const XP_SPRITES = "xpSprites";

/** The group and keys are still the level-up celebration's, so saved settings carry over. */
export const LevelUpCelebrationConfig = ConfigGroup(
    "levelupcelebration",
    {
        showPopup: ConfigItem({
            name: "Show popup",
            description: "Shows \"LEVEL UP!\" with the skill and level in the middle of the game view.",
            position: 0,
            section: LEVEL_UP,
            default: true,
        }),
        showRays: ConfigItem({
            name: "Show sun rays",
            description: "Darkens the view around the popup with turning rays of light behind it.",
            position: 1,
            section: LEVEL_UP,
            default: true,
        }),
        showConfetti: ConfigItem({
            name: "Show confetti",
            description: "Fires confetti up from the bottom corners of the screen.",
            position: 2,
            section: LEVEL_UP,
            default: true,
        }),
        duration: ConfigItem({
            name: "Duration (seconds)",
            description: "How long each level-up shows. Several at once show one after another.",
            position: 3,
            section: LEVEL_UP,
            default: 3,
            range: { min: 1, max: 10 },
        }),
        popupScale: ConfigItem({
            name: "Popup size (%)",
            description: "The popup's size.",
            position: 4,
            section: LEVEL_UP,
            default: 100,
            range: { min: 50, max: 300 },
        }),
        confettiAmount: ConfigItem({
            name: "Confetti per corner",
            description: "How many pieces of confetti each corner fires.",
            position: 5,
            section: LEVEL_UP,
            default: 90,
            range: { min: 10, max: 300 },
        }),
        showXpSprites: ConfigItem({
            name: "Show XP sprites",
            description:
                "When you gain XP, the skill's icon bursts out of where the XP drop shows (the player or " +
                "target when Customizable XP drops attaches them there), then flies to the XP counter " +
                "(or the Customizable XP tracker) and pops.",
            position: 6,
            section: XP_SPRITES,
            default: true,
        }),
        xpSpriteAmount: ConfigItem({
            name: "XP sprite amount (%)",
            description: "How many sprites a drop makes; larger drops always make more.",
            position: 7,
            section: XP_SPRITES,
            default: 100,
            range: { min: 10, max: 300 },
        }),
    },
    {
        sections: {
            [LEVEL_UP]: ConfigSection({ name: "Level-up", position: 0 }),
            [XP_SPRITES]: ConfigSection({ name: "XP sprites", position: 1 }),
        },
    },
);
