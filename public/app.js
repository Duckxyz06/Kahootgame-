const socket=io({reconnection:true,reconnectionDelay:500});
const app=document.getElementById('app');
const get=(id)=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const query=new URLSearchParams(location.search);
let token=sessionStorage.getItem('quizvn:token')||'';
let pin=sessionStorage.getItem('quizvn:pin')||'';
let hostToken=sessionStorage.getItem('quizvn:hostToken')||'';
let playerId=localStorage.getItem('quizvn:playerId')||'';
let playerPin=localStorage.getItem('quizvn:playerPin')||'';
let currentQuiz=null, roomState='LOBBY', currentIndex=-1, question=null, countdown=null, answered=false, lastResult=null, hostPlayers=[];
function call(ev,data){return new Promise(resolve=>socket.emit(ev,data,r=>resolve(r||{ok:false,error:'Không phản hồi từ máy chủ'})))}
function toast(s,bad=false){const el=get('message');if(el){el.textContent=s;el.className=bad?'error':'success'}else alert(s)}
function btn(id,text,cls='btn'){return '<button id="'+id+'" class="'+cls+'">'+text+'</button>'}
function layout(content){app.innerHTML='<main class="layout">'+content+'</main>'}
const home=()=>{app.innerHTML='<main class="hero"><div class="hero-inner"><div class="eyebrow">Trò chơi kiến thức thời gian thực</div><h1>Quiz<span>VN</span> ✦</h1><p class="sub">Kết nối lớp học. Thử thách kiến thức.<br>200 người chơi, một khoảnh khắc bùng nổ.</p><section class="panel join"><h2>Tham gia trò chơi</h2><div class="stack"><label>Mã PIN 6 chữ số<input id="pin" class="field" inputmode="numeric" maxlength="6" placeholder="Ví dụ: 123456" value="'+esc(query.get('pin')||playerPin)+'"></label><label>Biệt danh<input id="nickname" class="field" maxlength="15" placeholder="Tên hiển thị của bạn"></label>'+btn('join','Tham gia ngay')+'<div id="message"></div></div></section><p class="hint">Không cần đăng ký • Chơi trên điện thoại hoặc máy tính</p></div></main>';get('join').onclick=join};
function playerView(){layout('<div class="panel"><div class="row space"><h2>✦ QuizVN</h2><span id="player-score">0 điểm</span></div><div id="player-body"></div><p id="message"></p></div>');drawPlayer()}
function drawPlayer(){
 const b=get('player-body');if(!b)return;
 const score=get('player-score');if(score&&lastResult)score.textContent=lastResult.score+' điểm';
 if(roomState==='LOBBY'){b.innerHTML='<div class="quiz-head"><h2>Đã vào phòng '+esc(playerPin)+'</h2><p>Chờ người điều khiển bắt đầu trò chơi…</p></div>';return}
 if(roomState==='QUESTION'&&question){
  const remaining=Math.max(0,Math.ceil((question.endsAt-Date.now())/1000));
  b.innerHTML='<div class="quiz-head"><div class="row space"><b>Câu '+(question.index+1)+'</b><span class="time" id="timer">'+remaining+'s</span></div></div><h2>'+esc(question.text)+'</h2>'+(question.img?'<img class="question-img" src="'+esc(question.img)+'" alt="Ảnh câu hỏi">':'')+'<div class="answer-grid">'+question.choices.map((x,i)=>'<button class="answer" data-choice="'+i+'" '+(answered?'disabled':'')+'><span>'+['▲','◆','●','■'][i]+'</span> '+esc(x)+'</button>').join('')+'</div><p>'+(answered?'Đã gửi đáp án. Chờ kết quả…':'Hãy trả lời nhanh để nhận nhiều điểm!')+'</p>';
  b.querySelectorAll('[data-choice]').forEach(el=>el.onclick=async()=>{const r=await call('p:answer',{index:question.index,choice:Number(el.dataset.choice)});if(r.ok){answered=true;drawPlayer()}else toast(r.error,true)});
  if(countdown)clearInterval(countdown);countdown=setInterval(()=>{const x=get('timer');if(x)x.textContent=Math.max(0,Math.ceil((question.endsAt-Date.now())/1000))+'s';else clearInterval(countdown)},300);return;
 }
 if(roomState==='REVEAL'||roomState==='BOARD'){
  b.innerHTML='<div class="quiz-head"><h2>'+(lastResult?.correct?'🎉 Chính xác!':'✨ Tiếp tục cố gắng!')+'</h2><p>Bạn nhận '+(lastResult?.points||0)+' điểm</p><h2>Tổng '+(lastResult?.score||0)+' điểm • Hạng '+(lastResult?.rank||'-')+'</h2><p>Chờ câu hỏi tiếp theo…</p></div>';return;
 }
 if(roomState==='OVER')b.innerHTML='<div class="quiz-head"><h2>🏁 Trò chơi kết thúc!</h2><p>Bạn đạt '+(lastResult?.score||0)+' điểm • Hạng '+(lastResult?.rank||'-')+'</p></div>';
}
async function join(){
 const nextPin=get('pin').value.trim(),name=get('nickname').value.trim();
 if(!/^\d{6}$/.test(nextPin))return toast('Mã PIN gồm đúng 6 chữ số',true);
 if(!name&&!playerId)return toast('Nhập biệt danh',true);
 const id=playerPin===nextPin?playerId:null;
 const r=await call('p:join',{pin:nextPin,nickname:name,playerId:id});
 if(!r.ok)return toast(r.error,true);
 playerPin=nextPin;playerId=r.playerId;localStorage.setItem('quizvn:playerPin',playerPin);localStorage.setItem('quizvn:playerId',playerId);
 roomState=r.state;lastResult={score:r.score,points:0,rank:0};history.replaceState(null,'','/');playerView();
}
async function resumePlayer(){if(!playerPin||!playerId)return;const r=await call('p:join',{pin:playerPin,playerId});if(r.ok){roomState=r.state;lastResult={score:r.score,rank:lastResult?.rank||0};playerView()}else{localStorage.removeItem('quizvn:playerId');playerId='';home()}}
socket.on('connect',()=>{if(location.pathname==='/host'&&pin&&hostToken)resumeHost();if(location.pathname==='/'&&playerId&&playerPin)resumePlayer()});
socket.on('p:state',r=>{roomState=r.state;if(lastResult)lastResult.score=r.score;drawPlayer()});
socket.on('q:show',q=>{roomState='QUESTION';question=q;answered=!!q.answered;drawPlayer()});
socket.on('p:answered',()=>{answered=true;drawPlayer()});
socket.on('p:result',r=>{lastResult=r;roomState=r.state;drawPlayer()});
socket.on('p:kicked',r=>{playerId='';localStorage.removeItem('quizvn:playerId');home();toast(r.reason||'Đã rời phòng',true)});
function hostLogin(){layout('<div class="panel" style="max-width:560px;margin:60px auto"><h2>Điều khiển QuizVN</h2><p>Đăng nhập quản trị để tạo phòng, soạn đề và điều khiển trò chơi.</p><label>Mật khẩu Host<input id="password" class="field" type="password" placeholder="HOST_PASSWORD"></label><p>'+btn('login','Đăng nhập')+'</p><p id="message"></p></div>');get('login').onclick=async()=>{const r=await call('host:auth',{password:get('password').value});if(r.ok){token=r.token;sessionStorage.setItem('quizvn:token',token);if(location.pathname==='/editor')editor();else hostPanel()}else toast(r.error,true)}}
async function hostPanel(){
 if(!token)return hostLogin();
 layout('<div class="row space"><h1>✦ Bảng điều khiển</h1><a class="btn outline" href="/editor">✎ Soạn bộ câu hỏi</a></div><div class="cols"><section class="panel"><h2>Tạo phòng chơi</h2><label>Chọn bộ câu hỏi<select id="quiz-id" class="field"></select></label><p>'+btn('create','Tạo PIN mới')+'</p><p id="message"></p><p id="persistence" class="muted"></p></section><section class="panel"><h2>Sẵn sàng trình chiếu?</h2><p>Mã QR xuất hiện khi phòng được tạo. Chia sẻ PIN lên máy chiếu và cho phép học viên vào bằng điện thoại.</p><p class="muted">Mỗi phòng hỗ trợ tối đa 200 người chơi.</p></section></div>');
 const r=await call('quiz:list',{token});if(!r.ok){toast(r.error,true);return}
 const select=get('quiz-id');select.innerHTML=r.quizzes.map(q=>'<option value="'+esc(q.id)+'">'+esc(q.title)+' ('+q.count+' câu)</option>').join('');
 get('persistence').textContent=r.persistent?'✓ Đang lưu bộ câu hỏi trong PostgreSQL':'⚠ Bộ đề chỉ lưu tạm trong RAM. Thêm DATABASE_URL để lưu vĩnh viễn.';
 get('create').onclick=async()=>{const r=await call('host:create',{token,quizId:select.value});if(r.ok){pin=r.pin;hostToken=r.token;sessionStorage.setItem('quizvn:pin',pin);sessionStorage.setItem('quizvn:hostToken',hostToken);hostRoom()}else toast(r.error,true)};
}
function hostRoom(){
 layout('<div class="row space"><h1>✦ Phòng QuizVN</h1><span class="pill" id="state">LOBBY</span></div><div class="cols"><div class="panel"><p>PIN tham gia</p><div class="big-pin">'+esc(pin)+'</div><p>Người chơi truy cập <b>'+esc(location.origin)+'</b></p><div id="qr"></div><div class="row"><button id="start" class="btn">Bắt đầu trò chơi</button><button id="next" class="btn outline" style="display:none">Câu tiếp theo →</button><button id="board" class="btn outline" style="display:none">Bảng xếp hạng</button><button id="end" class="btn danger" style="display:none">Kết thúc câu hỏi</button></div><p id="message"></p></div><div class="panel"><h2 id="player-count">Người chơi (0/200)</h2><div class="players" id="players"></div><div id="game-area" style="margin-top:20px"></div></div></div>');
 get('start').onclick=()=>hostAction('host:start');get('end').onclick=()=>hostAction('host:end');get('board').onclick=()=>hostAction('host:board');get('next').onclick=()=>hostAction('host:next');
 fetch('/api/qr/'+pin).then(x=>x.json()).then(x=>{const el=get('qr');if(el)el.innerHTML='<img src="'+x.dataUrl+'" width="180" alt="QR tham gia">'}).catch(()=>{});
}
async function hostAction(event,extra={}){const r=await call(event,{pin,token:hostToken,...extra});if(!r.ok)toast(r.error,true)}
async function resumeHost(){const r=await call('host:resume',{pin,token:hostToken});if(!r.ok)return;hostRoom();get('state').textContent=r.state;setControls(r.state)}
function setControls(state){
 roomState=state;if(get('state'))get('state').textContent=state;
 [['start',state==='LOBBY'],['end',state==='QUESTION'],['board',state==='REVEAL'],['next',state==='REVEAL'||state==='BOARD']].forEach(([id,show])=>{if(get(id))get(id).style.display=show?'':'none'});
}
socket.on('h:lobby',r=>{hostPlayers=r.players;if(!get('players'))return;get('player-count').textContent='Người chơi ('+r.count+'/200)';get('players').innerHTML=r.players.map(p=>'<span class="pill">'+esc(p.name)+(p.connected?' ●':' ○')+' <button data-kick="'+esc(p.id)+'" title="Mời rời phòng">×</button></span>').join('');get('players').querySelectorAll('[data-kick]').forEach(b=>b.onclick=()=>hostAction('host:kick',{playerId:b.dataset.kick}))});
socket.on('h:q',q=>{setControls('QUESTION');const a=get('game-area');if(!a)return;a.innerHTML='<p>Câu '+(q.index+1)+'/'+q.total+'</p><h2>'+esc(q.text)+'</h2>'+(q.img?'<img class="question-img" src="'+esc(q.img)+'">':'')+'<p class="time" id="host-timer"></p><div>'+q.choices.map((x,i)=>'<p><b>'+['▲','◆','●','■'][i]+'</b> '+esc(x)+'</p>').join('')+'</div><p id="answered-count">0 người đã trả lời</p>';if(countdown)clearInterval(countdown);countdown=setInterval(()=>{const t=get('host-timer');if(t)t.textContent=Math.max(0,Math.ceil((q.endsAt-Date.now())/1000))+'s';else clearInterval(countdown)},300)});
socket.on('h:progress',r=>{const el=get('answered-count');if(el)el.textContent=r.answered+'/'+r.count+' người đã trả lời'});
socket.on('h:result',r=>{setControls('REVEAL');const a=get('game-area');if(a)a.innerHTML='<h2>📊 Kết quả đáp án</h2>'+r.counts.map((n,i)=>'<p>'+['▲','◆','●','■'][i]+' Đáp án '+(i+1)+(i===r.correct?' ✓ ĐÚNG':'')+' — '+n+' lựa chọn</p><div class="bar"><i style="width:'+(r.answered?100*n/r.answered:0)+'%"></i></div>').join('')});
socket.on('h:board',r=>{setControls('BOARD');const a=get('game-area');if(a)a.innerHTML='<h2>🏆 TOP 5</h2>'+r.top.map((p,i)=>'<p><b>#'+(i+1)+' '+esc(p.name)+'</b> — '+p.score+' điểm</p>').join('')});
socket.on('h:over',r=>{setControls('OVER');const a=get('game-area');if(a)a.innerHTML='<h2>🎉 Hoàn thành!</h2><div class="podium">'+[r.podium[1],r.podium[0],r.podium[2]].map((p,i)=>'<div>'+['🥈','🥇','🥉'][i]+'<h3>'+esc(p?.name||'–')+'</h3><b>'+esc(p?.score||0)+'</b></div>').join('')+'</div><p><a class="btn" href="/api/results/'+pin+'?token='+encodeURIComponent(hostToken)+'">Xuất CSV</a></p>'});
let quiz={title:'Bộ câu hỏi của tôi',questions:[{text:'',choices:['',''],correct:0,durationSec:20,img:''}]};
function blank(){return {text:'',choices:['',''],correct:0,durationSec:20,img:''}}
function editor(){if(!token)return hostLogin();layout('<div class="row space"><h1>✎ Soạn bộ câu hỏi</h1><a class="btn outline" href="/host">← Quay về Host</a></div><div class="panel"><label>Tên bộ câu hỏi<input id="title" class="field" maxlength="100"></label><div id="questions"></div><div class="row"><button class="btn outline" id="add">+ Thêm câu</button><button class="btn" id="save">Lưu bộ đề lên server</button><button class="btn outline" id="download">Xuất JSON</button><label class="btn outline">Nhập DOCX/PDF<input id="document-upload" type="file" accept=".pdf,.docx" hidden></label><label class="btn outline">Nhập JSON<input id="upload" type="file" accept=".json" hidden></label></div><p id="message"></p><p class="muted">Chỉ lưu bền vững nếu server có DATABASE_URL PostgreSQL.</p></div>');
 get('add').onclick=()=>{quiz.questions.push(blank());renderQuestions()};
 get('save').onclick=async()=>{collect();const r=await call('quiz:save',{token,quiz});toast(r.ok?(r.temporary?'Đã lưu tạm trên server (chưa có database)':'Đã lưu trong PostgreSQL. ID: '+r.id):r.error,!r.ok)};
 get('download').onclick=()=>{collect();const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(quiz,null,2)],{type:'application/json'}));link.download='quizvn-questions.json';link.click();URL.revokeObjectURL(link.href)};
 get('document-upload').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  if(file.size>8*1024*1024)return toast('Giới hạn 8 MB/tệp',true);
  toast('Đang đọc tệp...');
  const body=new FormData();body.append('file',file);
  try{
   const response=await fetch('/api/import',{method:'POST',headers:{'x-host-token':token},body});
   const result=await response.json();
   if(!response.ok)throw Error(result.error);
   if(!result.questions.length)throw Error('Không nhận diện được câu hỏi. Mẫu: Câu 1: ... A. ... B. ... Đáp án: A');
   collect();quiz.questions=result.questions.map(q=>({text:q.text,choices:q.choices,correct:q.correct,durationSec:q.durationSec,img:q.img}));
   renderQuestions();
   toast('Đã nhập '+result.detected+' câu. '+(result.warnings.length?'Cần kiểm tra thủ công: '+result.warnings.join('; '):'Vui lòng rà soát đáp án trước khi lưu.'),!!result.warnings.length);
  }catch(error){toast(error.message,true)}
 };
 get('upload').onchange=async e=>{try{const imported=JSON.parse(await e.target.files[0].text());if(!Array.isArray(imported.questions))throw Error('Không có câu hỏi');quiz=imported;renderQuestions()}catch(e){toast('Tệp JSON không hợp lệ: '+e.message,true)}};
 loadQuizList();renderQuestions();
}
async function loadQuizList(){const r=await call('quiz:list',{token});if(!r.ok)return;const panel=get('questions');if(!panel)return;const picker=document.createElement('div');picker.className='row';picker.innerHTML='<select id="saved-quizzes" class="field" style="max-width:350px"><option value="">— Chọn bộ câu hỏi đã lưu —</option>'+r.quizzes.map(q=>'<option value="'+esc(q.id)+'">'+esc(q.title)+'</option>').join('')+'</select>'+btn('load-quiz','Tải để chỉnh sửa','btn outline');panel.before(picker);get('load-quiz').onclick=async()=>{const id=get('saved-quizzes').value;if(!id)return;const rr=await call('quiz:get',{token,id});if(rr.ok){quiz=rr.quiz;renderQuestions()}else toast(rr.error,true)}}
function collect(){const title=get('title');if(title)quiz.title=title.value;document.querySelectorAll('[data-q]').forEach((node,i)=>{quiz.questions[i]={text:node.querySelector('[data-text]').value,choices:[...node.querySelectorAll('[data-choice]')].map(x=>x.value),correct:Number(node.querySelector('[data-correct]:checked')?.value||0),durationSec:Number(node.querySelector('[data-duration]').value),img:node.querySelector('[data-img]').value}})}
function renderQuestions(){
 if(!get('questions'))return;get('title').value=quiz.title;
 get('questions').innerHTML=quiz.questions.map((q,i)=>'<section class="card-question" data-q="'+i+'"><div class="row space"><h3>Câu '+(i+1)+'</h3><button class="btn danger small" data-remove="'+i+'">Xóa</button></div><textarea data-text class="field" placeholder="Nhập nội dung câu hỏi">'+esc(q.text)+'</textarea><p>Đáp án (chọn ô tròn của câu đúng)</p>'+q.choices.map((c,j)=>'<div class="choice-line"><input type="radio" data-correct name="correct-'+i+'" value="'+j+'" '+(q.correct===j?'checked':'')+'><input data-choice class="field" value="'+esc(c)+'" placeholder="Đáp án '+(j+1)+'"></div>').join('')+'<div class="row"><button class="btn outline small" data-plus="'+i+'">+ Đáp án</button><button class="btn outline small" data-minus="'+i+'">− Đáp án</button><label>Thời gian (giây)<input data-duration class="field" type="number" min="5" max="60" value="'+q.durationSec+'"></label></div><label>Link ảnh minh họa (tùy chọn)<input data-img class="field" value="'+esc(q.img||'')+'" placeholder="https://..."></label></section>').join('');
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{collect();if(quiz.questions.length<=1)return toast('Cần ít nhất 1 câu',true);quiz.questions.splice(Number(b.dataset.remove),1);renderQuestions()});
 document.querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>{collect();const q=quiz.questions[Number(b.dataset.plus)];if(q.choices.length<4)q.choices.push('');renderQuestions()});
 document.querySelectorAll('[data-minus]').forEach(b=>b.onclick=()=>{collect();const q=quiz.questions[Number(b.dataset.minus)];if(q.choices.length>2){q.choices.pop();q.correct=Math.min(q.correct,q.choices.length-1)}renderQuestions()});
}
if(location.pathname==='/host'){hostPanel();if(pin&&hostToken)resumeHost()}else if(location.pathname==='/editor')editor();else if(playerId&&playerPin)resumePlayer();else home();
