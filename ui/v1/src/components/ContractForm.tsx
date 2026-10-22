import {
    BillingPeriodMonthly, BillingPeriodNone, BillingPeriodOneTime,
    EntryKindExpense, EntryKindIncome, EntryKindTransfer,
    type AccountDto, type CategoryDto, type CompanyDto, type ContractDto, type ContractHolderDto, type DocumentDto,
    type PersonDto, type SavingsGoalDto, type ShareDto
} from "../gen/types.gen.ts";
import {Description, Field, Label} from "./catalyst/fieldset.tsx";
import {Input} from "./catalyst/input.tsx";
import {Select} from "./catalyst/select.tsx";
import {Subheading} from "./catalyst/heading.tsx";
import {Button} from "./catalyst/button.tsx";
import {Form, useNavigate, useNavigation} from "react-router";
import {type ReactNode, useEffect, useRef, useState} from "react";
import {ErrorMessage} from "./catalyst/fieldset.tsx";
import {apiBasePath} from "../config.ts";
import {apiFetch} from "../lib/fetch.ts";
import {useAuth} from "../stores/useAuth.ts";
import {classNames} from "../utils/dom.utils.ts";
import {Textarea} from "./catalyst/textarea.tsx";
import dayjs from "../lib/dayjs";
import ConfirmDialog, {type ConfirmDialogProps} from "./dialogs/ConfirmDialog.tsx";
import ChooseIconDialog from "./dialogs/ChooseIconDialog.tsx";
import {CheckIcon, ChevronRightIcon, DocumentIcon, PencilIcon, XMarkIcon} from "@heroicons/react/16/solid";
import SharesEditor from "./SharesEditor.tsx";
import EarnerSelect from "./EarnerSelect.tsx";
import AmountHistory from "./AmountHistory.tsx";
import CostTypeControl from "./CostTypeControl.tsx";
import TransferTypeControl from "./TransferTypeControl.tsx";
import LinksEditor, {type EditableLink} from "./LinksEditor.tsx";
import {costOwner, defaultTransferType, earnerOfAccount, earnerShares, isSavingsAccount, type Pot} from "../utils/budget.utils.ts";
import EntryIcon from "./EntryIcon.tsx";
import IconButton from "./ui/IconButton.tsx";
import {categoryLabel, type CostType, costTypeOf, defaultCostType, sharesForAccount, entryKinds, entryPeriods} from "../utils/household.utils.ts";
import {billingPeriodLabel} from "../utils/data.utils.ts";
import {formatDecimal} from "../utils/number.utils.ts";
import {Combobox, ComboboxLabel, ComboboxOption} from "./catalyst/combobox.tsx";
import {useTranslation} from "react-i18next";

export interface ContractFormProps {
    contract: Partial<ContractDto>;
    holders: ContractHolderDto[];
    companies: CompanyDto[];
    categories: CategoryDto[];
    persons: PersonDto[];
    accounts: AccountDto[];
    goals?: SavingsGoalDto[];
    mode?: 'add' | 'edit';
    error?: string;
}

/** Collapsible part of the form. Content stays mounted so its fields are always submitted. */
function FormSection({title, defaultOpen, children}: { title: string; defaultOpen: boolean; children: ReactNode }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border-t border-zinc-950/5 dark:border-white/5 pt-4">
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
                    className="flex w-full items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-white hover:cursor-pointer">
                <ChevronRightIcon className={classNames("size-4 text-zinc-400 transition-transform", open ? "rotate-90" : "")}/>
                {title}
            </button>
            <div className={classNames("grid grid-cols-1 gap-4 mt-4", open ? "" : "hidden")}>{children}</div>
        </div>
    );
}

