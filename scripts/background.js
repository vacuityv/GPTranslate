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
                });
        });
    } else if (command === "trsPageShortcut") {
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
            // chrome.tabs.sendMessage(tabs[0].id, {action: "myAction"});
            chrome.scripting
                .executeScript({
                    target: {tabId: tabs[0].id},
                    func: processPageTranslate,
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
            });
    } else if (item.menuItemId === "gpt-page") {
        chrome.scripting
            .executeScript({
                target: {tabId: tab.id},
                func: processPageTranslate,
            });
    }

});

function processTrans() {
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
    popup.textContent = selection.toString();

    // chrome.storage.sync.get(['vacTransConfig'], async function (result) {
    //     if (JSON.stringify(result) !== '{}') {
    //         sourceJson = result;
    //     }
    //     var vacUserId = result.vacUserId;

    chrome.runtime.sendMessage( //goes to bg_page.js
        {
            // "vacUserId": vacUserId,
            "content": text
        },
        data => {
            txt = data.toString();
            txt = txt.replaceAll(/\n/g, "<br/>");
            popup.innerHTML = txt;
            document.body.appendChild(popup);
            document.addEventListener('click', function (event) {
                console.log('鼠标点击事件已触发', event);
                el = event.target; //鼠标每经过一个元素，就把该元素赋值给变量el
                console.log('当前鼠标在', el, '元素上');
                if (popup && el != popup) {
                    popup.remove();
                }
            });
        }
    );
    // });
}


chrome.runtime.onMessage.addListener(
    function (reqBody, sender, onSuccess) {
        console.log("listener0:")
        console.log("listener1:", JSON.stringify(reqBody))
        url = 'https://chat.vacuity.me/vac-chat-api/chat/ext/chromeTranslate'
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(reqBody),
        };
        console.log("listener2:", JSON.stringify(reqBody))
        fetch(url, options)
            .then(response => response.text())
            .then(text => {
                console.log("api callack")
                console.log(text);
                var resData = JSON.parse(text);
                onSuccess(resData.data.content);
            })
            .catch(error => {
                console.log("api error", error)
                onSuccess('network-error:' + error);
            });
        return true;
    }
);


function saveEdit(configJson) {
    chrome.storage.sync.set(configJson, function () {
    });
}

function processPageTranslate() {
    nodeList = []
    translateNode(document.body, nodeList);

    divideNodesRes = divideNodes(nodeList);

    console.log("一共需要翻译步数", divideNodesRes.length)
    // processNodeTranslate(divideNodesRes[2])
    for (var i = 0;  i < divideNodesRes.length; i++) {
        console.log("翻译步骤", i)
        processNodeTranslate(divideNodesRes[i], i)

    }

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
        if (num > 10) {
            num = 10;
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

    function translateNode(node, nodeList) {
        if (node.nodeType === Node.TEXT_NODE) {
            // 这是一个文本节点，翻译它的文本内容
            nodeList.push(node)
        } else {
            // 这是一个元素节点，遍历它的子节点
            for (var i = 0; i < node.childNodes.length; i++) {
                translateNode(node.childNodes[i], nodeList);
            }
        }
    }

    function processNodeTranslate(nodeList, index) {

        content = ""

        j = 0;
        for (let node of nodeList) {
            j++;
            content = content + node.textContent + "$###$";
        }

        chrome.runtime.sendMessage( //goes to bg_page.js
            {
                // "vacUserId": vacUserId,
                "content": content
            },
            data => {
                txt = data.toString();
                if (txt.startsWith("network-error")) {
                    return;
                }
                // txt = txt.replaceAll(/\n/g, "<br/>");
                resList = txt.split("$###$");
                for (var i = 0; i < nodeList.length; i++) {
                    nodeList[i].textContent = resList[i];
                }
                console.log("翻译完成", index)
            }
        );
    }

    function sleep(ms) {
        // return new Promise(resolve => setTimeout(resolve, ms));
    }

}
