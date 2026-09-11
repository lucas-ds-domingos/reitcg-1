"use client";

import {AuthPanel} from "@/components/auth-panel";

export default function SignInPage(){return <AuthPanel onBack={()=>{window.location.href="/"}}/>}
