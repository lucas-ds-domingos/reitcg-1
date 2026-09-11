"use client";

import {useEffect,useMemo,useState} from "react";
import {CheckCircle2,MessageCircle,Send,Share2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from "@/components/ui/dialog";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";

type Card={id:string;localId:string;name:string;image?:string};
type SetInfo={id:string;name:string;official:number};
type Friend={id:string;username:string;displayName:string};
type Mode="repeated"|"missing"|"both";
type SharedCard={cardId:string;name:string;number:string;image?:string;quantity:number;kind:"repeated"|"missing"};

function numberFor(card:Card,set:SetInfo){
  if(!/^\d+$/.test(card.localId)||set.official<=0)return card.localId;
  const width=Math.max(3,card.localId.length,String(set.official).length);
  return `${card.localId.padStart(width,"0")}/${String(set.official).padStart(width,"0")}`;
}

export function ShareCollection({loggedIn,set,cards,quantities}:{loggedIn:boolean;set:SetInfo;cards:Card[];quantities:Record<string,number>}){
  const[open,setOpen]=useState(false),[mode,setMode]=useState<Mode>("both"),[friends,setFriends]=useState<Friend[]>([]),[friendId,setFriendId]=useState(""),[sending,setSending]=useState(false),[message,setMessage]=useState("");
  const repeated=useMemo<SharedCard[]>(()=>cards.filter(card=>(quantities[card.id]||0)>1).map(card=>({cardId:card.id,name:card.name,number:numberFor(card,set),image:card.image,quantity:(quantities[card.id]||0)-1,kind:"repeated"})),[cards,quantities,set]);
  const missing=useMemo<SharedCard[]>(()=>cards.filter(card=>(quantities[card.id]||0)===0).map(card=>({cardId:card.id,name:card.name,number:numberFor(card,set),image:card.image,quantity:0,kind:"missing"})),[cards,quantities,set]);
  const selected=mode==="repeated"?repeated:mode==="missing"?missing:[...repeated,...missing];

  useEffect(()=>{if(open&&loggedIn)fetch("/api/shares",{credentials:"include"}).then(async response=>response.ok?(await response.json()) as {friends?:Friend[]}:null).then(data=>setFriends(data?.friends??[])).catch(()=>{})},[open,loggedIn]);

  const whatsapp=useMemo(()=>{
    const title=mode==="repeated"?"Cartas repetidas para troca":mode==="missing"?"Cartas que estão faltando":"Cartas repetidas e faltantes";
    const chosen=selected.slice(0,70);
    const lines=chosen.map(card=>`${card.kind==="repeated"?"🔁":"🔎"} ${card.name} #${card.number}${card.kind==="repeated"?` — ${card.quantity} ${card.quantity===1?"disponível":"disponíveis"}`:""}`);
    if(selected.length>chosen.length)lines.push(`… e mais ${selected.length-chosen.length} cartas.`);
    return `https://wa.me/?text=${encodeURIComponent(`ReiCard — ${title}\nÁlbum: ${set.name}\n\n${lines.join("\n")}\n\nLista criada no ReiCard.`)}`;
  },[mode,selected,set.name]);

  async function sendToFriend(){
    if(!friendId||!selected.length)return;
    setSending(true);setMessage("");
    try{
      const response=await fetch("/api/shares",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({recipientId:friendId,setId:set.id,setName:set.name,shareType:mode,cards:selected}),credentials:"include"});
      if(!response.ok)throw new Error("share_error");
      setMessage("Lista enviada ao amigo no ReiCard.");
    }catch{setMessage("Não foi possível enviar agora. Tente novamente.")}
    finally{setSending(false)}
  }

  return <Dialog open={open} onOpenChange={value=>{setOpen(value);if(!value)setMessage("")}}><DialogTrigger asChild><Button variant="outline" className="h-11 gap-2 border-violet-300 bg-white font-bold text-violet-700"><Share2 className="h-4 w-4"/>Compartilhar listas</Button></DialogTrigger><DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto"><DialogHeader><DialogTitle>Compartilhar minha coleção</DialogTitle><DialogDescription>Envie as repetidas ou as cartas que faltam neste álbum. Cada item inclui a numeração correta da edição.</DialogDescription></DialogHeader><div className="space-y-4"><div className="grid grid-cols-3 gap-2">{([{value:"repeated",label:"Repetidas",count:repeated.length},{value:"missing",label:"Faltantes",count:missing.length},{value:"both",label:"Ambas",count:repeated.length+missing.length}] as const).map(option=><button type="button" key={option.value} onClick={()=>{setMode(option.value);setMessage("")}} className={`rounded-xl border p-3 text-center transition ${mode===option.value?"border-violet-500 bg-violet-50 text-violet-800":"bg-white text-slate-600"}`}><b className="block text-sm">{option.label}</b><span className="text-xs">{option.count} cartas</span></button>)}</div><div className="rounded-xl border bg-slate-50 p-3"><p className="text-sm font-bold text-slate-700">Enviar para um amigo do ReiCard</p>{loggedIn?<><Select value={friendId} onValueChange={setFriendId}><SelectTrigger className="mt-2 bg-white"><SelectValue placeholder={friends.length?"Escolha um amigo":"Nenhum amigo aceito"}/></SelectTrigger><SelectContent>{friends.map(friend=><SelectItem key={friend.id} value={friend.id}>{friend.displayName} · @{friend.username}</SelectItem>)}</SelectContent></Select><Button className="brand-button mt-2 w-full gap-2" disabled={!friendId||!selected.length||sending} onClick={sendToFriend}><Send className="h-4 w-4"/>{sending?"Enviando...":"Enviar pelo ReiCard"}</Button></>:<p className="mt-2 text-sm text-slate-500">Faça login para enviar uma lista aos amigos da plataforma.</p>}{message&&<p className={`mt-2 flex items-center gap-2 text-sm font-bold ${message.startsWith("Lista")?"text-green-700":"text-red-600"}`}>{message.startsWith("Lista")&&<CheckCircle2 className="h-4 w-4"/>}{message}</p>}</div><a href={whatsapp} target="_blank" rel="noopener noreferrer" className={`flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 font-bold text-white ${selected.length?"":"pointer-events-none opacity-50"}`}><MessageCircle className="h-5 w-5"/>Compartilhar pelo WhatsApp</a><p className="text-xs leading-relaxed text-slate-500">A lista do WhatsApp contém no máximo 70 itens por mensagem. No ReiCard, o amigo recebe a lista completa deste álbum.</p></div></DialogContent></Dialog>;
}
