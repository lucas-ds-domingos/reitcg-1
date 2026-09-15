"use client";

import {useEffect,useRef,useState} from "react";
import {Camera,Check,CheckCircle2,ExternalLink,ImagePlus,Loader2,ScanLine} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from "@/components/ui/dialog";

type ScannerSet={id:string;name:string;total:number;official:number};
type ScannerCard={id:string;localId:string;name:string;image?:string;hp?:number};
type SetResponse={cards?:ScannerCard[]};
type ScanResult={set:ScannerSet;card:ScannerCard;score:number};
type Rates={USD:number;EUR:number};
type PricingResponse={pricing?:{tcgplayer?:Record<string,{marketPrice?:number;midPrice?:number}|null|undefined>;cardmarket?:{avg7?:number;avg?:number;trend?:number}}};
type PriceInfo={value:number|null;source:string;currency?:"BRL"|"USD"|"EUR";loading?:boolean};
type OwnedCard={cardId:string;setId:string;setName:string;name:string;localId:string;number:string;image?:string;quantity:number;updatedAt:string};
type SavedInfo={quantity:number;where:"conta"|"aparelho"};

const STORAGE_KEY="reicard:colecao";
const CATALOG_LANG="pt";

function clean(value:string){
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}
const REGIONAL:Array<[RegExp,string]>=[
  [/\bde alola\b/g,"de alola alolan alola"],
  [/\bde galar\b/g,"de galar galarian galar"],
  [/\bde hisui\b/g,"de hisui hisuian hisui"],
  [/\bde paldea\b/g,"de paldea paldean paldea"],
];

function haystackFor(text:string){
  let value=clean(text);
  for(const[pattern,replacement]of REGIONAL)value=value.replace(pattern,replacement);
  return ` ${value} `;
}

function cardNumber(value:string){
  return /^\d+$/.test(value)?Number(value):NaN;
}

function readPrintedNumbers(text:string){
  const normalized=text.toUpperCase()
    .replace(/[OQ]/g,"0").replace(/[IL|]/g,"1").replace(/S/g,"5").replace(/B/g,"8").replace(/G/g,"6").replace(/Z/g,"2");
  const found=[...normalized.matchAll(/(?:^|\D)(\d{1,3})\s*[/\\]\s*(\d{1,3})(?:\D|$)/g)]
    .map(match=>({number:Number(match[1]),total:Number(match[2])}))
    .filter(item=>item.number>0&&item.total>0&&item.number<=item.total+120);
  return found.filter((item,index,list)=>list.findIndex(other=>other.number===item.number&&other.total===item.total)===index);
}

function matchScore(text:string,set:ScannerSet,card:ScannerCard,exactTotal:boolean){
  const haystack=haystackFor(text);
  const name=clean(card.name);
  const tokens=name.split(" ").filter(token=>token.length>2);
  let score=20;
  if(name&&haystack.includes(` ${name} `))score+=100;
  score+=tokens.filter(token=>haystack.includes(` ${token} `)).length*12;
  score+=clean(set.name).split(" ").filter(token=>token.length>3&&haystack.includes(` ${token} `)).length*3;
  if(card.hp&&new RegExp(`\\b(ps|hp)\\s*${card.hp}\\b`).test(haystack))score+=18;
  if(exactTotal)score+=30;
  return score;
}
function binarize(canvas:HTMLCanvasElement){
  const context=canvas.getContext("2d",{willReadFrequently:true});
  if(!context)return;
  const image=context.getImageData(0,0,canvas.width,canvas.height);
  const pixels=image.data;
  let sum=0;
  for(let index=0;index<pixels.length;index+=4)sum+=pixels[index];
  const threshold=(sum/(pixels.length/4))*.82;
  for(let index=0;index<pixels.length;index+=4){
    const value=pixels[index]<threshold?0:255;
    pixels[index]=pixels[index+1]=pixels[index+2]=value;
    pixels[index+3]=255;
  }
  context.putImageData(image,0,0);
}

