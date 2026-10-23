const apiKeyField = document.getElementById("apiKey");
const modelField = document.getElementById("model");
const autoSubmitField = document.getElementById("autoSubmit");
const solveButton = document.getElementById("solve");
const saveButton = document.getElementById("save");
const statusBox = document.getElementById("status");
const resultBox = document.getElementById("result");

(async function loadSettings() {
  const saved = await chrome.storage.local.get(["apiKey", "model", "autoSubmit"]);
  apiKeyField.value = saved.apiKey || "";
  modelField.value = saved.model || "gpt-6-astra";
  autoSubmitField.checked = saved.autoSubmit !== false;
})();

async function saveSettings() {
  await chrome.storage.local.set({
    apiKey: apiKeyField.value.trim(),
    model: modelField.value.trim() || "gpt-6-astra",
    autoSubmit: autoSubmitField.checked
  });
}

saveButton.addEventListener("click", async () => {
  await saveSettings();
  statusBox.textContent = "Đã lưu cài đặt trên máy này.";
});

solveButton.addEventListener("click", async () => {
  solveButton.disabled = true;
  resultBox.hidden = true;
  statusBox.textContent = "Đang đọc bài tập…";

  try {
    await saveSettings();
    if (!apiKeyField.value.trim()) throw new Error("Nhập OpenAI API key trước.");

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https:\/\/(?:[^/]+\.)?coddy\.tech\//.test(tab.url || "")) {
      throw new Error("Mở trang bài tập Coddy rồi thử lại.");
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      files: ["page-bridge.js"]
    });
    const pageReply = await chrome.tabs.sendMessage(tab.id, { type: "GET_EXERCISE" });
    if (!pageReply?.ok) throw new Error(pageReply?.error || "Không đọc được bài tập trên trang.");

    statusBox.textContent = "Đang tạo lời giải…";
    const apiReply = await chrome.runtime.sendMessage({
      type: "SOLVE_EXERCISE",
      exercise: pageReply.exercise
    });
    if (!apiReply?.ok) throw new Error(apiReply?.error || "Không nhận được lời giải.");

    statusBox.textContent = "Đang điền vào Coddy…";
    const applied = await chrome.tabs.sendMessage(tab.id, {
      type: "APPLY_SOLUTION",
      solution: apiReply.solution,
      autoSubmit: autoSubmitField.checked
    });

    resultBox.textContent = [
      applied?.detail || "Không rõ trạng thái điền.",
      apiReply.solution.explanation ? "\nGiải thích: " + apiReply.solution.explanation : "",
      applied?.submitted ? "\nĐã bấm Submit." :
        (autoSubmitField.checked ? "\nChưa tìm thấy nút Submit phù hợp; hãy kiểm tra trang." : "\nĐã bỏ qua bước Submit.")
    ].join("");
    resultBox.hidden = false;
    statusBox.textContent = applied?.ok ? "Hoàn tất." : "Đã tạo lời giải nhưng chưa điền được.";
  } catch (error) {
    statusBox.textContent = error.message || String(error);
  } finally {
    solveButton.disabled = false;
  }
});