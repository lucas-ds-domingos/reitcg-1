"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import type {ReactNode} from "react";
import {ArrowLeft,Check,ExternalLink,Grid2X2,LibraryBig,Loader2,LogIn,LogOut,Minus,Plus,Repeat2,Search,Settings,ShieldCheck,Sparkles,Trash2,UserPlus,Users} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Badge} from "@/components/ui/badge";
import {Progress} from "@/components/ui/progress";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {Checkbox} from "@/components/ui/checkbox";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from "@/components/ui/dialog";
import {AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle,AlertDialogTrigger} from "@/components/ui/alert-dialog";
import {CardScanner} from "@/components/card-scanner";
import {ShareCollection} from "@/components/share-collection";

type ApiCard={id:string;localId:string;name:string;image?:string};
type Card=ApiCard;
type CardSet={id:string;name:string;total:number;official:number;tcgOnline?:string;releaseDate?:string;digital?:boolean};
type ApiSet={id:string;name:string;cardCount?:{total?:number;official?:number};releaseDate?:string;digital?:boolean};
type ApiSetDetails={id?:string;name?:string;cardCount?:{total?:number;official?:number};tcgOnline?:string;releaseDate?:string;digital?:boolean;cards?:ApiCard[]};
type AgeGroup="child"|"teen"|"adult";
type Profile={id:string;username:string;displayName:string;email:string;ageGroup:AgeGroup|null;guardianConsent:number;guardianName:string|null;guardianEmail:string|null;termsAccepted:number;privacyAccepted:number;termsVersion:string|null;consentAcceptedAt:string|null};
type View="collections"|"pokemon"|"friends"|"trades"|"profile";
type Rates={USD:number;EUR:number};
type ProfileResponse={profile:Profile};
type CollectionItem={cardId:string;quantity:number};
type CollectionResponse={items?:CollectionItem[]};
type RateResponse={rate?:number|string};
type PricingVariant={marketPrice?:number;midPrice?:number};
type CardPricingResponse={image?:string;catalogLanguage?:string;pricing?:{tcgplayer?:Record<string,PricingVariant|null|undefined>;cardmarket?:{avg7?:number;avg?:number;trend?:number}}};
type Person={id:string;displayName:string;username:string};
type Relation=Person&{status:"pending"|"accepted"|string;requesterId:string};
type FriendsResponse={people?:Person[];relations?:Relation[];me?:string};
type TradeItem={userId:string;cardId:string;cardImage?:string|null;cardName:string;username:string;available:number};
type TradesResponse={items?:TradeItem[]};
type SharedListCard={cardId:string;name:string;number:string;image?:string;quantity:number;kind:"repeated"|"missing"};
type SharedList={id:string;setId:string;setName:string;shareType:"repeated"|"missing"|"both";createdAt:string;senderId:string;username:string;displayName:string;cards:SharedListCard[]};
type SharesResponse={shares?:SharedList[]};
type ProfileSaveResponse={profile?:Profile;error?:string};
type FriendAction="request"|"accept";
type FilterValue="all"|"owned"|"missing";
type ScanResult={set:CardSet;card:Card};

const FALLBACK_SETS:CardSet[]=[{id:"sv03.5",name:"Scarlet & Violet — 151",total:207,official:165},{id:"sv04",name:"Paradox Rift",total:266,official:182},{id:"sv03",name:"Obsidian Flames",total:230,official:197},{id:"sv02",name:"Paldea Evolved",total:279,official:193},{id:"sv01",name:"Scarlet & Violet",total:258,official:198}];
const FALLBACK:Card[]=Array.from({length:207},(_,i)=>{const n=String(i+1).padStart(3,"0");return{id:`sv03.5-${n}`,localId:n,name:["Bulbasaur","Ivysaur","Venusaur ex","Charmander","Charmeleon","Charizard ex","Squirtle","Wartortle","Blastoise ex","Caterpie","Metapod","Butterfree"][i]||`Carta ${n}`,image:`https://assets.tcgdex.net/en/sv/sv03.5/${n}/high.webp`}});
const FUTURE_COLLECTIONS=[{name:"Yu-Gi-Oh!",initial:"Y",tone:"from-amber-500 to-orange-700"},{name:"One Piece Card Game",initial:"O",tone:"from-sky-500 to-blue-800"},{name:"Magic: The Gathering",initial:"M",tone:"from-violet-500 to-indigo-800"}];
const SIGN_IN="/entrar";

