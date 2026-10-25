import {type RefObject, useCallback, useEffect, useRef, useState} from "react";
import {useBlocker} from "react-router";

/** Comparable snapshot of a form's current values (files by name and size). */
function snapshot(form: HTMLFormElement): string {
    return JSON.stringify([...new FormData(form).entries()]
        .map(([key, value]) => [key, value instanceof File ? `${value.name}:${value.size}` : value]));
}

/**
 * Tracks whether a form differs from its initial values and guards leaving it: navigating to another
 * page asks first (`blocker`), closing or reloading the tab triggers the browser's warning.
 * Call `allowLeave()` right before an intended navigation (saving, deleting).
 */
export function useDirtyForm(formRef: RefObject<HTMLFormElement | null>) {
    const initial = useRef<string | null>(null);
    const leaving = useRef(false);
    const [dirty, setDirty] = useState(false);

    const check = useCallback(() => {
        const form = formRef.current;
        if (form && initial.current !== null) setDirty(snapshot(form) !== initial.current);
    }, [formRef]);

    // the initial values settle after the first renders (defaults set by effects)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (formRef.current) initial.current = snapshot(formRef.current);
        }, 300);
        return () => clearTimeout(timer);
    }, [formRef]);

    // fields set by state (hidden inputs, controlled fields, also in child components) change the DOM
    // without input events; React keeps their value attribute in sync, so watching the DOM catches them
    useEffect(() => {
        const form = formRef.current;
        if (!form) return;
        const observer = new MutationObserver(check);
        observer.observe(form, {subtree: true, childList: true, attributes: true, attributeFilter: ["value", "checked", "selected"]});
        return () => observer.disconnect();
    }, [formRef, check]);

    useEffect(() => {
        if (!dirty) return;
        const warn = (e: BeforeUnloadEvent) => {
            if (!leaving.current) e.preventDefault();
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    const blocker = useBlocker(({currentLocation, nextLocation}) =>
        dirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname);

    const allowLeave = useCallback((allowed = true) => {
        leaving.current = allowed;
    }, []);

    return {
        dirty,
        /** re-check after native input events (uncontrolled fields do not render) */
        check,
        blocker,
        allowLeave,
    };
}
