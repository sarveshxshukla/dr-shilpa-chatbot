/* DSF-WIDGET-VERSION: 2026-11-27-dsf-2 */
/* Dr Shilpa Fertility chat widget — paste ONE script tag on the site:
   <script src="https://YOUR-APP-URL/widget.js" defer></script>
   Incremental rendering: messages are appended, never re-drawn, so typing is never interrupted. */
(function () {
  var API = (function () { try { if (document.currentScript && document.currentScript.src) return new URL(document.currentScript.src).origin; } catch (e) {} return "https://bot.drshilpafertility.com"; })();
  var SID = localStorage.getItem("dsf_sid");
  if (!SID) { SID = "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem("dsf_sid", SID); }
  var LOGKEY = "dsf_log_" + SID;
  var msgs = []; try { msgs = JSON.parse(localStorage.getItem(LOGKEY) || "[]"); } catch (e) {}
  var savedContact = null; try { savedContact = JSON.parse(localStorage.getItem("dsf_contact") || "null"); } catch (e) {}
  var savedName = (savedContact && savedContact.name) || "";
  var intakeDone = !!savedContact;
  var rendered = {};   // ts -> already in the DOM
  var seen = {};       // ts -> already known (event de-dupe)
  msgs.forEach(function (m) { if (m.ts) seen[m.ts] = 1; });
  var mode = "ai", open = false, started = false, listening = false, recog = null, pollTimer = null;

  var CFG_GREETING = "";
  var CFG = { assistant: "Asha", clinic: "Dr Shilpa Fertility", phone: "+91 98775 14819", phoneLink: "+919877514819", whatsapp: "919877514819", privacy: "https://www.drshilpafertility.com/privacy-policy/" };
  try { fetch(API + "/api/config").then(function (r) { return r.json(); }).then(function (c) { if (!c) return; if (c.greeting) CFG_GREETING = c.greeting; ["assistant","clinic","phone","phoneLink","whatsapp","privacy"].forEach(function (k) { if (c[k]) CFG[k] = c[k]; }); var st = document.getElementById("dsf-stt"); if (st && mode !== "human") st.textContent = CFG.assistant + " \u00b7 replies instantly"; }).catch(function () {}); } catch (e) {}
  
  /* Indian mobile (10 digits starting 6-9, with or without +91/0) or an international number with a + country code */
  function inPhone(raw) {
    var t = String(raw || "").trim(), d = t.replace(/[^\d+]/g, "");
    if (/^(\+|00)/.test(d) && !/^(\+|00)91/.test(d)) { d = "+" + d.replace(/^\+|^00/, "").replace(/\D/g, ""); return (d.length >= 9 && d.length <= 16) ? d : null; }
    d = d.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
    return /^[6-9]\d{9}$/.test(d) ? d : null;
  }

  function greet(fn) {
    if (CFG_GREETING) return CFG_GREETING.replace(/\{\s*name\s*\}/gi, fn || "").replace(/\s+/g, " ").trim();
    return "Hi " + fn + "! 👋 I'm " + CFG.assistant + " from " + CFG.clinic + ". How can I help you today?";
  }

  var C = { teal: "#13606B", tealDeep: "#0E3B43", coral: "#C2502F", coralDeep: "#A6411F",
    launch: "#13606B", launchDeep: "#0E3B43",
    ink: "#1F2A2E", mint: "#E3EFF0", line: "#E7E1DA", muted: "#5E6C70", bg: "#FCFAF7" };

  /* ===== PHONE SIZE SETTINGS (edit these 3 numbers only if you want it bigger/smaller) ===== */
  var AUTO_OPEN_DESKTOP = true; // open the chat automatically for new visitors on computers (phones get a small "Chat with us" note instead)
  var M_WIDTH  = "76vw";   // panel width on phones (76vw = about 305px on an iPhone 17 Pro)
  var M_HEIGHT = "520px";  // tallest the panel can get on phones
  var M_BOTTOM = "84px";   // gap from the bottom of the screen (keeps it above the site's Call/WhatsApp/Book bar)

  var css = "" +
    "#dsfw,#dsfw *{box-sizing:border-box;font-family:'Mulish',-apple-system,Segoe UI,Roboto,sans-serif}" +
    /* stop the page's own text settings (centred text, big line spacing etc.) leaking into the widget */
    "#dsfw{text-align:left!important;line-height:1.4;letter-spacing:normal;word-spacing:normal;text-transform:none;font-weight:400;color:" + C.ink + ";font-size:15px}" +
    "#dsfw div,#dsfw span,#dsfw p{text-align:left!important}" +
    "#dsfw button,#dsfw .dsf-fbtn,#dsfw .dsf-chip,#dsfw .dsf-cta{text-align:center!important}" +
    "#dsfw .dsf-fn{text-align:center!important}" +
    "#dsf-btn.hidden{opacity:0;visibility:hidden;pointer-events:none}" +
    "#dsf-btn{position:fixed;right:18px;bottom:96px;width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;z-index:2147483000;box-shadow:0 10px 26px rgba(19,96,107,.45);background:linear-gradient(135deg," + C.launch + "," + C.launchDeep + ");animation:dsfnudge 6s ease-in-out infinite;display:flex;align-items:center;justify-content:center;transition:transform .2s}" +
    "#dsf-btn:hover{filter:brightness(1.14)}" +
    "#dsf-btn::after{content:'';position:absolute;inset:0;border-radius:50%;pointer-events:none;animation:dsfring 2.6s cubic-bezier(.25,.6,.35,1) infinite}" +
    "@keyframes dsfring{0%{box-shadow:0 0 0 0 rgba(19,96,107,.55)}70%{box-shadow:0 0 0 18px rgba(19,96,107,0)}100%{box-shadow:0 0 0 0 rgba(19,96,107,0)}}" +
    "@keyframes dsfnudge{0%,86%,100%{transform:translateY(0)}90%{transform:translateY(-8px)}94%{transform:translateY(-3px)}}" +
    "@media(prefers-reduced-motion:reduce){#dsf-btn,#dsf-btn::after{animation:none}}" +
    "#dsf-pop{position:fixed;right:18px;bottom:164px;max-width:235px;background:#fff;color:" + C.ink + ";border:1px solid " + C.line + ";padding:12px 30px 12px 14px;border-radius:16px 16px 4px 16px;box-shadow:0 12px 34px rgba(14,59,67,.22);z-index:2147482999;cursor:pointer;font-size:14px;line-height:1.45;display:none}" +
    "#dsf-pop.on{display:block;animation:dsfup .3s ease}" +
    "#dsf-pop::after{content:'';position:absolute;right:41px;bottom:-7px;width:13px;height:13px;background:#fff;border-right:1px solid " + C.line + ";border-bottom:1px solid " + C.line + ";border-radius:0 0 3px 0;transform:rotate(45deg)}" +
    "#dsf-pop b{color:" + C.launch + ";font-size:12.5px;display:block;margin-bottom:2px}" +
    "#dsf-pop .x{position:absolute;top:5px;right:9px;font-size:17px;color:" + C.muted + ";line-height:1}" +
    
    /* Premium Floating Panel Overlay */
    "#dsf-panel{position:fixed;bottom:95px;right:18px;width:calc(100vw - 36px);max-width:390px;height:calc(100vh - 115px);height:calc(100dvh - 115px);max-height:720px;background:#fff;border:none;border-radius:24px;overflow:hidden;display:none;flex-direction:column;z-index:2147483005;box-shadow:0 18px 50px rgba(14,59,67,.18), 0 0 0 1px rgba(14,59,67,.05)}" +
    "#dsf-panel.fit{height:auto!important;max-height:calc(100vh - 100px)}" +"#dsf-panel.fit #dsf-body{flex:1 1 auto;overflow-y:auto;min-height:0}" +
    "#dsf-panel.on{display:flex;animation:dsfup .25s ease}" +
    "@keyframes dsfup{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}" +
    
    "#dsf-head{position:relative;z-index:6;padding:18px 20px;display:flex;align-items:center;gap:14px;background:#fff;border-bottom:1px solid #EEF2F2}" +
    "#dsf-head .av{width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg," + C.teal + "," + C.tealDeep + ");display:flex;align-items:center;justify-content:center;flex-shrink:0}" +
    "#dsf-head .nm{color:#1f2937;font-weight:700;font-size:17px;line-height:1.2}" +
    "#dsf-head .st{color:#8a94a0;font-size:13px;display:flex;align-items:center;gap:6px;margin-top:3px}" +
    "#dsf-head.human{background:linear-gradient(135deg," + C.coralDeep + ",#7E3218)}#dsf-head.human .st{color:#FBE3D9}" +
    "#dsf-book{background:#0E3B43;border:none;color:#fff;cursor:pointer;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-left:auto;flex-shrink:0}" +
    "#dsf-x{margin-left:8px;background:#0E3B43;border:none;color:#fff;cursor:pointer;font-size:24px;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .12s,color .12s}#dsfw #dsf-x:hover{background:#E3EFF0!important}" +
    
    "#dsf-body{flex:1;overflow-y:auto;padding:24px 20px;display:flex;flex-direction:column;gap:16px;background:#fff;-webkit-overflow-scrolling:touch}" +
    ".dsf-row{display:flex;gap:8px;align-items:flex-end;animation:dsfin .25s ease}" +
    ".dsf-row.me{justify-content:flex-end}" +
    ".dsf-wrap{max-width:82%}" +
    "@keyframes dsfin{from{opacity:0;transform:translateY(6px)}to{opacity:1}}" +
    ".dsf-b{width:fit-content;min-width:0;padding:10px 14px;font-size:14.5px;line-height:1.5;white-space:normal;overflow-wrap:break-word;word-break:normal;hyphens:none}" +
    ".dsf-b.bot{background:#f4f6f8;color:#2b3138;border:none;border-radius:4px 18px 18px 18px}" +
    ".dsf-b.me{background:" + C.teal + ";color:#fff;border-radius:18px 4px 18px 18px}" +
    ".dsf-b.team{background:#FBF1EC;color:" + C.ink + ";border:1px solid #F4D3C4;border-top:2px solid " + C.coral + ";border-radius:16px 16px 16px 4px}" +
    ".dsf-team-l{font-size:11px;font-weight:700;color:" + C.coralDeep + ";margin:0 0 3px 2px}" +
    ".dsf-sys{align-self:center;font-size:11.5px;color:" + C.muted + ";background:#EEF2F2;padding:4px 11px;border-radius:20px}" +
    ".dsf-av{display:none}" +
    "#dsf-chips{padding:10px 14px 12px;display:flex;flex-wrap:wrap;gap:7px}#dsf-chips:empty{padding:0}" +
    ".dsf-chip{padding:8px 15px;font-size:13.5px;font-weight:500;border-radius:22px;background:#fff;color:" + C.teal + ";border:1.5px solid #BFD8DB;cursor:pointer}" +
    ".dsf-chip:hover{transform:translateY(-1px)}" +
    ".dsf-cta{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;font-size:13px;font-weight:600;border-radius:20px;background:#C2502F;color:#fff !important;border:1px solid #C2502F;text-decoration:none;cursor:pointer;transition:background .12s}" +
    ".dsf-cta:hover{background:#A6411F}" +
    "#dsfw .dsf-cta.wa{background:#1E8E52!important;border-color:#1E8E52!important}" +
    "body.nav-open #dsf-btn,body.nav-open #dsf-pop{display:none!important}" +
    "#dsf-foot{padding:12px 14px;display:flex;align-items:center;gap:10px;border-top:1px solid #EEF2F2;background:#fff}" +
    "#dsf-inwrap{flex:1;min-width:0;display:flex;align-items:center;gap:4px;background:#F1F4F4;border:none;border-radius:24px;padding:0 6px 0 16px}" +
    "#dsf-in{flex:1;min-width:0;border:none;outline:none;padding:11px 0;font-size:16px;background:transparent;color:" + C.ink + "}" +
    ".dsf-ic{width:30px;height:30px;border:none;background:none;cursor:pointer;border-radius:50%;display:flex;align-items:center;justify-content:center}" +
    ".dsf-ic.on{background:#FBF1EC}" +
    "#dsf-send{width:46px;height:46px;border:none;border-radius:50%;cursor:pointer;background:" + C.teal + ";display:flex;align-items:center;justify-content:center;flex-shrink:0}" +
    ".dsf-dot{width:6px;height:6px;border-radius:50%;background:#2E8592;display:inline-block;animation:dsfd 1s infinite}" +
    "@keyframes dsfd{0%,60%,100%{opacity:.4;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}" +
    "#dsf-form{position:absolute;left:0;right:0;top:83px;bottom:0;background:#fff;z-index:5;display:flex;flex-direction:column;animation:dsfin .2s ease}" +
    "#dsf-intake{flex:1;min-height:0;display:flex;flex-direction:column;padding:0;width:100%;animation:dsfin .2s ease}" +
    ".dsf-fh{padding:16px 20px;font-weight:700;font-size:16px;background:#fff;border-bottom:1px solid " + C.line + ";display:flex;align-items:center;color:" + C.ink + "}" +
    ".dsf-fh button{margin-left:auto;background:none;border:none;font-size:22px;cursor:pointer;color:" + C.ink + ";opacity:.6}" +
    
    /* Birdeye Premium Single-Line Inputs (Armored) */
    ".dsf-fb{flex:1;min-height:0;padding:20px 20px 22px;display:flex;flex-direction:column;gap:4px;overflow-y:auto}" +
    "#dsfw .dsf-fi{display:block!important;width:100%!important;height:auto!important;padding:12px 0 9px!important;margin:0 0 6px!important;border:0!important;border-bottom:1px solid #D5DDDE!important;border-radius:0!important;outline:none!important;-webkit-appearance:none!important;appearance:none!important;font-size:16px!important;line-height:1.3!important;background:transparent!important;color:" + C.ink + "!important;box-shadow:none!important;transition:border-color .2s ease,box-shadow .2s ease!important}" +
    "#dsfw .dsf-fi:focus,#dsfw .dsf-fi:focus-visible{border-bottom-color:" + C.coral + "!important;box-shadow:0 1px 0 0 " + C.coral + "!important;outline:none!important}" +
    "#dsfw .dsf-fi::placeholder{color:#8A9699!important;opacity:1!important;font-weight:400!important}" +
    "#dsfw select.dsf-fi{padding-right:22px!important;cursor:pointer;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235E6C70' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")!important;background-repeat:no-repeat!important;background-position:right 2px center!important}" +
    "#dsfw textarea.dsf-fi{resize:none!important;overflow:hidden!important;min-height:0!important}" +
    "#dsfw .dsf-iw>*,#dsfw .dsf-fb>*{flex-shrink:0!important}" +
    "#dsfw .dsf-fbtn{margin-top:16px!important}" +
    "#dsfw #dsf-book{margin-left:auto!important}" +
    "#dsfw .dsf-fh button{margin-left:auto!important;width:30px!important;height:30px!important;padding:0!important;background:none!important;border:none!important;box-shadow:none!important;font-size:22px!important;color:" + C.ink + "!important}" +
    
    ".dsf-seg{display:flex;gap:10px;margin-bottom:10px}.dsf-seg button{flex:1;padding:12px;border:1px solid " + C.line + ";background:#fff;border-radius:10px;cursor:pointer;font-size:14px;color:" + C.muted + "}.dsf-seg button.on{background:" + C.teal + ";color:#EAFBF8;border-color:" + C.teal + "}" +
    ".dsf-fbtn{padding:16px!important;border:none!important;border-radius:14px!important;background:" + C.coral + "!important;color:#fff!important;font-weight:700!important;cursor:pointer!important;font-size:16px!important;letter-spacing:.01em!important;transition:background .15s, transform .15s!important;margin-top:14px!important;box-shadow:0 6px 18px rgba(194,80,47,.22)!important;width:100%!important}" +
    ".dsf-fbtn:hover{background:" + C.coralDeep + "!important;transform:translateY(-1px)!important}" +
    ".dsf-fbtn:active{opacity:.92}" +
    ".dsf-fn{font-size:12px;color:" + C.muted + ";text-align:center;margin-top:10px}" +
    "#dsfw .dsf-fn a{color:" + C.teal + ";text-decoration:underline}" +
    
    "#dsf-body.intake{padding:0}" +
    ".dsf-iw{position:relative;display:flex;flex-direction:column;padding:26px 24px 22px;min-height:0}" +
    ".dsf-it{font-weight:800;font-size:22px;color:" + C.ink + ";line-height:1.3;letter-spacing:-.02em;margin-bottom:8px}" +
    ".dsf-isub{font-size:14.5px;color:" + C.muted + ";margin:0 0 20px;line-height:1.45}" +
    ".dsf-ita{font-family:inherit}" +
    ".dsf-ierr{font-size:12.5px;color:#C0392B;margin:4px 0 2px;line-height:1.4}.dsf-ierr:empty{display:none}" +
    "@keyframes dsfspin{to{transform:rotate(360deg)}}" +
    
    /* ---- armor: stop the host theme's button/link CSS bleeding into the widget ---- */
    "#dsfw button,#dsfw a,#dsfw input,#dsfw textarea{font-family:inherit!important;text-transform:none!important;letter-spacing:normal!important;text-shadow:none!important;margin:0!important;min-width:0!important;min-height:0!important;line-height:normal!important}" +
    "#dsfw #dsf-btn{width:60px!important;height:60px!important;padding:0!important;border:none!important;border-radius:50%!important;background:linear-gradient(135deg," + C.launch + "," + C.launchDeep + ")!important;box-shadow:0 10px 26px rgba(19,96,107,.45)!important}" +
    "#dsfw #dsf-btn svg{display:block!important;width:30px!important;height:30px!important;opacity:1!important;visibility:visible!important}" +
    "#dsfw #dsf-head .av svg{display:block!important;width:24px!important;height:24px!important;opacity:1!important;visibility:visible!important}" +
    "#dsfw svg{vertical-align:middle;max-width:none!important}" +
    "#dsfw .dsf-chip{background:#fff!important;color:" + C.teal + "!important;padding:6px 12px!important;font-size:13px!important;font-weight:500!important;border:1px solid " + C.line + "!important;border-radius:20px!important;width:auto!important;height:auto!important;box-shadow:none!important;text-align:center}" +
    "#dsfw .dsf-cta{background:#C2502F!important;color:#fff!important;padding:6px 12px!important;font-size:13px!important;font-weight:600!important;border:1px solid #C2502F!important;border-radius:20px!important;width:auto!important;height:auto!important;box-shadow:none!important}" +
    "#dsfw #dsf-send{width:46px!important;height:46px!important;padding:0!important;border:none!important;border-radius:50%!important;background:" + C.teal + "!important;box-shadow:none!important}" +
    "#dsfw .dsf-ic{width:30px!important;height:30px!important;padding:0!important;border:none!important;border-radius:50%!important;background:none!important;box-shadow:none!important}" +
    "#dsfw .dsf-ic.on{background:#FBF1EC!important}" +
    "#dsfw #dsf-book{width:40px!important;height:40px!important;padding:0!important;border-radius:50%!important;background:#0E3B43!important;border:none!important;color:#fff!important;box-shadow:none!important;display:flex!important;align-items:center;justify-content:center;flex-shrink:0}" +
    "#dsfw #dsf-x{width:40px!important;height:40px!important;padding:0!important;border-radius:50%!important;background:#EEF2F2!important;border:none!important;color:" + C.ink + "!important;box-shadow:none!important;display:flex!important;align-items:center;justify-content:center;flex-shrink:0;font-size:24px!important;margin-left:8px!important}" +
    "#dsfw #dsf-book svg{width:22px!important;height:22px!important}" +

    /* ===== PREMIUM HEADER ===== */
    "#dsfw #dsf-head{padding:16px 14px 16px 18px!important;gap:12px!important;background:linear-gradient(180deg,#F1F7F7 0%,#FFFFFF 100%)!important;border-bottom:1px solid #E7E1DA!important}" +
    "#dsfw #dsf-head.human{background:linear-gradient(180deg,#FBF1EC 0%,#FFFFFF 100%)!important}" +
    "#dsfw #dsf-head.human .st{color:" + C.coralDeep + "!important}" +
    "#dsfw #dsf-head .avw{position:relative;flex-shrink:0}" +
    "#dsfw #dsf-head .av{width:42px;height:42px;border-radius:50%;background:linear-gradient(140deg,#2E8592,#0E3B43);box-shadow:0 4px 12px rgba(14,59,67,.26),inset 0 0 0 1px rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center}" +
    "#dsfw #dsf-head .av svg{width:22px!important;height:22px!important}" +
    "#dsfw #dsf-dot2{position:absolute;right:-1px;bottom:0;width:12px;height:12px;border-radius:50%;background:#22c55e;border:2px solid #fff}" +
    "#dsfw #dsf-head .hd{flex:1;min-width:0}" +
    "#dsfw #dsf-head .nm{color:#0E3B43;font-weight:700;font-size:15.5px;letter-spacing:-.015em;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    "#dsfw #dsf-head .st{color:#5E6C70;font-size:12.5px;margin-top:2px;display:flex;align-items:center;gap:5px;white-space:nowrap}" +
    "#dsfw #dsf-head .st .sd{display:none;width:6px;height:6px;border-radius:50%;background:#22c55e;flex-shrink:0}" +
    "#dsfw #dsf-book{width:36px!important;height:36px!important;border-radius:12px!important;background:#E3EFF0!important;color:" + C.coralDeep + "!important;margin-left:0!important;transition:background .15s!important}" +
    "#dsfw #dsf-book:hover{background:#CFE3E5!important}" +
    "#dsfw #dsf-book svg{width:18px!important;height:18px!important}" +
    "#dsfw #dsf-x{width:36px!important;height:36px!important;border-radius:12px!important;background:transparent!important;color:#6B7A7E!important;margin-left:0!important;transition:background .15s,color .15s!important}" +
    "#dsfw #dsf-x:hover{background:#EEF2F2!important;color:" + C.ink + "!important}" +
    "#dsfw #dsf-x svg{width:16px!important;height:16px!important;display:block}" +

    /* ===== PHONES: larger panel in the bottom-right corner ===== */
    "@media (max-width:600px){" +
      "#dsfw #dsf-panel{right:16px;bottom:" + M_BOTTOM + ";width:" + M_WIDTH + ";min-width:216px;max-width:340px;height:min(" + M_HEIGHT + ",calc(100vh - 140px));height:min(" + M_HEIGHT + ",calc(100dvh - 140px));max-height:none;border-radius:20px;box-shadow:0 16px 40px rgba(31,42,46,.20),0 0 0 1px rgba(31,42,46,.05)}" +
      "#dsfw #dsf-panel.fit{height:min(" + M_HEIGHT + ",calc(100vh - 140px))!important;height:min(" + M_HEIGHT + ",calc(100dvh - 140px))!important;max-height:none}" +
      "#dsfw .dsf-iw{flex:1 0 auto}" +
      "#dsfw .dsf-iw .dsf-fbtn{margin-top:auto!important}" +
      "#dsfw #dsf-head{padding:11px 8px 11px 14px!important;gap:6px!important}" +
      "#dsfw #dsf-head .avw{display:none}" +
      "#dsfw #dsf-head .nm{font-size:13.5px}" +
      "#dsfw #dsf-head .st{font-size:11px;margin-top:1px}" +
      "#dsfw #dsf-head .st .sd{display:inline-block}" +
      "#dsfw #dsf-book,#dsfw #dsf-x{width:30px!important;height:30px!important;border-radius:10px!important}" +
      "#dsfw #dsf-book svg{width:16px!important;height:16px!important}" +
      "#dsfw #dsf-x svg{width:14px!important;height:14px!important}" +
      "#dsfw .dsf-iw{padding:14px 14px 14px}" +
      "#dsfw .dsf-it{font-size:15px;letter-spacing:-.01em;margin-bottom:4px;line-height:1.25}" +
      "#dsfw .dsf-isub{font-size:11.5px;line-height:1.4;margin:0 0 4px}" +
      "#dsfw .dsf-fi{padding:9px 0 6px!important;margin:0 0 4px!important}" +
      "#dsfw .dsf-fbtn{padding:11px!important;font-size:14.5px!important;border-radius:12px!important;margin-top:10px!important}" +
      "#dsfw .dsf-ierr{font-size:11.5px}" +
      "#dsfw .dsf-fh{padding:10px 12px;font-size:14px}" +
      "#dsfw .dsf-fb{padding:10px 14px 14px}" +
      "#dsfw .dsf-fn{font-size:11px;margin-top:8px}" +
      "#dsfw .dsf-seg{gap:6px;margin:6px 0 2px}#dsfw .dsf-seg button{padding:8px 4px!important;font-size:12px!important;border-radius:9px!important}" +
      "#dsfw #dsf-body{padding:14px 12px;gap:10px}" +
      "#dsfw #dsf-body.intake{padding:0}" +
      "#dsfw .dsf-wrap{max-width:88%}" +
      "#dsfw .dsf-b{font-size:13.5px;padding:8px 11px;line-height:1.45}" +
      "#dsfw #dsf-chips{padding:6px 10px 8px;gap:5px}#dsfw #dsf-chips:empty{padding:0}" +
      "#dsfw .dsf-chip,#dsfw .dsf-cta{padding:5px 10px!important;font-size:12px!important}" +
      "#dsfw #dsf-foot{padding:8px 8px 8px 10px;gap:6px}" +
      "#dsfw #dsf-inwrap{padding:0 4px 0 12px}" +
      "#dsfw #dsf-in{padding:8px 0}" +
      "#dsfw .dsf-ic{width:26px!important;height:26px!important}" +
      "#dsfw #dsf-send{width:36px!important;height:36px!important}" +
    "}";

  var spark = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EAFBF8" stroke-width="2.2"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4L12 3z"/></svg>';
  
  var bubbleIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/></svg>';
  var toothLogo = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="width:30px;height:30px;display:block;margin:auto;"><path d="M12 20.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.8a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10-7.5 10z"/><path d="M19 1.8l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z" fill="#fff"/></svg>';
  var sparkSm = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#EAFBF8" stroke-width="2.2"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4L12 3z"/></svg>';
  var head = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M3 14v-2a9 9 0 0118 0v2"/><path d="M21 16a2 2 0 01-2 2h-1v-5h1a2 2 0 012 2zM3 16a2 2 0 002 2h1v-5H5a2 2 0 00-2 2z"/></svg>';
  var calI = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M16 3v4M8 3v4M3.5 10.5h17"/><path d="M9 15l2 2 4-4"/></svg>';
  var xI = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var micI = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5E6C70" stroke-width="2"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0014 0M12 17v4"/></svg>';
  var sendI = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#EAFBF8" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';

  var root = document.createElement("div"); root.id = "dsfw"; root.setAttribute("role", "region"); root.setAttribute("aria-label", "Chat with " + (CFG.assistant || "Asha"));
  root.innerHTML =
    '<style>' + css + '</style>' +
    '<button id="dsf-btn" aria-label="Chat with us">' + bubbleIcon + '</button>' +
    '<div id="dsf-pop"><span class="x" id="dsf-popx">&times;</span><b>Dr Shilpa Fertility</b>Questions about fertility or IVF? Chat with us 💬</div>' +
    '<div id="dsf-panel">' +
      '<div id="dsf-head"><div class="avw"><div class="av">' + toothLogo + '</div><span id="dsf-dot2"></span></div>' +
        '<div class="hd"><div class="nm">Dr Shilpa Fertility</div>' +
        '<div class="st"><span class="sd"></span><span id="dsf-stt">Asha \u00b7 replies instantly</span></div></div>' +
        '<button id="dsf-book" title="Book a consultation" aria-label="Book a consultation">' + calI + '</button>' +
        '<button id="dsf-x" aria-label="Close">' + xI + '</button></div>' +
      '<div id="dsf-body"></div>' +
      '<div id="dsf-chips"></div>' +
      '<div id="dsf-foot"><div id="dsf-inwrap"><input id="dsf-in" placeholder="Type a message" autocomplete="off"/>' +
        '<button class="dsf-ic" id="dsf-mic" title="Voice">' + micI + '</button></div>' +
        '<button id="dsf-send">' + sendI + '</button></div>' +
    '</div>';
  document.body.appendChild(root);

  var $ = function (id) { return document.getElementById(id); };
  var body = $("dsf-body"), chipsEl = $("dsf-chips");
  
  var pop = $("dsf-pop"), popx = $("dsf-popx");
  var popDismissed = false;
  if (popx) popx.onclick = function (e) { e.stopPropagation(); pop.className = ""; popDismissed = true; };
  if (pop) pop.onclick = function () { pop.className = ""; $("dsf-btn").click(); };

  function persist() { try { localStorage.setItem(LOGKEY, JSON.stringify(msgs.slice(-60))); } catch (e) {} }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function buildRow(m) {
    if (m.role === "system") return el("div", "dsf-sys", esc(m.text));
    var row = el("div", "dsf-row" + (m.role === "user" ? " me" : ""));
    if (m.role !== "user") row.appendChild(el("div", "dsf-av", m.role === "team" ? head : sparkSm));
    var wrap = el("div", "dsf-wrap");
    if (m.role === "team") wrap.appendChild(el("div", "dsf-team-l", "Clinic team"));
    var cls = m.role === "user" ? "me" : (m.role === "team" ? "team" : "bot");
    wrap.appendChild(el("div", "dsf-b " + cls, esc(m.text)));
    row.appendChild(wrap);
    return row;
  }
  
  function addRow(m) {
    if (rendered[m.ts]) return;
    rendered[m.ts] = 1;
    var anchor = $("dsf-typing");
    var node = buildRow(m);
    if (anchor) body.insertBefore(node, anchor); else body.appendChild(node);
  }
  function scrollDown() { requestAnimationFrame(function () { body.scrollTop = body.scrollHeight; }); }
  function renderChips() {
    chipsEl.innerHTML = "";
    var last = msgs[msgs.length - 1];
    if (!last || last.role !== "bot") return;
    if (last.chips) last.chips.forEach(function (c) { var b = el("button", "dsf-chip", esc(c)); b.onclick = function () { sendMsg(c); }; chipsEl.appendChild(b); });
    if (last.cta && last.cta.action === "book") { var bb = el("button", "dsf-cta", esc(last.cta.label || "Book a consultation")); bb.type = "button"; bb.onclick = openBook; chipsEl.appendChild(bb); }
    else if (last.cta && last.cta.url) { var a = el("a", "dsf-cta" + (last.cta.kind === "wa" ? " wa" : ""), esc(last.cta.label || "Book online")); a.href = last.cta.url; if (!/^tel:/.test(last.cta.url)) { a.target = "_blank"; a.rel = "noopener noreferrer"; } chipsEl.appendChild(a); }
  }
  function sync() { var added = false; msgs.forEach(function (m) { if (!rendered[m.ts]) { addRow(m); added = true; } }); if (added) { renderChips(); scrollDown(); } }

  function push(role, text, extra) {
    var m = Object.assign({ role: role, text: text, ts: Date.now() + Math.random() }, extra || {});
    msgs.push(m); seen[m.ts] = 1; persist();
    addRow(m); renderChips(); scrollDown();
  }
  function typing(on) {
    var ex = $("dsf-typing"); if (ex) ex.remove();
    if (!on) return;
    var row = el("div", "dsf-row"); row.id = "dsf-typing";
    row.appendChild(el("div", "dsf-av", sparkSm));
    var wrap = el("div", "dsf-wrap");
    wrap.appendChild(el("div", "dsf-b bot", '<span class="dsf-dot"></span> <span class="dsf-dot" style="animation-delay:.15s"></span> <span class="dsf-dot" style="animation-delay:.3s"></span>'));
    row.appendChild(wrap);
    body.appendChild(row); scrollDown();
  }
  function setMode(m) {
    if (m === mode) return; mode = m;
    $("dsf-head").className = m === "human" ? "human" : "";
    $("dsf-stt").textContent = m === "human" ? "Clinic team online" : CFG.assistant + " \u00b7 replies instantly";
    $("dsf-dot2").style.background = "#22c55e";
    $("dsf-head").querySelector(".av").innerHTML = m === "human" ? head : toothLogo;
  }

  function prewarm() { try { fetch(API + "/api/ping").catch(function () {}); } catch (e) {} }

  async function sendMsg(text) {
    text = (text || "").trim(); if (!text) return;
    push("user", text);
    chipsEl.innerHTML = "";
    typing(true);
    
    var payload = { sessionId: SID, message: text };
    if (savedContact) payload.contact = savedContact;
    if (msgs.length > 0) payload.history = msgs;

    try {
      var r = await fetch(API + "/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      var d = await r.json();
      typing(false);
      if (d.mode) setMode(d.mode);
      if (d.reply) push("bot", d.reply, { chips: d.chips || [], cta: d.cta });
    } catch (e) { typing(false); push("bot", "Sorry, I couldn't connect just now — please call " + CFG.phone + " or WhatsApp us.", { chips: [], cta: { label: "\ud83d\udcde Call " + CFG.phone, url: "tel:" + CFG.phoneLink } }); }
  }

  var polling = false;
  function schedulePoll() { clearTimeout(pollTimer); pollTimer = null; if (open) pollTimer = setTimeout(poll, 4000); }
  async function poll() {
    if (polling) return;
    polling = true;
    try {
      var r = await fetch(API + "/api/poll?sessionId=" + encodeURIComponent(SID));
      var d = await r.json();
      
      if (d.deleted) {
        msgs = [];
        seen = {};
        rendered = {};
        localStorage.removeItem(LOGKEY);
        body.innerHTML = "";
        chipsEl.innerHTML = "";
        started = false;
        if (open) {
          push("bot", CFG_GREETING ? greet(savedName ? savedName.split(" ")[0] : "") : ("Welcome back" + (savedName ? ", " + savedName.split(" ")[0] : "") + "! 😊 How can I help you today?"), { chips: ["Book a consultation", "IVF cost", "About Dr Shilpa", "Clinic timings"] });
        }
        return;
      }

      if (d.mode) setMode(d.mode);
      var fresh = false;
      (d.events || []).forEach(function (ev) { if (seen[ev.ts]) return; seen[ev.ts] = 1; msgs.push({ role: ev.role, text: ev.text, ts: ev.ts }); fresh = true; });
      if (fresh) { persist(); sync(); }   
    } catch (e) {
    } finally {
      polling = false;
      schedulePoll();
    }
  }


  // --- direct booking form ---
  function closeBook() { var f = $("dsf-form"); if (f) f.remove(); }
  function openBook() {
    if ($("dsf-form")) return;
    var svcs = ["First fertility consultation", "IVF / ICSI", "IUI", "Egg or embryo freezing", "PCOS / irregular periods", "Low AMH", "Male infertility", "Repeated IVF failure / second opinion", "Pregnancy care", "Gynaecology problem", "Cosmetic gynaecology", "Something else"];
    var whens = ["As soon as possible", "This week", "Next week", "Online consultation", "I'm flexible"];
    var f = el("div"); f.id = "dsf-form";
    f.innerHTML = '<div class="dsf-fh">Book a consultation <button id="dsf-fx" aria-label="Close">&times;</button></div>' +
      '<div class="dsf-fb">' +
      '<input class="dsf-fi" id="bk-name" placeholder="Full name *"/>' +
      '<input class="dsf-fi" id="bk-phone" placeholder="Mobile number *" inputmode="tel" autocomplete="tel"/>' +
      '<input class="dsf-fi" id="bk-email" placeholder="Email (optional)"/>' +
      '<select class="dsf-fi" id="bk-svc"><option value="">What is it about? *</option>' + svcs.map(function (o) { return '<option>' + o + '</option>'; }).join("") + '</select>' +
      '<select class="dsf-fi" id="bk-when"><option value="">When suits you?</option>' + whens.map(function (o) { return '<option>' + o + '</option>'; }).join("") + '</select>' +
      '<div class="dsf-seg"><button data-pt="New patient" class="on">New patient</button><button data-pt="Existing patient">Existing patient</button></div>' +
      '<button id="bk-send" class="dsf-fbtn">Send request</button>' +
      '<div class="dsf-fn">The clinic will call to confirm. Urgent? Call ' + esc(CFG.phone) + '.<br>By sending you agree to our <a href="' + esc(CFG.privacy) + '" target="_blank" rel="noopener">privacy policy</a>.</div></div>';
    $("dsf-panel").appendChild(f);
    try { f.style.top = $("dsf-head").offsetHeight + "px"; } catch (e) {}
    var pt = "New patient";
    f.querySelectorAll("[data-pt]").forEach(function (b) { b.onclick = function () { pt = b.getAttribute("data-pt"); f.querySelectorAll("[data-pt]").forEach(function (x) { x.className = ""; }); b.className = "on"; }; });
    $("dsf-fx").onclick = closeBook;
    $("bk-send").onclick = function () {
      var name = $("bk-name").value.trim(), phone = $("bk-phone").value.trim(), email = $("bk-email").value.trim(), svc = $("bk-svc").value, when = $("bk-when").value;
      if (!name || !phone || !svc) { $("bk-send").textContent = "Please add name, phone & service"; return; }
      var bkP = inPhone(phone);
      if (!bkP) { $("bk-send").textContent = "Enter a valid mobile number"; setTimeout(function () { $("bk-send").textContent = "Send request"; }, 2600); try { $("bk-phone").focus(); } catch (e) {} return; }
      phone = bkP;
      $("bk-send").textContent = "Sending…"; $("bk-send").disabled = true;
      fetch(API + "/api/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: SID, name: name, phone: phone, email: email, service: svc, when: when, patientType: pt }) })
        .then(function (r) { return r.json(); })
        .then(function () { closeBook(); push("bot", "Thank you, " + name.split(" ")[0] + "! Your request is in — our team will call " + phone + " to confirm a time. Anything else I can help with? 😊", { chips: ["Clinic timings", "Where is the clinic?"] }); })
        .catch(function () { $("bk-send").textContent = "Try again"; $("bk-send").disabled = false; });
    };
  }

  // --- intake form: capture name/mobile/email up-front, then start the chat ---
  function showIntake() {
    body.innerHTML = "";
    $("dsf-foot").style.display = "none";   // hide the message bar until details are in
    chipsEl.style.display = "none";
    body.className = "intake";
    var pn = $("dsf-panel"); if (pn) pn.className = (pn.className.replace(/\bfit\b/,"").trim() + " fit").trim();
    var f = el("div"); f.id = "dsf-intake";
    f.innerHTML = '<div class="dsf-iw">' +
      '<div class="dsf-it">Please share your details</div>' +
      '<div class="dsf-isub">🔒 Private and confidential — only used to help with your enquiry.</div>' +
      '<input class="dsf-fi" id="in-name" placeholder="Name *" autocomplete="name"/>' +
      '<input class="dsf-fi" id="in-phone" placeholder="Mobile number *" inputmode="tel" autocomplete="tel"/>' +
      '<input class="dsf-fi" id="in-email" placeholder="Email (optional)" inputmode="email" autocomplete="email"/>' +
      '<textarea class="dsf-fi dsf-ita" id="in-msg" rows="1" placeholder="Your question *"></textarea>' +
      '<div class="dsf-ierr" id="in-err"></div>' +
      '<button id="in-send" class="dsf-fbtn">Start chat →</button>' +
      '<div class="dsf-fn">By starting the chat you agree to be contacted about your enquiry and to our <a href="' + esc(CFG.privacy) + '" target="_blank" rel="noopener">privacy policy</a>.</div>' +
      '</div>';
    body.appendChild(f);
    $("in-send").onclick = submitIntake;
    var ta = $("in-msg"); if (ta) ta.addEventListener("input", function () { ta.style.setProperty("height", "auto", "important"); ta.style.setProperty("height", Math.min(ta.scrollHeight + 2, 96) + "px", "important"); ta.style.setProperty("overflow", ta.scrollHeight > 96 ? "auto" : "hidden", "important"); });
    try { $("in-name").focus(); } catch (e) {}
  }
  function submitIntake() {
    var name = $("in-name").value.trim(), phone = $("in-phone").value.trim(), email = $("in-email").value.trim(), msg = $("in-msg").value.trim();
    var err = $("in-err");
    if (!name || !phone || !msg) { err.textContent = "Please add your name, mobile number and your question."; return; }
    var auP = inPhone(phone);
    if (!auP) { err.textContent = "Please enter a 10-digit mobile number, or include your country code (+) if you're outside India."; try { $("in-phone").focus(); } catch (e) {} return; }
    phone = auP;
    if (email && !/.+@.+\..+/.test(email)) { err.textContent = "That email doesn't look right."; return; }
    $("in-send").textContent = "Starting…"; $("in-send").disabled = true;
    fetch(API + "/api/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: SID, name: name, phone: phone, email: email, message: msg }) })
      .then(function (r) { return r.json(); })
      .then(function () {
        try { localStorage.setItem("dsf_contact", JSON.stringify({ name: name, phone: phone, email: email })); } catch (e) {}
        intakeDone = true; savedName = name; savedContact = { name: name, phone: phone, email: email };
        var fm = $("dsf-intake"); if (fm) fm.remove();
        var pn2 = $("dsf-panel"); if (pn2) pn2.className = pn2.className.replace(/\bfit\b/,"").trim();
        body.className = "";
        body.className = "";
        $("dsf-foot").style.display = ""; chipsEl.style.display = "";
        var fn = name.split(" ")[0];
        if (msg) { push("bot", "Hi " + fn + "! 👋", {}); sendMsg(msg); }   
        else push("bot", greet(fn), { chips: ["Book a consultation", "IVF cost", "About Dr Shilpa", "Clinic timings"] });
      })
      .catch(function () { $("in-send").textContent = "Try again"; $("in-send").disabled = false; });
  }

  function toggleMic() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { push("system", "Voice needs Chrome or Edge — type away instead."); return; }
    if (listening) { recog && recog.stop(); return; }
    recog = new SR(); recog.lang = "en-IN"; recog.interimResults = true;
    recog.onresult = function (e) { var s = ""; for (var i = 0; i < e.results.length; i++) s += e.results[i][0].transcript; $("dsf-in").value = s; };
    recog.onend = function () { listening = false; $("dsf-mic").className = "dsf-ic"; };
    try { recog.start(); listening = true; $("dsf-mic").className = "dsf-ic on"; } catch (e) {}
  }

  // --- website forms hand their conversation to the widget (see the site's site.js) ---
  function adoptForm(d) {
    if (!d || !d.reply) return;
    if (d.sessionId && d.sessionId !== SID) {
      SID = d.sessionId; LOGKEY = "dsf_log_" + SID;
      try { localStorage.setItem("dsf_sid", SID); } catch (e) {}
      msgs = []; rendered = {}; seen = {}; body.innerHTML = ""; chipsEl.innerHTML = "";
    }
    if (d.contact && d.contact.name) {
      savedContact = d.contact; savedName = d.contact.name; intakeDone = true;
      try { localStorage.setItem("dsf_contact", JSON.stringify(d.contact)); } catch (e) {}
    }
    var fm = $("dsf-intake");
    if (fm) { fm.remove(); body.className = ""; $("dsf-foot").style.display = ""; chipsEl.style.display = ""; var pn = $("dsf-panel"); if (pn) pn.className = pn.className.replace(/\bfit\b/, "").trim(); }
    started = true;
    if (d.userText) push("user", d.userText);
    push("bot", d.reply, { chips: d.chips || [] });
  }
  window.DSFChat = {
    adopt: adoptForm,
    open: function () { if (!open) $("dsf-btn").click(); },
    ask: function (q) { if (!open) $("dsf-btn").click(); if (q) sendMsg(q); }
  };

  // --- wiring ---
  $("dsf-btn").onclick = function () {
    open = !open; $("dsf-panel").className = open ? "on" : "";
    $("dsf-btn").className = open ? "hidden" : "";
    if (open) {
      if (pop) pop.className = ""; 
      prewarm();
      if (!intakeDone && !msgs.length) { started = true; showIntake(); }
      else if (!started) {
        started = true;
        if (msgs.length) sync();                                  
        else if (!intakeDone) showIntake();                       
        else { 
          try { fetch(API + "/api/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: SID, name: savedContact.name, phone: savedContact.phone, email: savedContact.email, silent: true }) }).catch(function(){}); } catch (e) {}
          push("bot", CFG_GREETING ? greet(savedName ? savedName.split(" ")[0] : "") : ("Welcome back" + (savedName ? ", " + savedName.split(" ")[0] : "") + "! 😊 How can I help you today?"), { chips: ["Book a consultation", "IVF cost", "About Dr Shilpa", "Clinic timings"] });
        }
      }
      clearTimeout(pollTimer); poll();
    } else { clearTimeout(pollTimer); }
  };
  
  $("dsf-x").onclick = function () { 
    open = false; 
    $("dsf-panel").className = ""; 
    $("dsf-btn").className = ""; 
    clearTimeout(pollTimer); 
    
    if (!popDismissed) {
      setTimeout(function() { if (!open) pop.className = "on"; }, 400);
    }
  };
  
  $("dsf-book").onclick = openBook;
  $("dsf-send").onclick = function () { var v = $("dsf-in").value; $("dsf-in").value = ""; sendMsg(v); };
  $("dsf-in").addEventListener("keydown", function (e) { if (e.key === "Enter") { var v = this.value; this.value = ""; sendMsg(v); } });
  if ($("dsf-mic")) $("dsf-mic").onclick = toggleMic;
  
  (function () {
    var isPhone = window.matchMedia && window.matchMedia("(max-width: 767px)").matches;
    /* If the visitor starts filling in one of the website's own forms, get out of the way:
       don't auto-open, and close the chat if it opened by itself and they haven't typed in it. */
    var autoOpened = false, usingSiteForm = false;
    document.addEventListener("focusin", function (e) {
      var t = e.target; if (!t || !t.closest || !t.closest("form") || t.closest("#dsfw")) return;
      usingSiteForm = true;
      if (open && autoOpened) {
        var typed = false; ["in-name", "in-phone", "in-email", "in-msg"].forEach(function (id) { var x = $(id); if (x && x.value.trim()) typed = true; });
        if (!typed && !msgs.length) { open = false; $("dsf-panel").className = ""; $("dsf-btn").className = ""; clearTimeout(pollTimer); started = false; }
        autoOpened = false;
      }
    });
    if (!intakeDone && AUTO_OPEN_DESKTOP && !isPhone) {
      setTimeout(function () { if (!open && !usingSiteForm) { autoOpened = true; $("dsf-btn").click(); } }, 800);
    } else {
      setTimeout(function () { if (!open && !popDismissed) pop.className = "on"; }, 2500);
    }
  })();

  prewarm();
})();
