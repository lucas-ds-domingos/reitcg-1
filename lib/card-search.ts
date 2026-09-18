export type SearchQuery={text:string[];number:string;total:string};
type SearchCard={localId:string;name:string};
type SearchSet={official:number;total:number};

function fold(value:string){
  return value.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
}

// Aceita "pikachu", "30", "030/120", "30/" e "pikachu 30/120".
export function parseSearch(raw:string):SearchQuery{
  const folded=fold(raw).trim();
  const slash=folded.match(/(\d*)\s*\/\s*(\d*)/);
  const number=slash?.[1]??"";
  const total=slash?.[2]??"";
  const rest=slash?folded.replace(slash[0]," "):folded;
  return{text:rest.split(/\s+/).filter(Boolean),number,total};
}

export function hasSearch(query:SearchQuery){
  return query.text.length>0||Boolean(query.number)||Boolean(query.total);
}

function sameNumber(localId:string,number:string){
  if(/^\d+$/.test(localId)&&/^\d+$/.test(number))return Number(localId)===Number(number);
  return fold(localId)===number;
}

export function setHasTotal(set:SearchSet,total:string){
  const value=Number(total);
  return value===set.official||value===set.total;
}

// `set` só é informado quando o total impresso (30/120) deve conferir com o álbum da carta.
export function matchesSearch(card:SearchCard,query:SearchQuery,set?:SearchSet){
  const name=fold(card.name);
  const localId=fold(card.localId);
  if(!query.text.every(token=>name.includes(token)||localId.includes(token)))return false;
  if(query.number&&!sameNumber(card.localId,query.number))return false;
  if(query.total&&set&&!setHasTotal(set,query.total))return false;
  return true;
}
