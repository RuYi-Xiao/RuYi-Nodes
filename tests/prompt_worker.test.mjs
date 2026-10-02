import assert from 'node:assert/strict';

let storedRows = [], fetchCount = 0, nextId = 0;
const replies = new Map();
const bundledRows = [['blue_eyes', 'general', 10, [], '', ['local']]];

globalThis.fetch = async () => {
    fetchCount++;
    return {ok: true, json: async () => structuredClone(bundledRows)};
};
// Database open and transaction completion are separate asynchronous events,
// allowing a second Worker message to arrive while the first import awaits I/O.
globalThis.indexedDB = {
    open() {
        const opening = {};
        setImmediate(() => {
            opening.result = {
                close() {},
                transaction() {
                    const transaction = {
                        objectStore() {
                            return {
                                get() { return {result: structuredClone(storedRows)}; },
                                put(rows) { storedRows = structuredClone(rows); return {}; },
                            };
                        },
                    };
                    setImmediate(() => transaction.oncomplete());
                    return transaction;
                },
            };
            opening.onsuccess();
        });
        return opening;
    },
};
globalThis.self = {
    postMessage(message) {
        const reply = replies.get(message.id);
        assert.ok(reply, `Unexpected Worker response ${message.id}`);
        replies.delete(message.id);
        if (message.error) reply.reject(Error(message.error));
        else reply.resolve(message.result);
    },
};
function request(command, args = {}) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
        replies.set(id, {resolve, reject});
        self.onmessage({data: {id, command, args}});
    });
}

await import('../js/prompt/worker.mjs');
assert.equal((await request('ready')).count, 1);
const imports = await Promise.all([
    request('import', {csv: 'custom_alpha,甲\n'}),
    request('import', {csv: 'custom_beta,乙\n'}),
]);
assert.deepEqual(imports.map(result => result.count), [1, 1]);
assert.deepEqual(storedRows.map(row => row[0]).sort(), ['custom_alpha', 'custom_beta'],
    'Concurrent imports must both remain in IndexedDB');
assert.deepEqual((await request('complete', {fragment: 'custom_', sources: ['import']}))
    .map(row => row[0]).sort(), ['custom_alpha', 'custom_beta'],
    'Both successful imports must be searchable without reloading the Worker');
assert.equal((await request('complete', {fragment: 'blue', sources: ['local']}))[0][0], 'blue_eyes',
    'Importing must preserve bundled vocabulary');
assert.equal(fetchCount, 1, 'The shared Worker should load bundled vocabulary once');

// A fresh Worker module must recover the same imported tags from IndexedDB.
await import('../js/prompt/worker.mjs?reload-regression');
assert.deepEqual((await request('complete', {fragment: 'custom_', sources: ['import']}))
    .map(row => row[0]).sort(), ['custom_alpha', 'custom_beta']);
console.log('PASS concurrent CSV imports retain persisted and live tags across Worker reload');
