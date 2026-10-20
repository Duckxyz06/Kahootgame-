import test from 'node:test';
import assert from 'node:assert/strict';
import {parseQuizText} from '../server/importer.js';
test('reads numbered Vietnamese questions with answer keys',()=>{const r=parseQuizText('Câu 1: Thủ đô?\nA. Hà Nội\nB. Huế\nĐáp án: A\nCâu 2: 2 + 2?\nA. 3\nB. 4\nĐáp án: B');assert.equal(r.detected,2);assert.deepEqual(r.questions.map(q=>q.correct),[0,1])});
test('warns when correct answer is missing instead of treating default as verified',()=>{const r=parseQuizText('Câu 1: Ví dụ?\nA. Có\nB. Không');assert.equal(r.questions[0].needsReview,true);assert.ok(r.warnings.length)});