export default function Home(){
  const[view,setView]=useState<View>("collections"),[setId,setSetId]=useState("sv03.5"),[sets,setSets]=useState<CardSet[]>(FALLBACK_SETS),[cards,setCards]=useState<Card[]>([]);
  const[quantities,setQuantities]=useState<Record<string,number>>({}),[query,setQuery]=useState(""),[filter,setFilter]=useState<FilterValue>("all"),[loading,setLoading]=useState(true);
  const[profile,setProfile]=useState<Profile|null>(null),[authChecked,setAuthChecked]=useState(false),[rates,setRates]=useState<Rates>({USD:0,EUR:0});
  const[pendingScan,setPendingScan]=useState<{setId:string;cardName:string}|null>(null);
  const set=sets.find(s=>s.id===setId) ?? FALLBACK_SETS[0]!;

  useEffect(()=>{
    let local:Record<string,number>={};
    try{
      const saved=localStorage.getItem("reicard-quantities");
      if(saved)local=JSON.parse(saved) as Record<string,number>;
      else {
        const owned=JSON.parse(localStorage.getItem("reicard-owned")||localStorage.getItem("dexcard-owned")||"[]") as string[];
        for(const id of owned)local[id]=1;
      }
      setQuantities(local);
    }catch{}
    void (async()=>{
      for(let attempt=0;attempt<3;attempt++){
        try{
          const response=await fetch("/api/catalog/sets?v=9");
          if(!response.ok)throw new Error("catalog_error");
          const data=(await response.json()) as ApiSet[];
          const catalog=data.map(set=>({id:set.id,name:set.name,total:set.cardCount?.total??0,official:set.cardCount?.official??0,releaseDate:set.releaseDate,digital:set.digital})).filter(set=>set.id&&set.name).sort((a,b)=>(b.releaseDate||"").localeCompare(a.releaseDate||""));
          if(!catalog.length)throw new Error("empty_catalog");
          setSets(catalog);
          localStorage.setItem("reicard-catalog-sets-v9",JSON.stringify(catalog));
          return;
        }catch(error){if(attempt===2)console.error("Erro ao carregar coleções:",error)}
      }
      try{const cached=JSON.parse(localStorage.getItem("reicard-catalog-sets-v9")||"[]") as CardSet[];if(cached.length)setSets(cached)}catch{}
    })();
    fetch("/api/profile",{credentials:"include"}).then(async r=>{
      if(!r.ok)return null;
      const data=(await r.json()) as ProfileResponse;
      if(!data.profile)return null;
      setProfile(data.profile);
      sessionStorage.removeItem("reicard-profile-cache");
      const collection=await fetch("/api/collection",{credentials:"include"}).then(async x=>x.ok?(await x.json()) as CollectionResponse:null);
      const items=collection?.items ?? [];
      if(items.length)setQuantities(prev=>{const next={...prev};for(const item of items)next[item.cardId]=item.quantity;localStorage.setItem("reicard-quantities",JSON.stringify(next));return next});
    }).catch(error=>{
      console.error("Erro ao carregar perfil:", error);
      const cached=sessionStorage.getItem("reicard-profile-cache");
      if(cached){
        try{setProfile(JSON.parse(cached))}catch{}
      }
    }).finally(()=>setAuthChecked(true));
    Promise.all([
      fetch("https://api.frankfurter.dev/v2/rate/USD/BRL?providers=BCB").then(async r=>(await r.json()) as RateResponse).then(d=>Number(d.rate)||0),
      fetch("https://api.frankfurter.dev/v2/rate/EUR/BRL?providers=BCB").then(async r=>(await r.json()) as RateResponse).then(d=>Number(d.rate)||0),
    ]).then(([USD,EUR])=>setRates({USD,EUR})).catch(()=>{});
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    let active=true;
    const timeoutId=window.setTimeout(()=>controller.abort(),20_000);
    const scanned=pendingScan?.setId===setId?pendingScan:null;
    const cacheKey=`reicard-catalog-set-${setId}-v9`;
    setQuery(scanned?.cardName??"");
    setCards([]);
    setLoading(true);

    async function loadSet(){
      for(let attempt=0;attempt<3;attempt++){
        try{
          const response=await fetch(`/api/catalog/set?id=${encodeURIComponent(setId)}&v=9`,{signal:controller.signal});
          if(!response.ok)throw new Error("catalog_error");
          const data=(await response.json()) as ApiSetDetails;
          const normalized=(data.cards??[]).map(card=>({...card,image:card.image?/\.(webp|png|jpe?g)$/i.test(card.image)?card.image:`${card.image}/low.webp`:undefined})).sort((a,b)=>a.localId.localeCompare(b.localId,undefined,{numeric:true,sensitivity:"base"}));
          if(!normalized.length)throw new Error("empty_catalog");
          if(controller.signal.aborted)return;
          const metadata:CardSet={id:setId,name:data.name??setId,total:data.cardCount?.total??normalized.length,official:data.cardCount?.official??0,tcgOnline:data.tcgOnline,releaseDate:data.releaseDate,digital:data.digital};
          setCards(normalized);
          setSets(previous=>previous.map(item=>item.id===setId?{...item,...metadata}:item));
          if(scanned){setQuery(scanned.cardName);setFilter("all");setPendingScan(null)}
          localStorage.setItem(cacheKey,JSON.stringify({metadata,cards:normalized}));
          return;
        }catch(error){
          if(controller.signal.aborted)return;
          if(attempt===2)console.error(`Erro ao carregar o álbum ${setId}:`,error);
        }
      }
      try{
        const cached=JSON.parse(localStorage.getItem(cacheKey)||"null") as {metadata:CardSet;cards:Card[]}|null;
        if(cached?.cards.length&&!controller.signal.aborted){setCards(cached.cards);setSets(previous=>previous.map(item=>item.id===setId?{...item,...cached.metadata}:item));return}
      }catch{}
      if(!controller.signal.aborted)setCards(setId==="sv03.5"?FALLBACK.map(card=>({...card,image:card.image?.replace("high.webp","low.webp")})):[]);
    }

    void loadSet().finally(()=>{if(active)setLoading(false)});
    return()=>{active=false;window.clearTimeout(timeoutId);controller.abort()};
  },[setId]);

  function changeQuantity(card:Card,quantity:number){
    const qty=Math.max(0,Math.min(99,quantity));
    setQuantities(prev=>{const next={...prev};if(qty)next[card.id]=qty;else delete next[card.id];localStorage.setItem("reicard-quantities",JSON.stringify(next));return next});
    if(profile)fetch("/api/collection",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cardId:card.id,setId,cardName:card.name,cardImage:card.image,quantity:qty}),credentials:"include"}).catch(()=>{});
  }
  function locateScan(result:ScanResult){
    if(result.set.id===setId){setQuery(result.card.name);setFilter("all");return}
    setPendingScan({setId:result.set.id,cardName:result.card.name});
    setSetId(result.set.id);
  }
  const inSet=cards.filter(c=>(quantities[c.id]||0)>0).length;
  const shown=useMemo(()=>cards.filter(c=>(c.name.toLowerCase().includes(query.toLowerCase())||c.localId.includes(query))&&(filter==="all"||(filter==="owned"?(quantities[c.id]||0)>0:(quantities[c.id]||0)===0))),[cards,query,filter,quantities]);
  const uniqueOwned=Object.values(quantities).filter(q=>q>0).length;
  const repeats=Object.values(quantities).reduce((sum,q)=>sum+Math.max(0,q-1),0);

  // A sessão autenticada basta para acessar o catálogo. Dados de perfil são
  // opcionais e só devem ser editados quando a pessoa abrir "Meu perfil".
  return <main className="brand-shell min-h-screen text-[#071a3d]">
    <AppHeader profile={profile} authChecked={authChecked} onNavigate={setView}/>
    {view==="collections"?<CollectionsHome setCount={sets.length} ownedCount={uniqueOwned} repeats={repeats} onOpenPokemon={()=>setView("pokemon")} onFriends={()=>setView("friends")} onTrades={()=>setView("trades")}/>
    :view==="pokemon"?<PokemonAlbum loggedIn={Boolean(profile)} set={set} sets={sets} setId={setId} setSetId={setSetId} cards={cards} shown={shown} quantities={quantities} inSet={inSet} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} loading={loading} changeQuantity={changeQuantity} rates={rates} onScanLocated={locateScan} onBack={()=>setView("collections")} onFriends={()=>setView("friends")} onTrades={()=>setView("trades")}/>
    :view==="friends"?<FriendsHub profile={profile} onProfile={setProfile} onBack={()=>setView("collections")}/>
    :view==="trades"?<TradesHub profile={profile} onBack={()=>setView("collections")}/>
    :profile?<ProfileSetup profile={profile} onSaved={setProfile} onBack={()=>setView("collections")}/>:<SignInCard title="Entre no ReiCard" text="Crie seu perfil para salvar sua coleção em todos os aparelhos." onBack={()=>setView("collections")}/>}
  </main>;
}

