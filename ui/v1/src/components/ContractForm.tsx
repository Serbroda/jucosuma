import type {ContractDto} from "../gen/types.gen.ts";
import {Avatar} from "./catalyst/avatar.tsx";
import {Field, Label} from "./catalyst/fieldset.tsx";
import {Input} from "./catalyst/input.tsx";
import {Select} from "./catalyst/select.tsx";
import {Radio, RadioField, RadioGroup} from "./catalyst/radio.tsx";
import {Divider} from "./catalyst/divider.tsx";
import {Subheading} from "./catalyst/heading.tsx";
import {Button} from "./catalyst/button.tsx";
import {Form, useNavigate} from "react-router";
import {useState} from "react";
import {apiBasePath} from "../config.ts";
import {classNames} from "../utils/dom.utils.ts";
import image from "../assets/image.png";
import {Textarea} from "./catalyst/textarea.tsx";
import dayjs from "../lib/dayjs";
import ConfirmDialog from "./dialogs/ConfirmDialog.tsx";
import ChooseIconDialog from "./dialogs/ChooseIconDialog.tsx";
import {DocumentIcon, XMarkIcon} from "@heroicons/react/16/solid";
import {formatDecimal} from "../utils/number.utils.ts";

export interface ContractFormProps {
    contract: Partial<ContractDto>;
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
];

