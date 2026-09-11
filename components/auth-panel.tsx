"use client";

import {useState} from "react";
import {ArrowLeft,LockKeyhole,Mail} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Checkbox} from "@/components/ui/checkbox";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";

type Mode="login"|"register";

export function AuthPanel({onBack}:{onBack:()=>void}){
  const[mode,setMode]=useState<Mode>("login");
  const[email,setEmail]=useState("");
  const[password,setPassword]=useState("");
  const[displayName,setDisplayName]=useState("");
  const[username,setUsername]=useState("");
  const[ageGroup,setAgeGroup]=useState("");
  const[guardianName,setGuardianName]=useState("");
  const[guardianEmail,setGuardianEmail]=useState("");
  const[guardianConsent,setGuardianConsent]=useState(false);
  const[termsAccepted,setTermsAccepted]=useState(false);
  const[privacyAccepted,setPrivacyAccepted]=useState(false);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState("");
  
  const minor=ageGroup==="child"||ageGroup==="teen";
  const registerReady=email&&password.length>=8&&displayName.trim().length>=2&&username.trim().length>=3&&ageGroup&&termsAccepted&&privacyAccepted&&(!minor||(guardianConsent&&guardianName.trim().length>=3&&/^\S+@\S+\.\S+$/.test(guardianEmail)));
  
  async function submit(){
    setLoading(true);
    setError("");
    const body=mode==="login"?{email,password}:{email,password,displayName,username,ageGroup,guardianName,guardianEmail,guardianConsent,termsAccepted,privacyAccepted};
    try{
      const response=await fetch(`/api/auth/${mode==="login"?"login":"register"}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const data=await response.json() as {error?:string;profile?:unknown};
      if(!response.ok)throw new Error(data.error||"auth_error");
      
      if(mode==="register"&&data.profile){
        sessionStorage.setItem("reicard-profile-cache",JSON.stringify(data.profile));
      }
      
      localStorage.removeItem("reicard-quantities");
      localStorage.removeItem("reicard-owned");
      localStorage.removeItem("dexcard-owned");
      window.location.href="/";
    }catch(reason){
      const code=reason instanceof Error?reason.message:"";
      setError(code==="invalid_credentials"?"E-mail ou senha incorretos.":code==="email_or_username_unavailable"?"Este e-mail ou apelido já está cadastrado.":code==="guardian_required"?"Preencha a autorização do responsável.":"Confira os dados informados e tente novamente.");
    }finally{setLoading(false)}
  }
  
  return (
    <section className="brand-shell min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-8 bg-gradient-to-br from-blue-50 to-cyan-50">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition">
          <ArrowLeft className="h-4 w-4"/>
          Voltar
        </button>
        
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-8 text-white">
            <p className="text-sm font-bold uppercase tracking-widest text-blue-100">ReiCard</p>
            <h1 className="mt-3 text-4xl font-black">{mode==="login"?"Entrar":"Criar conta"}</h1>
            <p className="mt-3 text-base text-blue-100">
              {mode==="login"?"Acesse sua coleção de cartas":"Comece sua jornada como colecionador"}
            </p>
          </div>
          
          {/* Content */}
          <div className="space-y-6 px-6 py-8">
            {/* Mode Toggle */}
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button 
                onClick={()=>{setMode("login");setError("")}} 
                className={`py-3 px-4 rounded-lg font-bold text-sm transition ${
                  mode==="login"
                    ?"bg-white text-blue-600 shadow-md"
                    :"text-slate-600 hover:text-slate-900"
                }`}
              >
                Entrar
              </button>
              <button 
                onClick={()=>{setMode("register");setError("")}} 
                className={`py-3 px-4 rounded-lg font-bold text-sm transition ${
                  mode==="register"
                    ?"bg-white text-blue-600 shadow-md"
                    :"text-slate-600 hover:text-slate-900"
                }`}
              >
                Criar conta
              </button>
            </div>
            
            {/* Register Fields */}
            {mode==="register" && (
              <>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Nome de exibição
                  </label>
                  <Input 
                    value={displayName} 
                    onChange={event=>setDisplayName(event.target.value)} 
                    autoComplete="name"
                    placeholder="Seu nome"
                    className="h-12 text-base border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Apelido ReiCard
                  </label>
                  <Input 
                    value={username} 
                    onChange={event=>setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g,""))} 
                    placeholder="ex.: fabiocards"
                    className="h-12 text-base border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </>
            )}
            
            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-400"/>
                <Input 
                  type="email" 
                  value={email} 
                  onChange={event=>setEmail(event.target.value)} 
                  autoComplete="email"
                  placeholder="seu@email.com"
                  className="h-12 pl-12 text-base border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
            
            {/* Password */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Senha
              </label>
              <div className="relative">
                <LockKeyhole className="absolute left-4 top-3.5 h-5 w-5 text-slate-400"/>
                <Input 
                  type="password" 
                  value={password} 
                  onChange={event=>setPassword(event.target.value)} 
                  autoComplete={mode==="login"?"current-password":"new-password"}
                  placeholder={mode==="login"?"Sua senha":"Mínimo 8 caracteres"}
                  className="h-12 pl-12 text-base border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
            
            {/* Register Age Group */}
            {mode==="register" && (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Faixa etária
                </label>
                <Select value={ageGroup} onValueChange={setAgeGroup}>
                  <SelectTrigger className="h-12 text-base border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
                    <SelectValue placeholder="Escolha uma opção"/>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="child">Menor de 13 anos</SelectItem>
                    <SelectItem value="teen">13 a 17 anos</SelectItem>
                    <SelectItem value="adult">18 anos ou mais</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Guardian Fields */}
            {mode==="register" && minor && (
              <div className="space-y-4 rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-bold text-amber-900">Dados do responsável legal</p>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Nome completo do responsável
                  </label>
                  <Input 
                    value={guardianName} 
                    onChange={event=>setGuardianName(event.target.value)}
                    placeholder="Nome completo"
                    className="h-12 text-base border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    E-mail do responsável
                  </label>
                  <Input 
                    type="email"
                    value={guardianEmail} 
                    onChange={event=>setGuardianEmail(event.target.value)}
                    placeholder="email@example.com"
                    className="h-12 text-base border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white"
                  />
                </div>
                
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox 
                    checked={guardianConsent} 
                    onCheckedChange={v=>setGuardianConsent(v===true)}
                    className="mt-1"
                  />
                  <span className="text-sm text-slate-700">
                    Confirmo que sou o responsável legal e autorizo este menor a usar o ReiCard
                  </span>
                </label>
              </div>
            )}
            
            {/* Legal Accept */}
            {mode==="register" && (
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-700">Aceitar termos</p>
                
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox 
                    checked={termsAccepted} 
                    onCheckedChange={v=>setTermsAccepted(v===true)}
                    className="mt-1"
                  />
                  <span className="text-sm text-slate-600">
                    Li e aceito os <span className="font-bold text-blue-600">Termos de Uso</span>
                  </span>
                </label>
                
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox 
                    checked={privacyAccepted} 
                    onCheckedChange={v=>setPrivacyAccepted(v===true)}
                    className="mt-1"
                  />
                  <span className="text-sm text-slate-600">
                    Li e entendo a <span className="font-bold text-blue-600">Política de Privacidade</span> e LGPD
                  </span>
                </label>
              </div>
            )}
            
            {/* Error Message */}
            {error && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-4">
                <p className="text-sm font-bold text-red-700">{error}</p>
              </div>
            )}
            
            {/* Submit Button */}
            <Button 
              onClick={submit} 
              disabled={loading || (mode==="register" && !registerReady)}
              className="w-full h-12 text-base font-bold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Processando..." : (mode==="login" ? "Entrar na minha conta" : "Criar minha conta")}
            </Button>
            
            <p className="text-center text-xs text-slate-500">
              Seu login é pessoal. Sem contas de terceiros necessárias.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
