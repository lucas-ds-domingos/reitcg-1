const BASE="https://api.tcgdex.net/v2";
const REQUEST_TIMEOUT_MS=6_000;
const CATALOG_TIMEOUT_MS=15_000;
export const CATALOG_LANGUAGES=["en","pt-br","fr","es","de","it","ja"] as const;

export async function tcgdex(
  path:string,
  languages:readonly string[]=CATALOG_LANGUAGES,
  accept:(data:unknown)=>boolean=()=>true,
){
  let lastError="Catálogo indisponível";
  const deadline=Date.now()+CATALOG_TIMEOUT_MS;
  for(const language of languages){
    for(let attempt=0;attempt<2;attempt++){
      try{
        const remaining=deadline-Date.now();
        if(remaining<=0)throw new Error("Catalog request timed out");
        const response=await fetch(`${BASE}/${language}${path}`,{
          headers:{Accept:"application/json"},
          signal:AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS,remaining)),
          next:{revalidate:3600},
        });
        if(response.ok){
          const data=await response.json();
          if(accept(data))return{data,language};
          lastError=`Dados incompletos em ${language}`;
          break;
        }
        lastError=`TCGdex respondeu ${response.status}`;
        if(response.status===404)break;
      }catch(error){
        lastError=error instanceof Error?error.message:lastError;
        if(Date.now()>=deadline)throw new Error("Catalog request timed out");
      }
    }
  }
  throw new Error(lastError);
}

export function catalogJson(data:unknown,status=200){
  return Response.json(data,{status,headers:{
    "Cache-Control":"public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  }});
}
