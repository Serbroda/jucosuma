import {type FC, useEffect, useState, Fragment} from "react";
import {apiBasePath} from "../../config";
import {apiFetch} from "../../lib/fetch";
import {Button} from "../catalyst/button";
import {Avatar} from "../catalyst/avatar";
import {classNames} from "../../utils/dom.utils";
import {Input, InputGroup} from "../catalyst/input";
import {Field, Label} from "../catalyst/fieldset";
import {Dialog, DialogActions, DialogBody, DialogTitle} from "../catalyst/dialog";
import {MagnifyingGlassIcon} from "@heroicons/react/16/solid";
import {Tab, TabGroup, TabList, TabPanel, TabPanels} from "@headlessui/react";
import {fileToBase64} from "../../utils/data.utils.ts";

const tabs = [
    {label: 'Recent'},
    {label: 'Search'},
    {label: 'Upload'},
];

export interface ChooseIconDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (iconSource: string) => void;
}

const ChooseIconDialog: FC<ChooseIconDialogProps> = ({isOpen, onClose, onSubmit}) => {
    const [term, setTerm] = useState("");
    const [icons, setIcons] = useState<any[]>([]);
    const [recentIcons, setRecentIcons] = useState<string[]>([]);
    const [selectedIcon, setSelectedIcon] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            apiFetch(`${apiBasePath}/used_icons`)
                .then((res) => res.json())
                .then((data) => setRecentIcons(data ?? []))
                .catch(console.error);
        }
    }, [isOpen]);

    async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const data = await fileToBase64(file, {resizeTo: 128});
            setSelectedIcon(data);
        } catch (err) {
            console.error(err);
        }
    }

    useEffect(() => {
        if (!term) {
            setIcons([]);
            return;
        }
        const timer = setTimeout(() => {
            apiFetch(`${apiBasePath}/search_logos?term=${encodeURIComponent(term)}`)
                .then((res) => res.json())
                .then((data) => {
                    setIcons(data)
                })
                .catch(console.error);
        }, 750);
        return () => clearTimeout(timer);
    }, [term]);

    const iconGrid = (items: string[]) => (
        <div className="flex flex-wrap gap-2 mt-4">
            {items.map((icon, idx) => (
                <Avatar
                    key={idx}
                    src={icon}
                    square
                    className={classNames(
                        "w-11 h-11 hover:cursor-pointer",
                        selectedIcon === icon ? "border-2 border-indigo-500" : ""
                    )}
                    onClick={() =>
                        setSelectedIcon((prev) => prev === icon ? '' : icon)
                    }
                />
            ))}
        </div>
    );

    const actions = (
        <DialogActions>
            <Button
                disabled={!selectedIcon}
                onClick={() => onSubmit(selectedIcon)}
                className="hover:cursor-pointer"
            >
                Apply
            </Button>
            <Button plain onClick={onClose} className="hover:cursor-pointer">
                Cancel
            </Button>
        </DialogActions>
    );

    return (
        <Dialog open={isOpen} onClose={onClose}>
            <TabGroup defaultIndex={0}>
                <TabList className="flex gap-1 dark:bg-zinc-800 rounded-lg p-1 transition-all">
                    {tabs.map((t, idx) => (
                        <Tab key={idx} as={Fragment}>
                            {({selected}) => (
                                <button
                                    className={classNames(
                                        "flex-1 px-3 py-2 text-sm font-bold rounded-lg outline-none hover:cursor-pointer text-zinc-600 dark:text-zinc-300",
                                        selected
                                            ? "bg-zinc-100 dark:bg-zinc-900"
                                            : "hover:bg-zinc-100 dark:hover:dark:bg-zinc-900"
                                    )}
                                >
                                    {t.label}
                                </button>
                            )}
                        </Tab>
                    ))}
                </TabList>

                <TabPanels>
                    <TabPanel className="focus:outline-none mt-4">
                        <DialogTitle>Recent Icons</DialogTitle>
                        <DialogBody>
                            {recentIcons.length > 0
                                ? iconGrid(recentIcons)
                                : <p className="text-sm text-zinc-500 dark:text-zinc-400">No icons used yet.</p>
                            }
                        </DialogBody>
                        {actions}
                    </TabPanel>

                    <TabPanel className="focus:outline-none mt-4">
                        <DialogTitle>Search Icon</DialogTitle>
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
                            {icons?.length > 0 && iconGrid(icons.map((i: any) => i.logo))}
                        </DialogBody>
                        {actions}
                    </TabPanel>

                    <TabPanel className="focus:outline-none mt-4">
                        <DialogTitle>Upload Icon</DialogTitle>
                        <DialogBody>
                            <Field>
                                <Label>Icon</Label>
                                <Input
                                    type="file"
                                    name="file"
                                    onChange={handleChange}
                                    accept=".jpg,.jpeg,.png,.gif,.webp,.svg"
                                />
                            </Field>
                        </DialogBody>
                        {actions}
                    </TabPanel>
                </TabPanels>
            </TabGroup>
        </Dialog>
    );
};

export default ChooseIconDialog;