function AppHeader({profile,authChecked,onNavigate}:{profile:Profile|null;authChecked:boolean;onNavigate:(view:View)=>void}){
  return <header className="brand-header sticky top-0 z-30 border-b bg-white/95 backdrop-blur"><div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-7">
    <button className="flex items-center gap-3 text-left" onClick={()=>onNavigate("collections")} aria-label="Ir para minhas coleções"><img src="/reicard-logo.png" alt="ReiCard" className="h-11 w-auto max-w-[154px] object-contain sm:h-12 sm:max-w-[188px]"/><span className="hidden border-l border-slate-200 pl-3 text-xs leading-tight text-slate-500 md:block">Seu mundo de cartas<br/>em um só lugar.</span></button>
    <div className="flex items-center gap-2"><button className="hidden rounded-full px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 sm:block" onClick={()=>onNavigate("friends")}>Amigos</button><button className="hidden rounded-full px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 sm:block" onClick={()=>onNavigate("trades")}>Trocas</button>
      {!authChecked?<Loader2 className="h-5 w-5 animate-spin text-slate-400"/>:profile?<button onClick={()=>onNavigate("profile")} className="flex items-center gap-2 rounded-full bg-slate-100 p-1 pr-3" aria-label="Abrir meu perfil"><span className="brand-avatar grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white">{(profile.displayName||"U").slice(0,2).toUpperCase()}</span><span className="hidden max-w-24 truncate text-sm font-semibold sm:block">{profile.displayName||"Usuário"}</span><Settings className="h-4 w-4 text-slate-500"/></button>:<a href={SIGN_IN} target="_top" className="brand-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white"><LogIn className="h-4 w-4"/><span className="hidden sm:inline">Entrar ou criar conta</span><span className="sm:hidden">Entrar</span></a>}
    </div>
  </div></header>;
}

function CollectionsHome({setCount,ownedCount,repeats,onOpenPokemon,onFriends,onTrades}:{setCount:number;ownedCount:number;repeats:number;onOpenPokemon:()=>void;onFriends:()=>void;onTrades:()=>void}){
  return <section className="mx-auto max-w-[1180px] px-4 py-8 sm:px-7 sm:py-12">
    <div className="dashboard-intro mb-6"><div><p className="text-sm font-black uppercase tracking-[.2em] text-cyan-300">REICARD</p><h1 className="mt-1 text-3xl font-black text-white sm:text-4xl">Minhas coleções</h1><p className="mt-2 max-w-xl text-base text-blue-100">Escolha seu universo de cartas, complete os álbuns e descubra o que ainda falta.</p></div><div className="intro-stats"><span><strong>{ownedCount}</strong><small>cartas</small></span><span><strong>{repeats}</strong><small>repetidas</small></span><span><strong>{setCount}</strong><small>álbuns</small></span></div></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-2"><button onClick={onFriends} className="social-shortcut friends-shortcut"><span className="social-icon"><Users/></span><span><b>Meus amigos</b><small>Encontre colecionadores e aceite solicitações</small></span><span className="shortcut-arrow">→</span></button><button onClick={onTrades} className="social-shortcut trades-shortcut"><span className="social-icon"><Repeat2/></span><span><b>Trocas e listas compartilhadas</b><small>{repeats} repetida{repeats===1?"":"s"} na sua coleção</small></span><span className="shortcut-arrow">→</span></button></div>
    <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]"><button onClick={onOpenPokemon} className="collection-feature group text-left" aria-label="Abrir coleção Pokémon"><div className="relative z-10 flex h-full min-h-[310px] flex-col justify-between p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><Badge className="bg-white/15 text-white hover:bg-white/20">Disponível</Badge><div className="pokemon-cards" aria-hidden="true">{["004","006","007"].map((n,i)=><img key={n} src={`https://assets.tcgdex.net/en/sv/sv03.5/${n}/low.webp`} alt="" style={{transform:`rotate(${(i-1)*7}deg) translateX(${(i-1)*8}px)`}}/>)}</div></div><div className="relative z-10 max-w-md"><p className="text-sm font-bold uppercase tracking-widest text-cyan-300">Pokémon</p><h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">Minha coleção Pokémon</h2><p className="mt-2 text-base text-slate-200">Veja todos os álbuns, valores e marque quantas cartas você possui.</p><div className="mt-5 flex flex-wrap items-center gap-3"><span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#071a3d] transition group-hover:scale-105">Abrir coleção</span><span className="text-sm font-semibold text-white/80">{setCount} álbuns · {ownedCount} cartas</span></div></div></div></button>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">{FUTURE_COLLECTIONS.map(item=><article key={item.name} className="future-card flex min-h-28 items-center gap-4 rounded-2xl p-4"><div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${item.tone} text-xl font-black text-white shadow-md`}>{item.initial}</div><div><h2 className="font-bold leading-tight">{item.name}</h2><p className="mt-1 text-sm font-semibold text-violet-500">Em breve</p></div></article>)}</div></div>
    <div className="mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-cyan-300 bg-white/70 p-4 text-slate-500"><Sparkles className="h-5 w-5 shrink-0 text-fuchsia-600"/><p className="text-sm"><b className="text-slate-700">ReiCard cresce com você.</b> Novos tipos de coleção poderão ser adicionados nesta página.</p></div><Footer/>
  </section>;
}

