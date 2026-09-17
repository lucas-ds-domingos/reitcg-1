"use client";

import {useState} from "react";
import {ArrowLeft,LockKeyhole,Mail} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Checkbox} from "@/components/ui/checkbox";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";

type Mode="login"|"register";

const fieldClass="h-12 text-base text-slate-900 bg-white border-2 border-slate-200 placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100";

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
    let body:any;
    if(mode==="login"){
      body={email,password};
    }else{
      body={email,password,displayName,username,ageGroup,termsAccepted,privacyAccepted};
      if(minor){
        body.guardianName=guardianName;
        body.guardianEmail=guardianEmail;
        body.guardianConsent=guardianConsent;
      }
    }
    try{
      const response=await fetch(`/api/auth/${mode==="login"?"login":"register"}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),credentials:"include"});
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
      const errorMessages:Record<string,string>={
        "invalid_credentials":"E-mail ou senha incorretos.",
        "email_or_username_unavailable":"Este e-mail ou apelido já está cadastrado.",
        "guardian_required":"Preencha a autorização do responsável.",
        "guardian_consent_required":"Você precisa confirmar a autorização do responsável.",
        "invalid_guardian_name":"Nome do responsável deve ter no mínimo 3 caracteres.",
        "invalid_guardian_email":"E-mail do responsável inválido.",
        "invalid_email":"E-mail inválido.",
        "invalid_password":"Senha deve ter no mínimo 8 caracteres.",
        "invalid_display_name":"Nome deve ter no mínimo 2 caracteres.",
        "invalid_username":"Apelido deve ter no mínimo 3 caracteres (apenas letras, números e _).",
        "invalid_age_group":"Escolha uma faixa etária válida.",
        "invalid_registration":"Confira se preencheu todos os campos corretamente."
      };
      setError(errorMessages[code]||"Confira os dados informados e tente novamente.");
    }finally{setLoading(false)}
  }

  return (
    <section className="brand-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-[#071a3d]">
          <ArrowLeft className="h-4 w-4"/>
          Voltar
        </button>

        {/* Brand mark */}
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/reicard-logo.png" alt="ReiCard" className="h-14 w-auto object-contain sm:h-16"/>
          <p className="mt-2 text-sm font-semibold text-slate-500">Seu mundo de cartas em um só lugar.</p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-[#dbe2f0] bg-white shadow-2xl shadow-[#1e3a5f26]">
          {/* Header */}
          <div className="brand-panel px-6 py-8 text-white">
            <div className="flex items-center gap-3">
              <img src="/reicard-icon.png" alt="" className="h-12 w-12 shrink-0 rounded-2xl shadow-lg"/>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">ReiCard</p>
                <h1 className="text-3xl font-black leading-tight">{mode==="login"?"Entrar":"Criar conta"}</h1>
              </div>
            </div>
            <p className="mt-4 text-sm text-blue-100">
              {mode==="login"?"Acesse sua coleção de cartas":"Comece sua jornada como colecionador"}
            </p>
          </div>

          {/* Content */}
          <div className="space-y-6 px-6 py-8">
            {/* Mode Toggle */}
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                onClick={()=>{setMode("login");setError("")}}
                className={`rounded-lg px-4 py-3 text-sm font-bold transition ${
                  mode==="login"
                    ?"bg-gradient-to-r from-[#e5f8ff] to-[#eee9ff] text-[#071a3d] shadow-md"
                    :"text-slate-500 hover:text-[#071a3d]"
                }`}
              >
                Entrar
              </button>
              <button
                onClick={()=>{setMode("register");setError("")}}
                className={`rounded-lg px-4 py-3 text-sm font-bold transition ${
                  mode==="register"
                    ?"bg-gradient-to-r from-[#e5f8ff] to-[#eee9ff] text-[#071a3d] shadow-md"
                    :"text-slate-500 hover:text-[#071a3d]"
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
                    className={fieldClass}
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
                    className={fieldClass}
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
                  className={`pl-12 ${fieldClass}`}
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
                  className={`pl-12 ${fieldClass}`}
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
                  <SelectTrigger className={`w-full ${fieldClass}`}>
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
              <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-black text-amber-950">Dados do responsável legal</p>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Nome completo do responsável
                  </label>
                  <Input
                    value={guardianName}
                    onChange={event=>setGuardianName(event.target.value)}
                    placeholder="Nome completo"
                    className={fieldClass}
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
                    className={fieldClass}
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
                <p className="text-sm font-black text-slate-800">Aceitar termos</p>

                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={termsAccepted}
                    onCheckedChange={v=>setTermsAccepted(v===true)}
                    className="mt-1"
                  />
                  <span className="text-sm text-slate-600">
                    Li e aceito os <a href="/termos" target="_blank" rel="noopener noreferrer" className="font-bold text-blue-700 underline underline-offset-2">Termos de Uso</a>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={privacyAccepted}
                    onCheckedChange={v=>setPrivacyAccepted(v===true)}
                    className="mt-1"
                  />
                  <span className="text-sm text-slate-600">
                    Li e entendo a <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="font-bold text-blue-700 underline underline-offset-2">Política de Privacidade</a> e LGPD
                  </span>
                </label>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-4">
                <p className="text-sm font-bold text-red-700">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={submit}
              disabled={loading || (mode==="register" && !registerReady)}
              className="brand-button h-12 w-full rounded-xl text-base font-bold text-white transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
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
