import {getSql} from "@/db/neon";
import {hashPassword,validPassword} from "@/lib/password";
import {createSession,sessionCookie} from "@/lib/session";

type Registration={email?:string;password?:string;displayName?:string;username?:string;ageGroup?:string;guardianConsent?:boolean;guardianName?:string;guardianEmail?:string;termsAccepted?:boolean;privacyAccepted?:boolean};

export async function POST(request:Request){
  const body=await request.json().catch(()=>null) as Registration|null;
  console.log("[REGISTER] Body received:",body);
  
  const email=(body?.email||"").trim().toLowerCase().slice(0,160);
  const password=body?.password||"";
  const displayName=(body?.displayName||"").trim().slice(0,40);
  const username=(body?.username||"").trim().toLowerCase().replace(/[^a-z0-9_]/g,"").slice(0,20);
  const ageGroup=body?.ageGroup||"";
  const guardianName=(body?.guardianName||"").trim().slice(0,80);
  const guardianEmail=(body?.guardianEmail||"").trim().toLowerCase().slice(0,160);
  
  console.log("[REGISTER] Parsed - email:",email,"displayName:",displayName,"username:",username,"ageGroup:",ageGroup);
  
  // Validate all required fields
  if(!email||!/^\S+@\S+\.\S+$/.test(email))return Response.json({error:"invalid_email"},{status:400});
  if(!password||!validPassword(password))return Response.json({error:"invalid_password"},{status:400});
  if(displayName.length<2)return Response.json({error:"invalid_display_name"},{status:400});
  if(username.length<3)return Response.json({error:"invalid_username"},{status:400});
  if(!["child","teen","adult"].includes(ageGroup)){
    console.error("[REGISTER] Invalid ageGroup:",ageGroup);
    return Response.json({error:"invalid_age_group"},{status:400});
  }
  if(body?.termsAccepted!==true||body.privacyAccepted!==true)return Response.json({error:"legal_acceptance_required"},{status:400});
  
  // Validate guardian data for minors
  if(ageGroup!=="adult"){
    if(body.guardianConsent!==true)return Response.json({error:"guardian_consent_required"},{status:400});
    if(guardianName.length<3)return Response.json({error:"invalid_guardian_name"},{status:400});
    if(!guardianEmail||!/^\S+@\S+\.\S+$/.test(guardianEmail))return Response.json({error:"invalid_guardian_email"},{status:400});
  }
  
  const sql=getSql(),id=crypto.randomUUID(),now=new Date().toISOString(),passwordHash=await hashPassword(password);
  try{
    console.log("[REGISTER] Creating user with ageGroup:",ageGroup);
    // Insert profile with explicit ageGroup value
    await sql`INSERT INTO profiles (id,username,display_name,email,age_group,guardian_consent,guardian_name,guardian_email,terms_accepted,privacy_accepted,terms_version,consent_accepted_at,created_at,updated_at) VALUES (${id},${username},${displayName},${email},${ageGroup},${ageGroup==="adult"?false:true},${ageGroup==="adult"?null:guardianName},${ageGroup==="adult"?null:guardianEmail},true,true,'2026-09-11',${now},${now},${now})`;
    
    // Verify what was saved
    const saved=await sql`SELECT id,age_group FROM profiles WHERE id=${id}`;
    console.log("[REGISTER] Saved profile:",saved);
    
    // Insert auth credentials
    await sql`INSERT INTO auth_credentials (user_id,password_hash,created_at,updated_at) VALUES (${id},${passwordHash},${now},${now})`;
    
    const session=await createSession(id);
    const profile={id,username,displayName,email,ageGroup:ageGroup as "child"|"teen"|"adult",guardianConsent:ageGroup!=="adult",guardianName:ageGroup==="adult"?null:guardianName,guardianEmail:ageGroup==="adult"?null:guardianEmail,termsAccepted:true,privacyAccepted:true,termsVersion:"2026-09-11",consentAcceptedAt:now};
    console.log("[REGISTER] Returning profile:",profile);
    return Response.json({ok:true,profile},{status:201,headers:{"Set-Cookie":sessionCookie(session.token,session.maxAge),"Cache-Control":"no-store"}});
  }catch(error){
    console.error("Registration error:",error);
    return Response.json({error:"email_or_username_unavailable"},{status:409})
  }
}
