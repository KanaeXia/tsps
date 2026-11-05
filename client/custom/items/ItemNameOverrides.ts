/**
 * Names the server gives existing cache items (its item-overrides.json), sent at login as the
 * `itemNameOverrides` dataset: [{ id, name }]. The server already includes a renamed item's note
 * and bank placeholder. CustomObjTypeLoader shows these names in place of the cache's.
 */
class ItemNameOverridesImpl {
    private readonly names = new Map<number, string>();
    revision = 0;

    /** Replaces every name with these rows; malformed rows are skipped. */
    replace(rows: readonly unknown[]): void {
        this.names.clear();
        for (const row of rows) {
            const { id, name } = (row ?? {}) as { id?: unknown; name?: unknown };
            if (Number.isInteger(id) && (id as number) >= 0 && typeof name === "string" && name.trim() !== "") {
                this.names.set(id as number, name);
            }
        }
        this.revision++;
    }

    get(id: number): string | undefined {
        return this.names.get(id);
    }

    clear(): void {
        if (this.names.size === 0) return;
        this.names.clear();
        this.revision++;
    }
}

export const ItemNameOverrides = new ItemNameOverridesImpl();
