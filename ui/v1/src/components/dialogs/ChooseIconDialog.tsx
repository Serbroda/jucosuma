import {type FC, useEffect, useState} from "react";
import {apiBasePath} from "../../config.ts";
import {Button} from "../catalyst/button.tsx";
import {Avatar} from "../catalyst/avatar.tsx";
import {classNames} from "../../utils/dom.utils.ts";
import {Input, InputGroup} from "../catalyst/input.tsx";
import {Field, Label} from "../catalyst/fieldset.tsx";
import {Dialog, DialogActions, DialogBody, DialogTitle} from "../catalyst/dialog.tsx";
import {MagnifyingGlassIcon} from "@heroicons/react/16/solid";

export interface ChooseIconDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (iconSource: string) => void;
}

const ChooseIconDialog: FC<ChooseIconDialogProps> = ({
                                                         isOpen,
                                                         onClose,
                                                         onSubmit,
                                                     }) => {
    const [term, setTerm] = useState("");
    const [icons, setIcons] = useState([] as any[]);
    const [selectedIcon, setSelectedIcon] = useState({} as any);

    useEffect(() => {
        if (!term) {
            setIcons([]);
            return;
        }
        const timer = setTimeout(() => {
            fetch(`${apiBasePath}/logos?term=${encodeURIComponent(term)}`)
                .then((res) => res.json())
                .then((data) => setIcons(data))
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
                            autoFocus
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
                                selectedIcon.logo === icon.logo
                                    ? "border-2 border-indigo-500"
                                    : ""
                            )}
                            onClick={() => {
                                if (selectedIcon.logo === icon.logo) {
                                    setSelectedIcon({});
                                } else {
                                    setSelectedIcon(icon);
                                }
                            }}
                        />
                    ))}
                </div>
            </DialogBody>
            <DialogActions>
                <Button
                    disabled={!selectedIcon.logo}
                    onClick={() => onSubmit(selectedIcon.logo)}
                    className="hover:cursor-pointer"
                >
                    Apply
                </Button>
                <Button
                    plain
                    onClick={onClose}
                    className="hover:cursor-pointer"
                >
                    Cancel
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ChooseIconDialog;
