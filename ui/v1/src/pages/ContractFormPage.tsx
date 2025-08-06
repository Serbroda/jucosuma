import {useActionData, useLoaderData} from "react-router";
import {Heading} from "../components/catalyst/heading.tsx";
import {Divider} from "../components/catalyst/divider.tsx";
import type {ContractDto} from "../gen/types.gen.ts";
import ContractForm from "../components/ContractForm.tsx";

export interface ContractPageProps {
    mode?: 'add' | 'edit';
}

type ActionData = {
    errors?: Record<string,string>;
    values?: Partial<ContractDto>;
};

export default function ContractFormPage({mode}: ContractPageProps) {
    const data = useLoaderData() as { contract?: ContractDto } | undefined;
    const contract: ContractDto = data?.contract ?? ({} as ContractDto);

    const actionData = useActionData() as ActionData | undefined;
    const defaults: Partial<ContractDto> = actionData?.values ?? contract;

    return (
        <div>
            <Heading>{mode == 'add' ? 'Add ' : ''}Contract</Heading>
            <Divider className="my-10 mt-6"/>

            <ContractForm
                contract={defaults}/>
        </div>
    )
}
