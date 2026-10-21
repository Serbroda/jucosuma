import type {CategoryDto} from "../../gen/types.gen.ts";
import {slotColor} from "../../lib/icons.ts";
import {categoryLabel} from "../../utils/household.utils.ts";

/** Category name in a neutral pill; the coloured dot carries the category identity. */
export default function CategoryBadge({categoryId, fallbackName, categories}: {
    categoryId?: number | null;
    fallbackName: string;
    categories: CategoryDto[];
}) {
    const category = categories.find((c) => c.id === categoryId);
    return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-zinc-700 dark:text-zinc-200 whitespace-nowrap">
            <span className="size-2 rounded-full" style={{background: slotColor(category?.color)}}/>
            {category ? categoryLabel(category.name, category.key) : fallbackName}
        </span>
    );
}
