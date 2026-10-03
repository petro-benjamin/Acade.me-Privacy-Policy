// Picker order: grouped loosely by field, sciences first
export const CITATION_STYLES = [
    'acs',
    'rsc',
    'nature',
    'apa',
    'chicago',
    'harvard',
    'mla',
    'vancouver',
    'ama',
    'ieee',
];
export const CITATION_STYLE_LABELS = {
    acs: 'ACS',
    apa: 'APA',
    vancouver: 'Vancouver',
    ieee: 'IEEE',
    nature: 'Nature',
    chicago: 'Chicago',
    harvard: 'Harvard',
    mla: 'MLA',
    ama: 'AMA',
    rsc: 'RSC',
};
// Numbered styles cite by number, in order of first citation; the
// others by author and year, with an alphabetical reference list
const NUMBERED = new Set([
    'acs',
    'vancouver',
    'ieee',
    'nature',
    'ama',
    'rsc',
]);
export const isNumberedStyle = (style) => NUMBERED.has(style);
// Numbered styles that cite with superscript numbers (the rest of the
// numbered styles use brackets)
export const isSuperscriptStyle = (style) => NUMBERED.has(style) && style !== 'ieee' && style !== 'vancouver';
const PARTICLES = new Set([
    'van',
    'von',
    'der',
    'den',
    'de',
    'del',
    'della',
    'di',
    'da',
    'du',
    'la',
    'le',
    'dos',
    'das',
    'ter',
    'ten',
    'bin',
    'al',
    'el',
]);
const SUFFIXES = /^(jr\.?|sr\.?|ii|iii|iv)$/i;
export const parseName = (full) => {
    var _a, _b;
    const clean = full.replace(/\s+/g, ' ').trim();
    const comma = clean.indexOf(',');
    if (comma > 0) {
        // "Kaufman, J. V. R." / "Kaufman, Jr., J."
        const parts = clean.split(',').map(p => p.trim());
        const suffix = parts.length > 2 && SUFFIXES.test(parts[1]) ? parts[1] : null;
        const given = (_a = (suffix ? parts[2] : parts[1])) !== null && _a !== void 0 ? _a : '';
        return { family: parts[0], given: given.split(' ').filter(Boolean), suffix };
    }
    const words = clean.split(' ').filter(Boolean);
    let suffix = null;
    if (words.length > 1 && SUFFIXES.test(words[words.length - 1]))
        suffix = words.pop();
    if (words.length <= 1)
        return { family: (_b = words[0]) !== null && _b !== void 0 ? _b : '', given: [], suffix };
    let start = words.length - 1;
    while (start > 1 && PARTICLES.has(words[start - 1].toLowerCase()))
        start--;
    return { family: words.slice(start).join(' '), given: words.slice(0, start), suffix };
};
// "Joseph Vincent" → ["J", "V"]; "J. V. R." / "JVR" → ["J","V","R"];
// "Jean-Pierre" → ["J.-P"] (the hyphen survives)
const initialsOf = (given) => {
    const out = [];
    for (const word of given) {
        const bare = word.replace(/\./g, '');
        if (!bare)
            continue;
        if (bare.includes('-')) {
            out.push(bare
                .split('-')
                .filter(Boolean)
                .map(p => p[0].toUpperCase())
                .join('.-'));
        }
        else if (bare === bare.toUpperCase() && bare.length <= 3 && !word.includes('.')) {
            // run-together initials, as Google Scholar writes them
            out.push(...bare.split(''));
        }
        else {
            out.push(bare[0].toUpperCase());
        }
    }
    return out;
};
const dotted = (name) => initialsOf(name.given)
    .map(i => `${i}.`)
    .join(' ');
