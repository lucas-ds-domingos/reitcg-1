import {apiContext,json} from "../shared";

export const dynamic="force-dynamic";

type SharedCard={cardId:string;name:string;number:string;image?:string;quantity:number;kind:"repeated"|"missing"};

export async function GET(request:Request){
  const ctx=await apiContext();
  if(!ctx)return json({error:"login_required"},401);
  const scope=new URL(request.url).searchParams.get("scope")==="sent"?"sent":"inbox";
  const friends=await ctx.db.prepare(`SELECT p.id,p.username,p.display_name AS "displayName" FROM friendships f JOIN profiles p ON p.id=CASE WHEN f.user_a=? THEN f.user_b ELSE f.user_a END WHERE (f.user_a=? OR f.user_b=?) AND f.status='accepted' ORDER BY p.display_name`).bind(ctx.user.userId,ctx.user.userId,ctx.user.userId).all();
  const list=scope==="sent"
    ?await ctx.db.prepare(`SELECT s.id,s.set_id AS "setId",s.set_name AS "setName",s.share_type AS "shareType",s.payload,s.status,s.note,s.resolved_at AS "resolvedAt",s.created_at AS "createdAt",p.id AS "recipientId",p.username,p.display_name AS "displayName" FROM collection_shares s JOIN profiles p ON p.id=s.recipient_id WHERE s.sender_id=? ORDER BY s.created_at DESC LIMIT 50`).bind(ctx.user.userId).all()
    :await ctx.db.prepare(`SELECT s.id,s.set_id AS "setId",s.set_name AS "setName",s.share_type AS "shareType",s.payload,s.status,s.note,s.resolved_at AS "resolvedAt",s.created_at AS "createdAt",p.id AS "senderId",p.username,p.display_name AS "displayName" FROM collection_shares s JOIN profiles p ON p.id=s.sender_id WHERE s.recipient_id=? AND s.status='pending' ORDER BY s.created_at DESC LIMIT 50`).bind(ctx.user.userId).all();
  const shares=list.results.map(row=>{
    const item=row as Record<string,unknown>;
    let cards:SharedCard[]=[];
    try{cards=JSON.parse(String(item.payload||"[]")) as SharedCard[]}catch{}
    const {payload:_,...safe}=item;
    return{...safe,cards};
  });
  return json({friends:friends.results,shares});
}

export async function POST(request:Request){
  const ctx=await apiContext();
  if(!ctx)return json({error:"login_required"},401);
  const body=await request.json().catch(()=>null) as {recipientId?:string;setId?:string;setName?:string;shareType?:string;cards?:SharedCard[]}|null;
  if(!body?.recipientId||!body.setId||!body.setName||!(["repeated","missing","both"].includes(body.shareType||""))||!Array.isArray(body.cards))return json({error:"invalid_share"},400);
  const [userA,userB]=[ctx.user.userId,body.recipientId].sort();
  const friendship=await ctx.db.prepare("SELECT status FROM friendships WHERE user_a=? AND user_b=? AND status='accepted'").bind(userA,userB).first<{status:string}>();
  if(!friendship)return json({error:"friend_required"},403);
  const cards=body.cards.slice(0,400).flatMap(card=>{
    if(!card||typeof card.cardId!=="string"||typeof card.name!=="string"||typeof card.number!=="string"||!(card.kind==="repeated"||card.kind==="missing"))return [];
    return[{cardId:card.cardId.slice(0,80),name:card.name.slice(0,120),number:card.number.slice(0,30),image:typeof card.image==="string"?card.image.slice(0,500):undefined,quantity:Math.max(0,Math.min(99,Math.floor(Number(card.quantity)||0))),kind:card.kind} satisfies SharedCard];
  });
  if(!cards.length)return json({error:"empty_share"},400);
  const id=crypto.randomUUID();
  await ctx.db.prepare("INSERT INTO collection_shares (id,sender_id,recipient_id,set_id,set_name,share_type,payload,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(id,ctx.user.userId,body.recipientId,body.setId.slice(0,80),body.setName.slice(0,160),body.shareType,JSON.stringify(cards),new Date().toISOString()).run();
  return json({ok:true,id});
}
