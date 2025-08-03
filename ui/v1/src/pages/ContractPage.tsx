import {useParams} from "react-router";
import {useEffect, useState} from "react";
import {apiBasePath} from "../config.ts";

export default function ContractPage() {
    const params = useParams();
    const [contract, setContract] = useState<any>(null);

    useEffect(() => {
        fetch(`${apiBasePath}/contracts/${params.id}`)
        .then(res => res.json())
        .then(setContract)
    }, [params])

    return (
        <div>
            <h1>Contract</h1>
            <p>{contract?.id}</p>
        </div>
    )
}
