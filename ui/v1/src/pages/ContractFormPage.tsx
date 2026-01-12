import {useActionData, useLoaderData} from "react-router";
import {Heading} from "../components/catalyst/heading.tsx";
import {Divider} from "../components/catalyst/divider.tsx";
import type {AgreementDto, AgreementHolderDto} from "../gen/types.gen.ts";
import ContractForm from "../components/ContractForm.tsx";
import {useEffect} from "react";

export interface ContractPageProps {
    mode?: 'add' | 'edit';
}

type ActionData = {
    errors?: Record<string, string>;
    values?: Partial<AgreementDto>;
};

export default function ContractFormPage({mode}: ContractPageProps) {
    const data = useLoaderData() as { contract?: AgreementDto, holders?: AgreementHolderDto[] } | undefined;
    const contract: AgreementDto = data?.contract ?? ({} as AgreementDto);
    const holders: AgreementHolderDto[] = data?.holders ?? [];

    const actionData = useActionData() as ActionData | undefined;
    const defaults: Partial<AgreementDto> = actionData?.values ?? contract;

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [])

    return (
        <div>
            <Heading>{mode == 'add' ? 'Add ' : 'Edit '}Contract</Heading>
            <Divider className="my-10 mt-6"/>

            <ContractForm
                contract={defaults}
                holders={holders}/>
        </div>
    )
}
