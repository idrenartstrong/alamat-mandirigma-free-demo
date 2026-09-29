const SUPABASE_URL="https://bnbddwrpbumbinuvzouv.supabase.co";
const SUPABASE_KEY="sb_publishable_W1XZHNiYWijmdx4e_XrM5g_viSBjrii";
const STORE_URL=location.origin+location.pathname;
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const menu=document.getElementById('menu'),nav=document.getElementById('nav');
menu?.addEventListener('click',()=>nav.classList.toggle('open'));
nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));
document.getElementById('year').textContent=new Date().getFullYear();
const $=s=>document.querySelector(s);const authDialog=$('#authDialog'),resetDialog=$('#resetDialog');let authMode='signin';
function msg(el,text,type=''){if(!el)return;el.textContent=text;el.className=(el.id==='authMessage'?'auth-message ':'status-box ')+type}
function setAuthMode(mode){authMode=mode;document.querySelectorAll('.auth-tab').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));$('#authTitle').textContent=mode==='signup'?'Create Account':'Sign In';$('#authSubmit').textContent=mode==='signup'?'CREATE ACCOUNT':'SIGN IN';$('#nameField').classList.toggle('hidden',mode!=='signup');$('#authPassword').autocomplete=mode==='signup'?'new-password':'current-password';$('#forgotPasswordBtn')?.classList.toggle('hidden',mode!=='signin');$('#resendConfirmBtn')?.classList.add('hidden');msg($('#authMessage'),'')}
$('.auth-tabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(b)setAuthMode(b.dataset.mode)});
$('#authClose')?.addEventListener('click',()=>authDialog.close());
function openAuth(){setAuthMode('signin');authDialog.showModal()}
$('#accountBtn')?.addEventListener('click',openAuth);

$('#forgotPasswordBtn')?.addEventListener('click',async()=>{
  const email=$('#authEmail').value.trim();
  if(!email){msg($('#authMessage'),'Enter your email first, then choose Forgot Password.','err');$('#authEmail').focus();return}
  const b=$('#forgotPasswordBtn');b.disabled=true;const old=b.textContent;b.textContent='SENDING RESET EMAIL…';
  try{
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:STORE_URL});
    if(error)throw error;
    msg($('#authMessage'),'Password reset email sent. Check Inbox, Spam, and Promotions.','ok');
  }catch(err){msg($('#authMessage'),err.message||'Could not send password reset email.','err')}
  finally{b.disabled=false;b.textContent=old}
});

function openResetDialog(){
  if(authDialog?.open)authDialog.close();
  if(resetDialog&&!resetDialog.open){msg($('#resetMessage'),'');resetDialog.showModal()}
}
$('#resetClose')?.addEventListener('click',()=>resetDialog.close());
$('#resetForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const password=$('#resetPassword').value,confirm=$('#resetPasswordConfirm').value;
  if(password!==confirm){msg($('#resetMessage'),'Passwords do not match.','err');return}
  const b=$('#resetSubmit');b.disabled=true;const old=b.textContent;b.textContent='SAVING…';
  try{
    const {error}=await sb.auth.updateUser({password});
    if(error)throw error;
    msg($('#resetMessage'),'Password updated successfully. Your account is ready.','ok');
    history.replaceState({},'',location.pathname+location.search);
    setTimeout(()=>resetDialog.close(),900);
  }catch(err){msg($('#resetMessage'),err.message||'Could not update password.','err')}
  finally{b.disabled=false;b.textContent=old;await refreshAccount()}
});
$('#authForm')?.addEventListener('submit',async e=>{e.preventDefault();const email=$('#authEmail').value.trim(),password=$('#authPassword').value,name=$('#authName').value.trim();$('#authSubmit').disabled=true;try{if(authMode==='signup'){const {data,error}=await sb.auth.signUp({email,password,options:{data:{display_name:name},emailRedirectTo:STORE_URL}});if(error)throw error;msg($('#authMessage'),data.session?'Account created and signed in.':'Account created. Check your email and verify it before purchasing.','ok');if(!data.session)$('#resendConfirmBtn')?.classList.remove('hidden');if(data.session)setTimeout(()=>authDialog.close(),700)}else{const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;msg($('#authMessage'),'Signed in.','ok');setTimeout(()=>authDialog.close(),450)}}catch(err){msg($('#authMessage'),err.message||'Account request failed.','err')}finally{$('#authSubmit').disabled=false;await refreshAccount()}});

