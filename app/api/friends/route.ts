import {apiContext,json} from "../shared";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  const ctx=await apiContext();
  if(!ctx) return json({error:"login_required"},401);
  const url=new URL(request.url);
  const q=(url.searchParams.get("q")||"").trim().slice(0,30);
  const relations=await ctx.db.prepare("SELECT f.user_a AS userA,f.user_b AS userB,f.requester_id AS requesterId,f.status,p.id,p.username,p.display_name AS displayName FROM friendships f JOIN profiles p ON p.id=CASE WHEN f.user_a=? THEN f.user_b ELSE f.user_a END WHERE f.user_a=? OR f.user_b=? ORDER BY f.updated_at DESC").bind(ctx.user.userId,ctx.user.userId,ctx.user.userId).all();
  let people:unknown[]=[];
  if(q.length>=2){
    const found=await ctx.db.prepare("SELECT id,username,display_name AS displayName FROM profiles WHERE id<>? AND (username LIKE ? OR display_name LIKE ?) ORDER BY username LIMIT 20").bind(ctx.user.userId,`%${q}%`,`%${q}%`).all();
    people=found.results;
  }
  return json({me:ctx.user.userId,relations:relations.results,people});
}

export async function POST(request:Request){
  const ctx=await apiContext();
  if(!ctx) return json({error:"login_required"},401);
  const body=await request.json().catch(()=>null) as {action?:string;userId?:string}|null;
  const peer=body?.userId;
  if(!peer||peer===ctx.user.userId) return json({error:"invalid_friend"},400);
  const [userA,userB]=[ctx.user.userId,peer].sort();
  const now=new Date().toISOString();
  if(body.action==="request"){
    const exists=await ctx.db.prepare("SELECT status FROM friendships WHERE user_a=? AND user_b=?").bind(userA,userB).first<{status:string}>();
    if(exists) return json({error:"request_exists"},409);
    await ctx.db.prepare("INSERT INTO friendships (user_a,user_b,requester_id,status,created_at,updated_at) VALUES (?,?,?,'pending',?,?)").bind(userA,userB,ctx.user.userId,now,now).run();
  }else if(body.action==="accept"){
    await ctx.db.prepare("UPDATE friendships SET status='accepted',updated_at=? WHERE user_a=? AND user_b=? AND requester_id<>? AND status='pending'").bind(now,userA,userB,ctx.user.userId).run();
  }else if(body.action==="remove"||body.action==="reject"){
    await ctx.db.prepare("DELETE FROM friendships WHERE user_a=? AND user_b=?").bind(userA,userB).run();
  }else return json({error:"invalid_action"},400);
  return json({ok:true});
}
