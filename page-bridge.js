(() => {
  if (window.__coddyHelperPageBridge) return;
  window.__coddyHelperPageBridge = true;

  function readEditor() {
    try {
      const editors = window.monaco?.editor?.getEditors?.() || [];
      if (editors.length) return { ok: true, kind: "monaco", code: editors[0].getValue() };
      const models = window.monaco?.editor?.getModels?.() || [];
      if (models.length) return { ok: true, kind: "monaco-model", code: models[0].getValue() };
    } catch {}

    try {
      const nodes = document.querySelectorAll(".ace_editor");
      if (nodes.length && window.ace?.edit) {
        const editor = window.ace.edit(nodes[0]);
        return { ok: true, kind: "ace", code: editor.getValue() };
      }
    } catch {}

    const textarea = [...document.querySelectorAll("textarea")].find((node) =>
      node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0
    );
    if (textarea) return { ok: true, kind: "textarea", code: textarea.value || "" };

    return { ok: false, error: "Không thấy Monaco, Ace hoặc textarea." };
  }

  function writeEditor(value) {
    try {
      const editors = window.monaco?.editor?.getEditors?.() || [];
      if (editors.length) {
        editors[0].setValue(value);
        return { ok: true, kind: "monaco" };
      }
      const models = window.monaco?.editor?.getModels?.() || [];
      if (models.length) {
        models[0].setValue(value);
        return { ok: true, kind: "monaco-model" };
      }
    } catch {}

    try {
      const nodes = document.querySelectorAll(".ace_editor");
      if (nodes.length && window.ace?.edit) {
        window.ace.edit(nodes[0]).setValue(value, -1);
        return { ok: true, kind: "ace" };
      }
    } catch {}

    const textarea = [...document.querySelectorAll("textarea")].find((node) =>
      node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0
    );
    if (textarea) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      if (setter) setter.call(textarea, value);
      else textarea.value = value;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
      return { ok: true, kind: "textarea" };
    }

    return { ok: false, error: "Không tìm thấy editor có thể điền." };
  }

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (event.source !== window || data?.source !== "coddy-helper-content") return;
    const result = data.action === "get" ? readEditor()
      : data.action === "set" ? writeEditor(String(data.value || ""))
      : { ok: false, error: "Thao tác không hợp lệ." };
    window.postMessage({ source: "coddy-helper-page", id: data.id, result }, "*");
  });
})();