const menu=document.getElementById('menu');
const nav=document.getElementById('nav');
menu?.addEventListener('click',()=>nav?.classList.toggle('open'));
nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>nav?.classList.remove('open')));
const year=document.getElementById('year');
if(year) year.textContent=new Date().getFullYear();
