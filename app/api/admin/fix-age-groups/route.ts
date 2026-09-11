import {getSql} from "@/db/neon";
import {json} from "../../shared";

/**
 * ADMIN ENDPOINT: Fix profiles with missing ageGroup
 * Sets all profiles with NULL age_group to 'adult' as default
 * Call this once to migrate existing users
 */
export async function POST(request:Request){
  // Simple security check - in production, use proper auth
  const authHeader=request.headers.get("authorization")||"";
  const token=process.env.ADMIN_FIX_TOKEN||"reicard-fix-2026";
  
  if(authHeader!==`Bearer ${token}`){
    return json({error:"unauthorized"},401);
  }
  
  try{
    const sql=getSql();
    
    // Update all profiles with NULL age_group to 'adult'
    await sql`UPDATE profiles SET age_group='adult' WHERE age_group IS NULL`;
    
    return json({
      success:true,
      message:"Fixed profiles with missing age_group - all NULL age_group values set to 'adult'"
    },200);
  }catch(error){
    console.error("Fix error:",error);
    return json({error:"fix_failed"},500);
  }
}
