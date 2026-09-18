import {apiContext,json} from "../../shared";

export const dynamic="force-dynamic";

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const ctx=await apiContext();
  if(!ctx)return json({error:"login_required"},401);
  const {id}=await params;
  const body=await request.json().catch(()=>null) as {action?:string;note?:string}|null;
  if(!body?.action||!["complete","cancel"].includes(body.action))return json({error:"invalid_action"},400);
  const note=typeof body.note==="string"?body.note.trim().slice(0,300)||null:null;
  const share=await ctx.db.prepare(`SELECT sender_id AS "senderId",recipient_id AS "recipientId",status FROM collection_shares WHERE id=?`).bind(id).first<{senderId:string;recipientId:string;status:string}>();
  if(!share)return json({error:"not_found"},404);
  const isRecipient=share.recipientId===ctx.user.userId,isSender=share.senderId===ctx.user.userId;
  if(!isRecipient&&!isSender)return json({error:"forbidden"},403);
  if(share.status!=="pending")return json({error:"already_resolved"},409);
  if(body.action==="complete"&&!isRecipient)return json({error:"forbidden"},403);
  const status=body.action==="complete"?"completed":"cancelled";
  const result=await ctx.db.prepare("UPDATE collection_shares SET status=?,note=?,resolved_at=? WHERE id=? AND status='pending' RETURNING id").bind(status,note,new Date().toISOString(),id).run();
  if(!Array.isArray(result.results)||result.results.length===0)return json({error:"already_resolved"},409);
  return json({ok:true,status,note});
}
