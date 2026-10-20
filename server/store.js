import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';
const db = process.env.DATABASE_URL ? new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:false}}) : null;
const path = new URL('../questions/sample.json', import.meta.url);
const sample = JSON.parse(fs.readFileSync(path,'utf8'));
const memory = new Map([['sample',{id:'sample',...sample}]]);
if(db) await db.query('CREATE TABLE IF NOT EXISTS quizzes (id UUID PRIMARY KEY,title VARCHAR(100) NOT NULL,questions JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
export async function listQuizzes(){
  const local=[...memory.values()].map(x=>({id:x.id,title:x.title,count:x.questions.length}));
  if(!db) return local;
  const r=await db.query('SELECT id,title,jsonb_array_length(questions) AS count FROM quizzes ORDER BY updated_at DESC LIMIT 200');
  return [...local,...r.rows.map(x=>({...x,count:Number(x.count)}))];
}
export async function getQuiz(id){
  if(memory.has(id)) return memory.get(id);
  if(!db) return null;
  const r=await db.query('SELECT id,title,questions FROM quizzes WHERE id=$1',[id]);
  return r.rows[0]||null;
}
export async function saveQuiz(quiz){
  const id=crypto.randomUUID();
  if(!db){memory.set(id,{id,...quiz});return {id,temporary:true};}
  await db.query('INSERT INTO quizzes(id,title,questions) VALUES($1,$2,$3::jsonb)',[id,quiz.title,JSON.stringify(quiz.questions)]);
  return {id,temporary:false};
}
export function isPersistent(){return !!db}
