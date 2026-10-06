const norm = text => text.normalize('NFKC').replaceAll('_', ' ').trim().toLowerCase();

export function parseCSV(text) {
    const rows = []; let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            if (quoted && text[i + 1] === '"') { field += '"'; i++; }
            else quoted = !quoted;
        } else if (!quoted && (char === ',' || char === '\n' || char === '\r')) {
            row.push(field); field = '';
            if (char !== ',') {
                if (row.some(x => x.length)) rows.push(row);
                row = []; if (char === '\r' && text[i + 1] === '\n') i++;
            }
        } else field += char;
    }
    if (quoted) throw new Error('CSV contains an unclosed quote');
    row.push(field); if (row.some(x => x.length)) rows.push(row);
    return rows;
}

export function prepareVocabulary(records) {
    const merged = new Map();
    for (const row of records) {
        const key = norm(row[0]), prior = merged.get(key);
        if (prior) {
            prior[2] = Math.max(prior[2], row[2]);
            prior[3] = [...new Set([...prior[3],...row[3]])];
            prior[4] ||= row[4]; prior[5] = [...new Set([...prior[5],...row[5]])];
        } else merged.set(key, row.slice(0,6));
    }
    const rows = [...merged.values()].map(row => [...row, [row[0], ...row[3], row[4] || ''].map(norm).filter(Boolean)]);
    rows.known = new Set(rows.flatMap(row => row[6]));
    return rows;
}

export function importVocabulary(text) {
    const csv = parseCSV(text.replace(/^\uFEFF/, ''));
    const header = csv[0] || [], hasHeader = ['tag','name','character_tag'].includes(header[0]);
    if (!csv.length || csv.some(row=>row.length<2)) throw Error('CSV requires tag and translation, or tag/category/count columns');
    return csv.slice(hasHeader ? 1 : 0).map(row => {
        const get = (name, fallback) => row[hasHeader ? header.indexOf(name) : fallback] || '';
        if (row.length===2) return [row[0],'custom',0,[],row[1],['import']];
        const category = hasHeader ? get('category',1) || (header[0]==='character_tag'?'character':'custom') : row[1];
        const count = +(hasHeader ? get(header.includes('post_count')?'post_count':'postCount',2) : row[2]) || 0;
        const aliases = (hasHeader ? get(header.includes('other_names')?'other_names':'aliases',3) : row[3] || '').split(',').map(x=>x.trim()).filter(Boolean);
        return [row[0],category,count,aliases,'',['import']];
    }).filter(row=>row[0]);
}

export function complete(rows, fragment, sources, limit = 20) {
    const query = norm(fragment); if (query.length < 2) return [];
    const matches = [];
    for (const row of rows) {
        if (!row[5].some(source => sources.includes(source))) continue;
        let rank = 3;
        for (const key of [row[6][0],row[4]?row[6].at(-1):'']) {
            if (key === query) { rank = 0; break; }
            if (key.startsWith(query)) rank = Math.min(rank, 1);
            else if (key.includes(query)) rank = Math.min(rank, 2);
        }
        if (row[6].includes(query)) rank = 0;
        if (rank < 3) matches.push({row, rank});
    }
    matches.sort((a, b) => a.rank - b.rank || b.row[2] - a.row[2] || a.row[0].localeCompare(b.row[0]));
    return matches.slice(0, limit).map(x => x.row.slice(0, 6));
}

export function matchedAlias(row, fragment) {
    const query = norm(fragment);
    if (norm(row[0]).includes(query) || norm(row[4]||'').includes(query)) return '';
    return row[3].find(alias=>norm(alias)===query) || '';
}

export function tokenAt(text, caret) {
    let start = caret, end = caret;
    while (start > 0 && !/[,\n]/.test(text[start - 1])) start--;
    while (start < caret && /\s/.test(text[start])) start++;
    while (end < text.length && !/[,\n]/.test(text[end])) end++;
    while (end > caret && /\s/.test(text[end - 1])) end--;
    return {start, end, text: text.slice(start, caret)};
}

