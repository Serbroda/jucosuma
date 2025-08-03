import {Link, useLoaderData} from "react-router";

export default function HomePage() {
    const data = useLoaderData();

    return (
        <div>
            <h1>Home</h1>
            {data.contracts && data.contracts.map((contract: any) =>
                <div key={contract.id}>
                    <Link to={"/contracts/" + contract.id}>{contract.name}</Link>
                </div>
            )}
        </div>
    )
}
