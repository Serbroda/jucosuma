import {useLoaderData} from "react-router";
import {Heading, Subheading} from "../components/catalyst/heading.tsx";
import {Divider} from "../components/catalyst/divider.tsx";
import type {ContractDto} from "../gen/types.gen.ts";
import {
    BanknotesIcon,
    CalendarIcon,
    DocumentIcon,
    PencilIcon,
    UserIcon,
} from "@heroicons/react/16/solid";
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


const HeaderDetails = ({icon, info}: { icon: ReactNode, info: string, tooltip?: string }) => {
    return (
        <span
            className={classNames("flex items-center gap-3 text-base/6 text-zinc-950 sm:text-sm/6 dark:text-white")}
        >
            {icon}
            <span>{info}</span>
        </span>
    )
}

export default function ContractPage() {
    const data = useLoaderData() as { contract: ContractDto } | undefined;

    useEffect(()=>{
        window.scrollTo(0, 0);
    },[])

    return (
        <>
            <div>
                <div className="flex items-center gap-4 lg:flex-wrap">
                    <Avatar
                        square={true}
                        className={classNames("w-10 h-10", data?.contract?.icon_source ? '' : 'dark:invert')}
                        src={data?.contract.icon_source || image}/>
                    <Heading className="truncate">{data?.contract.name}</Heading>
                </div>

                <div className="isolate mt-2.5 hidden lg:flex flex-wrap justify-between gap-x-6 gap-y-4">
                    <div className="flex flex-wrap gap-x-6 gap-y-4 py-1.5 lg:gap-x-10">
                        {data?.contract.contract_number &&
                            <Tooltip text="Contract Number">
                                <HeaderDetails
                                    icon={<DocumentIcon className="size-4 fill-zinc-400 dark:fill-zinc-500"/>}
                                    info={data?.contract.contract_number as string}
                                />
                            </Tooltip>
                        }
                        {data?.contract.customer_number &&
                            <Tooltip text="Customer Number">
                                <HeaderDetails
                                    icon={<UserIcon className="size-4 fill-zinc-400 dark:fill-zinc-500"/>}
                                    info={data?.contract.customer_number as string}
                                />
                            </Tooltip>
                        }
                        {data?.contract.start_date &&
                            <Tooltip text="Start Date">
                                <HeaderDetails
                                    icon={<CalendarIcon className="size-4 fill-zinc-400 dark:fill-zinc-500"/>}
                                    info={dayjs(data?.contract.start_date).format('DD.MM.YYYY')}
                                />
                            </Tooltip>
                        }
                        {data?.contract.costs &&
                            <Tooltip text="Costs">
                                <HeaderDetails
                                    icon={<BanknotesIcon className="size-4 fill-zinc-400 dark:fill-zinc-500"/>}
                                    info={formatCurrency(data?.contract.costs)}
                                />
                            </Tooltip>
                        }
                    </div>

                    <div className="flex gap-4">
                        <Button className="hover:cursor-pointer" to={`/contracts/${data?.contract.id}/edit`}>
                            <PencilIcon/>
                            <span className="hidden lg:block">Edit Contract</span>
                        </Button>
                    </div>
                </div>
            </div>

            <div className="mt-12">
                <Subheading>Summary</Subheading>
                <Divider className="mt-4"/>
                <DescriptionList>
                    <DescriptionTerm>Company</DescriptionTerm>
                    <DescriptionDetails>{data?.contract.company}</DescriptionDetails>
                    <DescriptionTerm>Category</DescriptionTerm>
                    <DescriptionDetails>{data?.contract.category}</DescriptionDetails>
                    <DescriptionTerm>Type</DescriptionTerm>
                    <DescriptionDetails className="capitalize">{data?.contract.contract_type}</DescriptionDetails>
                </DescriptionList>

                <Subheading className="mt-10">Details</Subheading>
                <Divider className="mt-4"/>
                <DescriptionList>
                    <DescriptionTerm>Start Date</DescriptionTerm>
                    <DescriptionDetails>{dayjs(data?.contract.start_date).format('DD.MM.YYYY')}</DescriptionDetails>
                    <DescriptionTerm>End Date</DescriptionTerm>
                    <DescriptionDetails>{data?.contract.end_date ? dayjs(data?.contract.end_date).format('DD.MM.YYYY') : ''}</DescriptionDetails>
                    <DescriptionTerm>Contract Number</DescriptionTerm>
                    <DescriptionDetails>{data?.contract.contract_number}</DescriptionDetails>
                    <DescriptionTerm>Customer Number</DescriptionTerm>
                    <DescriptionDetails>{data?.contract.customer_number}</DescriptionDetails>
                </DescriptionList>

                <Subheading className="mt-10">Costs</Subheading>
                <Divider className="mt-4"/>
                <DescriptionList>
                    <DescriptionTerm>Costs</DescriptionTerm>
                    <DescriptionDetails>{formatCurrency(data?.contract.costs)}</DescriptionDetails>
                    <DescriptionTerm>Billing Period</DescriptionTerm>
                    <DescriptionDetails className="capitalize">{data?.contract.billing_period}</DescriptionDetails>
                </DescriptionList>

                <Subheading className="mt-10">Contact Information</Subheading>
                <Divider className="mt-4"/>
                <DescriptionList>
                    <DescriptionTerm>Contact Person</DescriptionTerm>
                    <DescriptionDetails>{data?.contract.contact_person}</DescriptionDetails>
                    <DescriptionTerm>Address</DescriptionTerm>
                    <DescriptionDetails>
                        <LineBreakParagraph text={data?.contract.contact_address}/>
                    </DescriptionDetails>
                    <DescriptionTerm>Phone</DescriptionTerm>
                    <DescriptionDetails>{data?.contract.contact_phone}</DescriptionDetails>
                    <DescriptionTerm>Email</DescriptionTerm>
                    <DescriptionDetails>{data?.contract.contact_email}</DescriptionDetails>
                </DescriptionList>


                <Subheading className="mt-10">Data</Subheading>
                <Divider className="mt-4"/>
                <DescriptionList>
                    <DescriptionTerm>Documents</DescriptionTerm>
                    <DescriptionDetails>
                        {data?.contract.documents && data?.contract.documents.map((doc) =>
                            <div key={doc.id} className="flex grow min-w-0">
                                <a
                                    href={`/uploads/${doc.path}`}
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
                </DescriptionList>

                <Subheading className="mt-10">Other</Subheading>
                <Divider className="mt-4"/>
                <DescriptionList>
                    <DescriptionTerm>Notes</DescriptionTerm>
                    <DescriptionDetails>
                        <LineBreakParagraph text={data?.contract.notes}/>
                    </DescriptionDetails>
                </DescriptionList>
            </div>

            <div className="flex gap-4 lg:hidden mt-6 w-full">
                <Button className="hover:cursor-pointer w-full" to={`/contracts/${data?.contract.id}/edit`}>
                    <PencilIcon/>
                    <span>Edit Contract</span>
                </Button>
            </div>
        </>
    )
}