function region(image:HTMLImageElement,box:{x:number;y:number;w:number;h:number},width:number,contrast:number,threshold:boolean){
  const canvas=document.createElement("canvas");
  const sourceWidth=image.naturalWidth*box.w;
  const sourceHeight=image.naturalHeight*box.h;
  canvas.width=width;
  canvas.height=Math.max(1,Math.round(width*(sourceHeight/sourceWidth)));
  const context=canvas.getContext("2d",{willReadFrequently:true});
  if(!context)throw new Error("image_error");
  context.fillStyle="white";
  context.fillRect(0,0,canvas.width,canvas.height);
  context.imageSmoothingQuality="high";
  context.filter=`grayscale(1) contrast(${contrast})`;
  context.drawImage(image,image.naturalWidth*box.x,image.naturalHeight*box.y,sourceWidth,sourceHeight,0,0,canvas.width,canvas.height);
  if(threshold)binarize(canvas);
  return canvas;
}

async function prepareRegions(file:File){
  const source=URL.createObjectURL(file);
  try{
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const element=new Image();
      element.onload=()=>resolve(element);
      element.onerror=()=>reject(new Error("image_error"));
      element.src=source;
    });
    return{
      full:region(image,{x:0,y:0,w:1,h:1},1600,1.15,false),
      wide:region(image,{x:0,y:.60,w:1,h:.40},2200,1.5,true),
      left:region(image,{x:0,y:.70,w:.6,h:.28},2200,1.7,true),
      tight:region(image,{x:.02,y:.74,w:.42,h:.20},2000,1.9,true),
    };
  }finally{URL.revokeObjectURL(source)}
}

function collectorNumber(result:ScanResult){
  const {card,set}=result;
  if(!/^\d+$/.test(card.localId)||set.official<=0)return card.localId;
  const width=Math.max(3,card.localId.length,String(set.official).length);
  return `${card.localId.padStart(width,"0")}/${String(set.official).padStart(width,"0")}`;
}

function priceLinks(result:ScanResult){
  const number=collectorNumber(result);
  const query=`${result.card.name} (${number})`;
  return{
    liga:`https://www.ligapokemon.com.br/?view=cards%2Fsearch&card=${encodeURIComponent(`${result.card.name} ${number}`)}&tipo=1`,
    tcgplayer:`https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(`${result.card.name} ${number} ${result.set.name}`)}&view=grid`,
    query,
  };
}

function matchesTotal(set:ScannerSet,totals:number[],tolerance:number){
  return totals.some(total=>Math.abs(set.official-total)<=tolerance||Math.abs(set.total-total)<=tolerance);
}

async function persistCard(result:ScanResult):Promise<SavedInfo>{
  const entry:OwnedCard={
    cardId:result.card.id,
    setId:result.set.id,
    setName:result.set.name,
    name:result.card.name,
    localId:result.card.localId,
    number:collectorNumber(result),
    image:result.card.image,
    quantity:1,
    updatedAt:new Date().toISOString(),
  };
  try{
    const response=await fetch("/api/collection",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(entry)});
    if(response.ok){
      const data=(await response.json().catch(()=>null)) as{quantity?:number}|null;
      return{quantity:data?.quantity??1,where:"conta"};
    }
  }catch{}
  const stored=window.localStorage.getItem(STORAGE_KEY);
  const list=stored?(JSON.parse(stored) as OwnedCard[]):[];
  const existing=list.find(item=>item.cardId===entry.cardId);
  if(existing){existing.quantity+=1;existing.updatedAt=entry.updatedAt}
  else list.push(entry);
  window.localStorage.setItem(STORAGE_KEY,JSON.stringify(list));
  return{quantity:existing?existing.quantity:1,where:"aparelho"};
}

