export function parseQuizText(text) {
 const lines = String(text || '').replace(/\r/g,'').split('\n').map(x=>x.trim()).filter(Boolean);
 const questions=[], warnings=[]; let current=null;
 const finish=()=>{
  if(!current)return;
  if(current.choices.length<2 || current.choices.length>4){warnings.push('Bo qua cau thieu dap an');current=null;return}
  if(current.correct<0){current.correct=0;current.needsReview=true;warnings.push('Chua tim thay dap an dung: '+current.text.slice(0,60))}
  questions.push({...current,durationSec:20,img:''});current=null;
 };
 for(const line of lines){
  const start=line.match(/^(?:Câu|Cau|Question|Q)\s*\d+\s*[:.)-]\s*(.+)$/i);
  if(start){finish();current={text:start[1],choices:[],correct:-1};continue}
  if(!current)continue;
  const answer=line.match(/^(?:Đáp án|Dap an|Answer|Correct)\s*[:\-]\s*([A-D])/i);
  if(answer){current.correct=answer[1].toUpperCase().charCodeAt(0)-65;continue}
  const choice=line.match(/^([A-D])\s*[.)\-:]\s*(.*)$/i);
  if(choice){if(current.choices.length<4)current.choices.push(choice[2]);continue}
  if(current.choices.length===0)current.text+=' '+line;
 }
 finish();
 for(const q of questions)if(q.correct>=q.choices.length){q.correct=0;q.needsReview=true;warnings.push('Dap an dung nam ngoai danh sach: '+q.text.slice(0,60))}
 return {questions,warnings,detected:questions.length};
}
