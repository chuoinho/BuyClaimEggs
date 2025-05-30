// ==UserScript==
// @name         Auto Buy & Claim Egg (V1.1 by Boo)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Bổ sung log, update mèo
// @author       Anh
// @match        *://*.cryptokitties.dapperlabs.com/*
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const config = {
        catList: ['page', 'berry', 'pages_gang', 'hybrid', 'wild_west', 'frosty_fam', 'footballer', 'the_purrfessionals', 'slumber_party', 'crossbreed'],
        buy_cat: 'page',
        total: 3,
        buyDelay: 2,
        claimDelay: 3,
        apiBaseUrl: "https://zenegg-api.production.cryptokitties.dapperlabs.com/egg/api/den/",
        token: Telegram.WebView.initParams.tgWebAppData,
        errorLog: [],
        latestLog: '' // Biến chứa log gần nhất
    };

    const fetchAPI = async (endpoint, body = {}) => {
        return new Promise(resolve => {
            GM_xmlhttpRequest({
                method: "POST",
                url: `${config.apiBaseUrl}${endpoint}`,
                headers: {
                    "Accept": "*/*",
                    "Content-Type": "application/json",
                    "X-ID-Token": config.token,
                    "X-App-Version": new Date().toISOString().replace(/[-:.TZ]/g, '')
                },
                data: JSON.stringify(body),
                onload: response => {
                    let data = JSON.parse(response.responseText);
                    if (response.status !== 200) {
                        console.error(`❌ API Error: ${data.error || "Unknown error"}`);
                        config.errorLog.push({ time: new Date().toISOString(), type: endpoint, message: data.error || "Unknown error" });
                    }
                    resolve(data);
                },
                onerror: error => {
                    console.error(`🚨 API Error ${endpoint}:`, error);
                    config.errorLog.push({ time: new Date().toISOString(), type: endpoint, message: error.message });
                    resolve({});
                }
            });
        });
    };

    const delay = t => new Promise(resolve => setTimeout(resolve, t * 1000));

    const updateLog = (message) => {
        config.latestLog = message;
        const logDisplay = document.getElementById("logDisplay");
        if (logDisplay) logDisplay.textContent = `📜 Log: ${message}`;
    };

    const runScript = async () => {
        console.log(`🚀 Running script! Buying cat: "${config.buy_cat}", Total: ${config.total}, Buy delay: ${config.buyDelay}s, Claim delay: ${config.claimDelay}s`);
        updateLog("Script bắt đầu chạy...");

        for (let i = 0; i < config.total; i++) {
            await fetchAPI("buy-fancy-egg", { cat_category: config.buy_cat, quantity: 1 });
            updateLog(`🥚 Đã mua "${config.buy_cat}"`);

            await delay(config.buyDelay);
            let data = await fetchAPI("claim-tao");
            updateLog(`✅ Xóa trứng: +${data.claim?.zen_claimed || 0} ZEN`);

            await delay(config.claimDelay);
            updateLog(`🔄 Đã xóa ${i + 1}/${config.total} lần trứng`);
        }

        updateLog("✅ Hoàn thành!");
    };

    const createUI = () => {
        const div = document.createElement("div");
        Object.assign(div.style, {
            position: "fixed", bottom: "20px", right: "20px",
            background: "#ffffff", padding: "10px", border: "1px solid #ccc",
            zIndex: "1000", borderRadius: "5px", boxShadow: "0 0 10px rgba(0,0,0,0.1)",
            display: "flex", flexDirection: "column", gap: "8px"
        });

        const fragment = document.createDocumentFragment();

        const createLabelInput = (labelText, defaultValue) => {
            const wrapper = document.createElement("div");
            Object.assign(wrapper.style, { display: "flex", justifyContent: "space-between", alignItems: "center" });

            const label = Object.assign(document.createElement("label"), { textContent: labelText });
            Object.assign(label.style, { fontSize: "14px", fontWeight: "bold", marginRight: "8px" });

            const input = Object.assign(document.createElement("input"), { type: "number", value: defaultValue, min: 0 });
            Object.assign(input.style, { width: "60px", textAlign: "center" });

            wrapper.append(label, input);
            return { wrapper, input };
        };

        // Danh sách chọn mèo
        const selectWrapper = document.createElement("div");
        Object.assign(selectWrapper.style, { display: "flex", justifyContent: "space-between", alignItems: "center" });

        const selectLabel = Object.assign(document.createElement("label"), { textContent: "🔹 Chọn loại mèo:" });
        Object.assign(selectLabel.style, { fontSize: "14px", fontWeight: "bold", marginRight: "8px" });

        const select = document.createElement("select");
        config.catList.forEach(cat => {
            const option = Object.assign(document.createElement("option"), { value: cat, textContent: cat.charAt(0).toUpperCase() + cat.slice(1) });
            select.appendChild(option);
        });

        selectWrapper.append(selectLabel, select);

        // Các ô nhập số
        const { wrapper: totalWrapper, input: inputTotal } = createLabelInput("Số lần mua:", config.total);
        const { wrapper: buyDelayWrapper, input: inputBuyDelay } = createLabelInput("Chờ mua (giây):", config.buyDelay);
        const { wrapper: claimDelayWrapper, input: inputClaimDelay } = createLabelInput("Chờ xóa (giây):", config.claimDelay);

        // Nút chạy script
        const button = Object.assign(document.createElement("button"), { innerHTML: "🚀 Chạy" });
        Object.assign(button.style, {
            background: "#28a745", color: "white", border: "none", cursor: "pointer",
            fontSize: "12px", padding: "4px 8px", borderRadius: "5px", boxShadow: "0 2px 4px rgba(0,0,0,0.2)", transition: "0.2s"
        });

        button.onclick = () => {
            config.buy_cat = select.value;
            config.total = parseInt(inputTotal.value);
            config.buyDelay = parseInt(inputBuyDelay.value);
            config.claimDelay = parseInt(inputClaimDelay.value);
            runScript();
        };

        // Hiển thị log gần nhất
        const logDisplay = document.createElement("div");
        logDisplay.id = "logDisplay";
        logDisplay.textContent = "📜 Log: Chưa có hoạt động";
        Object.assign(logDisplay.style, { fontSize: "12px", fontStyle: "italic", marginTop: "8px", color: "#555" });

        fragment.append(selectWrapper, totalWrapper, buyDelayWrapper, claimDelayWrapper, button, logDisplay);
        div.appendChild(fragment);
        document.body.appendChild(div);
    };

    window.addEventListener("load", createUI);
})();