export function CardScanner({sets,currentSetId,rates,onLocated}:{sets:ScannerSet[];currentSetId:string;rates:Rates;onLocated:(result:ScanResult)=>void}){
  const[open,setOpen]=useState(false),[preview,setPreview]=useState(""),[status,setStatus]=useState(""),[progress,setProgress]=useState(0),[results,setResults]=useState<ScanResult[]>([]),[prices,setPrices]=useState<Record<string,PriceInfo>>({}),[saved,setSaved]=useState<Record<string,SavedInfo>>({}),[error,setError]=useState(""),[manualNumber,setManualNumber]=useState("");
  const inputRef=useRef<HTMLInputElement|null>(null);
  const capturedFileRef=useRef<File|null>(null);

  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);

  function reset(){
    if(preview)URL.revokeObjectURL(preview);
    setPreview("");setStatus("");setProgress(0);setResults([]);setPrices({});setSaved({});setError("");setManualNumber("");
    if(inputRef.current)inputRef.current.value="";
  }

  async function scan(file:File,suppliedNumber=""){
    capturedFileRef.current=file;
    reset();
    setPreview(URL.createObjectURL(file));
    setStatus("Lendo o nome e o número da carta...");
    let worker:Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>>|null=null;
    try{
      const tesseract=await import("tesseract.js");
      const regions=await prepareRegions(file);
      const passes=4;
      let phase=0;
      worker=await tesseract.createWorker("por+eng",undefined,{logger:event=>{
        if(event.status==="recognizing text")setProgress(Math.round(((phase+(event.progress??0))/passes)*100));
      }});

      await worker.setParameters({tessedit_pageseg_mode:tesseract.PSM.SPARSE_TEXT,tessedit_char_whitelist:""});
      const fullText=(await worker.recognize(regions.full)).data.text;

      setStatus("Lendo a numeração inferior...");
      await worker.setParameters({tessedit_pageseg_mode:tesseract.PSM.SPARSE_TEXT,tessedit_char_whitelist:"0123456789/"});
      phase=1;const wideText=(await worker.recognize(regions.wide)).data.text;
      phase=2;const leftText=(await worker.recognize(regions.left)).data.text;
      phase=3;const tightText=(await worker.recognize(regions.tight)).data.text;

      const numberText=`${wideText}\n${leftText}\n${tightText}`;
      const printed=[...readPrintedNumbers(numberText),...readPrintedNumbers(suppliedNumber)]
        .filter((item,index,list)=>list.findIndex(other=>other.number===item.number&&other.total===item.total)===index);
      if(!printed.length)throw new Error("number_not_found");
      setStatus("Procurando nos álbuns físicos...");

      const totals=printed.map(item=>item.total);
      let exactTotal=true;
      let candidateSets=sets.filter(set=>matchesTotal(set,totals,0));
      if(!candidateSets.length){exactTotal=false;candidateSets=sets.filter(set=>matchesTotal(set,totals,5))}
      if(!candidateSets.length){
        try{
          const request=await fetch(`/api/catalog/sets?lang=${CATALOG_LANG}&v=10`);
          if(request.ok){
            const catalog=(await request.json()) as Array<{id:string;name:string;cardCount?:{total?:number;official?:number}}>;
            const mapped=catalog.map(set=>({id:set.id,name:set.name,total:set.cardCount?.total??0,official:set.cardCount?.official??0}));
            exactTotal=true;
            candidateSets=mapped.filter(set=>matchesTotal(set,totals,0));
            if(!candidateSets.length){exactTotal=false;candidateSets=mapped.filter(set=>matchesTotal(set,totals,5))}
          }
        }catch{}
      }
      if(!candidateSets.length)throw new Error("set_not_found");

      const responses=await Promise.allSettled(candidateSets.map(async set=>{
        const request=await fetch(`/api/catalog/set?id=${encodeURIComponent(set.id)}&lang=${CATALOG_LANG}&v=10`);
        if(!request.ok)throw new Error("catalog_error");
        const data=(await request.json()) as SetResponse;
        const exact=matchesTotal(set,totals,0);
        return(data.cards??[]).flatMap(card=>printed.some(item=>cardNumber(card.localId)===item.number)
          ?[{set,card,score:matchScore(fullText,set,card,exact&&exactTotal)+(set.id===currentSetId?8:0)}]
          :[]);
      }));
      const matches=responses.flatMap(item=>item.status==="fulfilled"?item.value:[])
        .sort((a,b)=>b.score-a.score)
        .filter((item,index,list)=>list.findIndex(other=>other.card.id===item.card.id)===index)
        .slice(0,5);
      if(!matches.length)throw new Error("card_not_found");
      setResults(matches);
      setPrices(Object.fromEntries(matches.map(item=>[item.card.id,{value:null,source:"Consultando cotação...",loading:true}])));
      void Promise.all(matches.map(async item=>{
        try{
          const response=await fetch(`/api/catalog/card?id=${encodeURIComponent(item.card.id)}&v=10`);
          if(!response.ok)throw new Error("price_error");
          const data=(await response.json()) as PricingResponse;
          const tcg=data.pricing?.tcgplayer;
          const usdValues=tcg?Object.values(tcg).flatMap(value=>{const price=value?.marketPrice??value?.midPrice;return typeof price==="number"&&price>0?[price]:[]}):[];
          const usdPrice=usdValues.length?usdValues.reduce((sum,value)=>sum+value,0)/usdValues.length:undefined;
          if(usdPrice!==undefined){
            setPrices(previous=>({...previous,[item.card.id]:{value:usdPrice*(rates.USD||1),currency:rates.USD?"BRL":"USD",source:`TCGplayer · média de ${usdValues.length} ${usdValues.length===1?"versão":"versões"}${rates.USD?" · convertido para R$":" · em US$"}`}}));
            return;
          }
          const market=data.pricing?.cardmarket;
          const eurPrice=market?.avg7??market?.avg??market?.trend;
          if(eurPrice!==undefined&&eurPrice>0){
            setPrices(previous=>({...previous,[item.card.id]:{value:eurPrice*(rates.EUR||1),currency:rates.EUR?"BRL":"EUR",source:`Cardmarket · média disponível${rates.EUR?" · convertido para R$":" · em €"}`}}));
            return;
          }
          setPrices(previous=>({...previous,[item.card.id]:{value:null,source:"Sem cotação nos mercados integrados"}}));
        }catch{
          setPrices(previous=>({...previous,[item.card.id]:{value:null,source:"Cotação temporariamente indisponível"}}));
        }
      }));
      setStatus(matches.length===1?"Carta localizada!":"Confira qual destas cartas foi fotografada.");
    }catch(reason){
      const code=reason instanceof Error?reason.message:"";
      setError(code==="number_not_found"?"Não consegui ler o número. Fotografe a carta inteira, sem reflexo, deixando a numeração inferior bem visível.":code==="set_not_found"?"O número foi lido, mas não correspondeu aos álbuns físicos disponíveis.":"Não foi possível localizar a carta. Tente novamente com mais luz e a câmera paralela à carta.");
      setStatus("");
    }finally{if(worker)await worker.terminate()}
  }

  function retryWithNumber(){
    const normalized=manualNumber.trim().replace(/[Oo]/g,"0");
    if(!/^\d{1,3}\s*[/|]\s*\d{1,3}$/.test(normalized)){
      setError("Informe o número como 027/147 (o número impresso na parte de baixo da carta).");
      return;
    }
    const file=capturedFileRef.current;
    if(!file)return;
    void scan(file,normalized.replace("|","/"));
  }

  async function keep(result:ScanResult){
    setSaved(previous=>({...previous,[result.card.id]:previous[result.card.id]??{quantity:0,where:"aparelho"}}));
    const info=await persistCard(result);
    setSaved(previous=>({...previous,[result.card.id]:info}));
  }

  function choose(result:ScanResult){
    onLocated(result);
    setOpen(false);
    reset();
  }

  return <Dialog open={open} onOpenChange={value=>{setOpen(value);if(!value)reset()}}><DialogTrigger asChild><Button className="brand-button h-11 gap-2 whitespace-nowrap"><ScanLine className="h-5 w-5"/>Escanear carta</Button></DialogTrigger><DialogContent className="max-h-[94vh] w-[calc(100vw-1.5rem)] max-w-4xl overflow-y-auto p-5 sm:p-7"><DialogHeader><DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5 text-violet-600"/>Localizar carta pela câmera</DialogTitle><DialogDescription>Fotografe a frente inteira da carta. O ReiCard lerá a numeração e buscará o álbum físico correto.</DialogDescription></DialogHeader>
    <div className="space-y-4">
      <input ref={inputRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={event=>{const file=event.target.files?.[0];if(file)void scan(file)}}/>
      {!preview?<button type="button" onClick={()=>inputRef.current?.click()} className="flex min-h-52 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-300 bg-gradient-to-br from-cyan-50 to-fuchsia-50 p-6 text-center"><span className="brand-button grid h-16 w-16 place-items-center rounded-full text-white shadow-lg"><Camera className="h-8 w-8"/></span><b className="mt-4 text-lg text-[#071a3d]">Abrir câmera</b><span className="mt-1 text-sm text-slate-500">Use boa iluminação e evite reflexos no plástico</span></button>:<div className="grid gap-4 sm:grid-cols-[180px_1fr]"><img src={preview} alt="Carta fotografada" className="mx-auto max-h-64 w-full rounded-xl bg-slate-100 object-contain"/><div className="flex min-h-36 flex-col justify-center rounded-xl bg-slate-50 p-4">{status&&<><div className="flex items-center gap-2 font-bold text-[#071a3d]">{results.length?<CheckCircle2 className="h-5 w-5 text-green-600"/>:<Loader2 className="h-5 w-5 animate-spin text-violet-600"/>}{status}</div>{!results.length&&<div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-600 transition-all" style={{width:`${Math.max(8,progress)}%`}}/></div>}</>}{error&&<><p className="text-sm font-semibold leading-relaxed text-red-600">{error}</p><div className="mt-3 flex gap-2"><input value={manualNumber} onChange={event=>setManualNumber(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")retryWithNumber()}} placeholder="Ex.: 027/147" inputMode="numeric" aria-label="Número da carta" className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm"/><Button type="button" variant="secondary" className="shrink-0" onClick={retryWithNumber}>Buscar número</Button></div><p className="mt-1 text-xs text-slate-500">Se a foto não for lida, digite a numeração impressa na base da carta.</p></>}<Button variant="outline" className="mt-4 gap-2" onClick={()=>inputRef.current?.click()}><ImagePlus className="h-4 w-4"/>Fotografar novamente</Button></div></div>}
      {results.length>0&&<div className="space-y-3"><p className="text-sm font-bold text-slate-600">Confira a carta e a cotação:</p>{results.map(result=>{const price=prices[result.card.id];const links=priceLinks(result);const owned=saved[result.card.id];return <article key={`${result.set.id}-${result.card.id}`} className="rounded-xl border bg-white p-3 shadow-sm"><div className="flex items-center gap-3"><div className="h-24 w-16 shrink-0 overflow-hidden rounded bg-slate-100">{result.card.image?<img src={/\.(webp|png|jpe?g)$/i.test(result.card.image)?result.card.image:`${result.card.image}/low.webp`} alt="" className="h-full w-full object-contain"/>:<ScanLine className="m-auto mt-9 h-5 w-5 text-slate-400"/>}</div><div className="min-w-0 flex-1"><b className="block truncate text-[#071a3d]">{result.card.name}</b><span className="block truncate text-sm text-slate-500">{result.set.name}</span><span className="text-xs font-bold text-violet-600">Carta #{collectorNumber(result)}</span><div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2"><span className="block text-[10px] font-bold uppercase tracking-wide text-emerald-700">Valor médio estimado</span><b className="text-sm text-emerald-950">{price?.loading?"Consultando...":price?.value!==null&&price?.value!==undefined?new Intl.NumberFormat("pt-BR",{style:"currency",currency:price.currency??"BRL"}).format(price.value):"Sem cotação"}</b><span className="block text-[10px] text-emerald-700">{price?.source??"Consultando cotação..."}</span></div></div></div>
        <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={()=>void keep(result)} className="flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-2 text-xs font-bold text-white">{owned?.quantity?<><Check className="h-3 w-3"/>Guardada ({owned.quantity})</>:"Tenho esta carta"}</button><button type="button" onClick={()=>choose(result)} className="brand-button rounded-lg px-2 py-2 text-xs font-bold text-white">Abrir no álbum</button></div>
        <div className="mt-2 grid grid-cols-2 gap-2"><a href={links.liga} target="_blank" rel="noopener noreferrer" className="price-link flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-bold" aria-label={`Consultar ${links.query} na Liga Pokémon`}>Liga Pokémon<ExternalLink className="h-3 w-3"/></a><a href={links.tcgplayer} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 rounded-lg bg-slate-100 px-2 py-2 text-xs font-bold text-slate-700">TCGplayer<ExternalLink className="h-3 w-3"/></a></div>
        {owned?.quantity>0&&<p className="mt-2 text-[11px] text-slate-500">Salva na sua coleção {owned.where==="conta"?"na sua conta":"neste aparelho"}.</p>}
      </article>})}</div>}
      <p className="text-xs leading-relaxed text-slate-500">A fotografia é processada no seu aparelho para fazer a leitura e não é armazenada pelo ReiCard. A confirmação evita marcar uma edição parecida por engano.</p>
    </div>
  </DialogContent></Dialog>;
}