type AlbumProps={loggedIn:boolean;set:CardSet;sets:CardSet[];setId:string;setSetId:(id:string)=>void;cards:Card[];shown:Card[];quantities:Record<string,number>;inSet:number;query:string;setQuery:(value:string)=>void;filter:FilterValue;setFilter:(value:FilterValue)=>void;loading:boolean;changeQuantity:(card:Card,quantity:number)=>void;rates:Rates;onScanLocated:(result:ScanResult)=>void;onBack:()=>void;onFriends:()=>void;onTrades:()=>void};
function PokemonAlbum({loggedIn,set,sets,setId,setSetId,cards,shown,quantities,inSet,query,setQuery,filter,setFilter,loading,changeQuantity,rates,onScanLocated,onBack,onFriends,onTrades}:AlbumProps){
  return <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[220px_1fr]"><aside className="hidden min-h-[calc(100vh-64px)] border-r bg-white/90 p-5 lg:block"><nav className="space-y-1"><button className="nav w-full" onClick={onBack}><Grid2X2/>Coleções</button><span className="nav active"><LibraryBig/>Álbuns Pokémon</span><button className="nav w-full" onClick={onFriends}><Users/>Amigos</button><button className="nav w-full" onClick={onTrades}><Repeat2/>Trocas</button></nav><div className="brand-panel mt-8 rounded-2xl p-5 text-white"><p className="text-sm text-cyan-100">Álbum selecionado</p><p className="mt-1 font-bold">{set.name}</p><Progress value={set.total?inSet/set.total*100:0} className="mt-4 h-2"/><p className="mt-2 text-sm">{inSet} de {cards.length||set.total} cartas</p></div></aside>
    <section className="min-w-0 p-4 sm:p-7"><button onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#071a3d] lg:hidden"><ArrowLeft className="h-4 w-4"/>Minhas coleções</button><div className="mb-5"><p className="brand-kicker text-sm font-black uppercase tracking-[.16em]">POKÉMON</p><h1 className="mt-1 text-3xl font-black">Escolha e marque suas cartas</h1><p className="mt-1 text-slate-500">Use + e − para informar a quantidade. A partir de 2, a carta aparece para troca.</p></div>
      <div className="album-toolbar mb-5 grid gap-3 rounded-2xl p-4 md:grid-cols-[1fr_1fr_auto] xl:grid-cols-[1fr_1fr_auto_auto] 2xl:grid-cols-[1fr_1fr_auto_auto_auto]"><Select value={setId} onValueChange={setSetId}><SelectTrigger className="h-11 bg-white"><SelectValue/></SelectTrigger><SelectContent>{sets.map(s=><SelectItem key={s.id} value={s.id}>{s.name} · {s.total} cartas</SelectItem>)}</SelectContent></Select><div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-violet-500"/><Input className="h-11 bg-white pl-9" placeholder="Nome, número ou consulte o preço" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="flex rounded-lg bg-white/75 p-1">{([["all","Todas"],["owned","Tenho"],["missing","Faltam"]] as const).map(([v,l])=><Button key={v} size="sm" variant={filter===v?"default":"ghost"} onClick={()=>setFilter(v)}>{l}</Button>)}</div><CardScanner sets={sets} currentSetId={setId} rates={rates} onLocated={onScanLocated}/><ShareCollection loggedIn={loggedIn} set={set} cards={cards} quantities={quantities}/></div>
      <div className="mb-5 flex items-center justify-between"><div><b>{set.name}</b><span className="ml-2 text-sm text-slate-500">{shown.length} exibidas</span></div><Badge className="bg-green-100 text-green-800 hover:bg-green-100">{inSet}/{cards.length||set.total} tenho</Badge></div>
      {loading?<Loading/>:cards.length===0?<div className="rounded-2xl border bg-white p-12 text-center">Esta coleção ainda não pôde ser carregada.</div>:<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">{shown.map(c=><CardTile key={c.id} card={c} cardSet={set} quantity={quantities[c.id]||0} setQuantity={q=>changeQuantity(c,q)} rates={rates}/>)}</div>}<Footer/>
    </section>
  </div>;
}

function CardTile({card,cardSet,quantity,setQuantity,rates}:{card:Card;cardSet:CardSet;quantity:number;setQuantity:(q:number)=>void;rates:Rates}){
  const[resolvedImage,setResolvedImage]=useState(card.image),[bad,setBad]=useState(false),[price,setPrice]=useState<number|null|undefined>(undefined),[source,setSource]=useState(""),[priceError,setPriceError]=useState(false);
  const ref=useRef<HTMLElement|null>(null);
  useEffect(()=>{setResolvedImage(card.image);setBad(false)},[card.id,card.image]);
  useEffect(()=>{if(cardSet.digital){setPrice(null);setSource("Pokémon TCG Pocket · não possui cotação física");return}const node=ref.current;if(!node)return;const observer=new IntersectionObserver(entries=>{const entry=entries[0];if(!entry?.isIntersecting)return;observer.disconnect();fetch(`/api/catalog/card?id=${encodeURIComponent(card.id)}&v=9`).then(async r=>{if(!r.ok)throw new Error("Não foi possível carregar a cotação");return (await r.json()) as CardPricingResponse}).then(d=>{if(!resolvedImage&&d.image)setResolvedImage(/\.(webp|png|jpe?g)$/i.test(d.image)?d.image:`${d.image}/low.webp`);const tcg=d.pricing?.tcgplayer;const usdValues=tcg?Object.values(tcg).flatMap(v=>{const value=v?.marketPrice??v?.midPrice;return typeof value==="number"&&value>0?[value]:[]}):[];const usdPrice=usdValues.length?usdValues.reduce((sum,value)=>sum+value,0)/usdValues.length:undefined;if(usdPrice!==undefined&&(rates.USD||1)){setPrice(usdPrice*(rates.USD||1));setSource(`TCGplayer · média de ${usdValues.length} ${usdValues.length===1?"versão":"versões"}`)}else{const market=d.pricing?.cardmarket;const eurPrice=market?.avg7??market?.avg??market?.trend;if(eurPrice!==undefined&&(rates.EUR||1)){setPrice(eurPrice*(rates.EUR||1));setSource("Cardmarket · média disponível")}else{setPrice(null);setSource("Não listada nos mercados integrados")}}}).catch(()=>{setPrice(null);setPriceError(true);setSource("Falha temporária na consulta")})},{rootMargin:"240px"});observer.observe(node);return()=>observer.disconnect()},[card.id,cardSet.digital,rates,resolvedImage]);
  const has=quantity>0;
  const numericLocalId=/^\d+$/.test(card.localId);
  const numberWidth=Math.max(3,card.localId.length,String(cardSet.official).length);
  const collectorNumber=numericLocalId&&cardSet.official>0?`${card.localId.padStart(numberWidth,"0")}/${String(cardSet.official).padStart(numberWidth,"0")}`:card.localId;
  const ligaQuery=`${card.name} (${collectorNumber})`;
  const ligaUrl=cardSet.tcgOnline?`https://www.ligapokemon.com.br/?view=cards%2Fcard&card=${encodeURIComponent(ligaQuery)}&ed=${encodeURIComponent(cardSet.tcgOnline)}&num=${encodeURIComponent(card.localId)}`:`https://www.ligapokemon.com.br/?view=cards%2Fsearch&card=${encodeURIComponent(`${card.name} ${collectorNumber}`)}&tipo=1`;
  return <article ref={ref} className={`card-tile overflow-hidden rounded-2xl bg-white ${has?"is-owned":""}`}><button className="relative block w-full bg-gradient-to-br from-cyan-50 via-violet-50 to-fuchsia-50" onClick={()=>setQuantity(quantity===0?1:quantity===1?0:quantity)} aria-label={`${has?"Desmarcar":"Marcar"} ${card.name}`}><div className="aspect-[2.5/3.5] p-1.5">{resolvedImage&&!bad?<img src={resolvedImage} onError={async e=>{const img=e.currentTarget;if(img.src.includes("/low.webp")){img.src=img.src.replace("/low.webp","/high.webp");return}try{const response=await fetch(`/api/catalog/card?id=${encodeURIComponent(card.id)}&alternate=1`);const data=(await response.json()) as CardPricingResponse;if(response.ok&&data.image){setResolvedImage(/\.(webp|png|jpe?g)$/i.test(data.image)?data.image:`${data.image}/low.webp`);return}}catch{}setBad(true)}} alt={`${card.localId} — ${card.name}`} loading="lazy" decoding="async" className={`h-full w-full rounded-lg object-contain ${has?"":"grayscale-[25%] opacity-80"}`}/>:<div className="grid h-full place-items-center rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 p-3 text-center font-bold text-slate-500">Imagem indisponível<br/>{card.name}</div>}</div><span className={`absolute right-2 top-2 grid h-8 min-w-8 place-items-center rounded-full border-2 px-1 text-sm font-black shadow ${has?"owned-badge border-cyan-300 text-white":"border-white bg-white/90 text-slate-400"}`}>{has?quantity:<Check className="h-5 w-5"/>}</span>{quantity>1&&<Badge className="absolute bottom-2 left-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-500 hover:to-orange-500">{quantity-1} para troca</Badge>}</button>
    <div className="p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="truncate text-sm font-bold">{card.name}</h2><p className="text-xs text-slate-500">#{collectorNumber}</p></div><span className={`whitespace-nowrap text-xs font-bold ${has?"text-green-700":"text-slate-400"}`}>{has?"TENHO":"FALTA"}</span></div>
      <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-100 p-1"><button onClick={()=>setQuantity(quantity-1)} className="grid h-8 w-8 place-items-center rounded-md bg-white shadow-sm" aria-label="Diminuir quantidade"><Minus className="h-4 w-4"/></button><span className="text-sm font-black">{quantity}</span><button onClick={()=>setQuantity(quantity+1)} className="brand-button grid h-8 w-8 place-items-center rounded-md text-white shadow-sm" aria-label="Aumentar quantidade"><Plus className="h-4 w-4"/></button></div>
      <div className="mt-2 rounded-lg border border-slate-200 px-3 py-2"><p className="text-[11px] font-semibold text-slate-400">{cardSet.digital?"TIPO DE COLEÇÃO":"VALOR MÉDIO ESTIMADO"}</p><p className="text-sm font-black text-[#071a3d]">{cardSet.digital?"Sem cotação física":price===undefined?"Carregando...":price===null?(priceError?"Consulta indisponível":"Sem cotação"):new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(price)}</p>{source&&<p className="text-[10px] text-slate-400">{source}{price!==null&&!cardSet.digital&&" · convertido para R$"}</p>}</div>
      {cardSet.digital?<div className="mt-2 rounded-lg bg-violet-50 px-3 py-2 text-center text-[11px] font-bold text-violet-700">Pokémon TCG Pocket</div>:<div className="mt-2 grid grid-cols-2 gap-2"><a href={ligaUrl} target="_blank" rel="noopener noreferrer" className="price-link flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-bold" aria-label={`Consultar ${ligaQuery} na Liga Pokémon`}>{cardSet.tcgOnline?"Ver na Liga":"Pesquisar na Liga"}<ExternalLink className="h-3 w-3"/></a><a href={`https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(card.name+" "+collectorNumber+" "+cardSet.name)}&view=grid`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 rounded-lg bg-slate-100 px-2 py-2 text-[11px] font-bold text-slate-700">TCGplayer<ExternalLink className="h-3 w-3"/></a></div>}
    </div></article>;
}

function FriendsHub({profile,onProfile,onBack}:{profile:Profile|null;onProfile:(p:Profile)=>void;onBack:()=>void}){
  const[q,setQ]=useState(""),[people,setPeople]=useState<Person[]>([]),[relations,setRelations]=useState<Relation[]>([]),[me,setMe]=useState(""),[loading,setLoading]=useState(false);
  const load=async(search="")=>{setLoading(true);const r=await fetch(`/api/friends?q=${encodeURIComponent(search)}`,{credentials:"include"});if(r.ok){const d=(await r.json()) as FriendsResponse;setPeople(d.people||[]);setRelations(d.relations||[]);setMe(d.me||"")}setLoading(false)};
  useEffect(()=>{if(profile?.ageGroup&&["child","teen","adult"].includes(profile.ageGroup as string))load()},[profile?.ageGroup]);
  const act=async(action:FriendAction,userId:string)=>{await fetch("/api/friends",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,userId}),credentials:"include"});await load(q)};
  if(!profile)return <SignInCard title="Entre para encontrar amigos" text="O álbum continua funcionando sem login, mas amizades e trocas ficam salvas na sua conta." onBack={onBack}/>;
  if(!profile.ageGroup||!["child","teen","adult"].includes(profile.ageGroup as string))return <ProfileSetup profile={profile} onSaved={onProfile} onBack={onBack}/>;
  const relationFor=(id:string)=>relations.find(r=>r.id===id);
  return <SimplePage title="Meus amigos" subtitle="Procure pelo apelido ReiCard. A amizade só começa depois que a outra pessoa aceitar." onBack={onBack}><div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex gap-2"><Input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load(q)} placeholder="Apelido do amigo"/><Button onClick={()=>load(q)}><Search className="mr-2 h-4 w-4"/>Buscar</Button></div>{loading&&<p className="mt-4 text-sm text-slate-500">Procurando...</p>}{people.length>0&&<div className="mt-4 space-y-2">{people.map(p=>{const rel=relationFor(p.id);return <PersonRow key={p.id} person={p} action={rel?rel.status==="pending"&&rel.requesterId!==me?()=>act("accept",p.id):undefined:()=>act("request",p.id)} label={rel?rel.status==="accepted"?"Amigo":rel.requesterId===me?"Solicitação enviada":"Aceitar":"Adicionar amigo"}/>})}</div>}</div>
    <h2 className="mt-7 mb-3 text-xl font-black">Amigos e solicitações</h2><div className="space-y-2">{relations.length===0?<Empty text="Você ainda não adicionou amigos."/>:relations.map(r=><PersonRow key={r.id} person={r} action={r.status==="pending"&&r.requesterId!==me?()=>act("accept",r.id):undefined} label={r.status==="accepted"?"Amigo":r.requesterId===me?"Aguardando resposta":"Aceitar"}/>)}</div></SimplePage>;
}

