"use client";

import {useEffect,useRef,useState} from "react";
import {Camera,CheckCircle2,ExternalLink,ImagePlus,Loader2,ScanLine} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from "@/components/ui/dialog";

type ScannerSet={id:string;name:string;total:number;official:number};
type ScannerCard={id:string;localId:string;name:string;image?:string};
type SetResponse={cards?:ScannerCard[]};
type ScanResult={set:ScannerSet;card:ScannerCard;score:number};
type Rates={USD:number;EUR:number};
type PricingResponse={pricing?:{tcgplayer?:Record<string,{marketPrice?:number;midPrice?:number}|null|undefined>;cardmarket?:{avg7?:number;avg?:number;trend?:number}}};
type PriceInfo={value:number|null;source:string;currency?:"BRL"|"USD"|"EUR";loading?:boolean};

function clean(value:string){
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}

function cardNumber(value:string){
  const match=value.match(/\d+/);
  return match?Number(match[0]):NaN;
}

function readPrintedNumbers(text:string){
  const normalized=text.toUpperCase().replace(/[Oo]/g,"0");
  const found=[...normalized.matchAll(/(?:^|\D)(\d{1,3})\s*[\/|]\s*(\d{1,3})(?:\D|$)/g)]
    .map(match=>({number:Number(match[1]),total:Number(match[2])}))
    .filter(item=>item.number>0&&item.total>0&&item.number<=item.total+100);
  return found.filter((item,index,list)=>list.findIndex(other=>other.number===item.number&&other.total===item.total)===index);
}

