// Acade.me for Word — the pure part of the add-in (unit-tested in
// __tests__/wordAddinCore.test.ts): reading the library file the app
// exports, searching it, and laying out a document's citations and
// bibliography. Citations live in Word content controls tagged with the
// ids they cite, so the layout can be redone at any time — numbers
// follow each work's first appearance in the document, the way
// numbered styles want, and the bibliography follows the style.
import { CITATION_STYLES, compressNumbers, formatInText, formatReferenceList, isSuperscriptStyle, } from '../../src/utils/citationFormat.js';
import { WORD_LIBRARY_FORMAT, } from '../../src/utils/wordLibraryFormat.js';
export const CITE_TAG = 'academe:cite:';
export const BIBLIOGRAPHY_TAG = 'academe:bibliography';
// Content-control tags are short; this many works fit in one citation
export const MAX_CITED_TOGETHER = 6;
export class LibraryFileError extends Error {
}
export const parseLibraryFile = (text) => {
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        throw new LibraryFileError('This file is not an Acade.me library.');
    }
    if ((data === null || data === void 0 ? void 0 : data.format) !== WORD_LIBRARY_FORMAT || !Array.isArray(data === null || data === void 0 ? void 0 : data.papers)) {
        throw new LibraryFileError('This file is not an Acade.me library.');
    }
    const papers = data.papers
        .filter((p) => typeof (p === null || p === void 0 ? void 0 : p.id) === 'string' && p.id.length > 0)
        .map((p) => {
        var _a;
        return ({
            id: String(p.id),
            key: String((_a = p.key) !== null && _a !== void 0 ? _a : p.id),
            title: typeof p.title === 'string' ? p.title : null,
            year: typeof p.year === 'number' ? p.year : null,
            venue: typeof p.venue === 'string' ? p.venue : null,
            volume: typeof p.volume === 'string' ? p.volume : null,
            issue: typeof p.issue === 'string' ? p.issue : null,
            pages: typeof p.pages === 'string' ? p.pages : null,
            doi: typeof p.doi === 'string' ? p.doi : null,
            arxivId: typeof p.arxivId === 'string' ? p.arxivId : null,
            authors: Array.isArray(p.authors) ? p.authors.map(String) : [],
        });
    });
    const style = CITATION_STYLES.includes(data.style) ? data.style : null;
    return {
        format: WORD_LIBRARY_FORMAT,
        version: Number(data.version) || 1,
        name: typeof data.name === 'string' ? data.name : 'Acade.me',
        exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
        style,
        papers,
    };
};
export const toEntry = (paper) => ({
    title: paper.title,
    year: paper.year,
    venue: paper.venue,
    volume: paper.volume,
    issue: paper.issue,
    pages: paper.pages,
    doi: paper.doi,
    arxivId: paper.arxivId,
    abstract: null,
    authors: paper.authors,
});
const fold = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Every word of the query in the title, authors, venue, year, or DOI
export const searchPapers = (papers, query) => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (words.length === 0)
        return papers;
    return papers.filter(paper => {
        const haystack = fold([paper.title, paper.authors.join(' '), paper.venue, paper.year, paper.doi]
            .filter(v => v !== null && v !== undefined)
            .join(' '));
        return words.every(word => haystack.includes(word));
    });
};
export const citeTag = (ids) => `${CITE_TAG}${ids.join('|')}`;
export const idsFromTag = (tag) => tag && tag.startsWith(CITE_TAG) ? tag.slice(CITE_TAG.length).split('|').filter(Boolean) : null;
// Lay out every citation (in document order) and the bibliography
export const layoutDocument = (citations, entries, style) => {
    const order = [];
    const missing = new Set();
    for (const ids of citations) {
        for (const id of ids) {
            if (!entries[id])
                missing.add(id);
            else if (!order.includes(id))
                order.push(id);
        }
    }
    const number = (id) => order.indexOf(id) + 1;
    const laidOut = citations.map(ids => {
        const known = ids.filter(id => entries[id]);
        if (known.length === 0)
            return { text: '[?]', superscript: false };
        if (isSuperscriptStyle(style)) {
            return { text: compressNumbers(known.map(number)), superscript: true };
        }
        const cited = known.map(id => ({ entry: entries[id], number: number(id) }));
        return { text: formatInText(cited, style).text, superscript: false };
    });
    return {
        citations: laidOut,
        bibliography: formatReferenceList(order.map(id => entries[id]), style),
        missing: [...missing],
    };
};
