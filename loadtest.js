import { io } from 'socket.io-client';
const url=process.env.URL||'http://localhost:3000';const pin=process.env.PIN;if(!/^\d{6}$/.test(pin||''))throw Error('Set PIN=123456 and create room before testing');
const N=Math.min(200,Number(process.env.BOTS)||200),bots=[],latency=[],responded=[];let drops=0,joined=0;
function request(s,ev,data){return new Promise(resolve=>s.emit(ev,data,resolve))}
for(let i=0;i<N;i++){
 const socket=io(url,{reconnection:false,transports:['websocket']});bots.push(socket);
 socket.on('disconnect',()=>drops++);
 await new Promise(resolve=>socket.once('connect',resolve));
 const r=await request(socket,'p:join',{pin,nickname:'Bot_'+i});if(!r?.ok){console.log('Join failed',i,r);continue}joined++;
 socket.on('q:show',q=>{const start=Date.now();latency.push(Date.now()-start);setTimeout(async()=>{const t=Date.now();await request(socket,'p:answer',{index:q.index,choice:Math.floor(Math.random()*q.choices.length)});responded.push(Date.now()-t)},100+Math.random()*1000)});
}
console.log('Joined:',joined,'/',N,'; waiting 60 seconds for host to start or advance questions');
setTimeout(()=>{const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length)+' ms':'n/a';console.log('Question event handler latency:',avg(latency),'(client clock only)');console.log('Answer acknowledgement latency:',avg(responded));console.log('Disconnected:',drops);bots.forEach(s=>s.disconnect());process.exit(0)},60000);
