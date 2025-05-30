// ==UserScript==
// @name         Auto Buy & Claim Egg (V1.0)
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Thêm tiêu đề cho các mục thời gian chờ mua, chờ xóa và số lần mua trứng
// @author       Anh
// @match        *://*.cryptokitties.dapperlabs.com/*
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    ///// SETTING /////
    const config = {
        catList: ['page', 'berry', 'pages_gang', 'hybrid', 'wild_west', 'frosty_fam', 'footballer', 'the_purrfessionals'], // Danh sách mèo có sẵn
        buy_cat: 'footballer',
        total: 3,
        buyDelay: 2,  // Thời gian chờ trước khi mua trứng (giây)
        claimDelay: 3, // Thời gian chờ trước khi xóa trứng (giây)
        errorLog: [],
        apiBaseUrl: "https://zenegg-api.production.cryptokitties.dapperlabs.com/egg/api/den/",
        token: Telegram.WebView.initParams.tgWebAppData
    };

    // Hàm gửi yêu cầu API bằng Tampermonkey
    const fetchAPI = (endpoint, body = {}, callback) => {
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
                    console.error(`❌ Lỗi API: ${data.error || "Không rõ nguyên nhân"}`);
                    config.errorLog.push({ time: new Date().toISOString(), type: endpoint, message: data.error || "Không rõ nguyên nhân" });
                }
                callback(data);
            },
            onerror: error => {
                console.error(`🚨 Lỗi khi gọi API ${endpoint}:`, error);
                config.errorLog.push({ time: new Date().toISOString(), type: endpoint, message: error.message });
                callback({});
            }
        });
    };

    // Hàm chờ
    const delay = t => new Promise(resolve => setTimeout(resolve, t * 1000));

    // Hàm chính để thực hiện mua và xóa trứng
    const runScript = async (buy_cat, total, buyDelay, claimDelay) => {
        console.log(`🚀 Bắt đầu chạy script! Mua mèo: "${buy_cat}", Số lần mua: ${total}, Chờ sau mua: ${buyDelay}s, Chờ sau xóa: ${claimDelay}s`);

        for (let i = 0; i < total; i++) {
            await new Promise(resolve => fetchAPI("buy-fancy-egg", { cat_category: buy_cat, quantity: 1 }, resolve));
            console.log(`🥚 Mua trứng "${buy_cat}" thành công`);

            await delay(buyDelay);
            await new Promise(resolve => fetchAPI("claim-tao", {}, data => {
                console.log(`🥚 Xóa trứng thành công: +${data.claim?.zen_claimed || 0} ZEN`);
                resolve();
            }));

            await delay(claimDelay);
            console.log(`😉 Đã xóa: ${i + 1}/${total} lần trứng🥚.`);
        }

        console.log("✅ DONE ALL");

        if (config.errorLog.length) {
            console.warn("⚠️ Danh sách lỗi:", config.errorLog);
        } else {
            console.log("✅ Không có lỗi!");
        }
    };

    // Thêm giao diện chọn mèo gọn gàng với tiêu đề
    const createUI = () => {
        const div = document.createElement("div");
        div.style.position = "fixed";
        div.style.bottom = "20px";
        div.style.right = "20px";
        div.style.background = "#ffffff";
        div.style.padding = "10px";
        div.style.border = "1px solid #ccc";
        div.style.zIndex = "1000";
        div.style.borderRadius = "5px";
        div.style.boxShadow = "0 0 10px rgba(0,0,0,0.1)";
        div.style.display = "flex";
        div.style.flexDirection = "column";
        div.style.gap = "8px";

        const createLabelInput = (labelText, inputType, defaultValue) => {
            const wrapper = document.createElement("div");
            wrapper.style.display = "flex";
            wrapper.style.alignItems = "center";
            wrapper.style.justifyContent = "space-between";


            const label = document.createElement("label");
            label.textContent = labelText;
            label.style.fontSize = "14px";
            label.style.fontWeight = "bold";
            label.style.marginRight = "8px";

            const input = document.createElement("input");
            input.type = inputType;
            input.value = defaultValue;
            input.min = 0;
            input.style.width = "60px"; // Để ô nhập không chiếm quá nhiều không gian
            input.style.textAlign = "center";

            wrapper.appendChild(label);
            wrapper.appendChild(input);
            return { wrapper, input };
        };

        // Danh sách chọn mèo
        const selectWrapper = document.createElement("div");
        selectWrapper.style.display = "flex";
        selectWrapper.style.alignItems = "center";
        selectWrapper.style.justifyContent = "space-between";

        const selectLabel = document.createElement("label");
        selectLabel.textContent = "🔹 Chọn loại mèo:";
        selectLabel.style.fontSize = "14px";
        selectLabel.style.fontWeight = "bold";
        selectLabel.style.marginRight = "8px";


        const select = document.createElement("select");
        config.catList.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat;
            option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
            select.appendChild(option);
        });

        selectWrapper.appendChild(selectLabel);
        selectWrapper.appendChild(select);

        const { wrapper: totalWrapper, input: inputTotal } = createLabelInput("Số lần mua:", "number", config.total);
        const { wrapper: buyDelayWrapper, input: inputBuyDelay } = createLabelInput("Chờ xoa trứng (giây):", "number", config.buyDelay);
        const { wrapper: claimDelayWrapper, input: inputClaimDelay } = createLabelInput("Chờ mua tiếp (giây):", "number", config.claimDelay);

        // Nút chạy script
    const button = document.createElement("button");
    button.innerHTML = "🚀 Chạy";
    button.style.background = "#28a745";
    button.style.color = "white";
    button.style.border = "none";
    button.style.cursor = "pointer";
    button.style.fontSize = "12px";
    button.style.padding = "4px 8px";
    button.style.borderRadius = "5px";
    button.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
    button.style.transition = "0.2s";

    // Hiệu ứng hover
    button.onmouseover = () => button.style.background = "#218838";
    button.onmouseleave = () => button.style.background = "#28a745";


        button.onclick = () => {
            runScript(select.value, parseInt(inputTotal.value), parseInt(inputBuyDelay.value), parseInt(inputClaimDelay.value));
        };

        div.append(selectLabel, select, totalWrapper, buyDelayWrapper, claimDelayWrapper, button);
        document.body.appendChild(div);
    };

    window.addEventListener("load", createUI);
})();