const withSuffix = (text, name) => (name.suffix ? `${text}, ${name.suffix}` : text);
const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const render = (parts) => {
    let text = '';
    let html = '';
    for (const part of parts) {
        if (typeof part === 'string') {
            text += part;
            html += escapeHtml(part);
        }
        else if ('i' in part) {
            text += part.i;
            html += `<i>${escapeHtml(part.i)}</i>`;
        }
        else {
            text += part.b;
            html += `<b>${escapeHtml(part.b)}</b>`;
        }
    }
    return { text: text.replace(/\s+/g, ' ').trim(), html: html.replace(/\s+/g, ' ').trim() };
};
const enDash = (pages) => pages.replace(/-+/g, '–');
// Vancouver/NLM shortens the end page: 429–461 → 429–61
const nlmPages = (pages) => {
    const [start, end] = pages.split('-');
    if (!end || !/^\d+$/.test(start) || !/^\d+$/.test(end) || end.length !== start.length) {
        return enDash(pages);
    }
    let i = 0;
    while (i < end.length - 1 && start[i] === end[i])
        i++;
    return `${start}–${end.slice(i)}`;
};
// Chicago (CMOS 9.64): full under 100 and at round hundreds; only the
// changed digits for 101–109; at least two digits otherwise
// (429–61, 101–8, 321–28, 498–532)
const chicagoPages = (pages) => {
    const [start, end] = pages.split('-');
    if (!end || !/^\d+$/.test(start) || !/^\d+$/.test(end) || end.length !== start.length) {
        return enDash(pages);
    }
    const first = parseInt(start, 10);
    if (first < 100 || first % 100 === 0)
        return `${start}–${end}`;
    let i = 0;
    while (i < end.length - 1 && start[i] === end[i])
        i++;
    const keep = first % 100 < 10 ? end.length - i : Math.max(2, end.length - i);
    return `${start}–${end.slice(end.length - keep)}`;
};
// MLA: the last two digits of the second number unless more are needed
const mlaPages = (pages) => {
    const [start, end] = pages.split('-');
    if (!end || !/^\d+$/.test(start) || !/^\d+$/.test(end) || end.length !== start.length) {
        return enDash(pages);
    }
    if (parseInt(start, 10) < 100)
        return `${start}–${end}`;
    let i = 0;
    while (i < end.length - 1 && start[i] === end[i])
        i++;
    return `${start}–${end.slice(Math.min(i, end.length - 2))}`;
};
const endWithPeriod = (text) => (/[.?!]$/.test(text) ? text : `${text}.`);
// Kaufman, J. V. R.; Picard, J. P. The Furoxans. Chemical Reviews
// 1959, 59 (3), 429–461. DOI: 10.1021/cr50027a002.
const acs = (e, names) => {
    const parts = [];
    if (names.length > 0) {
        parts.push(names.map(n => withSuffix(`${n.family}, ${dotted(n)}`.replace(/, $/, ''), n)).join('; '), ' ');
    }
    if (e.title)
        parts.push(endWithPeriod(e.title), ' ');
    const source = [];
    if (e.venue)
        source.push({ i: e.venue }, ' ');
    if (e.year !== null)
        source.push({ b: String(e.year) });
    if (e.volume)
        source.push(', ', { i: e.volume });
    if (e.issue)
        source.push(` (${e.issue})`);
    if (e.pages)
        source.push(`, ${enDash(e.pages)}`);
    if (source.length > 0)
        parts.push(...source, '.');
    if (e.doi)
        parts.push(` DOI: ${e.doi}.`);
    return render(parts);
};
// Kaufman, J. V. R., & Picard, J. P. (1959). The Furoxans. Chemical
// Reviews, 59(3), 429–461. https://doi.org/10.1021/cr50027a002
const apa = (e, names) => {
    var _a;
    const formatted = names.map(n => withSuffix(`${n.family}, ${dotted(n)}`.replace(/, $/, ''), n));
    let authors = '';
    if (formatted.length === 0)
        authors = '';
    else if (formatted.length === 1)
        authors = formatted[0];
    else if (formatted.length === 2)
        authors = `${formatted[0]}, & ${formatted[1]}`;
    else if (formatted.length <= 20) {
        authors = `${formatted.slice(0, -1).join(', ')}, & ${formatted[formatted.length - 1]}`;
    }
    else {
        authors = `${formatted.slice(0, 19).join(', ')}, . . . ${formatted[formatted.length - 1]}`;
    }
    const parts = [];
    const year = `(${(_a = e.year) !== null && _a !== void 0 ? _a : 'n.d.'}).`;
    if (authors)
        parts.push(endWithPeriod(authors).replace(/\.\.$/, '.'), ' ', year, ' ');
    if (e.title)
        parts.push(endWithPeriod(e.title), ' ');
    if (!authors)
        parts.push(year, ' ');
    if (e.venue) {
        parts.push({ i: e.venue });
        if (e.volume)
            parts.push({ i: `, ${e.volume}` });
        if (e.issue)
            parts.push(`(${e.issue})`);
        if (e.pages)
            parts.push(`, ${enDash(e.pages)}`);
        parts.push('.');
    }
    if (e.doi)
        parts.push(` https://doi.org/${e.doi}`);
    return render(parts);
};
// Kaufman JVR, Picard JP. The Furoxans. Chemical Reviews.
// 1959;59(3):429–61. doi:10.1021/cr50027a002
const vancouver = (e, names) => {
    const formatted = names.map(n => `${n.family} ${initialsOf(n.given).join('').replace(/\./g, '')}`.trim());
    const shown = formatted.length > 6 ? [...formatted.slice(0, 6), 'et al'] : formatted;
    const parts = [];
    if (shown.length > 0)
        parts.push(`${shown.join(', ')}. `);
    if (e.title)
        parts.push(endWithPeriod(e.title), ' ');
    if (e.venue)
        parts.push(`${endWithPeriod(e.venue)} `);
    let where = e.year !== null ? String(e.year) : '';
    if (e.volume)
        where += `;${e.volume}`;
    if (e.issue)
        where += `(${e.issue})`;
    if (e.pages)
        where += `:${nlmPages(e.pages)}`;
    if (where)
        parts.push(`${where}.`);
    if (e.doi)
        parts.push(` doi:${e.doi}`);
    return render(parts);
};
// J. V. R. Kaufman and J. P. Picard, "The Furoxans," Chemical Reviews,
// vol. 59, no. 3, pp. 429–461, 1959, doi: 10.1021/cr50027a002.
const ieee = (e, names) => {
    var _a;
    const formatted = names.map(n => withSuffix(`${dotted(n)} ${n.family}`.trim(), n));
    let authors = '';
    if (formatted.length > 6)
        authors = `${formatted[0]} et al.`;
    else if (formatted.length === 2)
        authors = `${formatted[0]} and ${formatted[1]}`;
    else if (formatted.length > 2) {
        authors = `${formatted.slice(0, -1).join(', ')}, and ${formatted[formatted.length - 1]}`;
    }
    else
        authors = (_a = formatted[0]) !== null && _a !== void 0 ? _a : '';
    const parts = [];
    const tail = [];
    if (e.venue)
        tail.push({ i: e.venue });
    if (e.volume)
        tail.push(`vol. ${e.volume}`);
    if (e.issue)
        tail.push(`no. ${e.issue}`);
    if (e.pages)
        tail.push(`${e.pages.includes('-') ? 'pp.' : 'p.'} ${enDash(e.pages)}`);
    if (e.year !== null)
        tail.push(String(e.year));
    if (e.doi)
        tail.push(`doi: ${e.doi}`);
    if (authors)
        parts.push(`${authors}, `);
    // The title's closing comma moves inside the quotes, or becomes the
    // final period when nothing follows it
    if (e.title)
        parts.push(tail.length > 0 ? `“${e.title},” ` : `“${e.title}.”`);
    tail.forEach((part, index) => {
        if (index > 0)
            parts.push(', ');
        parts.push(part);
    });
    if (tail.length > 0)
        parts.push('.');
    return render(parts);
};
const fullName = (n) => withSuffix(`${n.given.join(' ')} ${n.family}`.trim(), n);
const invertedFull = (n) => withSuffix(n.given.length > 0 ? `${n.family}, ${n.given.join(' ')}` : n.family, n);
const listAnd = (names, and, serialComma) => {
    var _a;
    if (names.length <= 1)
        return (_a = names[0]) !== null && _a !== void 0 ? _a : '';
    if (names.length === 2)
        return `${names[0]} ${and} ${names[1]}`;
    return `${names.slice(0, -1).join(', ')}${serialComma ? ',' : ''} ${and} ${names[names.length - 1]}`;
};
// Kaufman, J. V. R. & Picard, J. P. The Furoxans. Chemical Reviews
// 59, 429–461 (1959).
const nature = (e, names) => {
    const formatted = names.map(n => withSuffix(`${n.family}, ${dotted(n)}`.replace(/, $/, ''), n));
    const parts = [];
    if (formatted.length > 5)
        parts.push(`${formatted[0]} et al. `);
    else if (formatted.length > 0) {
        const last = formatted[formatted.length - 1];
        const authors = formatted.length === 1 ? last : `${formatted.slice(0, -1).join(', ')} & ${last}`;
        parts.push(`${endWithPeriod(authors)} `);
    }
    if (e.title)
        parts.push(endWithPeriod(e.title), ' ');
    if (e.venue)
        parts.push({ i: e.venue }, ' ');
    if (e.volume)
        parts.push({ b: e.volume });
    if (e.pages)
        parts.push(`${e.volume ? ', ' : ''}${enDash(e.pages)}`);
    if (e.year !== null)
        parts.push(` (${e.year})`);
    parts.push('.');
    return render(parts);
};
// Kaufman, J. V. R., and J. P. Picard. 1959. “The Furoxans.” Chemical
// Reviews 59 (3): 429–61. https://doi.org/10.1021/cr50027a002.
const chicago = (e, names) => {
    var _a;
    const formatted = names.map((n, index) => (index === 0 ? invertedFull(n) : fullName(n)));
    const shown = formatted.length > 10 ? [...formatted.slice(0, 7), 'et al'] : formatted;
    const parts = [];
    if (shown.length > 0) {
        // The inverted first name takes a comma before "and" even for two
        const authors = formatted.length > 10
            ? `${shown.slice(0, 7).join(', ')}, et al.`
            : shown.length === 2
                ? `${shown[0]}, and ${shown[1]}`
                : listAnd(shown, 'and', true);
        parts.push(`${endWithPeriod(authors)} `);
    }
    parts.push(`${(_a = e.year) !== null && _a !== void 0 ? _a : 'n.d.'}. `);
    if (e.title)
        parts.push(`“${endWithPeriod(e.title)}” `);
    if (e.venue) {
        parts.push({ i: e.venue });
        if (e.volume)
            parts.push(` ${e.volume}`);
        if (e.issue)
            parts.push(` (${e.issue})`);
        if (e.pages)
            parts.push(`: ${chicagoPages(e.pages)}`);
        parts.push('.');
    }
    if (e.doi)
        parts.push(` https://doi.org/${e.doi}.`);
    return render(parts);
};
// Kaufman, J.V.R. and Picard, J.P. (1959) ‘The Furoxans’, Chemical
// Reviews, 59(3), pp. 429–461. Available at: https://doi.org/…
const harvard = (e, names) => {
    var _a;
    const formatted = names.map(n => withSuffix(`${n.family}, ${initialsOf(n.given)
        .map(i => `${i}.`)
        .join('')}`.replace(/, $/, ''), n));
    const parts = [];
    if (formatted.length > 3)
        parts.push(`${formatted[0]} et al. `);
    else if (formatted.length > 0)
        parts.push(`${listAnd(formatted, 'and', false)} `);
    parts.push(`(${(_a = e.year) !== null && _a !== void 0 ? _a : 'no date'}) `);
    if (e.title)
        parts.push(`‘${e.title}’${e.venue ? ',' : '.'} `);
    if (e.venue) {
        parts.push({ i: e.venue });
        let where = '';
        if (e.volume)
            where += `, ${e.volume}`;
        if (e.issue)
            where += `(${e.issue})`;
        if (e.pages)
            where += `, ${e.pages.includes('-') ? 'pp.' : 'p.'} ${enDash(e.pages)}`;
        parts.push(`${where}.`);
    }
    if (e.doi)
        parts.push(` Available at: https://doi.org/${e.doi}.`);
    return render(parts);
};
// Kaufman, J. V. R., and J. P. Picard. “The Furoxans.” Chemical
// Reviews, vol. 59, no. 3, 1959, pp. 429–61. https://doi.org/…
const mla = (e, names) => {
    const parts = [];
    if (names.length === 1)
        parts.push(`${endWithPeriod(invertedFull(names[0]))} `);
    else if (names.length === 2) {
        parts.push(`${endWithPeriod(`${invertedFull(names[0])}, and ${fullName(names[1])}`)} `);
    }
    else if (names.length > 2)
        parts.push(`${invertedFull(names[0])}, et al. `);
    if (e.title)
        parts.push(`“${endWithPeriod(e.title)}” `);
    const container = [];
    if (e.volume)
        container.push(`vol. ${e.volume}`);
    if (e.issue)
        container.push(`no. ${e.issue}`);
    if (e.year !== null)
        container.push(String(e.year));
    if (e.pages)
        container.push(`${e.pages.includes('-') ? 'pp.' : 'p.'} ${mlaPages(e.pages)}`);
    if (e.venue) {
        parts.push({ i: e.venue });
        container.forEach(part => parts.push(', ', part));
        parts.push('.');
    }
    else if (container.length > 0) {
        container.forEach((part, index) => parts.push(index > 0 ? ', ' : '', part));
        parts.push('.');
    }
    if (e.doi)
        parts.push(` https://doi.org/${e.doi}.`);
    return render(parts);
};
// Kaufman JVR, Picard JP. The Furoxans. Chemical Reviews.
// 1959;59(3):429-461. doi:10.1021/cr50027a002
const ama = (e, names) => {
    const formatted = names.map(n => `${n.family} ${initialsOf(n.given).join('').replace(/\./g, '')}`.trim());
    const shown = formatted.length > 6 ? [...formatted.slice(0, 3), 'et al'] : formatted;
    const parts = [];
    if (shown.length > 0)
        parts.push(`${shown.join(', ')}. `);
    if (e.title)
        parts.push(endWithPeriod(e.title), ' ');
    if (e.venue)
        parts.push({ i: e.venue }, '. ');
    let where = e.year !== null ? String(e.year) : '';
    if (e.volume)
        where += `;${e.volume}`;
    if (e.issue)
        where += `(${e.issue})`;
    if (e.pages)
        where += `:${e.pages.replace(/[–—]+/g, '-')}`;
    if (where)
        parts.push(`${where}.`);
    if (e.doi)
        parts.push(` doi:${e.doi}`);
    return render(parts);
};
// J. V. R. Kaufman and J. P. Picard, Chemical Reviews, 1959, 59,
// 429–461.
const rsc = (e, names) => {
    const formatted = names.map(n => withSuffix(`${dotted(n)} ${n.family}`.trim(), n));
    // RSC references omit the article title; without a journal it is
    // all that says what the work is
    const segments = [];
    if (formatted.length > 0)
        segments.push(listAnd(formatted, 'and', false));
    if (e.venue)
        segments.push({ i: e.venue });
    else if (e.title)
        segments.push(e.title);
    if (e.year !== null)
        segments.push(String(e.year));
    if (e.volume)
        segments.push({ b: e.volume });
    if (e.pages)
        segments.push(enDash(e.pages));
    const parts = [];
    segments.forEach((segment, index) => parts.push(index > 0 ? ', ' : '', segment));
    if (segments.length > 0)
        parts.push('.');
    if (e.doi && !e.venue)
        parts.push(` DOI: ${e.doi}.`);
    return render(parts);
};
export const formatCitation = (entry, style) => {
    const names = entry.authors.map(parseName).filter(n => n.family.length > 0);
    switch (style) {
        case 'acs':
            return acs(entry, names);
        case 'apa':
            return apa(entry, names);
        case 'vancouver':
            return vancouver(entry, names);
        case 'nature':
            return nature(entry, names);
        case 'chicago':
            return chicago(entry, names);
        case 'harvard':
            return harvard(entry, names);
        case 'mla':
            return mla(entry, names);
        case 'ama':
            return ama(entry, names);
        case 'rsc':
            return rsc(entry, names);
        default:
            return ieee(entry, names);
    }
};
// Author-date reference lists run alphabetically by first author
// (then year); numbered lists keep the order given — citation order
const sortKey = (entry) => {
    var _a, _b, _c;
    const first = entry.authors.map(parseName).find(n => n.family.length > 0);
    return `${((_b = (_a = first === null || first === void 0 ? void 0 : first.family) !== null && _a !== void 0 ? _a : entry.title) !== null && _b !== void 0 ? _b : '').toLowerCase()}\u0000${(_c = entry.year) !== null && _c !== void 0 ? _c : 9999}`;
};
const listPrefix = (style, index) => {
    if (!isNumberedStyle(style))
        return '';
    if (style === 'ieee')
        return `[${index + 1}] `;
    if (style === 'rsc')
        return `${index + 1} `;
    return `${index + 1}. `;
};
// Several papers (a collection, a writing project) as a reference list
export const formatReferenceList = (entries, style) => {
    const ordered = isNumberedStyle(style)
        ? entries
        : [...entries].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    const items = ordered.map(entry => formatCitation(entry, style));
    return {
        text: items.map((item, index) => `${listPrefix(style, index)}${item.text}`).join('\n'),
        html: items
            .map((item, index) => `<p>${escapeHtml(listPrefix(style, index))}${item.html}</p>`)
            .join(''),
    };
};
// --- In-text citations ---
const SUPERSCRIPT = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
    ',': '˒',
    '–': '⁻',
};
// 1, 2, 3, 5 → "1–3,5"
export const compressNumbers = (numbers) => {
    const sorted = [...new Set(numbers)].sort((a, b) => a - b);
    const runs = [];
    for (let i = 0; i < sorted.length; i++) {
        let j = i;
        while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1)
            j++;
        runs.push(j - i >= 2 ? `${sorted[i]}–${sorted[j]}` : sorted.slice(i, j + 1).join(','));
        i = j;
    }
    return runs.join(',');
};
const surnameOf = (entry) => entry.authors.map(parseName).filter(n => n.family.length > 0);
const authorDate = (entry, style) => {
    const names = surnameOf(entry).map(n => n.family);
    let who;
    if (names.length === 0) {
        who = entry.title ? `“${entry.title.split(/\s+/).slice(0, 4).join(' ')}”` : '';
    }
    else if (style === 'apa') {
        who = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} & ${names[1]}` : `${names[0]} et al.`;
    }
    else if (style === 'mla') {
        who = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names[0]} et al.`;
    }
    else {
        // Chicago lists up to three, Harvard (Cite Them Right) too
        who = names.length > 3 ? `${names[0]} et al.` : listAnd(names, 'and', style === 'chicago');
    }
    if (style === 'mla')
        return who;
    const year = entry.year !== null ? String(entry.year) : style === 'harvard' ? 'no date' : 'n.d.';
    if (!who)
        return year;
    return style === 'chicago' ? `${who} ${year}` : `${who}, ${year}`;
};
// The in-text citation for one or several works cited together.
// Numbered styles take each work's number in the reference list.
export const formatInText = (cited, style) => {
    if (isNumberedStyle(style)) {
        const numbers = compressNumbers(cited.map(c => c.number));
        if (!isSuperscriptStyle(style)) {
            const text = `[${numbers.replace(/,/g, ', ')}]`;
            return { text, html: escapeHtml(text) };
        }
        // ACS, Nature, AMA, RSC: superscript
        const text = numbers
            .split('')
            .map(c => { var _a; return (_a = SUPERSCRIPT[c]) !== null && _a !== void 0 ? _a : c; })
            .join('');
        return { text, html: `<sup>${escapeHtml(numbers)}</sup>` };
    }
    const text = `(${cited
        .map(c => authorDate(c.entry, style))
        .join('; ')})`;
    return { text, html: escapeHtml(text) };
};
