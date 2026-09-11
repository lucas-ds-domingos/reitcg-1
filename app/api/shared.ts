import {getSessionUser} from "@/lib/session";
import {getDatabase} from "@/db/neon-adapter";

export async function apiContext(){
  const user=await getSessionUser();
  if(!user) return null;
  return{user,db:getDatabase()};
}

export function json(data:unknown,status=200){
  return Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
}
