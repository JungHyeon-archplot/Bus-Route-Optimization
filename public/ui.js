// Panel tabs, first-visit guide and keyboard shortcut. No simulation logic here.
const $=id=>document.getElementById(id);
const tabs=[...document.querySelectorAll('.panel-tabs [role=tab]')];

export function showTab(id){
 for(const tab of tabs){
  const on=tab.id===id;
  tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;
  $(tab.getAttribute('aria-controls')).hidden=!on;
 }
}
for(const tab of tabs){
 tab.addEventListener('click',()=>showTab(tab.id));
 tab.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
  const i=tabs.indexOf(tab),next=tabs[(i+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length];
  next.focus();showTab(next.id);
 });
}

// Space plays/pauses unless the user is typing or on a control that uses space itself.
addEventListener('keydown',event=>{
 if(event.code!=='Space'||event.target.closest('input,select,textarea,button,summary,[role=tab]'))return;
 event.preventDefault();$('sim-play').click();
});

// Three-step guide, shown until dismissed once.
try{if(!localStorage.getItem('bus-sim-guide-done'))$('guide').hidden=false;}catch{$('guide').hidden=false;}
$('guide-close').addEventListener('click',()=>{$('guide').hidden=true;try{localStorage.setItem('bus-sim-guide-done','1');}catch{}});
$('sim-play').addEventListener('click',()=>{$('guide').hidden=true;});
