import {CATALOG_LANGUAGES,catalogJson,tcgdex} from "../shared";
import {collectorNumber,DIGITAL_SET_IDS,matchProduct,productImage,productNumber,tcgCsvGroup,tcgCsvSet} from "../tcgcsv";

type CatalogCard={id:string;localId:string;name:string;image?:string};
type CatalogSet={
  id?:string;
  name?:string;
  tcgOnline?:string;
  cards?:CatalogCard[];
  cardCount?:{official?:number;total?:number};
  [key:string]:unknown;
};

const REBUILD_FROM_TCGCSV=new Set(["jumbo","rc","mfb"]);

const EMERGENCY_SET_FALLBACKS:Record<string,{name:string;official:number;total:number;numberPattern:RegExp}>={
  ex10:{name:"Unseen Forces",official:115,total:117,numberPattern:/^\d+\/115$/},
  exu:{name:"Unseen Forces Unown Collection",official:28,total:28,numberPattern:/^[!?A-Z]\/28$/i},
};

type PokemonSetCard={
  name?:string;
  number?:string;
  images?:{small?:string;large?:string};
};

const IMAGE_SET_OVERRIDES:Record<string,string>={
  "EX trainer Kit (Latias)":"tk1a",
  "EX trainer Kit (Latios)":"tk1b",
  "EX trainer Kit 2 (Plusle)":"tk2a",
  "EX trainer Kit 2 (Minun)":"tk2b",
  "DP trainer Kit (Manaphy)":"tk3a",
  "DP trainer Kit (Lucario)":"tk3b",
  "HS trainer Kit (Raichu)":"tk4a",
  "HS trainer Kit (Gyarados)":"tk4b",
  "BW trainer Kit (Excadrill)":"tk5a",
  "BW trainer Kit (Zoroark)":"tk5b",
  "XY trainer Kit (Noivern)":"tk6a",
  "XY trainer Kit (Sylveon)":"tk6b",
  "XY trainer Kit (Bisharp)":"tk7a",
  "XY trainer Kit (Wigglytuff)":"tk7b",
  "XY trainer Kit (Latias)":"tk8a",
  "XY trainer Kit (Latios)":"tk8b",
};

