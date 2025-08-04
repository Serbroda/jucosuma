import type {ContractDto} from "../gen/types.gen.ts";
import {Avatar} from "./catalyst/avatar.tsx";
import {Field, Label} from "./catalyst/fieldset.tsx";
import {Input, InputGroup} from "./catalyst/input.tsx";
import {Select} from "./catalyst/select.tsx";
import {Radio, RadioField, RadioGroup} from "./catalyst/radio.tsx";
import {Divider} from "./catalyst/divider.tsx";
import {Subheading} from "./catalyst/heading.tsx";
import {Button} from "./catalyst/button.tsx";
import {Form, useNavigate} from "react-router";
import {Dialog, DialogActions, DialogBody, DialogTitle} from "./catalyst/dialog.tsx";
import {type FC, useEffect, useState} from "react";
import {MagnifyingGlassIcon} from "@heroicons/react/16/solid";
import {apiBasePath} from "../config.ts";
import {classNames} from "../utils/dom.utils.ts";
import image from "../assets/image.png"
import {Textarea} from "./catalyst/textarea.tsx";

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
]

interface ChooseIconDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (iconSource: string) => void;
}

const ChooseIconDialog: FC<ChooseIconDialogProps> = ({isOpen, onClose, onSubmit}) => {
    const [term, setTerm] = useState('')
    const [icons, setIcons] = useState([] as any[])
    const [selectedIcon, setSelectedIcon] = useState({} as any)

    useEffect(() => {
        if (!term) {
            setIcons([]);
            return;
        }

        const timer = setTimeout(() => {
            fetch(`${apiBasePath}/logos?term=${encodeURIComponent(term)}`)
                .then(res => res.json())
                .then(data => setIcons(data))
                .catch(console.error);
        }, 750);

        return () => {
            clearTimeout(timer);
        };
    }, [term]);

    return (
        <Dialog open={isOpen} onClose={onClose}>
            <DialogTitle>Choose Icon</DialogTitle>
            <DialogBody>
                <Field>
                    <Label>Search</Label>
                    <InputGroup>
                        <MagnifyingGlassIcon/>
                        <Input
                            type="search"
                            name="term"
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                        />
                    </InputGroup>
                </Field>
                <div className="flex flex-wrap gap-2 mt-4">
                    {icons && icons.map((icon, idx) => (
                        <Avatar
                            key={idx}
                            src={icon.logo}
                            square
                            className={classNames("w-10 h-10 hover:cursor-pointer", (selectedIcon && selectedIcon.logo == icon.logo) ? 'border-2 border-indigo-500' : '')}
                            onClick={() => {
                                if (selectedIcon && selectedIcon.logo == icon.logo) {
                                    setSelectedIcon({})
                                    return
                                }
                                setSelectedIcon(icon)
                            }}
                        />
                    ))}
                </div>
            </DialogBody>
            <DialogActions>
                <Button plain onClick={() => onClose()}>
                    Cancel
                </Button>
                <Button
                    disabled={selectedIcon?.logo == undefined}
                    onClick={() => {
                        onSubmit(selectedIcon.logo)
                    }}>Apply</Button>
            </DialogActions>
        </Dialog>
    )
}

export default function ContractForm({contract}: ContractFormProps) {
    const navigation = useNavigate()
    const [isOpen, setIsOpen] = useState(false)

    const deleteContract = async () => {
        const res = await fetch(`${apiBasePath}/contracts/${contract.id}`, {
            method: 'DELETE',
        })
        if (res.ok) {
            navigation('/')
        }
    }

    return (
        <>
            <ChooseIconDialog
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                onSubmit={(iconSource) => {
                    console.log(iconSource)
                    contract.icon_source = iconSource
                    setIsOpen(false)
                }}
            />

            <Form
                method="post"
                className="grid grid-cols-1 gap-4"
                onChange={() => console.log("changed")}>

                <div className="justify-self-center">
                    <Button plain className="hover:cursor-pointer" onClick={() => setIsOpen(true)}>
                        <Avatar
                            square={true}
                            className={classNames("w-16 h-16", contract?.icon_source ? '' : 'dark:invert')}
                            src={contract?.icon_source || image}/>
                    </Button>

                    <Input type="hidden" name="icon_source" value={contract?.icon_source}/>
                </div>

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
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="biannually">Biannually</option>
                        <option value="annually">Annually</option>
                        <option value="every-to-years">Every two years</option>
                    </Select>
                </Field>

                <Divider className="mt-6"/>
                <Subheading>Data</Subheading>
                <Field>
                    <Label>Documents</Label>
                    <Input type="file" multiple={true} aria-label="Documents" name="documents" value={contract?.costs}/>
                </Field>
                {/*<Field>
                    <Label>Links</Label>
                    <div className="flex gap-2 mt-3 flex-wrap">
                        <Input type="text" aria-label="Links" name="links" value={contract?.costs} className="w-full lg:flex-1"/>
                        <Input type="text" aria-label="Links" name="links" value={contract?.costs} className="w-full lg:flex-2"/>
                        <Button type="button" className="w-full lg:w-auto hover:cursor-pointer"
                            onClick={() => setLinks([...links, {name: 'Dummy', url: 'https://www.google.de'}])}>
                            <PlusIcon className="w-5 h-5 "/>
                            <span className="block lg:hidden">Add Link</span>
                        </Button>
                    </div>
                    <ul className="mt-2 list-disc list-inside text-sm">
                        {links.map((link, idx) => (
                            <li key={idx}>
                                {link.name} - <a href={link.url} target="_blank">{link.url}</a>
                                <Button plain className="w-5 h-5 hover:cursor-pointer">
                                    <XMarkIcon className="w-5 h-5 "/>
                                </Button>
                            </li>
                        ))}
                    </ul>
                </Field>*/}

                <Divider className="mt-6"/>
                <Subheading>Other</Subheading>
                <Field>
                    <Label>Notes</Label>
                    <Textarea name="description"/>
                </Field>

                <div className="flex mt-6 gap-4 lg:gap-2 flex-wrap">
                    <Button type="button" className="w-full lg:w-auto hover:cursor-pointer" color="red"
                            onClick={() => deleteContract()}>Delete</Button>
                    <div className="hidden lg:block lg:grow"></div>
                    <Button type="submit" className="w-full lg:w-auto hover:cursor-pointer">Save</Button>
                    <Button type="button" className="w-full lg:w-auto hover:cursor-pointer" outline
                            onClick={() => navigation("/")}>Cancel</Button>
                </div>
            </Form>
        </>

    )
}
