import type {Contract} from "../gen/types.gen.ts";
import {Avatar} from "./catalyst/avatar.tsx";
import {Field, Label} from "./catalyst/fieldset.tsx";
import {Input} from "./catalyst/input.tsx";
import {Select} from "./catalyst/select.tsx";
import {Radio, RadioField, RadioGroup} from "./catalyst/radio.tsx";
import {Divider} from "./catalyst/divider.tsx";
import {Subheading} from "./catalyst/heading.tsx";
import {Button} from "./catalyst/button.tsx";
import {Form} from "react-router";

export interface ContractFormProps {
    contract: Partial<Contract>;
}

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

export default function ContractForm({contract}: ContractFormProps) {
    return (
        <Form
            method="post"
            className="grid grid-cols-1 gap-4"
            onChange={() => console.log("changed")}>

            <Avatar
                square={true}
                className="w-16 h-16 justify-self-center"
                src="https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/92/07/d3/9207d35e-9b61-0249-56a2-e010711d69c9/AppIcon-0-0-1x_U007emarketing-0-8-0-sRGB-85-220.png/100x100bb.jpg"/>

            <Field>
                <Label>Name</Label>
                <Input aria-label="Name" name="name" value={contract?.name}/>
            </Field>
            <Field>
                <Label>Company</Label>
                <Input aria-label="Company Name" name="company" value={contract?.company}/>
            </Field>
            <Field>
                <Label>Category</Label>
                <Select aria-label="Category" name="category" defaultValue="Other" value={contract?.category}>
                    {categories.map((cat, idx) => (
                        <option key={idx} value={cat.name}>{cat.name}</option>
                    ))}
                </Select>
            </Field>
            <Field>
                <Label>Type</Label>
                <RadioGroup name="contract_type" defaultValue="insurance" aria-label="Contract Type"
                            value={contract?.contract_type}>
                    <RadioField>
                        <Radio value="insurance"/>
                        <Label>Insurance</Label>
                    </RadioField>
                    <RadioField>
                        <Radio value="subscription"/>
                        <Label>Subscription</Label>
                    </RadioField>
                </RadioGroup>
            </Field>

            <Divider className="mt-6"/>
            <Subheading>Details</Subheading>
            <Field>
                <Label>Start Date</Label>
                <Input type="date" aria-label="Start Date" name="start_date" value={contract?.start_date}/>
            </Field>
            <Field>
                <Label>End Date</Label>
                <Input type="date" aria-label="End Date" name="end_date" value={contract?.end_date}/>
            </Field>
            <Field>
                <Label>Contract Number</Label>
                <Input aria-label="Contract Number" name="contract_number" value={contract?.contract_number}/>
            </Field>
            <Field>
                <Label>Customer Number</Label>
                <Input aria-label="Customer Number" name="customer_number" value={contract?.customer_number}/>
            </Field>

            <Divider className="mt-6"/>
            <Subheading>Costs</Subheading>
            <Field>
                <Label>Costs</Label>
                <Input type="number" aria-label="Costs" name="costs" value={contract?.costs}/>
            </Field>
            <Field>
                <Label>Billing Period</Label>
                <Select aria-label="Billing Period" name="billing_period" defaultValue="weekly"
                        value={contract?.billing_period}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                </Select>
            </Field>

            <div className="flex justify-end mt-6">
                <Button type="submit" className="grow lg:grow-0">Save</Button>
            </div>
        </Form>
    )
}