export default function ContractForm({contract}: ContractFormProps) {
    const navigation = useNavigate();
    const [isChooseIconOpen, setChooseIconOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    const deleteContract = async () => {
        const res = await fetch(`${apiBasePath}/contracts/${contract.id}`, {
            method: "DELETE",
        });
        if (res.ok) {
            navigation("/");
        }
    };

    const deleteDocument = async (documentId: number) => {
        const res = await fetch(`${apiBasePath}/documents/${documentId}`, {
            method: "DELETE",
        });
        if (res.ok) {
            navigation(`/contracts/${contract.id}/edit`);
        }
    }

    return (
        <>
            <ChooseIconDialog
                isOpen={isChooseIconOpen}
                onClose={() => setChooseIconOpen(false)}
                onSubmit={(iconSource) => {
                    contract.icon_source = iconSource;
                    setChooseIconOpen(false);
                }}
            />

            <ConfirmDialog
                isOpen={isDeleteOpen}
                title="Delete Contract"
                message="Do you really want to delete this contract?"
                onClose={() => setIsDeleteOpen(false)}
                submitLabel="Delete"
                onSubmit={async () => {
                    await deleteContract();
                    setIsDeleteOpen(false);
                }}
            />

            <Form
                method="post"
                encType="multipart/form-data"
                className="grid grid-cols-1 gap-4"
            >
                <div className="justify-self-center">
                    <Button
                        plain
                        onClick={() => setChooseIconOpen(true)}
                        className="hover:cursor-pointer"
                    >
                        <Avatar
                            square
                            className={classNames(
                                "w-16 h-16",
                                contract.icon_source ? "" : "dark:invert"
                            )}
                            src={contract.icon_source || image}
                        />
                    </Button>
                    <Input
                        type="hidden"
                        name="icon_source"
                        defaultValue={contract.icon_source ?? ""}
                    />
                </div>

                <Field>
                    <Label>Name</Label>
                    <Input
                        name="name"
                        placeholder="Enter contract name"
                        defaultValue={contract.name ?? ""}
                    />
                </Field>

                <Field>
                    <Label>Company</Label>
                    <Input
                        name="company"
                        placeholder="Enter company"
                        defaultValue={contract.company ?? ""}
                    />
                </Field>

                <Field>
                    <Label>Category</Label>
                    <Select
                        name="category"
                        defaultValue={contract.category ?? "Other"}
                    >
                        {categories.map((cat) => (
                            <option key={cat.name} value={cat.name}>
                                {cat.name}
                            </option>
                        ))}
                    </Select>
                </Field>

                <Field>
                    <Label>Type</Label>
                    <RadioGroup
                        name="contract_type"
                        defaultValue={contract.contract_type ?? "insurance"}
                    >
                        <RadioField>
                            <Radio value="insurance" defaultChecked={contract.contract_type === "insurance"}/>
                            <Label>Insurance</Label>
                        </RadioField>
                        <RadioField>
                            <Radio value="subscription" defaultChecked={contract.contract_type === "subscription"}/>
                            <Label>Subscription</Label>
                        </RadioField>
                    </RadioGroup>
                </Field>

                <Divider className="mt-6"/>
                <Subheading>Details</Subheading>

                <Field>
                    <Label>Start Date</Label>
                    <Input
                        type="date"
                        name="start_date"
                        defaultValue={
                            contract.start_date
                                ? dayjs(contract.start_date).format("YYYY-MM-DD")
                                : dayjs().format("YYYY-MM-DD")
                        }
                    />
                </Field>

                <Field>
                    <Label>End Date</Label>
                    <Input
                        type="date"
                        name="end_date"
                        defaultValue={
                            contract.end_date
                                ? dayjs(contract.end_date).format("YYYY-MM-DD")
                                : ""
                        }
                    />
                </Field>

                <Field>
                    <Label>Contract Number</Label>
                    <Input
                        name="contract_number"
                        defaultValue={contract.contract_number ?? ""}
                    />
                </Field>

                <Field>
                    <Label>Customer Number</Label>
                    <Input
                        name="customer_number"
                        defaultValue={contract.customer_number ?? ""}
                    />
                </Field>

                <Divider className="mt-6"/>
                <Subheading>Costs</Subheading>

                <Field>
                    <Label>Costs</Label>
                    <Input
                        type="text"
                        name="costs"
                        defaultValue={formatDecimal(contract.costs) ?? ""}
                        pattern="^-?\d+(.\d{1,2})?$"
                    />
                </Field>

                <Field>
                    <Label>Billing Period</Label>
                    <Select
                        name="billing_period"
                        defaultValue={contract.billing_period ?? "weekly"}
                    >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="biannually">Biannually</option>
                        <option value="annually">Annually</option>
                        <option value="every-two-years">Every two years</option>
                    </Select>
                </Field>

                <Divider className="mt-6"/>
                <Subheading>Data</Subheading>

                <Field>
                    <Label>Documents</Label>
                    <Input
                        type="file"
                        name="file"
                        multiple
                    />
                </Field>

                <div>
                    {contract.documents && contract.documents.map((doc) =>
                        <div key={doc.ID} className="flex grow min-w-0">
                            <a
                                href={`/uploads/${doc.Path}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex truncate items-center gap-2 text-sm/6 text-zinc-500 dark:text-zinc-400"
                            >
                                <DocumentIcon className="h-5 w-5 shrink-0 fill-zinc-400 dark:fill-zinc-500"/>
                                <span className="truncate">{doc.Title}</span>
                            </a>
                            <div className="grow"></div>
                            <Button
                                className="my-1 ml-1 lg:size-6 hover:cursor-pointer"
                                onClick={() => deleteDocument(doc.ID)}
                            >
                                <XMarkIcon/>
                            </Button>
                        </div>
                    )}
                </div>

                <Divider className="mt-6"/>
                <Subheading>Other</Subheading>

                <Field>
                    <Label>Notes</Label>
                    <Textarea
                        name="notes"
                        defaultValue={contract.notes ?? ""}
                    />
                </Field>

                <div className="flex mt-6 gap-4 lg:gap-2 flex-wrap">
                    <Button
                        type="button"
                        color="red"
                        onClick={() => setIsDeleteOpen(true)}
                        className="w-full lg:w-auto hover:cursor-pointer"
                    >
                        Delete
                    </Button>
                    <div className="hidden lg:block lg:grow"/>
                    <Button type="submit" className="w-full lg:w-auto hover:cursor-pointer">
                        Save
                    </Button>
                    <Button
                        type="button"
                        outline
                        onClick={() => navigation("/")}
                        className="w-full lg:w-auto hover:cursor-pointer"
                    >
                        Cancel
                    </Button>
                </div>
            </Form>
        </>
    );
}