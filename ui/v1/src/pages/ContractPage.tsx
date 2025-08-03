import {useActionData, useLoaderData} from "react-router";
import {Heading} from "../components/catalyst/heading.tsx";
import {Divider} from "../components/catalyst/divider.tsx";
import type {Contract} from "../gen/types.gen.ts";
import ContractForm from "../components/ContractForm.tsx";

export interface ContractPageProps {
    mode?: 'add' | 'edit';
}

type ActionData = {
    errors?: Record<string,string>;
    values?: Partial<Contract>;
};

export default function ContractPage({mode}: ContractPageProps) {
    const data = useLoaderData() as { contract?: Contract } | undefined;
    const contract: Contract = data?.contract ?? ({} as Contract);

    const actionData = useActionData() as ActionData | undefined;
    const defaults: Partial<Contract> = actionData?.values ?? contract;

    return (
        <div>
            <Heading>{mode == 'add' ? 'Add ' : ''}Contract</Heading>
            <Divider className="my-10 mt-6"/>

            <ContractForm contract={defaults}/>
        </div>
    )
}