function matchScore(text:string,set:ScannerSet,card:ScannerCard){
  const haystack=` ${clean(text)} `;
  const name=clean(card.name);
  const tokens=name.split(" ").filter(token=>token.length>2);
  let score=20;
  if(name&&haystack.includes(` ${name} `))score+=100;
  score+=tokens.filter(token=>haystack.includes(` ${token} `)).length*12;
  score+=clean(set.name).split(" ").filter(token=>token.length>3&&haystack.includes(` ${token} `)).length*3;
  return score;
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
    const full=document.createElement("canvas");
    const fullWidth=Math.min(1200,image.naturalWidth);
    full.width=fullWidth;
    full.height=Math.round(image.naturalHeight*(fullWidth/image.naturalWidth));
    const fullContext=full.getContext("2d",{willReadFrequently:true});
    if(!fullContext)throw new Error("image_error");
    fullContext.filter="grayscale(1) contrast(1.15)";
    fullContext.drawImage(image,0,0,full.width,full.height);

    const number=document.createElement("canvas");
    number.width=2400;
    number.height=850;
    const numberContext=number.getContext("2d",{willReadFrequently:true});
    if(!numberContext)throw new Error("image_error");
    numberContext.fillStyle="white";
    numberContext.fillRect(0,0,number.width,number.height);
    numberContext.filter="grayscale(1) contrast(1.35)";
    numberContext.drawImage(image,0,image.naturalHeight*.86,image.naturalWidth*.55,image.naturalHeight*.14,0,0,number.width,number.height);
    return{full,number};
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

export function CardScanner({sets,currentSetId,rates,onLocated}:{sets:ScannerSet[];currentSetId:string;rates:Rates;onLocated:(result:ScanResult)=>void}){
  const[open,setOpen]=useState(false),[preview,setPreview]=useState(""),[status,setStatus]=useState(""),[progress,setProgress]=useState(0),[results,setResults]=useState<ScanResult[]>([]),[prices,setPrices]=useState<Record<string,PriceInfo>>({}),[error,setError]=useState("");
  const inputRef=useRef<HTMLInputElement|null>(null);

  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);

  function reset(){
    if(preview)URL.revokeObjectURL(preview);
    setPreview("");setStatus("");setProgress(0);setResults([]);setPrices({});setError("");
    if(inputRef.current)inputRef.current.value="";
  }

  async function scan(file:File){
    reset();
    setPreview(URL.createObjectURL(file));
    setStatus("Lendo o nome e o número da carta...");
    let worker:Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>>|null=null;
    try{
      const tesseract=await import("tesseract.js");
      const regions=await prepareRegions(file);
      let phase=0;
      worker=await tesseract.createWorker("eng",undefined,{logger:event=>{
        if(event.status==="recognizing text")setProgress(Math.round((phase*.5+(event.progress??0)*.5)*100));
      }});
      const fullText=await worker.recognize(regions.full);
      phase=1;
      setStatus("Lendo a numeração inferior...");
      const numberText=await worker.recognize(regions.number);
      const text=`${fullText.data.text}\n${numberText.data.text}`;
      const printed=readPrintedNumbers(text);
      if(!printed.length)throw new Error("number_not_found");
      setStatus("Procurando nos álbuns físicos...");

      const candidateSets=sets.filter(set=>printed.some(item=>set.official===item.total||set.total===item.total));
      if(!candidateSets.length)throw new Error("set_not_found");
      const responses=await Promise.allSettled(candidateSets.map(async set=>{
        const request=await fetch(`/api/catalog/set?id=${encodeURIComponent(set.id)}&v=9`);
        if(!request.ok)throw new Error("catalog_error");
        const data=(await request.json()) as SetResponse;
        return(data.cards??[]).flatMap(card=>printed.some(item=>cardNumber(card.localId)===item.number)?[{set,card,score:matchScore(text,set,card)+(set.id===currentSetId?8:0)}]:[]);
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
          const response=await fetch(`/api/catalog/card?id=${encodeURIComponent(item.card.id)}&v=9`);
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

  function choose(result:ScanResult){
    onLocated(result);
    setOpen(false);
    reset();
  }

  return <Dialog open={open} onOpenChange={value=>{setOpen(value);if(!value)reset()}}><DialogTrigger asChild><Button className="brand-button h-11 gap-2 whitespace-nowrap"><ScanLine className="h-5 w-5"/>Escanear carta</Button></DialogTrigger><DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5 text-violet-600"/>Localizar carta pela câmera</DialogTitle><DialogDescription>Fotografe a frente inteira da carta. O ReiCard lerá a numeração e buscará o álbum físico correto.</DialogDescription></DialogHeader>
    <div className="space-y-4">
      <input ref={inputRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={event=>{const file=event.target.files?.[0];if(file)void scan(file)}}/>
      {!preview?<button type="button" onClick={()=>inputRef.current?.click()} className="flex min-h-52 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-300 bg-gradient-to-br from-cyan-50 to-fuchsia-50 p-6 text-center"><span className="brand-button grid h-16 w-16 place-items-center rounded-full text-white shadow-lg"><Camera className="h-8 w-8"/></span><b className="mt-4 text-lg text-[#071a3d]">Abrir câmera</b><span className="mt-1 text-sm text-slate-500">Use boa iluminação e evite reflexos no plástico</span></button>:<div className="grid gap-4 sm:grid-cols-[180px_1fr]"><img src={preview} alt="Carta fotografada" className="mx-auto max-h-64 w-full rounded-xl bg-slate-100 object-contain"/><div className="flex min-h-36 flex-col justify-center rounded-xl bg-slate-50 p-4">{status&&<><div className="flex items-center gap-2 font-bold text-[#071a3d]">{results.length?<CheckCircle2 className="h-5 w-5 text-green-600"/>:<Loader2 className="h-5 w-5 animate-spin text-violet-600"/>}{status}</div>{!results.length&&<div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-600 transition-all" style={{width:`${Math.max(8,progress)}%`}}/></div>}</>}{error&&<p className="text-sm font-semibold leading-relaxed text-red-600">{error}</p>}<Button variant="outline" className="mt-4 gap-2" onClick={()=>inputRef.current?.click()}><ImagePlus className="h-4 w-4"/>Fotografar novamente</Button></div></div>}
      {results.length>0&&<div className="space-y-3"><p className="text-sm font-bold text-slate-600">Confira a carta e a cotação:</p>{results.map(result=>{const price=prices[result.card.id];const links=priceLinks(result);return <article key={`${result.set.id}-${result.card.id}`} className="rounded-xl border bg-white p-3 shadow-sm"><div className="flex items-center gap-3"><div className="h-24 w-16 shrink-0 overflow-hidden rounded bg-slate-100">{result.card.image?<img src={/\.(webp|png|jpe?g)$/i.test(result.card.image)?result.card.image:`${result.card.image}/low.webp`} alt="" className="h-full w-full object-contain"/>:<ScanLine className="m-auto mt-9 h-5 w-5 text-slate-400"/>}</div><div className="min-w-0 flex-1"><b className="block truncate text-[#071a3d]">{result.card.name}</b><span className="block truncate text-sm text-slate-500">{result.set.name}</span><span className="text-xs font-bold text-violet-600">Carta #{collectorNumber(result)}</span><div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2"><span className="block text-[10px] font-bold uppercase tracking-wide text-emerald-700">Valor médio estimado</span><b className="text-sm text-emerald-950">{price?.loading?"Consultando...":price?.value!==null&&price?.value!==undefined?new Intl.NumberFormat("pt-BR",{style:"currency",currency:price.currency??"BRL"}).format(price.value):"Sem cotação"}</b><span className="block text-[10px] text-emerald-700">{price?.source??"Consultando cotação..."}</span></div></div></div><div className="mt-3 grid grid-cols-3 gap-2"><button type="button" onClick={()=>choose(result)} className="brand-button rounded-lg px-2 py-2 text-xs font-bold text-white">Abrir no álbum</button><a href={links.liga} target="_blank" rel="noopener noreferrer" className="price-link flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-bold" aria-label={`Consultar ${links.query} na Liga Pokémon`}>Liga Pokémon<ExternalLink className="h-3 w-3"/></a><a href={links.tcgplayer} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 rounded-lg bg-slate-100 px-2 py-2 text-xs font-bold text-slate-700">TCGplayer<ExternalLink className="h-3 w-3"/></a></div></article>})}</div>}
      <p className="text-xs leading-relaxed text-slate-500">A fotografia é processada no seu aparelho para fazer a leitura e não é armazenada pelo ReiCard. A confirmação evita marcar uma edição parecida por engano.</p>
    </div>
  </DialogContent></Dialog>;
}
