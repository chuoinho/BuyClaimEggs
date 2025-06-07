// ==UserScript==
// @name         Auto Buy & Claim Egg
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Tự động mua mèo, claim trứng to, claim mèo Ninja, hiện log các kiểu rất chuyên nghiệp.
// @author       Boo
// @match        *://*.cryptokitties.dapperlabs.com/*
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function () {
  "use strict";

  // ------ CONFIG ------
  const config = {
    buy_cat: "page",
    total: 3,
    buyDelay: 2,    // Delay giữa các lần mua (giây)
    claimDelay: 2,  // Delay giữa các lần claim (giây)
    apiBase: "https://zenegg-api.production.cryptokitties.dapperlabs.com/egg/api/den",
    token: Telegram.WebView.initParams.tgWebAppData,
    isRunning: false,           // Script mua trứng đang chạy
    isBigEggAutoActive: false   // BEA đã được kích hoạt hay chưa
  };

  // ------ GLOBAL VARIABLES cho BEA ------
  let bigEggAutoInterval = null;
  let fancyClaimed = false;     // Đánh dấu đã claim Fancy trong chu kỳ hiện tại hay chưa

  // ------ LOG STATE & FUNCTIONS ------
  const logState = { cat: "", BEA: "" };
  const refreshLog = () => {
    const L = document.getElementById("logDisplay");
    if (L) {
      L.textContent = "📜 Log: " + (config.isRunning ? logState.cat : logState.BEA);
    }
  };
  const updateCatLog = msg => { logState.cat = msg; if (config.isRunning) refreshLog(); };
  const updateBEALog = msg => { if (!config.isRunning) { logState.BEA = msg; refreshLog(); } };

  // ------ UTILS ------
  const setStyle = (el, s) => Object.assign(el.style, s);
  const delay = s => new Promise(r => setTimeout(r, s * 1000));
  const pad = n => String(n).padStart(2, "0");
  const formatDuration = sec => {
    sec = Math.max(0, Math.ceil(sec));
    return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`;
  };

  // --- TẠO INPUT CÓ NHÃN ---
  function createLabelInput(labelText, defaultValue) {
    const wrapper = document.createElement("div");
    setStyle(wrapper, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%"
    });
    const label = document.createElement("label");
    label.textContent = labelText;
    setStyle(label, { fontSize: "13px", fontWeight: "bold" });
    const input = document.createElement("input");
    input.type = "number";
    input.value = defaultValue;
    input.min = 1;
    setStyle(input, {
      width: "50px",
      textAlign: "center",
      padding: "3px",
      border: "1px solid #ccc",
      borderRadius: "3px",
      background: "#f9f9f9"
    });
    wrapper.append(label, input);
    return { wrapper, input };
  }

  // ------ GM_xmlhttpRequest Utility ------
  const gmRequest = (method, url, data = null) =>
    new Promise(resolve => {
      GM_xmlhttpRequest({
        method,
        url,
        headers: {
          Accept: "*/*",
          "Content-Type": "application/json",
          "X-ID-Token": config.token,
          "X-App-Version": new Date().toISOString().replace(/[-:.TZ]/g, "")
        },
        data: data ? JSON.stringify(data) : null,
        onload: res => {
          try { resolve(JSON.parse(res.responseText)); }
          catch (e) { console.error(e); resolve({}); }
        },
        onerror: err => { console.error(err); resolve({}); }
      });
    });

  // ------ API FUNCTIONS ------
  const fetchAPI = (endpoint, body = {}) => gmRequest("POST", `${config.apiBase}/${endpoint}`, body);
  const fetchGameInfo = () => gmRequest("GET", config.apiBase);
  const getNextPetMs = game => {
    const raw = game?.zen_den?.regenesis_egg_status?.next_pet_timestamp;
    if (!raw) { console.error("Missing next_pet_timestamp"); return 0; }
    return (typeof raw === "string" && raw.includes("T"))
      ? (Date.parse(raw) || 0)
      : (Number(raw) < 1e12 ? Number(raw) * 1000 : Number(raw));
  };
  const buyBigEgg = () => gmRequest("POST", `${config.apiBase}/gently-stroke-the-regenesis-egg`);
  const claimZenModeTaoAPI = () => gmRequest("POST", `${config.apiBase}/claim-zen-mode-tao`);
  const claimFancyParadeKitty = kittyId =>
    gmRequest("POST", `${config.apiBase}/claim-fancy-parade-kitty`, { fancy_parade_kitty_claim_id: kittyId });
  const claimFancyParadeKitties = async () => {
    const game = await fetchGameInfo();
    const paradeKitties = game?.zen_den?.claimable_fancy_parade_kitties || [];
    for (const kitty of paradeKitties)
      if (kitty?.id) { await claimFancyParadeKitty(kitty.id); await delay(3); }
  };

  async function runScript() {
    config.isRunning = true;
    updateCatLog("Script mua trứng bắt đầu chạy…");
    for (let i = 0; i < config.total; i++) {
      if (!config.isRunning) return updateCatLog("☹ Script mua trứng đã dừng.");
      await fetchAPI("buy-fancy-egg", { cat_category: config.buy_cat, quantity: 1 });
      updateCatLog(`🥚 Đã mua ${i + 1}/${config.total}`);
      await delay(config.buyDelay);
      if (!config.isRunning) return updateCatLog("☹ Script mua trứng đã dừng.");
      const data = await fetchAPI("claim-tao");
      const claimed = data.claim?.zen_claimed || 0;
      updateCatLog(`✅ Đã claim ${i + 1}/${config.total}: +${claimed} ZEN`);
      await delay(config.claimDelay);
    }
    updateCatLog("✅ Script mua trứng đã hoàn thành!");
    config.isRunning = false;
  }

  // ------ Big Egg Auto CONTROL ------
  function startBigEggAuto() {
    bigEggAutoInterval = setInterval(async () => {
      const game = await fetchGameInfo();
      if (!game) { if (!config.isRunning) updateBEALog("BEA: ⚠️ Không lấy được game info"); return; }
      const nextMs = getNextPetMs(game);
      const diffSec = (nextMs - Date.now()) / 1000;
      if (diffSec > 0) {
        if (diffSec <= 600 && !fancyClaimed) { await claimFancyParadeKitties(); fancyClaimed = true; }
        if (!config.isRunning) updateBEALog(`BEA: Chưa đến hạn: còn ${formatDuration(diffSec)}`);
      } else {
        if (!config.isRunning) updateBEALog("BEA: Đến hạn, tự claim Big Egg…");
        try {
          await buyBigEgg();
          await delay(1); // Delay 1 giây
          await claimZenModeTaoAPI();
          fancyClaimed = false;
        } catch (e) { console.error("[buyBigEgg error]", e); }
      }
    }, 1000);
  }
  function stopBigEggAuto() {
    if (bigEggAutoInterval) { clearInterval(bigEggAutoInterval); bigEggAutoInterval = null; }
  }

  // ------ UI CREATION ------
  async function createUI() {
    const eggShopData = (await gmRequest("GET", config.apiBase)).zen_den?.egg_shop || [];
    let cats = [...new Set(eggShopData.map(e => e.cat_category))];
    if (!cats.length) cats = ["page"];
    config.buy_cat = cats[0];

    const container = document.createElement("div");
    setStyle(container, {
      position: "fixed",
      left: "20px",
      width: "240px",
      background: "#fff",
      border: "1px solid #ccc",
      borderRadius: "5px",
      boxShadow: "0 0 10px rgba(0,0,0,0.1)",
      zIndex: "1000"
    });
    const header = document.createElement("div");
    setStyle(header, {
      background: "#28a745",
      color: "#fff",
      padding: "8px",
      cursor: "move",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopLeftRadius: "5px",
      borderTopRightRadius: "5px"
    });
    header.textContent = "Auto Buy & Claim Eggs";
    const minBtn = document.createElement("button");
    minBtn.textContent = "🔽";
    setStyle(minBtn, { background: "transparent", border: "none", color: "#fff", cursor: "pointer" });
    header.appendChild(minBtn);

    const content = document.createElement("div");
    setStyle(content, { display: "flex", flexDirection: "column", gap: "5px", padding: "5px" });

    const selWrap = document.createElement("div");
    setStyle(selWrap, { display: "flex", alignItems:"center" });
    const selLabel = document.createElement("label");
    selLabel.textContent = "Chọn mèo:";
    setStyle(selLabel, { fontSize: "13px", fontWeight: "bold", marginRight: "4px" });
    const select = document.createElement("select");
    setStyle(select, { width: "110px", padding: "4px", border: "1px solid #ccc", borderRadius: "3px" });
    cats.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
      select.appendChild(opt);
    });
    const refreshBtn = document.createElement("button");
    refreshBtn.innerHTML = "🔄";
    refreshBtn.title = "Làm mới danh sách";
    setStyle(refreshBtn, { color: "#fff", border: "none", cursor: "pointer", fontSize: "12px", padding: "4px 6px", borderRadius: "3px", marginLeft: "8px" });
    refreshBtn.onclick = async () => {
      updateCatLog("Đang làm mới danh sách mèo...");
      const newGameInfo = await fetchGameInfo();
      let newCats = (newGameInfo?.zen_den?.egg_shop || []).map(e => e.cat_category);
      newCats = [...new Set(newCats)];
      if (!newCats.length) return updateCatLog("⚠️ Làm mới thất bại");
      select.innerHTML = "";
      newCats.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
        select.appendChild(opt);
      });
      config.buy_cat = newCats[0];
      updateCatLog("✅ Đã làm mới danh sách!");
    };
    selWrap.append(selLabel, select, refreshBtn);

    const input1 = createLabelInput("Số lần mua:", config.total);
    const input2 = createLabelInput("Chờ mua (s):", config.buyDelay);
    const input3 = createLabelInput("Chờ claim (s):", config.claimDelay);
    const cfgCol = document.createElement("div");
    setStyle(cfgCol, { display: "flex", flexDirection: "column", gap: "5px" });
    cfgCol.append(input1.wrapper, input2.wrapper, input3.wrapper);

    const toggleBtn = document.createElement("button");
    toggleBtn.innerHTML = "🚀 Chạy";
    setStyle(toggleBtn, { background: "#28a745", color: "#fff", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: "5px" });
    toggleBtn.onclick = async () => {
      if (config.isRunning) {
        config.isRunning = false;
        updateCatLog("Đang dừng script mua trứng...");
        toggleBtn.innerHTML = "🚀 Chạy";
      } else {
        config.buy_cat = select.value;
        config.total = parseInt(input1.input.value, 10);
        config.buyDelay = parseInt(input2.input.value, 10);
        config.claimDelay = parseInt(input3.input.value, 10);
        toggleBtn.innerHTML = "⏹ Dừng";
        await runScript();
        toggleBtn.innerHTML = "🚀 Chạy";
      }
    };

    const bigEggBtn = document.createElement("button");
    bigEggBtn.innerHTML = "🐣 Big Egg Auto";
    setStyle(bigEggBtn, { background: "#ff8c00", color: "#fff", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: "5px" });
    bigEggBtn.onclick = async () => {
      if (!config.isBigEggAutoActive) {
        config.isBigEggAutoActive = true;
        fancyClaimed = false;
        bigEggBtn.innerHTML = "⏹ Big Egg Auto";
        updateBEALog("BEA: Auto bật…");
        startBigEggAuto();
      } else {
        config.isBigEggAutoActive = false;
        stopBigEggAuto();
        bigEggBtn.innerHTML = "🐣 Big Egg Auto";
        updateBEALog("BEA: Auto tắt.");
      }
    };

    const logDisplay = document.createElement("div");
    logDisplay.id = "logDisplay";
    logDisplay.textContent = "📜 Log: Chưa có hoạt động";
    setStyle(logDisplay, { fontSize: "9px", fontStyle: "italic", color: "#555" });

    content.append(selWrap, cfgCol, toggleBtn, bigEggBtn, logDisplay);
    const ui = document.createElement("div");
    ui.append(header, content);
    container.append(ui);
    document.body.append(container);
    container.style.top = window.innerHeight - container.offsetHeight - 20 + "px";
    container.style.left = "20px";
    makeDraggable(container);

    let minimized = false;
    minBtn.onclick = () => {
      minimized = !minimized;
      content.style.display = minimized ? "none" : "flex";
      minBtn.textContent = minimized ? "🔼" : "🔽";
    };
    window.addEventListener("resize", () => clampElement(container));
  }

  function init() {
    try { createUI(); }
    catch (e) { console.error("Lỗi tạo UI:", e); }
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
