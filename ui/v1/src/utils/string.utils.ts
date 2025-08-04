function startWithAnyIgnoreCase(term: string | undefined, ...texts: string[]): boolean {
    if (!term) {
        return true;
    }
    for (const text of texts) {
        if (!text) {
            continue;
        }
        if (text.toLowerCase().startsWith(term.toLowerCase())) {
            return true;
        }
    }
    return false;
}

function startWithIgnoreCase(term: string, text: string): boolean {
    if (!term) {
        return true;
    }
    if (!text) {
        return false;
    }
    return text.toLowerCase().startsWith(term.toLowerCase());
}

export {startWithAnyIgnoreCase, startWithIgnoreCase}