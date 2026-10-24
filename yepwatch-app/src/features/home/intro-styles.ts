export const introCss = `
.home-landing main{gap:20px;padding:24px 0}.mini-intro{width:min(100%,576px);height:158px;margin:0 auto;position:relative;flex-shrink:0}.mini-film{height:100%;animation:mini-clock 13.5s linear infinite both}.mini-stage{height:122px;width:280px;position:relative;margin:auto}.mini-person{position:absolute;left:50%;top:9px;width:52px;height:102px;margin-left:-26px}.mini-left{--offset:-88px;--tilt:-7deg;--delay:0s}.mini-middle{--offset:0px;--tilt:0deg;--delay:.3s}.mini-right{--offset:88px;--tilt:7deg;--delay:.6s}.mini-person{transform:translateX(var(--offset))}.mini-deck{width:52px;height:73px;position:relative;animation:mini-gather 13.5s cubic-bezier(.22,.7,.22,1) infinite both}.mini-card,.mini-card-under,.mini-flick{position:absolute;inset:0;border-radius:6px;border:1px solid #ffffff40;overflow:hidden;box-shadow:0 5px 12px #0006}.mini-card-under{background:#292a36;transform:translate(3px,3px) rotate(6deg)}.mini-card{background:linear-gradient(150deg,#42436a 0%,#302c54 60%,#ad6d55);transform:rotate(var(--tilt))}.mini-moon{position:absolute;width:27px;height:27px;border-radius:50%;background:#fff3cc;left:13px;top:12px;box-shadow:0 0 20px #ffcf7770}.mini-hills{position:absolute;width:100%;height:40px;background:#161826;transform:rotate(-25deg) scale(1.3);top:42px;left:7px}.mini-film-lines{position:absolute;width:24px;height:2px;background:#fff9;bottom:10px;left:13px;box-shadow:5px 4px 0 -0.5px #fff5}.mini-flick{background:linear-gradient(155deg,#23463e,#0c171b);animation:mini-flick 13.5s cubic-bezier(.2,.8,.3,1) infinite both;animation-delay:var(--delay)}.mini-orbit{position:absolute;inset:16px 3px;border:1px solid #9dcdbc;border-radius:50%;transform:rotate(40deg)}.mini-tap{position:absolute;width:12px;height:12px;border:1px solid var(--person);border-radius:50%;background:var(--person);opacity:0;right:-5px;bottom:18px;animation:mini-tap 13.5s ease infinite both;animation-delay:var(--delay)}.mini-face{display:flex;justify-content:center;gap:5px;align-items:center;position:absolute;width:25px;height:25px;left:14px;bottom:0;border-radius:50%;background:var(--person);box-shadow:0 0 0 4px #070707;animation:mini-hop 13.5s cubic-bezier(.3,.8,.4,1) infinite both;animation-delay:var(--delay)}.mini-face i{display:block;width:2px;height:3px;border-radius:2px;background:#191522}.mini-face b{position:absolute;width:6px;height:3px;border-radius:0 0 6px 6px;border-bottom:1.5px solid #191522;bottom:6px;left:10px}.mini-left .mini-face{animation-name:mini-hop-left}.mini-right .mini-face{animation-name:mini-hop-right}.mini-halo{position:absolute;inset:0 20px;background:radial-gradient(ellipse,#fbbf2428,transparent 65%);opacity:0;animation:mini-halo 13.5s ease infinite both}.mini-middle .mini-card{animation:mini-winner 13.5s ease infinite both}.mini-play{position:absolute;top:37px;left:130px;color:white;text-shadow:0 2px 8px #000;opacity:0;font-size:20px;animation:mini-play 13.5s ease infinite both}.mini-spark{position:absolute;color:#fbbf24;opacity:0;animation:mini-spark 13.5s ease infinite both}.spark-one{left:95px;top:10px;font-size:16px}.spark-two{left:173px;top:20px;font-size:21px}.spark-three{left:170px;top:65px;font-size:11px}.mini-agree{position:absolute;left:50%;bottom:5px;transform:translateX(-50%);display:flex;gap:5px;align-items:center;opacity:0;animation:mini-agree 13.5s ease infinite both;background:#17140b;border:1px solid #fbbf2440;padding:5px 9px;border-radius:20px;white-space:nowrap}.mini-agree i{height:7px;width:7px;border-radius:50%;background:#5c5132;animation:mini-pip 13.5s linear infinite both}.mini-agree i:nth-child(2){animation-delay:.35s}.mini-agree i:nth-child(3){animation-delay:.7s}.mini-agree span{font-size:10px;margin-left:3px;color:#fbbf24;opacity:0;animation:mini-word 13.5s linear infinite both}.mini-captions{position:relative;height:30px;text-align:center}.mini-caption{position:absolute;inset:0;font-size:22px;line-height:30px;letter-spacing:-.4px;opacity:0;animation:mini-caption-one 13.5s ease infinite both}.mini-caption strong{color:#fbbf24;font-weight:600}.mini-caption.second{animation-name:mini-caption-two}.mini-caption.third{animation-name:mini-caption-three}.mini-control{position:absolute;right:0;bottom:1px;width:32px;height:32px;background:transparent;color:#888;border:0;border-radius:50%;font-size:19px!important;display:grid;place-items:center}.mini-control:hover{color:#fbbf24;background:#222}.mini-paused,.mini-paused *{animation-play-state:paused!important}
@keyframes mini-clock{0%{opacity:0}3%,94%{opacity:1}99%,100%{opacity:0}}
@keyframes mini-flick{0.0%,5.333%{opacity:1;transform:rotate(var(--tilt))}9.333%{opacity:1;transform:translate(9px,-2px) rotate(8deg)}14.667%,100%{opacity:0;transform:translate(30px,-38px) rotate(22deg)}}
@keyframes mini-tap{0.0%,4.0%{opacity:0;transform:scale(.6)}6.667%,10.0%{opacity:.65;transform:scale(1)}14.667%,100%{opacity:0;transform:translate(22px,-38px) scale(.6)}}
@keyframes mini-gather{0.0%,21.333%{transform:translateX(0) rotate(0);opacity:1}30.667%,100%{transform:translateX(calc(var(--offset) * -1)) rotate(0);opacity:1}}
.mini-left .mini-deck,.mini-right .mini-deck{animation-name:mini-gather-side}
@keyframes mini-gather-side{0.0%,21.333%{transform:translateX(0);opacity:1}29.333%{opacity:.8}32.0%,100%{transform:translateX(calc(var(--offset) * -1)) scale(.95);opacity:0}}
@keyframes mini-winner{0.0%,24.667%{transform:scale(1);border-color:#ffffff40}31.333%{transform:scale(1.15);border-color:#fbbf24;box-shadow:0 0 20px #fbbf2433}36.0%,100%{transform:scale(1.08);border-color:#fbbf24;box-shadow:0 0 16px #fbbf2420}}
@keyframes mini-hop{0.0%,8.0%{transform:scale(1)}10.667%{transform:scale(1.14,.8)}14.0%{transform:translateY(-9px) scale(.95,1.1)}18.0%,39.333%{transform:scale(1)}43.333%,100%{transform:translateY(-5px) scale(.6);opacity:0}}
@keyframes mini-hop-left{0.0%,8.0%{transform:scale(1)}10.667%{transform:scale(1.14,.8)}14.0%{transform:translateY(-9px)}18.0%,21.333%{transform:scale(1)}31.333%,39.333%{transform:translateX(60px)}43.333%,100%{transform:translate(60px,-5px) scale(.6);opacity:0}}
@keyframes mini-hop-right{0.0%,8.0%{transform:scale(1)}10.667%{transform:scale(1.14,.8)}14.0%{transform:translateY(-9px)}18.0%,21.333%{transform:scale(1)}31.333%,39.333%{transform:translateX(-60px)}43.333%,100%{transform:translate(-60px,-5px) scale(.6);opacity:0}}
@keyframes mini-halo{0.0%,23.333%{opacity:0}31.333%{opacity:1}43.333%,100%{opacity:.6}}
@keyframes mini-spark{0.0%,28.667%{opacity:0;transform:scale(.3)}32.0%{opacity:1;transform:scale(1.2)}38.0%,100%{opacity:0;transform:translateY(-8px) scale(.7)}}
@keyframes mini-play{0.0%,53.333%{opacity:0;transform:scale(.5)}58.0%,100%{opacity:1;transform:scale(1)}}
@keyframes mini-agree{0%,40.667%{opacity:0}45.333%,59%{opacity:1}63%,100%{opacity:0}}
@keyframes mini-pip{0.0%,45.333%{background:#5c5132;transform:scale(1)}48.0%{background:#fbbf24;transform:scale(1.4)}50.667%,100%{background:#fbbf24;transform:scale(1)}}
@keyframes mini-word{0.0%,54.0%{opacity:0}57.333%,100%{opacity:1}}
@keyframes mini-caption-one{0.0%{opacity:0;transform:translateY(6px)}4.667%,20.0%{opacity:1;transform:translateY(0)}24.0%,100%{opacity:0;transform:translateY(-6px)}}
@keyframes mini-caption-two{0.0%,23.333%{opacity:0;transform:translateY(6px)}28.0%,40.667%{opacity:1;transform:translateY(0)}44.667%,100%{opacity:0;transform:translateY(-6px)}}
@keyframes mini-caption-three{0.0%,44.667%{opacity:0;transform:translateY(6px)}50.0%,100%{opacity:1;transform:translateY(0)}}
.mini-quiet .mini-film,.mini-quiet .mini-film *{animation:none!important}.mini-quiet .mini-left .mini-deck,.mini-quiet .mini-right .mini-deck,.mini-quiet .mini-flick,.mini-quiet .mini-face{display:none}.mini-quiet .mini-middle .mini-card{border-color:#fbbf24;transform:scale(1.08)}.mini-quiet .mini-play,.mini-quiet .mini-halo,.mini-quiet .mini-agree,.mini-quiet .mini-agree span,.mini-quiet .mini-caption.third{opacity:1}.mini-quiet .mini-agree i{background:#fbbf24}

.mini-person{animation:mini-cards-exit 13.5s ease infinite both}
@keyframes mini-cards-exit{0%,59%{opacity:1}64%,100%{opacity:0}}
.mini-tv{position:absolute;top:2px;left:48px;width:184px;height:110px;opacity:0;transform:scale(.65);animation:mini-tv-enter 13.5s cubic-bezier(.2,.8,.25,1) infinite both}
.mini-tv-screen{position:relative;width:184px;height:100px;border:4px solid #323234;border-bottom-width:7px;border-radius:9px;background:#08080c;overflow:hidden;box-shadow:0 0 30px #8472c32b,0 7px 16px #0008}
.tv-stand{position:absolute;bottom:0;left:68px;width:48px;height:12px;border-bottom:3px solid #444;background:linear-gradient(90deg,transparent 40%,#303032 40%,#303032 60%,transparent 60%);border-radius:3px}.tv-light{position:absolute;width:2px;height:2px;border-radius:50%;bottom:14px;right:20px;background:#ef4444}
.mini-movie{position:absolute;inset:0;background:linear-gradient(#1e2347,#65517c 70%,#c88b73);overflow:hidden;animation:movie-reveal 13.5s ease infinite both}
.movie-stars{position:absolute;width:2px;height:2px;background:#fff;border-radius:50%;left:18px;top:13px;box-shadow:22px 8px #fff8,49px -4px #fffb,91px 12px #fffa,119px -3px #fff8,137px 20px #fffc,9px 29px #fff7;animation:movie-stars 13.5s linear infinite both}
.movie-moon{position:absolute;width:34px;height:34px;right:31px;top:12px;border-radius:50%;background:#fff3cc;box-shadow:0 0 24px #ffdf8555;animation:movie-moon 13.5s linear infinite both}
.movie-range{position:absolute;width:250px;height:70px;left:-28px;bottom:-21px;clip-path:polygon(0 75%,15% 25%,28% 55%,43% 4%,60% 52%,76% 18%,100% 67%,100% 100%,0 100%);background:#343450;animation:movie-far 13.5s linear infinite both}.movie-range.near{background:#131a2a;bottom:-37px;left:-5px;animation-name:movie-near}.movie-comet{position:absolute;top:22px;left:22px;width:20px;height:1px;background:linear-gradient(90deg,transparent,#fff);transform:rotate(25deg);opacity:0;animation:movie-comet 13.5s ease infinite both}
.mini-stream-intro{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;background:#08080cdc;animation:stream-intro 13.5s ease infinite both}.mini-stream-intro b{font-size:18px;letter-spacing:3px;color:#e50914;font-weight:900;transform:scaleX(.9)}.stream-play{display:grid;place-items:center;width:21px;height:21px;border-radius:50%;background:#fff;color:#141414;font-size:10px;padding-left:2px}
.mini-player{position:absolute;bottom:3px;left:7px;right:7px;display:flex;align-items:center;gap:5px;color:#fff;font-size:8px;opacity:0;animation:player-on 13.5s ease infinite both}.mini-player i{height:2px;flex:1;background:#ffffff50;overflow:hidden}.mini-player i b{display:block;height:100%;width:22%;background:#e50914;transform-origin:left;animation:player-progress 13.5s linear infinite both}
@keyframes mini-tv-enter{0%,59%{opacity:0;transform:scale(.65) translateY(8px)}65%,100%{opacity:1;transform:scale(1) translateY(0)}}
@keyframes stream-intro{0%,65%{opacity:1}71%,100%{opacity:0}}
@keyframes movie-reveal{0%,65%{opacity:.2}72%,100%{opacity:1}}
@keyframes movie-moon{0%,65%{transform:translate(9px,2px)}100%{transform:translate(-5px,-2px)}}
@keyframes movie-stars{0%,65%{transform:translateX(0)}100%{transform:translateX(-8px)}}
@keyframes movie-far{0%,65%{transform:translateX(0)}100%{transform:translateX(-18px)}}
@keyframes movie-near{0%,65%{transform:translateX(0)}100%{transform:translateX(-42px)}}
@keyframes movie-comet{0%,76%{opacity:0;transform:translate(0,0) rotate(25deg)}77%{opacity:1}83%,100%{opacity:0;transform:translate(63px,24px) rotate(25deg)}}
@keyframes player-on{0%,70%{opacity:0}75%,100%{opacity:.85}}
@keyframes player-progress{0%,70%{transform:scaleX(.2)}100%{transform:scaleX(2.2)}}
.mini-quiet .mini-film{opacity:1}.mini-quiet .mini-person,.mini-quiet .mini-agree,.mini-quiet .mini-stream-intro{display:none}.mini-quiet .mini-tv{opacity:1;transform:none}.mini-quiet .mini-movie,.mini-quiet .mini-player{opacity:1}

@media(max-width:760px){.home-landing main{gap:18px;padding:16px 0}.mini-intro{height:144px}.mini-stage{height:113px;transform:scale(.94);transform-origin:50% 0}.mini-captions{margin-top:-4px}.mini-caption{font-size:20px}}
@media(max-height:700px){.home-landing main{gap:14px;padding:12px 0}.mini-intro{height:130px}.mini-stage{height:104px;transform:scale(.86);transform-origin:50% 0}.mini-caption{font-size:19px}}
@media(prefers-reduced-motion:reduce){.mini-film,.mini-film *{animation-duration:.001s!important;animation-delay:0s!important}}

.home-landing .mini-control{position:absolute;left:50%;top:45px;bottom:auto;right:auto;transform:translateX(-50%);width:46px;height:46px;border-radius:50%;border:1px solid #ffffff50;background:#080808c9;color:#fff;box-shadow:0 3px 16px #0007;display:grid;place-items:center;opacity:0;pointer-events:none;transition:opacity .16s}
.home-landing .mini-control:focus-visible,.home-landing .mini-touch-controls .mini-control,.home-landing .mini-user-paused .mini-control{opacity:1;pointer-events:auto}
@media(hover:hover){.home-landing .mini-intro:hover .mini-control{opacity:1;pointer-events:auto}}
@media(prefers-reduced-motion:reduce){.home-landing .mini-control{transition:none}}

/* Review v2: GoodWatch-like holds, eased departures and gentle movement while reading. */
.mini-film,.mini-film *{animation-duration:18s}
.mini-card{z-index:1}.mini-flick{z-index:3;background:linear-gradient(155deg,#343244,#191825)}
.mini-yep{position:absolute;inset:0;z-index:2;border:1px solid #ffffff40;border-radius:6px;overflow:hidden;background:linear-gradient(155deg,#23463e,#0c171b);box-shadow:0 5px 12px #0006;animation:mini-yep 18s cubic-bezier(.22,1,.36,1) infinite both;animation-delay:var(--delay)}
.mini-flick{animation-timing-function:cubic-bezier(.22,1,.36,1)}
.mini-vote-mark{position:absolute;top:7px;left:3px;right:3px;text-align:center;border:1.5px solid currentColor;border-radius:3px;font:900 12px/1.5 GabaritoBold,system-ui;letter-spacing:.2px;transform:rotate(-9deg);opacity:0}
.mini-vote-nope{color:#fff;background:#dc2626d9;animation:mini-nope-mark 18s ease infinite both;animation-delay:var(--delay)}
.mini-vote-yep{color:#fff;background:#15803de8;transform:rotate(9deg);animation:mini-yep-mark 18s ease infinite both;animation-delay:var(--delay)}
@keyframes mini-clock{0%{opacity:0}4%,96%{opacity:1}100%{opacity:0}}
@keyframes mini-flick{0%,6%{opacity:1;transform:rotate(var(--tilt))}9%{opacity:1;transform:translate(-9px,1px) rotate(-9deg)}14%,100%{opacity:0;transform:translate(-84px,-12px) rotate(-27deg)}}
@keyframes mini-nope-mark{0%,6%{opacity:0}8%,13%{opacity:1}15%,100%{opacity:0}}
@keyframes mini-yep{0%,20%{opacity:1;transform:rotate(var(--tilt))}23%{opacity:1;transform:translate(10px,-2px) rotate(10deg)}28%,100%{opacity:0;transform:translate(84px,-14px) rotate(27deg)}}
@keyframes mini-yep-mark{0%,20%{opacity:0}22%,27%{opacity:1}29%,100%{opacity:0}}
@keyframes mini-tap{0%,5%{opacity:0;transform:translate(0,0) scale(.7)}7%,10%{opacity:.6;transform:translate(-8px,0) scale(1)}14%,19%{opacity:0;transform:translate(-70px,-12px) scale(.6)}20%{opacity:0;transform:translate(0,0) scale(.7)}22%,24%{opacity:.6;transform:translate(10px,-2px) scale(1)}28%,100%{opacity:0;transform:translate(70px,-12px) scale(.6)}}
@keyframes mini-gather{0%,34%{transform:translateX(0);opacity:1}42%,100%{transform:translateX(calc(var(--offset) * -1));opacity:1}}
@keyframes mini-gather-side{0%,34%{transform:translateX(0);opacity:1}40%{opacity:.8}43%,100%{transform:translateX(calc(var(--offset) * -1)) scale(.95);opacity:0}}
@keyframes mini-winner{0%,35%{transform:scale(1);border-color:#ffffff40}43%{transform:scale(1.12);border-color:#fbbf24;box-shadow:0 0 20px #fbbf2433}49%,100%{transform:scale(1.16);border-color:#fbbf24;box-shadow:0 0 16px #fbbf2420}}
@keyframes mini-hop{0%,22%{transform:scale(1)}24%{transform:scale(1.12,.84)}26%{transform:translateY(-8px)}30%,53%{transform:scale(1)}60%,100%{transform:translateY(-4px) scale(.6);opacity:0}}
@keyframes mini-hop-left{0%,22%{transform:scale(1)}24%{transform:scale(1.12,.84)}26%{transform:translateY(-8px)}30%,34%{transform:scale(1)}42%,53%{transform:translateX(60px)}60%,100%{transform:translate(60px,-4px) scale(.6);opacity:0}}
@keyframes mini-hop-right{0%,22%{transform:scale(1)}24%{transform:scale(1.12,.84)}26%{transform:translateY(-8px)}30%,34%{transform:scale(1)}42%,53%{transform:translateX(-60px)}60%,100%{transform:translate(-60px,-4px) scale(.6);opacity:0}}
@keyframes mini-halo{0%,35%{opacity:0}44%{opacity:1}60%,100%{opacity:.6}}
@keyframes mini-spark{0%,40%{opacity:0;transform:scale(.3)}44%{opacity:1;transform:scale(1.2)}50%,100%{opacity:0;transform:translateY(-8px) scale(.7)}}
@keyframes mini-agree{0%,50%{opacity:0}53%,61%{opacity:1}65%,100%{opacity:0}}
@keyframes mini-pip{0%,52%{background:#5c5132;transform:scale(1)}54%{background:#fbbf24;transform:scale(1.4)}57%,100%{background:#fbbf24;transform:scale(1)}}
@keyframes mini-word{0%,57%{opacity:0}60%,100%{opacity:1}}
@keyframes mini-caption-one{0%{opacity:0;transform:translateY(6px)}5%,29%{opacity:1;transform:translateY(0)}33%,100%{opacity:0;transform:translateY(-6px)}}
@keyframes mini-caption-two{0%,31%{opacity:0;transform:translateY(6px)}36%,57%{opacity:1;transform:translateY(0)}61%,100%{opacity:0;transform:translateY(-6px)}}
@keyframes mini-caption-three{0%,61%{opacity:0;transform:translateY(6px)}66%,100%{opacity:1;transform:translateY(0)}}
@keyframes mini-cards-exit{0%,62%{opacity:1}67%,100%{opacity:0}}
@keyframes mini-tv-enter{0%,63%{opacity:0;transform:scale(.65) translateY(8px)}71%{opacity:1;transform:scale(1)}100%{opacity:1;transform:scale(1.025)}}
@keyframes stream-intro{0%,70%{opacity:1}76%,100%{opacity:0}}
@keyframes movie-reveal{0%,70%{opacity:.2}77%,100%{opacity:1}}
@keyframes movie-moon{0%,70%{transform:translate(9px,2px)}100%{transform:translate(-5px,-2px)}}
@keyframes movie-stars{0%,70%{transform:translateX(0)}100%{transform:translateX(-8px)}}
@keyframes movie-far{0%,70%{transform:translateX(0)}100%{transform:translateX(-18px)}}
@keyframes movie-near{0%,70%{transform:translateX(0)}100%{transform:translateX(-42px)}}
@keyframes movie-comet{0%,81%{opacity:0;transform:translate(0,0) rotate(25deg)}82%{opacity:1}88%,100%{opacity:0;transform:translate(63px,24px) rotate(25deg)}}
@keyframes player-on{0%,75%{opacity:0}80%,100%{opacity:.85}}
@keyframes player-progress{0%,75%{transform:scaleX(.2)}100%{transform:scaleX(2.2)}}
.mini-quiet .mini-yep{display:none}
`;
