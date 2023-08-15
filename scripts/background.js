// initRules();
//
//
// function initRules() {
// }


chrome.scripting.getRegisteredContentScripts()
    .then(scripts => console.log("registered content scripts", scripts));


chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "gpt",
        title: "翻译选中",
        contexts: ["page", "selection"],
    });
    chrome.contextMenus.create({
        id: "gpt-page",
        title: "翻译网页",
        contexts: ["page"],
    });
});

chrome.commands.onCommand.addListener(function (command) {
    if (command === "trsSelShortcut") {
        // 在这里执行你的操作
        // 例如，可以发送一个消息给扩展的内容脚本，执行一些操作
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
            // chrome.tabs.sendMessage(tabs[0].id, {action: "myAction"});
            chrome.scripting
                .executeScript({
                    target: {tabId: tabs[0].id},
                    func: processTrans,
                    args: [tabs[0].id],
                });
        });
    } else if (command === "trsPageShortcut") {
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
            // chrome.tabs.sendMessage(tabs[0].id, {action: "myAction"});
            chrome.scripting
                .executeScript({
                    target: {tabId: tabs[0].id},
                    func: processPageTranslate,
                    args: [tabs[0].id],
                });
        });
    }
});


chrome.contextMenus.onClicked.addListener((item, tab) => {

    if (item.menuItemId === "gpt") {
        chrome.scripting
            .executeScript({
                target: {tabId: tab.id},
                func: processTrans,
                args: [tab.id],
            });
    } else if (item.menuItemId === "gpt-page") {
        chrome.scripting
            .executeScript({
                target: {tabId: tab.id},
                func: processPageTranslate,
                args: [tab.id],
            });
    }

});

function processTrans(tabId) {
    var selection = window.getSelection();
    var text = selection.toString();
    var range = selection.getRangeAt(0);
    var rect = range.getBoundingClientRect();
    var x = rect.right + 10;
    var y = rect.top;

    var popup = document.createElement('div');
    popup.id = 'vac-trans-popup';
    popup.style.position = 'fixed';
    popup.style.top = y + 'px';
    popup.style.left = x + 'px';
    popup.style.padding = '10px';
    popup.style.maxWidth = '490px';
    // popup.style.background = 'rgba(128, 128, 128, 0.95)';
    popup.style.background = 'rgba(245, 245, 245, 0.95)';
    popup.style.border = '1px solid #cccccc';
    popup.style.boxShadow = '0px 15px 20px 0 rgba(238, 238, 238, 0.9)';
    popup.style.borderRadius = '5px';
    popup.style.zIndex = '9999';
    popup.display = 'none';
    document.body.appendChild(popup);

    // chrome.storage.sync.get(['vacTransConfig'], async function (result) {
    //     if (JSON.stringify(result) !== '{}') {
    //         sourceJson = result;
    //     }
    //     var vacUserId = result.vacUserId;

    console.log("tabId:", tabId)

    chrome.runtime.sendMessage( //goes to bg_page.js
        {
            "translateFrom": "chrome_sel",
            "content": text,
            "recordId": tabId,
        },
        data => {
        }
    );
}


chrome.runtime.onMessage.addListener(
    function (reqBody, sender, onSuccess) {

        if (reqBody.action == "chrome_sel") {
            onSuccess(reqBody);
            return true;
        }

        if (reqBody.hasOwnProperty('translateFrom')) {
            sendSocketMsg(reqBody)
        }

        // console.log("listener0:");
        // console.log("listener1:", JSON.stringify(reqBody))
        // url = 'https://chat.vacuity.me/vac-chat-api/chat/ext/chromeTranslate'
        // const options = {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json',
        //     },
        //     body: JSON.stringify(reqBody),
        // };
        // console.log("listener2:", JSON.stringify(reqBody))
        // fetch(url, options)
        //     .then(response => response.text())
        //     .then(text => {
        //         var resData = JSON.parse(text);
        //         onSuccess(resData.data.content);
        //     })
        //     .catch(error => {
        //         console.log("api error", error)
        //         onSuccess('network-error:' + error);
        //     });
        return true;
    }
);


function saveEdit(configJson) {
    chrome.storage.sync.set(configJson, function () {
    });
}