function TradesHub({profile,onBack}:{profile:Profile|null;onBack:()=>void}){
  const[items,setItems]=useState<TradeItem[]>([]),[shares,setShares]=useState<SharedList[]>([]),[loading,setLoading]=useState(true);
  useEffect(()=>{if(profile)Promise.all([fetch("/api/trades",{credentials:"include"}).then(async r=>r.ok?(await r.json()) as TradesResponse:null),fetch("/api/shares",{credentials:"include"}).then(async r=>r.ok?(await r.json()) as SharesResponse:null)]).then(([trades,shared])=>{setItems(trades?.items||[]);setShares(shared?.shares||[])}).finally(()=>setLoading(false));else setLoading(false)},[profile]);
  if(!profile)return <SignInCard title="Entre para ver as trocas" text="Somente amigos aceitos podem ver quais cartas estão repetidas." onBack={onBack}/>;
  return <SimplePage title="Trocas e listas" subtitle="Veja as listas que seus amigos compartilharam e as cartas repetidas disponíveis." onBack={onBack}>{loading?<Loading/>:<><h2 className="mb-3 text-xl font-black">Listas compartilhadas comigo</h2>{shares.length===0?<Empty text="Nenhum amigo compartilhou uma lista com você ainda."/>:<div className="space-y-3">{shares.map(share=>{const repeated=share.cards.filter(card=>card.kind==="repeated");const missing=share.cards.filter(card=>card.kind==="missing");return <details key={share.id} className="group rounded-2xl border bg-white shadow-sm"><summary className="flex cursor-pointer list-none items-center gap-3 p-4"><span className="brand-avatar grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-black text-white">{(share.displayName||"U").slice(0,2).toUpperCase()}</span><span className="min-w-0 flex-1"><b className="block truncate">{share.displayName||"Usuário"} compartilhou {share.shareType==="repeated"?"repetidas":share.shareType==="missing"?"faltantes":"repetidas e faltantes"}</b><span className="block truncate text-sm text-slate-500">{share.setName} · {share.cards.length} cartas · @{share.username}</span></span><span className="text-xl text-violet-500 transition group-open:rotate-90">›</span></summary><div className="border-t p-4">{repeated.length>0&&<SharedCards title={`Repetidas (${repeated.length})`} cards={repeated}/>} {missing.length>0&&<SharedCards title={`Faltantes (${missing.length})`} cards={missing}/>}</div></details>})}</div>}<h2 className="mb-3 mt-8 text-xl font-black">Repetidas dos meus amigos</h2>{items.length===0?<Empty text="Nenhum amigo tem cartas repetidas disponíveis agora."/>:<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{items.map((item,i)=><article key={item.userId+item.cardId+i} className="overflow-hidden rounded-2xl border bg-white shadow-sm">{item.cardImage?<img src={item.cardImage} alt={item.cardName} className="aspect-[2.5/3.5] w-full bg-slate-100 object-contain"/>:<div className="grid aspect-[2.5/3.5] place-items-center bg-slate-100 p-3 text-center">{item.cardName}</div>}<div className="p-3"><b className="block truncate text-sm">{item.cardName}</b><p className="mt-1 text-xs text-slate-500">@{item.username}</p><Badge className="mt-2 bg-amber-100 text-amber-800 hover:bg-amber-100">{item.available} para troca</Badge></div></article>)}</div>}</>}</SimplePage>;
}

