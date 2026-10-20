import express from 'express';
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Server} from 'socket.io';
import QRCode from 'qrcode';
import {points} from './scoring.js';
import {validateQuiz,nicknameValid} from './validation.js';
import {listQuizzes,getQuiz,saveQuiz,isPersistent} from './store.js';

const app=express();app.use(express.json({limit:'300kb'}));
const server=http.createServer(app);
const io=new Server(server,{perMessageDeflate:false,pingInterval:25000,pingTimeout:30000,maxHttpBufferSize:300000});
const PASSWORD=process.env.HOST_PASSWORD||(process.env.NODE_ENV==='production'?'':'admin');
if(!PASSWORD) throw Error('HOST_PASSWORD bắt buộc khi deploy');
const sessions=new Map(), rooms=new Map(), hostSessions=new Map();
const hostRoom=pin=>pin+':host';
const ack=(cb,result)=>{if(typeof cb==='function')cb(result)};
const error=(cb,message)=>ack(cb,{ok:false,error:message});
const getRoom=(p)=>{const r=rooms.get(String(p?.pin||''));return r&&p?.token===r.token?r:null};
function standings(r){return [...r.players.values()].sort((a,b)=>b.score-a.score||a.joined-b.joined)}
function rank(r,p){return standings(r).findIndex(x=>x.id===p.id)+1}
function emitLobby(r){io.to(hostRoom(r.pin)).emit('h:lobby',{players:[...r.players.values()].map(p=>({id:p.id,name:p.name,connected:!!p.socket})),count:r.players.size,max:200})}
function emitCount(r){if(r.throttle)return;r.throttle=setTimeout(()=>{r.throttle=null;io.to(hostRoom(r.pin)).emit('h:progress',{answered:r.answers.size,count:r.players.size,counts:r.counts})},500)}
function notifyPlayer(r,p){
  if(!p.socket)return;
  io.to(p.socket).emit('p:state',{state:r.state,index:r.index,total:r.quiz.questions.length,score:p.score,rank:rank(r,p)});
  if(r.state==='QUESTION') {
    const q=r.quiz.questions[r.index];
    io.to(p.socket).emit('q:show',{index:r.index,text:q.text,choices:q.choices,img:q.img,endsAt:r.endsAt,answered:r.answers.has(p.id)});
  }
  if(['REVEAL','BOARD','OVER'].includes(r.state))io.to(p.socket).emit('p:result',{points:p.lastPoints||0,correct:p.lastCorrect||false,score:p.score,rank:rank(r,p),state:r.state});
}
function nextQuestion(r){
  clearTimeout(r.timer);r.index++;
  if(r.index>=r.quiz.questions.length){
    r.state='OVER';const podium=standings(r).slice(0,3).map(p=>({name:p.name,score:p.score}));
    io.to(hostRoom(r.pin)).emit('h:over',{podium});
    for(const p of r.players.values())notifyPlayer(r,p);
    return;
  }
  const q=r.quiz.questions[r.index];
  r.state='QUESTION';r.answers=new Map();r.counts=q.choices.map(()=>0);
  r.startedAt=Date.now();r.endsAt=r.startedAt+q.durationSec*1000;
  io.to(hostRoom(r.pin)).emit('h:q',{index:r.index,total:r.quiz.questions.length,...q,endsAt:r.endsAt});
  io.to(r.pin).emit('q:show',{index:r.index,text:q.text,choices:q.choices,img:q.img,endsAt:r.endsAt});
  r.timer=setTimeout(()=>reveal(r),q.durationSec*1000);
}
function reveal(r){
 if(r.state!=='QUESTION')return;
 clearTimeout(r.timer);r.state='REVEAL';const q=r.quiz.questions[r.index];
 io.to(hostRoom(r.pin)).emit('h:result',{correct:q.correct,counts:r.counts,answered:r.answers.size});
 for(const p of r.players.values())notifyPlayer(r,p);
}
function board(r){
 if(r.state!=='REVEAL')return;
 r.state='BOARD';
 io.to(hostRoom(r.pin)).emit('h:board',{top:standings(r).slice(0,5).map(p=>({name:p.name,score:p.score}))});
 for(const p of r.players.values())notifyPlayer(r,p);
}
app.get('/health',(_,res)=>res.json({ok:true,database:isPersistent()?'postgres':'memory'}));
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)),'../public')));
app.get('/api/qr/:pin',async(req,res)=>{try{
 const pin=String(req.params.pin);if(!/^\d{6}$/.test(pin))return res.status(400).json({error:'PIN'});
 const url=(process.env.PUBLIC_URL||req.protocol+'://'+req.get('host'))+'/?pin='+pin;
 res.json({url,dataUrl:await QRCode.toDataURL(url)});
 }catch{res.status(500).json({error:'QR'})}});
