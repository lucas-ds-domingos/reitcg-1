export type TcgCsvProduct={
  productId:number;
  name:string;
  imageUrl?:string;
  extendedData?:Array<{name:string;value:string}>;
};

export type TcgCsvPrice={
  productId:number;
  lowPrice?:number|null;
  midPrice?:number|null;
  marketPrice?:number|null;
  subTypeName?:string;
};

type TcgCsvGroup={groupId:number;name:string};

const HEADERS={
  Accept:"application/json",
  "User-Agent":"ReiCard/1.0 (+https://colecao-pokemon-fabio.fabio1986669353.chatgpt.site)",
};

const GROUP_IDS:Record<string,number>={
  "wizards black star promos":1418,
  "jumbo cards":1528,
  "unseen forces":1398,
  "best of game":1455,
  "poke card creator pack":2214,
  "unseen forces unown collection":1398,
  "dp black star promos":1421,
  "dp trainer kit lucario":1541,
  "dp trainer kit manaphy":1541,
  "hs trainer kit raichu":1540,
  "hs trainer kit gyarados":1540,
  "sm trainer kit alolan raichu":2069,
  "bw black star promos":1407,
  "mcdonald s collection 2011":1401,
  "mcdonald s collection 2012":1427,
  "mcdonald s collection 2014":1692,
  "mcdonald s collection 2015":1694,
  "mcdonald s collection 2016":3087,
  "mcdonald s collection 2017":2148,
  "mcdonald s collection 2018":2364,
  "mcdonald s collection 2019":2555,
  "mcdonald s collection 2021":2782,
  "mcdonald s collection 2022":3150,
  "mcdonald s collection 2023":23306,
  "mcdonald s collection 2024":24163,
  "radiant collection":1465,
  "yellow a alternate":1938,
  "dragon majesty":2295,
  "shining fates shiny vault":2781,
  "celebrations classic collection":2931,
  "brilliant stars trainer gallery":3020,
  "astral radiance trainer gallery":3068,
  "lost origin trainer gallery":3172,
  "silver tempest trainer gallery":17674,
  "crown zenith galarian gallery":17689,
  "scarlet violet energy":24382,
  "my first battle":23330,
  "mep black star promos":24451,
};

const GROUP_NAMES:Record<string,string>={
  "wizards black star promos":"wotc promo",
  "best of game":"best of promos",
  "poke card creator pack":"kids wb promos",
  "unseen forces unown collection":"ex unseen forces",
  "dp black star promos":"diamond and pearl promos",
  "hs trainer kit raichu":"hgss trainer kit gyarados raichu",
  "hs trainer kit gyarados":"hgss trainer kit gyarados raichu",
  "bw black star promos":"black and white promos",
  "radiant collection":"legendary treasures radiant collection",
  "yellow a alternate":"alternate art promos",
  "scarlet violet energy":"sve scarlet violet energies",
};

export const DIGITAL_SET_IDS=new Set(["P-A","A1","A1a","A2","A2a","A2b","A3","A3a","A3b","A4","A4a","A4b","B1","B1a","B2","B2a"]);

export function normalized(value?:string){
  return(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}

export function collectorNumber(value?:string){
  return(value??"").split("/")[0].replace(/^0+(?=\d)/,"").toLowerCase();
}

export function productImage(product:TcgCsvProduct){
  return product.imageUrl?.replace(/_200w\.jpg$/i,"_in_1000x1000.jpg");
}

export function productNumber(product:TcgCsvProduct){
  return product.extendedData?.find(item=>item.name.toLowerCase()==="number")?.value;
}

async function groupIdFor(setName:string){
  const wanted=normalized(setName);
  if(GROUP_IDS[wanted])return GROUP_IDS[wanted];
  const response=await fetch("https://tcgcsv.com/tcgplayer/3/groups",{headers:HEADERS,next:{revalidate:86400}});
  if(!response.ok)return null;
  const payload=await response.json() as {results?:TcgCsvGroup[]};
  const alias=GROUP_NAMES[wanted]??wanted;
  const ranked=(payload.results??[]).map(group=>{
    const name=normalized(group.name);
    const score=name===alias?4:name===wanted?3:name.includes(alias)||alias.includes(name)?2:0;
    return{...group,score};
  }).sort((a,b)=>b.score-a.score);
  return ranked[0]?.score?ranked[0].groupId:null;
}

export async function tcgCsvGroup(groupId:number){
  const [productsResponse,pricesResponse]=await Promise.all([
    fetch(`https://tcgcsv.com/tcgplayer/3/${groupId}/products`,{headers:HEADERS,next:{revalidate:86400}}),
    fetch(`https://tcgcsv.com/tcgplayer/3/${groupId}/prices`,{headers:HEADERS,next:{revalidate:21600}}),
  ]);
  if(!productsResponse.ok||!pricesResponse.ok)return null;
  const productsPayload=await productsResponse.json() as {results?:TcgCsvProduct[]};
  const pricesPayload=await pricesResponse.json() as {results?:TcgCsvPrice[]};
  return{groupId,products:productsPayload.results??[],prices:pricesPayload.results??[]};
}

export async function tcgCsvSet(setName:string){
  const groupId=await groupIdFor(setName);
  if(!groupId)return null;
  return tcgCsvGroup(groupId);
}

export function matchProduct(products:TcgCsvProduct[],prices:TcgCsvPrice[],card:{name?:string;localId?:string}){
  const wantedNumber=collectorNumber(card.localId);
  const wantedName=normalized(card.name);
  const candidates=products.filter(product=>{
    return collectorNumber(productNumber(product))===wantedNumber;
  });
  const pricedProductIds=new Set(prices.filter(item=>
    [item.marketPrice,item.midPrice,item.lowPrice].some(value=>typeof value==="number"&&value>0)
  ).map(item=>item.productId));
  const namedCandidates=candidates.filter(item=>{
    const name=normalized(item.name);
    return name===wantedName||name.startsWith(`${wantedName} `)||wantedName.startsWith(`${name} `);
  });
  const allNamed=products.filter(item=>{
    const name=normalized(item.name).replace(/^basic /,"");
    const wanted=wantedName.replace(/^basic /,"");
    return name===wanted||name.startsWith(`${wanted} `)||wanted.startsWith(`${name} `);
  });
  return namedCandidates.find(item=>pricedProductIds.has(item.productId))
    ??namedCandidates.sort((a,b)=>a.name.length-b.name.length)[0]
    ??candidates.find(item=>pricedProductIds.has(item.productId))
    ??candidates[0]
    ??allNamed.find(item=>pricedProductIds.has(item.productId))
    ??allNamed.sort((a,b)=>a.name.length-b.name.length)[0]
    ??null;
}

export function pricingFor(productId:number,prices:TcgCsvPrice[]){
  return Object.fromEntries(prices.filter(item=>item.productId===productId).map((item,index)=>[
    normalized(item.subTypeName)||`market${index+1}`,
    {marketPrice:item.marketPrice??undefined,midPrice:item.midPrice??item.lowPrice??undefined},
  ]));
}
