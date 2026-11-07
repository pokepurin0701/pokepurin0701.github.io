// Identity is determined only by entry count. This module unlocks no facility.
export const ROYAL_GOAL = 50000;
export const royalRanks = [
 {at:0,id:'traveler',name:'お菓子の国の旅人',short:'旅人',crest:'🍪',color:'cream',effect:'crumbs',line:'ようこそ。きみのために、小さな身分証を用意したよ。'},
 {at:10,id:'citizen',name:'キャンディの国民',short:'国民',crest:'🍬',color:'sky',effect:'sparkles',line:'今日から、きみもこの国の仲間だよ。'},
 {at:30,id:'artisan',name:'クッキーの菓子職人',short:'菓子職人',crest:'🥨',color:'custard',effect:'seal',line:'きみの優しさで、この国のお菓子はもっと甘くなるね。'},
 {at:100,id:'knight',name:'ビスケットの騎士',short:'騎士',crest:'⚜',color:'sky',effect:'ribbon',line:'きみがいてくれると、ぽけは安心できるよ。'},
 {at:300,id:'baron',name:'マカロンの男爵',short:'男爵',crest:'✿',color:'rose',effect:'petals',line:'きみのための特別な席を、王城に用意したよ。'},
 {at:1000,id:'viscount',name:'ショコラの子爵',short:'子爵',crest:'🍫',color:'custard',effect:'seal',line:'千回の「ただいま」を、この国の宝物にしよう。'},
 {at:3000,id:'earl',name:'タルトの伯爵',short:'伯爵',crest:'✦',color:'sky',effect:'stars',line:'きみと過ごした時間が、国じゅうで輝いているよ。'},
 {at:5000,id:'marquis',name:'パフェの侯爵',short:'侯爵',crest:'♜',color:'rose',effect:'ribbon',line:'この国の景色が、きみと一緒に少しずつ育ってきたね。'},
 {at:10000,id:'duke',name:'プリンの公爵',short:'公爵',crest:'♛',color:'gold',effect:'crown',line:'一万回も会いに来てくれて、ありがとう。きみはこの国の誇りだよ。'},
 {at:20000,id:'royal',name:'クリームの王族',short:'王族',crest:'♔',color:'sky',effect:'aurora',line:'おかえり。王城にも、きみの居場所があるよ。'},
 {at:30000,id:'guardian',name:'お菓子の国の守護者',short:'守護者',crest:'✧',color:'gold',effect:'stars',line:'きみが大切にしてくれたこの国を、ぽけもずっと大切にするね。'},
 {at:50000,id:'legend',name:'お菓子の国の伝説',short:'伝説',crest:'👑',color:'legend',effect:'constellation',line:'五万回の出会いを、ありがとう。きみの名前は、この国の物語にずっと残るよ。'}
];
export function royalStatus(logins){
 const count=Number.isSafeInteger(logins)&&logins>=0?logins:0;
 const index=royalRanks.findLastIndex(rank=>count>=rank.at),current=royalRanks[index],next=royalRanks[index+1]||null;
 return {count,index,current,next,remaining:next?next.at-count:0,progress:next?(count-current.at)/(next.at-current.at):1,goal:ROYAL_GOAL,complete:!next};
}
export function promotionBetween(before,after){const a=royalStatus(before),b=royalStatus(after);return b.index>a.index?b.current:null;}
// Display adapters retain legacy stored titles, achievements, and event text intact.
export function kingdomText(value){return String(value).replaceAll('正社員','王城の仲間').replaceAll('社員','王城の仲間').replaceAll('会社','お菓子の国').replaceAll('アルバイト','クッキーの見習い').replaceAll('係長','ビスケットの騎士').replaceAll('サイト改善担当','王城の飾りつけ名人').replaceAll('終身名誉係','お菓子の国の親友').replaceAll('ぽけ運営室','王城の広間').replaceAll('ぽけ甘やかし係','ぽけの親友').replaceAll('仕事が早い人','お手伝い上手').replaceAll('本日の業務','本日の王城のお手伝い').replaceAll('業務完了','王城のお手伝い完了').replaceAll('業務連絡','王城からのお知らせ').replaceAll('業務','お手伝い').replaceAll('お給料','お礼').replaceAll('支給','贈呈').replaceAll('残業時間','おやつの待ち時間').replaceAll('本日の残業はありません','今日のお手伝いはここまでです').replaceAll('本日の残業：ありません','今日は自由時間です').replaceAll('残業はないので','お手伝いは終わったので').replaceAll('残業','追加のお手伝い').replaceAll('採用です','大歓迎です').replaceAll('採用します','賛成です').replaceAll('任命状','王城の招待状').replaceAll('任命','歓迎');}
