import {useLoaderData} from "react-router";
import {Heading, Subheading} from "../components/catalyst/heading.tsx";
import {Divider} from "../components/catalyst/divider.tsx";
import type {ContractDto} from "../gen/types.gen.ts";
import {
    CalendarIcon,
    ChevronLeftIcon,
    CreditCardIcon,
    HashtagIcon,
    PencilIcon,
} from "@heroicons/react/16/solid";
import {Button} from "../components/catalyst/button.tsx";
import {Link} from "../components/catalyst/link.tsx";
import {DescriptionDetails, DescriptionList, DescriptionTerm} from "../components/catalyst/description-list.tsx";
import {Avatar} from "../components/catalyst/avatar.tsx";
import {classNames} from "../utils/dom.utils.ts";
import image from "../assets/image.png";
import type {ReactNode} from "react";

const HeaderDetails = ({icon, info}: { icon: ReactNode, info: string }) => {
    return (
        <span className="flex items-center gap-3 text-base/6 text-zinc-950 sm:text-sm/6 dark:text-white">
            {icon}
            <span>{info}</span>
        </span>
    )
}

export default function ContractPage() {
    const data = useLoaderData() as { contract: ContractDto } | undefined;

    return (
        <>
            <div className="max-lg:hidden">
                <Link href="/orders"
                      className="inline-flex items-center gap-2 text-sm/6 text-zinc-500 dark:text-zinc-400">
                    <ChevronLeftIcon className="size-4 fill-zinc-400 dark:fill-zinc-500"/>
                    Orders
                </Link>
            </div>
            <div className="mt-4 lg:mt-8">
                <div className="flex items-center gap-4">
                    <Avatar
                        square={true}
                        className={classNames("w-10 h-10", data?.contract?.icon_source ? '' : 'dark:invert')}
                        src={data?.contract.icon_source || image}/>
                    <Heading>{data?.contract.name}</Heading>
                </div>
                <div className="isolate mt-2.5 flex flex-wrap justify-between gap-x-6 gap-y-4">
                    <div className="flex flex-wrap gap-x-10 gap-y-4 py-1.5">

                        <HeaderDetails
                            icon={<HashtagIcon className="size-4 fill-zinc-400 dark:fill-zinc-500"/>}
                            info={data?.contract.contract_number as string}
                        />
                        <span
                            className="flex items-center gap-3 text-base/6 text-zinc-950 sm:text-sm/6 dark:text-white">
              <CreditCardIcon className="size-4 shrink-0 fill-zinc-400 dark:fill-zinc-500"/>
              <span className="inline-flex gap-3">
               {/* {order.payment.card.type}{' '}*/}
                  <span>
                  <span aria-hidden="true">••••</span> #123231
                </span>
              </span>
            </span>
                        <span
                            className="flex items-center gap-3 text-base/6 text-zinc-950 sm:text-sm/6 dark:text-white">
              <CalendarIcon className="size-4 shrink-0 fill-zinc-400 dark:fill-zinc-500"/>
              <span>DATUM</span>
            </span>
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
                    <DescriptionTerm>Customer</DescriptionTerm>
                    <DescriptionDetails>{data?.contract.name}</DescriptionDetails>
                    <DescriptionTerm>Event</DescriptionTerm>
                </DescriptionList>
            </div>
        </>
    )
}
