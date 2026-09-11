const BASE="https://api.tcgdex.net/v2";
export const CATALOG_LANGUAGES=["en","pt-br","fr","es","de","it","ja"] as const;

export async function tcgdex(
  path:string,
  languages:readonly string[]=CATALOG_LANGUAGES,
  accept:(data:unknown)=>boolean=()=>true,
){
  let lastError="Catálogo indisponível";
  for(const language of languages){
    for(let attempt=0;attempt<2;attempt++){
      try{
        const response=await fetch(`${BASE}/${language}${path}`,{
          headers:{Accept:"application/json"},
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
