function replaceLineBreakWithBr(text: string | undefined | null): string {
    if (!text) {
        return '';
    }
    return text.replace(/\n/g, '<br />');
}

const LineBreakParagraph = ({text}: { text: string | undefined | null }) => {
    const html = replaceLineBreakWithBr(text);
    const innerHtml = {__html: html};
    return <p dangerouslySetInnerHTML={innerHtml}></p>
};

export default LineBreakParagraph;
