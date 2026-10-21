import {useActionData, useLoaderData} from "react-router";
import {Heading} from "../components/catalyst/heading.tsx";
import {Divider} from "../components/catalyst/divider.tsx";
import type {AccountDto, CategoryDto, CompanyDto, ContractDto, ContractHolderDto, PersonDto, SavingsGoalDto} from "../gen/types.gen.ts";
import ContractForm from "../components/ContractForm.tsx";
import {useEffect} from "react";
import {useTranslation} from "react-i18next";

export interface ContractPageProps {
    mode?: 'add' | 'edit';
}

type ActionData = {
    error?: string;
    values?: Partial<ContractDto>;
};

export default function ContractFormPage({mode}: ContractPageProps) {
    const data = useLoaderData() as { contract?: ContractDto, holders?: ContractHolderDto[], companies?: CompanyDto[], categories?: CategoryDto[], persons?: PersonDto[], accounts?: AccountDto[], goals?: SavingsGoalDto[] } | undefined;
    const contract: ContractDto = data?.contract ?? ({} as ContractDto);
    const holders: ContractHolderDto[] = data?.holders ?? [];
    const companies: CompanyDto[] = data?.companies ?? [];
    const categories: CategoryDto[] = data?.categories ?? [];
    const persons: PersonDto[] = data?.persons ?? [];
    const accounts: AccountDto[] = data?.accounts ?? [];

    const {t} = useTranslation();
    const actionData = useActionData() as ActionData | undefined;
    const defaults: Partial<ContractDto> = actionData?.values ?? contract;

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [])

    return (
        <div>
            <Heading>{mode == 'add' ? t('entryForm.addTitle') : t('entryForm.editTitle')}</Heading>
            <Divider className="my-10 mt-6"/>

            <ContractForm
                contract={defaults}
                holders={holders}
                companies={companies}
                categories={categories}
                persons={persons}
                accounts={accounts}
                goals={data?.goals ?? []}
                mode={mode}
                error={actionData?.error}/>
        </div>
    )
}
