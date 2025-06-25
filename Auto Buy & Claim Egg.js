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
    buyDelay: 2,
    claimDelay: 2,
    apiBase: "https://zenegg-api.production.cryptokitties.dapperlabs.com/egg/api/den",
    token: Telegram.WebView.initParams.tgWebAppData,
    isRunning: false,
    isBigEggAutoActive: false
  };

  // ------ GLOBAL VARIABLES ------
  let bigEggAutoInterval = null;
  let fancyClaimed = false;

  // ------ LOG STATE ------
  const logState = { cat: "", BEA: "" };
  let refreshLogTimeout = null;

  const refreshLog = () => {
    if (refreshLogTimeout) return;
    refreshLogTimeout = setTimeout(() => {
      const logElement = document.getElementById("logDisplay");
      if (logElement) {
        const message = config.isRunning ? logState.cat : logState.BEA;
        logElement.textContent = message;
      }
      refreshLogTimeout = null;
    }, 16);
  };

  const updateCatLog = msg => {
    logState.cat = msg;
    if (config.isRunning) refreshLog();
  };

  const updateBEALog = msg => {
    if (!config.isRunning) {
      logState.BEA = msg;
      refreshLog();
    }
  };

  // ------ UTILS ------
  const delay = s => new Promise(resolve => setTimeout(resolve, s * 1000));
  const pad = n => String(n).padStart(2, "0");
  const formatDuration = sec => {
    sec = Math.max(0, Math.ceil(sec));
    return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`;
  };

  // ------ COMPACT INPUT CREATION ------
  function createCompactInput(label, defaultValue, width = "40px") {
    const wrapper = document.createElement("div");
    wrapper.className = "compact-input-group";

    const labelEl = document.createElement("label");
    labelEl.textContent = label;
    labelEl.className = "compact-label";

    const input = document.createElement("input");
    input.type = "number";
    input.value = defaultValue;
    input.className = "compact-input";
    input.min = 1;
    input.style.width = width;

    wrapper.append(labelEl, input);
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
          try {
            const parsed = JSON.parse(res.responseText);
            resolve(parsed);
          } catch (e) {
            resolve({});
          }
        },
        onerror: err => {
          resolve({});
        }
      });
    });

  // ------ API FUNCTIONS ------
  const fetchAPI = (endpoint, body = {}) => gmRequest("POST", `${config.apiBase}/${endpoint}`, body);
  const fetchGameInfo = () => gmRequest("GET", config.apiBase);
  
  const getNextPetMs = game => {
    const raw = game?.zen_den?.regenesis_egg_status?.next_pet_timestamp;
    if (!raw) return 0;
    
    if (typeof raw === "string" && raw.includes("T")) {
      return Date.parse(raw) || 0;
    } else {
      return Number(raw) < 1e12 ? Number(raw) * 1000 : Number(raw);
    }
  };

  const buyBigEgg = () => gmRequest("POST", `${config.apiBase}/gently-stroke-the-regenesis-egg`);
  const claimZenModeTaoAPI = () => gmRequest("POST", `${config.apiBase}/claim-zen-mode-tao`);
  const claimFancyParadeKitty = kittyId =>
    gmRequest("POST", `${config.apiBase}/claim-fancy-parade-kitty`, { fancy_parade_kitty_claim_id: kittyId });

  const claimFancyParadeKitties = async () => {
    try {
      const game = await fetchGameInfo();
      const paradeKitties = game?.zen_den?.claimable_fancy_parade_kitties || [];
      if (paradeKitties.length === 0) return;
      
      for (const kitty of paradeKitties) {
        if (kitty?.id) {
          await claimFancyParadeKitty(kitty.id);
          await delay(1);
        }
      }
    } catch (error) {
      // Xử lý lỗi im lặng
    }
  };

  // ------ SCRIPT EXECUTION (LOGIC TUẦN TỰ) ------
  async function runScript() {
    config.isRunning = true;
    updateCatLog("⏳ Bắt đầu...");
    
    for (let i = 0; i < config.total; i++) {
      if (!config.isRunning) {
        updateCatLog("⏹ Đã dừng");
        break;
      }
      
      try {
        // BƯỚC 1: Mua trứng trước
        await fetchAPI("buy-fancy-egg", { cat_category: config.buy_cat, quantity: 1 });
        updateCatLog(`🥚 Đã mua ${i + 1}/${config.total}`);
        await delay(config.buyDelay);
        
        if (!config.isRunning) {
          updateCatLog("⏹ Đã dừng");
          break;
        }
        
        // BƯỚC 2: Claim sau
        const data = await fetchAPI("claim-tao");
        const claimed = data.claim?.zen_claimed || 0;
        updateCatLog(`✅ Đã claim ${i + 1}/${config.total}: +${claimed} ZEN`);
        await delay(config.claimDelay);
      } catch (error) {
        updateCatLog(`❌ Lỗi ${i + 1}`);
      }
    }
    
    updateCatLog("🎉 Hoàn thành!");
    config.isRunning = false;
  }

  // ------ BIG EGG AUTO CONTROL ------
  function startBigEggAuto() {
    if (bigEggAutoInterval) {
      clearInterval(bigEggAutoInterval);
    }
    
    bigEggAutoInterval = setInterval(async () => {
      try {
        const game = await fetchGameInfo();
        if (!game) {
          if (!config.isRunning) updateBEALog("⚠️ Lỗi API");
          return;
        }
        
        const nextMs = getNextPetMs(game);
        const diffSec = (nextMs - Date.now()) / 1000;
        
        if (diffSec > 0) {
          if (diffSec <= 600 && !fancyClaimed) {
            await claimFancyParadeKitties();
            fancyClaimed = true;
          }
          if (!config.isRunning) {
            const timeStr = formatDuration(diffSec);
            updateBEALog(`⏰ ${timeStr}`);
          }
        } else {
          if (!config.isRunning) updateBEALog("🥚 Claiming...");
          await buyBigEgg();
          await delay(1);
          await claimZenModeTaoAPI();
          fancyClaimed = false;
        }
      } catch (e) {
        // Lỗi được xử lý im lặng
      }
    }, 10000);
  }

  function stopBigEggAuto() {
    if (bigEggAutoInterval) {
      clearInterval(bigEggAutoInterval);
      bigEggAutoInterval = null;
    }
  }

  // ------ COMPACT UI CREATION ------
  async function createUI() {
    try {
      // Inject ultra-compact CSS
      const style = document.createElement('style');
      style.textContent = `
        .compact-container {
          position: fixed;
          left: 10px;
          width: 200px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          z-index: 10000;
          font-size: 11px;
        }
        .compact-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 6px 8px;
          cursor: move;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-radius: 8px 8px 0 0;
          font-weight: 600;
          font-size: 11px;
        }
        .compact-minimize {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
        }
        .compact-content {
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .compact-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .compact-select {
          flex: 1;
          min-width: 60px;
          padding: 4px 6px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          font-size: 10px;
          cursor: pointer;
        }
        .compact-select:focus {
          outline: none;
          border-color: #667eea;
        }
        .compact-refresh {
          background: #667eea;
          border: none;
          color: white;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 4px;
          font-size: 10px;
        }
        .compact-refresh:hover {
          background: #5a67d8;
        }
        .compact-input-row {
          display: flex;
          gap: 4px;
          align-items: center;
          flex-wrap: wrap;
        }
        .compact-input-group {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .compact-label {
          font-size: 9px;
          color: #666;
          white-space: nowrap;
        }
        .compact-input {
          padding: 2px 4px;
          border: 1px solid #ddd;
          border-radius: 3px;
          text-align: center;
          font-size: 10px;
        }
        .compact-input:focus {
          outline: none;
          border-color: #667eea;
        }
        .compact-btn {
          padding: 6px 8px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
          font-size: 10px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 3px;
          flex: 1;
        }
        .compact-btn:hover {
          transform: translateY(-1px);
        }
        .compact-btn-primary {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
        }
        .compact-btn-secondary {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
        }
        .compact-log {
          background: #f8f9fa;
          padding: 6px;
          border-radius: 4px;
          font-size: 9px;
          color: #666;
          border-left: 2px solid #667eea;
          font-family: monospace;
          min-height: 14px;
          display: flex;
          align-items: center;
        }
        @media (prefers-color-scheme: dark) {
          .compact-container {
            background: rgba(17, 24, 39, 0.98);
            border-color: rgba(75, 85, 99, 0.3);
          }
          .compact-input, .compact-select {
            background: rgba(31, 41, 55, 0.8);
            border-color: rgba(75, 85, 99, 0.5);
            color: white;
          }
          .compact-label {
            color: #d1d5db;
          }
          .compact-log {
            background: rgba(31, 41, 55, 0.8);
            color: #9ca3af;
          }
        }
      `;
      document.head.appendChild(style);

      const fragment = document.createDocumentFragment();
      const eggShopData = (await fetchGameInfo()).zen_den?.egg_shop || [];
      let cats = [...new Set(eggShopData.map(e => e.cat_category))];
      if (!cats.length) cats = ["page"];
      config.buy_cat = cats[0];

      // Main container
      const container = document.createElement("div");
      container.className = "compact-container";

      // Header
      const header = document.createElement("div");
      header.className = "compact-header";
      header.innerHTML = '<span>🥚 AutoEgg</span>';

      const minBtn = document.createElement("button");
      minBtn.className = "compact-minimize";
      minBtn.textContent = "⌄";
      header.appendChild(minBtn);

      // Content
      const content = document.createElement("div");
      content.className = "compact-content";

      // Cat selection row
      const selectRow = document.createElement("div");
      selectRow.className = "compact-row";
      const select = document.createElement("select");
      select.className = "compact-select";

      cats.forEach((cat) => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
        select.appendChild(opt);
      });

      const refreshBtn = document.createElement("button");
      refreshBtn.className = "compact-refresh";
      refreshBtn.innerHTML = "↻";
      refreshBtn.title = "Refresh";

      selectRow.append(select, refreshBtn);

      // Input row
      const inputRow = document.createElement("div");
      inputRow.className = "compact-input-row";

      const input1 = createCompactInput("SL", config.total, "30px");
      const input2 = createCompactInput("⌛mua:", config.buyDelay, "30px");
      const input3 = createCompactInput("⌛claim:", config.claimDelay, "30px");

      inputRow.append(input1.wrapper, input2.wrapper, input3.wrapper);

      // Button row
      const buttonRow = document.createElement("div");
      buttonRow.className = "compact-row";

      const toggleBtn = document.createElement("button");
      toggleBtn.className = "compact-btn compact-btn-primary";
      toggleBtn.innerHTML = "▶";

      const bigEggBtn = document.createElement("button");
      bigEggBtn.className = "compact-btn compact-btn-secondary";
      bigEggBtn.innerHTML = "🥚";

      buttonRow.append(toggleBtn, bigEggBtn);

      // Log display
      const logDisplay = document.createElement("div");
      logDisplay.id = "logDisplay";
      logDisplay.className = "compact-log";
      logDisplay.textContent = "Ready";

      // Assemble UI
      content.append(selectRow, inputRow, buttonRow, logDisplay);
      container.append(header, content);
      fragment.appendChild(container);

      // Add to DOM
      document.body.appendChild(fragment);
      container.style.top = window.innerHeight - container.offsetHeight - 10 + "px";
      makeDraggable(container);

      // Event handlers
      select.addEventListener('change', (e) => {
        config.buy_cat = e.target.value;
        updateCatLog(`Selected: ${e.target.value}`);
      });

      let refreshTimeout = null;
      refreshBtn.onclick = async () => {
        if (refreshTimeout) return;
        refreshTimeout = setTimeout(() => refreshTimeout = null, 2000);
        updateCatLog("Refreshing...");
        try {
          const newGameInfo = await fetchGameInfo();
          let newCats = (newGameInfo?.zen_den?.egg_shop || []).map(e => e.cat_category);
          newCats = [...new Set(newCats)];
          if (!newCats.length) {
            return updateCatLog("Refresh failed");
          }
          
          select.innerHTML = "";
          newCats.forEach(cat => {
            const opt = document.createElement("option");
            opt.value = cat;
            opt.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
            select.appendChild(opt);
          });
          
          config.buy_cat = newCats[0];
          updateCatLog("Refreshed");
        } catch (error) {
          updateCatLog("Refresh error");
        }
      };

      toggleBtn.onclick = async () => {
        if (config.isRunning) {
          config.isRunning = false;
          updateCatLog("Stopping...");
          toggleBtn.innerHTML = "▶";
        } else {
          config.buy_cat = select.value;
          config.total = Math.max(1, parseInt(input1.input.value, 10) || 3);
          config.buyDelay = Math.max(1, parseInt(input2.input.value, 10) || 2);
          config.claimDelay = Math.max(1, parseInt(input3.input.value, 10) || 2);
          toggleBtn.innerHTML = "⏹";
          await runScript();
          toggleBtn.innerHTML = "▶";
        }
      };

      bigEggBtn.onclick = async () => {
        if (!config.isBigEggAutoActive) {
          config.isBigEggAutoActive = true;
          fancyClaimed = false;
          bigEggBtn.innerHTML = "⏹";
          bigEggBtn.title = "Stop Big Egg";
          updateBEALog("Big Egg ON");
          startBigEggAuto();
        } else {
          config.isBigEggAutoActive = false;
          stopBigEggAuto();
          bigEggBtn.innerHTML = "🥚";
          bigEggBtn.title = "Big Egg Auto";
          updateBEALog("Big Egg OFF");
        }
      };

      // Minimize functionality
      let minimized = false;
      minBtn.onclick = () => {
        minimized = !minimized;
        content.style.display = minimized ? "none" : "flex";
        minBtn.textContent = minimized ? "⌃" : "⌄";
      };

      // Resize handler
      let resizeTimeout = null;
      window.addEventListener("resize", () => {
        if (resizeTimeout) return;
        resizeTimeout = setTimeout(() => {
          clampElement(container);
          resizeTimeout = null;
        }, 250);
      });
    } catch (error) {
      // Lỗi được xử lý im lặng
    }
  }

  // ------ CLEANUP ------
  const cleanup = () => {
    if (bigEggAutoInterval) {
      clearInterval(bigEggAutoInterval);
      bigEggAutoInterval = null;
    }
    if (refreshLogTimeout) {
      clearTimeout(refreshLogTimeout);
      refreshLogTimeout = null;
    }
  };

  window.addEventListener("beforeunload", cleanup);

  // ------ UTILITY FUNCTIONS ------
  function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = element.querySelector(".compact-header");
    header.onmousedown = dragMouseDown;
    
    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }
    
    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
    }
    
    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
      clampElement(element);
    }
  }

  function clampElement(element) {
    const rect = element.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;
    let newLeft = Math.max(0, Math.min(maxX, parseInt(element.style.left) || 0));
    let newTop = Math.max(0, Math.min(maxY, parseInt(element.style.top) || 0));
    element.style.left = newLeft + "px";
    element.style.top = newTop + "px";
  }

  // ------ INITIALIZATION ------
  function init() {
    try {
      createUI();
    } catch (e) {
      // Lỗi được xử lý im lặng
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
