import assert from 'node:assert/strict';
import * as engine from '../js/prompt/engine.mjs';

const rows = engine.prepareVocabulary([
    ['long_hair','general',50,['longhair'],'长发',['local']],
    ['blue_eyes','general',60,[],'蓝眼',['danbooru']],
]);
assert.equal(typeof engine.countVocabularyHits, 'function', 'Prompt vocabulary statistics must be implemented');
assert.equal(engine.countVocabularyHits('long hair, blue_eyes, (longhair:1.2), unknown\n蓝眼', rows), 4);
assert.equal(engine.countVocabularyHits('long hair, long hair', rows), 2, 'Repeated tag occurrences should count separately');
assert.equal(engine.countVocabularyHits('portrait with blue eyes', rows), 0, 'Prose must not be reported as an exact tag');
assert.equal(engine.countVocabularyHits('', rows), 0);
console.log('PASS vocabulary counts exact tags, aliases, weights and repeated occurrences');
