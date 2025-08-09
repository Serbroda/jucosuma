import {NavLink, useLoaderData} from "react-router";
import {Button} from "../components/catalyst/button.tsx";
import {ChevronRightIcon, MagnifyingGlassIcon, PlusIcon} from "@heroicons/react/16/solid";
import {Badge} from "../components/catalyst/badge.tsx";
import {classNames} from "../utils/dom.utils.ts";
import image from "../assets/image.png";
import {Avatar} from "../components/catalyst/avatar.tsx";
import {Input, InputGroup} from "../components/catalyst/input.tsx";
import {useEffect, useState} from "react";
import {startWithAnyIgnoreCase} from "../utils/string.utils.ts";
import {formatCurrency} from "../utils/number.utils.ts";
import {billingPeriodShorthand} from "../utils/data.utils.ts";

export default function HomePage() {
    const {contracts} = useLoaderData();
    const [search, setSearch] = useState('')

    useEffect(()=>{
        window.scrollTo(0, 0);
    },[])

    return (
        <>
            <h1>Home</h1>

            <div className="flex flex-col gap-4">

                <div className="flex gap-2 pt-6 pb-4">
                    <div className="flex-grow">
                        <InputGroup>
                            <MagnifyingGlassIcon/>
                            <Input
                                type="search"
                                name="term"
                                placeholder="Search"
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </InputGroup>
                    </div>
                    <Button className="self-end hover:cursor-pointer" to="/contracts/add">
                        <PlusIcon/>
                        <span className="hidden lg:block">Add Contract</span>
                    </Button>
                </div>

                <ul className="flex flex-col">
                    {contracts
                        ?.filter((contract: any) => startWithAnyIgnoreCase(search, contract.name, contract.company))
                        .map((contract: any) =>

                            <li
                                key={contract.id}
                                className="">
                                <NavLink
                                    to={"/contracts/" + contract.id}
                                    className="p-2 flex gap-2 items-center border-b border-zinc-200 dark:border-zinc-800 hover:cursor-pointer hover:bg-zinc-950/5 dark:hover:bg-white/5">

                                    <Avatar
                                        square={true}
                                        className={classNames("w-10 h-10", contract?.icon_source ? '' : 'dark:invert')}
                                        src={contract?.icon_source || image}/>

                                    <div className="flex flex-col grow min-w-0">
                                        <div
                                            className="truncate text-base/6 font-semibold text-zinc-950 dark:text-white">{contract.name}</div>
                                        <div
                                            className="text-sm/6 text-zinc-500 dark:text-zinc-400">
                                            <span
                                                className="capitalize">{contract.contract_type}</span> - {contract.company}
                                        </div>
                                    </div>

                                    {contract.costs && <Badge className="shrink-0">{formatCurrency(contract.costs) + (contract.billing_period ? ` ${billingPeriodShorthand(contract.billing_period)}` : '')}</Badge>}
                                    <ChevronRightIcon className={"h-5 w-5 shrink-0 text-zinc-950 dark:text-white"}/>
                                </NavLink>
                            </li>
                        )}
                </ul>
            </div>
        </>
    )
}
