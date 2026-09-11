import {expiredSessionCookie,revokeSession} from "@/lib/session";

export async function POST(){
  await revokeSession();
  return Response.json({ok:true},{headers:{"Set-Cookie":expiredSessionCookie(),"Cache-Control":"no-store"}});
}
