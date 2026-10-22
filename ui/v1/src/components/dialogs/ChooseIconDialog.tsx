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
import {useTranslation} from "react-i18next";
import {ColorPicker, IconPicker} from "../ui/ColorIconPicker.tsx";
import IconTile from "../ui/IconTile.tsx";
import {parseSymbol, symbolSource} from "../../lib/icons.ts";

export interface ChooseIconDialogProps {
    isOpen: boolean;
    onClose: () => void;
    /** Called with the chosen icon source; an empty string removes the icon. */
    onSubmit: (iconSource: string) => void;
}

const ChooseIconDialog: FC<ChooseIconDialogProps> = ({isOpen, onClose, onSubmit}) => {
    const {t} = useTranslation();
    const tabs = [t('icons.symbols'), t('icons.recent'), t('icons.search'), t('icons.upload')];
    const [term, setTerm] = useState("");
    const [icons, setIcons] = useState<any[]>([]);
    const [recentIcons, setRecentIcons] = useState<string[]>([]);
    const [selectedIcon, setSelectedIcon] = useState<string>('');
    const [symbol, setSymbol] = useState<string | undefined>();
    const [symbolColor, setSymbolColor] = useState<number | undefined>(1);

    useEffect(() => {
        if (isOpen) {
            setSelectedIcon('');
            setSymbol(undefined);
            apiFetch(`${apiBasePath}/used_icons`)
                .then((res) => res.json())
                .then((data) => setRecentIcons(data ?? []))
                .catch(console.error);
        }
    }, [isOpen]);

    const chooseSymbol = (icon: string | undefined, color: number | undefined) => {
        setSymbol(icon);
        setSymbolColor(color);
        if (icon) setSelectedIcon(symbolSource(icon, color));
    };

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
            {items.map((icon, idx) => {
                const parsed = parseSymbol(icon);
                const selected = selectedIcon === icon;
                const toggle = () => setSelectedIcon((prev) => prev === icon ? '' : icon);
                return parsed ? (
                    <button key={idx} type="button" onClick={toggle}
                            className={classNames("rounded-lg hover:cursor-pointer", selected ? "ring-2 ring-indigo-500" : "")}>
                        <IconTile icon={parsed.icon} color={parsed.color} className="size-11"/>
                    </button>
                ) : (
                    <Avatar
                        key={idx}
                        src={icon}
                        square
                        className={classNames(
                            "w-11 h-11 hover:cursor-pointer",
                            selected ? "border-2 border-indigo-500" : ""
                        )}
                        onClick={toggle}
                    />
                );
            })}
        </div>
    );

    const actions = (
        <DialogActions>
            <Button plain onClick={() => onSubmit('')} className="hover:cursor-pointer sm:mr-auto">
                {t('icons.remove')}
            </Button>
            <Button plain onClick={onClose} className="hover:cursor-pointer">
                {t('common.cancel')}
            </Button>
            <Button
                disabled={!selectedIcon}
                onClick={() => onSubmit(selectedIcon)}
                className="hover:cursor-pointer"
            >
                {t('common.apply')}
            </Button>
        </DialogActions>
    );

    return (
        <Dialog open={isOpen} onClose={onClose}>
            {/* title on top as in every dialog, so the close button does not cover the tabs */}
            <DialogTitle>{t('icons.title')}</DialogTitle>
            <TabGroup defaultIndex={0} className="mt-4">
                <TabList className="flex gap-1 dark:bg-zinc-800 rounded-lg p-1 transition-all">
                    {tabs.map((label, idx) => (
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
                                    {label}
                                </button>
                            )}
                        </Tab>
                    ))}
                </TabList>

                <TabPanels>
                    <TabPanel className="focus:outline-none mt-4">
                        <DialogBody className="flex flex-col gap-4">
                            <ColorPicker value={symbolColor} onChange={(color) => chooseSymbol(symbol, color)}/>
                            <IconPicker value={symbol} color={symbolColor} onChange={(icon) => chooseSymbol(icon, symbolColor)}/>
                        </DialogBody>
                        {actions}
                    </TabPanel>

                    <TabPanel className="focus:outline-none mt-4">
                        <DialogBody>
                            {recentIcons.length > 0
                                ? iconGrid(recentIcons)
                                : <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('icons.noneUsed')}</p>
                            }
                        </DialogBody>
                        {actions}
                    </TabPanel>

                    <TabPanel className="focus:outline-none mt-4">
                        <DialogBody>
                            <Field>
                                <Label>{t('common.search')}</Label>
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
                        <DialogBody>
                            <Field>
                                <Label>{t('icons.icon')}</Label>
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
