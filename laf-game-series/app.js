const SUPABASE_URL="https://bnbddwrpbumbinuvzouv.supabase.co";
const SUPABASE_KEY="sb_publishable_W1XZHNiYWijmdx4e_XrM5g_viSBjrii";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const menu=document.getElementById('menu'),nav=document.getElementById('nav');
menu?.addEventListener('click',()=>nav.classList.toggle('open'));
nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));
document.getElementById('year').textContent=new Date().getFullYear();
const $=s=>document.querySelector(s);const authDialog=$('#authDialog');let authMode='signin';
function msg(el,text,type=''){if(!el)return;el.textContent=text;el.className=(el.id==='authMessage'?'auth-message ':'status-box ')+type}
function setAuthMode(mode){authMode=mode;document.querySelectorAll('.auth-tab').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));$('#authTitle').textContent=mode==='signup'?'Create Account':'Sign In';$('#authSubmit').textContent=mode==='signup'?'CREATE ACCOUNT':'SIGN IN';$('#nameField').classList.toggle('hidden',mode!=='signup');$('#authPassword').autocomplete=mode==='signup'?'new-password':'current-password';$('#resendConfirmBtn')?.classList.add('hidden');msg($('#authMessage'),'')}
$('.auth-tabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(b)setAuthMode(b.dataset.mode)});
$('#authClose')?.addEventListener('click',()=>authDialog.close());
function openAuth(){setAuthMode('signin');authDialog.showModal()}
$('#accountBtn')?.addEventListener('click',openAuth);
$('#authForm')?.addEventListener('submit',async e=>{e.preventDefault();const email=$('#authEmail').value.trim(),password=$('#authPassword').value,name=$('#authName').value.trim();$('#authSubmit').disabled=true;try{if(authMode==='signup'){const {data,error}=await sb.auth.signUp({email,password,options:{data:{display_name:name},emailRedirectTo:'https://idrenartstrong.github.io/alamat-mandirigma-free-demo/laf-game-series/'}});if(error)throw error;msg($('#authMessage'),data.session?'Account created and signed in.':'Account created. Check your email and verify it before purchasing.','ok');if(!data.session)$('#resendConfirmBtn')?.classList.remove('hidden');if(data.session)setTimeout(()=>authDialog.close(),700)}else{const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;msg($('#authMessage'),'Signed in.','ok');setTimeout(()=>authDialog.close(),450)}}catch(err){msg($('#authMessage'),err.message||'Account request failed.','err')}finally{$('#authSubmit').disabled=false;await refreshAccount()}});

$('#resendConfirmBtn')?.addEventListener('click',async()=>{
  const email=$('#authEmail').value.trim();
  if(!email){msg($('#authMessage'),'Enter your email first.','err');return}
  const b=$('#resendConfirmBtn');b.disabled=true;const old=b.textContent;b.textContent='SENDING…';
  try{
    const {error}=await sb.auth.resend({type:'signup',email,options:{emailRedirectTo:'https://idrenartstrong.github.io/alamat-mandirigma-free-demo/laf-game-series/'}});
    if(error)throw error;
    msg($('#authMessage'),'Verification email sent again. Check Inbox, Spam, and Promotions.','ok');
  }catch(err){msg($('#authMessage'),err.message||'Could not resend verification email.','err')}
  finally{b.disabled=false;b.textContent=old}
});

$('#signOutBtn')?.addEventListener('click',async()=>{await sb.auth.signOut();await refreshAccount()});
async function currentSession(){const {data}=await sb.auth.getSession();return data.session||null}
async function refreshAccount(){const session=await currentSession(),accountBtn=$('#accountBtn'),signOut=$('#signOutBtn'),intro=$('#libraryIntro'),items=$('#libraryItems'),status=$('#purchaseStatus');if(!session){accountBtn.textContent='SIGN IN / CREATE ACCOUNT';signOut.classList.add('hidden');intro.textContent='Sign in to see your purchased games and create protected download links.';items.innerHTML='';status.textContent='Sign in with a verified email to purchase.';return}accountBtn.textContent=session.user.email||'MY ACCOUNT';signOut.classList.remove('hidden');const verified=!!session.user.email_confirmed_at;status.textContent=verified?'Your verified account is ready for secure checkout.':'Verify your email before purchasing.';intro.textContent='Signed in as '+(session.user.email||'player')+'.';await loadLibrary()}
async function loadLibrary(){const items=$('#libraryItems');items.innerHTML='<p>Loading library…</p>';const {data,error}=await sb.from('entitlements').select('id,status,granted_at,games(id,slug,title,edition)').eq('status','active').order('granted_at',{ascending:false});if(error){items.innerHTML='<p>Could not load your library.</p>';return}if(!data?.length){items.innerHTML='<p>No purchased games yet. Complete a verified checkout and the game will appear here automatically.</p>';return}items.innerHTML=data.map(row=>{const g=Array.isArray(row.games)?row.games[0]:row.games;return '<article class="library-item"><h3>'+escapeHtml(g?.title||'Game')+' '+escapeHtml(g?.edition||'')+'</h3><p>Owned · Secure digital license</p><button class="btn ghost download-btn" data-slug="'+escapeHtml(g?.slug||'')+'">CREATE SECURE DOWNLOAD</button></article>'}).join('');items.querySelectorAll('.download-btn').forEach(b=>b.addEventListener('click',()=>downloadGame(b.dataset.slug,b)))}
function escapeHtml(v){return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
async function downloadGame(slug,button){const session=await currentSession();if(!session)return openAuth();button.disabled=true;const old=button.textContent;button.textContent='CREATING LINK…';try{const res=await fetch(SUPABASE_URL+'/functions/v1/create-download-link',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':SUPABASE_KEY},body:JSON.stringify({game_slug:slug})});const j=await res.json();if(!res.ok)throw new Error(j.error||'Download unavailable.');location.href=j.download_url}catch(e){alert(e.message)}finally{button.disabled=false;button.textContent=old}}
$('#buyPaymongo')?.addEventListener('click',async()=>{const session=await currentSession();if(!session){openAuth();return}if(!session.user.email_confirmed_at){alert('Please verify your email before purchasing.');return}const b=$('#buyPaymongo');b.disabled=true;const old=b.textContent;b.textContent='OPENING SECURE CHECKOUT…';try{const res=await fetch(SUPABASE_URL+'/functions/v1/create-paymongo-checkout',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':SUPABASE_KEY},body:JSON.stringify({game_slug:'alamat-na-mandirigma-volume-1'})});const j=await res.json();if(!res.ok)throw new Error(j.error||'Checkout unavailable.');location.href=j.checkout_url}catch(e){alert(e.message)}finally{b.disabled=false;b.textContent=old}});

$('#buyPaypal')?.addEventListener('click',async()=>{
  const session=await currentSession();
  if(!session){openAuth();return}
  if(!session.user.email_confirmed_at){alert('Please verify your email before purchasing.');return}
  const b=$('#buyPaypal');b.disabled=true;const old=b.textContent;b.textContent='OPENING PAYPAL SANDBOX…';
  try{
    const res=await fetch(SUPABASE_URL+'/functions/v1/create-paypal-order',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':SUPABASE_KEY},
      body:JSON.stringify({game_slug:'alamat-na-mandirigma-volume-1'})
    });
    const j=await res.json();
    if(!res.ok)throw new Error(j.error||'PayPal checkout unavailable.');
    location.href=j.checkout_url;
  }catch(e){alert(e.message)}
  finally{b.disabled=false;b.textContent=old}
});

sb.auth.onAuthStateChange(()=>setTimeout(refreshAccount,0));refreshAccount();
const qs=new URLSearchParams(location.search);
if(qs.get('paypal_test')==='1')$('#buyPaypal')?.classList.remove('hidden');
if(qs.get('paypal')==='return'){
  setTimeout(async()=>{
    const session=await currentSession();
    const hashRaw=(location.hash||'').replace(/^#/,'');
    const hashParts=hashRaw.includes('&')?hashRaw.slice(hashRaw.indexOf('&')+1):hashRaw;
    const hashParams=new URLSearchParams(hashParts);
    const paypalOrderId=qs.get('token')||hashParams.get('token');
    if(!session){alert('PayPal payment was approved, but your store session is no longer active. Please sign in again, then reload this page to finish the Sandbox capture.');return}
    if(!paypalOrderId){alert('PayPal returned without an order token. The checkout return link has now been fixed; please retry the Sandbox test.');return}
    const status=$('#purchaseStatus');status.textContent='Confirming PayPal Sandbox payment…';
    try{
      const res=await fetch(SUPABASE_URL+'/functions/v1/capture-paypal-order',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':SUPABASE_KEY},
        body:JSON.stringify({paypal_order_id:paypalOrderId})
      });
      const j=await res.json();
      if(!res.ok)throw new Error(j.error||'PayPal payment could not be confirmed.');
      status.textContent='PayPal Sandbox payment confirmed. The game is now in My Library.';
      await refreshAccount();
      document.querySelector('#library')?.scrollIntoView({behavior:'smooth'});
      history.replaceState({},'',location.pathname+'#library');
    }catch(e){status.textContent=e.message||'PayPal payment confirmation failed.';alert(status.textContent)}
  },500);
}else if(qs.get('paypal')==='cancel'){
  setTimeout(()=>{document.querySelector('#store')?.scrollIntoView({behavior:'smooth'});history.replaceState({},'',location.pathname+'#store')},300);
}else if(qs.get('payment')==='success'){
  setTimeout(async()=>{document.querySelector('#library')?.scrollIntoView({behavior:'smooth'});for(let i=0;i<8;i++){await refreshAccount();await new Promise(r=>setTimeout(r,1800))}},500)
}else if(qs.get('payment')==='cancelled'){
  setTimeout(()=>document.querySelector('#store')?.scrollIntoView({behavior:'smooth'}),300)
}
