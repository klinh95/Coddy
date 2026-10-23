(() => {
  if (window.__coddyHelperInstalled) return;
  window.__coddyHelperInstalled = true;

  let bridgePromise = null;
  const bridgePending = new Map();
  let bridgeCounter = 0;

  function addBridge() {
    if (bridgePromise) return bridgePromise;
    bridgePromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("page-bridge.js");
      script.onload = () => {
        script.remove();
        resolve();
      };
      script.onerror = () => resolve();
      (document.head || document.documentElement).appendChild(script);
    });
    return bridgePromise;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "coddy-helper-page") return;
    const pending = bridgePending.get(event.data.id);
    if (!pending) return;
    bridgePending.delete(event.data.id);
    pending(event.data.result);
  });

  async function askPageBridge(action, value = "") {
    await addBridge();
    const id = ++bridgeCounter;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        bridgePending.delete(id);
        resolve({ ok: false, error: "Không truy cập được editor." });
      }, 1200);
      bridgePending.set(id, (result) => {
        clearTimeout(timer);
        resolve(result);
      });
      window.postMessage({ source: "coddy-helper-content", id, action, value }, "*");
    });
  }

  function isVisible(element) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" &&
      rect.width > 0 && rect.height > 0;
  }

  function collectChoices() {
    const selector = 'button,[role="button"],[role="radio"],[role="option"],label,input[type="radio"],li';
    const seen = new Set();
    const choices = [];

    for (const element of document.querySelectorAll(selector)) {
      if (!isVisible(element)) continue;
      const target = element.matches('input[type="radio"]')
        ? (element.closest("label") || element.parentElement || element)
        : element;
      const text = (target.innerText || target.getAttribute("aria-label") || target.value || "")
        .replace(/\s+/g, " ").trim();
      if (!text || text.length > 240 || seen.has(text)) continue;
      if (/^(submit|run code|debug|ask ai|hide|show theory|save|reset|next|back)$/i.test(text)) continue;
      seen.add(text);
      choices.push({ text });
    }
    return choices.slice(0, 40);
  }

  async function getExercise() {
    const bridge = await askPageBridge("get");
    const visiblePageText = (document.body?.innerText || "").replace(/\n{3,}/g, "\n\n").trim();
    return {
      pageTitle: document.title,
      pageUrl: location.href,
      visiblePageText: visiblePageText.slice(0, 18000),
      editorText: bridge?.ok ? bridge.code || "" : "",
      choices: collectChoices()
    };
  }

  function clickChoice(text) {
    const wanted = String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!wanted) return false;

    const candidates = document.querySelectorAll(
      'button,[role="button"],[role="radio"],[role="option"],label,input[type="radio"],li'
    );
    let best = null;
    let bestScore = 0;
    for (const element of candidates) {
      if (!isVisible(element)) continue;
      const target = element.matches('input[type="radio"]')
        ? (element.closest("label") || element.parentElement || element)
        : element;
      const label = (target.innerText || target.getAttribute("aria-label") || target.value || "")
        .replace(/\s+/g, " ").trim().toLowerCase();
      if (!label || label.length > 240) continue;
      let score = 0;
      if (label === wanted) score = 3;
      else if (label.includes(wanted) || wanted.includes(label)) score = 2;
      if (score > bestScore) {
        best = target;
        bestScore = score;
      }
    }
    if (!best) return false;
    best.click();
    return true;
  }

  function fillTextAnswer(value) {
    const target = [...document.querySelectorAll("textarea,input:not([type]),[contenteditable='true']")]
      .find((element) => isVisible(element) && !element.disabled && !element.readOnly);
    if (!target) return false;

    if (target.isContentEditable) {
      target.textContent = value;
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    } else {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), "value")?.set;
      if (setter) setter.call(target, value);
      else target.value = value;
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return true;
  }

  async function submitAnswer() {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const buttons = [...document.querySelectorAll("button,[role='button']")].filter(isVisible);
    const button = buttons.find((element) => {
      const text = (element.innerText || element.getAttribute("aria-label") || "")
        .replace(/\s+/g, " ").trim().toLowerCase();
      return /^(submit|submit answer)(?:\b|\s|$)|^(check answer|nộp bài|kiểm tra)$/.test(text);
    });
    if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return false;
    button.click();
    return true;
  }

  async function applySolution(solution, autoSubmit) {
    let filled = false;
    let detail = "";

    if (solution.type === "choice") {
      const choice = solution.choiceText || solution.answer;
      filled = clickChoice(choice);
      detail = filled ? `Đã chọn: ${choice}` : "Không khớp được phương án trên trang.";
    } else if (solution.type === "code") {
      const result = await askPageBridge("set", solution.answer);
      filled = Boolean(result?.ok);
      detail = filled ? "Đã điền code vào editor." : (result?.error || "Không tìm thấy editor tương thích.");
      if (!filled) filled = fillTextAnswer(solution.answer);
      if (filled && detail.startsWith("Không")) detail = "Đã điền vào ô nhập văn bản.";
    } else {
      filled = fillTextAnswer(solution.answer);
      detail = filled ? "Đã điền câu trả lời." : "Không tìm thấy ô nhập câu trả lời.";
    }

    let submitted = false;
    if (filled && autoSubmit) submitted = await submitAnswer();
    return { ok: filled, detail, submitted };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "GET_EXERCISE") {
      getExercise().then((exercise) => sendResponse({ ok: true, exercise }))
        .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
      return true;
    }
    if (message?.type === "APPLY_SOLUTION") {
      applySolution(message.solution, Boolean(message.autoSubmit))
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, detail: error.message || String(error) }));
      return true;
    }
    return false;
  });
})();