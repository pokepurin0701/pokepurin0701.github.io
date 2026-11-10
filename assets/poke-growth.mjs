// Facilities and stories use cumulative distinct visiting days only. Identity uses poke-royal.mjs.
export const stages = [
  {at:1,name:'小さな遊び場',icon:'🌱',hint:'ぽけとあなたの、最初のひと粒。'},
  {at:10,name:'ぽけのポスト',icon:'✉',hint:'手紙、相談、アルバム。ぽけから話しかけてくるように。'},
  {at:30,name:'王城の広間',icon:'🗝️',hint:'荷物の手がかりと、王城のお手伝い。荷物は訪問30日で届きます。'},
  {at:50,name:'みんなの広場',icon:'☾',hint:'みんなの応援企画と、夜食の部屋がオープン。'},
  {at:75,name:'ぽけの改装日',icon:'✦',hint:'看板とお部屋に、ぽけの手が入ったみたい。'},
  {at:100,name:'秘密の休憩室',icon:'☕',hint:'表彰式のあとは、きみ専用の居場所でひと休み。'},
  {at:150,name:'おへやの模様替え',icon:'🎨',hint:'カスタード、カラメル、ミルク。きみの色で飾ろう。'},
  {at:200,name:'ぽけの実家',icon:'⌂',hint:'ただいま、が似合う場所。お茶会の席を用意しました。'},
  {at:250,name:'プリン研究所',icon:'🍮',hint:'好きなプリンを研究して、日ごとにノートを集めよう。'},
  {at:300,name:'お菓子の国の記念日',icon:'♔',hint:'長く通ってくれたきみに、訪問記念のお菓子を。'}
];
export const thresholds = {today:0,letters:10,album:10,collection:10,office:30,shared:50,night:50,decorate:150,tea:200,research:250};
export const canUse = (feature,visits) => Object.hasOwn(thresholds,feature)&&visits>=thresholds[feature];
export const stageAt = visits => [...stages].reverse().find(s=>visits>=s.at)||stages[0];
export const nextStage = visits => stages.find(s=>s.at>visits)||{at:Math.floor(visits/50)*50+50,name:'ぽけからの感謝状',icon:'♡',hint:'これからも、50訪問日ごとにありがとう。'};
export const dailyLines=['今日は入口に、プリンをひとつ。','ぽけが椅子を、少しだけこちらに寄せました。','窓辺に小さな花が増えています。','きみの席に、クッションを置きました。','プリンのスプーンが、もう一本。','ぽけが「おかえり」の練習をしています。','おやつの時間に、きみのぶんも数えました。','小さな棚が増えました。中身はまだ、ひみつ。','ぽけがポストを、そわそわ見ています。','またひと粒、ふたりの居場所が育ちました。'];
