import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import Typo from '../js/prompt/vendor/typo.mjs';
import {prepareVocabulary,spellingRanges} from '../js/prompt/engine.mjs';

test('bundled preloaded dictionary still checks words, inflections and suggestions',async()=>{
    const [aff,dic]=await Promise.all(['en.aff','en.dic'].map(name=>readFile(new URL(`../js/prompt/vendor/${name}`,import.meta.url),'utf8')));
    const dictionary=new Typo('en',aff,dic,{platform:'any'});
    assert.equal(dictionary.loaded,true);
    for(const word of ['background','beautiful','cats','running'])assert.equal(dictionary.check(word),true,word);
    assert.equal(dictionary.check('backgroun'),false);
    assert.ok(dictionary.suggest('backgroun').includes('background'));
    const vocabulary=prepareVocabulary([['blue_eyes','general',1,[],'',['local']]]);
    assert.deepEqual(spellingRanges('blue eyes, beautiful backgroun',vocabulary,dictionary),[{start:21,end:30,word:'backgroun'}]);
});

test('missing dictionary text fails explicitly instead of attempting automatic I/O',()=>{
    for(const [aff,dic] of [[undefined,undefined],['SET UTF-8',undefined],[undefined,'1\ncat'],['','1\ncat']]){
        assert.throws(()=>new Typo('en',aff,dic,{platform:'any'}),/preloaded dictionary/i);
    }
});