export default function ContractForm({contract, holders, companies, categories, persons, accounts, goals = [], mode = 'add', error}: ContractFormProps) {
    const navigation = useNavigate();
    const {t} = useTranslation();
    const {state} = useNavigation();
    const {user: currentUser} = useAuth();
    const isEdit = mode === 'edit';
    const [isPersonal, setIsPersonal] = useState(contract.owner_id != null);
    const [links, setLinks] = useState<EditableLink[]>((contract.links ?? []).map((l) => ({title: l.title, url: l.url})));
    const [nameError, setNameError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const isBusy = state === 'submitting' || isDeleting;
    const errorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (error && errorRef.current) {
            errorRef.current.scrollIntoView({behavior: 'smooth', block: 'center'});
        }
    }, [error]);
    const [isChooseIconOpen, setChooseIconOpen] = useState(false);
    const [iconSource, setIconSource] = useState(contract.icon_source ?? "");
    const [confirmDialogProps, setConfirmDialogProps] = useState<ConfirmDialogProps>({
        title: "",
        isOpen: false,
        message: "",
        onClose(): void {
            closeConfirmDialog();
        },
        onSubmit(): Promise<void> {
            return Promise.resolve(undefined);
        },
    });
    const [holdersWithInput, setHoldersWithInput] = useState<ContractHolderDto[]>(holders);
    const [companiesWithInput, setCompaniesWithInput] = useState<CompanyDto[]>(companies);
    const [billingPeriod, setBillingPeriod] = useState(contract.billing_period ?? BillingPeriodMonthly);
    const [showNextBillingOverride, setShowNextBillingOverride] = useState(false);
    const [kind, setKind] = useState<string>(contract.kind ?? EntryKindExpense);
    const [shares, setShares] = useState<ShareDto[]>(
        contract.shares ?? (isEdit ? [] : sharesForAccount(contract.account_id, accounts, persons)));
    // new entries: who carries the costs follows the chosen account until set by hand
    const [sharesTouched, setSharesTouched] = useState(isEdit);
    const [costType, setCostType] = useState<CostType>(isEdit
        ? costTypeOf({is_contract: Boolean(contract.is_contract), is_variable: Boolean(contract.is_variable)})
        : defaultCostType(categories.find((c) => c.id === contract.category_id || (!contract.category_id && c.key === "other"))));
    const isContract = costType === "contract";
    const [costTypeTouched, setCostTypeTouched] = useState(isEdit);
    // earner of an income; new entries follow the chosen account until set by hand
    const [earner, setEarner] = useState<Pot>(isEdit && contract.kind === EntryKindIncome
        ? costOwner(contract as ContractDto, persons, accounts) : earnerOfAccount(contract.account_id, accounts));
    const [earnerTouched, setEarnerTouched] = useState(isEdit);
    // type of a transfer; follows accounts and goal until set by hand (older entries keep the derived type)
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const [transferAccounts, setTransferAccounts] = useState({
        from: contract.account_id ?? undefined, to: contract.target_account_id ?? undefined, goal: contract.goal_id ?? undefined,
    });
    const deriveTransferType = (ids: typeof transferAccounts) =>
        defaultTransferType(accountById.get(ids.from ?? -1), accountById.get(ids.to ?? -1), ids.goal);
    const [transferType, setTransferType] = useState<string>(contract.transfer_type || deriveTransferType(transferAccounts));
    const [transferTypeTouched, setTransferTypeTouched] = useState(Boolean(contract.transfer_type));
    const changeTransferAccounts = (changes: Partial<typeof transferAccounts>) => {
        const next = {...transferAccounts, ...changes};
        setTransferAccounts(next);
        if (!transferTypeTouched) setTransferType(deriveTransferType(next));
    };
    const hasProvider = Boolean(contract.company || contract.website || contract.contact_person || contract.contact_address
        || contract.contact_phone || contract.contact_email);
    const hasDocuments = Boolean(contract.documents?.length || contract.links?.length);

    const isExpense = kind === EntryKindExpense;
    const isIncome = kind === EntryKindIncome;
    const isTransfer = kind === EntryKindTransfer;
    const hasBilling = billingPeriod !== BillingPeriodNone;
    const hasRecurringBilling = hasBilling && billingPeriod !== BillingPeriodOneTime;

    const handleHolderChange = (value: string) => {
        setHoldersWithInput([...holders, {name: value}])
    }

    const [editDocId, setEditDocId] = useState<number | null>(null);
    const [editTitle, setEditTitle] = useState("");

    const startEdit = (doc: DocumentDto) => {
        setEditDocId(doc.id);
        setEditTitle(doc.title || doc.path);
    };

    const saveEdit = async (documentId: number) => {
        const res = await apiFetch(`${apiBasePath}/documents/${documentId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                title: editTitle,
            })
        });

        if (res.ok) {
            setEditDocId(null);
            navigation(`/contracts/${contract.id}/edit`);
        }
    };

    const deleteContract = async () => {
        setIsDeleting(true);
        try {
            const res = await apiFetch(`${apiBasePath}/contracts/${contract.id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                navigation("/entries");
            }
        } finally {
            setIsDeleting(false);
        }
    };

    const deleteDocument = async (documentId: number) => {
        setIsDeleting(true);
        try {
            const res = await apiFetch(`${apiBasePath}/documents/${documentId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                navigation(`/contracts/${contract.id}/edit`);
            }
        } finally {
            setIsDeleting(false);
        }
    }

    const openConfirmDialog = (props: Partial<ConfirmDialogProps>) => {
        setConfirmDialogProps({...confirmDialogProps, ...props, isOpen: true});
    }

    const closeConfirmDialog = () => {
        setConfirmDialogProps({...confirmDialogProps, isOpen: false});
    }

    return (
        <>
            <ChooseIconDialog
                isOpen={isChooseIconOpen}
                onClose={() => setChooseIconOpen(false)}
                onSubmit={(source) => {
                    setIconSource(source);
                    setChooseIconOpen(false);
                }}
            />

            <ConfirmDialog
                isOpen={confirmDialogProps.isOpen}
                title={confirmDialogProps.title}
                message={confirmDialogProps.message}
                onClose={confirmDialogProps.onClose}
                submitLabel={confirmDialogProps.submitLabel}
                cancelLabel={confirmDialogProps.cancelLabel}
                onSubmit={async () => {
                    confirmDialogProps.onSubmit?.()
                        .finally(() => setConfirmDialogProps({...confirmDialogProps, isOpen: false}));
                }}
            />

            <Form
                method="post"
                encType="multipart/form-data"
                className="grid grid-cols-1 gap-4"
                onSubmit={(e) => {
                    setNameError('');
                    const formData = new FormData(e.currentTarget);
                    const name = (formData.get('name') as string)?.trim();
                    if (!name) {
                        e.preventDefault();
                        setNameError(t('entryForm.nameRequired'));
                        return;
                    }
                    const startDate = (formData.get('start_date') as string)?.trim();
                    if (!startDate) {
                        e.preventDefault();
                        return;
                    }
                }}
            >
                {error && (
                    <div ref={errorRef} className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
                        {error}
                    </div>
                )}

<input type="hidden" name="icon_source" value={iconSource}/>

                <div className="grid grid-cols-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1 text-sm">
                    {entryKinds().map((k) => (
                        <button
                            key={k.value}
                            type="button"
                            onClick={() => setKind(k.value)}
                            className={classNames(
                                "rounded-md py-1.5 transition-colors hover:cursor-pointer",
                                kind === k.value
                                    ? "bg-white dark:bg-zinc-950 shadow-sm font-medium text-zinc-950 dark:text-white"
                                    : "text-zinc-500 dark:text-zinc-400",
                            )}
                        >
                            {k.label}
                        </button>
                    ))}
                </div>
                <input type="hidden" name="kind" value={kind}/>

                <div className="grid grid-cols-[auto_1fr] items-end gap-3">
                    <IconButton onClick={() => setChooseIconOpen(true)}>
                        <EntryIcon
                            name={contract.name || "?"}
                            icon={iconSource}
                            category={categories.find((c) => c.id === contract.category_id)}
                            className="size-9"
                        />
                    </IconButton>
                    <Field>
                        <Label>{t('common.name')} *</Label>
                        <Input
                            name="name"
                            placeholder={t('entry.placeholderExpense')}
                            defaultValue={contract.name ?? ""}
                            invalid={!!nameError}
                            onChange={() => nameError && setNameError('')}
                        />
                    </Field>
                </div>
                {nameError && <ErrorMessage className="-mt-2">{nameError}</ErrorMessage>}

                <div className="grid grid-cols-[1fr_5.5rem] sm:grid-cols-[1fr_5.5rem_1fr] gap-3">
                    <Field>
                        <Label>{t('entry.amount')}</Label>
                        <Input
                            // remount after an amount change so the field shows the amount valid today
                            key={contract.costs ?? ""}
                            type="text"
                            inputMode="decimal"
                            name="costs"
                            defaultValue={formatDecimal(contract.costs) ?? ""}
                            pattern="^-?[0-9.]*[0-9]([,.][0-9]{1,2})?$"
                            placeholder="0,00"
                            className="[&_input]:text-right"
                        />
                        {(contract.amounts?.length ?? 0) > 0 && <Description>{t('amounts.formHint')}</Description>}
                    </Field>
                    <Field>
                        <Label>{t('entry.currency')}</Label>
                        <Select
                            name="currency"
                            defaultValue={contract.currency ?? "EUR"}
                        >
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                            <option value="GBP">GBP</option>
                            <option value="CHF">CHF</option>
                        </Select>
                    </Field>
                    <Field className="col-span-2 sm:col-span-1">
                        <Label>{t('entry.interval')}</Label>
                        <Select
                            name="billing_period"
                            defaultValue={contract.billing_period ?? BillingPeriodMonthly}
                            onChange={(e) => setBillingPeriod(e.target.value)}
                        >
                            {entryPeriods.map((p) => <option key={p} value={p}>{billingPeriodLabel(p)}</option>)}
                            <option value={BillingPeriodNone}>{t('periods.noCosts')}</option>
                        </Select>
                    </Field>
                </div>

                {isEdit && contract.id != null && billingPeriod !== BillingPeriodNone && billingPeriod !== BillingPeriodOneTime && (
                    <AmountHistory contract={contract as ContractDto} compact/>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <Field>
                        <Label>
                            {billingPeriod === BillingPeriodOneTime ? t('entry.date')
                                : isExpense && isContract ? t('contracts.startDate') : t('entry.startDate')} *
                        </Label>
                        <Input
                            type="date"
                            name="start_date"
                            required
                            defaultValue={
                                contract.start_date
                                    ? dayjs(contract.start_date).format("YYYY-MM-DD")
                                    : dayjs().format("YYYY-MM-DD")
                            }
                        />
                        {isExpense && isContract && billingPeriod !== BillingPeriodOneTime && (
                            <Description>{t('contracts.startDateHint')}</Description>
                        )}
                    </Field>
                    <Field>
                        <Label>{t('entry.endDate')}</Label>
                        <Input
                            type="date"
                            name="end_date"
                            defaultValue={
                                contract.end_date
                                    ? dayjs(contract.end_date).format("YYYY-MM-DD")
                                    : ""
                            }
                        />
                    </Field>
                </div>

                {hasRecurringBilling && (
                    <div>
                        {!showNextBillingOverride && !contract.next_billing_date ? (
                            <button
                                type="button"
                                onClick={() => setShowNextBillingOverride(true)}
                                className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                            >
                                {t('entryForm.setNextBilling')}
                            </button>
                        ) : (
                            <Field>
                                <Label>{t('entryForm.nextBillingDate')}</Label>
                                <Input
                                    type="date"
                                    name="next_billing_date"
                                    defaultValue={
                                        contract.next_billing_date
                                            ? dayjs(contract.next_billing_date).format("YYYY-MM-DD")
                                            : ""
                                    }
                                />
                                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                                    {t('entryForm.nextBillingHint')}
                                </p>
                            </Field>
                        )}
                    </div>
                )}


                <div className="grid grid-cols-2 gap-3">
                    <Field>
                        <Label>{isExpense ? t('entry.paidFrom') : isTransfer ? t('entry.fromAccount') : t('entry.toAccount')}</Label>
                        <Select name="account_id" defaultValue={contract.account_id ?? ""}
                                onChange={(e) => {
                                    const id = Number(e.target.value) || null;
                                    if (!earnerTouched) setEarner(earnerOfAccount(id, accounts));
                                    if (!sharesTouched) setShares(sharesForAccount(id, accounts, persons));
                                    changeTransferAccounts({from: id ?? undefined});
                                }}>
                            <option value="">{t('common.noAccount')}</option>
                            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </Select>
                    </Field>
                    {isTransfer ? (
                        <Field>
                            <Label>{t('entry.toAccount')}</Label>
                            <Select name="target_account_id" defaultValue={contract.target_account_id ?? ""}
                                    onChange={(e) => changeTransferAccounts({to: Number(e.target.value) || undefined})}>
                                <option value="">{t('common.noAccount')}</option>
                                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </Select>
                        </Field>
                    ) : (
                        <Field>
                            <Label>{t('entry.category')}</Label>
                            <Select
                                name="category_id"
                                defaultValue={contract.category_id ?? categories.find((c) => c.key === "other")?.id ?? ""}
                                onChange={(e) => {
                                    if (!costTypeTouched) {
                                        setCostType(defaultCostType(categories.find((c) => c.id === Number(e.target.value))));
                                    }
                                }}
                            >
                                {categories.filter((cat) => cat.type === kind || cat.id === contract.category_id).map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {categoryLabel(cat.name, cat.key)}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    )}
                </div>

                {isTransfer && goals.length > 0 && (
                    <Field>
                        <Label>{t('goals.goal')}</Label>
                        <Select name="goal_id" defaultValue={contract.goal_id ?? ""}
                                onChange={(e) => changeTransferAccounts({goal: Number(e.target.value) || undefined})}>
                            <option value="">{t('goals.noGoal')}</option>
                            {goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </Select>
                    </Field>
                )}

                {isTransfer && (
                    <Field>
                        <Label>{t('transferType.label')}</Label>
                        <div className="mt-2">
                            <TransferTypeControl value={transferType} onChange={(v) => {
                                setTransferType(v);
                                setTransferTypeTouched(true);
                            }} fromSavings={isSavingsAccount(accountById.get(transferAccounts.from ?? -1))}/>
                        </div>
                        <input type="hidden" name="transfer_type" value={transferType}/>
                    </Field>
                )}

                {isIncome && (
                    <Field>
                        <Label>{t('income.earner')}</Label>
                        <Description>{t('income.earnerHint')}</Description>
                        <EarnerSelect persons={persons} value={earner} onChange={(v) => {
                            setEarner(v);
                            setEarnerTouched(true);
                        }}/>
                        <input type="hidden" name="shares" value={JSON.stringify(earnerShares(earner, persons))}/>
                    </Field>
                )}
                {isExpense && (
                    <Field>
                        <Label>{t('entry.whoCarries')}</Label>
                        <div className="mt-2">
                            <SharesEditor persons={persons} value={shares} onChange={(v) => {
                                setShares(v);
                                setSharesTouched(true);
                            }}/>
                        </div>
                        <input type="hidden" name="shares" value={JSON.stringify(shares)}/>
                        {shares.length === 0 && (contract.split_between ?? 1) > 1 && (
                            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                                {t('entryForm.legacySplit', {count: contract.split_between})}
                            </p>
                        )}
                    </Field>
                )}
                <input type="hidden" name="split_between" value={contract.split_between ?? 1}/>

                {isExpense && (
                    <Field>
                        <Label>{t('costType.label')}</Label>
                        <div className="mt-2">
                            <CostTypeControl value={costType} onChange={(v) => {
                                setCostType(v);
                                setCostTypeTouched(true);
                            }}/>
                        </div>
                    </Field>
                )}
                <input type="hidden" name="is_contract" value={String(isExpense && costType === "contract")}/>
                <input type="hidden" name="is_variable" value={String(isExpense && costType === "variable")}/>

                <Field>
                    <Label>{t('entryForm.visibility')}</Label>
                    <Select
                        value={isPersonal ? "personal" : "shared"}
                        onChange={(e) => setIsPersonal(e.target.value === "personal")}
                    >
                        <option value="shared">{t('entryForm.visibilityShared')}</option>
                        <option value="personal">{t('entryForm.visibilityPersonal')}</option>
                    </Select>
                    <Input
                        type="hidden"
                        name="owner_id"
                        value={isPersonal ? String(currentUser?.id ?? "") : ""}
                    />
                </Field>

                {/* contract data only for contracts; hidden fields stay in the form so nothing is lost */}
                <div className={classNames("grid grid-cols-1 gap-4", isExpense && isContract ? "" : "hidden")}>
                    <Subheading className="mt-2">{t('entryForm.sectionContract')}</Subheading>
                    <Field>
                        <Label>{t('entryForm.contractNumber')}</Label>
                        <Input
                            name="contract_number"
                            defaultValue={contract.contract_number ?? ""}
                        />
                    </Field>

                    <Field>
                        <Label>{t('entryForm.customerNumber')}</Label>
                        <Input
                            name="customer_number"
                            defaultValue={contract.customer_number ?? ""}
                        />
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field>
                            <Label>{t('contracts.term')}</Label>
                            <Select name="term_months" defaultValue={contract.term_months ?? ""}>
                                <option value="">{t('contracts.noTerm')}</option>
                                {[1, 3, 6, 12, 24, 36].map((m) => (
                                    <option key={m} value={m}>{t('contracts.termMonths', {count: m})}</option>
                                ))}
                            </Select>
                            <Description>{t('contracts.termHint')}</Description>
                        </Field>
                        <Field>
                            <Label>{t('contracts.notice')}</Label>
                            <div className="grid grid-cols-[5rem_1fr] gap-2" data-slot="control">
                                <Input type="number" min="0" max="365" name="notice_period"
                                       defaultValue={contract.notice_period ?? ""} aria-label={t('contracts.notice')}/>
                                <Select name="notice_unit" defaultValue={contract.notice_unit ?? "months"}
                                        aria-label={t('contracts.noticeUnit')}>
                                    <option value="days">{t('contracts.units.days')}</option>
                                    <option value="weeks">{t('contracts.units.weeks')}</option>
                                    <option value="months">{t('contracts.units.months')}</option>
                                </Select>
                            </div>
                        </Field>
                    </div>

                    <Field>
                        <Label>{t('entryForm.contractHolder')}</Label>
                        {holders && <Combobox
                            name="contract_holder"
                            options={holdersWithInput}
                            onInputChange={(e) => {
                                handleHolderChange(e.target.value)
                            }}
                            displayValue={(user) => user?.name}
                            defaultValue={{name: contract.contract_holder || ''}}>
                            {(user) => (
                                <ComboboxOption value={user}>
                                    <ComboboxLabel>{user.name}</ComboboxLabel>
                                </ComboboxOption>
                            )}
                        </Combobox>}
                    </Field>
                </div>

                <FormSection title={t('entryForm.sectionProvider')} defaultOpen={hasProvider || (isExpense && isContract)}>
                    <Field>
                        <Label>{t('entryForm.company')}</Label>
                        <Combobox
                            name="company"
                            options={companiesWithInput}
                            onInputChange={(e) => {
                                setCompaniesWithInput([...companies, {name: e.target.value}])
                            }}
                            displayValue={(c) => c?.name}
                            defaultValue={{name: contract.company || ''}}>
                            {(c) => (
                                <ComboboxOption value={c}>
                                    <ComboboxLabel>{c.name}</ComboboxLabel>
                                </ComboboxOption>
                            )}
                        </Combobox>
                    </Field>
                    <Field>
                        <Label>{t('entryForm.website')}</Label>
                        <Input
                            name="website"
                            inputMode="url"
                            placeholder="https://www.…"
                            defaultValue={contract.website ?? ""}
                        />
                    </Field>
                    <Field>
                        <Label>{t('entryForm.contactPerson')}</Label>
                        <Input
                            name="contact_person"
                            defaultValue={contract.contact_person ?? ""}
                        />
                    </Field>
                    <Field>
                        <Label>{t('entryForm.address')}</Label>
                        <Textarea
                            name="contact_address"
                            defaultValue={contract.contact_address ?? ""}
                        />
                    </Field>
                    <Field>
                        <Label>{t('entryForm.phone')}</Label>
                        <Input
                            name="contact_phone"
                            defaultValue={contract.contact_phone ?? ""}
                        />
                    </Field>
                    <Field>
                        <Label>{t('entryForm.email')}</Label>
                        <Input
                            name="contact_email"
                            defaultValue={contract.contact_email ?? ""}
                        />
                    </Field>
                </FormSection>

                <FormSection title={t('entryForm.sectionDocuments')} defaultOpen={hasDocuments}>
                    <Field>
                        <Label>{t('entryForm.documents')}</Label>
                        <Input
                            type="file"
                            name="file"
                            multiple
                            accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                        />
                    </Field>

                    <Field>
                        <Label>{t('entryForm.links')}</Label>
                        <Description>{t('entryForm.linksHint')}</Description>
                        <div className="mt-2">
                            <LinksEditor value={links} onChange={setLinks}/>
                        </div>
                        <input type="hidden" name="links" value={JSON.stringify(links)}/>
                    </Field>

                    <div>
                        {contract.documents &&
                            contract.documents.map((doc) => (
                                <div key={doc.id} className="flex grow min-w-0 items-center">
                                    {editDocId === doc.id ? (
                                        <Input
                                            type="text"
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            className="flex truncate border rounded px-1 text-black"
                                            autoFocus
                                            onBlur={() => saveEdit(doc.id)}
                                        />
                                    ) : (
                                        <a
                                            href={`/uploads/${doc.path}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-2 text-sm/6 text-zinc-500 dark:text-zinc-400 truncate"
                                        >
                                            <DocumentIcon className="h-5 w-5 shrink-0 fill-zinc-400 dark:fill-zinc-500"/>
                                            <span className="truncate">{doc.title}</span>
                                        </a>
                                    )}

                                    <div className="grow"></div>

                                    {editDocId === doc.id ? (
                                        <Button
                                            className="my-1 ml-1 lg:size-6 hover:cursor-pointer"
                                            onClick={() => saveEdit(doc.id)}
                                        >
                                            <CheckIcon/>
                                        </Button>
                                    ) : (
                                        <Button
                                            className="my-1 ml-1 lg:size-6 hover:cursor-pointer"
                                            onClick={() => startEdit(doc)}
                                        >
                                            <PencilIcon/>
                                        </Button>
                                    )}

                                    <Button
                                        className="my-1 ml-1 lg:size-6 hover:cursor-pointer"
                                        onClick={() =>
                                            openConfirmDialog({
                                                title: t('entryForm.deleteDocumentTitle'),
                                                message: t('entryForm.deleteDocumentMessage'),
                                                submitLabel: t('common.delete'),
                                                cancelLabel: t('common.cancel'),
                                                onSubmit: deleteDocument.bind(null, doc.id),
                                            })
                                        }
                                    >
                                        <XMarkIcon/>
                                    </Button>
                                </div>
                            ))}
                    </div>
                </FormSection>

                <FormSection title={t('entryForm.notes')} defaultOpen={Boolean(contract.notes)}>
                    <Field>
                        <Label>{t('entryForm.notes')}</Label>
                        <Textarea
                            name="notes"
                            defaultValue={contract.notes ?? ""}
                        />
                    </Field>
                </FormSection>

                {/* Actions as in the dialogs: delete on the left, cancel and save on the right (save on top on phones) */}
                <div className="flex flex-col-reverse lg:flex-row mt-6 gap-4 lg:gap-2">
                    {isEdit && (
                        <Button
                            type="button"
                            color="red"
                            disabled={isBusy}
                            onClick={() => openConfirmDialog({
                                title: t('entryForm.deleteEntryTitle'),
                                message: t('entryForm.deleteEntryMessage'),
                                submitLabel: t('common.delete'),
                                cancelLabel: t('common.cancel'),
                                onSubmit: deleteContract.bind(null),
                            })}
                            className="w-full lg:w-auto hover:cursor-pointer"
                        >
                            {t('common.delete')}
                        </Button>
                    )}
                    <div className="hidden lg:block lg:grow"/>
                    <Button
                        type="button"
                        plain
                        disabled={isBusy}
                        onClick={() => navigation(isEdit ? `/contracts/${contract.id}` : "/entries")}
                        className="w-full lg:w-auto hover:cursor-pointer"
                    >
                        {t('common.cancel')}
                    </Button>
                    <Button
                        type="submit"
                        disabled={isBusy}
                        className="w-full lg:w-auto hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {state === 'submitting' ? t('common.saving') : t('common.save')}
                    </Button>
                </div>
            </Form>
        </>
    );
}
