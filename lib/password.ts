const encoder=new TextEncoder();
const ITERATIONS=210_000;

function encode(bytes:Uint8Array){return Buffer.from(bytes).toString("base64url")}
function decode(value:string){return new Uint8Array(Buffer.from(value,"base64url"))}

export async function hashPassword(password:string){
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const key=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:ITERATIONS},key,256);
  return `pbkdf2_sha256$${ITERATIONS}$${encode(salt)}$${encode(new Uint8Array(bits))}`;
}

export async function verifyPassword(password:string,stored:string){
  const [algorithm,iterationsText,saltText,expectedText]=stored.split("$");
  if(algorithm!=="pbkdf2_sha256"||!iterationsText||!saltText||!expectedText)return false;
  const iterations=Number(iterationsText);
  if(!Number.isSafeInteger(iterations)||iterations<100_000||iterations>1_000_000)return false;
  const salt=decode(saltText),expected=decode(expectedText);
  const key=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations},key,expected.length*8));
  if(bits.length!==expected.length)return false;
  let difference=0;
  for(let index=0;index<bits.length;index++)difference|=bits[index]^expected[index];
  return difference===0;
}

export function validPassword(password:string){return password.length>=8&&password.length<=128}
