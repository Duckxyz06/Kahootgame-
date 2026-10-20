import test from 'node:test';import assert from 'node:assert/strict';import {points} from '../server/scoring.js';import {validateQuiz,nicknameValid} from '../server/validation.js';
test('first correct answer is 1000',()=>assert.equal(points(true,0,20000),1000));
test('last correct answer is 500',()=>assert.equal(points(true,20000,20000),500));
test('incorrect answer is zero',()=>assert.equal(points(false,0,20000),0));
test('rejects invalid quiz',()=>assert.throws(()=>validateQuiz({title:'x',questions:[{text:'?',choices:['a','b'],correct:4,durationSec:10}]})));
test('accepts a valid quiz',()=>assert.equal(validateQuiz({questions:[{text:'?',choices:['a','b'],correct:1,durationSec:10}]}).questions.length,1));
test('rejects too long nickname',()=>assert.equal(nicknameValid('abcdefghijklmnop'),false));
