import {apiContext,json} from "../shared";

export const dynamic="force-dynamic";

export async function GET(){
  const ctx=await apiContext();
  if(!ctx) return json({error:"login_required"},401);
  const result=await ctx.db.prepare("SELECT ci.card_id AS cardId,ci.set_id AS setId,ci.card_name AS cardName,ci.card_image AS cardImage,ci.quantity-1 AS available,p.id AS userId,p.username,p.display_name AS displayName FROM collection_items ci JOIN profiles p ON p.id=ci.user_id WHERE ci.quantity>1 AND ci.user_id IN (SELECT CASE WHEN user_a=? THEN user_b ELSE user_a END FROM friendships WHERE (user_a=? OR user_b=?) AND status='accepted') ORDER BY p.username,ci.card_name LIMIT 300").bind(ctx.user.userId,ctx.user.userId,ctx.user.userId).all();
  return json({items:result.results});
}
