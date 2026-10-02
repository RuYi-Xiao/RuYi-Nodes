import Typo from './vendor/typo.mjs';
import {prepareVocabulary, complete, completionAt, spellingRanges, importVocabulary, countVocabularyHits} from './engine.mjs';

let vocabulary, dictionary, importedRows = [], bundledRows = [], importQueue = Promise.resolve();
function importStore(write, rows = importedRows) {
    return new Promise((resolve,reject)=>{
        const open=indexedDB.open('RuYi-Prompt-vocabulary',1);
        open.onupgradeneeded=()=>open.result.createObjectStore('imports');
        open.onerror=()=>reject(open.error);
        open.onsuccess=()=>{
            const db=open.result,transaction=db.transaction('imports',write?'readwrite':'readonly'),store=transaction.objectStore('imports');
            const query=write?store.put(rows,'rows'):store.get('rows');
            transaction.oncomplete=()=>{db.close();resolve(write?null:query.result||[]);};
            transaction.onerror=()=>{db.close();reject(transaction.error);};
            transaction.onabort=()=>{db.close();reject(transaction.error);};
        };
    });
}
const loadVocabulary = () => vocabulary ??= fetch('/ruyi_nodes/prompt/vocabulary').then(response => {
    if (!response.ok) throw new Error('Cannot load local vocabulary');
    return response.json();
}).then(async rows=>{bundledRows=rows;importedRows=await importStore(false).catch(()=>[]);return prepareVocabulary([...bundledRows,...importedRows]);});
const loadDictionary = () => dictionary ??= Promise.all(['en.aff', 'en.dic'].map(name =>
    fetch(new URL(`./vendor/${name}`, import.meta.url)).then(response => {
        if (!response.ok) throw new Error('Cannot load spelling dictionary'); return response.text();
    }))).then(([aff, dic]) => new Typo('en', aff, dic, {platform:'any'}));

self.onmessage = async ({data}) => {
    const {id, command, args} = data;
    try {
        const rows = await loadVocabulary(); let result;
        if (command === 'complete') result = complete(rows, args.fragment, args.sources);
        else if (command === 'complete_at') result = completionAt(rows, args.text, args.caret, args.sources);
        else if (command === 'stats') result = args.texts.reduce((count, text) => count + countVocabularyHits(text, rows), 0);
        else if (command === 'spell') result = spellingRanges(args.text, rows, await loadDictionary(), args.customWords, args.triggers);
        else if (command === 'suggest') result = (await loadDictionary()).suggest(args.word, 5);
        else if (command === 'import') {
            // Two nodes can import concurrently; commit batches in order without losing either index.
            importQueue = importQueue.catch(()=>{}).then(async()=>{
                const imported=importVocabulary(args.csv), merged=prepareVocabulary([...importedRows,...imported]).map(row=>row.slice(0,6));
                await importStore(true,merged);
                importedRows=merged;
                vocabulary=Promise.resolve(prepareVocabulary([...bundledRows,...importedRows]));
                return {count:imported.length};
            });
            result=await importQueue;
        } else result = {count:rows.length};
        self.postMessage({id,result});
    } catch (error) { self.postMessage({id,error:error.message}); }
};