function normalized(value?:string){
  return(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}

async function pokemonSetImages(setName:string){
  const safeName=setName.replace(/["\\]/g," ");
  const response=await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(`set.name:"${safeName}"`)}&pageSize=250`,{
    headers:{Accept:"application/json"},
    next:{revalidate:86400},
  });
  if(!response.ok)return[];
  const payload=await response.json() as {data?:PokemonSetCard[]};
  return payload.data??[];
}

async function emergencySet(id:string){
  const config=EMERGENCY_SET_FALLBACKS[id];
  if(!config)return null;
  const fallback=await tcgCsvSet(config.name);
  if(!fallback)return null;
  const cards=fallback.products.filter(product=>config.numberPattern.test(productNumber(product)??"")).map(product=>{
    const printed=productNumber(product)??String(product.productId);
    return{id:`tcgcsv-${fallback.groupId}-${product.productId}`,localId:printed.split("/")[0],name:product.name.replace(/\s*\([!?A-Z]\)$/i,""),image:productImage(product)};
  });
  if(cards.length!==config.total)return null;
  return{id,name:config.name,cardCount:{official:config.official,total:config.total},cards,catalogLanguage:"tcgcsv",missingImageCount:0};
}

export async function GET(request:Request){
  const id=new URL(request.url).searchParams.get("id");
  if(!id||!/^[a-zA-Z0-9.-]+$/.test(id))return catalogJson({error:"invalid_set"},400);
  try{
    let primary;
    try{primary=await tcgdex(`/sets/${id}`,CATALOG_LANGUAGES)}catch(error){
      const rescued=await emergencySet(id);
      if(rescued)return catalogJson(rescued);
      throw error;
    }
    const set={...(primary.data as CatalogSet)};
    let cards=(set.cards??[]).map(card=>({...card}));
    let missing=new Set(cards.filter(card=>!card.image).map(card=>card.localId));

    for(const language of CATALOG_LANGUAGES){
      if(!missing.size||language===primary.language)continue;
      try{
        const alternate=await tcgdex(`/sets/${id}`,[language]);
        const alternateSet=alternate.data as CatalogSet;
        const byLocalId=new Map((alternateSet.cards??[]).filter(card=>card.image).map(card=>[card.localId,card.image]));
        for(const card of cards){
          if(!card.image&&byLocalId.get(card.localId))card.image=byLocalId.get(card.localId);
        }
        if(!set.tcgOnline&&alternateSet.tcgOnline)set.tcgOnline=alternateSet.tcgOnline;
        missing=new Set(cards.filter(card=>!card.image).map(card=>card.localId));
      }catch{}
    }

    if((missing.size||cards.length===0)&&set.name){
      try{
        const fallback=await tcgCsvSet(set.name);
        if(fallback&&REBUILD_FROM_TCGCSV.has(id)&&(cards.length===0||id==="mfb")){
          const used=new Set<string>();
          const products=id==="mfb"?fallback.products.filter(product=>!product.name.startsWith("My First Battle [")):fallback.products;
          cards=products.flatMap((product,index)=>{
            const printed=product.extendedData?.find(item=>item.name.toLowerCase()==="number")?.value;
            const localId=printed?.split("/")[0]||(id==="mfb"?`MFB-${String(index+1).padStart(2,"0")}`:String(product.productId));
            const key=`${localId}:${normalized(product.name)}`;
            if(used.has(key))return[];
            used.add(key);
            return[{id:`tcgcsv-${fallback.groupId}-${product.productId}`,localId,name:product.name,image:productImage(product)}];
          });
          set.cardCount={official:cards.length,total:cards.length};
        }else if(fallback){
          for(const card of cards){
            if(card.image)continue;
            const product=matchProduct(fallback.products,fallback.prices,card);
            if(product?.imageUrl)card.image=productImage(product);
          }
        }
        missing=new Set(cards.filter(card=>!card.image).map(card=>collectorNumber(card.localId)));
      }catch{}
    }

    if(missing.size&&set.name){
      try{
        const fallback=await pokemonSetImages(set.name);
        for(const card of cards){
          if(card.image)continue;
          const local=card.localId.replace(/^0+(?=\d)/,"");
          const match=fallback.find(item=>item.number?.replace(/^0+(?=\d)/,"")===local&&normalized(item.name)===normalized(card.name));
          if(match?.images)card.image=match.images.large??match.images.small;
        }
        missing=new Set(cards.filter(card=>!card.image).map(card=>card.localId));
      }catch{}
    }

    if(missing.size&&id==="mep"){
      try{
        const jumbo=await tcgCsvGroup(1528);
        if(jumbo){
          for(const card of cards){
            if(card.image)continue;
            const product=matchProduct(jumbo.products,jumbo.prices,card);
            if(product?.imageUrl)card.image=productImage(product);
          }
          missing=new Set(cards.filter(card=>!card.image).map(card=>card.localId));
        }
      }catch{}
    }

    const imageSetId=set.name?IMAGE_SET_OVERRIDES[set.name]:undefined;
    if(missing.size&&imageSetId){
      for(const card of cards){
        if(!card.image){
          const number=card.localId.replace(/^0+(?=\d)/,"");
          card.image=`https://images.pokemontcg.io/${imageSetId}/${number}_hires.png`;
        }
      }
      missing=new Set();
    }

    if(missing.size&&DIGITAL_SET_IDS.has(id)){
      const pocketSet=id.toLowerCase();
      for(const card of cards){
        if(!card.image)card.image=`https://raw.githubusercontent.com/chase-manning/pokemon-tcg-pocket-cards/refs/heads/main/images/webp/cards/${pocketSet}/${card.localId}.webp`;
      }
      missing=new Set();
    }

    return catalogJson({...set,cards,digital:DIGITAL_SET_IDS.has(id),catalogLanguage:primary.language,missingImageCount:missing.size});
  }catch(error){
    return catalogJson({error:"set_unavailable",detail:error instanceof Error?error.message:""},503);
  }
}
