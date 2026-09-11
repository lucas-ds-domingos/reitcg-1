import {catalogJson,tcgdex} from "../shared";
import {DIGITAL_SET_IDS} from "../tcgcsv";

const NON_ALBUM_RECORDS=new Set([
  "Miscellaneous Promos",
  "Mega Evolution Energy",
  "W Promotional",
  "Sample",
]);

export async function GET(){
  try{
    const result=await tcgdex("/sets",["en"]);
    const sets=Array.isArray(result.data)?result.data
      .filter(set=>{
        const item=set as {id?:string;name?:string};
        return !NON_ALBUM_RECORDS.has(item.name??"")&&!DIGITAL_SET_IDS.has(item.id??"");
      })
      .map(set=>({...(set as object),digital:DIGITAL_SET_IDS.has((set as {id?:string}).id??"")})):[];
    return catalogJson(sets);
  }catch(error){
    return catalogJson({error:"catalog_unavailable",detail:error instanceof Error?error.message:""},503);
  }
}
