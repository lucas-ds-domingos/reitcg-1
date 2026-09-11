import {apiContext,json} from "../shared";

export const dynamic="force-dynamic";

export async function GET(){
  const ctx=await apiContext();
  if(!ctx) return json({error:"login_required"},401);
  const profile=await ctx.db.prepare("SELECT id,username,display_name AS displayName,email,age_group AS ageGroup,guardian_consent AS guardianConsent,guardian_name AS guardianName,guardian_email AS guardianEmail,terms_accepted AS termsAccepted,privacy_accepted AS privacyAccepted,terms_version AS termsVersion,consent_accepted_at AS consentAcceptedAt FROM profiles WHERE id=?").bind(ctx.user.userId).first();
  if(!profile) return json({error:"profile_not_found"},404);
  return json({profile});
}

export async function POST(request:Request){
  const ctx=await apiContext();
  if(!ctx) return json({error:"login_required"},401);
  const body=await request.json().catch(()=>null) as {username?:string;displayName?:string;ageGroup?:string;guardianConsent?:boolean;guardianName?:string;guardianEmail?:string;termsAccepted?:boolean;privacyAccepted?:boolean}|null;
  const username=(body?.username||"").trim().toLowerCase().replace(/[^a-z0-9_]/g,"");
  const displayName=(body?.displayName||"").trim().slice(0,40);
  const ageGroup=body?.ageGroup;
  const guardianConsent=body?.guardianConsent===true;
  const guardianName=(body?.guardianName||"").trim().slice(0,80);
  const guardianEmail=(body?.guardianEmail||"").trim().toLowerCase().slice(0,120);
  const termsAccepted=body?.termsAccepted===true;
  const privacyAccepted=body?.privacyAccepted===true;
  if(username.length<3||username.length>20||displayName.length<2||!["child","teen","adult"].includes(ageGroup||"")) return json({error:"invalid_profile"},400);
  if(ageGroup!=="adult"&&(!guardianConsent||guardianName.length<3||!/^\S+@\S+\.\S+$/.test(guardianEmail))) return json({error:"guardian_required"},400);
  if(!termsAccepted||!privacyAccepted) return json({error:"legal_acceptance_required"},400);
  try{
    const now=new Date().toISOString();
    await ctx.db.prepare("UPDATE profiles SET username=?,display_name=?,age_group=?,guardian_consent=?,guardian_name=?,guardian_email=?,terms_accepted=true,privacy_accepted=true,terms_version=?,consent_accepted_at=?,updated_at=? WHERE id=?").bind(username,displayName,ageGroup,guardianConsent,ageGroup==="adult"?null:guardianName,ageGroup==="adult"?null:guardianEmail,"2026-09-11",now,now,ctx.user.userId).run();
  }catch{return json({error:"username_unavailable"},409)}
  return GET();
}

export async function DELETE(){
  const ctx=await apiContext();
  if(!ctx) return json({error:"login_required"},401);
  await ctx.db.batch([
    ctx.db.prepare("DELETE FROM collection_items WHERE user_id=?").bind(ctx.user.userId),
    ctx.db.prepare("DELETE FROM collection_shares WHERE sender_id=? OR recipient_id=?").bind(ctx.user.userId,ctx.user.userId),
    ctx.db.prepare("DELETE FROM friendships WHERE user_a=? OR user_b=?").bind(ctx.user.userId,ctx.user.userId),
    ctx.db.prepare("DELETE FROM profiles WHERE id=?").bind(ctx.user.userId),
  ]);
  return json({deleted:true});
}
