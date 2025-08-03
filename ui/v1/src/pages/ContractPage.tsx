import {useLoaderData} from "react-router";

export default function ContractPage() {
    const data = useLoaderData();

    return (
        <div>
            <h1>Contract</h1>
            <p>{data?.contract?.id}</p>
        </div>
    )
}
