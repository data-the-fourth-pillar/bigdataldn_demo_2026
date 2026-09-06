interface NamedEntity {
    id: string;
    name: string;
    metadata?: Record<string, unknown>;
}

function maskAllOccurrences(text: string, needle: string): { found: boolean; text: string } {
    let found = false;
    let idx = text.indexOf(needle);
    while (idx !== -1) {
        found = true;
        text = text.slice(0, idx) + ' '.repeat(needle.length) + text.slice(idx + needle.length);
        idx = text.indexOf(needle);
    }
    return { found, text };
}

/**
 * Narrows a set of retrieved entity IDs down to the ones actually named in the
 * answer text (checked against both the reasoning trace and the final answer,
 * since the reasoning trace often explicitly says "I am drawing on X and Y").
 *
 * Matches longest-name-first with masking — the same technique used in the
 * backend's _extract_named_entities — so a short name (e.g. "Beauty") can't
 * match inside a longer sent entity's name that's already been claimed (e.g.
 * "Central Beauty Hub"). Every occurrence of a matched name is masked, not just
 * the first — a name repeated later in the answer must not leave a dangling
 * un-masked instance for a shorter name to match inside.
 *
 * data_product entities get a second check beyond their own name: whether any
 * of their table's actual cell values appear in the answer. A response can use
 * a table's numbers (e.g. "500K orders", "Next Day") without ever naming the
 * data product itself in prose — matching only on the entity's name would
 * incorrectly drop it from "cited" even though its data was genuinely used.
 *
 * Falls back to the full retrieved set if the text-match heuristic finds
 * nothing cited (e.g. the answer paraphrased instead of naming entities
 * verbatim), so callers never render an empty/confusing panel.
 */
export function getCitedEntityIds(
    entityIds: string[],
    answerText: string,
    entities: NamedEntity[],
): { citedIds: string[]; isFiltered: boolean } {
    let masked = answerText.toLowerCase();
    const entityMap = new Map(entities.map(e => [e.id, e]));
    const sentEntities = entityIds
        .map(id => entityMap.get(id))
        .filter((e): e is NamedEntity => !!e)
        .sort((a, b) => b.name.length - a.name.length);

    const citedSet = new Set<string>();
    for (const entity of sentEntities) {
        const { found, text } = maskAllOccurrences(masked, entity.name.toLowerCase());
        if (found) {
            citedSet.add(entity.id);
            masked = text;
        }
    }

    // Second pass: data products whose name was never mentioned, but whose
    // table values were. Checked after all name-matching above so a cell value
    // that happens to equal another entity's name (e.g. a node name in a
    // "Node" column) doesn't get double-counted against already-masked text.
    for (const entity of sentEntities) {
        if (citedSet.has(entity.id)) continue;
        const table = entity.metadata?.tabular_data as { rows?: unknown[][] } | undefined;
        const rows: unknown[][] = table?.rows ?? [];
        const hasCellHit = rows.some(row =>
            row.some(cell => {
                const cellStr = String(cell).toLowerCase().trim();
                return cellStr.length >= 4 && masked.includes(cellStr);
            })
        );
        if (hasCellHit) citedSet.add(entity.id);
    }

    const cited = entityIds.filter(id => citedSet.has(id));
    return {
        citedIds: cited.length > 0 ? cited : entityIds,
        isFiltered: cited.length > 0 && cited.length < entityIds.length,
    };
}
