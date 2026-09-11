import {cookies} from "next/headers";
import {getSql} from "@/db/neon";

export const SESSION_COOKIE="reicard_session";
const THIRTY_DAYS=60*60*24*30;

function randomToken(){return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url")}
async function tokenHash(token:string){return Buffer.from(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token))).toString("hex")}

export type SessionUser={userId:string;email:string;fullName:string|null;displayName:string};

export async function createSession(userId:string){
  const token=randomToken(),hash=await tokenHash(token),id=crypto.randomUUID();
  const expiresAt=new Date(Date.now()+THIRTY_DAYS*1000);
  await getSql()`INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (${id},${userId},${hash},${expiresAt.toISOString()},NOW())`;
  return{token,maxAge:THIRTY_DAYS};
}

export async function getSessionUser():Promise<SessionUser|null>{
  const token=(await cookies()).get(SESSION_COOKIE)?.value;
  if(!token)return null;
  const hash=await tokenHash(token);
  const rows=await getSql()`SELECT p.id AS "userId",p.email,p.display_name AS "fullName",p.display_name AS "displayName" FROM sessions s JOIN profiles p ON p.id=s.user_id WHERE s.token_hash=${hash} AND s.expires_at>NOW() LIMIT 1` as SessionUser[];
  return rows[0]??null;
}

export async function revokeSession(){
  const store=await cookies(),token=store.get(SESSION_COOKIE)?.value;
  if(token){const hash=await tokenHash(token);await getSql()`DELETE FROM sessions WHERE token_hash=${hash}`}
}

export function sessionCookie(token:string,maxAge:number){
  const secure=process.env.NODE_ENV==="production"?"; Secure":"";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function expiredSessionCookie(){
  const secure=process.env.NODE_ENV==="production"?"; Secure":"";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