export function completionAt(rows, text, caret, sources) {
    const token = tokenAt(text, caret);
    // Only suggest at a word boundary, never for the left half of an existing word.
    if (/^[\p{L}\p{N}_'’-]/u.test(text.slice(caret,caret+2))) return {token,options:[]};
    const query = fragment => fragment.trim().length >= 2 && fragment.length <= 100 ? complete(rows, fragment, sources) : [];
    let end = caret;
    while (end < text.length && !/[\s,.!?;:，。！？；：]/.test(text[end])) end++;
    const replacement = (start,fragment,options) => {
        // Consume an existing complete tag prefix, preserving any prose that follows it.
        const keys = new Set(options.flatMap(row => [row[0],...row[3],row[4]||'']).filter(Boolean).map(norm));
        const maxEnd = Math.min(token.end,start+Math.max(...[...keys].map(key=>key.length))*2+8);
        let existingEnd = end;
        for (let stop = end; stop <= maxEnd; stop++) {
            if (/\s/.test(text[stop-1] || '')) continue;
            if (stop < token.end && !/[\s,.!?;:，。！？；：]/.test(text[stop])) continue;
            if (keys.has(norm(text.slice(start,stop).replace(/\\([()\[\]])/g,'$1')))) existingEnd = stop;
        }
        return {token:{start,end:existingEnd,text:fragment},options};
    };
    const options = query(token.text);
    if (options.length) return replacement(token.start,token.text,options);
    // Tags remain the first choice; in prose, try the words immediately before the caret.
    const words = [...token.text.matchAll(/[^\s]+/g)].slice(-4);
    for (const word of words) {
        if (!word.index) continue;
        const start = token.start + word.index, fragment = text.slice(start, caret), matches = query(fragment);
        if (matches.length) return replacement(start,fragment,matches);
    }
    return {token, options:[]};
}

export function rebaseSpelling(errors, before, after) {
    let start = 0, oldEnd = before.length, newEnd = after.length;
    while (start < oldEnd && start < newEnd && before[start] === after[start]) start++;
    while (oldEnd > start && newEnd > start && before[oldEnd-1] === after[newEnd-1]) {oldEnd--;newEnd--;}
    const shift = newEnd - oldEnd;
    return errors.flatMap(error => {
        if (error.end > start && error.start < oldEnd) return [];
        const offset = error.start >= oldEnd ? shift : 0;
        const next = {...error,start:error.start+offset,end:error.end+offset};
        // Edits at word boundaries can change a word even without overlapping its old range.
        if (after.slice(next.start,next.end) !== error.word || /[\w@\\'’]/.test(after[next.start-1] || '') || /[\w'’]/.test(after[next.end] || '')) return [];
        return [next];
    });
}

export function insertion(tag, underscores) {
    return (underscores ? tag : tag.replaceAll('_', ' ')).replace(/(?<!\\)([()])/g, '\\$1');
}

function knownTag(raw, known) {
    raw = raw.trim();
        while (raw) {
            const phrase = norm(raw.replace(/\\([()\[\]])/g, '$1'));
            if (known.has(phrase)) return true;
            // Strip actual surrounding prompt weights, preserving literal tag qualifiers.
            const open = raw[0], close = open === '(' ? ')' : open === '[' ? ']' : null;
            if (!close || raw.at(-1) !== close) break;
            let depth = 0, outerEnd = -1;
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '\\') {i++;continue;}
                if (raw[i] === open) depth++;
                if (raw[i] === close && --depth === 0) {outerEnd = i;break;}
            }
            if (outerEnd !== raw.length - 1) break;
            raw = raw.slice(1,-1).replace(/:[+-]?(?:\d+\.?\d*|\.\d+)$/, '').trim();
        }
    return false;
}

export function countVocabularyHits(text, rows) {
    return [...text.matchAll(/[^,\n]+/g)].reduce((count, match) => count + Number(knownTag(match[0], rows.known)), 0);
}

export function spellingRanges(text, rows, dictionary, customWords = [], triggers = '') {
    const allowed = new Set(customWords.map(norm));
    for (const part of triggers.split(/[,\n]/)) {
        allowed.add(norm(part));
        for (const word of part.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) || []) allowed.add(norm(word));
    }
    const ignored = [];
    for (const match of text.matchAll(/[^,\n]+/g)) {
        if (knownTag(match[0], rows.known) || knownTag(match[0], allowed))
            ignored.push([match.index, match.index + match[0].length]);
    }
    const errors = [];
    for (const match of text.matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)*/g)) {
        const start = match.index, end = start + match[0].length;
        if (ignored.some(([a,b]) => start >= a && end <= b)) continue;
        // Artist prefixes, identifiers and escaped prompt syntax are not English prose.
        if (/[\w@\\]/.test(text[start - 1] || '') || /[\d_]/.test(text[end] || '')) continue;
        const word = norm(match[0]);
        if (!allowed.has(word) && !rows.known.has(word) && !dictionary.check(match[0])) errors.push({start, end, word:match[0]});
    }
    return errors;
}
