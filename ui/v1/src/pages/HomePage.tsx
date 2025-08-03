import {NavLink, useLoaderData} from "react-router";
import {Button} from "../components/catalyst/button.tsx";
import {ChevronRightIcon, PlusIcon} from "@heroicons/react/16/solid";
import {Badge} from "../components/catalyst/badge.tsx";
import {classNames} from "../utils/dom.utils.ts";
import image from "../assets/image.png";
import {Avatar} from "../components/catalyst/avatar.tsx";

export default function HomePage() {
    const {contracts} = useLoaderData();

    return (
        <>
            <h1>Home</h1>

            <div className="flex flex-col gap-4">
                <Button className="self-end hover:cursor-pointer" to="/contracts/add">
                    <PlusIcon/>
                    Add Contract
                </Button>

                <ul className="flex flex-col">
                    {contracts?.map((contract: any) =>
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
                                    <div className="truncate text-base/6 font-semibold text-zinc-950 dark:text-white">{contract.name}</div>
                                    <div  className="text-sm/6 text-zinc-500 dark:text-zinc-400">{contract.contract_type} - {contract.company}</div>
                                </div>

                                <Badge className="shrink-0">{contract.costs} €</Badge>
                                <ChevronRightIcon className={"h-5 w-5 shrink-0 text-zinc-950 dark:text-white"}/>
                            </NavLink>
                        </li>
                    )}
                </ul>
            </div>
        </>
    )
}
