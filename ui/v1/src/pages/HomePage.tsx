import {Link, useLoaderData} from "react-router";
import {Button} from "../components/catalyst/button.tsx";
import {PlusIcon} from "@heroicons/react/16/solid";

export default function HomePage() {
    const {contracts} = useLoaderData();

    return (
        <>
            <h1>Home</h1>

            <div className="flex flex-col gap-4">
                <Button className="self-end hover:cursor-pointer" to="/contracts/add">
                    <PlusIcon />
                    Add Contract
                </Button>

                {contracts?.map((contract: any) =>
                    <div key={contract.id}>
                        <Link to={"/contracts/" + contract.id}>{contract.name}</Link>
                    </div>
                )}
            </div>
        </>
    )
}
