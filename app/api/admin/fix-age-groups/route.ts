import {getSql} from "@/db/neon";
import {json} from "../../shared";

/**
 * ADMIN ENDPOINT: Fix profiles with missing or invalid ageGroup
 * Sets all profiles with NULL or invalid age_group to 'adult' as default
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
    
    // Get profiles with invalid ageGroup
    const invalid=(await sql`SELECT id,age_group FROM profiles WHERE age_group IS NULL OR age_group NOT IN ('child','teen','adult')`);
    
    // Update all profiles with invalid age_group to 'adult'
    await sql`UPDATE profiles SET age_group='adult' WHERE age_group IS NULL OR age_group NOT IN ('child','teen','adult')`;
    
    return json({
      success:true,
      message:"Fixed profiles with missing or invalid age_group",
      fixed:invalid.length,
      details:`Set ${invalid.length} profile(s) to age_group='adult'`
    },200);
  }catch(error){
    console.error("Fix error:",error);
    return json({error:"fix_failed",details:String(error)},500);
  }
}
