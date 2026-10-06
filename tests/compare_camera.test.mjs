import assert from 'node:assert/strict';
import {normalizeZoomLimit, constrainCamera, zoomCamera} from '../js/compare/camera.mjs';

const square={width:800,height:600,images:[{width:1600,height:1200}]};
assert.equal(normalizeZoomLimit(undefined),300);
assert.equal(normalizeZoomLimit(450.9),450);
assert.equal(normalizeZoomLimit(-20,500),500);
assert.deepEqual(constrainCamera({percent:100,x:5,y:-3},square,300),{percent:100,x:0,y:0});
assert.deepEqual(constrainCamera({percent:500,x:5,y:-3},square,300),{percent:300,x:1,y:-1});
const letterbox={width:800,height:600,images:[{width:1600,height:800}]};
assert.deepEqual(constrainCamera({percent:150,x:5,y:5},letterbox,300),{percent:150,x:.25,y:0});
const anchored=zoomCamera({percent:100,x:0,y:0},200,{x:.75,y:.5},square,300);
assert.deepEqual(anchored,{percent:200,x:-.25,y:0});
assert.deepEqual(zoomCamera(anchored,100,{x:.75,y:.5},square,300),{percent:100,x:0,y:0});
assert.deepEqual(constrainCamera({percent:200,x:NaN,y:Infinity},square,300),{percent:200,x:0,y:0});
assert.deepEqual(constrainCamera({percent:250,x:1,y:1},{width:0,height:0,images:[]},300),{percent:250,x:0,y:0});
console.log('PASS zoom limits, shared pan bounds, letterboxing and pointer anchoring');
