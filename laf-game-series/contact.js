const SUPABASE_URL="https://bnbddwrpbumbinuvzouv.supabase.co";
const SUPABASE_KEY="sb_publishable_W1XZHNiYWijmdx4e_XrM5g_viSBjrii";
const form=document.getElementById('contactForm');
const box=document.getElementById('formMessage');
const btn=document.getElementById('sendBtn');
form?.addEventListener('submit',async(e)=>{
  e.preventDefault();
  box.className=''; box.textContent='';
  if(document.getElementById('website').value) return;
  const payload={
    name:document.getElementById('name').value.trim(),
    email:document.getElementById('email').value.trim(),
    subject:document.getElementById('subject').value,
    order_reference:document.getElementById('order_reference').value.trim()||null,
    message:document.getElementById('message').value.trim(),
    consent:document.getElementById('consent').checked
  };
  btn.disabled=true; btn.textContent='SENDING…';
  try{
    const res=await fetch(SUPABASE_URL+'/rest/v1/contact_messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Prefer':'return=minimal'},
      body:JSON.stringify(payload)
    });
    if(!res.ok) throw new Error('Message could not be sent.');
    form.reset(); box.className='message ok'; box.textContent='Message sent successfully. Thank you — your request has been received.';
  }catch(err){ box.className='message err'; box.textContent='Your message could not be sent right now. Please try again shortly.'; }
  finally{btn.disabled=false;btn.textContent='SEND MESSAGE';}
});