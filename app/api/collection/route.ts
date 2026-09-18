import {apiContext,json} from "../shared";

export const dynamic="force-dynamic";

export async function GET(){
  const ctx=await apiContext();
  if(!ctx) return json({error:"login_required"},401);
  const result=await ctx.db.prepare(`SELECT card_id AS "cardId",set_id AS "setId",card_name AS "cardName",card_image AS "cardImage",quantity FROM collection_items WHERE user_id=? AND quantity>0`).bind(ctx.user.userId).all();
  return json({items:result.results});
}

export async function POST(request:Request){
  const ctx=await apiContext();
  if(!ctx) return json({error:"login_required"},401);
  const body=await request.json().catch(()=>null) as {cardId?:string;setId?:string;cardName?:string;cardImage?:string;quantity?:number}|null;
  const quantity=Math.max(0,Math.min(99,Math.floor(Number(body?.quantity))));
  if(!body?.cardId||!body.setId||!body.cardName||!Number.isFinite(quantity)) return json({error:"invalid_item"},400);
  if(quantity===0){
    await ctx.db.prepare("DELETE FROM collection_items WHERE user_id=? AND card_id=?").bind(ctx.user.userId,body.cardId).run();
  }else{
    await ctx.db.prepare("INSERT INTO collection_items (user_id,card_id,set_id,card_name,card_image,quantity,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,card_id) DO UPDATE SET set_id=excluded.set_id,card_name=excluded.card_name,card_image=excluded.card_image,quantity=excluded.quantity,updated_at=excluded.updated_at").bind(ctx.user.userId,body.cardId,body.setId,body.cardName,body.cardImage||null,quantity,new Date().toISOString()).run();
  }
  return json({ok:true,cardId:body.cardId,quantity});
}
