(function () {
 const mobilePortrait=window.matchMedia("(max-width: 1024px) and (orientation: portrait) and (hover: none) and (pointer: coarse)");
 const controls={topRew:["Rewind","Rewind 10 seconds; hold to scrub backward"],topPause:["Pause","Pause or resume playback"],topFwd:["Forward","Forward 10 seconds; hold to scrub forward"],topStop:["Stop","Stop and return to start"],topPreview:["Play","Play or resume audio preview"]};
 function update(){
   for(const [id,[label,description]] of Object.entries(controls)){
     const button=document.getElementById(id);
     if(!button)continue;
     let text=button.querySelector(".mobile-transport-label");
     if(!mobilePortrait.matches){if(text)text.remove();button.removeAttribute("aria-label");continue}
     button.type="button";
     button.setAttribute("aria-label",description);
     if(!text){text=document.createElement("span");text.className="mobile-transport-label";text.setAttribute("aria-hidden","true");button.appendChild(text)}
     text.textContent=label;
   }
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",update,{once:true});else update();
 if(mobilePortrait.addEventListener)mobilePortrait.addEventListener("change",update);else mobilePortrait.addListener(update);
 window.addEventListener("pageshow",update);
})();