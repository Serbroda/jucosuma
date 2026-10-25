import {BillingPeriodCustom, BillingPeriodNone, type ContractDto} from "../gen/types.gen.ts";
import i18n from "../i18n";

function billingPeriodLabel(period: string | undefined | null): string {
    if (!period) return '';
    if (period === BillingPeriodNone) return i18n.t('periods.none');
    const key = `periods.${period}`;
    return i18n.exists(key) ? i18n.t(key as 'periods.monthly') : period;
}

/** Interval of an entry as text, including custom intervals ("Every 6 weeks"). */
function entryIntervalLabel(c: Pick<ContractDto, "billing_period" | "interval_count" | "interval_unit">): string {
    if (c.billing_period === BillingPeriodCustom && c.interval_count && c.interval_unit) {
        const key = `periods.every_${c.interval_unit}`;
        return i18n.exists(`${key}_other`) ? i18n.t(key as 'periods.every_days', {count: c.interval_count}) : '';
    }
    return billingPeriodLabel(c.billing_period);
}

function billingPeriodShorthand(period: string | undefined | null): string {
    if (!period || period === BillingPeriodNone) return '';
    const key = `periodsShort.${period}`;
    return i18n.exists(key) ? i18n.t(key as 'periodsShort.monthly') : '';
}

// fileToBase64.ts
export type FileToBase64Options = {
    /** Längste Kante in px. Wenn null/undefined oder keine Bilddatei: keine Skalierung. */
    resizeTo?: number | null;
    /** Zielformat für Canvas-Export (z. B. 'image/jpeg', 'image/png', 'image/webp'). Default: file.type */
    mimeType?: string;
    /** Qualität 0..1 (wirkt nur bei JPEG/WebP). */
    quality?: number;
    /** Nur den Base64-Teil zurückgeben (ohne "data:<mime>;base64,"). */
    stripPrefix?: boolean;
};

/**
 * Liest eine Datei als Base64-String. Optional: skaliert Bilder auf eine maximale Kantenlänge.
 * - Nicht-Bilder -> immer direkt als DataURL (keine Skalierung).
 * - Bilder -> optionales Resize per Canvas, Seitenverhältnis bleibt erhalten.
 */
 async function fileToBase64(
    file: File,
    opts: FileToBase64Options = {}
): Promise<string> {
    const { resizeTo, mimeType, quality, stripPrefix } = opts;

    const isImage = file.type.startsWith("image/");

    // Ohne Resize oder nicht-Bild: direkt als DataURL lesen
    if (!isImage || !resizeTo) {
        const dataUrl = await readAsDataURL(file);
        return stripPrefix ? dataUrl.split(",")[1] : dataUrl;
    }

    // Mit Resize: Bild laden -> Canvas -> DataURL
    const { dataUrl } = await resizeImageFile(file, resizeTo, mimeType, quality);
    const out = dataUrl; // falls du width/height brauchst, hier verfügbar
    return stripPrefix ? out.split(",")[1] : out;
}

/* ---------------- intern: Helfer ---------------- */

function readAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => (typeof fr.result === "string" ? resolve(fr.result) : reject(new Error("Unexpected result")));
        fr.onerror = () => reject(fr.error ?? new Error("FileReader error"));
        fr.readAsDataURL(file);
    });
}

function resizeImageFile(
    file: File,
    maxSize: number,
    toMime?: string,
    quality?: number
): Promise<{ width: number; height: number; dataUrl: string }> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            try {
                let { width, height } = img;
                if (width > height) {
                    if (width > maxSize) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }
                }

                const canvas = document.createElement("canvas");
                canvas.width = Math.round(width);
                canvas.height = Math.round(height);

                const ctx = canvas.getContext("2d");
                if (!ctx) throw new Error("Canvas context unavailable");
                // optional: leichte Qualitätsverbesserung
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                const mime = toMime || file.type || "image/png";
                const dataUrl = canvas.toDataURL(mime, quality);
                URL.revokeObjectURL(url);

                resolve({ width: canvas.width, height: canvas.height, dataUrl });
            } catch (e) {
                URL.revokeObjectURL(url);
                reject(e);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Image load error"));
        };
        img.src = url;
    });
}

export {billingPeriodLabel, billingPeriodShorthand, entryIntervalLabel, fileToBase64}
