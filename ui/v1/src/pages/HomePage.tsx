import {useEffect, useState} from "react";
import {apiBasePath} from "../config.ts";

export default function HomePage() {
    const [contracts, setContracts] = useState<any[]>([]);

    useEffect(() => {
        fetch(`${apiBasePath}/contracts`)
            .then(res => res.json())
            .then(setContracts)
    }, [])

    return (
        <div>
            <h1>Home</h1>
            {contracts && contracts.map(contract =>
                <div key={contract.id}>
                    <h2>{contract.name}</h2>
                </div>
            )}
        </div>
    )
}
