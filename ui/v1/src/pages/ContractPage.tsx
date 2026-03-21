import {useLoaderData} from "react-router";
import {Heading, Subheading} from "../components/catalyst/heading.tsx";
import {Divider} from "../components/catalyst/divider.tsx";
import type {ContractDto} from "../gen/types.gen.ts";
import {BillingPeriodNone, BillingPeriodOneTime} from "../gen/types.gen.ts";
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
import {Avatar} from "../components/catalyst/avatar.tsx";
import {classNames} from "../utils/dom.utils.ts";
import image from "../assets/image.png";
import {type ReactNode, useEffect} from "react";
import Tooltip from "../components/Tooltip.tsx";
import dayjs from "../lib/dayjs";
import {formatCurrency} from "../utils/number.utils.ts";
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
    const data = useLoaderData() as { contract: ContractDto } | undefined;
    const c = data?.contract;

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
                    <Avatar
                        square={true}
                        className={classNames("w-10 h-10", c?.icon_source ? '' : 'dark:invert')}
                        src={c?.icon_source || image}/>
                    <Heading className="truncate">{c?.name}</Heading>
                    {c?.status && (
                        <Badge color={statusColor(c.status)}>
                            {c.status}
                        </Badge>
                    )}
                </div>

                <div className="isolate mt-2.5 hidden lg:flex flex-wrap justify-between gap-x-6 gap-y-4">
                    <div className="flex flex-wrap gap-x-6 gap-y-4 py-1.5 lg:gap-x-10">
                        {c?.contract_number &&
                            <Tooltip text="Contract Number">
                                <HeaderDetails icon={<DocumentIcon className={iconClass}/>} info={c.contract_number}/>
                            </Tooltip>
                        }
                        {c?.customer_number &&
                            <Tooltip text="Customer Number">
                                <HeaderDetails icon={<UserIcon className={iconClass}/>} info={c.customer_number}/>
                            </Tooltip>
                        }
                        {c?.start_date &&
                            <Tooltip text="Start Date">
                                <HeaderDetails icon={<CalendarIcon className={iconClass}/>} info={dayjs(c.start_date).format('DD.MM.YYYY')}/>
                            </Tooltip>
                        }
                        {c?.costs != null &&
                            <Tooltip text="Costs">
                                <HeaderDetails icon={<BanknotesIcon className={iconClass}/>} info={formatCurrency(c.costs, c.currency)}/>
                            </Tooltip>
                        }
                        {hasRecurringBilling && c?.next_billing_date &&
                            <Tooltip text="Next Billing Date">
                                <HeaderDetails icon={<ClockIcon className={iconClass}/>} info={dayjs(c.next_billing_date).format('DD.MM.YYYY')}/>
                            </Tooltip>
                        }
                    </div>

                    <div className="flex gap-4">
                        <Button className="hover:cursor-pointer" to={`/contracts/${c?.id}/edit`}>
                            <PencilIcon/>
                            <span className="hidden lg:block">Edit Contract</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="mt-12">
                <Subheading>Summary</Subheading>
                <Divider className="mt-4"/>
                <DescriptionList>
                    {c?.company && <>
                        <DescriptionTerm>Company</DescriptionTerm>
                        <DescriptionDetails>{c.company}</DescriptionDetails>
                    </>}
                    <DescriptionTerm>Category</DescriptionTerm>
                    <DescriptionDetails>{c?.category}</DescriptionDetails>
                    {c?.contract_holder && <>
                        <DescriptionTerm>Contract Holder</DescriptionTerm>
                        <DescriptionDetails>{c.contract_holder}</DescriptionDetails>
                    </>}
                </DescriptionList>

                <Subheading className="mt-10">Details</Subheading>
                <Divider className="mt-4"/>
                <DescriptionList>
                    <DescriptionTerm>Start Date</DescriptionTerm>
                    <DescriptionDetails>{dayjs(c?.start_date).format('DD.MM.YYYY')}</DescriptionDetails>
                    {c?.end_date && <>
                        <DescriptionTerm>End Date</DescriptionTerm>
                        <DescriptionDetails>{dayjs(c.end_date).format('DD.MM.YYYY')}</DescriptionDetails>
                    </>}
                    {c?.contract_number && <>
                        <DescriptionTerm>Contract Number</DescriptionTerm>
                        <DescriptionDetails>{c.contract_number}</DescriptionDetails>
                    </>}
                    {c?.customer_number && <>
                        <DescriptionTerm>Customer Number</DescriptionTerm>
                        <DescriptionDetails>{c.customer_number}</DescriptionDetails>
                    </>}
                </DescriptionList>

                <Subheading className="mt-10">Billing</Subheading>
                <Divider className="mt-4"/>
                <DescriptionList>
                    <DescriptionTerm>Billing Period</DescriptionTerm>
                    <DescriptionDetails>{billingPeriodLabel(c?.billing_period)}</DescriptionDetails>
                    {c?.costs != null && <>
                        <DescriptionTerm>Costs</DescriptionTerm>
                        <DescriptionDetails>{formatCurrency(c.costs, c.currency)}</DescriptionDetails>
                    </>}
                    {hasRecurringBilling && c?.monthly_costs != null && <>
                        <DescriptionTerm>Monthly Costs</DescriptionTerm>
                        <DescriptionDetails>{formatCurrency(c.monthly_costs, c.currency)}</DescriptionDetails>
                    </>}
                    {hasRecurringBilling && c?.next_billing_date && <>
                        <DescriptionTerm>Next Billing Date</DescriptionTerm>
                        <DescriptionDetails>{dayjs(c.next_billing_date).format('DD.MM.YYYY')}</DescriptionDetails>
                    </>}
                </DescriptionList>

                {hasContact && <>
                    <Subheading className="mt-10">Contact Information</Subheading>
                    <Divider className="mt-4"/>
                    <DescriptionList>
                        {c?.contact_person && <>
                            <DescriptionTerm>Contact Person</DescriptionTerm>
                            <DescriptionDetails>{c.contact_person}</DescriptionDetails>
                        </>}
                        {c?.contact_address && <>
                            <DescriptionTerm>Address</DescriptionTerm>
                            <DescriptionDetails>
                                <LineBreakParagraph text={c.contact_address}/>
                            </DescriptionDetails>
                        </>}
                        {c?.contact_phone && <>
                            <DescriptionTerm>Phone</DescriptionTerm>
                            <DescriptionDetails>{c.contact_phone}</DescriptionDetails>
                        </>}
                        {c?.contact_email && <>
                            <DescriptionTerm>Email</DescriptionTerm>
                            <DescriptionDetails>{c.contact_email}</DescriptionDetails>
                        </>}
                    </DescriptionList>
                </>}

                {((c?.documents && c.documents.length > 0) || c?.notes) && <>
                    <Subheading className="mt-10">Documents & Notes</Subheading>
                    <Divider className="mt-4"/>
                    <DescriptionList>
                        {c?.documents && c.documents.length > 0 && <>
                            <DescriptionTerm>Documents</DescriptionTerm>
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
                            <DescriptionTerm>Notes</DescriptionTerm>
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
                    <span>Edit Contract</span>
                </Button>
            </div>
        </>
    )
}
