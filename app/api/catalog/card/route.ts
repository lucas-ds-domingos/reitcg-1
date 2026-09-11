import {CATALOG_LANGUAGES,catalogJson,tcgdex} from "../shared";
import {matchProduct,normalized,pricingFor,productImage,productNumber,tcgCsvGroup,tcgCsvSet} from "../tcgcsv";

type Pricing={
  tcgplayer?:Record<string,Record<string,number|undefined>|null|undefined>;
  cardmarket?:Record<string,number>;
};
type CatalogCard={
  id?:string;
  localId?:string;
  name?:string;
  image?:string;
  pricing?:Pricing;
  set?:{name?:string};
  [key:string]:unknown;
};
type PokemonApiCard={
  name?:string;
  number?:string;
  set?:{name?:string};
  images?:{small?:string;large?:string};
  tcgplayer?:{prices?:Record<string,{market?:number;mid?:number}>};
  cardmarket?:{prices?:{trendPrice?:number;avg7?:number;avg30?:number}};
};

function hasPricing(pricing?:Pricing){
  const tcg=pricing?.tcgplayer&&Object.values(pricing.tcgplayer).some(value=>value&&Object.values(value).some(price=>typeof price==="number"&&price>0));
  const market=pricing?.cardmarket&&Object.values(pricing.cardmarket).some(price=>typeof price==="number"&&price>0);
  return Boolean(tcg||market);
}

async function tcgCsvFallback(card:CatalogCard){
  if(!card.name||!card.localId||!card.set?.name)return null;
  const data=await tcgCsvSet(card.set.name);
  if(!data)return null;
  let product=matchProduct(data.products,data.prices,card);
  let prices=data.prices;
  if(!product&&normalized(card.set.name)==="mep black star promos"){
    const jumbo=await tcgCsvGroup(1528);
    if(jumbo){product=matchProduct(jumbo.products,jumbo.prices,card);prices=jumbo.prices}
  }
  if(!product)return null;
  const tcgplayer=pricingFor(product.productId,prices);
  return{image:productImage(product),pricing:{tcgplayer} as Pricing};
}

async function pokemonApiFallback(card:CatalogCard){
  if(!card.name||!card.localId)return null;
  const safeName=card.name.replace(/["\\]/g," ");
  const safeNumber=card.localId.replace(/^0+(?=\d)/,"").replace(/[^a-zA-Z0-9]/g,"");
  const query=`name:"${safeName}" number:"${safeNumber}"`;
  const response=await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}&pageSize=20`,{
    headers:{Accept:"application/json"},
    next:{revalidate:86400},
  });
  if(!response.ok)return null;
  const payload=await response.json() as {data?:PokemonApiCard[]};
  const candidates=payload.data??[];
  const wantedSet=normalized(card.set?.name);
  return candidates.sort((a,b)=>{
    const score=(item:PokemonApiCard)=>{
      const itemSet=normalized(item.set?.name);
      return itemSet===wantedSet?3:itemSet.includes(wantedSet)||wantedSet.includes(itemSet)?2:0;
    };
    return score(b)-score(a);
  })[0]??null;
}

export async function GET(request:Request){
  const url=new URL(request.url);
  const id=url.searchParams.get("id");
  const alternateOnly=url.searchParams.get("alternate")==="1";
  if(!id||!/^[a-zA-Z0-9.-]+$/.test(id))return catalogJson({error:"invalid_card"},400);
  try{
    const tcgCsvId=id.match(/^tcgcsv-(\d+)-(\d+)$/);
    if(tcgCsvId){
      const data=await tcgCsvGroup(Number(tcgCsvId[1]));
      if(!data)return catalogJson({error:"card_unavailable"},404);
      const product=data.products.find(item=>item.productId===Number(tcgCsvId[2]));
      if(!product)return catalogJson({error:"card_unavailable"},404);
      const printed=productNumber(product);
      return catalogJson({
        id,
        localId:printed?.split("/")[0]||String(product.productId),
        name:product.name,
        image:productImage(product),
        pricing:{tcgplayer:pricingFor(product.productId,data.prices)},
        catalogLanguage:"tcgcsv",
        imageSource:"tcgcsv",
        pricingSource:"tcgcsv",
      });
    }
    const primary=await tcgdex(`/cards/${id}`,CATALOG_LANGUAGES);
    const card={...(primary.data as CatalogCard)};
    let image=alternateOnly?undefined:card.image;
    let pricing=card.pricing;
    let imageLanguage=image?primary.language:"";
    let pricingLanguage=hasPricing(pricing)?primary.language:"";

    if(!hasPricing(pricing)){
      try{
        const fallback=await tcgCsvFallback(card);
        if(fallback&&hasPricing(fallback.pricing)){pricing=fallback.pricing;pricingLanguage="tcgcsv"}
        if(!image&&fallback?.image){image=fallback.image;imageLanguage="tcgcsv"}
      }catch{}
    }

    if(!image||!hasPricing(pricing)){
      for(const language of CATALOG_LANGUAGES){
        if(language===primary.language)continue;
        try{
          const alternate=await tcgdex(`/cards/${id}`,[language]);
          const alternateCard=alternate.data as CatalogCard;
          if(!image&&alternateCard.image){image=alternateCard.image;imageLanguage=language}
          if(!hasPricing(pricing)&&hasPricing(alternateCard.pricing)){pricing=alternateCard.pricing;pricingLanguage=language}
          if(image&&hasPricing(pricing))break;
        }catch{}
      }
    }

    if(!image||!hasPricing(pricing)){
      try{
        const fallback=await pokemonApiFallback(card);
        if(fallback){
          if(!image&&fallback.images){image=fallback.images.large??fallback.images.small;imageLanguage="pokemontcg"}
          if(!hasPricing(pricing)){
            const tcgplayer=fallback.tcgplayer?.prices&&Object.fromEntries(Object.entries(fallback.tcgplayer.prices).map(([variant,value])=>[variant,{marketPrice:value.market,midPrice:value.mid}]));
            const market=fallback.cardmarket?.prices;
            const candidate:Pricing={tcgplayer,cardmarket:market?{avg7:market.avg7??0,avg:market.avg30??0,trend:market.trendPrice??0}:undefined};
            if(hasPricing(candidate)){pricing=candidate;pricingLanguage="pokemontcg"}
          }
        }
      }catch{}
    }

    return catalogJson({...card,image,pricing,catalogLanguage:primary.language,imageSource:imageLanguage,pricingSource:pricingLanguage});
  }catch(error){
    return catalogJson({error:"card_unavailable",detail:error instanceof Error?error.message:""},503);
  }
}
