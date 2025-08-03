import {useLoaderData} from "react-router";
import {Heading, Subheading} from "../components/catalyst/heading.tsx";
import {Divider} from "../components/catalyst/divider.tsx";
import {Input} from "../components/catalyst/input.tsx";
import {Field, Label} from "../components/catalyst/fieldset.tsx";
import {Avatar} from "../components/catalyst/avatar.tsx";
import {Radio, RadioField, RadioGroup} from "../components/catalyst/radio.tsx";
import {Select} from "../components/catalyst/select.tsx";

const categories = [
    {name: "Other"},
    {name: "Education"},
    {name: "Entertainment"},
    {name: "Finance"},
    {name: "Health & Fitness"},
    {name: "Housing & Rent"},
    {name: "Insurance"},
    {name: "Software & Services"},
    {name: "Telecommunications & Internet"},
    {name: "Transportation"},
    {name: "Utilities"},
]

export interface ContractPageProps {
    mode?: 'add' | 'edit';
}

export default function ContractPage({mode}: ContractPageProps) {
    const data = useLoaderData();
    const contract = data?.contract || {} as any;
    console.log(contract)

    return (
        <div>
            <Heading>{mode == 'add' ? 'Add ' : ''}Contract</Heading>
            <Divider className="my-10 mt-6"/>

            <form method="post" className="grid grid-cols-1 gap-4">

                <Avatar
                    square={true}
                    className="w-16 h-16 justify-self-center"
                    src="https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/92/07/d3/9207d35e-9b61-0249-56a2-e010711d69c9/AppIcon-0-0-1x_U007emarketing-0-8-0-sRGB-85-220.png/100x100bb.jpg"/>

                <Field>
                    <Label>Name</Label>
                    <Input aria-label="Name" name="name"/>
                </Field>
                <Field>
                    <Label>Company</Label>
                    <Input aria-label="Company Name" name="name"/>
                </Field>
                <Field>
                    <Label>Category</Label>
                    <Select aria-label="Category" name="category" defaultValue="Other">
                        {categories.map((cat, idx) => (
                            <option key={idx} value={cat.name}>{cat.name}</option>
                        ))}
                    </Select>
                </Field>
                <Field>
                    <Label>Holder</Label>
                    <Select aria-label="Holder" name="contract_holder">

                    </Select>
                </Field>
                <Field>
                    <Label>Type</Label>
                    <RadioGroup name="contract_type" defaultValue="insurance" aria-label="Contract Type">
                        <RadioField>
                            <Radio value="insurance" />
                            <Label>Insurance</Label>
                        </RadioField>
                        <RadioField>
                            <Radio value="subscription" />
                            <Label>Subscription</Label>
                        </RadioField>
                    </RadioGroup>
                </Field>

                <Divider className="mt-6"/>
                <Subheading>Details</Subheading>
                <Field>
                    <Label>Start Date</Label>
                    <Input type="date" aria-label="Start Date" name="start_date"/>
                </Field>
                <Field>
                    <Label>End Date</Label>
                    <Input type="date" aria-label="End Date" name="end_date"/>
                </Field>
                <Field>
                    <Label>Contract Number</Label>
                    <Input aria-label="Contract Number" name="contract_number"/>
                </Field>
                <Field>
                    <Label>Customer Number</Label>
                    <Input aria-label="Customer Number" name="customer_number"/>
                </Field>

                <Divider className="mt-6"/>
                <Subheading>Costs</Subheading>
                <Field>
                    <Label>Costs</Label>
                    <Input type="number" aria-label="Costs" name="costs"/>
                </Field>
                <Field>
                    <Label>Billing Period</Label>
                    <Select aria-label="Billing Period" name="billing_period" defaultValue="weekly">
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                    </Select>
                </Field>
            </form>
        </div>
    )
}