$('#resendConfirmBtn')?.addEventListener('click',async()=>{
  const email=$('#authEmail').value.trim();
  if(!email){msg($('#authMessage'),'Enter your email first.','err');return}
  const b=$('#resendConfirmBtn');b.disabled=true;const old=b.textContent;b.textContent='SENDING…';
  try{
    const {error}=await sb.auth.resend({type:'signup',email,options:{emailRedirectTo:STORE_URL}});
    if(error)throw error;
    msg($('#authMessage'),'Verification email sent again. Check Inbox, Spam, and Promotions.','ok');
  }catch(err){msg($('#authMessage'),err.message||'Could not resend verification email.','err')}
  finally{b.disabled=false;b.textContent=old}
});

$('#signOutBtn')?.addEventListener('click',async()=>{await sb.auth.signOut();await refreshAccount()});
async function currentSession(){const {data}=await sb.auth.getSession();return data.session||null}
async function refreshAccount(){const session=await currentSession(),accountBtn=$('#accountBtn'),signOut=$('#signOutBtn'),intro=$('#libraryIntro'),items=$('#libraryItems'),status=$('#purchaseStatus');if(!session){accountBtn.textContent='SIGN IN / CREATE ACCOUNT';signOut.classList.add('hidden');intro.textContent='Sign in to see your purchased games and create protected download links.';items.innerHTML='';status.textContent='Sign in with a verified email to purchase.';return}accountBtn.textContent=session.user.email||'MY ACCOUNT';signOut.classList.remove('hidden');const verified=!!session.user.email_confirmed_at;status.textContent=verified?'Your verified account is ready for secure checkout.':'Verify your email before purchasing.';intro.textContent='Signed in as '+(session.user.email||'player')+'.';await loadLibrary()}
async function loadLibrary(){const items=$('#libraryItems');items.innerHTML='<p>Loading library…</p>';const {data,error}=await sb.from('entitlements').select('id,status,granted_at,games(id,slug,title,edition)').eq('status','active').order('granted_at',{ascending:false});if(error){items.innerHTML='<p>Could not load your library.</p>';return}if(!data?.length){items.innerHTML='<p>No purchased games yet. Complete a verified checkout and the game will appear here automatically.</p>';return}items.innerHTML=data.map(row=>{const g=Array.isArray(row.games)?row.games[0]:row.games;const slug=escapeHtml(g?.slug||'');const downloads=g?.slug==='alamat-na-mandirigma-volume-1'?'<div class="library-actions"><button class="btn ghost download-btn" data-slug="'+slug+'" data-platform="pc_mac">DOWNLOAD PC / MAC</button><a class="btn ghost" href="play-mobile.html">PLAY MOBILE</a></div>':'<button class="btn ghost download-btn" data-slug="'+slug+'">CREATE SECURE DOWNLOAD</button>';return '<article class="library-item"><h3>'+escapeHtml(g?.title||'Game')+' '+escapeHtml(g?.edition||'')+'</h3><p>Owned · Secure digital license</p>'+downloads+'</article>'}).join('');items.querySelectorAll('.download-btn').forEach(b=>b.addEventListener('click',()=>downloadGame(b.dataset.slug,b.dataset.platform||'',b)))}
function escapeHtml(v){return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
let paymongoOpening=false,paymongoAvailable=true;
async function refreshPaymentMethods(){
  try{
    const res=await fetch(SUPABASE_URL+'/functions/v1/paymongo-payment-methods',{
      headers:{apikey:SUPABASE_KEY},signal:AbortSignal.timeout(10000)
    });
    if(!res.ok)return;
    const data=await res.json();
    if(!Array.isArray(data.payment_method_types)||!data.payment_method_types.every(m=>typeof m==='string'))return;
    const methods=new Set(data.payment_method_types),cards=[];
    const qr=methods.has('qrph'),gcash=methods.has('gcash');
    if(gcash)cards.push(['GCash','Pay directly at checkout']);
    else if(qr)cards.push(['GCash','Scan to pay with QR Ph']);
    if(methods.has('paymaya'))cards.push(['Maya','Pay directly at checkout']);
    else if(qr)cards.push(['Maya','Scan to pay with QR Ph']);
    if(methods.has('card'))cards.push(['Visa / Mastercard','Credit and debit cards']);
    if(qr)cards.push(['QR Ph','Participating banks and e-wallets']);
    const available=data.livemode===true&&cards.length>0;
    paymongoAvailable=available;
    $('#paymentMethodsTitle').textContent=available&&(gcash||qr)?'Pay with GCash':'Secure payment methods';
    $('#paymentMethods').innerHTML=available?cards.map(([name,note])=>'<div class="pay-active">'+escapeHtml(name)+'<small>'+escapeHtml(note)+'</small></div>').join(''):'<div>Payments temporarily unavailable<small>Please try again later.</small></div>';
    $('#paymentStrip').innerHTML='<span>SECURE PAYMENT</span>'+(available?cards.map(([name,note])=>'<b>'+escapeHtml(name+(note.includes('Scan')?' via QR Ph':''))+'</b>').join(''):'<b>Checkout temporarily unavailable</b>');
    $('#gcashQrHelp').hidden=!available||!qr;
    $('#paymentMethodNote').textContent=!available?'Checkout is temporarily unavailable.':gcash?'Choose GCash on the secure PayMongo checkout page.':qr?'Choose QR Ph on the PayMongo checkout page to pay using GCash.':'Choose an available payment method on the secure PayMongo checkout page.';
    const button=$('#buyPaymongo');
    if(paymongoOpening)return;
    button.disabled=!available;
    button.textContent=!available?'CHECKOUT TEMPORARILY UNAVAILABLE':gcash?'BUY NOW — GCASH / PAYMONGO':qr?'BUY NOW — GCASH / QR PH':'BUY NOW — PAYMONGO';
  }catch{/* Keep the working QR Ph option if the status check is unavailable. */}
}
refreshPaymentMethods();
async function downloadGame(slug,platform,button){const session=await currentSession();if(!session)return openAuth();button.disabled=true;const old=button.textContent;button.textContent='CREATING LINK…';try{const res=await fetch(SUPABASE_URL+'/functions/v1/create-download-link',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':SUPABASE_KEY},body:JSON.stringify({game_slug:slug,platform})});const j=await res.json();if(!res.ok)throw new Error(j.error||'Download unavailable.');location.href=j.download_url}catch(e){alert(e.message)}finally{button.disabled=false;button.textContent=old}}
$('#buyPaymongo')?.addEventListener('click',async()=>{
  if(paymongoOpening||!paymongoAvailable)return;
  const session=await currentSession(),status=$('#purchaseStatus');
  if(!session){openAuth();return}
  if(!session.user.email_confirmed_at){status.textContent='Please verify your email before purchasing.';return}
  const b=$('#buyPaymongo');paymongoOpening=true;b.disabled=true;const old=b.textContent;
  b.textContent='OPENING SECURE CHECKOUT…';status.classList.remove('err');
  status.textContent='Opening your secure payment page…';
  try{
    const res=await fetch(SUPABASE_URL+'/functions/v1/create-paymongo-checkout',{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':SUPABASE_KEY},
      body:JSON.stringify({game_slug:'alamat-na-mandirigma-volume-1'})
    });
    const j=await res.json();
    if(!res.ok)throw new Error(j.error||'Checkout is temporarily unavailable. Please try again.');
    if(!j.checkout_url)throw new Error('The payment page did not open. Please try again.');
    const target=new URL(j.checkout_url,location.href);
    if(target.protocol!=='https:'||(!j.already_owned&&target.hostname!=='checkout.paymongo.com')||(j.already_owned&&target.origin!==location.origin))throw new Error('The payment page could not be verified. Please try again.');
    location.href=target.href;
  }catch(e){status.textContent=e.message||'Checkout is temporarily unavailable. Please try again.';status.classList.add('err')}
  finally{paymongoOpening=false;b.disabled=!paymongoAvailable;b.textContent=paymongoAvailable?old:'CHECKOUT TEMPORARILY UNAVAILABLE'}
});

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

sb.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY')setTimeout(openResetDialog,0);setTimeout(refreshAccount,0)});refreshAccount();if((location.hash||'').includes('type=recovery'))setTimeout(openResetDialog,350);
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
