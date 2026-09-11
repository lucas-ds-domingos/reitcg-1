import {getSql} from "@/db/neon";
import {verifyPassword} from "@/lib/password";
import {createSession,sessionCookie} from "@/lib/session";

type Login={email?:string;password?:string};

export async function POST(request:Request){
  const body=await request.json().catch(()=>null) as Login|null;
  const email=(body?.email||"").trim().toLowerCase().slice(0,160),password=body?.password||"";
  if(!email||!password)return Response.json({error:"invalid_login"},{status:400});
  const rows=await getSql()`SELECT p.id,c.password_hash AS "passwordHash" FROM profiles p JOIN auth_credentials c ON c.user_id=p.id WHERE p.email=${email} LIMIT 1` as {id:string;passwordHash:string}[];
  const account=rows[0];
  if(!account||!(await verifyPassword(password,account.passwordHash)))return Response.json({error:"invalid_credentials"},{status:401});
  const session=await createSession(account.id);
  return Response.json({ok:true},{headers:{"Set-Cookie":sessionCookie(session.token,session.maxAge),"Cache-Control":"no-store"}});
}
