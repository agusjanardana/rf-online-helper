"use client";
import { useEffect, useId, useState } from "react";
import { useWords } from "./ui";
export function CharacterSuggestions({server,guild}: {server:string;guild:string}) {
  const w=useWords(); const id=useId();
  const [name,setName]=useState(""); const [open,setOpen]=useState(false);
  const [active,setActive]=useState(-1);
  const [result,setResult]=useState<{query:string;names:string[];failed:boolean}|null>(null);
  const query=name.trim();
  useEffect(()=>{
    if (!server || !guild || !query || !open) return;
    const controller=new AbortController(); let cancelled=false;
    const timer=setTimeout(async()=>{
      try {
        const response=await fetch("/api/member-suggestions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({server_name:server,guild_name:guild,name_query:query}),cache:"no-store",signal:controller.signal});
        const data:unknown=await response.json();
        if (!response.ok || !Array.isArray(data) || !data.every(n=>typeof n==="string")) throw new Error();
        if(!cancelled) setResult({query,names:data,failed:false});
      } catch { if(!cancelled) setResult({query,names:[],failed:true}); }
    },350);
    return ()=>{cancelled=true;clearTimeout(timer);controller.abort();};
  },[query,server,guild,open]);
  const current=result?.query===query?result:null;
  const options=current?.names??[];
  const show=open && !!query && !!server && !!guild;
  function choose(value:string) {setName(value);setOpen(false);setActive(-1);}
  return <div className="guild-field guild-search-select" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
    <label htmlFor={id}>{w("Nama karakter","Character name")}</label>
    <input id={id} name="character" required maxLength={80} disabled={!server||!guild} autoComplete="off"
      placeholder={w("Ketik nama karakter…","Type a character name…")} value={name}
      role="combobox" aria-autocomplete="list" aria-expanded={show} aria-controls={`${id}-list`}
      aria-activedescendant={show&&active>=0&&options[active]?`${id}-${active}`:undefined}
      onFocus={()=>setOpen(true)} onChange={event=>{setName(event.target.value);setResult(null);setOpen(true);setActive(-1);}}
      onKeyDown={event=>{
        if(event.nativeEvent.isComposing)return;
        if(event.key==="ArrowDown"||event.key==="ArrowUp") {event.preventDefault();setOpen(true);setActive(i=>Math.max(0,Math.min(options.length-1,i+(event.key==="ArrowDown"?1:-1))));}
        else if(event.key==="Enter"&&show&&active>=0&&options[active]) {event.preventDefault();choose(options[active]);}
        else if(event.key==="Escape") {event.preventDefault();setOpen(false);}
      }}/>
    {show&&<ul id={`${id}-list`} role="listbox" aria-label={w("Saran nama karakter","Character name suggestions")}>
      {options.map((option,index)=><li key={option} id={`${id}-${index}`} role="option" aria-selected={index===active} className={index===active?"is-active":""} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(option)} onMouseMove={()=>setActive(index)}>{option}</li>)}
      {!options.length&&<li role="presentation"><span role="status">{!current?w("Mencari nama…","Searching names…"):current.failed?w("Saran belum tersedia. Isi nama secara manual.","Suggestions unavailable. Enter the name manually."):w("Tidak ada nama yang cocok.","No matching names.")}</span></li>}
    </ul>}
  </div>;
}
