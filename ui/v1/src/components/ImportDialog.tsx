import {useState} from "react";
import {Dialog, DialogActions, DialogBody, DialogTitle} from "./catalyst/dialog.tsx";
import {Button} from "./catalyst/button.tsx";
import {Input} from "./catalyst/input.tsx";
import {apiBasePath} from "../config.ts";
import {apiFetch} from "../lib/fetch.ts";
import {useNavigate} from "react-router";
import {useTranslation} from "react-i18next";
import {categoryLabel} from "../utils/household.utils.ts";

type ImportRow = {
    name: string;
    company: string;
    category: string;
    category_key?: string;
    start_date: string;
    error?: string;
};

/** Result of an import (or its preview); the JSON import also tells what it creates and reuses. */
type ImportResult = {
    rows?: ImportRow[];
    imported?: number;
    errors?: number;
    format_version?: number;
    app_version?: string;
    created?: Record<string, number>;
    reused?: Record<string, number>;
    closings?: number;
    skipped_closings?: number;
};

const KINDS = ["persons", "accounts", "categories", "goals", "contacts"];

/** What a JSON import creates and reuses, and where the file comes from. */
function ImportSummary({result, done}: { result: ImportResult; done?: boolean }) {
    const {t} = useTranslation();
    if (result.format_version == null) return null;
    const list = (counts?: Record<string, number>) => KINDS.filter((k) => counts?.[k])
        .map((k) => t(`import.kinds.${k}` as 'import.kinds.persons', {count: counts![k]})).join(", ");
    const created = list(result.created);
    const reused = list(result.reused);
    const closings = result.closings ?? 0, skipped = result.skipped_closings ?? 0;
    return (
        <div className="text-sm text-zinc-600 dark:text-zinc-300 mb-3 flex flex-col gap-1">
            {created && <div>{t(done ? 'import.created' : 'import.willCreate', {list: created})}</div>}
            {reused && <div>{t('import.reused', {list: reused})}</div>}
            {(closings > 0 || skipped > 0) && <div>{t(skipped > 0 ? 'import.closingsSkipped' : 'import.closings', {created: closings, skipped})}</div>}
            <div className="text-xs text-zinc-400 dark:text-zinc-500">
                {result.format_version < 2
                    ? t('import.legacyFormat')
                    : t('import.source', {version: result.app_version || "?", format: result.format_version})}
            </div>
        </div>
    );
}

export default function ImportDialog({isOpen, onClose}: { isOpen: boolean; onClose: () => void }) {
    const navigate = useNavigate();
    const {t} = useTranslation();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<ImportResult | null>(null);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const isJson = file?.name.endsWith('.json');

    const reset = () => {
        setFile(null);
        setPreview(null);
        setResult(null);
        setError('');
    };

    const handleClose = () => {
        const didImport = result && result.imported && result.imported > 0;
        reset();
        onClose();
        if (didImport) {
            navigate('/entries');
        }
    };

    const handlePreview = async () => {
        if (!file) return;
        setLoading(true);
        setError('');
        try {
            let res: Response;
            if (isJson) {
                const text = await file.text();
                res = await apiFetch(`${apiBasePath}/contracts/import.json?preview=true`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: text,
                });
            } else {
                const fd = new FormData();
                fd.append('file', file);
                res = await apiFetch(`${apiBasePath}/contracts/import?preview=true`, {
                    method: 'POST',
                    body: fd,
                });
            }
            if (!res.ok) {
                const err = await res.json().catch(() => ({message: t('import.previewFailed')}));
                throw new Error(err.message || t('import.previewFailed'));
            }
            setPreview(await res.json());
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        if (!file) return;
        setLoading(true);
        setError('');
        try {
            let res: Response;
            if (isJson) {
                const text = await file.text();
                res = await apiFetch(`${apiBasePath}/contracts/import.json`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: text,
                });
            } else {
                const fd = new FormData();
                fd.append('file', file);
                res = await apiFetch(`${apiBasePath}/contracts/import`, {
                    method: 'POST',
                    body: fd,
                });
            }
            if (!res.ok) {
                const err = await res.json().catch(() => ({message: t('import.importFailed')}));
                throw new Error(err.message || t('import.importFailed'));
            }
            setResult(await res.json());
            setPreview(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const rows = preview?.rows ?? [];

    return (
        <Dialog open={isOpen} onClose={handleClose}>
            <DialogTitle>{t('import.title')}</DialogTitle>
            <DialogBody>
                {error && (
                    <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400 mb-4">
                        {error}
                    </div>
                )}

                {result ? (
                    <div className="text-sm">
                        <ImportSummary result={result} done/>
                        <div className="text-green-600 dark:text-green-400 font-medium">
                            {t('import.imported', {count: result.imported ?? 0})}
                        </div>
                        {result.errors != null && result.errors > 0 && (
                            <div className="text-red-500 mt-1">{t('import.rowErrors', {count: result.errors})}</div>
                        )}
                    </div>
                ) : preview && rows.length > 0 ? (
                    <div>
                        <ImportSummary result={preview}/>
                        <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                            {t('import.rowsFound', {count: rows.length})}
                        </div>
                        <div className="max-h-64 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
                            <table className="w-full text-xs">
                                <thead className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0">
                                    <tr>
                                        <th className="text-left p-2">{t('common.name')}</th>
                                        <th className="text-left p-2 hidden sm:table-cell">{t('entryForm.company')}</th>
                                        <th className="text-left p-2 hidden sm:table-cell">{t('entry.category')}</th>
                                        <th className="text-left p-2">{t('import.status')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, i) => (
                                        <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                                            <td className="p-2 truncate max-w-[120px]">{row.name}</td>
                                            <td className="p-2 truncate max-w-[100px] hidden sm:table-cell">{row.company}</td>
                                            <td className="p-2 truncate max-w-[100px] hidden sm:table-cell">{categoryLabel(row.category, row.category_key)}</td>
                                            <td className="p-2">
                                                {row.error
                                                    ? <span className="text-red-500">{row.error}</span>
                                                    : <span className="text-green-500">OK</span>
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                            {t('import.upload')}
                        </p>
                        <Input
                            type="file"
                            accept=".csv,.json"
                            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        />
                    </div>
                )}
            </DialogBody>
            <DialogActions>
                {result ? (
                    <Button onClick={handleClose} className="hover:cursor-pointer">{t('common.close')}</Button>
                ) : preview ? (
                    <>
                        <Button outline onClick={() => setPreview(null)} className="hover:cursor-pointer">{t('common.back')}</Button>
                        <Button onClick={handleImport} disabled={loading} className="hover:cursor-pointer">
                            {loading ? t('import.importing') : t('import.import')}
                        </Button>
                    </>
                ) : (
                    <>
                        <Button plain onClick={handleClose} className="hover:cursor-pointer">{t('common.cancel')}</Button>
                        <Button onClick={handlePreview} disabled={loading || !file} className="hover:cursor-pointer">
                            {loading ? t('common.loading') : t('import.preview')}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
}
