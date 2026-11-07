import {royalStatus} from './poke-royal.mjs?v=royal-1';
import {stages} from './poke-growth.mjs?v=royal-1';
export const milestones=stages.map(s=>[s.at,s.at+'訪問日目：'+s.name+'が開きました']);
export const news=['ぽけ、靴下を左右逆に履いていました','本日のやる気が3％上昇しました','続報：やっぱり眠いようです','プリンの所有権について緊急会議','会議の結果、おやつ休憩になりました','ぽけの椅子が少し偉そうになりました','褒め言葉の在庫が足りません','ぽけ、検索窓に自分の名前を入力','天才ということで全会一致しました','おやつ置き場の警備を強化しました','全自動褒め装置が休暇を申請しました','ぽけの言い間違いが文化財候補に','本日の重要事項：水分をとりましょう','プリンのスプーンが見つかりました','昨日の速報に特に続きはありません','ぽけ、何をしようとしたか忘れました','サイトのボタンが仕事を増やしました','今日は自由時間です','クッションが一個増えた気がします','自己肯定感のメーターが振り切れました','ぽけ、早起きを検討しています','検討の結果、二度寝しました','お茶をいれる係を募集中です','ぽけの発言に脚注が必要です','明日の予定：だいたい明日考えます','ぽけ、褒め言葉を額縁に入れました','本日の不具合：お腹がすく','プリン研究に進展。おいしいです','速報担当が速報に飽きました','速報担当が戻ってきました'];
export const sayings=['頑張りすぎはよくない。だが推し活は別腹。','休憩も立派な予定です。','今日ここに来ただけで、すでにえらい。','プリンは逃げません。ぽけが先に食べるだけです。','明日の天才のために、今日は寝ましょう。','できたことを一個数えて、あとはお茶にしましょう。','褒め言葉の返品は受け付けていません。'];
export const rules=['第1条：休憩を大切にすること。','第8条：ぽけを適度に褒めること。','第23条：ぽけの言い間違いは芸術として扱うこと。','第42条：プリンの所在をむやみに詮索しないこと。','第99条：細かいことは明日のぽけが考えること。'];
export const goals=[[1000,'椅子にクッション'],[5000,'おやつ置き場'],[10000,'全自動褒め装置'],[30000,'褒め装置のお休み部屋'],[50000,'ぽけ甘やかし省'],[100000,'みんなの記念式典']];
export function dayKey(now=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function dayNumber(now=new Date()){return Math.floor(Date.parse(dayKey(now)+'T00:00:00+09:00')/86400000);}
export function initial(){return {v:1,visits:0,logins:0,loginSessions:[],lastVisit:'',praises:0,dailyPraises:0,praiseDay:'',coins:0,jobs:0,jobDay:'',items:[],achievements:[],events:[],title:'ぽけの観察者',mood:'甘やかす',settings:[],logo:0};}
export function rank(n){return royalStatus(n).current.name;}
export function event(s,key,text,date){if(!s.events.some(e=>e.key===key)){s.events.push({key,text,date});s.events=s.events.slice(-500);}}
export function award(s,id,date){if(!s.achievements.includes(id)){s.achievements.push(id);event(s,'award:'+id,'実績獲得：'+id,date);}}
export function applyAction(previous,action,now=new Date()){
 const s={...initial(),...structuredClone(previous),logins:previous.logins??previous.visits??0},today=dayKey(now),n=dayNumber(now);
 if(action.type==='visit'){
  if(s.lastVisit!==today){s.visits++;s.lastVisit=today;s.coins+=10;event(s,'visit:'+today,'訪問 '+s.visits+'日目。おかえりなさい！',today);if(n%3===0)event(s,'incident:'+today,news[n%news.length],today);}
  const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',hour:'numeric',hourCycle:'h23'}).format(now));if(hour<4)award(s,'夜の訪問者',today);
 }

 if(action.type==='login'&&/^[a-f0-9]{32}$/.test(action.session||'')&&!s.loginSessions.includes(action.session)){s.logins++;s.loginSessions.push(action.session);s.loginSessions=s.loginSessions.slice(-100);event(s,'login:'+action.session,'入場 '+s.logins+'回目。今日も、ぽけの遊び場へ。',today);}
 for(const [at,msg] of milestones)if(s.visits>=at){event(s,'facility-day:'+at,msg,today);if(at===30&&!s.items.includes('ぽけ褒めマニュアル')){s.items.push('ぽけ褒めマニュアル');}if([30,100,150,200,300].includes(at)&&!s.items.includes(at+'日記念の表彰状'))s.items.push(at+'日記念の表彰状');}
 if(s.visits>300&&s.visits%50===0){const item=s.visits+'訪問日目の謎の感謝状';if(!s.items.includes(item))s.items.push(item);event(s,'facility-day:'+s.visits,item,today);}
 if(action.type==='praise'){s.praises++;if(s.praiseDay!==today){s.praiseDay=today;s.dailyPraises=0;}if(s.dailyPraises<10){s.dailyPraises++;s.coins++;}if(s.praises>=10)award(s,'褒め方に将来性を感じる人',today);if(s.praises>=50)award(s,'自己肯定感の供給源',today);}
 if(action.type==='job'&&s.visits>=30&&s.jobDay!==today&&['声','発想','全部','仕様です','天才です'].includes(action.choice)){s.jobDay=today;s.jobs++;s.coins+=30;event(s,'job:'+today,'王城のお手伝い完了：'+action.choice+'。お礼に30コイン。',today);award(s,'仕事が早い人',today);}
 if(action.type==='mood'&&s.visits>=30&&['甘やかす','もっと甘やかす','めちゃくちゃ甘やかす'].includes(action.value)){s.mood=action.value;if(!s.settings.includes(action.value))s.settings.push(action.value);if(s.settings.length===3)award(s,'設定ではどうにもならないこともある',today);}
 if(action.type==='rules')award(s,'規約を本当に全部読んだ人',today);
 if(action.type==='logo'){s.logo++;if(s.logo>=5)award(s,'インターホンではありません',today);}
 if(action.type==='night'&&s.visits>=50&&(s.achievements.includes('夜の訪問者')||n%7===0)&&['プリン','お茶','もう寝る'].includes(action.choice)){award(s,'夜食の部屋の常連',today);if(!s.items.includes('夢の売店のプリン'))s.items.push('夢の売店のプリン');if(action.choice==='もう寝る')award(s,'撤退の判断ができる人',today);}
 if(action.type==='decorate'&&s.visits>=150&&['カスタード','カラメル','ミルク'].includes(action.value)){s.settings=s.settings.filter(x=>!x.startsWith('お部屋の色：'));s.settings.push('お部屋の色：'+action.value);event(s,'decorate:'+today+':'+action.value,'お部屋を'+action.value+'色に模様替えしました。',today);}
 if(action.type==='tea'&&s.visits>=200&&['ほうじ茶','ミルク','お水'].includes(action.value)&&!s.events.some(e=>e.key==='tea:'+today)){event(s,'tea:'+today,'ぽけと'+action.value+'でひと休み。今日の実家のお茶会。',today);s.coins+=5;}
 if(action.type==='research'&&s.visits>=250&&['かため','とろとろ','ほろにが'].includes(action.value)&&!s.events.some(e=>e.key==='research:'+today)){const item='プリン研究ノート：'+action.value;if(!s.items.includes(item))s.items.push(item);event(s,'research:'+today,'本日の研究：'+action.value+'プリン。結論、おいしい。',today);award(s,'プリン研究所の常連',today);}
 if(action.type==='title'&&[rank(s.logins),'ぽけの観察者',s.title,...s.achievements].includes(action.value))s.title=action.value;
 if(action.type==='command'&&action.value==='pudding')award(s,'秘密の合言葉を知る人',today);
 return s;
}
