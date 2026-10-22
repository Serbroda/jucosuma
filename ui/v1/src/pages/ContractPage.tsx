import {costOwner} from "../utils/budget.utils.ts";
import {useLoaderData} from "react-router";
import {Heading, Subheading} from "../components/catalyst/heading.tsx";
import {Divider} from "../components/catalyst/divider.tsx";
import type {AccountDto, ContractDto, PersonDto} from "../gen/types.gen.ts";
import {BillingPeriodNone, BillingPeriodOneTime, EntryKindExpense, EntryKindIncome, EntryKindTransfer} from "../gen/types.gen.ts";
import {accountName, categoryLabel, entryKindLabel, noticeLabel} from "../utils/household.utils.ts";
import {useTranslation} from "react-i18next";
import {
    BanknotesIcon,
    CalendarIcon,
    ClockIcon,
    DocumentIcon,
    PencilIcon,
    UserIcon,
} from "@heroicons/react/16/solid";
import {Badge} from "../components/catalyst/badge.tsx";
import {Button} from "../components/catalyst/button.tsx";
import {DescriptionDetails, DescriptionList, DescriptionTerm} from "../components/catalyst/description-list.tsx";
import {type ReactNode, useEffect} from "react";
import Tooltip from "../components/Tooltip.tsx";
import dayjs from "../lib/dayjs";
import {formatCurrency} from "../utils/number.utils.ts";
import EntryIcon from "../components/EntryIcon.tsx";
import AmountHistory from "../components/AmountHistory.tsx";
import LineBreakParagraph from "../components/LineBreakParagraph.tsx";
import {billingPeriodLabel} from "../utils/data.utils.ts";

const statusColor = (status: string): "green" | "yellow" | "zinc" => {
    switch (status) {
        case "active": return "green";
        case "cancelled": return "yellow";
        default: return "zinc";
    }
};

const HeaderDetails = ({icon, info}: { icon: ReactNode, info: string }) => (
    <span className="flex items-center gap-3 text-base/6 text-zinc-950 sm:text-sm/6 dark:text-white">
        {icon}
        <span>{info}</span>
    </span>
);

const iconClass = "size-4 fill-zinc-400 dark:fill-zinc-500";

