import {Heading} from "../components/catalyst/heading.tsx";
import {Divider} from "../components/catalyst/divider.tsx";
import {Field, Label} from "../components/catalyst/fieldset.tsx";
import {Select} from "../components/catalyst/select.tsx";
import {usePreferences} from "../stores/usePreferences.ts";

export default function SettingsPage() {
    const {mainCurrency, setMainCurrency} = usePreferences();

    return (
        <>
            <Heading>Settings</Heading>
            <Divider className="mt-4"/>

            <div className="mt-6 grid grid-cols-1 gap-6 max-w-md">
                <Field>
                    <Label>Main Currency</Label>
                    <Select
                        value={mainCurrency}
                        onChange={(e) => setMainCurrency(e.target.value)}
                    >
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                        <option value="CHF">CHF</option>
                    </Select>
                </Field>
            </div>
        </>
    )
}
