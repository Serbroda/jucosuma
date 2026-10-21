import {
    BillingPeriodMonthly, BillingPeriodNone, BillingPeriodOneTime,
    EntryKindExpense, EntryKindIncome, EntryKindTransfer,
    type AccountDto, type CategoryDto, type CompanyDto, type ContractDto, type ContractHolderDto, type DocumentDto,
    type PersonDto, type SavingsGoalDto, type ShareDto
} from "../gen/types.gen.ts";
import {Description, Field, Label} from "./catalyst/fieldset.tsx";
import {Input} from "./catalyst/input.tsx";
import {Select} from "./catalyst/select.tsx";
import {Divider} from "./catalyst/divider.tsx";
import {Subheading} from "./catalyst/heading.tsx";
import {Button} from "./catalyst/button.tsx";
import {Form, useNavigate, useNavigation} from "react-router";
import {useEffect, useRef, useState} from "react";
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
import EntryIcon from "./EntryIcon.tsx";
import {categoryLabel, defaultShares, entryKinds, entryPeriods, isContractCategory} from "../utils/household.utils.ts";
import {Switch, SwitchField} from "./catalyst/switch.tsx";
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

export default function ContractForm({contract, holders, companies, categories, persons, accounts, goals = [], mode = 'add', error}: ContractFormProps) {
    const navigation = useNavigate();
    const {t} = useTranslation();
    const {state} = useNavigation();
    const {user: currentUser} = useAuth();
    const isEdit = mode === 'edit';
    const [isPersonal, setIsPersonal] = useState(contract.owner_id != null);
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
        contract.shares ?? (isEdit ? [] : defaultShares(persons)));
    const [isContract, setIsContract] = useState(isEdit
        ? Boolean(contract.is_contract)
        : isContractCategory(categories.find((c) => c.id === contract.category_id || (!contract.category_id && c.key === "other"))));
    const [contractTouched, setContractTouched] = useState(isEdit);
    const [showDetails, setShowDetails] = useState(Boolean(contract.is_contract) || Boolean(
        contract.company || contract.contract_number || contract.customer_number || contract.contract_holder
        || contract.contact_person || contract.contact_email || contract.contact_phone || contract.notes
        || contract.documents?.length));

    const isExpense = kind === EntryKindExpense;
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

                <div className="justify-self-center">
                    <Button
                        plain
                        onClick={() => setChooseIconOpen(true)}
                        className="hover:cursor-pointer"
                    >
                        <EntryIcon
                            name={contract.name || "?"}
                            icon={iconSource}
                            category={categories.find((c) => c.id === contract.category_id)}
                            className="size-16"
                        />
                    </Button>
                    <input type="hidden" name="icon_source" value={iconSource}/>
                </div>

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

                <Field>
                    <Label>{t('common.name')} *</Label>
                    <Input
                        name="name"
                        placeholder={t('entry.placeholderExpense')}
                        defaultValue={contract.name ?? ""}
                        invalid={!!nameError}
                        onChange={() => nameError && setNameError('')}
                    />
                    {nameError && <ErrorMessage>{nameError}</ErrorMessage>}
                </Field>

                <div className="grid grid-cols-[1fr_5.5rem] sm:grid-cols-[1fr_5.5rem_1fr] gap-2">
                    <Field>
                        <Label>{t('entry.amount')}</Label>
                        <Input
                            type="text"
                            inputMode="decimal"
                            name="costs"
                            defaultValue={formatDecimal(contract.costs) ?? ""}
                            pattern="^-?[0-9.]*[0-9]([,.][0-9]{1,2})?$"
                            placeholder="0,00"
                        />
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

                <div className="grid grid-cols-2 gap-2">
                    <Field>
                        <Label>{billingPeriod === BillingPeriodOneTime ? t('entry.date') : t('entry.startDate')} *</Label>
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

                <div className="grid grid-cols-2 gap-2">
                    <Field>
                        <Label>{isExpense ? t('entry.paidFrom') : isTransfer ? t('entry.fromAccount') : t('entry.toAccount')}</Label>
                        <Select name="account_id" defaultValue={contract.account_id ?? ""}>
                            <option value="">{t('common.noAccount')}</option>
                            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </Select>
                    </Field>
                    {isTransfer ? (
                        <Field>
                            <Label>{t('entry.toAccount')}</Label>
                            <Select name="target_account_id" defaultValue={contract.target_account_id ?? ""}>
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
                                    if (!contractTouched) {
                                        setIsContract(isContractCategory(categories.find((c) => c.id === Number(e.target.value))));
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
                        <Select name="goal_id" defaultValue={contract.goal_id ?? ""}>
                            <option value="">{t('goals.noGoal')}</option>
                            {goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </Select>
                    </Field>
                )}

                {!isTransfer && (
                    <Field>
                        <Label>{kind === EntryKindIncome ? t('entry.whoseIncome') : t('entry.whoCarries')}</Label>
                        <div className="mt-2">
                            <SharesEditor persons={persons} value={shares} onChange={setShares}/>
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
                    <SwitchField>
                        <Label>{t('contracts.isContract')}</Label>
                        <Description>{t('contracts.isContractHint')}</Description>
                        <Switch checked={isContract} onChange={(v) => {
                            setIsContract(v);
                            setContractTouched(true);
                            if (v) setShowDetails(true);
                        }}/>
                    </SwitchField>
                )}
                <input type="hidden" name="is_contract" value={String(isExpense && isContract)}/>

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

                <button
                    type="button"
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center gap-1 mt-4 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:cursor-pointer"
                >
                    <ChevronRightIcon className={classNames("size-4 transition-transform", showDetails ? "rotate-90" : "")}/>
                    {t('entryForm.detailsToggle')}
                </button>

                <div className={classNames("grid grid-cols-1 gap-4", showDetails ? "" : "hidden")}>
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

                <Divider className="mt-6"/>
                <Subheading>{t('entryForm.contactInformation')}</Subheading>
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

                <Divider className="mt-6"/>
                <Subheading>{t('entryForm.documentsAndNotes')}</Subheading>
                <Field>
                    <Label>{t('entryForm.documents')}</Label>
                    <Input
                        type="file"
                        name="file"
                        multiple
                        accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    />
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

                <Field>
                    <Label>{t('entryForm.notes')}</Label>
                    <Textarea
                        name="notes"
                        defaultValue={contract.notes ?? ""}
                    />
                </Field>

                </div>

                {/* Actions */}
                <div className="flex mt-6 gap-4 lg:gap-2 flex-wrap">
                    <Button
                        type="submit"
                        disabled={isBusy}
                        className="w-full lg:w-auto hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {state === 'submitting' ? t('common.saving') : t('common.save')}
                    </Button>
                    <Button
                        type="button"
                        outline
                        disabled={isBusy}
                        onClick={() => navigation(isEdit ? `/contracts/${contract.id}` : "/entries")}
                        className="w-full lg:w-auto hover:cursor-pointer"
                    >
                        {t('common.cancel')}
                    </Button>
                    {isEdit && <>
                        <div className="hidden lg:block lg:grow"/>
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
                    </>}
                </div>
            </Form>
        </>
    );
}
