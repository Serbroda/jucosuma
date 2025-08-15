import { type FC, useEffect, useState, Fragment } from "react";
import { apiBasePath } from "../../config";
import { Button } from "../catalyst/button";
import { Avatar } from "../catalyst/avatar";
import { classNames } from "../../utils/dom.utils";
import { Input, InputGroup } from "../catalyst/input";
import { Field, Label } from "../catalyst/fieldset";
import { Dialog, DialogActions, DialogBody, DialogTitle } from "../catalyst/dialog";
import { MagnifyingGlassIcon } from "@heroicons/react/16/solid";
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";

export interface ChooseIconDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (iconSource: string) => void;
}

const ChooseIconDialog: FC<ChooseIconDialogProps> = ({ isOpen, onClose, onSubmit }) => {
    const [term, setTerm] = useState("");
    const [icons, setIcons] = useState<any[]>([]);
    const [selectedIcon, setSelectedIcon] = useState<any>({});

    useEffect(() => {
        if (!term) {
            setIcons([]);
            return;
        }
        const timer = setTimeout(() => {
            fetch(`${apiBasePath}/search_logos?term=${encodeURIComponent(term)}`)
                .then((res) => res.json())
                .then((data) => setIcons(data))
                .catch(console.error);
        }, 750);
        return () => clearTimeout(timer);
    }, [term]);

    const tabs = [{
        label: 'Upload Icon',
    }, {
        label: 'Search Icon',
    }]

    return (
        <Dialog open={isOpen} onClose={onClose}>
            <TabGroup defaultIndex={1}>

                <TabList className="flex gap-2">
                    {tabs.map((t, idx) => {
                        return (
                            <Tab key={idx} as={Fragment}>
                                {({ selected }) => (
                                    <button
                                        className={classNames(
                                            "flex-1 px-3 py-2 text-sm font-bold rounded outline-none hover:cursor-pointer text-zinc-600 dark:text-zinc-300",
                                            selected
                                                ? "bg-zinc-100 dark:bg-zinc-700 font-medium"
                                                : "hover:bg-zinc-100 dark:hover:bg-zinc-700 "
                                        )}
                                    >
                                        {t.label}
                                    </button>
                                )}
                            </Tab>
                        )
                    })}
                </TabList>

                <TabPanels className="mt-4">
                    <TabPanel className="focus:outline-none">
                        <DialogTitle>Upload Icon</DialogTitle>
                        <DialogBody>
                            <Field>
                                <Label>Upload</Label>

                            </Field>
                        </DialogBody>
                    </TabPanel>

                    <TabPanel className="focus:outline-none">
                        <DialogTitle>Search Icon</DialogTitle>
                        <DialogBody>
                            <Field>
                                <Label>Search</Label>
                                <InputGroup>
                                    <MagnifyingGlassIcon />
                                    <Input
                                        type="search"
                                        name="term"
                                        value={term}
                                        onChange={(e) => setTerm(e.target.value)}
                                    />
                                </InputGroup>
                            </Field>
                            <div className="flex flex-wrap gap-2 mt-4 hover:cursor-pointer">
                                {icons.map((icon, idx) => (
                                    <Avatar
                                        key={idx}
                                        src={icon.logo}
                                        square
                                        className={classNames(
                                            "w-11 h-11 hover:cursor-pointer",
                                            selectedIcon.logo === icon.logo ? "border-2 border-indigo-500" : ""
                                        )}
                                        onClick={() =>
                                            setSelectedIcon((prev: any) =>
                                                prev.logo === icon.logo ? {} : icon
                                            )
                                        }
                                    />
                                ))}
                            </div>
                        </DialogBody>
                    </TabPanel>
                </TabPanels>
            </TabGroup>

            <DialogActions>
                <Button
                    disabled={!selectedIcon.logo}
                    onClick={() => onSubmit(selectedIcon.logo)}
                    className="hover:cursor-pointer"
                >
                    Apply
                </Button>
                <Button plain onClick={onClose} className="hover:cursor-pointer">
                    Cancel
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ChooseIconDialog;
