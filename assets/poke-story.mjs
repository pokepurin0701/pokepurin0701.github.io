export const DAY = 86400000;
export const dayNow = (now=Date.now()) => Math.floor((now + 9*3600000)/DAY);
export const hourNow = (now=Date.now()) => new Date(now+9*3600000).getUTCHours();
export const hash = (seed,n) => {let x=(seed ^ Math.imul(n,2654435761))>>>0;x^=x>>>16;x=Math.imul(x,2246822507);x^=x>>>13;return x>>>0};
export const dateLabel = day => new Date(day*DAY).toLocaleDateString('ja-JP',{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit'});
export function makeState(day=dayNow(),seed=crypto.getRandomValues(new Uint32Array(1))[0],baseVisits=0) {return {v:1,seed,baseVisits:Math.max(0,baseVisits-1),firstDay:day,days:[],letters:[],choice:null,answerDay:null,items:[],album:[],resolved:[],packageOpened:false};}
export function addMemory(s,id,title,body,icon,day){if(!s.album.some(a=>a.id===id))s.album.unshift({id,title,body,icon,day});}
export function addLetter(s,id,subject,body,day){if(!s.letters.some(l=>l.id===id))s.letters.unshift({id,subject,body,day,read:false,reply:null,replyDay:null});}
export const firstLetters=[['緊急です。','ぽけのことを褒めてください。\n理由は特にありません。\nでも急いでいます。'],['これは、ないしょ。','今日いちばんに思い出したの、きみでした。\n……プリンの次に。\nこの順番は、だれにも言わないでね。'],['ご請求のお知らせ','ぽけを見つけてしまったあなたへ。\n本日のお支払い：かわいい、のひとこと。\nお金はいりません。お返事はほしいです。']];
export function enter(s,day,hour=12){if(!s.days.includes(day)){s.days.push(day);s.days.sort((a,b)=>a-b);}if(!s.letters.length){const l=firstLetters[s.seed%3];addLetter(s,'welcome',...l,day);addMemory(s,'first','ぽけに見つかった日','この日、ぽけとのへんてこな日常がはじまりました。','🍮',day);}
 for(const l of [...s.letters]){if(l.reply&&day>=l.replyDay+2+hash(s.seed,l.replyDay)%3&&!s.letters.some(n=>n.id==='reply-'+l.id)&&!l.id.startsWith('reply-')){const kind=/かわい|世界一|すき|好き|褒|天才|えらい/.test(l.reply)?'sweet':/努力|がんば|頑張|応援/.test(l.reply)?'effort':'other';const body=kind==='sweet'?'このまえの言葉、何回も読みました。\nにやにやしたのは、ここだけの話です。\nきみのぶんのプリン、ちゃんと取ってあります。':kind==='effort'?'このまえのお返事を読んで、特訓しました。\nプリンをかわいく食べる練習です。\n成果は……次の事件で見せます。':'お返事、ぽけの宝箱にしまいました。\nちょっとへんなところも、きみらしくてすき。\nまた忘れたころに、話しかけるね。';addLetter(s,'reply-'+l.id,'お返事のお返事です。',body,day);}}
 if(day>s.firstDay+5&&hash(s.seed,day)%7===0){const id='surprise-'+day;const l=firstLetters[hash(s.seed,day+11)%3];addLetter(s,id,...l,day);}
 return getEvent(s,day,hour);}
export function getEvent(s,day,hour=12){const age=day-s.firstDay;
 if(s.choice===null)return {id:'consult',type:'consult',tag:'ぽけからの相談',title:'世界一かわいいVTuberに\nなろうと思うんだけど。',desc:'ねえ、どうしたらいいと思う？ きみの意見、聞かせて。'};
 const welcome=s.letters.find(l=>l.id==='welcome');
 if(welcome?.reply&&day>=welcome.replyDay+2&&!s.resolved.includes('reply-event-welcome')){
  const sweet=/かわい|世界一|すき|好き|褒|天才|えらい/.test(welcome.reply),effort=/努力|がんば|頑張|応援/.test(welcome.reply);
  return {id:'reply-event-welcome',type:sweet?'anniversary':effort?'assign':'apology',tag:'あの手紙の続き',title:sweet?'あのお返事、記念日にします。':effort?'応援してくれたきみを、王城へ。':'あのお返事を読んで、会見です。',desc:(sweet?'あの褒め言葉がうれしかったので、きみとぽけの記念日を勝手に作りました。':effort?'応援してくれたきみを、王城のお茶会に招待します。':'手紙を読みながら、きみのぶんのプリンまで食べました。')+'\n相談のお礼の小さな鍵も、この事件のあとにお渡しします。'};
 }
 if(!welcome?.reply&&day>=s.answerDay+2&&!s.items.includes('ぽけ印の小さな鍵')){return {id:'key',type:'key',tag:'あの日の続き',title:s.choice===0?'100回ぶん、数えました。':s.choice===1?'特訓の成果、見てください。':'世界一からのおすそわけ。',desc:['かわいいを100回言ってくれたお礼に、この小さな鍵を贈るね。','かわいさの特訓をしていたら、鍵を見つけました。きみが持っていて。','きみがそう言ってくれたから、今日はごきげん。ひみつの鍵をあげるね。'][s.choice]};}
 if(s.days.length+(s.baseVisits||0)>=30&&!s.packageOpened)return {id:'package',type:'package',tag:'受取人は、あなた',title:'謎の荷物が届いています。',desc:'差出人は、もちろんぽけ。ずいぶん前から準備していたみたい。'};
 if(hour<5&&!s.resolved.includes('night-'+day)){return {id:'night-'+day,type:'night',tag:'深夜のぽけ',title:'……まだ、起きてたの？',desc:'ぽけも、ちょっとだけ。きみが来る気がしたから。\nねむくなるまで、いっしょにいよ。'};}
 const n=hash(s.seed,day);if(age===0||n%100<48)return {id:'quiet-'+day,type:'quiet',tag:'本日ものんびり',title:'きょうは、なんにもない日。',desc:'ぽけはプリンを食べています。\nきみも、ゆっくりしていってね。'};
 const type=['hijack','apology','anniversary','assign'][n%4];if(s.resolved.includes(type+'-'+day))return {id:'done-'+day,type:'quiet',tag:'今日の事件は解決',title:'ひとまず、ひとやすみ。',desc:'さっきの出来事は、アルバムにしまったよ。\n次はなにが起きるかな。'};
 const data={hijack:['ぽけ乗っ取り事件','このサイトは、ぽけのもの。','ボタンをぜんぶ、ぽけ好みにしておきました。\n褒めたら元に戻る……かもしれません。'],apology:['謎の謝罪会見','お詫びしなければなりません。','きみのプリンを、食べました。\n謝罪の角度を決めてください。'],anniversary:['勝手に記念日','今日は、きみのぽけ記念日！','理由？ きみが今日ここに来たから。\nろうそくの準備も、もうできています。'],assign:['王城からの招待','王城のお茶会へ、ようこそ。','きみのために、王城のお茶会の席を用意しました。\nぽけと一緒に、のんびり過ごしてね。']}[type];return {id:type+'-'+day,type,tag:data[0],title:data[1],desc:data[2]};}
export function choose(s,index,day){if(s.choice!==null)return false;s.choice=index;s.answerDay=day;addMemory(s,'choice','ぽけからの相談',['「毎日100回かわいいって言う」と約束した。','「もっと努力したほうがいい」と伝えた。','「もう世界一かわいいよ」と伝えた。'][index],'💭',day);return true;}
export function resolve(s,event,day,angle){if((event.type==='key'||event.id==='reply-event-welcome')&&!s.items.includes('ぽけ印の小さな鍵'))s.items.push('ぽけ印の小さな鍵');if(event.type==='package'){if(!s.items.includes('ぽけ印の小さな鍵'))return false;s.packageOpened=true;s.items.push('ふたりだけのひみつ証明書');addLetter(s,'package-letter','30日ぶんの、ありがとう。','この鍵、ずっと持っていてくれたんだね。\n箱の中身は「ふたりだけのひみつ証明書」です。\nきみが来てくれた日、ぜんぶうれしかったよ。\nこれからも、ぽけに巻き込まれてね。',day);}
 if(!s.resolved.includes(event.id))s.resolved.push(event.id);const body=event.type==='apology'?`ぽけは${angle}で謝罪しました。プリンは戻ってきませんでした。`:event.type==='package'?'あの日の鍵で、30日訪問の荷物を開けた。「ふたりだけのひみつ証明書」を受け取った。':event.desc.replaceAll('\n',' ');addMemory(s,event.id,event.title.replaceAll('\n',''),body,({key:'🗝️',package:'📦',hijack:'🍮',apology:'🙇',anniversary:'🎂',assign:'🎖️',night:'🌙'})[event.type]||'✨',day);return true;}