function processPageTranslate(tabId) {
    nodeList = []
    translateNode(document.body, nodeList);
    dataList = []
    for (var i = 0; i < nodeList.length; i++) {
        item = {
            'index': i,
            'textContent': nodeList[i].textContent
        }
        dataList.push(item)
    }
    console.log("dataList:", dataList)
    console.log("nodeList:", nodeList)

    if (!window.listMap) {
        window.listMap = new Map();
    }

    listKey = 'nodeListKey_' + generateRandomString();
    window.listMap[listKey] = nodeList
    const removeMapIntervalId = setInterval(
        () => {
            window.listMap.delete(listKey);
            clearInterval(removeMapIntervalId);
        },
        10 * 60 * 1000
    );

    divideDataRes = divideNodes(dataList);

    console.log("分组后数据:", divideDataRes)
    console.log("一共需要翻译步数", divideDataRes.length)
    // processNodeTranslate(divideNodesRes[2])
    for (var i = 0; i < divideDataRes.length; i++) {
        divideNodeList = divideDataRes[i];
        content = ""
        // callbackStrMap
        for (var j = 0; j < divideNodeList.length; j++) {
            node = divideNodeList[j];
            content = content + "|#|" + node.index + "|##|" + node.textContent;
        }
        callbackStrKey = 'callbackStrKey_' + generateRandomString();
        if (!window.callbackStrMap) {
            window.callbackStrMap = new Map();
        }
        window.callbackStrMap[callbackStrKey] = "";
        const callbackMapIntervalId = setInterval(
            () => {
                window.callbackStrMap.delete(callbackStrKey);
                clearInterval(callbackMapIntervalId);
            },
            10 * 60 * 1000
        );

        chrome.runtime.sendMessage( //goes to bg_page.js
            {
                "translateFrom": "chrome_all",
                "content": content,
                "recordId": tabId,
                "pageKey": callbackStrKey,
                "nodeKey": listKey,
            },
            data => {
            }
        );

    }


    function generateRandomString() {
        let randomString = '';
        let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let charactersLength = characters.length;
        for (let i = 0; i < 16; i++) {
            randomString += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return randomString;
    }


    //
    function divideNodes(oriNodes) {
        nodes = []
        for (let node of oriNodes) {
            if (node.textContent.replace(/[\u0000-\u0020]+/g, "").length > 0) {
                nodes.push(node)
            }
        }

        // 计算总长度
        let totalLength = 0;
        for (let node of nodes) {
            totalLength += node.textContent.length;
        }
        console.log("总长度", totalLength)
        var num = Math.ceil(totalLength / 1000);
        if (num > 20) {
            num = 20;
        }
        if (num > oriNodes.length) {
            num = oriNodes.length
        }

        // 计算平均长度
        let averageLength = totalLength / num;

        // 创建10个空数组
        let dividedNodes = Array.from({length: num}, () => []);

        // 创建一个数组来存储每一份的长度
        let lengths = Array.from({length: num}, () => 0);

        // 遍历node的列表
        for (let node of nodes) {
            // 找到长度最小的一份
            let minIndex = lengths.indexOf(Math.min(...lengths));

            // 将node分配到这一份中
            dividedNodes[minIndex].push(node);

            // 更新这一份的长度
            lengths[minIndex] += node.textContent.length;
        }

        // 返回分配的结果
        return dividedNodes;
    }

    //
    function translateNode(node, nodeList) {
        if (node.nodeType === Node.TEXT_NODE) {
            // 这是一个文本节点，翻译它的文本内容
            if (node.parentNode.nodeName !== 'STYLE') {
                nodeList.push(node);
            }
        } else {
            // 这是一个元素节点，遍历它的子节点
            for (var i = 0; i < node.childNodes.length; i++) {
                translateNode(node.childNodes[i], nodeList);
            }
        }
    }

    //
    // function processNodeTranslate(nodeList, index) {
    //
    //     content = ""
    //
    //     j = 0;
    //     for (let node of nodeList) {
    //         j++;
    //         content = content + node.textContent + "|#|";
    //     }
    //
    //     chrome.runtime.sendMessage( //goes to bg_page.js
    //         {
    //             // "vacUserId": vacUserId,
    //             "content": content
    //         },
    //         data => {
    //             txt = data.toString();
    //             if (txt.startsWith("network-error")) {
    //                 return;
    //             }
    //             // txt = txt.replaceAll(/\n/g, "<br/>");
    //             resList = txt.split("|#|");
    //             for (var i = 0; i < nodeList.length; i++) {
    //                 nodeList[i].textContent = resList[i];
    //             }
    //             console.log("翻译完成", index)
    //         }
    //     );
    // }
    //
    // function sleep(ms) {
    //     // return new Promise(resolve => setTimeout(resolve, ms));
    // }

}

const TEN_SECONDS_MS = 5 * 1000;
let webSocket = null;
let readyState = -1;

// Make sure the Glitch demo server is running
// fetch('https://chrome-extension-websockets.glitch.me/', {mode: 'no-cors'});

// Toggle WebSocket connection on action button click
// Send a message every 10 seconds, the ServiceWorker will
// be kept alive as long as messages are being sent.

chrome.tabs.onCreated.addListener(function (tab) {
    checkSocket()
});

const onmessageWS = e => {
    data = e.data
    if (data === 'pong') {
        console.log(data)
        return
    }
    dataObj = JSON.parse(data)
    translateFrom = dataObj['translateFrom'];

    if (translateFrom === 'chrome_sel') {
        // chrome.runtime.sendMessage({action: 'chrome_sel', data: dataObj}, data => {
        //
        // });
        chrome.scripting
            .executeScript({
                target: {tabId: parseInt(dataObj.recordId)},
                func: processTranslateSel,
                args: [data],
            });
    } else if (translateFrom === 'chrome_all') {
        chrome.scripting
            .executeScript({
                target: {tabId: parseInt(dataObj.recordId)},
                func: processTranslatePage,
                args: [data],
            });
    }

}

function processTranslateSel(data) {
    console.log("processTranslateSel1:", data)
    dataObj = JSON.parse(data)
    console.log("processTranslateSel2:", dataObj.content)
    var popup = document.getElementById('vac-trans-popup')
    txt = dataObj['content'];
    txt = txt.replaceAll(/\n/g, "<br/>");
    innerHTML = popup.innerHTML;
    innerHTML = innerHTML + txt;
    popup.innerHTML = innerHTML;
    popup.display = true;
    document.addEventListener('click', function (event) {
        console.log('鼠标点击事件已触发', event);
        el = event.target; //鼠标每经过一个元素，就把该元素赋值给变量el
        console.log('当前鼠标在', el, '元素上');
        if (popup && el != popup) {
            popup.remove();
        }
    });
}

function processTranslatePage(data) {
    dataObj = JSON.parse(data)
    var node = document.getElementById(dataObj.nodeId)
    txt = dataObj['content'];
    callbackStrKey = dataObj['pageKey'];
    window.callbackStrMap[callbackStrKey] = window.callbackStrMap[callbackStrKey] + txt
    totalTxt = window.callbackStrMap[callbackStrKey]
    // console.log("totalTxt", totalTxt)

    callbackStrSplit = totalTxt.split('|#|')
    nodeList = window.listMap[dataObj['nodeKey']]
    for (i = 1; i < callbackStrSplit.length; i++) {
        singleItem = callbackStrSplit[i].split('|##|')
        if (singleItem.length > 1) {
            nodeIndex = singleItem[0];
            nodeText = singleItem[1];
            nodeList[nodeIndex].textContent = nodeText
        }
    }
}

function checkSocket() {
    if (!webSocket) {
        connect();
        keepAlive();
    }
}

function connect() {
    // webSocket = new WebSocket('ws://127.0.0.1:8081/vac-chat-api/stream/chat/chat');
    webSocket = new WebSocket('wss://chat.vacuity.me/vac-chat-api/stream/chat/chat');

    webSocket.onopen = (event) => {
        // chrome.action.setIcon({ path: 'icons/socket-active.png' });
        console.log("webSocket.onopen")
    };

    webSocket.onmessage = onmessageWS

    webSocket.onclose = (event) => {
        // chrome.action.setIcon({ path: 'icons/socket-inactive.png' });
        console.log('websocket connection closed');
        webSocket = null;
    };
}

function disconnect() {
    if (webSocket) {
        webSocket.close();
    }
}

function keepAlive() {
    const keepAliveIntervalId = setInterval(
        () => {
            if (webSocket) {
                console.log('ping');
                webSocket.send('ping');
            } else {
                checkSocket()
            }
        },
        // It's important to pick an interval that's shorter than 30s, to
        // avoid that the service worker becomes inactive.
        TEN_SECONDS_MS
    );
}

function sendSocketMsg(msg) {
    checkSocket();
    const checkAliveIntervalId = setInterval(
        () => {
            if (webSocket.readyState === 1) {
                console.log("send:", JSON.stringify(msg))
                webSocket.send(JSON.stringify(msg))
                clearInterval(checkAliveIntervalId);
            }
        },
        100
    );
}


