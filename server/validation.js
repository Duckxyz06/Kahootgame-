export function validateQuiz(raw){
 if(!raw || typeof raw!=='object' || !Array.isArray(raw.questions) || raw.questions.length<1 || raw.questions.length>100) throw Error('Cần từ 1 đến 100 câu hỏi');
 const title=String(raw.title||'Bộ câu hỏi').trim().slice(0,100);
 const questions=raw.questions.map((q,i)=>{
   const text=String(q.text||'').trim();
   const choices=Array.isArray(q.choices)?q.choices.map(c=>String(c).trim()):[];
   if(!text || text.length>300 || choices.length<2 || choices.length>4 || choices.some(c=>!c || c.length>100) || !Number.isInteger(q.correct) || q.correct<0 || q.correct>=choices.length || !Number.isInteger(Number(q.durationSec)) || Number(q.durationSec)<5 || Number(q.durationSec)>60) throw Error('Câu '+(i+1)+' không hợp lệ');
   return {text,choices,correct:q.correct,durationSec:Number(q.durationSec),img: typeof q.img==='string' && /^https:\/\//.test(q.img)?q.img.slice(0,500):''};
 });
 return {title,questions};
}
export function nicknameValid(name){
 if(typeof name!=='string') return false;
 const n=name.trim();
 return n.length>=1 && n.length<=15 && !/\b(dit|dm|dmm|fuck|shit|cặc|lồn)\b/i.test(n);
}
