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
      script.onload = () => { script.remove(); resolve(); };
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
      }, 1600);
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

  function normalizeText(value) {
    return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function collectChoices() {
    const selector = 'button,[role="button"],[role="radio"],[role="option"],[tabindex="0"],label,input[type="radio"],li';
    const seen = new Set();
    const choices = [];

    for (const element of document.querySelectorAll(selector)) {
      if (!isVisible(element)) continue;
      const target = element.matches('input[type="radio"]')
        ? (element.closest("label") || element.parentElement || element)
        : element;
      const text = normalizeText(target.innerText || target.getAttribute("aria-label") || target.value);
      if (!text || text.length > 240 || seen.has(text)) continue;
      if (/^(submit|run code|debug|ask ai|hide|show theory|save|reset|next|back)$/i.test(text)) continue;
      seen.add(text);
      choices.push({ text });
    }
    return choices.slice(0, 60);
  }

  function parseCodeLine(element) {
    const raw = String(element.innerText || element.textContent || "")
      .replace(/\u00a0/g, " ").trim();
    const rows = raw.split(/\n+/).map((row) => row.trim()).filter(Boolean);
    let text = raw;
    if (rows.length === 2 && /^\d{1,3}$/.test(rows[0])) text = rows[0] + " " + rows[1];
    else if (rows.length > 1) return null;
    text = normalizeText(text);
    const match = text.match(/^(\d{1,3})[\s:.-]+(.+)$/);
    if (!match) return null;
    const code = match[2].trim();
    if (!/[=;()[\]{}"'<>]/.test(code)) return null;
    return { number: Number(match[1]), code, text };
  }

  function collectLineOptions() {
    const selector = 'button,[role="button"],[role="option"],[tabindex="0"],li,pre,code,div';
    const byKey = new Map();
    for (const element of document.querySelectorAll(selector)) {
      if (!isVisible(element)) continue;
      const line = parseCodeLine(element);
      if (!line || line.text.length > 500) continue;
      const key = line.number + "|" + line.code;
      const existing = byKey.get(key);
      if (!existing || line.text.length < existing.text.length) byKey.set(key, line);
    }
    return [...byKey.values()].sort((a, b) => a.number - b.number).slice(0, 50);
  }

  function collectBlankInfo(pageText) {
    const labels = [...pageText.matchAll(/\bBlank\s*#?\s*(\d+)/gi)]
      .map((match) => Number(match[1]));
    const blankLabels = [...new Set(labels)].sort((a, b) => a - b);

    const controls = [...document.querySelectorAll('input:not([type]),input[type="text"],input[type="number"],input[type="search"],textarea,select,[contenteditable="true"]')]
      .filter((element) => {
        if (!isVisible(element) || element.disabled || element.readOnly) return false;
        if (element.closest(".monaco-editor,.ace_editor") || element.classList.contains("ace_text-input")) return false;
        return true;
      })
      .map((element, index) => ({
        index: index + 1,
        placeholder: element.getAttribute("placeholder") || "",
        label: element.getAttribute("aria-label") || element.labels?.[0]?.innerText || ""
      }));
    return { blankLabels, blankFields: controls };
  }

  async function getExercise() {
    const bridge = await askPageBridge("get");
    const visiblePageText = (document.body?.innerText || "")
      .replace(/\n{3,}/g, "\n\n").trim();
    const blankInfo = collectBlankInfo(visiblePageText);
    return {
      pageTitle: document.title,
      pageUrl: location.href,
      visiblePageText: visiblePageText.slice(0, 18000),
      editorText: bridge?.ok ? bridge.code || "" : "",
      choices: collectChoices(),
      lineOptions: collectLineOptions(),
      blankLabels: blankInfo.blankLabels,
      blankFields: blankInfo.blankFields
    };
  }

  function choiceTarget(text, root = document) {
    const wanted = normalizeText(text).toLowerCase();
    if (!wanted) return null;
    const candidates = root.querySelectorAll(
      'button,[role="button"],[role="radio"],[role="option"],[tabindex="0"],label,input[type="radio"],li'
    );
    let best = null;
    let bestScore = 0;
    for (const element of candidates) {
      if (!isVisible(element)) continue;
      const target = element.matches('input[type="radio"]')
        ? (element.closest("label") || element.parentElement || element)
        : element;
      const label = normalizeText(target.innerText || target.getAttribute("aria-label") || target.value).toLowerCase();
      if (!label || label.length > 240) continue;
      let score = 0;
      if (label === wanted) score = 3;
      else if (label.includes(wanted) || wanted.includes(label)) score = 2;
      if (score > bestScore) {
        best = target;
        bestScore = score;
      }
    }
    return bestScore ? best : null;
  }

  function clickChoice(text) {
    const target = choiceTarget(text);
    if (!target) return false;
    target.click();
    return true;
  }

  function findLineTarget(number) {
    const selector = 'button,[role="button"],[role="option"],[tabindex="0"],li,pre,code,div';
    const matches = [];
    for (const element of document.querySelectorAll(selector)) {
      if (!isVisible(element)) continue;
      const line = parseCodeLine(element);
      if (line?.number === number) matches.push({ element, size: line.text.length });
    }
    matches.sort((a, b) => a.size - b.size);
    return matches[0]?.element || null;
  }

  async function selectLines(lineNumbers) {
    let selected = 0;
    for (const number of [...new Set(lineNumbers)]) {
      const target = findLineTarget(number);
      if (target) {
        target.click();
        selected++;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    return selected;
  }

  function inputControls(root = document) {
    return [...root.querySelectorAll('input:not([type]),input[type="text"],input[type="number"],input[type="search"],textarea,select,[contenteditable="true"]')]
      .filter((element) => {
        if (!isVisible(element) || element.disabled || element.readOnly) return false;
        if (element.closest(".monaco-editor,.ace_editor") || element.classList.contains("ace_text-input")) return false;
        return true;
      });
  }

  function findBlankLabel(index) {
    const pattern = new RegExp("^blank\\s*#?\\s*" + index + "$", "i");
    const nodes = document.querySelectorAll("label,div,span,p,strong,h1,h2,h3,h4");
    return [...nodes].find((node) =>
      isVisible(node) && pattern.test(normalizeText(node.innerText || node.textContent))
    ) || null;
  }

  function writeControl(element, value) {
    if (element.isContentEditable) {
      element.textContent = value;
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      return true;
    }
    if (element.tagName === "SELECT") {
      const option = [...element.options].find((item) =>
        normalizeText(item.text).toLowerCase() === normalizeText(value).toLowerCase() ||
        String(item.value) === String(value)
      );
      if (!option) return false;
      element.value = option.value;
    } else {
      const proto = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(element, value);
      else element.value = value;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function fillTextAnswer(value) {
    const target = inputControls()[0];
    return target ? writeControl(target, value) : false;
  }

  async function fillBlanks(blanks) {
    const ordered = blanks.slice().sort((a, b) => a.index - b.index);
    if (!ordered.length) return { filled: 0, detail: "Không có đáp án blank trong JSON." };

    let filled = 0;
    for (let i = 0; i < ordered.length; i++) {
      const item = ordered[i];
      let done = false;
      let group = findBlankLabel(item.index);

      for (let depth = 0; group && depth < 6 && !done; depth++, group = group.parentElement) {
        const option = choiceTarget(item.answer, group);
        if (option) {
          option.click();
          done = true;
          break;
        }
        const controls = inputControls(group);
        if (controls.length) done = writeControl(controls[0], item.answer);
      }

      if (!done) {
        const controls = inputControls();
        if (controls[i]) done = writeControl(controls[i], item.answer);
      }
      if (!done) done = clickChoice(item.answer);
      if (done) filled++;
      await new Promise((resolve) => setTimeout(resolve, 140));
    }
    return { filled, detail: "Đã điền/chọn " + filled + "/" + ordered.length + " ô trống." };
  }

  async function submitAnswer() {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const buttons = [...document.querySelectorAll("button,[role='button']")].filter(isVisible);
    const button = buttons.find((element) => {
      const text = normalizeText(element.innerText || element.getAttribute("aria-label")).toLowerCase();
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
    } else if (solution.type === "lines") {
      const numbers = solution.lineNumbers?.length
        ? solution.lineNumbers
        : (String(solution.answer).match(/\d+/g) || []).map(Number);
      const selected = await selectLines(numbers);
      filled = selected === numbers.length && selected > 0;
      detail = `Đã chọn ${selected}/${numbers.length} dòng.`;
    } else if (solution.type === "blanks") {
      const result = await fillBlanks(solution.blanks || []);
      filled = result.filled === (solution.blanks || []).length && result.filled > 0;
      detail = result.detail;
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