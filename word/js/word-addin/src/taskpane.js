// Acade.me for Word — the task pane. Opens the library file exported
// from Acade.me (kept in the add-in's storage on this computer), cites
// papers at the cursor as Word content controls, and inserts or
// refreshes the bibliography. The cited works' data is also saved in
// the document itself, so the citations and bibliography can be
// refreshed on any computer, even without the library file. Nothing
// leaves the computer: the add-in has no server.
import { BIBLIOGRAPHY_TAG, LibraryFileError, MAX_CITED_TOGETHER, citeTag, idsFromTag, layoutDocument, parseLibraryFile, searchPapers, toEntry, } from './core.js';
import { CITATION_STYLES, CITATION_STYLE_LABELS, } from '../../src/utils/citationFormat.js';
import { fill, stringsFor } from './strings.js';
const LIBRARY_KEY = 'academe.word.library';
const STYLE_SETTING = 'academe.style';
const ENTRIES_SETTING = 'academe.entries';
let S = stringsFor('en');
let library = null;
let style = 'apa';
const selected = new Set();
const $ = (id) => document.getElementById(id);
const status = (text, isError = false) => {
    const el = $('status');
    el.textContent = text;
    el.className = isError ? 'status error' : 'status';
};
// --- Storage -----------------------------------------------------------
const loadStoredLibrary = () => {
    try {
        const text = localStorage.getItem(LIBRARY_KEY);
        return text ? parseLibraryFile(text) : null;
    }
    catch {
        return null;
    }
};
const storeLibrary = (text) => {
    try {
        localStorage.setItem(LIBRARY_KEY, text);
    }
    catch {
        // Storage full or blocked: the library still works for this session
    }
};
const documentEntries = () => {
    const stored = Office.context.document.settings.get(ENTRIES_SETTING);
    return stored && typeof stored === 'object' ? stored : {};
};
const saveSettings = () => new Promise(resolve => Office.context.document.settings.saveAsync(() => resolve()));
// Library entries win (they may be newer); the document's copies cover
// papers not in the library open on this computer
const allEntries = () => {
    var _a;
    const entries = { ...documentEntries() };
    for (const paper of (_a = library === null || library === void 0 ? void 0 : library.papers) !== null && _a !== void 0 ? _a : [])
        entries[paper.id] = toEntry(paper);
    return entries;
};
// --- Word ---------------------------------------------------------------
const refreshDocument = async () => {
    await Word.run(async (context) => {
        const controls = context.document.contentControls;
        controls.load('items/tag');
        await context.sync();
        const cites = controls.items.filter((c) => idsFromTag(c.tag));
        const bibliographies = controls.items.filter((c) => c.tag === BIBLIOGRAPHY_TAG);
        const layout = layoutDocument(cites.map((c) => idsFromTag(c.tag)), allEntries(), style);
        cites.forEach((control, index) => {
            const range = control.insertText(layout.citations[index].text, 'Replace');
            range.font.superscript = layout.citations[index].superscript;
        });
        for (const control of bibliographies) {
            control.insertHtml(layout.bibliography.html || '<p></p>', 'Replace');
        }
        await context.sync();
        if (layout.missing.length > 0) {
            status(fill(S.missing, { n: layout.missing.length }), true);
        }
        else {
            status(cites.length === 0
                ? S.noCitations
                : fill(S.updated, { n: cites.length, style: CITATION_STYLE_LABELS[style] }));
        }
    });
};
const insertCitation = async (ids) => {
    if (!library || ids.length === 0)
        return;
    // Keep the cited works' data in the document for later refreshes
    const entries = documentEntries();
    for (const id of ids) {
        const paper = library.papers.find(p => p.id === id);
        if (paper)
            entries[id] = toEntry(paper);
    }
    Office.context.document.settings.set(ENTRIES_SETTING, entries);
    await saveSettings();
    await Word.run(async (context) => {
        const range = context.document.getSelection().getRange('End');
        const control = range.insertContentControl();
        control.tag = citeTag(ids);
        control.title = 'Acade.me citation';
        control.insertText('…', 'Replace');
        await context.sync();
    });
    await refreshDocument();
};
const insertBibliography = async () => {
    await Word.run(async (context) => {
        const controls = context.document.contentControls;
        controls.load('items/tag');
        await context.sync();
        if (!controls.items.some((c) => c.tag === BIBLIOGRAPHY_TAG)) {
            const range = context.document.getSelection().getRange('End');
            const control = range.insertContentControl();
            control.tag = BIBLIOGRAPHY_TAG;
            control.title = 'Acade.me bibliography';
            control.insertText(' ', 'Replace');
            await context.sync();
        }
    });
    await refreshDocument();
};
// --- UI -----------------------------------------------------------------
const paperMeta = (paper) => [paper.authors.slice(0, 3).join(', ') + (paper.authors.length > 3 ? ' et al.' : ''), paper.year]
    .filter(Boolean)
    .join(' · ');