function SharedCards({title,cards}:{title:string;cards:SharedListCard[]}){return <div className="mb-4 last:mb-0"><h3 className="mb-2 text-sm font-black text-slate-700">{title}</h3><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{cards.map(card=><div key={`${card.kind}-${card.cardId}`} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2">{card.image?<img src={/\.(webp|png|jpe?g)$/i.test(card.image)?card.image:`${card.image}/low.webp`} alt="" className="h-14 w-10 rounded object-contain"/>:<span className="grid h-14 w-10 place-items-center rounded bg-slate-200 text-xs">?</span>}<span className="min-w-0"><b className="block truncate text-sm">{card.name}</b><span className="text-xs text-slate-500">#{card.number}{card.kind==="repeated"?` · ${card.quantity} ${card.quantity===1?"disponível":"disponíveis"}`:""}</span></span></div>)}</div></div>}

function ProfileSetup({profile,onSaved,onBack}:{profile:Profile;onSaved:(p:Profile)=>void;onBack:()=>void}){
  const existing=Boolean(profile.ageGroup&&["child","teen","adult"].includes(profile.ageGroup as string));
  const[username,setUsername]=useState(profile.username),[displayName,setDisplayName]=useState(profile.displayName),[ageGroup,setAgeGroup]=useState<AgeGroup|"">(profile.ageGroup||""),[guardianName,setGuardianName]=useState(profile.guardianName||""),[guardianEmail,setGuardianEmail]=useState(profile.guardianEmail||""),[consent,setConsent]=useState(Boolean(profile.guardianConsent)),[termsAccepted,setTermsAccepted]=useState(Boolean(profile.termsAccepted)),[privacyAccepted,setPrivacyAccepted]=useState(Boolean(profile.privacyAccepted)),[error,setError]=useState(""),[saved,setSaved]=useState(false);
  const save=async()=>{setError("");setSaved(false);const r=await fetch("/api/profile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,displayName,ageGroup,guardianConsent:consent,guardianName,guardianEmail,termsAccepted,privacyAccepted}),credentials:"include"});const d=(await r.json()) as ProfileSaveResponse;if(r.ok&&d.profile){onSaved(d.profile);setSaved(true)}else setError(d.error==="username_unavailable"?"Esse apelido já está sendo usado.":d.error==="legal_acceptance_required"?"Leia e aceite os Termos de Uso e a Política de Privacidade para continuar.":"Confira os dados e a autorização do responsável.")};
  const ready=Boolean(ageGroup&&termsAccepted&&privacyAccepted&&(ageGroup==="adult"||(consent&&guardianName.trim().length>=3&&/^\S+@\S+\.\S+$/.test(guardianEmail))));
  const logout=async()=>{await fetch("/api/auth/logout",{method:"POST",credentials:"include"});window.location.href="/"};
  const remove=async()=>{const r=await fetch("/api/profile",{method:"DELETE",credentials:"include"});if(r.ok){localStorage.removeItem("reicard-quantities");localStorage.removeItem("reicard-owned");localStorage.removeItem("dexcard-owned");window.location.href="/"}};
  return <SimplePage title={existing?"Meu perfil":"Crie seu perfil ReiCard"} subtitle={existing?"Atualize seus dados e preferências de segurança.":"Complete o cadastro para salvar sua coleção e encontrar amigos."} onBack={onBack}><div className="mx-auto max-w-xl space-y-4 rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center gap-3 rounded-xl bg-cyan-50 p-3 text-sm text-cyan-900"><ShieldCheck className="h-5 w-5 shrink-0"/><span>Conta protegida: <b>{profile.email}</b></span></div><label className="block text-sm font-bold">Nome que aparecerá para os amigos<Input className="mt-2" value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label><label className="block text-sm font-bold">Apelido único<Input className="mt-2" value={username} onChange={e=>setUsername(e.target.value)} placeholder="ex.: fabiocards"/></label><label className="block text-sm font-bold">Faixa etária<Select value={ageGroup} onValueChange={value=>setAgeGroup(value as AgeGroup)}><SelectTrigger className="mt-2"><SelectValue placeholder="Escolha uma opção"/></SelectTrigger><SelectContent><SelectItem value="child">Menor de 13 anos</SelectItem><SelectItem value="teen">13 a 17 anos</SelectItem><SelectItem value="adult">18 anos ou mais</SelectItem></SelectContent></Select></label>{ageGroup&&ageGroup!=="adult"&&<div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-black text-amber-950">Dados do responsável legal</p><label className="block text-sm font-bold">Nome completo<Input className="mt-2 bg-white" value={guardianName} onChange={e=>setGuardianName(e.target.value)}/></label><label className="block text-sm font-bold">E-mail do responsável<Input className="mt-2 bg-white" type="email" value={guardianEmail} onChange={e=>setGuardianEmail(e.target.value)}/></label><label className="flex items-start gap-3 text-sm"><Checkbox className="mt-0.5" checked={consent} onCheckedChange={v=>setConsent(v===true)}/><span>Confirmo que sou o responsável legal e autorizo este perfil, o registro da coleção e as funções de amizade e troca.</span></label></div>}
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-black text-slate-800">Ciência e proteção dos dados</p><label className="flex items-start gap-3 text-sm"><Checkbox className="mt-0.5" checked={termsAccepted} onCheckedChange={v=>setTermsAccepted(v===true)}/><span>Li e aceito os <LegalDocument type="terms"/>.</span></label><label className="flex items-start gap-3 text-sm"><Checkbox className="mt-0.5" checked={privacyAccepted} onCheckedChange={v=>setPrivacyAccepted(v===true)}/><span>Li e estou ciente da <LegalDocument type="privacy"/> e do tratamento dos dados conforme a LGPD.</span></label><p className="text-xs leading-relaxed text-slate-500">Registraremos a versão aceita, a data e o horário. Autorizações opcionais, como publicidade, serão solicitadas separadamente.</p></div>
    {error&&<p className="text-sm font-bold text-red-600">{error}</p>}{saved&&<p className="text-sm font-bold text-green-700">Perfil atualizado com sucesso.</p>}<Button className="brand-button w-full" onClick={save} disabled={!ready}>{existing?"Salvar alterações":"Criar meu perfil"}</Button>{existing&&<div className="grid gap-2 border-t pt-4 sm:grid-cols-2"><button onClick={logout} className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold text-slate-700"><LogOut className="h-4 w-4"/>Sair da conta</button><AlertDialog><AlertDialogTrigger asChild><button className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700"><Trash2 className="h-4 w-4"/>Excluir conta</button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir sua conta ReiCard?</AlertDialogTitle><AlertDialogDescription>Seu perfil, coleção, amizades e dados de troca serão apagados permanentemente. Essa ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={remove} className="bg-red-600 text-white hover:bg-red-700">Excluir definitivamente</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>}<p className="text-center text-xs text-slate-500">Sua conta usa login próprio do ReiCard com e-mail e senha protegida.</p></div></SimplePage>;
}

function LegalDocument({type}:{type:"terms"|"privacy"}){
  const privacy=type==="privacy";
  return <Dialog><DialogTrigger asChild><button type="button" className="font-bold text-blue-700 underline underline-offset-2">{privacy?"Política de Privacidade":"Termos de Uso"}</button></DialogTrigger><DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{privacy?"Política de Privacidade e LGPD":"Termos de Uso e Ciência"}</DialogTitle><DialogDescription>Versão de 11 de setembro de 2026</DialogDescription></DialogHeader>{privacy?<div className="legal-copy"><p>O ReiCard utiliza os dados mínimos necessários para identificar o perfil, guardar a coleção, conectar amigos aceitos e compartilhar listas de cartas repetidas ou faltantes.</p><h3>Dados utilizados</h3><p>Identificador da conta, nome de exibição, apelido, e-mail, faixa etária, cartas e quantidades cadastradas, amizades, listas compartilhadas e registros de aceite. Em contas de menores, também registramos nome e e-mail do responsável. Endereço e telefone não são exibidos publicamente.</p><h3>Finalidades e compartilhamento</h3><p>Os dados são usados para operar e proteger o serviço. As listas da coleção só são enviadas ao amigo escolhido pelo usuário. No compartilhamento pelo WhatsApp, o ReiCard prepara apenas os nomes e números das cartas; o envio ocorre no aplicativo WhatsApp e depende da confirmação do usuário. Não vendemos dados pessoais.</p><h3>Crianças e adolescentes</h3><p>O tratamento deve atender ao melhor interesse do menor. Quando indicado no cadastro, exigimos autorização do responsável legal e limitamos a exposição pública do perfil.</p><h3>Seus direitos</h3><p>O titular ou responsável poderá solicitar acesso, correção, exclusão, informação sobre uso e revogação de consentimento, observadas as hipóteses legais de conservação.</p></div>:<div className="legal-copy"><p>Ao criar um perfil, o usuário ou seu responsável declara que as informações fornecidas são verdadeiras e que utilizará o ReiCard para organizar coleções e interagir com respeito e segurança.</p><h3>Uso do serviço</h3><p>É proibido assediar outros usuários, criar identidade falsa, publicar conteúdo impróprio, tentar fraudes ou usar a plataforma para violar direitos de terceiros.</p><h3>Trocas e listas</h3><p>As listas de cartas repetidas e faltantes facilitam o contato entre amigos. O usuário escolhe o destinatário dentro do ReiCard ou confirma o envio externo pelo WhatsApp. Nesta fase, o ReiCard não recebe pagamentos, não garante o estado físico das cartas e não conclui negociações financeiras.</p><h3>Marcas e conteúdo</h3><p>ReiCard é uma plataforma independente. Marcas, nomes, imagens e dados de jogos pertencem aos respectivos titulares. O usuário mantém responsabilidade sobre fotos e informações que publicar.</p><h3>Segurança e moderação</h3><p>Contas ou conteúdos que coloquem usuários em risco poderão ser limitados ou removidos. Menores devem realizar qualquer troca física com acompanhamento do responsável.</p></div>}</DialogContent></Dialog>;
}

function SimplePage({title,subtitle,onBack,children}:{title:string;subtitle:string;onBack:()=>void;children:ReactNode}){return <section className="mx-auto max-w-[1100px] px-4 py-8 sm:px-7"><button onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500"><ArrowLeft className="h-4 w-4"/>Minhas coleções</button><h1 className="text-3xl font-black">{title}</h1><p className="mt-2 mb-6 text-slate-500">{subtitle}</p>{children}<Footer/></section>}
function PersonRow({person,action,label}:{person:Person;action?:()=>void;label:string}){return <div className="flex items-center justify-between gap-3 rounded-xl border bg-white p-3"><div className="flex min-w-0 items-center gap-3"><span className="brand-avatar grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black text-white">{(person.displayName||"U").slice(0,2).toUpperCase()}</span><span className="min-w-0"><b className="block truncate text-sm">{person.displayName||"Usuário"}</b><small className="text-slate-500">@{person.username}</small></span></div>{action?<Button size="sm" onClick={action}><UserPlus className="mr-1 h-4 w-4"/>{label}</Button>:<Badge variant="secondary">{label}</Badge>}</div>}
function SignInCard({title,text,onBack}:{title:string;text:string;onBack:()=>void}){return <SimplePage title={title} subtitle={text} onBack={onBack}><div className="rounded-2xl border bg-white p-8 text-center shadow-sm"><Users className="mx-auto h-12 w-12 text-violet-300"/><a href={SIGN_IN} className="brand-button mx-auto mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold text-white"><LogIn className="h-5 w-5"/>Entrar ou criar conta</a><p className="mx-auto mt-3 max-w-md text-xs text-slate-500">Use seu e-mail e uma senha própria do ReiCard. Nenhuma conta do ChatGPT é necessária.</p></div></SimplePage>}
function Loading(){return <div className="grid min-h-72 place-items-center"><div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-600"/><p className="mt-3 text-slate-500">Carregando...</p></div></div>}
function Empty({text}:{text:string}){return <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">{text}</div>}
function Footer(){return <p className="mt-10 text-center text-xs text-slate-400">Valores são estimativas de mercado e podem variar por estado, idioma e edição. ReiCard é independente; marcas e imagens pertencem aos respectivos titulares.</p>}