app.get('/api/results/:pin', (req,res)=>{
 const r=getRoom({pin:req.params.pin,token:req.query.token});
 if(!r)return res.status(403).send('Forbidden');
 const rows=[['nickname','score','rank'],...standings(r).map((p,i)=>[p.name,p.score,i+1])];
 const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
 res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="quizvn.csv"');res.send(csv);
});
io.on('connection',socket=>{
 let available=14,last=Date.now();
 socket.use((packet,next)=>{const now=Date.now();available=Math.min(14,available+(now-last)/200);last=now;
 if(available<1){const cb=packet.at(-1);error(cb,'Thao tác quá nhanh');return}available--;next()});
 socket.on('host:auth',(data,cb)=>{
   if(!data||typeof data.password!=='string'||data.password!==PASSWORD)return error(cb,'Sai mật khẩu Host');
   const token=crypto.randomBytes(24).toString('hex');sessions.set(token,Date.now());ack(cb,{ok:true,token});
 });
 const authenticated=data=>typeof data?.token==='string'&&sessions.has(data.token);
 socket.on('quiz:list',async(data,cb)=>{if(!authenticated(data))return error(cb,'Chưa đăng nhập');try{ack(cb,{ok:true,quizzes:await listQuizzes(),persistent:isPersistent()})}catch(e){error(cb,'Lỗi database: '+e.message)}});
 socket.on('quiz:get',async(data,cb)=>{if(!authenticated(data))return error(cb,'Chưa đăng nhập');try{const quiz=await getQuiz(String(data.id));quiz?ack(cb,{ok:true,quiz}):error(cb,'Không tìm thấy bộ câu hỏi')}catch(e){error(cb,'Lỗi database: '+e.message)}});
 socket.on('quiz:save',async(data,cb)=>{if(!authenticated(data))return error(cb,'Chưa đăng nhập');try{const quiz=validateQuiz(data.quiz);ack(cb,{ok:true,...await saveQuiz(quiz)})}catch(e){error(cb,e.message)}});
 socket.on('host:create',async(data,cb)=>{
 if(!authenticated(data))return error(cb,'Chưa xác thực');
 try{
  const quiz=data.quiz?validateQuiz(data.quiz):validateQuiz(await getQuiz(String(data.quizId||'sample')));
  let pin;do{pin=String(crypto.randomInt(100000,1000000))}while(rooms.has(pin));
  const token=crypto.randomBytes(24).toString('hex');
  const room={pin,token,quiz,state:'LOBBY',index:-1,players:new Map(),answers:new Map(),counts:[],timer:null,throttle:null};
  rooms.set(pin,room);hostSessions.set(token,pin);socket.join(hostRoom(pin));
  ack(cb,{ok:true,pin,token,quizTitle:quiz.title,total:quiz.questions.length});emitLobby(room);
 }catch(e){error(cb,e.message)}
 });
 socket.on('host:resume',(data,cb)=>{const r=getRoom(data);if(!r)return error(cb,'Không có quyền điều khiển phòng');socket.join(hostRoom(r.pin));ack(cb,{ok:true,pin:r.pin,state:r.state,index:r.index,total:r.quiz.questions.length});emitLobby(r);
 if(r.state==='QUESTION')socket.emit('h:q',{index:r.index,total:r.quiz.questions.length,...r.quiz.questions[r.index],endsAt:r.endsAt});
 if(r.state==='REVEAL')socket.emit('h:result',{correct:r.quiz.questions[r.index].correct,counts:r.counts});
 if(r.state==='BOARD')socket.emit('h:board',{top:standings(r).slice(0,5).map(p=>({name:p.name,score:p.score}))});
 if(r.state==='OVER')socket.emit('h:over',{podium:standings(r).slice(0,3).map(p=>({name:p.name,score:p.score}))});
 });
 socket.on('p:join',(data,cb)=>{
  const r=rooms.get(String(data?.pin||''));if(!r)return error(cb,'Không tìm thấy phòng');
  let p=typeof data?.playerId==='string'?r.players.get(data.playerId):null;
  if(p){if(p.socket&&p.socket!==socket.id){const old=io.sockets.sockets.get(p.socket);if(old){old.emit('p:kicked',{reason:'Tài khoản đã đăng nhập trên thiết bị khác'});old.leave(r.pin)}}}
  else{
   if(r.state!=='LOBBY')return error(cb,'Trò chơi đã bắt đầu');
   if(r.players.size>=200)return error(cb,'Phòng đã đủ 200 người');
   if(!nicknameValid(data.nickname))return error(cb,'Tên phải dài 1–15 ký tự và phù hợp');
   const name=data.nickname.trim();if([...r.players.values()].some(x=>x.name.toLocaleLowerCase('vi')===name.toLocaleLowerCase('vi')))return error(cb,'Tên đã được sử dụng');
   p={id:crypto.randomUUID(),name,score:0,joined:Date.now(),socket:null,lastPoints:0,lastCorrect:false};r.players.set(p.id,p);
  }
  p.socket=socket.id;socket.data.player={pin:r.pin,id:p.id};socket.join(r.pin);
  ack(cb,{ok:true,playerId:p.id,name:p.name,state:r.state,score:p.score});emitLobby(r);notifyPlayer(r,p);
 });
 socket.on('p:answer',(data,cb)=>{
  const ref=socket.data.player,r=rooms.get(ref?.pin),p=r?.players.get(ref?.id);
  if(!r||!p||p.socket!==socket.id)return error(cb,'Bạn chưa tham gia');
  if(r.state!=='QUESTION'||Date.now()>r.endsAt)return error(cb,'Đã hết giờ');
  if(r.answers.has(p.id))return error(cb,'Bạn đã trả lời câu này');
  if(data?.index!==r.index||!Number.isInteger(data.choice)||data.choice<0||data.choice>=r.quiz.questions[r.index].choices.length)return error(cb,'Đáp án không hợp lệ');
  const q=r.quiz.questions[r.index],correct=data.choice===q.correct;
  const added=points(correct,Date.now()-r.startedAt,q.durationSec*1000);
  p.lastPoints=added;p.lastCorrect=correct;p.score+=added;r.answers.set(p.id,data.choice);r.counts[data.choice]++;
  ack(cb,{ok:true});socket.emit('p:answered',{index:r.index});emitCount(r);
  if(r.answers.size===r.players.size)reveal(r);
 });
 socket.on('host:start',(data,cb)=>{const r=getRoom(data);if(!r)return error(cb,'Không có quyền');if(r.state!=='LOBBY')return error(cb,'Đã bắt đầu');if(!r.players.size)return error(cb,'Chưa có người chơi');nextQuestion(r);ack(cb,{ok:true})});
 socket.on('host:end',(data,cb)=>{const r=getRoom(data);if(!r)return error(cb,'Không có quyền');reveal(r);ack(cb,{ok:true})});
 socket.on('host:board',(data,cb)=>{const r=getRoom(data);if(!r)return error(cb,'Không có quyền');board(r);ack(cb,{ok:true})});
 socket.on('host:next',(data,cb)=>{const r=getRoom(data);if(!r)return error(cb,'Không có quyền');if(!['REVEAL','BOARD'].includes(r.state))return error(cb,'Chưa thể chuyển câu');nextQuestion(r);ack(cb,{ok:true})});
 socket.on('host:kick',(data,cb)=>{const r=getRoom(data);if(!r)return error(cb,'Không có quyền');if(r.state!=='LOBBY')return error(cb,'Chỉ kick trước khi bắt đầu');const p=r.players.get(data.playerId);if(!p)return error(cb,'Không tìm thấy người chơi');io.to(p.socket).emit('p:kicked',{reason:'Host đã mời ra khỏi phòng'});io.sockets.sockets.get(p.socket)?.leave(r.pin);r.players.delete(p.id);emitLobby(r);ack(cb,{ok:true})});
 socket.on('disconnect',()=>{const ref=socket.data.player,r=rooms.get(ref?.pin),p=r?.players.get(ref?.id);if(p&&p.socket===socket.id){p.socket=null;emitLobby(r)}});
});
const port=Number(process.env.PORT)||3000;
server.listen(port,'0.0.0.0',()=>console.log('QuizVN listening on '+port));
