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
        console.log("trsSelShortcut");
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
    console.log(item);

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
            console.log("callack");
            console.log(data);
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
                console.log("api error")
                console.log(error);
                onSuccess('网络错误' + error);
            });
        return true;
    }
);


function saveEdit(configJson) {
    chrome.storage.sync.set(configJson, function () {
    });
}

function processPageTranslate() {
    console.log("processPageTranslate");
    nodeList = []
    translateNode(document.body, nodeList);

    divideNodesRes = divideNodes(nodeList);

    // for (var i = 0;  i < divideNodesRes.length; i++) {
    //     l1 = divideNodesRes[i]
    //     for (var ll = 0; ll < l1.length; ll++) {
    //         if (l1[ll].textContent === 'Docs') {
    //             console.log("============", i)
    //             console.log("============", ll)
    //         }
    //     }
    // }

    // processNodeTranslate(divideNodesRes[2])
    for (var i = 0;  i < divideNodesRes.length; i++) {
        processNodeTranslate(divideNodesRes[i])
        // curList = divideNodesRes[i]
        // for (let node of curList) {
        //     node.textContent = node.textContent + "22222"
        // }
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
        var num = Math.ceil(totalLength / 1000);
        if (num > 10) {
            num = 10;
        }
        console.log("拆分：", num)

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

    function processNodeTranslate(nodeList) {

        content = ""

        j = 0;
        for (let node of nodeList) {
            console.log("翻译前:", j)
            j++;
            console.log("翻译前:", node.textContent)
            content = content + node.textContent + "$###$";
        }
        console.log("翻译前final", content)

        chrome.runtime.sendMessage( //goes to bg_page.js
            {
                // "vacUserId": vacUserId,
                "content": content
            },
            data => {
                txt = data.toString();
                console.log("翻译后final", txt)
                // txt = txt.replaceAll(/\n/g, "<br/>");
                resList = txt.split("$###$")
                for (var ll = 0; ll < nodeList.length; ll++) {
                    console.log("翻译后", ll)
                    console.log("翻译后", resList[ll])
                }
                for (var i = 0; i < nodeList.length; i++) {
                    nodeList[i].textContent = resList[i];
                }
            }
        );

        // chrome.runtime.sendMessage( //goes to bg_page.js
        //     {
        //         "content": node.textContent
        //     },
        //     data => {
        //         console.log("callack");
        //         console.log(data);
        //         txt = data.toString();
        //         txt = txt.replaceAll(/\n/g, "<br/>");
        //         node.textContent = txt;
        //     },
        //     error => {
        //         console.log("====api error")
        //         console.log(error);
        //         node.textContent = '网络错误' + error;
        //     }
        // );
    }

    function sleep(ms) {
        // return new Promise(resolve => setTimeout(resolve, ms));
    }

}