export default function ContractPage() {
    const data = useLoaderData() as { contract: ContractDto, persons: PersonDto[], accounts: AccountDto[] } | undefined;
    const c = data?.contract;
    const {t, i18n} = useTranslation();
    const persons = data?.persons ?? [];
    const accounts = data?.accounts ?? [];
    const totalWeight = c?.shares.reduce((sum, s) => sum + s.weight, 0) ?? 0;

    const hasRecurringBilling = c?.billing_period && c.billing_period !== BillingPeriodNone && c.billing_period !== BillingPeriodOneTime;
    const hasContact = c?.contact_person || c?.contact_address || c?.contact_phone || c?.contact_email;

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <>
            {/* Header */}
            <div>
                <div className="flex items-center gap-4 lg:flex-wrap">
                    <EntryIcon name={c?.name ?? ""} icon={c?.icon_source} className="size-10"/>
                    <Heading className="truncate">{c?.name}</Heading>
                    {c?.status && (
                        <Badge color={statusColor(c.status)}>
                            {t(`status.${c.status}` as 'status.active')}
                        </Badge>
                    )}
                </div>

                <div className="isolate mt-2.5 hidden lg:flex flex-wrap justify-between gap-x-6 gap-y-4">
                    <div className="flex flex-wrap gap-x-6 gap-y-4 py-1.5 lg:gap-x-10">
                        {c?.contract_number &&
                            <Tooltip text={t('entryForm.contractNumber')}>
                                <HeaderDetails icon={<DocumentIcon className={iconClass}/>} info={c.contract_number}/>
                            </Tooltip>
                        }
                        {c?.customer_number &&
                            <Tooltip text={t('entryForm.customerNumber')}>
                                <HeaderDetails icon={<UserIcon className={iconClass}/>} info={c.customer_number}/>
                            </Tooltip>
                        }
                        {c?.start_date &&
                            <Tooltip text={t('entry.startDate')}>
                                <HeaderDetails icon={<CalendarIcon className={iconClass}/>} info={dayjs(c.start_date).format('DD.MM.YYYY')}/>
                            </Tooltip>
                        }
                        {c?.costs != null &&
                            <Tooltip text={t('entryDetail.costs')}>
                                <HeaderDetails icon={<BanknotesIcon className={iconClass}/>} info={formatCurrency(c.costs, c.currency)}/>
                            </Tooltip>
                        }
                        {hasRecurringBilling && c?.next_billing_date &&
                            <Tooltip text={t('entryForm.nextBillingDate')}>
                                <HeaderDetails icon={<ClockIcon className={iconClass}/>} info={dayjs(c.next_billing_date).format('DD.MM.YYYY')}/>
                            </Tooltip>
                        }
                    </div>

                    <div className="flex gap-4">
                        <Button className="hover:cursor-pointer" to={`/contracts/${c?.id}/edit`}>
                            <PencilIcon/>
                            <span className="hidden lg:block">{t('entryDetail.edit')}</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="mt-12">
                <Subheading>{t('entryDetail.summary')}</Subheading>
                <Divider className="mt-4"/>
                <DescriptionList>
                    {c?.company && <>
                        <DescriptionTerm>{t('entryForm.company')}</DescriptionTerm>
                        <DescriptionDetails>{c.company}</DescriptionDetails>
                    </>}
                    <DescriptionTerm>{t('entry.category')}</DescriptionTerm>
                    <DescriptionDetails>{c ? categoryLabel(c.category, c.category_key) : ""}</DescriptionDetails>
                    {c?.contract_holder && <>
                        <DescriptionTerm>{t('entryForm.contractHolder')}</DescriptionTerm>
                        <DescriptionDetails>{c.contract_holder}</DescriptionDetails>
                    </>}
                </DescriptionList>

                <Subheading className="mt-10">{t('entryDetail.details')}</Subheading>
                <Divider className="mt-4"/>
                <DescriptionList>
                    <DescriptionTerm>{t('entry.startDate')}</DescriptionTerm>
                    <DescriptionDetails>{dayjs(c?.start_date).format('DD.MM.YYYY')}</DescriptionDetails>
                    {c?.end_date && <>
                        <DescriptionTerm>{t('entry.endDate')}</DescriptionTerm>
                        <DescriptionDetails>{dayjs(c.end_date).format('DD.MM.YYYY')}</DescriptionDetails>
                    </>}
                    {c?.contract_number && <>
                        <DescriptionTerm>{t('entryForm.contractNumber')}</DescriptionTerm>
                        <DescriptionDetails>{c.contract_number}</DescriptionDetails>
                    </>}
                    {c?.customer_number && <>
                        <DescriptionTerm>{t('entryForm.customerNumber')}</DescriptionTerm>
                        <DescriptionDetails>{c.customer_number}</DescriptionDetails>
                    </>}
                    {c?.term_months != null && <>
                        <DescriptionTerm>{t('contracts.term')}</DescriptionTerm>
                        <DescriptionDetails>{t('contracts.termMonths', {count: c.term_months})}</DescriptionDetails>
                    </>}
                    {noticeLabel(c?.notice_period, c?.notice_unit) && <>
                        <DescriptionTerm>{t('contracts.notice')}</DescriptionTerm>
                        <DescriptionDetails>{noticeLabel(c?.notice_period, c?.notice_unit)}</DescriptionDetails>
                    </>}
                    {c?.term_end && <>
                        <DescriptionTerm>{c.status === "active" ? t('contracts.termEnd') : t('contracts.endsOn')}</DescriptionTerm>
                        <DescriptionDetails>{dayjs(c.term_end).format('DD.MM.YYYY')}</DescriptionDetails>
                    </>}
                    {c?.cancel_by && <>
                        <DescriptionTerm>{t('contracts.cancelBy')}</DescriptionTerm>
                        <DescriptionDetails>{dayjs(c.cancel_by).format('DD.MM.YYYY')}</DescriptionDetails>
                    </>}
                </DescriptionList>

                <Subheading className="mt-10">{t('entryDetail.billing')}</Subheading>
                <Divider className="mt-4"/>
                <DescriptionList>
                    <DescriptionTerm>{t('entryDetail.type')}</DescriptionTerm>
                    <DescriptionDetails>{entryKindLabel(c?.kind)}</DescriptionDetails>
                    {accountName(c?.account_id, accounts) && <>
                        <DescriptionTerm>{c?.kind === EntryKindExpense ? t('entry.paidFrom') : c?.kind === EntryKindTransfer ? t('entry.fromAccount') : t('entry.toAccount')}</DescriptionTerm>
                        <DescriptionDetails>{accountName(c?.account_id, accounts)}</DescriptionDetails>
                    </>}
                    {c?.kind === EntryKindTransfer && accountName(c?.target_account_id, accounts) && <>
                        <DescriptionTerm>{t('entry.toAccount')}</DescriptionTerm>
                        <DescriptionDetails>{accountName(c?.target_account_id, accounts)}</DescriptionDetails>
                    </>}
                    {c?.kind === EntryKindIncome && <>
                        <DescriptionTerm>{t('income.earner')}</DescriptionTerm>
                        <DescriptionDetails>
                            {(() => {
                                const earner = costOwner(c, persons, accounts);
                                return earner === "household" ? t('income.earnerShared') : persons.find((p) => p.id === earner)?.name;
                            })()}
                        </DescriptionDetails>
                    </>}
                    {c?.kind === EntryKindExpense && totalWeight > 0 && <>
                        <DescriptionTerm>{t('entryDetail.carriedBy')}</DescriptionTerm>
                        <DescriptionDetails>
                            {c.shares.map((s) => {
                                const person = persons.find((p) => p.id === s.person_id);
                                const percent = Math.round(s.weight / totalWeight * 1000) / 10;
                                return (
                                    <div key={s.person_id}>
                                        {person?.name ?? t('common.unknown')}
                                        {person && !person.in_household && <span className="text-zinc-400 dark:text-zinc-500"> {t('shares.external')}</span>}
                                        <span className="text-zinc-400 dark:text-zinc-500 ml-1">{percent.toLocaleString(i18n.language)} %</span>
                                    </div>
                                );
                            })}
                        </DescriptionDetails>
                    </>}
                    <DescriptionTerm>{t('entryDetail.billingPeriod')}</DescriptionTerm>
                    <DescriptionDetails>{billingPeriodLabel(c?.billing_period)}</DescriptionDetails>
                    {c?.costs != null && <>
                        <DescriptionTerm>{t('entryDetail.costs')}</DescriptionTerm>
                        <DescriptionDetails>
                            {formatCurrency(c.costs, c.currency)}
                            {c.shares.length === 0 && c.split_between > 1 && (
                                <span className="text-zinc-400 dark:text-zinc-500 ml-1">
                                    {t('entryDetail.splitBy', {count: c.split_between})}
                                </span>
                            )}
                        </DescriptionDetails>
                    </>}
                    {hasRecurringBilling && c?.monthly_costs != null && <>
                        <DescriptionTerm>{t('entryDetail.monthlyCosts')}</DescriptionTerm>
                        <DescriptionDetails>
                            {formatCurrency(c.monthly_costs, c.currency)}
                            {c.household_share < 1 && (
                                <span className="text-zinc-400 dark:text-zinc-500 ml-1">
                                    {t('entryDetail.householdShareOf', {amount: formatCurrency(c.monthly_amount, c.currency)})}
                                </span>
                            )}
                        </DescriptionDetails>
                    </>}
                    {hasRecurringBilling && c?.next_billing_date && <>
                        <DescriptionTerm>{t('entryForm.nextBillingDate')}</DescriptionTerm>
                        <DescriptionDetails>{dayjs(c.next_billing_date).format('DD.MM.YYYY')}</DescriptionDetails>
                    </>}
                </DescriptionList>

                {hasRecurringBilling && c && <AmountHistory contract={c}/>}

                {hasContact && <>
                    <Subheading className="mt-10">{t('entryForm.contactInformation')}</Subheading>
                    <Divider className="mt-4"/>
                    <DescriptionList>
                        {c?.contact_person && <>
                            <DescriptionTerm>{t('entryForm.contactPerson')}</DescriptionTerm>
                            <DescriptionDetails>{c.contact_person}</DescriptionDetails>
                        </>}
                        {c?.contact_address && <>
                            <DescriptionTerm>{t('entryForm.address')}</DescriptionTerm>
                            <DescriptionDetails>
                                <LineBreakParagraph text={c.contact_address}/>
                            </DescriptionDetails>
                        </>}
                        {c?.contact_phone && <>
                            <DescriptionTerm>{t('entryForm.phone')}</DescriptionTerm>
                            <DescriptionDetails>{c.contact_phone}</DescriptionDetails>
                        </>}
                        {c?.contact_email && <>
                            <DescriptionTerm>{t('entryForm.email')}</DescriptionTerm>
                            <DescriptionDetails>{c.contact_email}</DescriptionDetails>
                        </>}
                    </DescriptionList>
                </>}

                {((c?.documents && c.documents.length > 0) || c?.notes) && <>
                    <Subheading className="mt-10">{t('entryForm.documentsAndNotes')}</Subheading>
                    <Divider className="mt-4"/>
                    <DescriptionList>
                        {c?.documents && c.documents.length > 0 && <>
                            <DescriptionTerm>{t('entryForm.documents')}</DescriptionTerm>
                            <DescriptionDetails>
                                {c.documents.map((doc) =>
                                    <div key={doc.id} className="flex grow min-w-0">
                                        <a
                                            href={`/uploads/documents/${doc.path}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex grow truncate items-center gap-2 text-sm/6 text-zinc-500 dark:text-zinc-400 pt-2"
                                        >
                                            <DocumentIcon className="h-5 w-5 shrink-0 fill-zinc-400 dark:fill-zinc-500"/>
                                            <span className="truncate">{doc.title}</span>
                                        </a>
                                    </div>
                                )}
                            </DescriptionDetails>
                        </>}
                        {c?.notes && <>
                            <DescriptionTerm>{t('entryForm.notes')}</DescriptionTerm>
                            <DescriptionDetails>
                                <LineBreakParagraph text={c.notes}/>
                            </DescriptionDetails>
                        </>}
                    </DescriptionList>
                </>}
            </div>

            <div className="flex gap-4 lg:hidden mt-6 w-full">
                <Button className="hover:cursor-pointer w-full" to={`/contracts/${c?.id}/edit`}>
                    <PencilIcon/>
                    <span>{t('entryDetail.edit')}</span>
                </Button>
            </div>
        </>
    )
}