const renderLibraryHeader = () => {
    $('library-name').textContent = library
        ? fill(S.libraryCount, { name: library.name, n: library.papers.length })
        : S.noLibrary;
    $('empty').hidden = !!library;
    $('search').hidden = !library;
};
const renderSelection = () => {
    const button = $('cite-selected');
    button.disabled = selected.size === 0;
    button.textContent =
        selected.size > 1 ? fill(S.citeTogether, { n: selected.size }) : S.citeSelected;
};
const renderList = () => {
    var _a, _b;
    const list = $('papers');
    list.textContent = '';
    if (!library)
        return;
    const query = $('search').value;
    for (const paper of searchPapers(library.papers, query).slice(0, 200)) {
        const row = document.createElement('div');
        row.className = 'paper';
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = selected.has(paper.id);
        check.setAttribute('aria-label', (_a = paper.title) !== null && _a !== void 0 ? _a : paper.key);
        check.addEventListener('change', () => {
            if (check.checked) {
                if (selected.size >= MAX_CITED_TOGETHER) {
                    check.checked = false;
                    status(fill(S.maxTogether, { n: MAX_CITED_TOGETHER }), true);
                    return;
                }
                selected.add(paper.id);
            }
            else
                selected.delete(paper.id);
            renderSelection();
        });
        const text = document.createElement('button');
        text.className = 'paper-text';
        text.title = S.citeAtCursor;
        const title = document.createElement('span');
        title.className = 'paper-title';
        title.textContent = (_b = paper.title) !== null && _b !== void 0 ? _b : paper.key;
        const meta = document.createElement('span');
        meta.className = 'paper-meta';
        meta.textContent = paperMeta(paper);
        text.append(title, meta);
        text.addEventListener('click', () => run(() => insertCitation([paper.id])));
        row.append(check, text);
        list.append(row);
    }
};
const renderStyles = () => {
    const select = $('style');
    select.textContent = '';
    for (const s of CITATION_STYLES) {
        const option = document.createElement('option');
        option.value = s;
        option.textContent = CITATION_STYLE_LABELS[s];
        option.selected = s === style;
        select.append(option);
    }
};
// One action at a time; errors land in the status line
let busy = false;
const run = async (action) => {
    var _a;
    if (busy)
        return;
    busy = true;
    document.body.classList.add('busy');
    try {
        await action();
    }
    catch (error) {
        status((_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : String(error), true);
    }
    finally {
        busy = false;
        document.body.classList.remove('busy');
    }
};
const openLibraryFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
        var _a;
        try {
            const text = String((_a = reader.result) !== null && _a !== void 0 ? _a : '');
            library = parseLibraryFile(text);
            storeLibrary(text);
            if (!Office.context.document.settings.get(STYLE_SETTING) && library.style) {
                style = library.style;
                renderStyles();
            }
            selected.clear();
            renderLibraryHeader();
            renderSelection();
            renderList();
            status(fill(S.opened, { name: library.name }));
        }
        catch (error) {
            status(error instanceof LibraryFileError ? S.notLibrary : S.readFailed, true);
        }
    };
    reader.readAsText(file);
};
// Static text in Word's display language
const translatePage = () => {
    var _a;
    document.documentElement.lang = (_a = Office.context.displayLanguage) !== null && _a !== void 0 ? _a : 'en';
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.dataset.i18n;
        if (S[key])
            element.textContent = S[key];
    });
    const search = $('search');
    search.placeholder = S.search;
    search.setAttribute('aria-label', S.search);
    $('style').setAttribute('aria-label', S.style);
    $('refresh').title = S.refreshTitle;
};
Office.onReady(() => {
    S = stringsFor(Office.context.displayLanguage);
    translatePage();
    library = loadStoredLibrary();
    const savedStyle = Office.context.document.settings.get(STYLE_SETTING);
    if (CITATION_STYLES.includes(savedStyle))
        style = savedStyle;
    else if (library === null || library === void 0 ? void 0 : library.style)
        style = library.style;
    renderStyles();
    renderLibraryHeader();
    renderSelection();
    renderList();
    $('file').addEventListener('change', event => {
        var _a;
        const file = (_a = event.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (file)
            openLibraryFile(file);
        event.target.value = '';
    });
    $('open').addEventListener('click', () => $('file').click());
    $('search').addEventListener('input', renderList);
    $('style').addEventListener('change', event => {
        style = event.target.value;
        Office.context.document.settings.set(STYLE_SETTING, style);
        run(async () => {
            await saveSettings();
            await refreshDocument();
        });
    });
    $('cite-selected').addEventListener('click', () => run(async () => {
        await insertCitation([...selected]);
        selected.clear();
        renderSelection();
        renderList();
    }));
    $('bibliography').addEventListener('click', () => run(insertBibliography));
    $('refresh').addEventListener('click', () => run(refreshDocument));
});
